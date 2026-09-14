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
  generateWorkOrdersSchema,
  workOrderIdSchema,
  setWorkOrderPrioritySchema,
} from "@/services/production/work-orders.service";
import {
  setProductRouting as setProductRoutingService,
  reworkStep as reworkStepService,
  resolveNonConformity as resolveNonConformityService,
  startStep,
  pauseStep,
  completeStep,
  startStepFromOffice,
  completeStepFromOffice,
  completeWorkOrderFromOffice,
  setProductRoutingSchema,
  nonConformityIdSchema,
  stepIdSchema,
  completeStepSchema,
  type CompleteStepInput,
  type SetProductRoutingInput,
} from "@/services/production/routing.service";
import {
  loginOperator,
  operatorLoginSchema,
  type OperatorLoginInput,
} from "@/services/production/operators.service";

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
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = setProductRoutingSchema.parse(input);

    await setProductRoutingService(data);

    revalidatePath(ADMIN_ROUTING);
    revalidatePath(ADMIN_BOARD);
  });
}

const ADMIN_QUALITY = "/admin/producao/qualidade";

export async function reworkStep(stepId: string) {
  return guardAction(async () => {
    await requireAdminArea("qualidade");
    const data = stepIdSchema.parse({ stepId });

    await reworkStepService(data.stepId);

    revalidatePath(ADMIN_QUALITY);
    revalidatePath(ADMIN_BOARD);
    revalidatePath(TERMINAL);
  });
}

export async function resolveNonConformity(id: string) {
  return guardAction(async () => {
    await requireAdminArea("qualidade");
    const data = nonConformityIdSchema.parse({ id });

    await resolveNonConformityService(data.id);

    revalidatePath(ADMIN_QUALITY);
  });
}

export async function operatorLogin(input: OperatorLoginInput) {
  return guardAction(async () => {
    const data = operatorLoginSchema.parse(input);
    const operator = await loginOperator(data);
    await setOperatorCookie(operator.id);
    revalidatePath(TERMINAL);
  });
}

export async function operatorLogout() {
  return guardAction(async () => {
    await clearOperatorCookie();
    revalidatePath(TERMINAL);
  });
}

export async function startStepAction(stepId: string) {
  return guardAction(async () => {
    const operator = await requireOperator();
    const data = stepIdSchema.parse({ stepId });

    await startStep(operator, data.stepId);

    revalidatePath(TERMINAL);
    revalidatePath(ADMIN_BOARD);
  });
}

export async function pauseStepAction(stepId: string) {
  return guardAction(async () => {
    const operator = await requireOperator();
    const data = stepIdSchema.parse({ stepId });

    await pauseStep(operator, data.stepId);

    revalidatePath(TERMINAL);
    revalidatePath(ADMIN_BOARD);
  });
}

export async function completeStepAction(input: CompleteStepInput) {
  return guardAction(async () => {
    const operator = await requireOperator();
    const data = completeStepSchema.parse(input);

    await completeStep(operator, data);

    revalidatePath(TERMINAL);
    revalidatePath(ADMIN_BOARD);
  });
}

export async function startStepFromOfficeAction(stepId: string) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = stepIdSchema.parse({ stepId });
    await startStepFromOffice(data.stepId);
    revalidatePath(ADMIN_BOARD);
    revalidatePath(TERMINAL);
  });
}

export async function completeStepFromOfficeAction(stepId: string) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = stepIdSchema.parse({ stepId });
    await completeStepFromOffice(data.stepId);
    revalidatePath(ADMIN_BOARD);
    revalidatePath(TERMINAL);
  });
}

export async function completeWorkOrderFromOfficeAction(workOrderId: string) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = workOrderIdSchema.parse({ workOrderId });
    await completeWorkOrderFromOffice(data.workOrderId);
    revalidatePath(ADMIN_BOARD);
    revalidatePath(TERMINAL);
  });
}
