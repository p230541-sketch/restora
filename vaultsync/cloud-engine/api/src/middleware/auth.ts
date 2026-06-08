import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE } from "../lib/cookies";

export type Role = "SysAdmin" | "BusinessOwner" | "ReadOnly";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

const SECRET = process.env.JWT_SECRET ?? "vaultsync-dev-secret-change-me";
const EXPIRES_IN = "8h";

export function signToken(user: AuthUser): string {
  return jwt.sign(user, SECRET, { expiresIn: EXPIRES_IN });
}

/** Resolve a JWT from the httpOnly cookie, a Bearer header, or the `?token=` query (SSE). */
export function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const headerToken = header.startsWith("Bearer ") ? header.slice(7) : "";
  const cookieToken = (req as any).cookies?.[AUTH_COOKIE] ?? "";
  const queryToken = typeof req.query.token === "string" ? req.query.token : "";
  const token = cookieToken || headerToken || queryToken;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const p = jwt.verify(token, SECRET) as AuthUser;
    req.user = { id: p.id, email: p.email, name: p.name, role: p.role };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Gate a route to one or more roles. Must run after `authenticate`. */
export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: `Requires role: ${roles.join(" or ")}` });
      return;
    }
    next();
  };
}
