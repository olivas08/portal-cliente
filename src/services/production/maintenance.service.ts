import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, invalidateCache } from "@/lib/cache-tags";
import { NotFoundError, AppError } from "@/lib/errors";
import {
  canStartMaintenanceTask,
  canResolveMaintenanceTask,
  canCancelMaintenanceTask,
} from "@/services/maintenance";

// ── Schemas ─────────────────────────────────────────────────────────────────

export const createMaintenancePlanSchema = z.object({
  machineId: z.string().trim().min(1),
  name: z.string().trim().min(2, "Nome obrigatório.").max(120),
  intervalDays: z.number().int().min(1, "Intervalo tem de ser pelo menos 1 dia.").max(3650),
});
export type CreateMaintenancePlanInput = z.infer<typeof createMaintenancePlanSchema>;

export const maintenancePlanIdSchema = z.object({ planId: z.string().trim().min(1) });

export const reportBreakdownSchema = z.object({
  machineId: z.string().trim().min(1),
  title: z.string().trim().min(2, "Título obrigatório.").max(120),
  description: z.string().trim().max(2000).optional(),
});
export type ReportBreakdownInput = z.infer<typeof reportBreakdownSchema>;

export const maintenanceTaskIdSchema = z.object({ taskId: z.string().trim().min(1) });

export const resolveMaintenanceTaskSchema = z.object({
  taskId: z.string().trim().min(1),
  notes: z.string().trim().max(2000).optional(),
});
export type ResolveMaintenanceTaskInput = z.infer<typeof resolveMaintenanceTaskSchema>;

// ── Preventive plans ─────────────────────────────────────────────────────────

export async function createMaintenancePlan(
  input: CreateMaintenancePlanInput,
): Promise<void> {
  const machine = await prisma.machine.findUnique({
    where: { id: input.machineId },
    select: { id: true },
  });
  if (!machine) throw new NotFoundError("Máquina não encontrada.");

  await prisma.maintenancePlan.create({
    data: {
      machineId: input.machineId,
      name: input.name,
      intervalDays: input.intervalDays,
    },
  });
  invalidateCache(CACHE_TAGS.maintenance);
}

export async function deactivateMaintenancePlan(planId: string): Promise<void> {
  const plan = await prisma.maintenancePlan.findUnique({
    where: { id: planId },
    select: { id: true },
  });
  if (!plan) throw new NotFoundError("Plano de manutenção não encontrado.");

  await prisma.maintenancePlan.update({
    where: { id: planId },
    data: { active: false },
  });
  invalidateCache(CACHE_TAGS.maintenance);
}

/**
 * Checks off a preventive plan as done "now": creates a resolved
 * `MaintenanceTask` record (the historical log entry) and bumps
 * `plan.lastDoneAt`, which is what pushes the next due date forward.
 */
export async function completeScheduledMaintenance(
  planId: string,
  notes?: string,
): Promise<void> {
  const plan = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
  if (!plan) throw new NotFoundError("Plano de manutenção não encontrado.");

  const now = new Date();
  await prisma.$transaction([
    prisma.maintenanceTask.create({
      data: {
        machineId: plan.machineId,
        planId: plan.id,
        type: "preventive",
        status: "resolved",
        title: plan.name,
        reportedAt: now,
        startedAt: now,
        resolvedAt: now,
        notes: notes || null,
      },
    }),
    prisma.maintenancePlan.update({
      where: { id: plan.id },
      data: { lastDoneAt: now },
    }),
  ]);
  invalidateCache(CACHE_TAGS.maintenance);
}

// ── Corrective breakdowns ────────────────────────────────────────────────────

export async function reportBreakdown(input: ReportBreakdownInput): Promise<void> {
  const machine = await prisma.machine.findUnique({
    where: { id: input.machineId },
    select: { id: true },
  });
  if (!machine) throw new NotFoundError("Máquina não encontrada.");

  await prisma.maintenanceTask.create({
    data: {
      machineId: input.machineId,
      type: "corrective",
      status: "open",
      title: input.title,
      description: input.description || null,
    },
  });
  invalidateCache(CACHE_TAGS.maintenance);
}

export async function startMaintenanceTask(taskId: string): Promise<void> {
  const task = await prisma.maintenanceTask.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Tarefa de manutenção não encontrada.");
  if (!canStartMaintenanceTask(task.status, task.startedAt)) {
    throw new AppError("Esta tarefa não pode ser iniciada.");
  }

  await prisma.maintenanceTask.update({
    where: { id: taskId },
    data: { startedAt: new Date() },
  });
  invalidateCache(CACHE_TAGS.maintenance);
}

/**
 * Resolves a corrective (or any open) task. If it's linked to a plan, also
 * bumps `plan.lastDoneAt` — a breakdown repair counts as maintenance done.
 */
export async function resolveMaintenanceTask(
  input: ResolveMaintenanceTaskInput,
): Promise<void> {
  const task = await prisma.maintenanceTask.findUnique({ where: { id: input.taskId } });
  if (!task) throw new NotFoundError("Tarefa de manutenção não encontrada.");
  if (!canResolveMaintenanceTask(task.status)) {
    throw new AppError("Esta tarefa já foi encerrada.");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.maintenanceTask.update({
      where: { id: task.id },
      data: { status: "resolved", resolvedAt: now, notes: input.notes || task.notes },
    });
    if (task.planId) {
      await tx.maintenancePlan.update({
        where: { id: task.planId },
        data: { lastDoneAt: now },
      });
    }
  });
  invalidateCache(CACHE_TAGS.maintenance);
}

export async function cancelMaintenanceTask(taskId: string): Promise<void> {
  const task = await prisma.maintenanceTask.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Tarefa de manutenção não encontrada.");
  if (!canCancelMaintenanceTask(task.status)) {
    throw new AppError("Esta tarefa já foi encerrada.");
  }

  await prisma.maintenanceTask.update({
    where: { id: taskId },
    data: { status: "cancelled", resolvedAt: new Date() },
  });
  invalidateCache(CACHE_TAGS.maintenance);
}
