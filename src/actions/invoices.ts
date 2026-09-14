"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/auth-guard";
import { guardAction } from "@/lib/errors";
import { idSchema } from "@/lib/schemas";
import { issueInvoice as issueInvoiceService } from "@/services/invoices.service";

export async function issueInvoice(orderId: string) {
  return guardAction(async () => {
    await requireAdminArea("comercial");

    const parsedId = idSchema.parse(orderId);
    const invoice = await issueInvoiceService(parsedId);

    revalidatePath(`/admin/ordens/${parsedId}`);
    return invoice;
  });
}
