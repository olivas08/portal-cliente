"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Cpu,
  Plus,
  Wifi,
  WifiOff,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Radio,
} from "lucide-react";
import type {
  MachineVM,
  DiscrepancyVM,
  WorkstationOptionVM,
} from "@/lib/types";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";
import {
  createMachine,
  setMachineActive,
  regenerateMachineToken,
} from "@/actions/machines";

interface Props {
  machines: MachineVM[];
  discrepancies: DiscrepancyVM[];
  stations: WorkstationOptionVM[];
}

function timeAgo(iso: string | null): string {
  if (!iso) return "nunca";
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 5) return "agora";
  if (secs < 60) return `há ${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `há ${mins}min`;
  const h = Math.floor(mins / 60);
  return `há ${h}h`;
}

export function MachinesView({ machines, discrepancies, stations }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [stationId, setStationId] = useState("");
  const [token, setToken] = useState("");

  const [tokenFor, setTokenFor] = useState<string | null>(null);
  const [newToken, setNewToken] = useState("");

  // Live refresh: pull fresh machine counts/status every 5s.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);

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
      await createMachine({
        code,
        name,
        workstationId: stationId || null,
        token,
      });
      setCode("");
      setName("");
      setStationId("");
      setToken("");
      setShowCreate(false);
    });
  };

  const handleToken = (e: React.FormEvent, machineId: string) => {
    e.preventDefault();
    run(async () => {
      await regenerateMachineToken(machineId, newToken);
      setNewToken("");
      setTokenFor(null);
    });
  };

  const flaggedCount = discrepancies.filter((d) => d.flagged).length;

  return (
    <>
      <BreadcrumbSetter text="Máquinas" />

      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
            <Cpu size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Máquinas</h1>
            <p className="text-slate-500 text-sm mt-1">
              Recolha automática de produção direto das máquinas &mdash; contagem
              à prova de erro
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
            <Plus size={16} /> Nova Máquina
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
        <Radio size={13} className="text-emerald-500" /> Atualização automática a
        cada 5 segundos
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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">
                Código (ex: PRENSA-01)
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="PRENSA-01"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Prensa Hidráulica 01"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Posto</span>
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              >
                <option value="">— Sem posto —</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">
                Token de acesso (≥ 6 caracteres)
              </span>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="token-secreto"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              Registar Máquina
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {machines.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border bg-white p-4 ${
              m.active ? "border-slate-200" : "border-slate-200 opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-800">{m.name}</h2>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.online
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {m.online ? <Wifi size={11} /> : <WifiOff size={11} />}
                    {m.online ? "Online" : "Offline"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400 font-mono">
                  {m.code} · {m.stationName ?? "sem posto"} ·{" "}
                  {timeAgo(m.lastSeenAt)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setTokenFor((cur) => (cur === m.id ? null : m.id));
                    setNewToken("");
                  }}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  <KeyRound size={14} /> Token
                </button>
                <button
                  type="button"
                  onClick={() => run(() => setMachineActive(m.id, !m.active))}
                  disabled={pending}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60 ${
                    m.active
                      ? "border-slate-200 text-slate-600 hover:bg-slate-50"
                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  {m.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>

            {tokenFor === m.id && (
              <form
                onSubmit={(e) => handleToken(e, m.id)}
                className="mt-3 flex items-end gap-2 rounded-lg bg-slate-50 p-3"
              >
                <label className="block flex-1">
                  <span className="text-xs font-medium text-slate-500">
                    Novo token
                  </span>
                  <input
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                  />
                </label>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  Gerar
                </button>
              </form>
            )}

            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              {m.currentProduct ? (
                <>
                  <p className="text-xs text-slate-500">A produzir</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {m.currentProduct}
                  </p>
                  <div className="mt-2 flex items-center gap-4">
                    <span className="text-2xl font-bold text-emerald-600 tabular-nums">
                      {m.currentQty}
                    </span>
                    <span className="text-xs text-slate-500">
                      conformes
                      {m.currentScrap > 0 && (
                        <span className="ml-2 text-red-500">
                          · {m.currentScrap} sucata
                        </span>
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">Sem produção ativa</p>
              )}
            </div>
          </div>
        ))}
        {machines.length === 0 && (
          <p className="text-sm text-slate-400">
            Ainda não há máquinas registadas.
          </p>
        )}
      </div>

      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert size={18} className="text-slate-700" />
          <h2 className="font-semibold text-slate-800">
            Conferência declarado vs. máquina
          </h2>
          {flaggedCount > 0 && (
            <span className="rounded-full bg-red-50 text-red-700 text-xs font-semibold px-2 py-0.5">
              {flaggedCount} divergência{flaggedCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5 font-medium">Produto</th>
                <th className="px-4 py-2.5 font-medium">Posto</th>
                <th className="px-4 py-2.5 font-medium">Operador</th>
                <th className="px-4 py-2.5 font-medium text-right">Declarado</th>
                <th className="px-4 py-2.5 font-medium text-right">Máquina</th>
                <th className="px-4 py-2.5 font-medium text-right">Δ</th>
              </tr>
            </thead>
            <tbody>
              {discrepancies.map((d) => (
                <tr key={d.stepId} className="border-b border-slate-50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-700">
                      {d.productName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {d.orderReference}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{d.stationName}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {d.operatorName ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                    {d.declaredQty}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-800">
                    {d.machineQty}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {d.flagged ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600 tabular-nums">
                        <ShieldAlert size={12} />
                        {d.delta > 0 ? "+" : ""}
                        {d.delta}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <ShieldCheck size={12} /> ok
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {discrepancies.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-slate-400"
                  >
                    Ainda não há passos verificados por máquina.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
