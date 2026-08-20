"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/auth-guard";
import { guardAction } from "@/lib/errors";
import {
  createMaintenancePlan as createMaintenancePlanService,
  deactivateMaintenancePlan as deactivateMaintenancePlanService,
  completeScheduledMaintenance as completeScheduledMaintenanceService,
  reportBreakdown as reportBreakdownService,
  startMaintenanceTask as startMaintenanceTaskService,
  resolveMaintenanceTask as resolveMaintenanceTaskService,
  cancelMaintenanceTask as cancelMaintenanceTaskService,
  createMaintenancePlanSchema,
  maintenancePlanIdSchema,
  reportBreakdownSchema,
  maintenanceTaskIdSchema,
  resolveMaintenanceTaskSchema,
  type CreateMaintenancePlanInput,
  type ReportBreakdownInput,
  type ResolveMaintenanceTaskInput,
} from "@/services/production/maintenance.service";

const ADMIN_MAINTENANCE = "/admin/producao/manutencao";

export async function createMaintenancePlan(input: CreateMaintenancePlanInput) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = createMaintenancePlanSchema.parse(input);

    await createMaintenancePlanService(data);

    revalidatePath(ADMIN_MAINTENANCE);
  });
}

export async function deactivateMaintenancePlan(planId: string) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = maintenancePlanIdSchema.parse({ planId });

    await deactivateMaintenancePlanService(data.planId);

    revalidatePath(ADMIN_MAINTENANCE);
  });
}

export async function completeScheduledMaintenance(planId: string, notes?: string) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = maintenancePlanIdSchema.parse({ planId });

    await completeScheduledMaintenanceService(data.planId, notes);

    revalidatePath(ADMIN_MAINTENANCE);
  });
}

export async function reportBreakdown(input: ReportBreakdownInput) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = reportBreakdownSchema.parse(input);

    await reportBreakdownService(data);

    revalidatePath(ADMIN_MAINTENANCE);
  });
}

export async function startMaintenanceTask(taskId: string) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = maintenanceTaskIdSchema.parse({ taskId });

    await startMaintenanceTaskService(data.taskId);

    revalidatePath(ADMIN_MAINTENANCE);
  });
}

export async function resolveMaintenanceTask(input: ResolveMaintenanceTaskInput) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = resolveMaintenanceTaskSchema.parse(input);

    await resolveMaintenanceTaskService(data);

    revalidatePath(ADMIN_MAINTENANCE);
  });
}

export async function cancelMaintenanceTask(taskId: string) {
  return guardAction(async () => {
    await requireAdminArea("producao");
    const data = maintenanceTaskIdSchema.parse({ taskId });

    await cancelMaintenanceTaskService(data.taskId);

    revalidatePath(ADMIN_MAINTENANCE);
  });
}
