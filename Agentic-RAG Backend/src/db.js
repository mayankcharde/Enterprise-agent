const { MongoClient } = require("mongodb");
const config = require("./config");

let client;
let database;

async function connectDatabase() {
  if (database) return database;

  client = new MongoClient(config.mongodbUri);
  await client.connect();
  database = client.db(config.mongodbDb);
  await database.collection("users").createIndex({ email: 1 }, { unique: true });
  await database.collection("documents").createIndex({ uploadedAt: -1 });
  await database.collection("conversations").createIndex({ userId: 1, updatedAt: -1 });
  await database.collection("messages").createIndex({ conversationId: 1, createdAt: 1 });
  return database;
}

function getDatabase() {
  if (!database) {
    throw new Error("MongoDB is not connected");
  }
  return database;
}

async function closeDatabase() {
  if (client) await client.close();
  client = undefined;
  database = undefined;
}

module.exports = { connectDatabase, getDatabase, closeDatabase };
