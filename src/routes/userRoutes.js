import express from "express";
import { col } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  const lessons = await col("lessons");
  const favorites = await col("favorites");
  const [lessonsCount, savedCount] = await Promise.all([
    lessons.countDocuments({ creatorId: req.user.authId }),
    favorites.countDocuments({ userId: req.user.authId })
  ]);
  res.json({ user: { ...req.user, _id: req.user._id.toString(), lessonsCount, savedCount } });
});

router.patch("/me", requireAuth, async (req, res) => {
  const { name, photoURL } = req.body;
  const users = await col("users");
  const patch = { updatedAt: new Date() };
  if (name) patch.name = String(name).trim();
  if (photoURL !== undefined) patch.photoURL = String(photoURL).trim();
  await users.updateOne({ authId: req.user.authId }, { $set: patch });
  const updated = await users.findOne({ authId: req.user.authId });
  res.json({ message: "Profile updated", user: { ...updated, _id: updated._id.toString() } });
});

router.get("/profile/:authId", async (req, res) => {
  const users = await col("users");
  const lessons = await col("lessons");
  const user = await users.findOne({ authId: req.params.authId }, { projection: { email: 0 } });
  if (!user) return res.status(404).json({ message: "Author not found" });
  const publicLessons = await lessons
    .find({ creatorId: req.params.authId, visibility: "Public" })
    .sort({ createdAt: -1 })
    .limit(30)
    .toArray();
  res.json({
    user: { ...user, _id: user._id.toString() },
    lessons: publicLessons.map((lesson) => ({ ...lesson, _id: lesson._id.toString() }))
  });
});

router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const users = await col("users");
  const lessons = await col("lessons");
  const list = await users.find({}).sort({ createdAt: -1 }).toArray();
  const lessonCounts = await lessons
    .aggregate([{ $group: { _id: "$creatorId", count: { $sum: 1 } } }])
    .toArray();
  const map = new Map(lessonCounts.map((item) => [item._id, item.count]));
  res.json({ users: list.map((user) => ({ ...user, _id: user._id.toString(), totalLessons: map.get(user.authId) || 0 })) });
});

router.patch("/:email/role", requireAuth, requireAdmin, async (req, res) => {
  const role = req.body.role === "admin" ? "admin" : "user";
  const users = await col("users");
  await users.updateOne({ email: req.params.email }, { $set: { role, updatedAt: new Date() } });
  res.json({ message: `Role updated to ${role}` });
});

router.delete("/:email", requireAuth, requireAdmin, async (req, res) => {
  const users = await col("users");
  await users.deleteOne({ email: req.params.email });
  res.json({ message: "User removed from app profile collection" });
});

export default router;
