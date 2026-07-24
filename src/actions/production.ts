"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import {
  requireOperator,
  setOperatorCookie,
  clearOperatorCookie,
} from "@/lib/operator-session";
import {
  generateWorkOrdersForOrder,
  releaseWorkOrder as releaseWorkOrderService,
  loginOperator,
  startStep,
  pauseStep,
  completeStep,
  operatorLoginSchema,
  generateWorkOrdersSchema,
  workOrderIdSchema,
  stepIdSchema,
  completeStepSchema,
  type OperatorLoginInput,
  type CompleteStepInput,
} from "@/services/production.service";

const ADMIN_BOARD = "/admin/producao";
const TERMINAL = "/producao/terminal";

// ── Admin planning ──────────────────────────────────────────────────────────

export async function generateWorkOrders(orderId: string) {
  await requireAdmin();
  const data = generateWorkOrdersSchema.parse({ orderId });

  const created = await generateWorkOrdersForOrder(data.orderId);

  revalidatePath(ADMIN_BOARD);
  revalidatePath(`/admin/ordens/${orderId}`);
  return created;
}

export async function releaseWorkOrder(workOrderId: string) {
  await requireAdmin();
  const data = workOrderIdSchema.parse({ workOrderId });

  await releaseWorkOrderService(data.workOrderId);

  revalidatePath(ADMIN_BOARD);
  revalidatePath(TERMINAL);
}

// ── Shop-floor terminal ─────────────────────────────────────────────────────

export async function operatorLogin(input: OperatorLoginInput) {
  const data = operatorLoginSchema.parse(input);
  const operator = await loginOperator(data);
  await setOperatorCookie(operator.id);
  revalidatePath(TERMINAL);
}

export async function operatorLogout() {
  await clearOperatorCookie();
  revalidatePath(TERMINAL);
}

export async function startStepAction(stepId: string) {
  const operator = await requireOperator();
  const data = stepIdSchema.parse({ stepId });

  await startStep(operator, data.stepId);

  revalidatePath(TERMINAL);
  revalidatePath(ADMIN_BOARD);
}

export async function pauseStepAction(stepId: string) {
  const operator = await requireOperator();
  const data = stepIdSchema.parse({ stepId });

  await pauseStep(operator, data.stepId);

  revalidatePath(TERMINAL);
  revalidatePath(ADMIN_BOARD);
}

export async function completeStepAction(input: CompleteStepInput) {
  const operator = await requireOperator();
  const data = completeStepSchema.parse(input);

  await completeStep(operator, data);

  revalidatePath(TERMINAL);
  revalidatePath(ADMIN_BOARD);
}
