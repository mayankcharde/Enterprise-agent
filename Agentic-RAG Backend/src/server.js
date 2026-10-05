const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const config = require("./config");
const { connectDatabase, getDatabase, closeDatabase } = require("./db");
const authRoutes = require("./routes/auth");
const documentRoutes = require("./routes/documents");
const questionRoutes = require("./routes/questions");
const conversationRoutes = require("./routes/conversations").router;
const adminRoutes = require("./routes/admin");

const app = express();
app.use(helmet());
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "enterprise-it-rag-backend" }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/conversations", conversationRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File must be 25 MB or smaller" });
  return res.status(500).json({ error: "Internal server error" });
});

async function seedAdmin() {
  const users = getDatabase().collection("users");
  const existing = await users.findOne({ email: config.adminEmail });
  if (!existing) {
    await users.insertOne({
      email: config.adminEmail,
      name: "Administrator",
      passwordHash: await bcrypt.hash(config.adminPassword, 12),
      role: "admin",
      createdAt: new Date(),
    });
    console.log(`Seeded admin account: ${config.adminEmail}`);
  } else if (existing.role !== "admin") {
    await users.updateOne({ _id: existing._id }, { $set: { role: "admin" } });
  }
}

async function start() {
  await connectDatabase();
  await seedAdmin();
  const server = app.listen(config.port, () => console.log(`Auth backend listening on port ${config.port}`));
  const shutdown = async () => {
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Unable to start backend:", error.message);
    process.exit(1);
  });
}

module.exports = { app, start };
