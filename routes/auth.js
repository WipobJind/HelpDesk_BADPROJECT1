const express = require("express");
const msal = require("@azure/msal-node");
const jwt = require("jsonwebtoken");
const prisma = require("../services/prisma");

const router = express.Router();

const REDIRECT_URI = "https://helpdesk-badproject1.duckdns.org/helpdesk/api/auth/callback";

function getMsalClient() {
  return new msal.ConfidentialClientApplication({
    auth: {
      clientId: process.env.AZURE_AD_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
    },
  });
}

// GET /helpdesk/api/auth/login - redirects user to Microsoft login
router.get("/login", async (req, res) => {
  try {
    const msalClient = getMsalClient();
    const authUrl = await msalClient.getAuthCodeUrl({
      scopes: ["user.read"],
      redirectUri: REDIRECT_URI,
    });
    res.redirect(authUrl);
  } catch (error) {
    console.error("AD login redirect error:", error);
    res.status(500).json({ error: "Failed to initiate login" });
  }
});

// GET /helpdesk/api/auth/callback - Microsoft redirects here after login
router.get("/callback", async (req, res) => {
  try {
    const msalClient = getMsalClient();
    const tokenResponse = await msalClient.acquireTokenByCode({
      code: req.query.code,
      scopes: ["user.read"],
      redirectUri: REDIRECT_URI,
    });

    const { oid, name, preferred_username } = tokenResponse.account.idTokenClaims;
    const email = preferred_username || tokenResponse.account.username;

    // Find or create the user based on their AD Object ID
    let user = await prisma.user.findUnique({ where: { adObjectId: oid } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          adObjectId: oid,
          name: name || email,
          email: email,
          role: "STUDENT", // default role; admins can promote via /admin routes
        },
      });
    }

    // Issue our own app JWT, same as before
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

        // Redirect to the frontend with the token as a query param
    res.redirect(`/helpdesk/?token=${token}`);
  } catch (error) {
    console.error("AD callback error:", error);
    res.status(500).json({ error: "AD authentication failed" });
  }
});

// GET /helpdesk/api/auth/me - get current user info from JWT
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = router;
