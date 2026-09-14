import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, invalidateCache } from "@/lib/cache-tags";
import { NotFoundError, AppError } from "@/lib/errors";
import { assertCompanyAccess, type SessionUser } from "@/lib/auth-guard";
import { createWithReference } from "@/services/reference.service";
import { notifyAdmins, notifyCompanyClients } from "@/services/notifications.service";
import { sendQuoteDecisionEmail, sendQuoteSentEmail } from "@/lib/email";
import { adminEmails, companyClientEmails } from "@/lib/email-recipients";
import { getBaseUrl } from "@/lib/url";
import type { PricingSettings, Quote, QuoteLine, OperationType } from "@prisma/client";

// ── Schemas ─────────────────────────────────────────────────────────────────

export const pricingSettingsSchema = z.object({
  steelPriceEurKg: z.number().nonnegative("Não pode ser negativo."),
  defaultMarginPercent: z.number().min(0).max(500, "Margem inválida."),
});
export type PricingSettingsInput = z.infer<typeof pricingSettingsSchema>;

/** An operation type's `key` doubles as a stable machine identifier (kept
 * distinct from its editable display `name`) — lowercase/digits/underscore
 * only, e.g. "jato_agua", so it reads well in exports/logs. */
export const operationTypeSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Chave obrigatória.")
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Use apenas minúsculas, números e _ (ex: jato_agua)."),
  name: z.string().trim().min(1, "Nome obrigatório.").max(60),
  unit: z.string().trim().min(1, "Unidade obrigatória.").max(20),
  ratePerUnitEur: z.coerce.number().nonnegative("Não pode ser negativo."),
  active: z.boolean().default(true),
});
export type OperationTypeInput = z.infer<typeof operationTypeSchema>;

const quoteLineOperationSchema = z.object({
  operationTypeId: z.string().trim().min(1, "Operação obrigatória."),
  quantity: z.coerce.number().min(0).default(0),
});
export type QuoteLineOperationInput = z.infer<typeof quoteLineOperationSchema>;

