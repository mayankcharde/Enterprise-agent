const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  mongodbUri: required("MONGODB_URI"),
  mongodbDb: process.env.MONGODB_DB || "enterprise_it_rag",
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  ragApiUrl: process.env.RAG_API_URL || "http://127.0.0.1:8080",
  ragAdminApiKey: required("RAG_ADMIN_API_KEY"),
  adminEmail: required("ADMIN_EMAIL").toLowerCase(),
  adminPassword: required("ADMIN_PASSWORD"),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://127.0.0.1:8000"
};
