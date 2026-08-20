import type { InvoiceProvider } from "@/lib/types";

/**
 * Provider-agnostic shape for "please issue this invoice". Every adapter
 * (InvoiceXpress, Moloni, Vendus, Primavera, ...) receives the same draft and
 * is responsible for translating it into its own API's request shape.
 */
export interface InvoiceDraftLine {
  reference: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceEur: number;
}

export interface InvoiceDraftCustomer {
  name: string;
  /** Portuguese NIF (or foreign VAT number). Most providers require this to
   *  issue a real fiscal invoice to a business customer. */
  taxId: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
}

export interface InvoiceDraft {
  /** Internal order id — not sent to the provider, useful for logging. */
  orderId: string;
  /** Human-readable order reference, used as the invoice's own reference/note. */
  orderReference: string;
  issueDate: Date;
  customer: InvoiceDraftCustomer;
  lines: InvoiceDraftLine[];
}

/** What we persist locally once a provider confirms the invoice was issued. */
export interface IssuedInvoice {
  externalId: string;
  /** The official, sequential invoice number the provider assigned (e.g. "FT 2026/123"). */
  number: string | null;
  pdfUrl: string | null;
}

/**
 * One adapter per real invoicing platform. `createInvoice` must throw an
 * `AppError` (see src/lib/errors.ts) with a clear, user-facing message when
 * credentials are missing/invalid or the platform rejects the request — the
 * caller (src/services/invoices.service.ts) persists that message onto the
 * `Invoice` record's `errorMessage` instead of leaving the admin guessing.
 */
export interface InvoiceProviderAdapter {
  readonly provider: InvoiceProvider;
  /** True once the required env vars for this provider are present. Lets the
   *  UI/service fail fast with a friendly message instead of a raw API error. */
  isConfigured(): boolean;
  createInvoice(draft: InvoiceDraft): Promise<IssuedInvoice>;
}
