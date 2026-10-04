const express = require("express");
const multer = require("multer");
const FormData = require("form-data");
const config = require("../config");
const { getDatabase } = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});
const allowedExtensions = new Set([".pdf", ".txt", ".md", ".docx"]);

router.get("/", authenticate, async (req, res, next) => {
  try {
    const documents = await getDatabase().collection("documents")
      .find({}, { projection: { filename: 1, chunks: 1, uploadedAt: 1, uploadedBy: 1 } })
      .sort({ uploadedAt: -1 })
      .toArray();
    return res.json({ documents });
  } catch (error) {
    return next(error);
  }
});

router.post("/", authenticate, requireRole("admin"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "A document file is required" });
    const extension = req.file.originalname.slice(req.file.originalname.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      return res.status(400).json({ error: "Supported files: PDF, TXT, Markdown, and DOCX" });
    }

    const form = new FormData();
    form.append("file", req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
    const response = await fetch(`${config.ragApiUrl}/api/ingest`, {
      method: "POST",
      headers: {
        ...form.getHeaders(),
        "Content-Length": form.getLengthSync(),
        "X-Admin-Key": config.ragAdminApiKey,
      },
      body: form.getBuffer(),
    });
    const result = await response.json();
    if (!response.ok) return res.status(502).json({ error: result.detail || "RAG ingestion failed" });

    const document = {
      filename: result.file || req.file.originalname,
      chunks: result.chunks || 0,
      uploadedBy: { id: req.user.sub, email: req.user.email },
      uploadedAt: new Date(),
    };
    const inserted = await getDatabase().collection("documents").insertOne(document);
    return res.status(201).json({ document: { ...document, id: inserted.insertedId.toString() } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
