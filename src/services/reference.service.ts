import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ReferencePrefix = "ENC" | "REQ";

const MAX_ATTEMPTS = 5;

async function countForYear(prefix: ReferencePrefix, year: number): Promise<number> {
  const where = { reference: { startsWith: `${prefix}-${year}-` } };
  return prefix === "ENC"
    ? prisma.order.count({ where })
    : prisma.request.count({ where });
}

async function nextCandidate(prefix: ReferencePrefix): Promise<string> {
  const year = new Date().getFullYear();
  const count = await countForYear(prefix, year);
  return `${prefix}-${year}-${String(count + 1).padStart(3, "0")}`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Generates a per-year sequential reference (ENC-2026-001, REQ-2026-014, …)
 * and runs `create` with it. Because `count()`-then-`create()` can race under
 * concurrent creates, a unique-constraint collision on `reference` is retried
 * with a freshly computed candidate instead of surfacing as a crash.
 */
export async function createWithReference<T>(
  prefix: ReferencePrefix,
  create: (reference: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const reference = await nextCandidate(prefix);
    try {
      return await create(reference);
    } catch (error) {
      if (isUniqueViolation(error) && attempt < MAX_ATTEMPTS) continue;
      throw error;
    }
  }
  throw new Error("Não foi possível gerar uma referência única.");
}
