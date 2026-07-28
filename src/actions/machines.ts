"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import {
  createMachine as createMachineService,
  setMachineActive as setMachineActiveService,
  regenerateMachineToken as regenerateMachineTokenService,
  createMachineSchema,
  setMachineActiveSchema,
  regenerateMachineTokenSchema,
  type CreateMachineInput,
} from "@/services/production.service";

const ADMIN_MACHINES = "/admin/producao/maquinas";

export async function createMachine(input: CreateMachineInput) {
  await requireAdmin();
  const data = createMachineSchema.parse(input);

  await createMachineService(data);

  revalidatePath(ADMIN_MACHINES);
}

export async function setMachineActive(machineId: string, active: boolean) {
  await requireAdmin();
  const data = setMachineActiveSchema.parse({ machineId, active });

  await setMachineActiveService(data);

  revalidatePath(ADMIN_MACHINES);
}

export async function regenerateMachineToken(machineId: string, token: string) {
  await requireAdmin();
  const data = regenerateMachineTokenSchema.parse({ machineId, token });

  await regenerateMachineTokenService(data);

  revalidatePath(ADMIN_MACHINES);
}
