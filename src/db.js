import { MongoClient } from "mongodb";
import { env, assertEnv } from "./config.js";

let client;
let db;

export async function connectDb() {
  if (db) return db;
  assertEnv();
  client = new MongoClient(env.mongoUri);
  await client.connect();
  db = client.db(env.dbName);
  await createIndexes(db);
  console.log(`MongoDB connected: ${env.dbName}`);
  return db;
}

export async function getMongoClient() {
  if (!client) await connectDb();
  return client;
}

export async function col(name) {
  const database = await connectDb();
  return database.collection(name);
}

async function createIndexes(database) {
  await Promise.all([
    database.collection("users").createIndex({ email: 1 }, { unique: true }),
    database.collection("lessons").createIndex({ title: "text", description: "text", category: 1, emotionalTone: 1 }),
    database.collection("lessons").createIndex({ creatorId: 1, createdAt: -1 }),
    database.collection("lessons").createIndex({ visibility: 1, accessLevel: 1, createdAt: -1 }),
    database.collection("favorites").createIndex({ userId: 1, lessonId: 1 }, { unique: true }),
    database.collection("comments").createIndex({ lessonId: 1, createdAt: -1 }),
    database.collection("lessonsReports").createIndex({ lessonId: 1, reporterUserId: 1 }),
    database.collection("auditLogs").createIndex({ createdAt: -1 })
  ]);
}
