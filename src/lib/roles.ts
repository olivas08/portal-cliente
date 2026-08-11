import type { Role } from "@prisma/client";

// Re-exported so callers don't need to know whether the canonical source is
// Prisma or somewhere else.
export type { Role };

/** Factory-side (non-client) roles. */
export const ADMIN_ROLES = [
  "ADMIN",
  "PRODUCTION_MANAGER",
  "WAREHOUSE_MANAGER",
  "SALES_MANAGER",
  "QUALITY_MANAGER",
] as const satisfies readonly Role[];
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Client-side (company) roles. */
export const CLIENT_ROLES = ["CLIENT", "CLIENT_USER"] as const satisfies readonly Role[];
export type ClientRole = (typeof CLIENT_ROLES)[number];

export function isAdminRole(role: Role): role is AdminRole {
  return (ADMIN_ROLES as readonly Role[]).includes(role);
}

export function isClientRole(role: Role): role is ClientRole {
  return (CLIENT_ROLES as readonly Role[]).includes(role);
}

/**
 * Factory-side areas. Each admin sub-section of the app belongs to exactly
 * one area; a scoped role (everything except ADMIN) can only act within its
 * own area. ADMIN bypasses this map entirely (full access).
 */
export const ADMIN_AREAS = ["producao", "armazem", "comercial", "qualidade"] as const;
export type AdminArea = (typeof ADMIN_AREAS)[number];

export const ROLE_AREAS: Record<AdminRole, AdminArea | "*"> = {
  ADMIN: "*",
  PRODUCTION_MANAGER: "producao",
  WAREHOUSE_MANAGER: "armazem",
  SALES_MANAGER: "comercial",
  QUALITY_MANAGER: "qualidade",
};

export const AREA_LABELS: Record<AdminArea, string> = {
  producao: "Produção",
  armazem: "Armazém",
  comercial: "Comercial / Orçamentos",
  qualidade: "Qualidade",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador (acesso total)",
  PRODUCTION_MANAGER: "Produção",
  WAREHOUSE_MANAGER: "Armazém",
  SALES_MANAGER: "Comercial / Orçamentos",
  QUALITY_MANAGER: "Qualidade",
  CLIENT: "Administrador da empresa",
  CLIENT_USER: "Utilizador da empresa",
};

export function roleHasArea(role: AdminRole, area: AdminArea): boolean {
  const assigned = ROLE_AREAS[role];
  return assigned === "*" || assigned === area;
}

/** Where each admin-side role should land after login / when hitting a
 * section it doesn't have access to. */
export const ROLE_DEFAULT_PATH: Record<AdminRole, string> = {
  ADMIN: "/admin",
  PRODUCTION_MANAGER: "/admin",
  WAREHOUSE_MANAGER: "/admin/armazem",
  SALES_MANAGER: "/admin/orcamentos",
  QUALITY_MANAGER: "/admin/producao/qualidade",
};

/**
 * Nav links and page/layout guards each tag themselves with one of these
 * areas explicitly (rather than deriving it from the pathname), because
 * "/admin/producao/qualidade" is a more specific sub-area of "/admin/producao"
 * — a plain longest-prefix match would be ambiguous. `/admin/kpis` has no
 * owning area; every admin-side role may view it.
 */
