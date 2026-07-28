"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, Package, MessageSquare, ShieldCheck, BarChart3, ShoppingCart, Boxes, Factory, HardHat } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { PRODUCT } from "@/lib/branding";
import { useBreadcrumb } from "@/components/BreadcrumbContext";
import { NotificationBell } from "@/components/NotificationBell";
import type { NotificationVM } from "@/lib/types";

interface Props {
  name: string;
  company: string;
  isAdmin: boolean;
  notifications: NotificationVM[];
  unreadCount: number;
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export function PortalNav({ name, company, isAdmin, notifications, unreadCount }: Props) {
  const pathname = usePathname();
  const breadcrumb = useBreadcrumb();
  const base = isAdmin ? "/admin" : "/dashboard";

  const navLinks: NavItem[] = [
    { to: base, label: "Encomendas", icon: Package },
    ...(isAdmin
      ? [{ to: "/admin/produtos", label: "Produtos", icon: Boxes }]
      : [{ to: "/dashboard/catalogo", label: "Catálogo", icon: ShoppingCart }]),
    ...(isAdmin
      ? [{ to: "/admin/producao", label: "Produção", icon: Factory }]
      : []),
    ...(isAdmin
      ? [{ to: "/admin/operadores", label: "Trabalhadores", icon: HardHat }]
      : []),
    { to: `${base}/requerimentos`, label: "Requerimentos", icon: MessageSquare },
    ...(isAdmin
      ? [{ to: "/admin/kpis", label: "Desempenho", icon: BarChart3 }]
      : []),
  ];

  const isActive = (to: string) => {
    if (pathname === to) return true;
    if (to === base) {
      return pathname === base || pathname.startsWith(`${base}/ordens`);
    }
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-brand text-slate-300 z-30">
        <div className="relative flex flex-col items-center justify-center gap-1 px-5 py-3 border-b border-brand-line/50 bg-white">
          <div className="absolute top-2 right-2">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              triggerClassName="text-slate-500 hover:bg-slate-100"
              align="left"
            />
          </div>
          <Image
            src={PRODUCT.logo}
            alt={PRODUCT.name}
            width={140}
            height={38}
            className="object-contain"
            priority
          />
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide leading-none">
            {isAdmin ? "Core" : "Portal"}
          </p>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {navLinks.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                href={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors border-l-2 ${
                  active
                    ? "bg-accent text-brand border-accent"
                    : "border-transparent text-slate-400 hover:text-white hover:bg-brand-soft/60"
                }`}
              >
                <Icon size={18} className={active ? "text-brand" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-brand-line/50 p-4">
          <div className="flex items-center gap-1 mb-1">
            {isAdmin && <ShieldCheck size={12} className="text-accent" />}
            <p className="text-xs font-semibold text-white truncate">{name}</p>
          </div>
          <p className="text-[11px] text-slate-400 truncate mb-3">{company}</p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 border border-brand-line rounded-lg hover:bg-brand-soft hover:text-white transition-colors"
            >
              <LogOut size={13} /> Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-brand text-white">
        <div className="h-14 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-white rounded-md p-1 flex-shrink-0">
              <Image
                src={PRODUCT.logo}
                alt={PRODUCT.name}
                width={90}
                height={21}
                className="object-contain"
              />
            </div>
            <span className="font-bold text-sm truncate">
              {breadcrumb ?? PRODUCT.name}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              triggerClassName="text-white hover:bg-brand-soft"
            />
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 border border-brand-line rounded-lg"
              >
                <LogOut size={13} /> Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 h-16 flex">
        {navLinks.map(({ to, label, icon: Icon }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              href={to}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                active ? "text-accent-dark" : "text-slate-400"
              }`}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
