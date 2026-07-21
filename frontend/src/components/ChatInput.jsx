import { SendIcon } from "./Icons";

export default function ChatInput({ value, onChange, onSubmit, loading, backendOnline }) {
  const disabled = loading || !backendOnline || !value.trim();

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!disabled) onSubmit();
    }
  }

  return (
    <div className="border-t border-white/8 bg-[#080d19]/90 px-4 py-4 backdrop-blur-xl sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-end gap-3 rounded-2xl border border-white/12 bg-white/[0.055] p-2 shadow-2xl shadow-black/20 transition focus-within:border-cyan-300/35 focus-within:ring-4 focus-within:ring-cyan-300/5">
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={2000}
            placeholder={backendOnline ? "Ask a question about the CIS Controls…" : "Start the backend to begin chatting"}
            disabled={loading || !backendOnline}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed"
            aria-label="Chat message"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-500 text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
            aria-label="Send message"
          >
            <SendIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-slate-600">
          <span>Enter to send · Shift + Enter for a new line</span>
          <span>{value.length}/2000</span>
        </div>
      </div>
    </div>
  );
}
