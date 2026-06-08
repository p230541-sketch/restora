import { describe, it, expect } from "vitest";
import { formatBytes, formatHMS, timeAgo, formatTimestamp } from "./format";

describe("formatBytes", () => {
  it("returns — for null/0", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(0)).toBe("—");
  });
  it("scales across units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1500)).toBe("2 KB");
    expect(formatBytes(2_500_000)).toBe("2.5 MB");
    expect(formatBytes(3_200_000_000)).toBe("3.2 GB");
    expect(formatBytes(1_100_000_000_000)).toBe("1.1 TB");
  });
});

describe("formatHMS", () => {
  it("returns — for null", () => {
    expect(formatHMS(null)).toBe("—");
  });
  it("zero-pads h:m:s", () => {
    expect(formatHMS(0)).toBe("00:00:00");
    expect(formatHMS(59)).toBe("00:00:59");
    expect(formatHMS(3661)).toBe("01:01:01");
  });
});

describe("timeAgo", () => {
  it("returns Never for null", () => {
    expect(timeAgo(null)).toBe("Never");
  });
  it("bucket sizes are correct", () => {
    const now = Date.now();
    expect(timeAgo(new Date(now - 30_000).toISOString())).toBe("30s ago");
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString())).toBe("5m ago");
    expect(timeAgo(new Date(now - 3 * 3_600_000).toISOString())).toBe("3h ago");
    expect(timeAgo(new Date(now - 2 * 86_400_000).toISOString())).toBe("2d ago");
  });
});

describe("formatTimestamp presets", () => {
  const ts = "2026-06-08T14:05:09Z";
  it("compact omits the year, full includes it", () => {
    expect(formatTimestamp(ts, "full")).toMatch(/2026/);
    expect(formatTimestamp(ts, "compact")).not.toMatch(/2026/);
  });
});
