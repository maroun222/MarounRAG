import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  BotIcon,
  UserIcon,
} from "./Icons";


function formatSeconds(value) {
  if (typeof value !== "number") {
    return null;
  }

  if (value < 0.001) {
    return "<1 ms";
  }

  return `${value.toFixed(2)} s`;
}


function formatLabel(value) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}


function getCitationId(source) {
  return (
    source?.citation_id ??
    source?.citationId ??
    null
  );
}


function addCitationLinks(content) {
  return (content || "").replace(
    /\[(\d+)\]/g,
    "[$1](#citation-$1)",
  );
}


function CitationReference({
  citationId,
  source,
}) {
  const documentName =
    source?.document || "Source";

  const page =
    source?.page != null
      ? `Page ${source.page}`
      : "Page unavailable";

  const snippet =
    source?.snippet ||
    "Source details are unavailable.";

  return (
    <span className="group relative mx-0.5 inline-flex align-baseline">
      <button
        type="button"
        className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-1.5 py-0.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/15 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
        aria-label={`Citation ${citationId}: ${documentName}, ${page}`}
      >
        [{citationId}]
      </button>

      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-2 w-72 -translate-x-1/2 rounded-xl border border-white/10 bg-[#101827] p-3 text-left text-xs leading-5 text-slate-300 opacity-0 shadow-2xl shadow-black/40 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        <span className="block font-semibold text-white">
          {documentName}
        </span>

        <span className="mb-2 block text-cyan-300">
          {page}
        </span>

        <span className="block text-slate-400">
          {snippet}
        </span>
      </span>
    </span>
  );
}


function SourceCards({ sources }) {
  if (!sources.length) {
    return null;
  }

  return (
    <section
      className="mt-3 space-y-2"
      aria-label="Answer sources"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Sources
      </p>

      {sources.map((source, index) => {
        const citationId =
          getCitationId(source) ??
          index + 1;

        return (
          <article
            id={`citation-${citationId}`}
            key={`${citationId}-${source.page}-${index}`}
            className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.045] p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-1.5 py-0.5 text-[11px] font-semibold text-cyan-200">
                [{citationId}]
              </span>

              <span className="text-xs font-medium text-slate-200">
                {source.document ||
                  "Unknown document"}
              </span>

              {source.page != null && (
                <span className="text-xs text-slate-500">
                  Page {source.page}
                </span>
              )}
            </div>

            {source.snippet && (
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">
                {source.snippet}
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}


function MetadataPanel({ meta }) {
  const retrievalContext =
    meta?.retrievalContext ?? [];

  const timings = Object.entries(
    meta?.timings ?? {},
  );

  const hasMetadata =
    Boolean(meta?.context) ||
    retrievalContext.length > 0 ||
    timings.length > 0;

  if (!hasMetadata) {
    return null;
  }

  return (
    <details className="mt-3 rounded-xl border border-white/8 bg-black/15">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-slate-400 transition hover:text-slate-200">
        View retrieval metadata
      </summary>

      <div className="space-y-4 border-t border-white/8 px-3 py-3">
        {meta?.context && (
          <section>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Selected passage
            </h4>

            <p className="whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-xs leading-5 text-slate-400">
              {meta.context}
            </p>
          </section>
        )}

        {retrievalContext.length > 0 && (
          <section>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Retrieved passages
            </h4>

            <div className="space-y-2">
              {retrievalContext.map(
                (passage, index) => (
                  <div
                    key={`${index}-${passage.slice(
                      0,
                      30,
                    )}`}
                    className="rounded-lg border border-white/8 bg-black/15 p-3"
                  >
                    <p className="mb-1 text-[11px] font-medium text-slate-500">
                      Result {index + 1}
                    </p>

                    <p className="whitespace-pre-wrap text-xs leading-5 text-slate-400">
                      {passage}
                    </p>
                  </div>
                ),
              )}
            </div>
          </section>
        )}

        {timings.length > 0 && (
          <section>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Processing timings
            </h4>

            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {timings.map(
                ([name, value]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-4 rounded-lg bg-black/15 px-3 py-2 text-xs"
                  >
                    <dt className="text-slate-500">
                      {formatLabel(name)}
                    </dt>

                    <dd className="font-medium text-slate-300">
                      {formatSeconds(value)}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </section>
        )}
      </div>
    </details>
  );
}


export default function ChatMessage({
  message,
  streaming = false,
}) {
  const isUser =
    message.role === "user";

  const sources =
    message.meta?.sources ?? [];

  const totalTime =
    formatSeconds(
      message.meta?.timings?.total,
    );

  const markdownContent =
    addCitationLinks(
      message.content || "",
    );

  return (
    <article
      className={`flex gap-3 ${
        isUser
          ? "justify-end"
          : "justify-start"
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
            <p className="whitespace-pre-wrap">
              {message.content}
            </p>
          ) : (
            <>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p className="mb-3 last:mb-0">
                      {children}
                    </p>
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
                    <li className="pl-1">
                      {children}
                    </li>
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

                  blockquote: ({
                    children,
                  }) => (
                    <blockquote className="mb-3 border-l-2 border-cyan-300/40 pl-3 italic text-slate-400">
                      {children}
                    </blockquote>
                  ),

                  a: ({
                    children,
                    href,
                  }) => {
                    const citationMatch =
                      href?.match(
                        /^#citation-(\d+)$/,
                      );

                    if (citationMatch) {
                      const citationId =
                        Number(
                          citationMatch[1],
                        );

                      const source =
                        sources.find(
                          (item) =>
                            getCitationId(
                              item,
                            ) ===
                            citationId,
                        );

                      return (
                        <CitationReference
                          citationId={
                            citationId
                          }
                          source={source}
                        />
                      );
                    }

                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
                      >
                        {children}
                      </a>
                    );
                  },

                  code: ({
                    children,
                    className,
                  }) => {
                    const isCodeBlock =
                      Boolean(className);

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

                  table: ({
                    children,
                  }) => (
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

                  hr: () => (
                    <hr className="my-4 border-white/10" />
                  ),
                }}
              >
                {markdownContent}
              </ReactMarkdown>

              {streaming && (
                <span
                  className="ml-1 inline-block h-4 w-1 animate-pulse bg-cyan-300 align-middle"
                  aria-label="Generating answer"
                />
              )}
            </>
          )}
        </div>

        {!isUser &&
          !message.error && (
            <>
              <SourceCards
                sources={sources}
              />

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                {message.meta?.page !=
                  null && (
                  <span className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-1">
                    Source page{" "}
                    {message.meta.page}
                  </span>
                )}

                {totalTime && (
                  <span className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-1">
                    {totalTime}
                  </span>
                )}

                {message.meta
                  ?.cacheHit && (
                  <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2 py-1 text-emerald-300">
                    Cached result
                  </span>
                )}
              </div>

              <MetadataPanel
                meta={message.meta}
              />
            </>
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