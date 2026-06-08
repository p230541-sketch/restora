import { describe, it, expect } from "vitest";
import { fieldMatches, secondsUntilNextRun } from "./cron";

describe("fieldMatches", () => {
  it("wildcard matches anything", () => {
    expect(fieldMatches("*", 0)).toBe(true);
    expect(fieldMatches("*", 59)).toBe(true);
  });
  it("step (*/n)", () => {
    expect(fieldMatches("*/2", 4)).toBe(true);
    expect(fieldMatches("*/2", 5)).toBe(false);
    expect(fieldMatches("*/15", 30)).toBe(true);
  });
  it("range (a-b)", () => {
    expect(fieldMatches("9-17", 12)).toBe(true);
    expect(fieldMatches("9-17", 18)).toBe(false);
  });
  it("comma list and literal", () => {
    expect(fieldMatches("0,30", 30)).toBe(true);
    expect(fieldMatches("0,30", 15)).toBe(false);
    expect(fieldMatches("5", 5)).toBe(true);
  });
});

describe("secondsUntilNextRun", () => {
  it("returns null for malformed expressions", () => {
    expect(secondsUntilNextRun("not a cron")).toBeNull();
    expect(secondsUntilNextRun("* * *")).toBeNull();
  });

  // Local-time constructor (month is 0-indexed: 5 = June) so assertions are
  // timezone-independent — the matcher reads local minute/hour fields.
  it("'*/2 * * * *' fires within the next 2 minutes", () => {
    const from = new Date(2026, 5, 8, 12, 0, 30);
    const secs = secondsUntilNextRun("*/2 * * * *", from);
    expect(secs).toBeGreaterThan(0);
    expect(secs).toBeLessThanOrEqual(120);
  });

  it("computes the exact next fire for a specific minute", () => {
    // 12:00:00 → '5 * * * *' next fires at 12:05:00 → 300s
    const from = new Date(2026, 5, 8, 12, 0, 0);
    expect(secondsUntilNextRun("5 * * * *", from)).toBe(300);
  });

  it("rolls to the next hour when the minute has passed", () => {
    // 12:10:00 → '5 * * * *' next is 13:05:00 → 55 min = 3300s
    const from = new Date(2026, 5, 8, 12, 10, 0);
    expect(secondsUntilNextRun("5 * * * *", from)).toBe(3300);
  });
});
