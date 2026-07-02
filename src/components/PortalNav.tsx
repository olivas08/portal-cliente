"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Factory, LogOut, ChevronRight, ShieldCheck } from "lucide-react";
import { logoutAction } from "@/actions/auth";

interface Props {
  name: string;
  company: string;
  isAdmin: boolean;
  breadcrumb?: string;
}

export function PortalNav({ name, company, isAdmin, breadcrumb }: Props) {
  const pathname = usePathname();

  const navLinks = isAdmin
    ? [
        { to: "/admin", label: "Encomendas" },
        { to: "/admin/requerimentos", label: "Requerimentos" },
      ]
    : [
        { to: "/dashboard", label: "Encomendas" },
        { to: "/dashboard/requerimentos", label: "Requerimentos" },
      ];

  const isActive = (to: string) => {
    // Exact match, or nested path — but avoid /admin matching /admin/requerimentos
    if (pathname === to) return true;
    if (to === "/admin" || to === "/dashboard") {
      return (
        pathname.startsWith(`${to}/ordens`) || pathname === to
      );
    }
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="bg-slate-800 p-1.5 rounded-lg flex-shrink-0">
              <Factory size={16} className="text-white" />
            </div>
            <span className="font-bold text-slate-800 text-sm hidden sm:block">
              Metalofabril
            </span>
            <span className="text-slate-300 hidden sm:block">|</span>
            <span className="text-sm text-slate-500 hidden sm:block">
              {isAdmin ? "Administração" : "Portal do Cliente"}
            </span>
            {breadcrumb && (
              <>
                <ChevronRight
                  size={14}
                  className="text-slate-300 flex-shrink-0"
                />
                <span className="text-sm text-slate-600 font-medium truncate">
                  {breadcrumb}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <div className="flex items-center justify-end gap-1">
                {isAdmin && (
                  <ShieldCheck size={12} className="text-slate-500" />
                )}
                <p className="text-xs font-semibold text-slate-700 leading-none">
                  {name}
                </p>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{company}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <LogOut size={13} /> Sair
              </button>
            </form>
          </div>
        </div>

        <div className="flex gap-1 -mb-px">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              href={to}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive(to)
                  ? "border-slate-800 text-slate-800"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
