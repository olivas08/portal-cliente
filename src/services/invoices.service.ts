import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, invalidateCache } from "@/lib/cache-tags";
import { NotFoundError, AppError } from "@/lib/errors";
import { getActiveInvoiceProvider } from "@/services/invoicing/registry";
import type { InvoiceDraft } from "@/services/invoicing/types";
import type { InvoiceVM } from "@/lib/types";
import { sendInvoiceIssuedEmail } from "@/lib/email";
import { companyClientEmails } from "@/lib/email-recipients";
import { getBaseUrl } from "@/lib/url";

/**
 * Issues the real fiscal invoice for a delivered order through whichever
 * platform is configured via `INVOICE_PROVIDER` (see
 * src/services/invoicing/registry.ts). Idempotent: re-issuing an order that
 * already has a successfully issued invoice is a no-op (returns the existing
 * one) rather than creating a duplicate fiscal document — but a previously
 * *failed* attempt can be retried, since no real document exists yet in
 * that case.
 */
export async function issueInvoice(orderId: string): Promise<InvoiceVM> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, company: true, invoice: true },
  });
  if (!order) throw new NotFoundError("Encomenda não encontrada.");

  if (order.invoice && order.invoice.status === "issued") {
    return toInvoiceVM(order.invoice);
  }
  if (order.status !== "delivered") {
    throw new AppError("Só é possível faturar encomendas já entregues.");
  }
  if (order.items.length === 0) {
    throw new AppError("Esta encomenda não tem artigos para faturar.");
  }

  const totalEur = order.items.reduce((sum, i) => sum + i.quantity * i.unitPriceEur, 0);
  const adapter = getActiveInvoiceProvider();

  const draft: InvoiceDraft = {
    orderId: order.id,
    orderReference: order.reference,
    issueDate: new Date(),
    customer: {
      name: order.company.name,
      taxId: order.company.taxId,
      address: order.company.billingAddress,
      postalCode: order.company.billingPostalCode,
      city: order.company.billingCity,
      country: order.company.billingCountry ?? "Portugal",
    },
    lines: order.items.map((i) => ({
      reference: i.reference,
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      unitPriceEur: i.unitPriceEur,
    })),
  };

  try {
    const issued = await adapter.createInvoice(draft);
    const record = await prisma.invoice.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        provider: adapter.provider,
        status: "issued",
        externalId: issued.externalId,
        number: issued.number,
        pdfUrl: issued.pdfUrl,
        totalEur,
        issuedAt: new Date(),
      },
      update: {
        provider: adapter.provider,
        status: "issued",
        externalId: issued.externalId,
        number: issued.number,
        pdfUrl: issued.pdfUrl,
        totalEur,
        issuedAt: new Date(),
        errorMessage: null,
      },
    });
    invalidateCache(CACHE_TAGS.invoices);

    try {
      const to = await companyClientEmails(order.companyId);
      if (to.length > 0) {
        const baseUrl = await getBaseUrl();
        await sendInvoiceIssuedEmail(to, {
          orderReference: order.reference,
          invoiceNumber: record.number,
          totalEur: record.totalEur,
          pdfUrl: record.pdfUrl,
          orderUrl: `${baseUrl}/dashboard/ordens/${order.id}`,
        });
      }
    } catch (err) {
      console.error("[invoices] Falha ao notificar cliente por email:", err);
    }

    return toInvoiceVM(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao emitir a fatura.";
    await prisma.invoice.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        provider: adapter.provider,
        status: "failed",
        totalEur,
        errorMessage: message,
      },
      update: {
        provider: adapter.provider,
        status: "failed",
        errorMessage: message,
      },
    });
    invalidateCache(CACHE_TAGS.invoices);
    // Re-throw as an AppError so the action layer's guardAction surfaces the
    // real reason to the admin instead of a generic failure.
    throw err instanceof AppError ? err : new AppError(message);
  }
}

function toInvoiceVM(invoice: {
  id: string;
  orderId: string;
  provider: string;
  status: string;
  number: string | null;
  pdfUrl: string | null;
  totalEur: number;
  issuedAt: Date | null;
  errorMessage: string | null;
}): InvoiceVM {
  return {
    id: invoice.id,
    orderId: invoice.orderId,
    provider: invoice.provider as InvoiceVM["provider"],
    status: invoice.status as InvoiceVM["status"],
    number: invoice.number,
    pdfUrl: invoice.pdfUrl,
    totalEur: invoice.totalEur,
    issuedAt: invoice.issuedAt ? invoice.issuedAt.toISOString() : null,
    errorMessage: invoice.errorMessage,
  };
}
