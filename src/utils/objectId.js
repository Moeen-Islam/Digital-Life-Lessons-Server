import { ObjectId } from "mongodb";

export function objectId(id) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

export function serializeId(doc) {
  if (!doc) return doc;
  return { ...doc, _id: doc._id?.toString?.() || doc._id };
}
