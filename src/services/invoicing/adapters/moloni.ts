import type { InvoiceProviderAdapter, InvoiceDraft, IssuedInvoice } from "@/services/invoicing/types";
import { requireEnv } from "@/services/invoicing/shared";
import { AppError } from "@/lib/errors";

const AUTH_URL = "https://api.moloni.pt/v1/grant/";
const API_BASE = "https://api.moloni.pt/v1";

// In-memory token cache — good enough across requests within one warm
// server instance; a cold start just re-authenticates. If this ever needs
// to survive restarts (e.g. to respect a strict rate limit on the grant
// endpoint), persist { accessToken, expiresAt } somewhere durable instead.
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

/**
 * Moloni (https://moloni.pt) REST API.
 *
 * Auth is OAuth2 "password" grant: client_id + client_secret (from your
 * Moloni developer app) plus the account's own username/password, exchanged
 * for an access token. Creating an invoice additionally requires a
 * `company_id` (the Moloni company/tenant) and, per Moloni's data model, a
 * registered customer + document set — this adapter resolves/creates the
 * customer by tax id on the fly, but the document set is taken from an env
 * var since it's account-specific configuration, not derivable from an order.
 *
 * NOTE: exact field names for `invoices/insert` (e.g. tax ids, document set
 * id) vary per Moloni account setup — verify against your account's Moloni
 * API explorer before relying on this in production.
 */
export function createMoloniAdapter(): InvoiceProviderAdapter {
  const requiredEnv = () =>
    requireEnv("Moloni", {
      MOLONI_CLIENT_ID: process.env.MOLONI_CLIENT_ID,
      MOLONI_CLIENT_SECRET: process.env.MOLONI_CLIENT_SECRET,
      MOLONI_USERNAME: process.env.MOLONI_USERNAME,
      MOLONI_PASSWORD: process.env.MOLONI_PASSWORD,
      MOLONI_COMPANY_ID: process.env.MOLONI_COMPANY_ID,
      MOLONI_DOCUMENT_SET_ID: process.env.MOLONI_DOCUMENT_SET_ID,
    });

  async function getAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
      return cachedToken.accessToken;
    }
    const { MOLONI_CLIENT_ID, MOLONI_CLIENT_SECRET, MOLONI_USERNAME, MOLONI_PASSWORD } =
      requiredEnv();

    const params = new URLSearchParams({
      grant_type: "password",
      client_id: MOLONI_CLIENT_ID,
      client_secret: MOLONI_CLIENT_SECRET,
      username: MOLONI_USERNAME,
      password: MOLONI_PASSWORD,
    });
    const res = await fetch(`${AUTH_URL}?${params.toString()}`, { method: "POST" });
    if (!res.ok) {
      throw new AppError(`Moloni recusou a autenticação (${res.status}).`);
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) {
      throw new AppError("Moloni não devolveu um token de acesso.");
    }
    cachedToken = {
      accessToken: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000,
    };
    return cachedToken.accessToken;
  }

  async function resolveCustomerId(
    accessToken: string,
    companyId: string,
    draft: InvoiceDraft,
  ): Promise<number> {
    if (draft.customer.taxId) {
      const lookupRes = await fetch(
        `${API_BASE}/customers/getByVat/?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company_id: Number(companyId), vat: draft.customer.taxId }),
        },
      );
      if (lookupRes.ok) {
        const found = (await lookupRes.json()) as { customer_id?: number };
        if (found.customer_id) return found.customer_id;
      }
    }

    const createRes = await fetch(
      `${API_BASE}/customers/insert/?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: Number(companyId),
          name: draft.customer.name,
          vat: draft.customer.taxId ?? "999999990",
          address: draft.customer.address ?? "",
          city: draft.customer.city ?? "",
          zip_code: draft.customer.postalCode ?? "",
          country_id: 1, // Portugal in Moloni's country table
        }),
      },
    );
    if (!createRes.ok) {
      throw new AppError(`Moloni recusou a criação do cliente (${createRes.status}).`);
    }
    const created = (await createRes.json()) as { customer_id?: number };
    if (!created.customer_id) {
      throw new AppError("Moloni não devolveu o cliente criado.");
    }
    return created.customer_id;
  }

  return {
    provider: "moloni",
    isConfigured: () =>
      Boolean(
        process.env.MOLONI_CLIENT_ID &&
          process.env.MOLONI_CLIENT_SECRET &&
          process.env.MOLONI_USERNAME &&
          process.env.MOLONI_PASSWORD &&
          process.env.MOLONI_COMPANY_ID &&
          process.env.MOLONI_DOCUMENT_SET_ID,
      ),

    async createInvoice(draft: InvoiceDraft): Promise<IssuedInvoice> {
      const { MOLONI_COMPANY_ID, MOLONI_DOCUMENT_SET_ID } = requiredEnv();
      const accessToken = await getAccessToken();
      const customerId = await resolveCustomerId(accessToken, MOLONI_COMPANY_ID, draft);

      const res = await fetch(
        `${API_BASE}/invoices/insert/?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_id: Number(MOLONI_COMPANY_ID),
            document_set_id: Number(MOLONI_DOCUMENT_SET_ID),
            customer_id: customerId,
            date: draft.issueDate.toISOString().slice(0, 10),
            your_reference: draft.orderReference,
            status: 1, // closed/issued, not a draft
            products: draft.lines.map((line) => ({
              name: line.description,
              reference: line.reference,
              qty: line.quantity,
              price: line.unitPriceEur,
            })),
          }),
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new AppError(`Moloni recusou a fatura (${res.status}): ${text.slice(0, 300)}`);
      }

      const json = (await res.json()) as {
        document_id?: number;
        number?: string;
      };
      if (!json.document_id) {
        throw new AppError("Moloni não devolveu a fatura criada.");
      }

      const pdfRes = await fetch(
        `${API_BASE}/invoices/getPDFLink/?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_id: Number(MOLONI_COMPANY_ID),
            document_id: json.document_id,
          }),
        },
      ).catch(() => null);
      const pdfJson = pdfRes && pdfRes.ok ? ((await pdfRes.json()) as { url?: string }) : null;

      return {
        externalId: String(json.document_id),
        number: json.number ?? null,
        pdfUrl: pdfJson?.url ?? null,
      };
    },
  };
}
