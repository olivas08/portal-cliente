"use client";

import { Flame, X } from "lucide-react";
import type { MaintenanceTaskVM, MachineVM } from "@/lib/types";
import {
  MAINTENANCE_TYPE_LABELS,
  MAINTENANCE_STATUS_LABELS,
} from "@/lib/types";
import { formatInstantPt } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";

export function MaintenanceBreakdownsPanel({
  openTasks,
  closedTasks,
  machines,
  pending,
  showForm,
  onToggleForm,
  bdMachineId,
  bdTitle,
  bdDescription,
  onBdMachineId,
  onBdTitle,
  onBdDescription,
  onReport,
  resolvingTaskId,
  resolveNotes,
  onResolvingTaskId,
  onResolveNotes,
  onResolve,
  onCancel,
}: {
  openTasks: MaintenanceTaskVM[];
  closedTasks: MaintenanceTaskVM[];
  machines: MachineVM[];
  pending: boolean;
  showForm: boolean;
  onToggleForm: () => void;
  bdMachineId: string;
  bdTitle: string;
  bdDescription: string;
  onBdMachineId: (v: string) => void;
  onBdTitle: (v: string) => void;
  onBdDescription: (v: string) => void;
  onReport: (e: React.FormEvent) => void;
  resolvingTaskId: string | null;
  resolveNotes: string;
  onResolvingTaskId: (id: string | null) => void;
  onResolveNotes: (v: string) => void;
  onResolve: (e: React.FormEvent, taskId: string) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold text-slate-800">Avarias</h2>
        <Button variant="danger" onClick={onToggleForm}>
          <Flame size={16} /> Reportar avaria
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={onReport}
          className="mb-4 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Máquina"
              value={bdMachineId}
              onChange={(e) => onBdMachineId(e.target.value)}
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
              label="Título"
              value={bdTitle}
              onChange={(e) => onBdTitle(e.target.value)}
              placeholder="Fuga de óleo hidráulico"
              required
            />
            <div className="sm:col-span-2">
              <Textarea
                label="Descrição (opcional)"
                value={bdDescription}
                onChange={(e) => onBdDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="submit" variant="danger" disabled={pending}>
              Reportar
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {openTasks.map((t) => (
          <div key={t.id} className="rounded-xl border border-red-200 bg-red-50/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone="red">{MAINTENANCE_TYPE_LABELS[t.type]}</Badge>
                  <h3 className="font-semibold text-slate-800">{t.title}</h3>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t.machineName} · reportada em {formatInstantPt(t.reportedAt)}
                </p>
                {t.description && (
                  <p className="mt-2 text-sm text-slate-600">{t.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    onResolvingTaskId(resolvingTaskId === t.id ? null : t.id);
                    onResolveNotes("");
                  }}
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  Resolver
                </Button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onCancel(t.id)}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-60"
                  title="Cancelar (reportada por engano)"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {resolvingTaskId === t.id && (
              <form
                onSubmit={(e) => onResolve(e, t.id)}
                className="mt-3 flex items-end gap-2 rounded-lg bg-white p-3"
              >
                <div className="flex-1">
                  <Input
                    label="Notas de reparação (opcional)"
                    value={resolveNotes}
                    onChange={(e) => onResolveNotes(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={pending} className="bg-emerald-600 hover:bg-emerald-700">
                  Confirmar
                </Button>
              </form>
            )}
          </div>
        ))}
        {openTasks.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
            Sem avarias abertas.
          </p>
        )}
      </div>

      {closedTasks.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5 font-medium">Título</th>
                <th className="px-4 py-2.5 font-medium">Máquina</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Encerrada em</th>
              </tr>
            </thead>
            <tbody>
              {closedTasks.map((t) => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="px-4 py-2.5 text-slate-700">{t.title}</td>
                  <td className="px-4 py-2.5 text-slate-600">{t.machineName}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {MAINTENANCE_TYPE_LABELS[t.type]}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {MAINTENANCE_STATUS_LABELS[t.status]}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {t.resolvedAt ? formatInstantPt(t.resolvedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
