import type { Session } from "next-auth";
import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";

export type SessionUser = NonNullable<Session["user"]>;
export type ClientUser = SessionUser & { companyId: string };

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

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new UnauthorizedError();
  return user;
}

export async function requireClient(): Promise<ClientUser> {
  const user = await requireUser();
  if (user.role !== "CLIENT" || !user.companyId) throw new UnauthorizedError();
  return user as ClientUser;
}

/**
 * Pure company-scope assertion (no session lookup) so services can enforce
 * multi-tenant isolation against an already-authenticated actor. Admins are
 * never company-scoped.
 */
export function assertCompanyAccess(user: SessionUser, companyId: string): void {
  if (user.role !== "ADMIN" && user.companyId !== companyId) {
    throw new UnauthorizedError();
  }
}
