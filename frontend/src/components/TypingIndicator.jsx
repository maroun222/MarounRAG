import { BotIcon } from "./Icons";

export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3" aria-label="Assistant is generating an answer">
      <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
        <BotIcon className="h-5 w-5" />
      </div>
      <div className="flex h-12 items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.055] px-4">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="h-2 w-2 animate-bounce rounded-full bg-cyan-300"
            style={{ animationDelay: `${dot * 130}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
