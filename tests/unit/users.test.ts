import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock, mockHash, mockSendInvite, mockGetBaseUrl, mockCreateResetToken } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
    company: { findUnique: vi.fn(), create: vi.fn() },
  },
  mockHash: vi.fn(),
  mockSendInvite: vi.fn(),
  mockGetBaseUrl: vi.fn(),
  mockCreateResetToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email", () => ({ sendInviteEmail: mockSendInvite }));
vi.mock("@/lib/url", () => ({ getBaseUrl: mockGetBaseUrl }));
vi.mock("@/lib/reset-token", () => ({ createResetToken: mockCreateResetToken }));
vi.mock("bcryptjs", () => ({ default: { hash: mockHash } }));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import { inviteUser, onboardClientCompany, setUserActive } from "@/services/users.service";

beforeEach(() => {
  vi.clearAllMocks();
  mockHash.mockResolvedValue("placeholder-hash");
  mockGetBaseUrl.mockResolvedValue("https://portal.example.com");
  mockCreateResetToken.mockResolvedValue("raw-token");
  prismaMock.user.findUnique.mockResolvedValue(null);
  prismaMock.company.findUnique.mockResolvedValue({ id: "c1" });
});

describe("inviteUser", () => {
  it("rejects an email that already has an account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u-existing" });
    await expect(
      inviteUser({
        name: "Maria",
        email: "maria@empresa.pt",
        role: "CLIENT_USER",
        companyId: "c1",
        inviterName: "Admin",
      }),
    ).rejects.toThrow("Já existe uma conta com este email.");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("creates an inactive user with a random placeholder password and emails an invite", async () => {
    prismaMock.user.create.mockResolvedValue({
      id: "u-new",
      name: "Maria",
      email: "maria@empresa.pt",
      role: "CLIENT_USER",
      active: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await inviteUser({
      name: "Maria",
      email: "MARIA@Empresa.PT",
      role: "CLIENT_USER",
      companyId: "c1",
      inviterName: "Admin da Empresa",
    });

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        name: "Maria",
        email: "maria@empresa.pt",
        passwordHash: "placeholder-hash",
        role: "CLIENT_USER",
        companyId: "c1",
        active: false,
      },
    });
    expect(mockCreateResetToken).toHaveBeenCalledWith("u-new");
    expect(mockSendInvite).toHaveBeenCalledWith("maria@empresa.pt", {
      name: "Maria",
      roleLabel: "Utilizador da empresa",
      setupUrl: "https://portal.example.com/reset-password?token=raw-token",
      inviterName: "Admin da Empresa",
    });
    expect(result.active).toBe(false);
  });
});

describe("onboardClientCompany", () => {
  it("rejects an email that already has an account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u-existing" });
    await expect(
      onboardClientCompany({
        companyName: "Silva Lda.",
        contactName: "Ana Silva",
        email: "ana@silva.pt",
        inviterName: "Admin",
      }),
    ).rejects.toThrow("Já existe uma conta com este email.");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("creates the company and an inactive CLIENT, then emails the invite", async () => {
    const createdUser = {
      id: "u-new",
      name: "Ana Silva",
      email: "ana@silva.pt",
      role: "CLIENT" as const,
      active: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        company: {
          create: vi.fn().mockResolvedValue({ id: "c-new", name: "Silva Lda." }),
        },
        user: { create: vi.fn().mockResolvedValue(createdUser) },
      }),
    );

    const result = await onboardClientCompany({
      companyName: "Silva Lda.",
      contactName: "Ana Silva",
      email: "ANA@Silva.PT",
      inviterName: "Administração",
    });

    expect(result.companyId).toBe("c-new");
    expect(result.user.role).toBe("CLIENT");
    expect(result.user.active).toBe(false);
    expect(mockSendInvite).toHaveBeenCalledWith("ana@silva.pt", {
      name: "Ana Silva",
      roleLabel: "Administrador da empresa",
      setupUrl: "https://portal.example.com/reset-password?token=raw-token",
      inviterName: "Administração",
    });
  });
});

describe("setUserActive", () => {
  it("throws when the user doesn't exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(setUserActive("missing", true, { companyId: null })).rejects.toThrow(
      "Utilizador não encontrado.",
    );
  });

  it("throws when the target user is outside the given scope", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", companyId: "other-company" });
    await expect(setUserActive("u1", true, { companyId: "c1" })).rejects.toThrow(
      "Utilizador não pertence a este âmbito.",
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("allows factory-side management only over factory accounts (companyId null)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", companyId: null });
    await setUserActive("u1", false, { companyId: null });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { active: false },
    });
  });

  it("allows a company admin to toggle a user within the same company", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u2", companyId: "c1" });
    await setUserActive("u2", true, { companyId: "c1" });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: { active: true },
    });
  });
});
