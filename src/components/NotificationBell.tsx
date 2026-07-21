"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import type { NotificationVM } from "@/lib/types";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}m`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  return new Date(iso).toLocaleDateString("pt-PT");
}

interface Props {
  notifications: NotificationVM[];
  unreadCount: number;
  /** Trigger button classes, so the bell fits both the light and dark bars. */
  triggerClassName?: string;
}

export function NotificationBell({
  notifications,
  unreadCount,
  triggerClassName = "text-slate-500 hover:bg-slate-100",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Poll so notifications triggered elsewhere show up without navigating.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 45000);
    return () => clearInterval(timer);
  }, [router]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleItemClick = (n: NotificationVM) => {
    setOpen(false);
    if (!n.read) {
      startTransition(async () => {
        await markNotificationRead(n.id);
        router.refresh();
      });
    }
  };

  const handleMarkAll = () => {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  };

  const badge = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notificações${unreadCount ? ` (${unreadCount} por ler)` : ""}`}
        className={`relative flex items-center justify-center h-9 w-9 rounded-lg transition-colors ${triggerClassName}`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-accent text-brand text-[10px] font-bold">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[85vw] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">Notificações</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand"
              >
                <CheckCheck size={13} /> Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">
                Sem notificações.
              </p>
            )}
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={n.href}
                onClick={() => handleItemClick(n)}
                className={`block px-4 py-3 transition-colors hover:bg-slate-50 ${
                  n.read ? "" : "bg-amber-50/60"
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                  )}
                  <div className={`min-w-0 ${n.read ? "pl-4" : ""}`}>
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{n.body}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {relativeTime(n.createdAt)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
