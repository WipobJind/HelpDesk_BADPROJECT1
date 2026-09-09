require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const commentRoutes = require("./routes/comments");
const analyticsRoutes = require("./routes/analytics");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/helpdesk/api/health", (req, res) => {
  res.json({ status: "ok", service: "helpdesk-api" });
});

// Routes
app.use("/helpdesk/api/auth", authRoutes);
app.use("/helpdesk/api/tickets", ticketRoutes);
app.use("/helpdesk/api/tickets", commentRoutes);
app.use("/helpdesk/api/analytics", analyticsRoutes);
app.use("/helpdesk/api/admin", adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`HelpDesk API running on port ${PORT}`);
});

module.exports = app;
