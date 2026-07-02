import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSignIn, prismaMock, mockHash, mockSendEmail, mockGetBaseUrl } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    company: {
      create: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockHash: vi.fn(),
  mockSendEmail: vi.fn(),
  mockGetBaseUrl: vi.fn(),
}));

vi.mock("@/auth", () => ({ signIn: mockSignIn, signOut: vi.fn() }));
vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {},
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: mockSendEmail }));
vi.mock("@/lib/url", () => ({ getBaseUrl: mockGetBaseUrl }));
vi.mock("bcryptjs", () => ({
  default: { hash: mockHash, compare: vi.fn() },
}));

import { registerAction, requestPasswordReset, resetPassword } from "@/actions/auth";

const validRegisterInput = {
  companyName: "Auto Peças Mota, Lda.",
  name: "Jorge Mota",
  email: "jorge@motapecas.pt",
  password: "segredo123",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockHash.mockResolvedValue("hashed-password");
  mockGetBaseUrl.mockResolvedValue("https://portal.example.com");
  prismaMock.user.findUnique.mockResolvedValue(null);
  prismaMock.company.create.mockResolvedValue({ id: "c-new" });
  // $transaction receives a callback; execute it with a tx object mirroring prismaMock.
  prismaMock.$transaction.mockImplementation(async (arg) => {
    if (typeof arg === "function") {
      return arg({ company: prismaMock.company, user: { create: vi.fn() } });
    }
    return Promise.all(arg);
  });
  mockSignIn.mockResolvedValue(undefined);
});

describe("registerAction — validation", () => {
  it("rejects a company name that is too short", async () => {
    const result = await registerAction({ ...validRegisterInput, companyName: "A" });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid email", async () => {
    const result = await registerAction({ ...validRegisterInput, email: "not-an-email" });
    expect(result.ok).toBe(false);
  });

  it("rejects a short password", async () => {
    const result = await registerAction({ ...validRegisterInput, password: "123" });
    expect(result.ok).toBe(false);
  });
});

describe("registerAction — duplicate email", () => {
  it("rejects when the email is already registered", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1" });
    const result = await registerAction(validRegisterInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/já existe/i);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("registerAction — success", () => {
  it("creates the company and user, then signs the user in", async () => {
    const result = await registerAction(validRegisterInput);
    expect(result.ok).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(mockHash).toHaveBeenCalledWith(validRegisterInput.password, 10);
    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: validRegisterInput.email,
      password: validRegisterInput.password,
      redirect: false,
    });
  });

  it("still reports success even if the auto sign-in throws", async () => {
    mockSignIn.mockRejectedValue(new Error("boom"));
    const result = await registerAction(validRegisterInput);
    expect(result.ok).toBe(true);
  });
});

describe("requestPasswordReset", () => {
  it("does nothing for an unknown email (no leak)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await requestPasswordReset("ghost@nowhere.pt");
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("creates a token and sends an email for a known user", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "jorge@motapecas.pt" });
    prismaMock.passwordResetToken.create.mockResolvedValue({});
    await requestPasswordReset("jorge@motapecas.pt");
    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.passwordResetToken.create.mock.calls[0][0].data;
    expect(data.userId).toBe("u1");
    expect(data.expiresAt).toBeInstanceOf(Date);
    expect(mockSendEmail).toHaveBeenCalledWith(
      "jorge@motapecas.pt",
      expect.stringContaining("https://portal.example.com/reset-password?token=")
    );
  });
});

describe("resetPassword", () => {
  it("rejects a short password", async () => {
    const result = await resetPassword("sometoken", "123");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty token", async () => {
    const result = await resetPassword("", "goodpassword");
    expect(result.ok).toBe(false);
  });

  it("rejects when the token does not exist", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);
    const result = await resetPassword("badtoken", "goodpassword");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/inválido/i);
  });

  it("rejects an expired token", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    const result = await resetPassword("expiredtoken", "goodpassword");
    expect(result.ok).toBe(false);
  });

  it("rejects an already-used token", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60),
    });
    const result = await resetPassword("usedtoken", "goodpassword");
    expect(result.ok).toBe(false);
  });

  it("updates the password and marks the token as used", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 1000 * 60),
    });
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
    const result = await resetPassword("validtoken", "goodpassword");
    expect(result.ok).toBe(true);
    expect(mockHash).toHaveBeenCalledWith("goodpassword", 10);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
