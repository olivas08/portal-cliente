"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Mail, ShieldCheck } from "lucide-react";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";
import { ROLE_LABELS, type AdminRole, type Role } from "@/lib/roles";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: Date | string;
}

type InviteResult = { ok: true } | { ok: false; error: string };

interface Props {
  title: string;
  subtitle: string;
  currentUserId: string;
  users: UserRow[];
  /** Only the admin (factory) variant shows a role picker; the company
   * variant always invites plain "CLIENT_USER" accounts. */
  roleOptions?: AdminRole[];
  onInvite: (input: { name: string; email: string; role?: AdminRole }) => Promise<InviteResult>;
  onToggleActive: (userId: string, active: boolean) => Promise<void>;
}

export function UsersManagementView({
  title,
  subtitle,
  currentUserId,
  users,
  roleOptions,
  onInvite,
  onToggleActive,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>(roleOptions?.[0] ?? "ADMIN");

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await onInvite({
        name,
        email,
        role: roleOptions ? role : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      setEmail("");
      setShowInvite(false);
      router.refresh();
    });
  };

  const toggle = (userId: string, active: boolean) => {
    setError("");
    startTransition(async () => {
      try {
        await onToggleActive(userId, active);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ocorreu um erro. Tente novamente.");
      }
    });
  };

  return (
    <>
      <BreadcrumbSetter text="Utilizadores" />

      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
            <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <UserPlus size={16} /> Convidar Utilizador
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showInvite && (
        <form
          onSubmit={handleInvite}
          className="mb-6 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold">
            <Mail size={18} /> Convidar por Email
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Maria Costa"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: maria@empresa.pt"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            {roleOptions && (
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-slate-500">Função</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AdminRole)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            A pessoa recebe um email com um link para definir a própria palavra-passe.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              Enviar Convite
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {users.map((u) => (
          <div
            key={u.id}
            className={`rounded-xl border bg-white p-4 ${
              u.active ? "border-slate-200" : "border-slate-200 opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-800">{u.name}</h2>
                  {u.id === currentUserId && (
                    <ShieldCheck size={14} className="text-accent-dark" />
                  )}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        u.active ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                    {u.active ? "Ativo" : "Convite pendente / inativo"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{u.email}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {ROLE_LABELS[u.role]}
                </p>
              </div>
              {u.id !== currentUserId && (
                <button
                  type="button"
                  onClick={() => toggle(u.id, !u.active)}
                  disabled={pending}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60 ${
                    u.active
                      ? "border-slate-200 text-slate-600 hover:bg-slate-50"
                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  {u.active ? "Desativar" : "Reativar"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <p className="mt-8 text-center text-sm text-slate-400">
          Ainda não há outros utilizadores. Convide o primeiro acima.
        </p>
      )}
    </>
  );
}
