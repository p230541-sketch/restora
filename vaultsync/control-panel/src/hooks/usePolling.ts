import { useEffect, useRef } from "react";

/**
 * Runs `fn` once immediately, then every `intervalMs` while `enabled`.
 * Replaces the hand-rolled setInterval loops in TopBar, Dashboard, and NodeDetail.
 * The latest `fn` is always used without resetting the timer.
 */
export function usePolling(fn: () => void, intervalMs: number, enabled = true): void {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled) return;
    saved.current();
    const id = setInterval(() => saved.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
