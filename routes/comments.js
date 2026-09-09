const express = require("express");
const prisma = require("../services/prisma");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

// POST /helpdesk/api/tickets/:id/comments - Add a comment
router.post("/:id/comments", verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    const ticketId = parseInt(req.params.id);

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Students/Faculty can only comment on their own tickets
    if (
      (req.user.role === "STUDENT" || req.user.role === "FACULTY") &&
      ticket.requesterId !== req.user.userId
    ) {
      return res.status(403).json({ error: "You can only comment on your own tickets" });
    }

    const comment = await prisma.ticketUpdate.create({
      data: {
        message,
        ticketId,
        authorId: req.user.userId,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// GET /helpdesk/api/tickets/:id/comments - Get comments for a ticket
router.get("/:id/comments", verifyToken, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Students/Faculty can only view comments on their own tickets
    if (
      (req.user.role === "STUDENT" || req.user.role === "FACULTY") &&
      ticket.requesterId !== req.user.userId
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const comments = await prisma.ticketUpdate.findMany({
      where: { ticketId },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(comments);
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ error: "Failed to get comments" });
  }
});

module.exports = router;
