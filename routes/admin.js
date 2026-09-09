const express = require("express");
const prisma = require("../services/prisma");
const verifyToken = require("../middleware/verifyToken");
const authorize = require("../middleware/rbac");

const router = express.Router();

// GET /helpdesk/api/admin/users - List all users
router.get(
  "/users",
  verifyToken,
  authorize("ADMIN"),
  async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              submittedTickets: true,
              assignedTickets: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(users);
    } catch (error) {
      console.error("List users error:", error);
      res.status(500).json({ error: "Failed to list users" });
    }
  }
);

// PATCH /helpdesk/api/admin/users/:id/role - Update user role
router.patch(
  "/users/:id/role",
  verifyToken,
  authorize("ADMIN"),
  async (req, res) => {
    try {
      const { role } = req.body;
      const validRoles = ["STUDENT", "FACULTY", "TECHNICIAN", "ADMIN"];

      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({
          error: `Role must be one of: ${validRoles.join(", ")}`,
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: parseInt(req.params.id) },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Prevent admin from demoting themselves
      if (user.id === req.user.userId && role !== "ADMIN") {
        return res.status(400).json({ error: "Cannot change your own admin role" });
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role },
        select: { id: true, name: true, email: true, role: true },
      });

      res.json(updated);
    } catch (error) {
      console.error("Update role error:", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  }
);

// DELETE /helpdesk/api/admin/users/:id - Delete a user
router.delete(
  "/users/:id",
  verifyToken,
  authorize("ADMIN"),
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      if (userId === req.user.userId) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await prisma.user.delete({ where: { id: userId } });

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  }
);

module.exports = router;
