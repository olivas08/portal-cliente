import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, invalidateCache } from "@/lib/cache-tags";
import { NotFoundError } from "@/lib/errors";
import type { CompanyFiscalVM } from "@/lib/types";

// ── Schemas ─────────────────────────────────────────────────────────────────

/** Fiscal/billing data a company must have filled in before a real invoice
 * can be issued for one of its orders. NIF validation is intentionally loose
 * (9 digits) since Operon serves only Portuguese factories/clients for now;
 * revisit if a foreign client is ever onboarded. */
export const companyFiscalSchema = z.object({
  taxId: z
    .string()
    .trim()
    .regex(/^\d{9}$/, "NIF deve ter 9 dígitos.")
    .nullable(),
  billingAddress: z.string().trim().max(200).nullable(),
  billingPostalCode: z.string().trim().max(20).nullable(),
  billingCity: z.string().trim().max(100).nullable(),
  billingCountry: z.string().trim().max(100).nullable(),
});
export type CompanyFiscalInput = z.infer<typeof companyFiscalSchema>;

function emptyToNull(value: string | null | undefined): string | null {
  return value && value.trim().length > 0 ? value.trim() : null;
}

/** Updates a company's fiscal/billing data (NIF + billing address), used to
 * populate real invoices issued through the invoicing providers. */
export async function updateCompanyFiscalInfo(
  companyId: string,
  input: CompanyFiscalInput
): Promise<CompanyFiscalVM> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError("Cliente não encontrado.");

  const data = companyFiscalSchema.parse({
    taxId: emptyToNull(input.taxId),
    billingAddress: emptyToNull(input.billingAddress),
    billingPostalCode: emptyToNull(input.billingPostalCode),
    billingCity: emptyToNull(input.billingCity),
    billingCountry: emptyToNull(input.billingCountry) ?? "Portugal",
  });

  const updated = await prisma.company.update({
    where: { id: companyId },
    data,
  });

  invalidateCache(CACHE_TAGS.companies);

  return {
    taxId: updated.taxId,
    billingAddress: updated.billingAddress,
    billingPostalCode: updated.billingPostalCode,
    billingCity: updated.billingCity,
    billingCountry: updated.billingCountry,
  };
}
