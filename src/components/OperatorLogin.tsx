"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Factory, Delete } from "lucide-react";
import { operatorLogin } from "@/actions/production";
import { actionError } from "@/lib/action-result";
import { PRODUCT } from "@/lib/branding";

interface Props {
  operators: { id: string; name: string }[];
}

const PAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function OperatorLogin({ operators }: Props) {
  const router = useRouter();
  const [operatorId, setOperatorId] = useState(operators[0]?.id ?? "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!operatorId || pin.length < 4 || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await operatorLogin({ operatorId, pin });
        const msg = actionError(res);
        if (msg) {
          setError(msg);
          setPin("");
          return;
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao entrar.");
        setPin("");
      }
    });
  };

  const press = (digit: string) => setPin((p) => (p.length < 12 ? p + digit : p));

  return (
    <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl">
      <div className="flex flex-col items-center mb-5">
        <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center mb-3">
          <Factory size={22} className="text-slate-900" />
        </div>
        <h1 className="font-bold text-lg">{PRODUCT.modules.station}</h1>
        <p className="text-sm text-slate-400">Identifique-se para começar</p>
      </div>

      <label className="block text-xs text-slate-400 mb-1.5">Operador</label>
      <select
        value={operatorId}
        onChange={(e) => setOperatorId(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        {operators.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
        {operators.length === 0 && <option value="">Sem operadores</option>}
      </select>

      <div className="flex justify-center gap-2 mb-4" aria-label="PIN">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full border-2 ${
              i < pin.length
                ? "bg-amber-500 border-amber-500"
                : "border-slate-600"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PAD.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            className="py-3.5 rounded-lg bg-slate-700 text-lg font-semibold hover:bg-slate-600"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPin("")}
          className="py-3.5 rounded-lg bg-slate-700/50 text-sm hover:bg-slate-600"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => press("0")}
          className="py-3.5 rounded-lg bg-slate-700 text-lg font-semibold hover:bg-slate-600"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => setPin((p) => p.slice(0, -1))}
          className="py-3.5 rounded-lg bg-slate-700/50 flex items-center justify-center hover:bg-slate-600"
          aria-label="Apagar"
        >
          <Delete size={18} />
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 text-center mt-4">{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending || pin.length < 4 || !operatorId}
        className="w-full mt-4 rounded-lg bg-amber-500 text-slate-900 font-bold py-3 hover:bg-amber-400 disabled:opacity-50"
      >
        {pending ? "A entrar…" : "Entrar"}
      </button>
    </div>
  );
}
