import { BotIcon, UserIcon } from "./Icons";

function formatSeconds(value) {
  if (typeof value !== "number") return null;
  if (value < 0.001) return "<1 ms";
  return `${value.toFixed(2)} s`;
}

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const totalTime = formatSeconds(message.meta?.timings?.total);

  return (
    <article className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
          <BotIcon className="h-5 w-5" />
        </div>
      )}

      <div className={`max-w-[88%] sm:max-w-[76%] ${isUser ? "order-first" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-3.5 text-sm leading-6 shadow-lg sm:text-[15px] ${
            isUser
              ? "rounded-br-md bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950 shadow-cyan-950/20"
              : message.error
                ? "rounded-bl-md border border-rose-400/25 bg-rose-400/10 text-rose-100"
                : "rounded-bl-md border border-white/10 bg-white/[0.055] text-slate-200 shadow-black/15"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {!isUser && !message.error && message.meta && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {message.meta.page != null && (
              <span className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-1">
                Source page {message.meta.page}
              </span>
            )}
            {totalTime && (
              <span className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-1">
                {totalTime}
              </span>
            )}
            {message.meta.cacheHit && (
              <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2 py-1 text-emerald-300">
                Cached result
              </span>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-blue-300/20 bg-blue-300/10 text-blue-200">
          <UserIcon className="h-5 w-5" />
        </div>
      )}
    </article>
  );
}
