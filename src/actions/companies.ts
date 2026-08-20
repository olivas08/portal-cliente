"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminArea } from "@/lib/auth-guard";
import { guardAction } from "@/lib/errors";
import {
  updateCompanyFiscalInfo as updateCompanyFiscalInfoService,
  companyFiscalSchema,
} from "@/services/companies.service";

const inputSchema = companyFiscalSchema;

export async function updateCompanyFiscalInfo(
  companyId: string,
  orderId: string,
  input: z.infer<typeof inputSchema>
) {
  return guardAction(async () => {
    await requireAdminArea("comercial");

    const fiscal = await updateCompanyFiscalInfoService(companyId, input);

    revalidatePath(`/admin/ordens/${orderId}`);
    return fiscal;
  });
}
