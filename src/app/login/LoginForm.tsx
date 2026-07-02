"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Factory, Eye, EyeOff, Info, ShieldCheck } from "lucide-react";
import { loginAction } from "@/actions/auth";

const CLIENT_ACCOUNTS = [
  { company: "Auto Peças Mota", email: "compras@motapecas.pt", password: "mota2026" },
  { company: "Metalúrgica Santos", email: "geral@metalsantos.pt", password: "santos2026" },
  { company: "Plásticos do Norte", email: "encomendas@plasticosnorte.pt", password: "pn2026" },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [showHints, setShowHints] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await loginAction(email.trim(), password);
      if (result === "ok") {
        router.push("/");
        router.refresh();
      } else if (result === "invalid") {
        setError("Email ou palavra-passe incorretos.");
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
    });
  };

  const fillAccount = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4 w-full">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-800 rounded-2xl mb-4">
            <Factory size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Metalofabril</h1>
          <p className="text-slate-500 text-sm mt-1">Portal do Cliente</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">
            Entrar na sua conta
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="o.seu@email.pt"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Palavra-passe
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors mt-2 disabled:opacity-60"
            >
              {pending ? "A entrar..." : "Entrar"}
            </button>
          </form>
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowHints(!showHints)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Info size={14} /> Contas de demonstração
            </div>
            <span className="text-blue-400">{showHints ? "▲" : "▼"}</span>
          </button>

          {showHints && (
            <div className="px-4 pb-3 space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck size={12} /> Administração (fábrica)
                </p>
                <button
                  onClick={() => fillAccount("admin@metalofabril.pt", "admin2026")}
                  className="w-full text-left bg-slate-800 text-white rounded-lg px-3 py-2.5 hover:bg-slate-700 transition-colors"
                >
                  <p className="text-xs font-semibold">
                    Sofia Alves — Metalofabril
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    admin@metalofabril.pt · admin2026
                  </p>
                </button>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Clientes
                </p>
                <div className="space-y-1.5">
                  {CLIENT_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      onClick={() => fillAccount(acc.email, acc.password)}
                      className="w-full text-left bg-white border border-blue-100 rounded-lg px-3 py-2.5 hover:border-blue-300 transition-colors"
                    >
                      <p className="text-xs font-semibold text-slate-700">
                        {acc.company}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {acc.email} · {acc.password}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
