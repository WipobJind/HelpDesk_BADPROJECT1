const express = require("express");
const prisma = require("../services/prisma");
const verifyToken = require("../middleware/verifyToken");
const authorize = require("../middleware/rbac");
const { categorizeTicket } = require("../services/geminiService");
const { notifyTechnicians } = require("../services/emailService");

const router = express.Router();

// POST /helpdesk/api/tickets - Submit a new ticket
router.post("/", verifyToken, async (req, res) => {
  try {
    const { title, description, roomLocation } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }

    // AI categorization via Gemini
    const categoryName = await categorizeTicket(title, description);

    // Find or create category
    let category = await prisma.category.findUnique({ where: { name: categoryName } });
    if (!category) {
      category = await prisma.category.create({ data: { name: categoryName } });
    }

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        roomLocation: roomLocation || null,
        categoryId: category.id,
        requesterId: req.user.userId,
      },
      include: {
        category: true,
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    // Send email notification to technicians
    notifyTechnicians(ticket).catch((err) =>
      console.error("Email notification error:", err.message)
    );

    res.status(201).json(ticket);
  } catch (error) {
    console.error("Create ticket error:", error);
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

// GET /helpdesk/api/tickets - List tickets
router.get("/", verifyToken, async (req, res) => {
  try {
    const { status, priority, categoryId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    // Students and Faculty can only see their own tickets
    if (req.user.role === "STUDENT" || req.user.role === "FACULTY") {
      where.requesterId = req.user.userId;
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (categoryId) where.categoryId = parseInt(categoryId);

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          category: true,
          requester: { select: { id: true, name: true, email: true } },
          technician: { select: { id: true, name: true, email: true } },
        },
        orderBy: [
          { priority: "desc" },
          { createdAt: "desc" },
        ],
        skip,
        take: parseInt(limit),
      }),
      prisma.ticket.count({ where }),
    ]);

    res.json({
      tickets,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("List tickets error:", error);
    res.status(500).json({ error: "Failed to list tickets" });
  }
});

// GET /helpdesk/api/tickets/:id - Get ticket details
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        category: true,
        requester: { select: { id: true, name: true, email: true } },
        technician: { select: { id: true, name: true, email: true } },
        updates: {
          include: { author: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Students/Faculty can only view their own tickets
    if (
      (req.user.role === "STUDENT" || req.user.role === "FACULTY") &&
      ticket.requesterId !== req.user.userId
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(ticket);
  } catch (error) {
    console.error("Get ticket error:", error);
    res.status(500).json({ error: "Failed to get ticket" });
  }
});

// PATCH /helpdesk/api/tickets/:id/claim - Claim a ticket
router.patch(
  "/:id/claim",
  verifyToken,
  authorize("TECHNICIAN", "ADMIN"),
  async (req, res) => {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: parseInt(req.params.id) },
      });

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      if (ticket.status !== "OPEN") {
        return res.status(400).json({ error: "Ticket is not open for claiming" });
      }

      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "CLAIMED",
          technicianId: req.user.userId,
        },
        include: {
          category: true,
          requester: { select: { id: true, name: true, email: true } },
          technician: { select: { id: true, name: true, email: true } },
        },
      });

      // Log status change
      await prisma.ticketUpdate.create({
        data: {
          message: "Ticket claimed",
          ticketId: ticket.id,
          authorId: req.user.userId,
        },
      });

      res.json(updated);
    } catch (error) {
      console.error("Claim ticket error:", error);
      res.status(500).json({ error: "Failed to claim ticket" });
    }
  }
);

// PATCH /helpdesk/api/tickets/:id/status - Update ticket status
router.patch(
  "/:id/status",
  verifyToken,
  authorize("TECHNICIAN", "ADMIN"),
  async (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = ["OPEN", "CLAIMED", "IN_PROGRESS", "RESOLVED", "CLOSED"];

      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          error: `Status must be one of: ${validStatuses.join(", ")}`,
        });
      }

      const ticket = await prisma.ticket.findUnique({
        where: { id: parseInt(req.params.id) },
      });

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status },
        include: {
          category: true,
          requester: { select: { id: true, name: true, email: true } },
          technician: { select: { id: true, name: true, email: true } },
        },
      });

      await prisma.ticketUpdate.create({
        data: {
          message: `Status updated to ${status}`,
          ticketId: ticket.id,
          authorId: req.user.userId,
        },
      });

      res.json(updated);
    } catch (error) {
      console.error("Update status error:", error);
      res.status(500).json({ error: "Failed to update ticket status" });
    }
  }
);

// PATCH /helpdesk/api/tickets/:id/resolve - Resolve a ticket
router.patch(
  "/:id/resolve",
  verifyToken,
  authorize("TECHNICIAN", "ADMIN"),
  async (req, res) => {
    try {
      const { resolution } = req.body;

      const ticket = await prisma.ticket.findUnique({
        where: { id: parseInt(req.params.id) },
      });

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      if (ticket.status === "CLOSED") {
        return res.status(400).json({ error: "Ticket is already closed" });
      }

      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "RESOLVED" },
        include: {
          category: true,
          requester: { select: { id: true, name: true, email: true } },
          technician: { select: { id: true, name: true, email: true } },
        },
      });

      await prisma.ticketUpdate.create({
        data: {
          message: resolution || "Ticket resolved",
          ticketId: ticket.id,
          authorId: req.user.userId,
        },
      });

      res.json(updated);
    } catch (error) {
      console.error("Resolve ticket error:", error);
      res.status(500).json({ error: "Failed to resolve ticket" });
    }
  }
);

module.exports = router;
