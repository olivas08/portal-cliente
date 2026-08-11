"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/auth-guard";
import { guardAction } from "@/lib/errors";
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
  reworkStep as reworkStepService,
  resolveNonConformity as resolveNonConformityService,
  loginOperator,
  startStep,
  pauseStep,
  completeStep,
  operatorLoginSchema,
  generateWorkOrdersSchema,
  workOrderIdSchema,
  setWorkOrderPrioritySchema,
  setProductRoutingSchema,
  nonConformityIdSchema,
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
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = generateWorkOrdersSchema.parse({ orderId });

    await generateWorkOrdersForOrder(data.orderId);

    revalidatePath(ADMIN_BOARD);
    revalidatePath(`/admin/ordens/${orderId}`);
  });
}

export async function releaseWorkOrder(workOrderId: string) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = workOrderIdSchema.parse({ workOrderId });

    await releaseWorkOrderService(data.workOrderId);

    revalidatePath(ADMIN_BOARD);
    revalidatePath(TERMINAL);
  });
}

export async function cancelWorkOrder(workOrderId: string) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = workOrderIdSchema.parse({ workOrderId });

    await cancelWorkOrderService(data.workOrderId);

    revalidatePath(ADMIN_BOARD);
    revalidatePath(TERMINAL);
  });
}

export async function reopenWorkOrder(workOrderId: string) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = workOrderIdSchema.parse({ workOrderId });

    await reopenWorkOrderService(data.workOrderId);

    revalidatePath(ADMIN_BOARD);
    revalidatePath(TERMINAL);
  });
}

export async function deleteWorkOrder(workOrderId: string) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = workOrderIdSchema.parse({ workOrderId });

    await deleteWorkOrderService(data.workOrderId);

    revalidatePath(ADMIN_BOARD);
  });
}

export async function setWorkOrderPriority(
  workOrderId: string,
  priority: "normal" | "urgent",
) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = setWorkOrderPrioritySchema.parse({ workOrderId, priority });

    await setWorkOrderPriorityService(data.workOrderId, data.priority);

    revalidatePath(ADMIN_BOARD);
    revalidatePath(TERMINAL);
  });
}

const ADMIN_ROUTING = "/admin/producao/roteiros";

export async function setProductRouting(input: SetProductRoutingInput) {
  await requireAdminArea("producao");
  const data = setProductRoutingSchema.parse(input);

  await setProductRoutingService(data);

  revalidatePath(ADMIN_ROUTING);
  revalidatePath(ADMIN_BOARD);
}

const ADMIN_QUALITY = "/admin/producao/qualidade";

export async function reworkStep(stepId: string) {
  await requireAdminArea("qualidade");
  const data = stepIdSchema.parse({ stepId });

  await reworkStepService(data.stepId);

  revalidatePath(ADMIN_QUALITY);
  revalidatePath(ADMIN_BOARD);
  revalidatePath(TERMINAL);
}

export async function resolveNonConformity(id: string) {
  await requireAdminArea("qualidade");
  const data = nonConformityIdSchema.parse({ id });

  await resolveNonConformityService(data.id);

  revalidatePath(ADMIN_QUALITY);
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
