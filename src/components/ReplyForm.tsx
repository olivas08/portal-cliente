"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { addRequestMessage } from "@/actions/requests";

export function ReplyForm({
  requestId,
  placeholder,
  buttonLabel,
}: {
  requestId: string;
  placeholder: string;
  buttonLabel: string;
}) {
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const text = reply.trim();
    if (!text || pending) return;
    startTransition(async () => {
      await addRequestMessage(requestId, text);
      setReply("");
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="bg-white rounded-xl shadow-sm p-4 flex gap-3 items-end"
    >
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
      />
      <button
        type="submit"
        disabled={!reply.trim() || pending}
        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
      >
        <Send size={14} /> {buttonLabel}
      </button>
    </form>
  );
}
