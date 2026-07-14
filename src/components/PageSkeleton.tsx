export function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-56 bg-slate-200 rounded-md mb-2" />
      <div className="h-4 w-72 bg-slate-100 rounded-md mb-8" />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 h-24 last:col-span-2 sm:last:col-span-1"
          />
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="h-12 border-b border-slate-100" />
        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 px-5 flex items-center">
              <div className="h-4 w-1/3 bg-slate-100 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
