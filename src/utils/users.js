import { col } from "../db.js";
import { env } from "../config.js";

export async function ensureAppUser(authUser) {
  if (!authUser?.email) return null;
  const users = await col("users");
  const existing = await users.findOne({ email: authUser.email });
  const isAdminEmail = authUser.email.toLowerCase() === env.adminEmail.toLowerCase();
  const patch = {
    authId: authUser.id,
    name: authUser.name || authUser.email.split("@")[0],
    email: authUser.email,
    photoURL: authUser.image || authUser.photoURL || existing?.photoURL || "",
    role: existing?.role || (isAdminEmail ? "admin" : "user"),
    isPremium: Boolean(existing?.isPremium || isAdminEmail),
    updatedAt: new Date()
  };

  if (!existing) {
    const insert = { ...patch, createdAt: new Date() };
    const result = await users.insertOne(insert);
    return { ...insert, _id: result.insertedId };
  }
  await users.updateOne({ _id: existing._id }, { $set: patch });
  return { ...existing, ...patch };
}
