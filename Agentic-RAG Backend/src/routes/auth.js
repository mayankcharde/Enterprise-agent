const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { getDatabase } = require("../db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return { id: user._id.toString(), email: user.email, name: user.name, role: user.role };
}

function issueToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail) || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Use a valid email and a password of at least 8 characters" });
    }

    const users = getDatabase().collection("users");
    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ error: "An account with this email already exists" });

    const user = {
      email: normalizedEmail,
      name: String(name || normalizedEmail.split("@")[0]).trim().slice(0, 100),
      passwordHash: await bcrypt.hash(password, 12),
      role: "employee",
      createdAt: new Date(),
    };
    const result = await users.insertOne(user);
    user._id = result.insertedId;
    return res.status(201).json({ user: publicUser(user), token: issueToken(user) });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const normalizedEmail = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const user = await getDatabase().collection("users").findOne({ email: normalizedEmail });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    return res.json({ user: publicUser(user), token: issueToken(user) });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await getDatabase().collection("users").findOne({ _id: require("mongodb").ObjectId.createFromHexString(req.user.sub) });
    if (!user) return res.status(401).json({ error: "User account no longer exists" });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
