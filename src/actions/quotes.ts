"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea, requireClient } from "@/lib/auth-guard";
import { guardAction } from "@/lib/errors";
import {
  createQuote as createQuoteService,
  updateQuote as updateQuoteService,
  deleteQuote as deleteQuoteService,
  sendQuote as sendQuoteService,
  decideQuote as decideQuoteService,
  updatePricingSettings as updatePricingSettingsService,
  createOperationType as createOperationTypeService,
  updateOperationType as updateOperationTypeService,
  deleteOperationType as deleteOperationTypeService,
  quoteSchema,
  pricingSettingsSchema,
  operationTypeSchema,
  type QuoteInput,
  type PricingSettingsInput,
  type OperationTypeInput,
} from "@/services/quotes.service";

const ADMIN_QUOTES = "/admin/orcamentos";
const CLIENT_QUOTES = "/dashboard/orcamentos";

export async function createQuote(input: QuoteInput) {
  return guardAction(async () => {
    await requireAdminArea("comercial");
    const data = quoteSchema.parse(input);
    const id = await createQuoteService(data);
    revalidatePath(ADMIN_QUOTES);
    return id;
  });
}

export async function updateQuote(id: string, input: QuoteInput) {
  return guardAction(async () => {
    await requireAdminArea("comercial");
    const data = quoteSchema.parse(input);
    await updateQuoteService(id, data);
    revalidatePath(ADMIN_QUOTES);
    revalidatePath(`${ADMIN_QUOTES}/${id}`);
  });
}

export async function deleteQuote(id: string) {
  return guardAction(async () => {
    await requireAdminArea("comercial");
    await deleteQuoteService(id);
    revalidatePath(ADMIN_QUOTES);
  });
}

export async function sendQuote(id: string) {
  return guardAction(async () => {
    await requireAdminArea("comercial");
    await sendQuoteService(id);
    revalidatePath(ADMIN_QUOTES);
    revalidatePath(`${ADMIN_QUOTES}/${id}`);
  });
}

export async function updatePricingSettings(input: PricingSettingsInput) {
  return guardAction(async () => {
    await requireAdminArea("comercial");
    const data = pricingSettingsSchema.parse(input);
    await updatePricingSettingsService(data);
    revalidatePath(`${ADMIN_QUOTES}/definicoes`);
  });
}

export async function createOperationType(input: OperationTypeInput) {
  return guardAction(async () => {
    await requireAdminArea("comercial");
    const data = operationTypeSchema.parse(input);
    const id = await createOperationTypeService(data);
    revalidatePath(`${ADMIN_QUOTES}/definicoes`);
    return id;
  });
}

export async function updateOperationType(id: string, input: OperationTypeInput) {
  return guardAction(async () => {
    await requireAdminArea("comercial");
    const data = operationTypeSchema.parse(input);
    await updateOperationTypeService(id, data);
    revalidatePath(`${ADMIN_QUOTES}/definicoes`);
  });
}

export async function deleteOperationType(id: string) {
  return guardAction(async () => {
    await requireAdminArea("comercial");
    await deleteOperationTypeService(id);
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
