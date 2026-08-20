"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/auth-guard";
import { guardAction } from "@/lib/errors";
import { issueInvoice as issueInvoiceService } from "@/services/invoices.service";

export async function issueInvoice(orderId: string) {
  return guardAction(async () => {
    await requireAdminArea("comercial");

    const invoice = await issueInvoiceService(orderId);

    revalidatePath(`/admin/ordens/${orderId}`);
    return invoice;
  });
}
