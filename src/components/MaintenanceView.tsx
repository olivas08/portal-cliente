"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wrench } from "lucide-react";
import type { MaintenancePlanVM, MaintenanceTaskVM, MachineVM } from "@/lib/types";
import { actionError } from "@/lib/action-result";
import { Alert } from "@/components/ui/Alert";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";
import {
  createMaintenancePlan,
  deactivateMaintenancePlan,
  completeScheduledMaintenance,
  reportBreakdown,
  resolveMaintenanceTask,
  cancelMaintenanceTask,
} from "@/actions/maintenance";
import { MaintenancePlansPanel } from "@/components/maintenance/MaintenancePlansPanel";
import { MaintenanceBreakdownsPanel } from "@/components/maintenance/MaintenanceBreakdownsPanel";

interface Props {
  plans: MaintenancePlanVM[];
  tasks: MaintenanceTaskVM[];
  machines: MachineVM[];
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

      {error && <Alert className="mb-4">{error}</Alert>}

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

      <MaintenancePlansPanel
        plans={plans}
        machines={machines}
        pending={pending}
        showForm={showPlanForm}
        onToggleForm={() => setShowPlanForm((v) => !v)}
        planMachineId={planMachineId}
        planName={planName}
        planInterval={planInterval}
        onPlanMachineId={setPlanMachineId}
        onPlanName={setPlanName}
        onPlanInterval={setPlanInterval}
        onCreate={(e) => {
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
        }}
        onComplete={(id) => run(() => completeScheduledMaintenance(id))}
        onDeactivate={(id) => run(() => deactivateMaintenancePlan(id))}
      />

      <MaintenanceBreakdownsPanel
        openTasks={openTasks}
        closedTasks={closedTasks}
        machines={machines}
        pending={pending}
        showForm={showBreakdownForm}
        onToggleForm={() => setShowBreakdownForm((v) => !v)}
        bdMachineId={bdMachineId}
        bdTitle={bdTitle}
        bdDescription={bdDescription}
        onBdMachineId={setBdMachineId}
        onBdTitle={setBdTitle}
        onBdDescription={setBdDescription}
        onReport={(e) => {
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
        }}
        resolvingTaskId={resolvingTaskId}
        resolveNotes={resolveNotes}
        onResolvingTaskId={setResolvingTaskId}
        onResolveNotes={setResolveNotes}
        onResolve={(e, taskId) => {
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
        }}
        onCancel={(id) => run(() => cancelMaintenanceTask(id))}
      />
    </>
  );
}
