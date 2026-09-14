import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    rateLimitAttempt: {
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/headers", () => ({
  headers: async () => new Map<string, string>(),
}));

import { checkRateLimit, assertRateLimit } from "@/lib/rate-limit";
import { RateLimitedError } from "@/lib/errors";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.rateLimitAttempt.create.mockResolvedValue({});
  prismaMock.rateLimitAttempt.deleteMany.mockResolvedValue({ count: 0 });
});

describe("checkRateLimit", () => {
  it("allows the first attempt in a window", async () => {
    prismaMock.rateLimitAttempt.count.mockResolvedValue(0);
    await expect(
      checkRateLimit("login:ip:1.1.1.1", { max: 5, windowMs: 60_000 }),
    ).resolves.toBe(true);
    expect(prismaMock.rateLimitAttempt.create).toHaveBeenCalledTimes(1);
  });

  it("blocks when the count is already at the max", async () => {
    prismaMock.rateLimitAttempt.count.mockResolvedValue(5);
    await expect(
      checkRateLimit("login:ip:1.1.1.1", { max: 5, windowMs: 60_000 }),
    ).resolves.toBe(false);
    expect(prismaMock.rateLimitAttempt.create).not.toHaveBeenCalled();
  });
});

describe("assertRateLimit", () => {
  it("throws RateLimitedError when over the limit", async () => {
    prismaMock.rateLimitAttempt.count.mockResolvedValue(3);
    await expect(
      assertRateLimit("pin:op1", { max: 3, windowMs: 60_000 }),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });
});
