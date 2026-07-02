import type { RequestMessageVM } from "@/lib/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageThread({
  messages,
  perspective,
}: {
  messages: RequestMessageVM[];
  perspective: "admin" | "client";
}) {
  return (
    <div className="space-y-3 mb-5">
      {messages.map((msg) => {
        const isClient = msg.from === "client";
        // "own" messages sit on the right side.
        const own = perspective === "client" ? isClient : !isClient;
        return (
          <div
            key={msg.id}
            className={`flex ${own ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                own
                  ? "bg-slate-800 text-white rounded-br-sm"
                  : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm"
              }`}
            >
              <div
                className={`flex items-center gap-2 mb-1.5 text-xs font-semibold ${
                  own ? "text-slate-300" : "text-slate-500"
                }`}
              >
                <span>{msg.authorName}</span>
                <span className="font-normal opacity-70">
                  {fmtDate(msg.date)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {msg.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
