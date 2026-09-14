"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Warehouse, Route, Search } from "lucide-react";
import type {
  MaterialVM,
  WorkOrderReadinessVM,
  StockMovementVM,
} from "@/lib/types";
import { actionError } from "@/lib/action-result";
import { Alert } from "@/components/ui/Alert";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";
import { releaseWorkOrder } from "@/actions/production";
import { AwaitingReleaseSection } from "@/components/warehouse/AwaitingReleaseSection";
import { MaterialsStockSection } from "@/components/warehouse/MaterialsStockSection";
import { StockMovementsSection } from "@/components/warehouse/StockMovementsSection";

interface Props {
  materials: MaterialVM[];
  awaiting: WorkOrderReadinessVM[];
  movements: StockMovementVM[];
}

export function WarehouseView({ materials, awaiting, movements }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const release = (wo: WorkOrderReadinessVM) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await releaseWorkOrder(wo.id);
        const msg = actionError(res);
        if (msg) {
          setError(msg);
          return;
        }
        setNotice(`Ordem ${wo.reference} lançada para produção.`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocorreu um erro.");
      }
    });
  };

  return (
    <>
      <BreadcrumbSetter text="Armazém" />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <Warehouse size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Armazém</h1>
          <p className="text-sm text-slate-500">
            Controlo de matérias-primas e confirmação de stock antes de lançar
            produção
          </p>
        </div>
        <Link
          href="/admin/armazem/rastreabilidade"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Search size={16} /> Rastreabilidade
        </Link>
        <Link
          href="/admin/armazem/fichas-tecnicas"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Route size={16} /> Fichas técnicas
        </Link>
      </div>

      {error && <Alert className="mb-4">{error}</Alert>}
      {notice && !error && (
        <Alert tone="success" className="mb-4">
          {notice}
        </Alert>
      )}

      <AwaitingReleaseSection
        awaiting={awaiting}
        pending={pending}
        onRelease={release}
      />
      <MaterialsStockSection materials={materials} />
      <StockMovementsSection movements={movements} />
    </>
  );
}
