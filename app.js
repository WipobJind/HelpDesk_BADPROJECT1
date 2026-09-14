require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { loadSecrets } = require("./services/keyvault");

async function main() {
  // Load secrets from Key Vault (or .env fallback) BEFORE requiring
  // anything that reads process.env at import time (Prisma, etc.)
  const secrets = await loadSecrets();

  // Overwrite process.env so existing code (Prisma client, services)
  // continues to work unchanged
  process.env.DATABASE_URL = secrets.DATABASE_URL;
  process.env.JWT_SECRET = secrets.JWT_SECRET;
  process.env.GEMINI_API_KEY = secrets.GEMINI_API_KEY;
  process.env.SENDGRID_API_KEY = secrets.SENDGRID_API_KEY;
  process.env.SENDGRID_FROM_EMAIL = secrets.SENDGRID_FROM_EMAIL;
  process.env.AZURE_AD_CLIENT_SECRET = secrets.AZURE_AD_CLIENT_SECRET;
  // Only require routes AFTER secrets are set, since some of these
  // modules create clients (Prisma, SendGrid) at import time
  const authRoutes = require("./routes/auth");
  const ticketRoutes = require("./routes/tickets");
  const commentRoutes = require("./routes/comments");
  const analyticsRoutes = require("./routes/analytics");
  const adminRoutes = require("./routes/admin");

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  app.get("/helpdesk/api/health", (req, res) => {
    res.json({ status: "ok", service: "helpdesk-api" });
  });

  app.use("/helpdesk/api/auth", authRoutes);
  app.use("/helpdesk/api/tickets", ticketRoutes);
  app.use("/helpdesk/api/tickets", commentRoutes);
  app.use("/helpdesk/api/analytics", analyticsRoutes);
  app.use("/helpdesk/api/admin", adminRoutes);

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal server error" });
  });

  app.listen(PORT, () => {
    console.log(`HelpDesk API running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
