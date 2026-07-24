import {
  useEffect,
  useState,
} from "react";


const TOUR_STORAGE_KEY =
  "cis-rag-guided-tour-completed";


const TOUR_STEPS = [
  {
    title:
      "Welcome to the CIS Controls Assistant",

    description:
      "This application answers questions using the indexed CIS Controls document. Answers are generated locally and grounded in retrieved passages.",

    details: [
      "Local RAG processing",
      "Streamed responses",
      "Persistent conversations",
      "Traceable sources",
    ],
  },

  {
    title:
      "Start and Resume Conversations",

    description:
      "Use the New conversation button to start a fresh discussion. Previous conversations are stored in MongoDB and appear in the sidebar.",

    details: [
      "Create separate conversations",
      "Switch between saved conversations",
      "Resume after refreshing the browser",
    ],
  },

  {
    title:
      "Ask a Question",

    description:
      "Enter a cybersecurity question in the message box. The application retrieves relevant CIS Controls passages before generating an answer.",

    details: [
      "Questions are embedded semantically",
      "Weaviate retrieves matching passages",
      "A cross-encoder reranks the results",
      "Ollama generates the final answer",
    ],
  },

  {
    title:
      "Inspect Citations",

    description:
      "Generated answers include inline citations such as [1]. Use the source card and retrieval metadata to inspect the supporting passage and page number.",

    details: [
      "Hover over inline citations",
      "Read source snippets",
      "Check the source page",
      "Expand retrieval metadata",
    ],
  },

  {
    title:
      "Regenerate an Answer",

    description:
      "Use Regenerate to run retrieval, reranking, and generation again. Regeneration bypasses the answer cache and stores the new attempt in the same conversation.",

    details: [
      "Runs the RAG pipeline again",
      "Bypasses cached answers",
      "Preserves earlier attempts",
    ],
  },

  {
    title:
      "Provide Feedback",

    description:
      "Mark an answer as Helpful or Not helpful. Feedback is saved in MongoDB and remains selected when the conversation is reopened.",

    details: [
      "Supports answer-quality evaluation",
      "Identifies weak retrieval results",
      "Can guide future prompt and ranking improvements",
    ],
  },
];


export default function GuidedTour({
  children,
}) {
  const [
    isOpen,
    setIsOpen,
  ] = useState(false);

  const [
    currentStep,
    setCurrentStep,
  ] = useState(0);


  useEffect(() => {
    const tourCompleted =
      localStorage.getItem(
        TOUR_STORAGE_KEY,
      );

    if (!tourCompleted) {
      setIsOpen(true);
    }
  }, []);


  function openTour() {
    setCurrentStep(0);
    setIsOpen(true);
  }


  function closeTour() {
    setIsOpen(false);
  }


  function skipTour() {
    localStorage.setItem(
      TOUR_STORAGE_KEY,
      "true",
    );

    setIsOpen(false);
  }


  function goToPreviousStep() {
    setCurrentStep(
      (step) =>
        Math.max(
          step - 1,
          0,
        ),
    );
  }


  function goToNextStep() {
    const isLastStep =
      currentStep ===
      TOUR_STEPS.length - 1;

    if (isLastStep) {
      localStorage.setItem(
        TOUR_STORAGE_KEY,
        "true",
      );

      setIsOpen(false);

      return;
    }

    setCurrentStep(
      (step) =>
        Math.min(
          step + 1,
          TOUR_STEPS.length - 1,
        ),
    );
  }


  const step =
    TOUR_STEPS[currentStep];

  const progressPercentage =
    ((currentStep + 1) /
      TOUR_STEPS.length) *
    100;


  return (
    <>
      {children}

      {!isOpen && (
        <button
          type="button"
          onClick={openTour}
          className="fixed bottom-24 right-5 z-40 rounded-full border border-cyan-300/20 bg-[#101827]/95 px-4 py-2 text-xs font-semibold text-cyan-200 shadow-xl shadow-black/30 backdrop-blur transition hover:border-cyan-300/40 hover:bg-[#152036] focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
          aria-label="Open guided tour"
        >
          ? Tour
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guided-tour-title"
        >
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d1422] shadow-2xl shadow-black/60">
            <div className="h-1.5 bg-white/5">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                style={{
                  width:
                    `${progressPercentage}%`,
                }}
              />
            </div>

            <div className="p-6 sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                    Guided tour
                  </p>

                  <h2
                    id="guided-tour-title"
                    className="text-xl font-semibold text-white sm:text-2xl"
                  >
                    {step.title}
                  </h2>
                </div>

                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
                  {currentStep + 1}
                  {" / "}
                  {TOUR_STEPS.length}
                </span>
              </div>

              <p className="leading-7 text-slate-300">
                {step.description}
              </p>

              <div className="mt-6 space-y-2">
                {step.details.map(
                  (detail) => (
                    <div
                      key={detail}
                      className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-4 py-3"
                    >
                      <span
                        className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-xs font-bold text-cyan-300"
                        aria-hidden="true"
                      >
                        ✓
                      </span>

                      <span className="text-sm leading-6 text-slate-300">
                        {detail}
                      </span>
                    </div>
                  ),
                )}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={skipTour}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300"
                >
                  Skip tour
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={
                      goToPreviousStep
                    }
                    disabled={
                      currentStep === 0
                    }
                    className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={
                      goToNextStep
                    }
                    className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
                  >
                    {currentStep ===
                    TOUR_STEPS.length -
                      1
                      ? "Finish"
                      : "Next"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={closeTour}
                className="mt-5 w-full text-center text-xs text-slate-600 transition hover:text-slate-400"
              >
                Close without marking the tour as completed
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}