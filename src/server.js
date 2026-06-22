import express from "express";
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

function cleanOrigin(origin = "") {
  return String(origin).trim().replace(/\/+$/, "");
}

const allowedOrigins = [
  env.clientUrl,
  env.serverUrl,
  ...(env.corsOrigins || []),
  "http://localhost:5173",
  "http://localhost:5000",
  "https://digital-life-lessons-moeen.vercel.app",
  "https://digital-life-lessons-server-five.vercel.app"
]
  .filter(Boolean)
  .map(cleanOrigin);

/*
  Manual CORS middleware.
  This must stay before Better Auth and all API routes.
*/
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const cleanReqOrigin = cleanOrigin(origin);

  if (!origin || allowedOrigins.includes(cleanReqOrigin)) {
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }

    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      req.headers["access-control-request-headers"] ||
        "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    return next();
  }

  if (req.method === "OPTIONS") {
    return res.status(403).end();
  }

  return res.status(403).json({
    message: `CORS blocked for origin: ${origin}`
  });
});

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
  res.json({
    ok: true,
    app: "Digital Life Lessons API",
    allowedOrigins
  })
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