import { SparkIcon } from "./Icons";

const suggestions = [
  "How often should DHCP logs update the enterprise asset inventory?",
  "How should unauthorized enterprise assets be handled?",
  "What information must the enterprise asset inventory contain?",
];

export default function SuggestionCards({ onSelect, disabled }) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center py-10 text-center sm:py-16">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300 shadow-[0_0_40px_rgba(34,211,238,.1)]">
        <SparkIcon className="h-7 w-7" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Ask about the CIS Controls
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
        Answers are retrieved from your locally indexed CIS Controls document and include the selected source page.
      </p>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion)}
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left text-sm leading-5 text-slate-300 transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}
