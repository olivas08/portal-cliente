import { AppError } from "@/lib/errors";

/** Thrown by an adapter when its required env vars aren't set yet. */
export class InvoiceProviderNotConfiguredError extends AppError {
  constructor(providerLabel: string, missingVars: string[]) {
    super(
      `${providerLabel} não está configurado. Defina ${missingVars.join(", ")} nas variáveis de ambiente.`,
    );
  }
}

/** Reads required env vars for an adapter, throwing a friendly error listing all missing ones at once. */
export function requireEnv(
  providerLabel: string,
  vars: Record<string, string | undefined>,
): Record<string, string> {
  const missing = Object.entries(vars)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new InvoiceProviderNotConfiguredError(providerLabel, missing);
  }
  return vars as Record<string, string>;
}

/** Total for one invoice line, in euros. */
export function lineTotalEur(line: { quantity: number; unitPriceEur: number }): number {
  return line.quantity * line.unitPriceEur;
}
