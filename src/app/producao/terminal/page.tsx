import Link from "next/link";
import { Factory, ChevronRight } from "lucide-react";
import { getOperator } from "@/lib/operator-session";
import {
  getActiveOperators,
  getWorkstationsWithQueue,
  getTerminalQueue,
} from "@/lib/data";
import { OperatorLogin } from "@/components/OperatorLogin";
import { TerminalQueue } from "@/components/TerminalQueue";
import { OperatorLogoutButton } from "@/components/OperatorLogoutButton";

export const dynamic = "force-dynamic";

export default async function TerminalPage({
  searchParams,
}: {
  searchParams: Promise<{ posto?: string }>;
}) {
  const operator = await getOperator();

  if (!operator) {
    const operators = await getActiveOperators();
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <OperatorLogin operators={operators} />
      </main>
    );
  }

  const { posto } = await searchParams;

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-5 py-4 flex items-center justify-between">
        <Link href="/producao/terminal" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
            <Factory size={18} className="text-slate-900" />
          </div>
          <div>
            <p className="font-bold leading-tight">Terminal de Produção</p>
            <p className="text-xs text-slate-400">{operator.name}</p>
          </div>
        </Link>
        <OperatorLogoutButton />
      </header>

      {posto ? (
        <StationView workstationId={posto} operatorName={operator.name} />
      ) : (
        <StationPicker />
      )}
    </main>
  );
}

async function StationPicker() {
  const workstations = await getWorkstationsWithQueue();

  return (
    <div className="max-w-2xl mx-auto p-5">
      <h1 className="text-lg font-semibold mb-1">Escolha o posto de trabalho</h1>
      <p className="text-sm text-slate-400 mb-5">
        Toque no posto onde vai trabalhar.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {workstations.map((ws) => (
          <Link
            key={ws.id}
            href={`/producao/terminal?posto=${ws.id}`}
            className="flex items-center justify-between gap-3 rounded-xl bg-slate-800 border border-slate-700 px-5 py-4 hover:border-amber-500 transition-colors"
          >
            <div>
              <p className="font-semibold">{ws.name}</p>
              <p className="text-xs text-slate-400">{ws.code}</p>
            </div>
            <div className="flex items-center gap-2">
              {ws.queueCount > 0 && (
                <span className="text-xs font-bold bg-amber-500 text-slate-900 rounded-full px-2 py-0.5">
                  {ws.queueCount}
                </span>
              )}
              <ChevronRight size={18} className="text-slate-500" />
            </div>
          </Link>
        ))}
        {workstations.length === 0 && (
          <p className="text-sm text-slate-400">Sem postos configurados.</p>
        )}
      </div>
    </div>
  );
}

async function StationView({
  workstationId,
  operatorName,
}: {
  workstationId: string;
  operatorName: string;
}) {
  const [workstations, queue] = await Promise.all([
    getWorkstationsWithQueue(),
    getTerminalQueue(workstationId),
  ]);
  const station = workstations.find((w) => w.id === workstationId);

  return (
    <div className="max-w-2xl mx-auto p-5">
      <Link
        href="/producao/terminal"
        className="text-sm text-slate-400 hover:text-slate-200 mb-4 inline-block"
      >
        ← Mudar de posto
      </Link>
      <h1 className="text-lg font-semibold mb-4">
        {station?.name ?? "Posto"}
        <span className="text-slate-500 font-normal"> · Fila de trabalho</span>
      </h1>
      <TerminalQueue queue={queue} operatorName={operatorName} />
    </div>
  );
}
