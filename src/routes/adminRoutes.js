import express from "express";
import { col } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get("/stats", async (_req, res) => {
  const users = await col("users");
  const lessons = await col("lessons");
  const reports = await col("lessonsReports");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [totalUsers, totalPublicLessons, totalReports, todayLessons, activeContributors, lessonGrowth, userGrowth] = await Promise.all([
    users.countDocuments(),
    lessons.countDocuments({ visibility: "Public" }),
    reports.countDocuments(),
    lessons.countDocuments({ createdAt: { $gte: today } }),
    lessons.aggregate([{ $group: { _id: "$creatorId", name: { $first: "$creatorName" }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }]).toArray(),
    lessons.aggregate([{ $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, lessons: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $limit: 14 }]).toArray(),
    users.aggregate([{ $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, users: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $limit: 14 }]).toArray()
  ]);
  res.json({ totalUsers, totalPublicLessons, totalReports, todayLessons, activeContributors, lessonGrowth, userGrowth });
});

export default router;
