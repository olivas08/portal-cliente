"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, MailCheck } from "lucide-react";
import { PRODUCT } from "@/lib/branding";
import { requestPasswordReset } from "@/actions/auth";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await requestPasswordReset(email.trim());
      setSent(true);
    });
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
          <h2 className="text-lg font-semibold text-slate-800 mb-2">
            Esqueceu-se da password?
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Indique o seu email e enviaremos um link para repor a
            palavra-passe.
          </p>

          {sent ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <MailCheck size={22} className="text-emerald-600" />
              </div>
              <p className="text-sm text-slate-600">
                Se existir uma conta com o email <strong>{email}</strong>,
                receberá em breve um email com instruções para repor a
                palavra-passe.
              </p>
            </div>
          ) : (
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

              <button
                type="submit"
                disabled={pending}
                className="w-full py-2.5 bg-accent text-brand text-sm font-semibold rounded-lg hover:bg-accent-dark transition-colors mt-2 disabled:opacity-60"
              >
                {pending ? "A enviar..." : "Enviar link de reposição"}
              </button>
            </form>
          )}

          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors mt-5"
          >
            <ArrowLeft size={13} /> Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
