"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { OrderVM } from "@/lib/types";

type SortKey = "reference" | "description" | "quantity" | "unitPriceEur" | "total";
type SortDir = "asc" | "desc";

function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = activeKey === sortKey;
  const Icon = isActive ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`px-5 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 font-medium hover:text-slate-700 transition-colors ${
          align === "right" ? "ml-auto" : ""
        } ${isActive ? "text-slate-700" : ""}`}
      >
        {align === "right" && (
          <Icon size={12} className={isActive ? "text-slate-700" : "text-slate-300"} />
        )}
        {label}
        {align !== "right" && (
          <Icon size={12} className={isActive ? "text-slate-700" : "text-slate-300"} />
        )}
      </button>
    </th>
  );
}

export function OrderItemsTable({
  order,
  title = "Artigos",
}: {
  order: OrderVM;
  title?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const items = useMemo(() => {
    if (!sortKey) return order.items;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...order.items].sort((a, b) => {
      switch (sortKey) {
        case "reference":
          return a.reference.localeCompare(b.reference) * dir;
        case "description":
          return a.description.localeCompare(b.description) * dir;
        case "quantity":
          return (a.quantity - b.quantity) * dir;
        case "unitPriceEur":
          return (a.unitPriceEur - b.unitPriceEur) * dir;
        case "total":
          return (
            (a.quantity * a.unitPriceEur - b.quantity * b.unitPriceEur) * dir
          );
        default:
          return 0;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.items, sortKey, sortDir]);

  const subtotal = order.items.reduce(
    (s, i) => s + i.quantity * i.unitPriceEur,
    0
  );
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-5">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-500 font-medium">
              <SortableTh
                label="Referência"
                sortKey="reference"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Descrição"
                sortKey="description"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Qtd."
                sortKey="quantity"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <th className="text-center px-5 py-3">Un.</th>
              <SortableTh
                label="P. Unit."
                sortKey="unitPriceEur"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Total"
                sortKey="total"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-500">
                  {item.reference}
                </td>
                <td className="px-5 py-3 text-slate-700">{item.description}</td>
                <td className="px-5 py-3 text-right text-slate-700">
                  {item.quantity}
                </td>
                <td className="px-5 py-3 text-center text-slate-400">
                  {item.unit}
                </td>
                <td className="px-5 py-3 text-right text-slate-500 whitespace-nowrap">
                  {item.unitPriceEur.toFixed(2)} €
                </td>
                <td className="px-5 py-3 text-right font-medium text-slate-700 whitespace-nowrap">
                  {(item.quantity * item.unitPriceEur).toFixed(2)} €
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              <td
                colSpan={5}
                className="px-5 py-3 text-sm font-semibold text-slate-600 text-right"
              >
                Total Estimado (s/ IVA):
              </td>
              <td className="px-5 py-3 text-right font-bold text-brand text-base whitespace-nowrap">
                {subtotal.toFixed(2)} €
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
