"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthBrand } from "@/components/AuthBrand";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { registerAction } from "@/actions/auth";

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: "",
    name: "",
    email: "",
    password: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const inputCls =
    "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await registerAction(form);
      if (result.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4 w-full">
      <div className="w-full max-w-md">
        <AuthBrand />

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">
            Registar a sua empresa
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Nome da empresa
              </label>
              <input
                required
                value={form.companyName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, companyName: e.target.value }))
                }
                className={inputCls}
                placeholder="Ex: Auto Peças Mota, Lda."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                O seu nome
              </label>
              <input
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className={inputCls}
                placeholder="Ex: Jorge Mota"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                className={inputCls}
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
                  minLength={6}
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className={inputCls + " pr-10"}
                  placeholder="Mínimo 6 caracteres"
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
              {pending ? "A criar conta..." : "Criar conta"}
            </button>
          </form>

          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors mt-5"
          >
            <ArrowLeft size={13} /> Já tem conta? Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
