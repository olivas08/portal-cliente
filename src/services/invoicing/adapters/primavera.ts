import type { InvoiceProviderAdapter, InvoiceDraft, IssuedInvoice } from "@/services/invoicing/types";
import { requireEnv } from "@/services/invoicing/shared";
import { AppError } from "@/lib/errors";

/**
 * Primavera (BSS / Primavera Starter / Elevation, or Primavera Cloud) does
 * NOT expose one universal public REST API the way InvoiceXpress/Moloni/
 * Vendus do — most factories run it on-premise, and invoicing integrations
 * usually go through a Primavera partner-configured "Web Services" module
 * or the newer Primavera API Gateway, whose base URL and payload shape are
 * specific to that install.
 *
 * Rather than guess a shape that would silently be wrong for a given
 * customer's Primavera setup, this adapter is a thin, generic REST client:
 * point `PRIMAVERA_API_BASE_URL` at whatever endpoint your Primavera
 * partner/IT exposes for creating an invoice, and `PRIMAVERA_API_KEY` at its
 * auth token. The request/response shape below is a reasonable default
 * (mirrors the other adapters) but WILL likely need adjusting to match that
 * specific endpoint's contract — treat this as a starting point, not a
 * drop-in integration.
 */
export function createPrimaveraAdapter(): InvoiceProviderAdapter {
  const env = () =>
    requireEnv("Primavera", {
      PRIMAVERA_API_BASE_URL: process.env.PRIMAVERA_API_BASE_URL,
      PRIMAVERA_API_KEY: process.env.PRIMAVERA_API_KEY,
    });

  return {
    provider: "primavera",
    isConfigured: () =>
      Boolean(process.env.PRIMAVERA_API_BASE_URL && process.env.PRIMAVERA_API_KEY),

    async createInvoice(draft: InvoiceDraft): Promise<IssuedInvoice> {
      const { PRIMAVERA_API_BASE_URL, PRIMAVERA_API_KEY } = env();

      const body = {
        reference: draft.orderReference,
        date: draft.issueDate.toISOString().slice(0, 10),
        customer: {
          name: draft.customer.name,
          taxId: draft.customer.taxId,
          address: draft.customer.address,
          postalCode: draft.customer.postalCode,
          city: draft.customer.city,
          country: draft.customer.country,
        },
        lines: draft.lines.map((line) => ({
          reference: line.reference,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unitPriceEur,
        })),
      };

      const res = await fetch(`${PRIMAVERA_API_BASE_URL.replace(/\/$/, "")}/invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PRIMAVERA_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new AppError(
          `Primavera recusou o pedido (${res.status}): ${text.slice(0, 300)} — confirme o contrato do endpoint configurado em PRIMAVERA_API_BASE_URL.`,
        );
      }

      const json = (await res.json()) as {
        id?: string;
        number?: string;
        pdfUrl?: string;
      };
      if (!json.id) {
        throw new AppError("Primavera não devolveu a fatura criada.");
      }

      return {
        externalId: json.id,
        number: json.number ?? null,
        pdfUrl: json.pdfUrl ?? null,
      };
    },
  };
}
