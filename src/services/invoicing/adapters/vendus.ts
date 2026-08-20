import type { InvoiceProviderAdapter, InvoiceDraft, IssuedInvoice } from "@/services/invoicing/types";
import { requireEnv } from "@/services/invoicing/shared";
import { AppError } from "@/lib/errors";

const API_BASE = "https://www.vendus.pt/ws/v1.1";

/**
 * Vendus (https://www.vendus.pt) REST API.
 *
 * Auth: HTTP Basic, with the API key as the username and an empty password.
 * `mode: "final"` actually issues the fiscal document (vs. a draft) —
 * this is the one field most likely to trip someone up when testing.
 *
 * NOTE: payload/response field names follow Vendus's publicly documented
 * `POST /documents/` endpoint at the time of writing; re-check against the
 * current docs (tax codes, document type "FT" vs "FR", etc.) before going
 * live, since fiscal-software APIs are updated periodically.
 */
export function createVendusAdapter(): InvoiceProviderAdapter {
  const env = () =>
    requireEnv("Vendus", { VENDUS_API_KEY: process.env.VENDUS_API_KEY });

  return {
    provider: "vendus",
    isConfigured: () => Boolean(process.env.VENDUS_API_KEY),

    async createInvoice(draft: InvoiceDraft): Promise<IssuedInvoice> {
      const { VENDUS_API_KEY } = env();
      const authHeader = `Basic ${Buffer.from(`${VENDUS_API_KEY}:`).toString("base64")}`;

      const body = {
        type: "FT", // Fatura
        mode: "final", // issue for real, not a draft
        date: draft.issueDate.toISOString().slice(0, 10),
        client: {
          name: draft.customer.name,
          fiscal_id: draft.customer.taxId ?? "999999990", // Vendus's "consumidor final" fallback NIF
          address: draft.customer.address ?? undefined,
          city: draft.customer.city ?? undefined,
          postalcode: draft.customer.postalCode ?? undefined,
          country: draft.customer.country,
        },
        items: draft.lines.map((line) => ({
          title: line.description,
          reference: line.reference,
          qty: line.quantity,
          gross_price: line.unitPriceEur,
          unit: line.unit,
        })),
      };

      const res = await fetch(`${API_BASE}/documents/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new AppError(`Vendus recusou o pedido (${res.status}): ${text.slice(0, 300)}`);
      }

      const json = (await res.json()) as {
        id?: number;
        number?: string;
        output?: { pdf?: string };
      };
      if (!json.id) {
        throw new AppError("Vendus não devolveu o documento criado.");
      }

      return {
        externalId: String(json.id),
        number: json.number ?? null,
        pdfUrl: json.output?.pdf ?? `${API_BASE}/documents/${json.id}.pdf`,
      };
    },
  };
}
