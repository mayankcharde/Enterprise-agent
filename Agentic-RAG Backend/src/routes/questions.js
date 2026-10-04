const express = require("express");
const config = require("../config");
const { authenticate } = require("../middleware/auth");
const { ObjectId } = require("mongodb");
const { getDatabase } = require("../db");

const router = express.Router();

router.post("/", authenticate, async (req, res, next) => {
  try {
    const question = String(req.body?.question || "").trim();
    if (question.length < 2 || question.length > 3000) {
      return res.status(400).json({ error: "Question must be between 2 and 3000 characters" });
    }

    let conversationId = req.body?.conversationId;
    if (!ObjectId.isValid(conversationId)) {
      const now = new Date();
      const created = await getDatabase().collection("conversations").insertOne({
        userId: ObjectId.createFromHexString(req.user.sub),
        title: question.slice(0, 80),
        createdAt: now,
        updatedAt: now,
      });
      conversationId = created.insertedId.toString();
    }
    const conversationObjectId = ObjectId.createFromHexString(conversationId);
    const conversation = await getDatabase().collection("conversations").findOne({
      _id: conversationObjectId,
      userId: ObjectId.createFromHexString(req.user.sub),
    });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const messages = getDatabase().collection("messages");
    await messages.insertOne({
      conversationId: conversationObjectId,
      userId: conversation.userId,
      role: "user",
      content: question,
      createdAt: new Date(),
    });
    const response = await fetch(`${config.ragApiUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        user_id: req.user.sub,
        conversation_id: conversationObjectId.toString(),
      }),
    });
    const result = await response.json();
    if (!response.ok) return res.status(502).json({ error: result.detail || "RAG question failed" });
    await messages.insertOne({
      conversationId: conversationObjectId,
      userId: conversation.userId,
      role: "assistant",
      content: result.answer || "No answer was returned.",
      metadata: result,
      createdAt: new Date(),
    });
    await getDatabase().collection("conversations").updateOne(
      { _id: conversationObjectId },
      {
        $set: { updatedAt: new Date() },
        $setOnInsert: { title: question.slice(0, 80) },
      },
    );
    if (conversation.title === "New chat") {
      await getDatabase().collection("conversations").updateOne(
        { _id: conversationObjectId },
        { $set: { title: question.slice(0, 80) } },
      );
    }
    return res.json({ ...result, conversationId });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
