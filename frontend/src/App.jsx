import { useEffect, useRef, useState } from "react";
import ChatHeader from "./components/ChatHeader";
import ChatInput from "./components/ChatInput";
import ChatMessage from "./components/ChatMessage";
import SuggestionCards from "./components/SuggestionCards";
import TypingIndicator from "./components/TypingIndicator";
import { checkHealth, sendChatMessage } from "./services/api";

const welcomeMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello. I am your local CIS Controls assistant. Ask a question and I will retrieve the most relevant passage from your indexed document.",
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking");
  const viewportRef = useRef(null);
  const activeRequestRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    checkHealth(controller.signal)
      .then(() => setBackendStatus("online"))
      .catch(() => setBackendStatus("offline"));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  useEffect(() => {
    return () => activeRequestRef.current?.abort();
  }, []);

  async function submitQuestion(questionOverride) {
    const question = (questionOverride ?? input).trim();
    if (!question || loading || backendStatus !== "online") return;

    const userMessage = {
      id: makeId(),
      role: "user",
      content: question,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    activeRequestRef.current = controller;

    try {
      const response = await sendChatMessage(question, controller.signal);

      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          content: response.answer,
          meta: {
            page: response.page,
            cacheHit: response.cache_hit,
            timings: response.timings,
          },
        },
      ]);
    } catch (error) {
      if (error.name === "AbortError") return;

      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          content: error.message || "Unable to reach the RAG backend.",
          error: true,
        },
      ]);
      setBackendStatus("offline");
    } finally {
      activeRequestRef.current = null;
      setLoading(false);
    }
  }

  function clearConversation() {
    activeRequestRef.current?.abort();
    setMessages([welcomeMessage]);
    setInput("");
    setLoading(false);
  }

  const showSuggestions = messages.length === 1;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#070b14] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-blue-600/8 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <ChatHeader backendStatus={backendStatus} onClear={clearConversation} />

        <main ref={viewportRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {showSuggestions && (
              <SuggestionCards
                disabled={backendStatus !== "online" || loading}
                onSelect={submitQuestion}
              />
            )}

            {loading && <TypingIndicator />}
          </div>
        </main>

        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={() => submitQuestion()}
          loading={loading}
          backendOnline={backendStatus === "online"}
        />
      </div>
    </div>
  );
}
