/**
 * Central branding config.
 *
 * PRODUCT = the Operon platform — OUR brand. A suite of modules:
 *   Core (backoffice) · Station (terminal) · Link (edge) · Portal (client).
 *
 * TENANT  = the factory running this instance (a client of ours). Every value
 * is overridable via `NEXT_PUBLIC_TENANT_*` env vars so each per-factory deploy
 * can co-brand without touching code (see the "instance per factory" model).
 *
 * Co-branding rule: the Operon product brand is primary; the tenant (factory)
 * name/logo appears as a discreet secondary mark.
 */

export const PRODUCT = {
  name: "Operon",
  modules: {
    core: "Operon Core", // administração / backoffice
    station: "Operon Station", // terminal de chão de fábrica
    link: "Operon Link", // edge gateway (máquinas → cloud)
    portal: "Operon Portal", // portal dos clientes
  },
  logo: "/operon-logo.svg",
  icon: "/operon-icon.svg",
} as const;

const env = (key: string, fallback: string) =>
  process.env[key]?.trim() ? (process.env[key] as string) : fallback;

export const TENANT = {
  name: env("NEXT_PUBLIC_TENANT_NAME", "Jolucor"),
  legalName: env(
    "NEXT_PUBLIC_TENANT_LEGAL_NAME",
    "Jolucor - Fabricação e Manutenção Industrial, Lda.",
  ),
  logo: env("NEXT_PUBLIC_TENANT_LOGO", "/jolucor-logo.png"),
  address: env(
    "NEXT_PUBLIC_TENANT_ADDRESS",
    "Zona Industrial de Vale de Cambra, Lote 12",
  ),
  city: env("NEXT_PUBLIC_TENANT_CITY", "3730-100 Vale de Cambra · Portugal"),
  nif: env("NEXT_PUBLIC_TENANT_NIF", "NIF: PT 500 123 456"),
  contact: env(
    "NEXT_PUBLIC_TENANT_CONTACT",
    "Tel: +351 256 850 200 | geral@jolucor.pt",
  ),
} as const;
