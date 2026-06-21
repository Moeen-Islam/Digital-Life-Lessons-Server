import express from "express";
import Stripe from "stripe";
import { env } from "../config.js";
import { col } from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();
const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;

router.post("/create-checkout-session", requireAuth, async (req, res) => {
  if (!stripe) return res.status(500).json({ message: "Stripe secret key is missing" });
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: req.user.email,
    client_reference_id: req.user.authId,
    metadata: {
      authId: req.user.authId,
      email: req.user.email,
      plan: "premium-lifetime"
    },
    line_items: [
      {
        price_data: {
          currency: "bdt",
          unit_amount: 150000,
          product_data: {
            name: "Digital Life Lessons Premium Lifetime",
            description: "Lifetime access to premium lessons and premium lesson creation."
          }
        },
        quantity: 1
      }
    ],
    success_url: `${env.clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.clientUrl}/payment/cancel`
  });
  res.json({ url: session.url });
});

export async function stripeWebhook(req, res) {
  if (!stripe) return res.status(500).send("Stripe not configured");
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.stripeWebhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const authId = session.metadata?.authId || session.client_reference_id;
    if (authId) {
      await (await col("users")).updateOne(
        { authId },
        {
          $set: {
            isPremium: true,
            premiumSince: new Date(),
            stripeSessionId: session.id,
            updatedAt: new Date()
          }
        }
      );
      await (await col("auditLogs")).insertOne({ type: "premium_upgrade", authId, email: session.customer_email, createdAt: new Date() });
    }
  }
  res.json({ received: true });
}

export default router;
