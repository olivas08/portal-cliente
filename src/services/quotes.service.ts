import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { NotFoundError, AppError } from "@/lib/errors";
import { assertCompanyAccess, type SessionUser } from "@/lib/auth-guard";
import { createWithReference } from "@/services/reference.service";
import { notifyAdmins, notifyCompanyClients } from "@/services/notifications.service";
import type { PricingSettings, Quote, QuoteLine } from "@prisma/client";

// ── Schemas ─────────────────────────────────────────────────────────────────

export const pricingSettingsSchema = z.object({
  steelPriceEurKg: z.number().nonnegative("Não pode ser negativo."),
  laserEurPerMinute: z.number().nonnegative("Não pode ser negativo."),
  bendEurPerBend: z.number().nonnegative("Não pode ser negativo."),
  weldingEurPerMinute: z.number().nonnegative("Não pode ser negativo."),
  finishingEurPerM2: z.number().nonnegative("Não pode ser negativo."),
  defaultMarginPercent: z.number().min(0).max(500, "Margem inválida."),
});
export type PricingSettingsInput = z.infer<typeof pricingSettingsSchema>;

const quoteLineSchema = z.object({
  description: z.string().trim().min(1, "Descrição obrigatória.").max(200),
  operation: z.enum(["corte_laser", "quinagem", "soldadura", "acabamento", "outro"]),
  quantity: z.coerce.number().positive("Quantidade deve ser maior que zero."),
  unit: z.string().trim().min(1, "Unidade obrigatória.").max(20).default("un"),
  materialWeightKg: z.coerce.number().min(0).default(0),
  laserMinutes: z.coerce.number().min(0).default(0),
  bendCount: z.coerce.number().min(0).default(0),
  weldingMinutes: z.coerce.number().min(0).default(0),
  finishingM2: z.coerce.number().min(0).default(0),
});
export type QuoteLineInput = z.infer<typeof quoteLineSchema>;

export const quoteSchema = z.object({
  companyId: z.string().trim().min(1, "Cliente obrigatório."),
  subject: z.string().trim().min(1, "Assunto obrigatório.").max(160),
  notes: z.string().trim().max(2000).optional(),
  marginPercent: z.coerce.number().min(0).max(500, "Margem inválida."),
  validUntil: z.string().trim().optional(),
  lines: z.array(quoteLineSchema).min(1, "Adicione pelo menos uma linha."),
});
export type QuoteInput = z.infer<typeof quoteSchema>;

// ── Pricing ──────────────────────────────────────────────────────────────────

const DEFAULT_PRICING = {
  id: "default",
  steelPriceEurKg: 4.5,
  laserEurPerMinute: 0.9,
  bendEurPerBend: 1.5,
  weldingEurPerMinute: 1.2,
  finishingEurPerM2: 8,
  defaultMarginPercent: 25,
};

/** Reads the single global pricing row, creating it with sane defaults the
 * first time it's requested (no seed dependency). */
export async function getPricingSettings(): Promise<PricingSettings> {
  const existing = await prisma.pricingSettings.findUnique({ where: { id: "default" } });
  if (existing) return existing;
  return prisma.pricingSettings.upsert({
    where: { id: "default" },
    create: DEFAULT_PRICING,
    update: {},
  });
}

export async function updatePricingSettings(data: PricingSettingsInput): Promise<void> {
  await prisma.pricingSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });
}

/**
 * Costs a single line from the shop-floor cost drivers (material weight +
 * per-operation time) and the global rates — no margin applied yet, that's
 * layered on the whole quote total in `computeQuoteTotal`.
 */
function computeLineUnitCost(pricing: PricingSettings, line: QuoteLineInput): number {
  return (
    line.materialWeightKg * pricing.steelPriceEurKg +
    line.laserMinutes * pricing.laserEurPerMinute +
    line.bendCount * pricing.bendEurPerBend +
    line.weldingMinutes * pricing.weldingEurPerMinute +
    line.finishingM2 * pricing.finishingEurPerM2
  );
}

interface PricedLine extends QuoteLineInput {
  unitCostEur: number;
  lineTotalEur: number;
}

