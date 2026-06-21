import { connectDb, col } from "./db.js";
import { env } from "./config.js";

await connectDb();
const users = await col("users");
const lessons = await col("lessons");

await users.updateOne(
  { email: env.adminEmail },
  {
    $setOnInsert: {
      authId: "seed-admin",
      name: "Admin User",
      email: env.adminEmail,
      photoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300",
      role: "admin",
      isPremium: true,
      createdAt: new Date()
    },
    $set: { updatedAt: new Date() }
  },
  { upsert: true }
);

const count = await lessons.countDocuments();
if (count === 0) {
  const now = new Date();
  await lessons.insertMany([
    {
      title: "Start Before You Feel Ready",
      description: "Most growth begins before confidence arrives. Taking one small step creates evidence that you can continue. Waiting for perfect timing usually becomes a polite name for fear.",
      category: "Personal Growth",
      emotionalTone: "Motivational",
      image: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200",
      visibility: "Public",
      accessLevel: "Free",
      creatorId: "seed-admin",
      creatorEmail: env.adminEmail,
      creatorName: "Admin User",
      creatorPhoto: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300",
      likes: [],
      likesCount: 1200,
      favoritesCount: 342,
      commentsCount: 0,
      reportsCount: 0,
      isFeatured: true,
      isReviewed: true,
      views: 7589,
      readingTime: 1,
      createdAt: now,
      updatedAt: now
    },
    {
      title: "A Career Lesson From Failure",
      description: "The missed opportunity was not the end. It became a mirror showing which skills needed practice, which habits needed discipline, and which people truly supported the journey.",
      category: "Career",
      emotionalTone: "Realization",
      image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200",
      visibility: "Public",
      accessLevel: "Premium",
      creatorId: "seed-admin",
      creatorEmail: env.adminEmail,
      creatorName: "Admin User",
      creatorPhoto: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300",
      likes: [],
      likesCount: 860,
      favoritesCount: 215,
      commentsCount: 0,
      reportsCount: 0,
      isFeatured: true,
      isReviewed: true,
      views: 4120,
      readingTime: 1,
      createdAt: now,
      updatedAt: now
    }
  ]);
}
console.log("Seed completed");
process.exit(0);
