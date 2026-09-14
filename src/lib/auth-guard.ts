import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import {
  type AdminArea,
  type AdminRole,
  isAdminRole,
  roleHasArea,
} from "@/lib/roles";

export type SessionUser = NonNullable<Session["user"]>;
export type ClientUser = SessionUser & { companyId: string };
export type AdminUser = SessionUser & { role: AdminRole };

/**
 * Session-based guards. These are the only place that talks to `auth()`, so
 * every server action shares one authorization contract instead of
 * re-implementing the `session?.user?.role` checks inline.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * Page-level counterpart of `requireUser()`: redirects to login instead of
 * throwing, so layouts/pages can drop `session!.user`.
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

/** Any factory-side account (super-admin or area-scoped manager). */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await requireUser();
  if (!isAdminRole(user.role)) throw new UnauthorizedError();
  return user as AdminUser;
}

/** Super-admin only — full access, user management, cross-cutting settings. */
export async function requireSuperAdmin(): Promise<AdminUser> {
  const user = await requireAdmin();
  if (user.role !== "ADMIN") throw new UnauthorizedError();
  return user;
}

/**
 * Any factory-side account whose role is allowed to act on `area`
 * (super-admin is always allowed, an area-scoped manager only for its own
 * area). Use this instead of requireAdmin() for actions/pages that belong to
 * a specific admin section (Produção, Armazém, Comercial, Qualidade).
 */
export async function requireAdminArea(area: AdminArea): Promise<AdminUser> {
  const user = await requireAdmin();
  if (!roleHasArea(user.role, area)) throw new UnauthorizedError();
  return user;
}

export async function requireClient(): Promise<ClientUser> {
  const user = await requireUser();
  if ((user.role !== "CLIENT" && user.role !== "CLIENT_USER") || !user.companyId) {
    throw new UnauthorizedError();
  }
  return user as ClientUser;
}

/** Client-side company admin only (can invite/manage their company's users). */
export async function requireCompanyAdmin(): Promise<ClientUser> {
  const user = await requireClient();
  if (user.role !== "CLIENT") throw new UnauthorizedError();
  return user;
}

/**
 * Pure company-scope assertion (no session lookup) so services can enforce
 * multi-tenant isolation against an already-authenticated actor. Admins are
 * never company-scoped.
 */
export function assertCompanyAccess(user: SessionUser, companyId: string): void {
  if (!isAdminRole(user.role) && user.companyId !== companyId) {
    throw new UnauthorizedError();
  }
}

