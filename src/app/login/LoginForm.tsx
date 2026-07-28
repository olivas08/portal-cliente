"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { PRODUCT } from "@/lib/branding";
import { Eye, EyeOff, Info, ShieldCheck } from "lucide-react";
import { loginAction } from "@/actions/auth";

const CLIENT_ACCOUNTS = [
  { company: "Auto Peças Mota", email: "compras@motapecas.pt", password: "mota2026" },
  { company: "Metalúrgica Santos", email: "geral@metalsantos.pt", password: "santos2026" },
  { company: "Plásticos do Norte", email: "encomendas@plasticosnorte.pt", password: "pn2026" },
];

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [showHints, setShowHints] = useState(false);
  const [pending, startTransition] = useTransition();
  const resetOk = searchParams.get("reset") === "ok";

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
          <div className="inline-flex items-center justify-center bg-white rounded-2xl mb-4 p-3 shadow-sm border border-slate-100">
            <Image
              src={PRODUCT.logo}
              alt={PRODUCT.name}
              width={200}
              height={48}
              className="object-contain"
              priority
            />
          </div>
          <p className="text-slate-500 text-sm mt-1">{PRODUCT.modules.portal}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">
            Entrar na sua conta
          </h2>

          {resetOk && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-4">
              Palavra-passe reposta com sucesso. Já pode iniciar sessão.
            </p>
          )}

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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-600">
                  Palavra-passe
                </label>
                <Link
                  href="/esqueci-password"
                  className="text-xs text-slate-500 hover:text-accent-dark transition-colors"
                >
                  Esqueceu-se da password?
                </Link>
              </div>
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
              className="w-full py-2.5 bg-accent text-brand text-sm font-semibold rounded-lg hover:bg-accent-dark transition-colors mt-2 disabled:opacity-60"
            >
              {pending ? "A entrar..." : "Entrar"}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-5">
            Ainda não tem conta?{" "}
            <Link
              href="/registo"
              className="font-medium text-brand hover:text-accent-dark transition-colors"
            >
              Registar a minha empresa
            </Link>
          </p>
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
                  onClick={() => fillAccount("admin@fabrica-demo.pt", "admin2026")}
                  className="w-full text-left bg-slate-800 text-white rounded-lg px-3 py-2.5 hover:bg-slate-700 transition-colors"
                >
                  <p className="text-xs font-semibold">
                    Sofia Alves — Fábrica Demo
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    admin@fabrica-demo.pt · admin2026
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
