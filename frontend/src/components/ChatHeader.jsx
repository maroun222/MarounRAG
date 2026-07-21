import { ShieldIcon, TrashIcon } from "./Icons";

export default function ChatHeader({ backendStatus, onClear }) {
  const statusText = {
    checking: "Checking backend",
    online: "Local RAG online",
    offline: "Backend offline",
  }[backendStatus];

  return (
    <header className="border-b border-white/8 bg-[#0a1020]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.12)]">
            <ShieldIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">
              CIS Controls Assistant
            </h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <span
                className={`h-2 w-2 rounded-full ${
                  backendStatus === "online"
                    ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]"
                    : backendStatus === "checking"
                      ? "animate-pulse bg-amber-300"
                      : "bg-rose-400"
                }`}
              />
              <span>{statusText}</span>
              <span className="hidden text-slate-600 sm:inline">•</span>
              <span className="hidden sm:inline">Private · Local · Grounded</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
          aria-label="Clear conversation"
        >
          <TrashIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>
    </header>
  );
}
