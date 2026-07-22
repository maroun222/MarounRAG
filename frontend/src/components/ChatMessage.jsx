import { BotIcon, UserIcon } from "./Icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function formatSeconds(value) {
  if (typeof value !== "number") return null;
  if (value < 0.001) return "<1 ms";
  return `${value.toFixed(2)} s`;
}

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const totalTime = formatSeconds(message.meta?.timings?.total);

  return (
    <article
      className={`flex gap-3 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && (
        <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
          <BotIcon className="h-5 w-5" />
        </div>
      )}

      <div
        className={`max-w-[88%] sm:max-w-[76%] ${
          isUser ? "order-first" : ""
        }`}
      >
        <div
          className={`rounded-2xl px-4 py-3.5 text-sm leading-6 shadow-lg sm:text-[15px] ${
            isUser
              ? "rounded-br-md bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950 shadow-cyan-950/20"
              : message.error
                ? "rounded-bl-md border border-rose-400/25 bg-rose-400/10 text-rose-100"
                : "rounded-bl-md border border-white/10 bg-white/[0.055] text-slate-200 shadow-black/15"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-3 last:mb-0">{children}</p>
                ),

                ul: ({ children }) => (
                  <ul className="mb-3 list-disc space-y-1 pl-5">
                    {children}
                  </ul>
                ),

                ol: ({ children }) => (
                  <ol className="mb-3 list-decimal space-y-1 pl-5">
                    {children}
                  </ol>
                ),

                li: ({ children }) => (
                  <li className="pl-1">{children}</li>
                ),

                strong: ({ children }) => (
                  <strong className="font-semibold text-white">
                    {children}
                  </strong>
                ),

                h1: ({ children }) => (
                  <h1 className="mb-3 mt-4 text-lg font-semibold text-white first:mt-0">
                    {children}
                  </h1>
                ),

                h2: ({ children }) => (
                  <h2 className="mb-2 mt-4 text-base font-semibold text-white first:mt-0">
                    {children}
                  </h2>
                ),

                h3: ({ children }) => (
                  <h3 className="mb-2 mt-3 font-semibold text-white first:mt-0">
                    {children}
                  </h3>
                ),

                blockquote: ({ children }) => (
                  <blockquote className="mb-3 border-l-2 border-cyan-300/40 pl-3 italic text-slate-400">
                    {children}
                  </blockquote>
                ),

                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
                  >
                    {children}
                  </a>
                ),

                code: ({ children, className }) => {
                  const isCodeBlock = Boolean(className);

                  return isCodeBlock ? (
                    <code className="block font-mono text-xs text-slate-200">
                      {children}
                    </code>
                  ) : (
                    <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs text-cyan-200">
                      {children}
                    </code>
                  );
                },

                pre: ({ children }) => (
                  <pre className="mb-3 overflow-x-auto rounded-xl border border-white/10 bg-black/35 p-4">
                    {children}
                  </pre>
                ),

                table: ({ children }) => (
                  <div className="mb-3 overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full border-collapse text-left text-sm">
                      {children}
                    </table>
                  </div>
                ),

                th: ({ children }) => (
                  <th className="border-b border-r border-white/10 bg-white/[0.05] px-3 py-2 font-semibold text-white last:border-r-0">
                    {children}
                  </th>
                ),

                td: ({ children }) => (
                  <td className="border-b border-r border-white/10 px-3 py-2 last:border-r-0">
                    {children}
                  </td>
                ),

                hr: () => <hr className="my-4 border-white/10" />,
              }}
            >
              {message.content || ""}
            </ReactMarkdown>
          )}
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