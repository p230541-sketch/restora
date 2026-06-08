import { CookieOptions } from "express";

export const AUTH_COOKIE = "vaultsync_token";
export const CSRF_COOKIE = "vaultsync_csrf";

const isProd = process.env.NODE_ENV === "production";
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // matches the JWT's 8h lifetime

// httpOnly auth cookie — not readable by JS, so it survives XSS far better than
// a localStorage token. SameSite=lax + the CSRF double-submit cover CSRF.
export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProd, // HTTPS-only in production
  path: "/",
  maxAge: MAX_AGE_MS,
};

// Readable companion token for the double-submit CSRF check.
export const csrfCookieOptions: CookieOptions = {
  httpOnly: false,
  sameSite: "lax",
  secure: isProd,
  path: "/",
  maxAge: MAX_AGE_MS,
};
