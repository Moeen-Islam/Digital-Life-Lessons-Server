import express from "express";
import cors from "cors";
import morgan from "morgan";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { env } from "./config.js";
import { connectDb } from "./db.js";
import userRoutes from "./routes/userRoutes.js";
import lessonRoutes from "./routes/lessonRoutes.js";
import paymentRoutes, { stripeWebhook } from "./routes/paymentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

await connectDb();

const app = express();

const allowedOrigins = [
  env.clientUrl,
  env.serverUrl,
  ...(env.corsOrigins || []),
  "http://localhost:5173",
  "http://localhost:5000",
  "https://digital-life-lessons-moeen.vercel.app",
  "https://digital-life-lessons-server-five.vercel.app"
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow Postman/server-to-server/no-origin requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

// Better Auth must be mounted before express.json().
app.all("/api/auth/*", toNodeHandler(auth));

// Stripe webhooks need the raw body.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, app: "Digital Life Lessons API" })
);

app.use("/api/users", userRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Server running on ${env.serverUrl}`);
  console.log("Allowed CORS origins:", allowedOrigins);
});