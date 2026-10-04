const express = require("express");
const { ObjectId } = require("mongodb");
const { getDatabase } = require("../db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

function userId(req) {
  return ObjectId.createFromHexString(req.user.sub);
}

function conversationId(value) {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

function publicConversation(conversation) {
  return {
    id: conversation._id.toString(),
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const conversations = await getDatabase()
      .collection("conversations")
      .find({ userId: userId(req) })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();
    return res.json({ conversations: conversations.map(publicConversation) });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const now = new Date();
    const title = String(req.body?.title || "New chat").trim().slice(0, 120) || "New chat";
    const conversation = { userId: userId(req), title, createdAt: now, updatedAt: now };
    const result = await getDatabase().collection("conversations").insertOne(conversation);
    conversation._id = result.insertedId;
    return res.status(201).json({ conversation: publicConversation(conversation), messages: [] });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = conversationId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid conversation id" });
    const conversation = await getDatabase().collection("conversations").findOne({ _id: id, userId: userId(req) });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    const messages = await getDatabase().collection("messages").find({ conversationId: id }).sort({ createdAt: 1 }).toArray();
    return res.json({
      conversation: publicConversation(conversation),
      messages: messages.map((message) => ({
        id: message._id.toString(),
        role: message.role,
        content: message.content,
        metadata: message.metadata || {},
        createdAt: message.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = { router, conversationId, userId };
