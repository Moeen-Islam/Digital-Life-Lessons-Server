import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",

  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  serverUrl: process.env.SERVER_URL || "http://localhost:5000",
  betterAuthUrl: process.env.BETTER_AUTH_URL || "http://localhost:5000",

  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
    : [],

  mongoUri: process.env.MONGODB_URI,
  dbName: process.env.DB_NAME || "digitalLifeLessons",

  betterAuthSecret: process.env.BETTER_AUTH_SECRET,

  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,

  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,

  adminEmail: process.env.ADMIN_EMAIL || "admin@digitallifelessons.com",
  adminPassword: process.env.ADMIN_PASSWORD || "Admin123"
};

export function assertEnv() {
  const required = ["mongoUri", "betterAuthSecret"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
