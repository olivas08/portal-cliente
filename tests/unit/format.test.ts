import { describe, it, expect } from "vitest";
import { formatEur, formatRelativeTime } from "@/lib/format";

describe("formatEur", () => {
  it("formats with two decimal places and a euro suffix", () => {
    expect(formatEur(12.5)).toMatch(/12[,.]50\s*€/);
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-09-14T12:00:00.000Z");

  it("returns nunca for a missing timestamp", () => {
    expect(formatRelativeTime(null, now)).toBe("nunca");
  });

  it("returns agora for the last few seconds", () => {
    expect(formatRelativeTime("2026-09-14T11:59:58.000Z", now)).toBe("agora");
  });

  it("uses minutes under an hour", () => {
    expect(formatRelativeTime("2026-09-14T11:50:00.000Z", now)).toBe("há 10 min");
  });
});
