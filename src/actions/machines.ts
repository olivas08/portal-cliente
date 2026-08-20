"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/auth-guard";
import {
  createMachine as createMachineService,
  setMachineActive as setMachineActiveService,
  regenerateMachineToken as regenerateMachineTokenService,
  createMachineSchema,
  setMachineActiveSchema,
  regenerateMachineTokenSchema,
  type CreateMachineInput,
} from "@/services/production/machines.service";

const ADMIN_MACHINES = "/admin/producao/maquinas";

export async function createMachine(input: CreateMachineInput) {
  await requireAdminArea("producao");
  const data = createMachineSchema.parse(input);

  await createMachineService(data);

  revalidatePath(ADMIN_MACHINES);
}

export async function setMachineActive(machineId: string, active: boolean) {
  await requireAdminArea("producao");
  const data = setMachineActiveSchema.parse({ machineId, active });

  await setMachineActiveService(data);

  revalidatePath(ADMIN_MACHINES);
}

export async function regenerateMachineToken(machineId: string, token: string) {
  await requireAdminArea("producao");
  const data = regenerateMachineTokenSchema.parse({ machineId, token });

  await regenerateMachineTokenService(data);

  revalidatePath(ADMIN_MACHINES);
}
