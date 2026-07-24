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
  cancelWorkOrder as cancelWorkOrderService,
  reopenWorkOrder as reopenWorkOrderService,
  deleteWorkOrder as deleteWorkOrderService,
  setWorkOrderPriority as setWorkOrderPriorityService,
  setProductRouting as setProductRoutingService,
  loginOperator,
  startStep,
  pauseStep,
  completeStep,
  operatorLoginSchema,
  generateWorkOrdersSchema,
  workOrderIdSchema,
  setWorkOrderPrioritySchema,
  setProductRoutingSchema,
  stepIdSchema,
  completeStepSchema,
  type OperatorLoginInput,
  type CompleteStepInput,
  type SetProductRoutingInput,
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

export async function cancelWorkOrder(workOrderId: string) {
  await requireAdmin();
  const data = workOrderIdSchema.parse({ workOrderId });

  await cancelWorkOrderService(data.workOrderId);

  revalidatePath(ADMIN_BOARD);
  revalidatePath(TERMINAL);
}

export async function reopenWorkOrder(workOrderId: string) {
  await requireAdmin();
  const data = workOrderIdSchema.parse({ workOrderId });

  await reopenWorkOrderService(data.workOrderId);

  revalidatePath(ADMIN_BOARD);
  revalidatePath(TERMINAL);
}

export async function deleteWorkOrder(workOrderId: string) {
  await requireAdmin();
  const data = workOrderIdSchema.parse({ workOrderId });

  await deleteWorkOrderService(data.workOrderId);

  revalidatePath(ADMIN_BOARD);
}

export async function setWorkOrderPriority(
  workOrderId: string,
  priority: "normal" | "urgent",
) {
  await requireAdmin();
  const data = setWorkOrderPrioritySchema.parse({ workOrderId, priority });

  await setWorkOrderPriorityService(data.workOrderId, data.priority);

  revalidatePath(ADMIN_BOARD);
  revalidatePath(TERMINAL);
}

const ADMIN_ROUTING = "/admin/producao/roteiros";

export async function setProductRouting(input: SetProductRoutingInput) {
  await requireAdmin();
  const data = setProductRoutingSchema.parse(input);

  await setProductRoutingService(data);

  revalidatePath(ADMIN_ROUTING);
  revalidatePath(ADMIN_BOARD);
}

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
