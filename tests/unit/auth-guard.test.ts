import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockAuth, mockRedirect } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

import {
  requireUser,
  requireSessionUser,
  requireAdmin,
  requireAdminArea,
  requireClient,
  requireCompanyAdmin,
  assertCompanyAccess,
} from "@/lib/auth-guard";
import { UnauthorizedError } from "@/lib/errors";

beforeEach(() => vi.clearAllMocks());

describe("requireUser", () => {
  it("throws when there is no session", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("returns the session user", async () => {
    const user = { id: "u1", role: "CLIENT", companyId: "c1" };
    mockAuth.mockResolvedValue({ user });
    await expect(requireUser()).resolves.toEqual(user);
  });
});

describe("requireSessionUser", () => {
  it("redirects to login when there is no session", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireSessionUser()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("returns the session user", async () => {
    const user = { id: "u1", role: "CLIENT", companyId: "c1" };
    mockAuth.mockResolvedValue({ user });
    await expect(requireSessionUser()).resolves.toEqual(user);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe("requireAdmin / requireAdminArea", () => {
  it("rejects a client from admin surfaces", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "CLIENT", companyId: "c1" },
    });
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("lets a production manager into producao but not armazem", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "PRODUCTION_MANAGER" },
    });
    await expect(requireAdminArea("producao")).resolves.toMatchObject({
      role: "PRODUCTION_MANAGER",
    });
    await expect(requireAdminArea("armazem")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("lets a super-admin into every area", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(requireAdminArea("armazem")).resolves.toMatchObject({
      role: "ADMIN",
    });
  });
});

describe("requireClient / requireCompanyAdmin", () => {
  it("rejects a factory admin from client guards", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(requireClient()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects a CLIENT_USER from company-admin", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "CLIENT_USER", companyId: "c1" },
    });
    await expect(requireCompanyAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("assertCompanyAccess", () => {
  it("allows an admin for any company", () => {
    expect(() =>
      assertCompanyAccess({ id: "a", role: "ADMIN" } as never, "c1"),
    ).not.toThrow();
  });

  it("rejects a client of a different company", () => {
    expect(() =>
      assertCompanyAccess(
        { id: "u", role: "CLIENT", companyId: "c1" } as never,
        "c2",
      ),
    ).toThrow(UnauthorizedError);
  });
});
