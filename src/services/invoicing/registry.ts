import type { InvoiceProviderAdapter } from "@/services/invoicing/types";
import { createInvoiceXpressAdapter } from "@/services/invoicing/adapters/invoicexpress";
import { createMoloniAdapter } from "@/services/invoicing/adapters/moloni";
import { createVendusAdapter } from "@/services/invoicing/adapters/vendus";
import { createPrimaveraAdapter } from "@/services/invoicing/adapters/primavera";
import { createSage100Adapter } from "@/services/invoicing/adapters/sage100";
import { AppError } from "@/lib/errors";
import type { InvoiceProvider } from "@/lib/types";

const ADAPTER_FACTORIES: Record<InvoiceProvider, () => InvoiceProviderAdapter> = {
  invoicexpress: createInvoiceXpressAdapter,
  moloni: createMoloniAdapter,
  vendus: createVendusAdapter,
  primavera: createPrimaveraAdapter,
  sage100: createSage100Adapter,
};

/**
 * Which provider is "live" for this deployment. A single env var (not a DB
 * setting) on purpose: it's infrastructure configuration set once per
 * client deployment (this app is single-tenant per factory), not something
 * an admin should be able to flip from the UI mid-operation.
 */
export function getActiveInvoiceProviderName(): InvoiceProvider | null {
  const raw = process.env.INVOICE_PROVIDER?.trim().toLowerCase();
  if (!raw) return null;
  if (raw in ADAPTER_FACTORIES) return raw as InvoiceProvider;
  return null;
}

/** Builds the adapter for a specific provider (used once a provider is known/chosen). */
export function getInvoiceProviderAdapter(provider: InvoiceProvider): InvoiceProviderAdapter {
  return ADAPTER_FACTORIES[provider]();
}

/**
 * Resolves the adapter to actually use for issuing an invoice: the one
 * named by `INVOICE_PROVIDER`, if set and fully configured. Throws a clear,
 * actionable error otherwise instead of silently picking one.
 */
export function getActiveInvoiceProvider(): InvoiceProviderAdapter {
  const name = getActiveInvoiceProviderName();
  if (!name) {
    throw new AppError(
      "Nenhuma plataforma de faturação está configurada. Defina a variável de ambiente INVOICE_PROVIDER (invoicexpress, moloni, vendus, primavera ou sage100) e as respetivas credenciais.",
    );
  }
  const adapter = getInvoiceProviderAdapter(name);
  if (!adapter.isConfigured()) {
    throw new AppError(
      `A plataforma de faturação selecionada (${name}) ainda não tem as credenciais configuradas.`,
    );
  }
  return adapter;
}
