import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { connectDb, getMongoClient } from "./db.js";
import { env } from "./config.js";

const database = await connectDb();
const client = await getMongoClient();

export const auth = betterAuth({
  appName: "Digital Life Lessons",
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  trustedOrigins: [env.clientUrl, env.serverUrl].filter(Boolean),
  database: mongodbAdapter(database, { client }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    autoSignIn: true,
    requireEmailVerification: false
  },

  socialProviders: {
    google: {
      clientId: env.googleClientId || "",
      clientSecret: env.googleClientSecret || ""
    }
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"]
    }
  },

  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "user", required: false },
      isPremium: { type: "boolean", defaultValue: false, required: false },
      photoURL: { type: "string", required: false }
    }
  }
});