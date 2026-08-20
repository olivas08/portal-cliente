import type { InvoiceProviderAdapter, InvoiceDraft, IssuedInvoice } from "@/services/invoicing/types";
import { requireEnv } from "@/services/invoicing/shared";
import { AppError } from "@/lib/errors";

/**
 * InvoiceXpress (https://invoicexpress.com) REST/JSON API.
 *
 * Auth: an `api_key` query-string param, scoped to one account subdomain
 * (`{account}.app.invoicexpress.com`).
 *
 * NOTE: field names below follow InvoiceXpress's publicly documented
 * `POST /invoices.json` payload at the time of writing. Invoicing APIs
 * occasionally add/rename fields (e.g. tax codes, sequence/series ids) —
 * verify against the current docs in your InvoiceXpress account before
 * relying on this in production, and adjust `buildPayload` accordingly.
 */
export function createInvoiceXpressAdapter(): InvoiceProviderAdapter {
  const env = () =>
    requireEnv("InvoiceXpress", {
      INVOICEXPRESS_ACCOUNT_NAME: process.env.INVOICEXPRESS_ACCOUNT_NAME,
      INVOICEXPRESS_API_KEY: process.env.INVOICEXPRESS_API_KEY,
    });

  return {
    provider: "invoicexpress",
    isConfigured: () =>
      Boolean(process.env.INVOICEXPRESS_ACCOUNT_NAME && process.env.INVOICEXPRESS_API_KEY),

    async createInvoice(draft: InvoiceDraft): Promise<IssuedInvoice> {
      const { INVOICEXPRESS_ACCOUNT_NAME, INVOICEXPRESS_API_KEY } = env();
      const baseUrl = `https://${INVOICEXPRESS_ACCOUNT_NAME}.app.invoicexpress.com`;

      const body = {
        invoice: {
          date: formatDatePt(draft.issueDate),
          reference: draft.orderReference,
          client: {
            name: draft.customer.name,
            fiscal_id: draft.customer.taxId ?? undefined,
            address: draft.customer.address ?? undefined,
            postal_code: draft.customer.postalCode ?? undefined,
            city: draft.customer.city ?? undefined,
            country: draft.customer.country,
          },
          items: draft.lines.map((line) => ({
            name: line.description,
            description: `${line.reference}`,
            unit_price: line.unitPriceEur,
            quantity: line.quantity,
            unit: line.unit,
          })),
        },
      };

      const res = await fetch(
        `${baseUrl}/invoices.json?api_key=${encodeURIComponent(INVOICEXPRESS_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new AppError(`InvoiceXpress recusou o pedido (${res.status}): ${text.slice(0, 300)}`);
      }

      const json = (await res.json()) as {
        invoice?: { id: number; sequence_number?: string; permalink?: string };
      };
      const invoice = json.invoice;
      if (!invoice) {
        throw new AppError("InvoiceXpress não devolveu a fatura criada.");
      }

      return {
        externalId: String(invoice.id),
        number: invoice.sequence_number ?? null,
        pdfUrl:
          invoice.permalink ??
          `${baseUrl}/invoices/${invoice.id}.pdf?api_key=${encodeURIComponent(INVOICEXPRESS_API_KEY)}`,
      };
    },
  };
}

function formatDatePt(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}