const quoteLineSchema = z.object({
  description: z.string().trim().min(1, "Descrição obrigatória.").max(200),
  quantity: z.coerce.number().positive("Quantidade deve ser maior que zero."),
  unit: z.string().trim().min(1, "Unidade obrigatória.").max(20).default("un"),
  materialWeightKg: z.coerce.number().min(0).default(0),
  operations: z.array(quoteLineOperationSchema).default([]),
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

// ── Pricing settings ─────────────────────────────────────────────────────────

const DEFAULT_PRICING = {
  id: "default",
  steelPriceEurKg: 4.5,
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
  invalidateCache(CACHE_TAGS.pricingSettings);
}

// ── Operation types ──────────────────────────────────────────────────────────
// Configurable shop-floor processing steps (corte a laser, quinagem, ...),
// each with its own rate per unit (minute, bend, m², ...). Admins manage
// these on /admin/orcamentos/definicoes so new operations can be added as
// the business needs them, without a code change.

export async function getOperationTypes(): Promise<OperationType[]> {
  return prisma.operationType.findMany({ orderBy: [{ sequence: "asc" }, { name: "asc" }] });
}

export async function createOperationType(data: OperationTypeInput): Promise<string> {
  try {
    const agg = await prisma.operationType.aggregate({ _max: { sequence: true } });
    const created = await prisma.operationType.create({
      data: { ...data, sequence: (agg._max.sequence ?? 0) + 1 },
    });
    invalidateCache(CACHE_TAGS.operationTypes);
    return created.id;
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("Já existe uma operação com essa chave.");
    throw err;
  }
}

export async function updateOperationType(id: string, data: OperationTypeInput): Promise<void> {
  const existing = await prisma.operationType.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Tipo de operação não encontrado.");
  try {
    await prisma.operationType.update({ where: { id }, data });
    invalidateCache(CACHE_TAGS.operationTypes);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("Já existe uma operação com essa chave.");
    throw err;
  }
}

/** Hard-deletes an operation type. Safe even if past quotes reference it:
 * `QuoteLineOperation.operationTypeId` is nullable with `onDelete: SetNull`
 * and already carries a frozen `name`/`unit`/`ratePerUnitEur` snapshot, so
 * historical quotes keep displaying correctly. */
export async function deleteOperationType(id: string): Promise<void> {
  const existing = await prisma.operationType.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Tipo de operação não encontrado.");
  await prisma.operationType.delete({ where: { id } });
  invalidateCache(CACHE_TAGS.operationTypes);
}

// ── Quote line pricing ───────────────────────────────────────────────────────

interface PricedLineOperation {
  operationTypeId: string;
  name: string;
  unit: string;
  quantity: number;
  ratePerUnitEur: number;
  costEur: number;
}

interface PricedLine {
  description: string;
  quantity: number;
  unit: string;
  materialWeightKg: number;
  operations: PricedLineOperation[];
  unitCostEur: number;
  lineTotalEur: number;
}

/**
 * Costs every line from the shop-floor cost drivers — material weight ×
 * steel price, plus each selected operation's quantity × its current rate
 * — then applies the quote-level margin to each line's total. Operation
 * rates/names are looked up once and frozen onto the line at save time (see
 * `QuoteLineOperation`), so a sent quote's price never silently drifts if
 * `OperationType` rates change afterwards.
 */
async function priceLines(
  pricing: PricingSettings,
  marginPercent: number,
  lines: QuoteLineInput[],
): Promise<{ priced: PricedLine[]; totalEur: number }> {
  const opIds = [...new Set(lines.flatMap((l) => l.operations.map((o) => o.operationTypeId)))];
  const opTypes = opIds.length
    ? await prisma.operationType.findMany({ where: { id: { in: opIds } } })
    : [];
  const opMap = new Map(opTypes.map((o) => [o.id, o]));

  const marginMultiplier = 1 + marginPercent / 100;
  let totalEur = 0;
  const priced = lines.map((line) => {
    const operations: PricedLineOperation[] = line.operations
      .filter((o) => o.quantity > 0)
      .map((o) => {
        const ot = opMap.get(o.operationTypeId);
        if (!ot) throw new NotFoundError("Tipo de operação não encontrado.");
        return {
          operationTypeId: ot.id,
          name: ot.name,
          unit: ot.unit,
          quantity: o.quantity,
          ratePerUnitEur: ot.ratePerUnitEur,
          costEur: o.quantity * ot.ratePerUnitEur,
        };
      });
    const opsCostEur = operations.reduce((s, o) => s + o.costEur, 0);
    const unitCostEur = line.materialWeightKg * pricing.steelPriceEurKg + opsCostEur;
    const lineTotalEur = unitCostEur * line.quantity * marginMultiplier;
    totalEur += lineTotalEur;
    return {
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      materialWeightKg: line.materialWeightKg,
      operations,
      unitCostEur,
      lineTotalEur,
    };
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
  const { priced, totalEur } = await priceLines(pricing, data.marginPercent, data.lines);

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
            quantity: l.quantity,
            unit: l.unit,
            materialWeightKg: l.materialWeightKg,
            unitCostEur: l.unitCostEur,
            lineTotalEur: l.lineTotalEur,
            operations: {
              create: l.operations.map((o) => ({
                operationTypeId: o.operationTypeId,
                name: o.name,
                unit: o.unit,
                quantity: o.quantity,
                ratePerUnitEur: o.ratePerUnitEur,
                costEur: o.costEur,
              })),
            },
          })),
        },
      },
    }),
  );

  invalidateCache(CACHE_TAGS.quotes);
  return quote.id;
}

