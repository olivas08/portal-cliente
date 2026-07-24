import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "@/lib/errors";
import {
  OPERATOR_COOKIE,
  OPERATOR_TTL_SECONDS,
  createOperatorToken,
  readOperatorToken,
} from "@/lib/operator-token";

export interface OperatorActor {
  id: string;
  name: string;
}

/** Issues the signed operator cookie after a successful PIN login. */
export async function setOperatorCookie(operatorId: string): Promise<void> {
  const store = await cookies();
  store.set(OPERATOR_COOKIE, createOperatorToken(operatorId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OPERATOR_TTL_SECONDS,
  });
}

export async function clearOperatorCookie(): Promise<void> {
  const store = await cookies();
  store.delete(OPERATOR_COOKIE);
}

async function getOperatorIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  return readOperatorToken(store.get(OPERATOR_COOKIE)?.value);
}

/**
 * Terminal-side guard: resolves the operator from the signed cookie and
 * confirms they are still active. The shop-floor equivalent of `requireUser`.
 */
export async function requireOperator(): Promise<OperatorActor> {
  const operatorId = await getOperatorIdFromCookie();
  if (!operatorId) throw new UnauthorizedError("Sessão de operador expirada.");

  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
  });
  if (!operator || !operator.active) {
    throw new UnauthorizedError("Operador inativo.");
  }
  return { id: operator.id, name: operator.name };
}

/** Non-throwing variant for pages that render a login screen when absent. */
export async function getOperator(): Promise<OperatorActor | null> {
  try {
    return await requireOperator();
  } catch {
    return null;
  }
}
