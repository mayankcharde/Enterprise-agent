const express = require("express");
const config = require("../config");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/", authenticate, async (req, res, next) => {
  try {
    const question = String(req.body?.question || "").trim();
    if (question.length < 2 || question.length > 3000) {
      return res.status(400).json({ error: "Question must be between 2 and 3000 characters" });
    }

    const response = await fetch(`${config.ragApiUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const result = await response.json();
    if (!response.ok) return res.status(502).json({ error: result.detail || "RAG question failed" });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
