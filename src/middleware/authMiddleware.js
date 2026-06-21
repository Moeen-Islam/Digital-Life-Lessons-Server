import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";
import { ensureAppUser } from "../utils/users.js";

export async function optionalAuth(req, _res, next) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (session?.user) {
      req.authUser = session.user;
      req.user = await ensureAppUser(session.user);
    }
  } catch (_error) {
    req.authUser = null;
    req.user = null;
  }
  next();
}

export async function requireAuth(req, res, next) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) return res.status(401).json({ message: "Please login first." });
    req.authUser = session.user;
    req.user = await ensureAppUser(session.user);
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired session.", details: error.message });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  return next();
}
