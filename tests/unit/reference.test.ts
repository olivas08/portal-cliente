import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { count: vi.fn() },
    request: { count: vi.fn() },
    quote: { count: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { createWithReference } from "@/services/reference.service";

const year = new Date().getFullYear();

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint", {
    code: "P2002",
    clientVersion: "6.0.0",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createWithReference", () => {
  it("passes the first sequential reference to create", async () => {
    prismaMock.order.count.mockResolvedValue(0);
    const create = vi.fn().mockResolvedValue({ id: "o1" });

    const result = await createWithReference("ENC", create);

    expect(create).toHaveBeenCalledWith(`ENC-${year}-001`);
    expect(result).toEqual({ id: "o1" });
  });

  it("uses the REQ prefix and request table for requests", async () => {
    prismaMock.request.count.mockResolvedValue(13);
    const create = vi.fn().mockResolvedValue({ id: "r1" });

    await createWithReference("REQ", create);

    expect(prismaMock.request.count).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(`REQ-${year}-014`);
  });

  it("uses the ORC prefix and quote table for quotes", async () => {
    prismaMock.quote.count.mockResolvedValue(2);
    const create = vi.fn().mockResolvedValue({ id: "q1" });

    await createWithReference("ORC", create);

    expect(prismaMock.quote.count).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(`ORC-${year}-003`);
  });

  it("retries with a fresh candidate on a unique-constraint collision", async () => {
    prismaMock.order.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5);
    const create = vi
      .fn()
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce({ id: "o2" });

    const result = await createWithReference("ENC", create);

    expect(create).toHaveBeenNthCalledWith(1, `ENC-${year}-005`);
    expect(create).toHaveBeenNthCalledWith(2, `ENC-${year}-006`);
    expect(result).toEqual({ id: "o2" });
  });

  it("rethrows errors that are not unique-constraint collisions", async () => {
    prismaMock.order.count.mockResolvedValue(0);
    const create = vi.fn().mockRejectedValue(new Error("db down"));

    await expect(createWithReference("ENC", create)).rejects.toThrow("db down");
    expect(create).toHaveBeenCalledTimes(1);
  });
});
