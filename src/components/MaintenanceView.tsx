"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Wrench,
  Plus,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  X,
} from "lucide-react";
import type { MaintenancePlanVM, MaintenanceTaskVM, MachineVM } from "@/lib/types";
import {
  MAINTENANCE_TYPE_LABELS,
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_URGENCY_LABELS,
} from "@/lib/types";
import { actionError } from "@/lib/action-result";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";
import {
  createMaintenancePlan,
  deactivateMaintenancePlan,
  completeScheduledMaintenance,
  reportBreakdown,
  resolveMaintenanceTask,
  cancelMaintenanceTask,
} from "@/actions/maintenance";

interface Props {
  plans: MaintenancePlanVM[];
  tasks: MaintenanceTaskVM[];
  machines: MachineVM[];
}

const URGENCY_STYLE: Record<MaintenancePlanVM["urgency"], string> = {
  overdue: "bg-red-50 text-red-700",
  due_soon: "bg-amber-50 text-amber-700",
  ok: "bg-emerald-50 text-emerald-700",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT");
}

export function MaintenanceView({ plans, tasks, machines }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planMachineId, setPlanMachineId] = useState("");
  const [planName, setPlanName] = useState("");
  const [planInterval, setPlanInterval] = useState("30");

  const [showBreakdownForm, setShowBreakdownForm] = useState(false);
  const [bdMachineId, setBdMachineId] = useState("");
  const [bdTitle, setBdTitle] = useState("");
  const [bdDescription, setBdDescription] = useState("");

  const [resolvingTaskId, setResolvingTaskId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  const run = (fn: () => Promise<unknown>) => {
    setError("");
    startTransition(async () => {
      try {
        const res = await fn();
        const msg = actionError(res);
        if (msg) {
          setError(msg);
          return;
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocorreu um erro.");
      }
    });
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await createMaintenancePlan({
        machineId: planMachineId,
        name: planName,
        intervalDays: Number(planInterval),
      });
      if (!actionError(res)) {
        setPlanMachineId("");
        setPlanName("");
        setPlanInterval("30");
        setShowPlanForm(false);
      }
      return res;
    });
  };

  const handleReportBreakdown = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await reportBreakdown({
        machineId: bdMachineId,
        title: bdTitle,
        description: bdDescription || undefined,
      });
      if (!actionError(res)) {
        setBdMachineId("");
        setBdTitle("");
        setBdDescription("");
        setShowBreakdownForm(false);
      }
      return res;
    });
  };

  const handleResolve = (e: React.FormEvent, taskId: string) => {
    e.preventDefault();
    run(async () => {
      const res = await resolveMaintenanceTask({
        taskId,
        notes: resolveNotes || undefined,
      });
      if (!actionError(res)) {
        setResolveNotes("");
        setResolvingTaskId(null);
      }
      return res;
    });
  };

  const openTasks = tasks.filter((t) => t.status === "open");
  const closedTasks = tasks.filter((t) => t.status !== "open");
  const overdueCount = plans.filter((p) => p.urgency === "overdue").length;
  const dueSoonCount = plans.filter((p) => p.urgency === "due_soon").length;

  return (
    <>
      <BreadcrumbSetter text="Manutenção" />

      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
            <Wrench size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Manutenção</h1>
            <p className="text-slate-500 text-sm mt-1">
              Planos preventivos por máquina e registo de avarias
            </p>
          </div>
        </div>
        <Link
          href="/admin/producao"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft size={16} /> Produção
        </Link>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Planos atrasados</p>
          <p className="mt-1 text-2xl font-bold text-red-600 tabular-nums">
            {overdueCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">A vencer em breve</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 tabular-nums">
            {dueSoonCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Avarias abertas</p>
          <p className="mt-1 text-2xl font-bold text-slate-800 tabular-nums">
            {openTasks.filter((t) => t.type === "corrective").length}
          </p>
        </div>
      </div>

      {/* ── Preventive plans ──────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-slate-800">Planos preventivos</h2>
          <button
            type="button"
            onClick={() => setShowPlanForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <Plus size={16} /> Novo plano
          </button>
        </div>

        {showPlanForm && (
          <form
            onSubmit={handleCreatePlan}
            className="mb-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Máquina</span>
                <select
                  value={planMachineId}
                  onChange={(e) => setPlanMachineId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Selecionar —</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">
                  Nome do plano
                </span>
                <input
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Lubrificação mensal"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">
                  Intervalo (dias)
                </span>
                <input
                  type="number"
                  min={1}
                  value={planInterval}
                  onChange={(e) => setPlanInterval(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
              >
                Criar plano
              </button>
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
                    {p.lastDoneAt ? formatDate(p.lastDoneAt) : "nunca"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {formatDate(p.nextDueDate)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_STYLE[p.urgency]}`}
                    >
                      {p.urgency === "overdue" && <AlertTriangle size={12} />}
                      {p.urgency === "due_soon" && <Clock size={12} />}
                      {p.urgency === "ok" && <CheckCircle2 size={12} />}
                      {MAINTENANCE_URGENCY_LABELS[p.urgency]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => completeScheduledMaintenance(p.id))}
                        className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                      >
                        Concluir
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => deactivateMaintenancePlan(p.id))}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Desativar
                      </button>
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

      {/* ── Corrective breakdowns ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-slate-800">Avarias</h2>
          <button
            type="button"
            onClick={() => setShowBreakdownForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <Flame size={16} /> Reportar avaria
          </button>
        </div>

        {showBreakdownForm && (
          <form
            onSubmit={handleReportBreakdown}
            className="mb-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Máquina</span>
                <select
                  value={bdMachineId}
                  onChange={(e) => setBdMachineId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Selecionar —</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Título</span>
                <input
                  value={bdTitle}
                  onChange={(e) => setBdTitle(e.target.value)}
                  placeholder="Fuga de óleo hidráulico"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-slate-500">
                  Descrição (opcional)
                </span>
                <textarea
                  value={bdDescription}
                  onChange={(e) => setBdDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Reportar
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {openTasks.map((t) => (
            <div key={t.id} className="rounded-xl border border-red-200 bg-red-50/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      {MAINTENANCE_TYPE_LABELS[t.type]}
                    </span>
                    <h3 className="font-semibold text-slate-800">{t.title}</h3>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t.machineName} · reportada em {formatDate(t.reportedAt)}
                  </p>
                  {t.description && (
                    <p className="mt-2 text-sm text-slate-600">{t.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setResolvingTaskId((cur) => (cur === t.id ? null : t.id));
                      setResolveNotes("");
                    }}
                    className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    Resolver
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => cancelMaintenanceTask(t.id))}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-60"
                    title="Cancelar (reportada por engano)"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {resolvingTaskId === t.id && (
                <form
                  onSubmit={(e) => handleResolve(e, t.id)}
                  className="mt-3 flex items-end gap-2 rounded-lg bg-white p-3"
                >
                  <label className="block flex-1">
                    <span className="text-xs font-medium text-slate-500">
                      Notas de reparação (opcional)
                    </span>
                    <input
                      value={resolveNotes}
                      onChange={(e) => setResolveNotes(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Confirmar
                  </button>
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
                      {t.resolvedAt ? formatDate(t.resolvedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
