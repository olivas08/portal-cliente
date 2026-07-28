import { describe, it, expect } from "vitest";
import {
  computeDiscrepancy,
  isMachineOnline,
} from "@/services/production-status";
import {
  machineIngestSchema,
  createMachineSchema,
} from "@/services/production.service";

describe("computeDiscrepancy", () => {
  it("flags when operator over-declares vs machine", () => {
    const d = computeDiscrepancy(55, 50);
    expect(d.delta).toBe(5);
    expect(d.absDelta).toBe(5);
    expect(d.flagged).toBe(true);
    expect(d.pct).toBeCloseTo(0.1, 5);
  });

  it("is not flagged when values match", () => {
    const d = computeDiscrepancy(50, 50);
    expect(d.flagged).toBe(false);
    expect(d.pct).toBe(0);
  });

  it("handles a negative delta (operator under-declares)", () => {
    const d = computeDiscrepancy(40, 50);
    expect(d.delta).toBe(-10);
    expect(d.absDelta).toBe(10);
    expect(d.flagged).toBe(true);
  });

  it("treats declared-with-zero-machine as fully discrepant", () => {
    const d = computeDiscrepancy(10, 0);
    expect(d.pct).toBe(1);
    expect(d.flagged).toBe(true);
  });
});

describe("isMachineOnline", () => {
  const now = new Date("2026-07-28T10:00:00Z");
  it("is offline when never seen", () => {
    expect(isMachineOnline(null, now)).toBe(false);
  });
  it("is online within the window", () => {
    expect(isMachineOnline(new Date("2026-07-28T09:59:30Z"), now)).toBe(true);
  });
  it("is offline past the window", () => {
    expect(isMachineOnline(new Date("2026-07-28T09:58:00Z"), now)).toBe(false);
  });
});

describe("machineIngestSchema", () => {
  it("accepts a valid pulse and defaults deltas to 0", () => {
    const r = machineIngestSchema.parse({
      machineCode: "PRENSA-01",
      token: "prensa01-demo-token",
      eventId: "evt-1",
    });
    expect(r.goodDelta).toBe(0);
    expect(r.scrapDelta).toBe(0);
  });

  it("rejects negative deltas", () => {
    expect(
      machineIngestSchema.safeParse({
        machineCode: "X",
        token: "t",
        eventId: "e",
        goodDelta: -1,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-integer delta", () => {
    expect(
      machineIngestSchema.safeParse({
        machineCode: "X",
        token: "t",
        eventId: "e",
        goodDelta: 1.5,
      }).success,
    ).toBe(false);
  });
});

describe("createMachineSchema", () => {
  it("accepts a valid machine", () => {
    expect(
      createMachineSchema.safeParse({
        code: "PRENSA-02",
        name: "Prensa 02",
        token: "supersecret",
      }).success,
    ).toBe(true);
  });

  it("rejects a code with invalid characters", () => {
    expect(
      createMachineSchema.safeParse({
        code: "PRENSA 02!",
        name: "Prensa",
        token: "supersecret",
      }).success,
    ).toBe(false);
  });

  it("rejects a short token", () => {
    expect(
      createMachineSchema.safeParse({ code: "M1", name: "M", token: "123" })
        .success,
    ).toBe(false);
  });
});

import { downtimeOnResume, isDownState } from "@/services/production-status";
import { machineStatusSchema } from "@/services/production.service";

describe("downtimeOnResume", () => {
  const now = new Date("2026-07-28T10:10:00Z");
  it("banks elapsed idle time on resume", () => {
    expect(
      downtimeOnResume("idle", new Date("2026-07-28T10:00:00Z"), now),
    ).toBeCloseTo(10, 5);
  });
  it("banks elapsed down time on resume", () => {
    expect(
      downtimeOnResume("down", new Date("2026-07-28T10:05:00Z"), now),
    ).toBeCloseTo(5, 5);
  });
  it("banks nothing when previously running", () => {
    expect(
      downtimeOnResume("run", new Date("2026-07-28T10:00:00Z"), now),
    ).toBe(0);
  });
  it("banks nothing without a stateSince", () => {
    expect(downtimeOnResume("idle", null, now)).toBe(0);
  });
});

describe("isDownState", () => {
  it("classifies idle/down as non-productive", () => {
    expect(isDownState("idle")).toBe(true);
    expect(isDownState("down")).toBe(true);
    expect(isDownState("run")).toBe(false);
    expect(isDownState("offline")).toBe(false);
  });
});

describe("machineStatusSchema", () => {
  it("accepts a valid state", () => {
    expect(
      machineStatusSchema.safeParse({
        machineCode: "CNC-02",
        token: "t",
        state: "down",
      }).success,
    ).toBe(true);
  });
  it("rejects an unknown state", () => {
    expect(
      machineStatusSchema.safeParse({
        machineCode: "CNC-02",
        token: "t",
        state: "explode",
      }).success,
    ).toBe(false);
  });
});