function priceLines(pricing: PricingSettings, marginPercent: number, lines: QuoteLineInput[]): {
  priced: PricedLine[];
  totalEur: number;
} {
  const marginMultiplier = 1 + marginPercent / 100;
  let totalEur = 0;
  const priced = lines.map((line) => {
    const unitCostEur = computeLineUnitCost(pricing, line);
    const lineTotalEur = unitCostEur * line.quantity * marginMultiplier;
    totalEur += lineTotalEur;
    return { ...line, unitCostEur, lineTotalEur };
  });
  return { priced, totalEur: Math.round(totalEur * 100) / 100 };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

async function requireDraftQuote(id: string): Promise<Quote & { lines: QuoteLine[] }> {
  const quote = await prisma.quote.findUnique({ where: { id }, include: { lines: true } });
  if (!quote) throw new NotFoundError("Orçamento não encontrado.");
  if (quote.status !== "draft") {
    throw new AppError("Só é possível editar orçamentos em rascunho.");
  }
  return quote;
}

// ── Admin: create / edit / send ─────────────────────────────────────────────

export async function createQuote(data: QuoteInput): Promise<string> {
  const company = await prisma.company.findUnique({ where: { id: data.companyId } });
  if (!company) throw new NotFoundError("Cliente não encontrado.");

  const pricing = await getPricingSettings();
  const { priced, totalEur } = priceLines(pricing, data.marginPercent, data.lines);

  const quote = await createWithReference("ORC", (reference) =>
    prisma.quote.create({
      data: {
        reference,
        companyId: data.companyId,
        subject: data.subject,
        notes: data.notes?.trim() ? data.notes.trim() : null,
        marginPercent: data.marginPercent,
        totalEur,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        lines: {
          create: priced.map((l, i) => ({
            sequence: i + 1,
            description: l.description,
            operation: l.operation,
            quantity: l.quantity,
            unit: l.unit,
            materialWeightKg: l.materialWeightKg,
            laserMinutes: l.laserMinutes,
            bendCount: l.bendCount,
            weldingMinutes: l.weldingMinutes,
            finishingM2: l.finishingM2,
            unitCostEur: l.unitCostEur,
            lineTotalEur: l.lineTotalEur,
          })),
        },
      },
    }),
  );

  return quote.id;
}

export async function updateQuote(id: string, data: QuoteInput): Promise<void> {
  await requireDraftQuote(id);
  if (data.companyId) {
    const company = await prisma.company.findUnique({ where: { id: data.companyId } });
    if (!company) throw new NotFoundError("Cliente não encontrado.");
  }

  const pricing = await getPricingSettings();
  const { priced, totalEur } = priceLines(pricing, data.marginPercent, data.lines);

  try {
    await prisma.$transaction([
      prisma.quote.update({
        where: { id },
        data: {
          companyId: data.companyId,
          subject: data.subject,
          notes: data.notes?.trim() ? data.notes.trim() : null,
          marginPercent: data.marginPercent,
          totalEur,
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
        },
      }),
      prisma.quoteLine.deleteMany({ where: { quoteId: id } }),
      prisma.quoteLine.createMany({
        data: priced.map((l, i) => ({
          quoteId: id,
          sequence: i + 1,
          description: l.description,
          operation: l.operation,
          quantity: l.quantity,
          unit: l.unit,
          materialWeightKg: l.materialWeightKg,
          laserMinutes: l.laserMinutes,
          bendCount: l.bendCount,
          weldingMinutes: l.weldingMinutes,
          finishingM2: l.finishingM2,
          unitCostEur: l.unitCostEur,
          lineTotalEur: l.lineTotalEur,
        })),
      }),
    ]);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("Referência de orçamento em conflito.");
    throw err;
  }
}

export async function deleteQuote(id: string): Promise<void> {
  await requireDraftQuote(id);
  await prisma.quote.delete({ where: { id } });
}

/** Marks a draft quote as sent, making it visible to the client, and notifies them. */
export async function sendQuote(id: string): Promise<void> {
  const quote = await requireDraftQuote(id);

  await prisma.quote.update({
    where: { id },
    data: { status: "sent", sentAt: new Date() },
  });

  await notifyCompanyClients(quote.companyId, {
    type: "QUOTE_SENT",
    title: `Novo orçamento ${quote.reference}`,
    body: `Recebeu um novo orçamento: ${quote.subject}.`,
    href: `/dashboard/orcamentos/${quote.id}`,
  });
}

// ── Client: accept / reject ─────────────────────────────────────────────────

/**
 * The client's decision on a sent quote. Accepting immediately creates an
 * `Order` from the quote's lines (each `QuoteLine` maps directly to an
 * `OrderItem` — no `Product` catalog entry needed, since `OrderItem` stores
 * its own reference/description/price), closing the loop from custom quote
 * straight into production without the admin re-typing anything.
 */
export async function decideQuote(
  actor: SessionUser,
  id: string,
  decision: "accepted" | "rejected",
): Promise<string | null> {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { lines: true, company: true },
  });
  if (!quote) throw new NotFoundError("Orçamento não encontrado.");
  assertCompanyAccess(actor, quote.companyId);
  if (quote.status !== "sent") {
    throw new AppError("Este orçamento já não está disponível para decisão.");
  }

  let orderId: string | null = null;

  if (decision === "accepted") {
    const expectedDate = quote.validUntil ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const order = await createWithReference("ENC", (reference) =>
      prisma.order.create({
        data: {
          reference,
          companyId: quote.companyId,
          status: "pending",
          priority: "normal",
          createdDate: new Date(),
          expectedDate,
          observations: `Gerada a partir do orçamento ${quote.reference}.`,
          items: {
            create: quote.lines
              .sort((a, b) => a.sequence - b.sequence)
              .map((l) => ({
                reference: `${quote.reference}-${String(l.sequence).padStart(2, "0")}`,
                description: l.description,
                quantity: l.quantity,
                unit: l.unit,
                unitPriceEur: Math.round((l.lineTotalEur / l.quantity) * 100) / 100,
              })),
          },
        },
      }),
    );
    orderId = order.id;
  }

  await prisma.quote.update({
    where: { id },
    data: {
      status: decision,
      decidedAt: new Date(),
      orderId,
    },
  });

  await notifyAdmins({
    type: "QUOTE_DECISION",
    title: `Orçamento ${quote.reference} ${decision === "accepted" ? "aceite" : "recusado"}`,
    body: `${quote.company.name} ${decision === "accepted" ? "aceitou" : "recusou"} o orçamento "${quote.subject}".`,
    href: `/admin/orcamentos/${quote.id}`,
  });

  return orderId;
}
