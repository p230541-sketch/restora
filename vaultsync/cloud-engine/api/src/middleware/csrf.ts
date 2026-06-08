import { Request, Response, NextFunction } from "express";
import { CSRF_COOKIE } from "../lib/cookies";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Double-submit-cookie CSRF protection for state-changing requests.
 *
 * Only cookie-authenticated requests need it — Bearer-token requests are not
 * CSRF-able (browsers never auto-attach an Authorization header cross-site), so
 * they're allowed through. This also keeps a Bearer-based client working during
 * the migration to cookie auth.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if ((req.headers.authorization ?? "").startsWith("Bearer ")) return next();

  const cookieToken = (req as any).cookies?.[CSRF_COOKIE];
  const headerToken = req.get("X-CSRF-Token");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({ error: "Invalid or missing CSRF token" });
    return;
  }
  next();
}
