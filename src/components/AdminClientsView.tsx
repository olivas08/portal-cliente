"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Mail, UserPlus } from "lucide-react";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";
import { Button } from "@/components/ui/Button";
import { ROLE_LABELS, type ClientRole } from "@/lib/roles";
import type { ClientCompanyVM } from "@/lib/types";

type InviteResult = { ok: true } | { ok: false; error: string };

interface Props {
  companies: ClientCompanyVM[];
  onOnboard: (input: {
    companyName: string;
    contactName: string;
    email: string;
  }) => Promise<InviteResult>;
  onInviteUser: (input: {
    companyId: string;
    name: string;
    email: string;
    role: ClientRole;
  }) => Promise<InviteResult>;
}

export function AdminClientsView({ companies, onOnboard, onInviteUser }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showOnboard, setShowOnboard] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ClientRole>("CLIENT_USER");

  const handleOnboard = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await onOnboard({ companyName, contactName, email });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCompanyName("");
      setContactName("");
      setEmail("");
      setShowOnboard(false);
      router.refresh();
    });
  };

  const handleInvite = (e: React.FormEvent, companyId: string) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await onInviteUser({
        companyId,
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setInviteName("");
      setInviteEmail("");
      setInviteRole("CLIENT_USER");
      setInviteFor(null);
      router.refresh();
    });
  };

  return (
    <>
      <BreadcrumbSetter text="Clientes" />

      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
            <p className="text-slate-500 text-sm mt-1">
              Criar a empresa e enviar o convite para o portal
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => setShowOnboard((v) => !v)}
        >
          <UserPlus size={16} /> Novo cliente
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showOnboard && (
        <form
          onSubmit={handleOnboard}
          className="mb-6 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold">
            <Mail size={18} /> Novo cliente por convite
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-3">
              <span className="text-xs font-medium text-slate-500">Empresa</span>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Metalúrgica Silva, Lda."
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Nome do contacto</span>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ex: Ana Silva"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-500">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: ana@silva.pt"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Cria a empresa e envia um email para o contacto definir a palavra-passe
            (administrador da empresa no portal).
          </p>
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={pending}>
              Enviar convite
            </Button>
          </div>
        </form>
      )}

      <div className="grid gap-4">
        {companies.map((company) => (
          <div
            key={company.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-semibold text-slate-800">{company.name}</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {company.users.length === 1
                    ? "1 utilizador"
                    : `${company.users.length} utilizadores`}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setInviteFor((id) => (id === company.id ? null : company.id))
                }
              >
                <UserPlus size={14} /> Convidar utilizador
              </Button>
            </div>

            {company.users.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100">
                {company.users.map((u) => (
                  <li
                    key={u.id}
                    className="py-2 flex items-center justify-between gap-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-700">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-slate-500">
                        {ROLE_LABELS[u.role]}
                      </p>
                      <p
                        className={`text-xs ${
                          u.active ? "text-emerald-700" : "text-slate-400"
                        }`}
                      >
                        {u.active ? "Ativo" : "Convite pendente"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {inviteFor === company.id && (
              <form
                onSubmit={(e) => handleInvite(e, company.id)}
                className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 grid gap-3 sm:grid-cols-3"
              >
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Nome</span>
                  <input
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Ex: Rui Costa"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Email</span>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Ex: rui@empresa.pt"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Função</span>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as ClientRole)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                  >
                    <option value="CLIENT_USER">{ROLE_LABELS.CLIENT_USER}</option>
                    <option value="CLIENT">{ROLE_LABELS.CLIENT}</option>
                  </select>
                </label>
                <div className="sm:col-span-3 flex justify-end">
                  <Button type="submit" size="sm" disabled={pending}>
                    Enviar convite
                  </Button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>

      {companies.length === 0 && !showOnboard && (
        <p className="mt-8 text-center text-sm text-slate-400">
          Ainda não há clientes. Crie o primeiro com «Novo cliente».
        </p>
      )}
    </>
  );
}
