"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/auth-guard";
import {
  createOperator as createOperatorService,
  resetOperatorPin as resetOperatorPinService,
  setOperatorActive as setOperatorActiveService,
  createOperatorSchema,
  resetOperatorPinSchema,
  setOperatorActiveSchema,
  type CreateOperatorInput,
  type ResetOperatorPinInput,
} from "@/services/production/operators.service";

const ADMIN_OPERATORS = "/admin/operadores";
const TERMINAL = "/producao/terminal";

export async function createOperator(input: CreateOperatorInput) {
  await requireAdminArea("producao");
  const data = createOperatorSchema.parse(input);

  await createOperatorService(data);

  revalidatePath(ADMIN_OPERATORS);
  revalidatePath(TERMINAL);
}

export async function resetOperatorPin(input: ResetOperatorPinInput) {
  await requireAdminArea("producao");
  const data = resetOperatorPinSchema.parse(input);

  await resetOperatorPinService(data);

  revalidatePath(ADMIN_OPERATORS);
}

export async function setOperatorActive(operatorId: string, active: boolean) {
  await requireAdminArea("producao");
  const data = setOperatorActiveSchema.parse({ operatorId, active });

  await setOperatorActiveService(data);

  revalidatePath(ADMIN_OPERATORS);
  revalidatePath(TERMINAL);
}
