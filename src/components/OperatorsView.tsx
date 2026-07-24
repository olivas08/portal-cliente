"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  HardHat,
  KeyRound,
  Plus,
  ShieldCheck,
  UserPlus,
  Gauge,
  Package,
  Timer,
} from "lucide-react";
import type { OperatorVM } from "@/lib/types";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";
import {
  createOperator,
  resetOperatorPin,
  setOperatorActive,
} from "@/actions/operators";

const pct = (v: number) => `${Math.round(v * 100)}%`;

function metricColor(v: number): string {
  if (v >= 0.85) return "text-emerald-600";
  if (v >= 0.6) return "text-amber-600";
  return "text-red-600";
}

function formatMin(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}min`;
}

interface Props {
  operators: OperatorVM[];
}

export function OperatorsView({ operators }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");

  const [pinFor, setPinFor] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");

  const run = (fn: () => Promise<void>) => {
    setError("");
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Ocorreu um erro. Tente novamente.",
        );
      }
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await createOperator({ name, pin });
      setName("");
      setPin("");
      setShowCreate(false);
    });
  };

  const handleResetPin = (e: React.FormEvent, operatorId: string) => {
    e.preventDefault();
    run(async () => {
      await resetOperatorPin({ operatorId, pin: newPin });
      setNewPin("");
      setPinFor(null);
    });
  };

  return (
    <>
      <BreadcrumbSetter text="Trabalhadores" />

      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
            <HardHat size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Trabalhadores</h1>
            <p className="text-slate-500 text-sm mt-1">
              Gestão de operadores do chão de fábrica e acesso ao terminal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/producao"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft size={16} /> Produção
          </Link>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <Plus size={16} /> Novo Operador
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <span>
          As métricas individuais são privadas e destinam-se a apoio e
          equilíbrio de carga da equipa &mdash; não são visíveis aos operadores.
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold">
            <UserPlus size={18} /> Novo Operador
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Ferreira"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">
                PIN (4 a 12 dígitos)
              </span>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                inputMode="numeric"
                placeholder="Ex: 1234"
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
              Criar Operador
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {operators.map((op) => (
          <div
            key={op.id}
            className={`rounded-xl border bg-white p-4 ${
              op.active ? "border-slate-200" : "border-slate-200 opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-800">{op.name}</h2>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      op.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        op.active ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                    {op.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {op.completedSteps} operações concluídas
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setPinFor((cur) => (cur === op.id ? null : op.id));
                    setNewPin("");
                  }}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  <KeyRound size={14} /> PIN
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(() => setOperatorActive(op.id, !op.active))
                  }
                  disabled={pending}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60 ${
                    op.active
                      ? "border-slate-200 text-slate-600 hover:bg-slate-50"
                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  {op.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>

            {pinFor === op.id && (
              <form
                onSubmit={(e) => handleResetPin(e, op.id)}
                className="mt-3 flex items-end gap-2 rounded-lg bg-slate-50 p-3"
              >
                <label className="block flex-1">
                  <span className="text-xs font-medium text-slate-500">
                    Novo PIN
                  </span>
                  <input
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    inputMode="numeric"
                    placeholder="4 a 12 dígitos"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  Repor
                </button>
              </form>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric
                icon={<Gauge size={14} />}
                label="Eficiência"
                value={pct(op.efficiency)}
                color={op.completedSteps > 0 ? metricColor(op.efficiency) : ""}
                empty={op.completedSteps === 0}
              />
              <Metric
                icon={<ShieldCheck size={14} />}
                label="Qualidade"
                value={pct(op.quality)}
                color={op.completedSteps > 0 ? metricColor(op.quality) : ""}
                empty={op.completedSteps === 0}
              />
              <Metric
                icon={<Package size={14} />}
                label="Produção"
                value={`${op.output} un`}
                empty={op.completedSteps === 0}
              />
              <Metric
                icon={<Timer size={14} />}
                label="Tempo médio"
                value={op.completedSteps > 0 ? formatMin(op.avgMinutes) : "—"}
                empty={op.completedSteps === 0}
              />
            </div>
          </div>
        ))}
      </div>

      {operators.length === 0 && (
        <p className="mt-8 text-center text-sm text-slate-400">
          Ainda não há operadores. Crie o primeiro acima.
        </p>
      )}
    </>
  );
}

function Metric({
  icon,
  label,
  value,
  color = "text-slate-800",
  empty = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
  empty?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-bold ${empty ? "text-slate-300" : color}`}
      >
        {empty ? "—" : value}
      </div>
    </div>
  );
}
