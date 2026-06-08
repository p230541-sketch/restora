import { Request, Response, NextFunction } from "express";

/**
 * Wraps an async route handler so thrown/rejected errors are forwarded to
 * Express's error middleware instead of crashing the process or hanging the
 * request. Removes the repetitive try/catch → res.status(500) block that was
 * copy-pasted into nearly every handler.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Terminal error handler. Mirrors the previous behaviour: 500 + { error }. */
export function errorMiddleware(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("[api] unhandled error:", err?.message ?? err);
  if (res.headersSent) return;
  res.status(err?.status ?? 500).json({ error: err?.message ?? "Internal server error" });
}
