"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireClient, requireUser } from "@/lib/auth-guard";
import {
  addRequestMessage as addRequestMessageService,
  createRequest as createRequestService,
  createRequestSchema,
  requestMessageSchema,
  requestStatusSchema,
  updateRequestStatus as updateRequestStatusService,
} from "@/services/requests.service";

export async function createRequest(input: {
  type: string;
  subject: string;
  text: string;
}) {
  const user = await requireClient();
  const data = createRequestSchema.parse(input);

  const id = await createRequestService(user, data);

  revalidatePath("/dashboard/requerimentos");
  revalidatePath("/admin/requerimentos");
  return id;
}

export async function addRequestMessage(requestId: string, rawText: string) {
  const user = await requireUser();
  const text = requestMessageSchema.parse(rawText);

  await addRequestMessageService(user, requestId, text);

  revalidatePath(`/dashboard/requerimentos/${requestId}`);
  revalidatePath(`/admin/requerimentos/${requestId}`);
  revalidatePath("/dashboard/requerimentos");
  revalidatePath("/admin/requerimentos");
}

export async function updateRequestStatus(requestId: string, status: string) {
  await requireAdmin();
  const parsed = requestStatusSchema.parse(status);

  await updateRequestStatusService(requestId, parsed);

  revalidatePath(`/admin/requerimentos/${requestId}`);
  revalidatePath(`/dashboard/requerimentos/${requestId}`);
  revalidatePath("/admin/requerimentos");
}
