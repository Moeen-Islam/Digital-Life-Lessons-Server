import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { connectDb, getMongoClient } from "./db.js";
import { env } from "./config.js";

const database = await connectDb();
const client = await getMongoClient();

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

const fixedAdminEmail = normalizeEmail(env.adminEmail);
const fixedAdminPassword = String(env.adminPassword || "");

export const auth = betterAuth({
  appName: "Digital Life Lessons",
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  trustedOrigins: [
    env.clientUrl,
    env.serverUrl,
    ...(env.corsOrigins || []),
    "http://localhost:5173",
    "http://localhost:5000",
    "https://digital-life-lessons-moeen.vercel.app",
    "https://digital-life-lessons-server-five.vercel.app"
  ].filter(Boolean),
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

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const path = ctx.path;
      const email = normalizeEmail(ctx.body?.email);
      const password = String(ctx.body?.password || "");

      if (path === "/sign-up/email" && email === fixedAdminEmail) {
        if (password !== fixedAdminPassword) {
          throw new APIError("FORBIDDEN", {
            message: "This admin email is reserved. Use the fixed admin password."
          });
        }
      }

      if (path === "/sign-in/email" && email === fixedAdminEmail) {
        if (password !== fixedAdminPassword) {
          throw new APIError("FORBIDDEN", {
            message: "Invalid admin password."
          });
        }
      }
    })
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = normalizeEmail(user.email);

          if (email === fixedAdminEmail) {
            return {
              data: {
                ...user,
                role: "admin",
                isPremium: true
              }
            };
          }

          return {
            data: {
              ...user,
              role: "user",
              isPremium: false
            }
          };
        }
      }
    }
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        required: false
      },
      isPremium: {
        type: "boolean",
        defaultValue: false,
        required: false
      },
      photoURL: {
        type: "string",
        required: false
      }
    }
  }
});