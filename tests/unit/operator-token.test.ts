import { describe, it, expect, beforeAll } from "vitest";
import {
  createOperatorToken,
  readOperatorToken,
} from "@/lib/operator-token";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-operator-tokens";
});

describe("operator token", () => {
  it("round-trips a valid token", () => {
    const token = createOperatorToken("op-123");
    expect(readOperatorToken(token)).toBe("op-123");
  });

  it("rejects a tampered payload", () => {
    const token = createOperatorToken("op-123");
    const [, sig] = token.split(".");
    const forged = `${Buffer.from("op-999.9999999999999").toString("base64url")}.${sig}`;
    expect(readOperatorToken(forged)).toBeNull();
  });

  it("rejects an expired token", () => {
    const past = Date.now() - 13 * 60 * 60 * 1000; // issued 13h ago (TTL 12h)
    const token = createOperatorToken("op-123", past);
    expect(readOperatorToken(token)).toBeNull();
  });

  it("rejects empty or malformed input", () => {
    expect(readOperatorToken(undefined)).toBeNull();
    expect(readOperatorToken("")).toBeNull();
    expect(readOperatorToken("not-a-token")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createOperatorToken("op-123");
    process.env.AUTH_SECRET = "a-different-secret";
    try {
      expect(readOperatorToken(token)).toBeNull();
    } finally {
      process.env.AUTH_SECRET = "test-secret-for-operator-tokens";
    }
  });
});
