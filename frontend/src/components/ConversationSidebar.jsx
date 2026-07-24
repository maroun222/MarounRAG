function formatUpdatedAt(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function ConversationSidebar({
  conversations,
  selectedConversationId,
  loading,
  error,
  disabled,
  onSelect,
  onNewConversation,
}) {
  return (
    <aside className="hidden h-screen w-72 shrink-0 flex-col border-r border-white/10 bg-[#080d18]/95 lg:flex">
      <div className="border-b border-white/10 p-4">
        <button
          type="button"
          onClick={onNewConversation}
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden="true">＋</span>
          New conversation
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Conversations
        </div>

        {loading && (
          <p className="px-2 py-4 text-sm text-slate-400">
            Loading conversations...
          </p>
        )}

        {!loading && error && (
          <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        {!loading &&
          !error &&
          conversations.length === 0 && (
            <p className="px-2 py-4 text-sm leading-6 text-slate-500">
              Your saved conversations will appear here.
            </p>
          )}

        <div className="space-y-1">
          {conversations.map((conversation) => {
            const selected =
              conversation.id === selectedConversationId;

            return (
              <button
                key={conversation.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(conversation.id)}
                className={`w-full rounded-xl px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? "bg-cyan-400/12 text-cyan-50 ring-1 ring-cyan-400/25"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <span className="block truncate text-sm font-medium">
                  {conversation.title}
                </span>

                <span className="mt-1 block text-xs text-slate-500">
                  {formatUpdatedAt(
                    conversation.updated_at_utc,
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}