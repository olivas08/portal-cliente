import crypto from "node:crypto";

/**
 * Pure HMAC token helpers for the shop-floor operator session. Operators are
 * not portal (next-auth) users — they authenticate on the shared terminal with
 * a PIN and carry a short-lived signed cookie instead. Kept free of I/O so the
 * signing/verification logic is unit-testable.
 */

const TTL_MS = 12 * 60 * 60 * 1000; // one work shift

export const OPERATOR_COOKIE = "oic_operator";
export const OPERATOR_TTL_SECONDS = TTL_MS / 1000;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET em falta.");
  return value;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Builds a signed `<operatorId.expiry>.<signature>` token. */
export function createOperatorToken(operatorId: string, now = Date.now()): string {
  const payload = `${operatorId}.${now + TTL_MS}`;
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(payload)}`;
}

/** Verifies a token and returns the operator id, or null if invalid/expired. */
export function readOperatorToken(
  token: string | undefined | null,
  now = Date.now(),
): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const payload = Buffer.from(encoded, "base64url").toString("utf8");

  const expected = sign(payload);
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(provided, expectedBuf)) return null;

  const sep = payload.lastIndexOf(".");
  if (sep <= 0) return null;
  const operatorId = payload.slice(0, sep);
  const expiry = Number(payload.slice(sep + 1));
  if (!operatorId || !Number.isFinite(expiry) || expiry < now) return null;

  return operatorId;
}
