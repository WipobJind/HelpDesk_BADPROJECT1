const express = require("express");
const prisma = require("../services/prisma");
const verifyToken = require("../middleware/verifyToken");
const authorize = require("../middleware/rbac");

const router = express.Router();

// GET /helpdesk/api/analytics - Get resolution analytics
router.get(
  "/",
  verifyToken,
  authorize("TECHNICIAN", "ADMIN"),
  async (req, res) => {
    try {
      // Total tickets by status
      const statusCounts = await prisma.ticket.groupBy({
        by: ["status"],
        _count: { id: true },
      });

      // Total tickets by priority
      const priorityCounts = await prisma.ticket.groupBy({
        by: ["priority"],
        _count: { id: true },
      });

      // Total tickets by category
      const categoryCounts = await prisma.ticket.groupBy({
        by: ["categoryId"],
        _count: { id: true },
      });

      // Fetch category names
      const categories = await prisma.category.findMany();
      const categoryMap = {};
      categories.forEach((c) => (categoryMap[c.id] = c.name));

      const categoryBreakdown = categoryCounts.map((item) => ({
        category: categoryMap[item.categoryId] || "Uncategorized",
        count: item._count.id,
      }));

      // Technician workload
      const technicianWorkload = await prisma.ticket.groupBy({
        by: ["technicianId"],
        where: { technicianId: { not: null } },
        _count: { id: true },
      });

      // Get technician names
      const techIds = technicianWorkload.map((t) => t.technicianId);
      const technicians = await prisma.user.findMany({
        where: { id: { in: techIds } },
        select: { id: true, name: true },
      });
      const techMap = {};
      technicians.forEach((t) => (techMap[t.id] = t.name));

      const workload = technicianWorkload.map((item) => ({
        technician: techMap[item.technicianId] || "Unknown",
        ticketCount: item._count.id,
      }));

      // Total counts
      const totalTickets = await prisma.ticket.count();
      const openTickets = await prisma.ticket.count({
        where: { status: { in: ["OPEN", "CLAIMED", "IN_PROGRESS"] } },
      });
      const resolvedTickets = await prisma.ticket.count({
        where: { status: { in: ["RESOLVED", "CLOSED"] } },
      });

      res.json({
        summary: {
          total: totalTickets,
          open: openTickets,
          resolved: resolvedTickets,
        },
        statusBreakdown: statusCounts.map((s) => ({
          status: s.status,
          count: s._count.id,
        })),
        priorityBreakdown: priorityCounts.map((p) => ({
          priority: p.priority,
          count: p._count.id,
        })),
        categoryBreakdown,
        technicianWorkload: workload,
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to get analytics" });
    }
  }
);

module.exports = router;
