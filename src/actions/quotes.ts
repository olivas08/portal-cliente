"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireClient } from "@/lib/auth-guard";
import { guardAction } from "@/lib/errors";
import {
  createQuote as createQuoteService,
  updateQuote as updateQuoteService,
  deleteQuote as deleteQuoteService,
  sendQuote as sendQuoteService,
  decideQuote as decideQuoteService,
  updatePricingSettings as updatePricingSettingsService,
  quoteSchema,
  pricingSettingsSchema,
  type QuoteInput,
  type PricingSettingsInput,
} from "@/services/quotes.service";

const ADMIN_QUOTES = "/admin/orcamentos";
const CLIENT_QUOTES = "/dashboard/orcamentos";

export async function createQuote(input: QuoteInput) {
  return guardAction(async () => {
    await requireAdmin();
    const data = quoteSchema.parse(input);
    const id = await createQuoteService(data);
    revalidatePath(ADMIN_QUOTES);
    return id;
  });
}

export async function updateQuote(id: string, input: QuoteInput) {
  return guardAction(async () => {
    await requireAdmin();
    const data = quoteSchema.parse(input);
    await updateQuoteService(id, data);
    revalidatePath(ADMIN_QUOTES);
    revalidatePath(`${ADMIN_QUOTES}/${id}`);
  });
}

export async function deleteQuote(id: string) {
  return guardAction(async () => {
    await requireAdmin();
    await deleteQuoteService(id);
    revalidatePath(ADMIN_QUOTES);
  });
}

export async function sendQuote(id: string) {
  return guardAction(async () => {
    await requireAdmin();
    await sendQuoteService(id);
    revalidatePath(ADMIN_QUOTES);
    revalidatePath(`${ADMIN_QUOTES}/${id}`);
  });
}

export async function updatePricingSettings(input: PricingSettingsInput) {
  return guardAction(async () => {
    await requireAdmin();
    const data = pricingSettingsSchema.parse(input);
    await updatePricingSettingsService(data);
    revalidatePath(`${ADMIN_QUOTES}/definicoes`);
  });
}

export async function decideQuote(id: string, decision: "accepted" | "rejected") {
  return guardAction(async () => {
    const actor = await requireClient();
    const orderId = await decideQuoteService(actor, id, decision);
    revalidatePath(CLIENT_QUOTES);
    revalidatePath(`${CLIENT_QUOTES}/${id}`);
    revalidatePath(ADMIN_QUOTES);
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return orderId;
  });
}
