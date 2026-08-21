import type { InvoiceProviderAdapter, InvoiceDraft, IssuedInvoice } from "@/services/invoicing/types";
import { requireEnv } from "@/services/invoicing/shared";
import { AppError } from "@/lib/errors";

/**
 * Sage 100 does NOT expose one universal cloud REST API the way
 * InvoiceXpress/Moloni/Vendus do — like Primavera, it's typically an
 * on-premise ERP (heir to MAS90/MAS200 in some markets), and integrations
 * usually go through a locally-hosted web service exposed by the install's
 * Business Framework / API layer, whose base URL, auth scheme and payload
 * shape are specific to that deployment (version, modules licensed, and
 * whatever the reseller/IT configured).
 *
 * Rather than guess a shape that would silently be wrong for a given
 * factory's Sage 100 setup, this adapter is a thin, generic REST client:
 * point `SAGE100_API_BASE_URL` at whatever endpoint the Sage 100
 * install/reseller exposes for creating a sales invoice, and
 * `SAGE100_API_KEY` at its auth token. The request/response shape below is a
 * reasonable default (mirrors the other adapters) but WILL likely need
 * adjusting to match that specific endpoint's contract — treat this as a
 * starting point, not a drop-in integration. Confirm with whoever manages
 * the Sage 100 install (e.g. Equiproin) exactly which API/webservice they
 * have exposed before wiring real credentials.
 */
export function createSage100Adapter(): InvoiceProviderAdapter {
  const env = () =>
    requireEnv("Sage 100", {
      SAGE100_API_BASE_URL: process.env.SAGE100_API_BASE_URL,
      SAGE100_API_KEY: process.env.SAGE100_API_KEY,
    });

  return {
    provider: "sage100",
    isConfigured: () =>
      Boolean(process.env.SAGE100_API_BASE_URL && process.env.SAGE100_API_KEY),

    async createInvoice(draft: InvoiceDraft): Promise<IssuedInvoice> {
      const { SAGE100_API_BASE_URL, SAGE100_API_KEY } = env();

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

      const res = await fetch(`${SAGE100_API_BASE_URL.replace(/\/$/, "")}/invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SAGE100_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new AppError(
          `Sage 100 recusou o pedido (${res.status}): ${text.slice(0, 300)} — confirme o contrato do endpoint configurado em SAGE100_API_BASE_URL.`,
        );
      }

      const json = (await res.json()) as {
        id?: string;
        number?: string;
        pdfUrl?: string;
      };
      if (!json.id) {
        throw new AppError("Sage 100 não devolveu a fatura criada.");
      }

      return {
        externalId: json.id,
        number: json.number ?? null,
        pdfUrl: json.pdfUrl ?? null,
      };
    },
  };
}
