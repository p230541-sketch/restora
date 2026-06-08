// Pure cron helpers, extracted from Dashboard so they can be unit-tested.

// Cron field matcher supporting wildcard, step (slash-n), "a-b" ranges, comma lists, and literals.
export function fieldMatches(field: string, value: number): boolean {
  return field.split(",").some((part) => {
    if (part === "*") return true;
    if (part.startsWith("*/")) {
      const step = parseInt(part.slice(2), 10);
      return step > 0 && value % step === 0;
    }
    if (part.includes("-")) {
      const [a, b] = part.split("-").map((n) => parseInt(n, 10));
      return value >= a && value <= b;
    }
    return parseInt(part, 10) === value;
  });
}

/**
 * Seconds until the next time a 5-field cron expression fires (searches up to 7
 * days). Returns null for a malformed expression or if nothing matches in range.
 */
export function secondsUntilNextRun(cron: string, from: Date = new Date()): number | null {
  const p = cron.trim().split(/\s+/);
  if (p.length !== 5) return null;
  const [min, hr, dom, mon, dow] = p;
  const start = new Date(from);
  start.setSeconds(0, 0);
  for (let i = 1; i <= 7 * 24 * 60; i++) {
    const t = new Date(start.getTime() + i * 60000);
    if (
      fieldMatches(min, t.getMinutes()) &&
      fieldMatches(hr, t.getHours()) &&
      fieldMatches(dom, t.getDate()) &&
      fieldMatches(mon, t.getMonth() + 1) &&
      fieldMatches(dow, t.getDay())
    ) {
      return Math.max(0, Math.round((t.getTime() - from.getTime()) / 1000));
    }
  }
  return null;
}
