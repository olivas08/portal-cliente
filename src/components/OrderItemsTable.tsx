import type { OrderVM } from "@/lib/types";

export function OrderItemsTable({
  order,
  title = "Artigos",
}: {
  order: OrderVM;
  title?: string;
}) {
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
              <th className="text-left px-5 py-3">Referência</th>
              <th className="text-left px-5 py-3">Descrição</th>
              <th className="text-right px-5 py-3">Qtd.</th>
              <th className="text-center px-5 py-3">Un.</th>
              <th className="text-right px-5 py-3">P. Unit.</th>
              <th className="text-right px-5 py-3">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.items.map((item) => (
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
                <td className="px-5 py-3 text-right text-slate-500">
                  {item.unitPriceEur.toFixed(2)} €
                </td>
                <td className="px-5 py-3 text-right font-medium text-slate-700">
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
                Subtotal (s/ IVA):
              </td>
              <td className="px-5 py-3 text-right font-bold text-slate-800">
                {subtotal.toFixed(2)} €
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
