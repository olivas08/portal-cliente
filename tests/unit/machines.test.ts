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
