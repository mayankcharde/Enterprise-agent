const express = require("express");
const bcrypt = require("bcryptjs");
const { getDatabase } = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicAdmin(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

router.use(authenticate, requireRole("admin"));

router.get("/admins", async (_req, res, next) => {
  try {
    const admins = await getDatabase().collection("users")
      .find({ role: "admin" }, { projection: { email: 1, name: 1, role: 1, createdAt: 1 } })
      .sort({ createdAt: 1 })
      .toArray();
    return res.json({ admins: admins.map(publicAdmin) });
  } catch (error) {
    return next(error);
  }
});

router.post("/admins", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const name = String(req.body?.name || "").trim().slice(0, 100);
    const password = String(req.body?.password || "");
    if (!emailPattern.test(email) || !name || password.length < 8) {
      return res.status(400).json({ error: "Use a valid email, name, and a password of at least 8 characters" });
    }

    const users = getDatabase().collection("users");
    if (await users.findOne({ email })) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const admin = {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin",
      createdAt: new Date(),
    };
    const result = await users.insertOne(admin);
    admin._id = result.insertedId;
    return res.status(201).json({ admin: publicAdmin(admin) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