export async function updateQuote(id: string, data: QuoteInput): Promise<void> {
  await requireDraftQuote(id);
  if (data.companyId) {
    const company = await prisma.company.findUnique({ where: { id: data.companyId } });
    if (!company) throw new NotFoundError("Cliente não encontrado.");
  }

  const pricing = await getPricingSettings();
  const { priced, totalEur } = await priceLines(pricing, data.marginPercent, data.lines);

  try {
    // A single nested `update` (rather than a manual multi-statement
    // transaction) so Prisma wraps the delete-then-recreate of lines +
    // operations atomically; `deleteMany` here issues a DB-level DELETE that
    // cascades to `QuoteLineOperation` via its FK's `onDelete: Cascade`.
    await prisma.quote.update({
      where: { id },
      data: {
        companyId: data.companyId,
        subject: data.subject,
        notes: data.notes?.trim() ? data.notes.trim() : null,
        marginPercent: data.marginPercent,
        totalEur,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        lines: {
          deleteMany: {},
          create: priced.map((l, i) => ({
            sequence: i + 1,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            materialWeightKg: l.materialWeightKg,
            unitCostEur: l.unitCostEur,
            lineTotalEur: l.lineTotalEur,
            operations: {
              create: l.operations.map((o) => ({
                operationTypeId: o.operationTypeId,
                name: o.name,
                unit: o.unit,
                quantity: o.quantity,
                ratePerUnitEur: o.ratePerUnitEur,
                costEur: o.costEur,
              })),
            },
          })),
        },
      },
    });
    invalidateCache(CACHE_TAGS.quotes);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("Referência de orçamento em conflito.");
    throw err;
  }
  invalidateCache(CACHE_TAGS.quotes);
}

export async function deleteQuote(id: string): Promise<void> {
  await requireDraftQuote(id);
  await prisma.quote.delete({ where: { id } });
  invalidateCache(CACHE_TAGS.quotes);
}

/** Marks a draft quote as sent, making it visible to the client, and notifies them. */
export async function sendQuote(id: string): Promise<void> {
  const quote = await requireDraftQuote(id);

  await prisma.quote.update({
    where: { id },
    data: { status: "sent", sentAt: new Date() },
  });
  invalidateCache(CACHE_TAGS.quotes);

  await notifyCompanyClients(quote.companyId, {
    type: "QUOTE_SENT",
    title: `Novo orçamento ${quote.reference}`,
    body: `Recebeu um novo orçamento: ${quote.subject}.`,
    href: `/dashboard/orcamentos/${quote.id}`,
  });

  try {
    const to = await companyClientEmails(quote.companyId);
    if (to.length > 0) {
      const baseUrl = await getBaseUrl();
      await sendQuoteSentEmail(to, {
        reference: quote.reference,
        subject: quote.subject,
        totalEur: quote.totalEur,
        quoteUrl: `${baseUrl}/dashboard/orcamentos/${quote.id}`,
      });
    }
  } catch (err) {
    console.error("[quotes] Falha ao notificar cliente por email:", err);
  }
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
  invalidateCache(CACHE_TAGS.quotes);
  if (orderId) invalidateCache(CACHE_TAGS.orders);

  await notifyAdmins({
    type: "QUOTE_DECISION",
    title: `Orçamento ${quote.reference} ${decision === "accepted" ? "aceite" : "recusado"}`,
    body: `${quote.company.name} ${decision === "accepted" ? "aceitou" : "recusou"} o orçamento "${quote.subject}".`,
    href: `/admin/orcamentos/${quote.id}`,
  });

  try {
    const to = await adminEmails();
    if (to.length > 0) {
      const baseUrl = await getBaseUrl();
      await sendQuoteDecisionEmail(to, {
        reference: quote.reference,
        subject: quote.subject,
        companyName: quote.company.name,
        decision,
        quoteUrl: `${baseUrl}/admin/orcamentos/${quote.id}`,
      });
    }
  } catch (err) {
    console.error("[quotes] Falha ao notificar administradores por email:", err);
  }

  return orderId;
}
