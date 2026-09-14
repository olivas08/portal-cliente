"use client";

import { AlertTriangle, CheckCircle2, Clock, Plus } from "lucide-react";
import type { MaintenancePlanVM, MachineVM } from "@/lib/types";
import { MAINTENANCE_URGENCY_LABELS } from "@/lib/types";
import { formatInstantPt } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";

const URGENCY_TONE: Record<
  MaintenancePlanVM["urgency"],
  "red" | "amber" | "emerald"
> = {
  overdue: "red",
  due_soon: "amber",
  ok: "emerald",
};

export function MaintenancePlansPanel({
  plans,
  machines,
  pending,
  showForm,
  onToggleForm,
  planMachineId,
  planName,
  planInterval,
  onPlanMachineId,
  onPlanName,
  onPlanInterval,
  onCreate,
  onComplete,
  onDeactivate,
}: {
  plans: MaintenancePlanVM[];
  machines: MachineVM[];
  pending: boolean;
  showForm: boolean;
  onToggleForm: () => void;
  planMachineId: string;
  planName: string;
  planInterval: string;
  onPlanMachineId: (v: string) => void;
  onPlanName: (v: string) => void;
  onPlanInterval: (v: string) => void;
  onCreate: (e: React.FormEvent) => void;
  onComplete: (id: string) => void;
  onDeactivate: (id: string) => void;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold text-slate-800">Planos preventivos</h2>
        <Button onClick={onToggleForm}>
          <Plus size={16} /> Novo plano
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={onCreate}
          className="mb-4 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              label="Máquina"
              value={planMachineId}
              onChange={(e) => onPlanMachineId(e.target.value)}
              required
            >
              <option value="">— Selecionar —</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <Input
              label="Nome do plano"
              value={planName}
              onChange={(e) => onPlanName(e.target.value)}
              placeholder="Lubrificação mensal"
              required
            />
            <Input
              label="Intervalo (dias)"
              type="number"
              min={1}
              value={planInterval}
              onChange={(e) => onPlanInterval(e.target.value)}
              required
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={pending}>
              Criar plano
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
              <th className="px-4 py-2.5 font-medium">Plano</th>
              <th className="px-4 py-2.5 font-medium">Máquina</th>
              <th className="px-4 py-2.5 font-medium">Intervalo</th>
              <th className="px-4 py-2.5 font-medium">Última</th>
              <th className="px-4 py-2.5 font-medium">Próxima</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-700">{p.name}</td>
                <td className="px-4 py-2.5 text-slate-600">{p.machineName}</td>
                <td className="px-4 py-2.5 text-slate-600">{p.intervalDays} dias</td>
                <td className="px-4 py-2.5 text-slate-500">
                  {p.lastDoneAt ? formatInstantPt(p.lastDoneAt) : "nunca"}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {formatInstantPt(p.nextDueDate)}
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={URGENCY_TONE[p.urgency]}>
                    {p.urgency === "overdue" && <AlertTriangle size={12} />}
                    {p.urgency === "due_soon" && <Clock size={12} />}
                    {p.urgency === "ok" && <CheckCircle2 size={12} />}
                    {MAINTENANCE_URGENCY_LABELS[p.urgency]}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => onComplete(p.id)}
                      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      Concluir
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => onDeactivate(p.id)}
                    >
                      Desativar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
                  Ainda não há planos de manutenção preventiva.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
