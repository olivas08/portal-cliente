"use client";

import Link from "next/link";
import { AuthBrand } from "@/components/AuthBrand";
import { ArrowLeft, Mail } from "lucide-react";

/**
 * Public self-registration is closed: this is a single-factory deployment,
 * and new client companies are created by invitation from the factory
 * (`inviteUser` in users.service). The `/registo` route stays so old
 * bookmarks don't 404.
 */
export function RegisterForm() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4 w-full">
      <div className="w-full max-w-md">
        <AuthBrand />

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">
            Registo por convite
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            O acesso ao portal é concedido pela fábrica. Se a sua empresa já é
            cliente, peça a um administrador que envie o convite para o seu
            email — recebe um link para definir a palavra-passe.
          </p>
          <p className="text-sm text-slate-500 mt-3 flex items-start gap-2">
            <Mail size={16} className="mt-0.5 shrink-0" />
            Ainda não é cliente? Contacte a fábrica para abrir conta.
          </p>

          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors mt-6"
          >
            <ArrowLeft size={13} /> Já tem conta? Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
