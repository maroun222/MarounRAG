import { useEffect, useRef, useState } from "react";
import ChatHeader from "./components/ChatHeader";
import ChatInput from "./components/ChatInput";
import ChatMessage from "./components/ChatMessage";
import SuggestionCards from "./components/SuggestionCards";
import TypingIndicator from "./components/TypingIndicator";
import { checkHealth, streamChatMessage } from "./services/api";

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
  const [streaming, setStreaming] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState("");
  const [backendStatus, setBackendStatus] = useState("checking");

  const viewportRef = useRef(null);
  const activeRequestRef = useRef(null);

  useEffect(() => {
    checkHealth()
      .then(() => setBackendStatus("online"))
      .catch(() => setBackendStatus("offline"));
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: streaming ? "auto" : "smooth",
    });
  }, [messages, loading, streaming, thinkingStatus]);

  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort();
    };
  }, []);

  function updateMessage(messageId, updates) {
    setMessages((currentMessages) =>
      currentMessages.map((message) => {
        if (message.id !== messageId) {
          return message;
        }

        return {
          ...message,
          ...updates,
          meta: updates.meta
            ? {
                ...message.meta,
                ...updates.meta,
              }
            : message.meta,
        };
      }),
    );
  }

  function appendAssistantToken(messageId, token) {
    if (!token) {
      return;
    }

    setMessages((currentMessages) =>
      currentMessages.map((message) => {
        if (message.id !== messageId) {
          return message;
        }

        return {
          ...message,
          content: `${message.content || ""}${token}`,
        };
      }),
    );
  }

  async function submitQuestion(questionOverride) {
    const question = (questionOverride ?? input).trim();

    if (
      !question ||
      loading ||
      streaming ||
      backendStatus !== "online"
    ) {
      return;
    }

    const userMessage = {
      id: makeId(),
      role: "user",
      content: question,
    };

    const assistantMessageId = makeId();

    const assistantMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      meta: {
        page: null,
        cacheHit: false,
        timings: null,
      },
    };

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      assistantMessage,
    ]);

    setInput("");
    setLoading(true);
    setStreaming(true);
    setThinkingStatus("Connecting to the RAG backend...");

    const controller = new AbortController();
    activeRequestRef.current = controller;

    let streamErrorHandled = false;

    try {
      await streamChatMessage(question, {
        signal: controller.signal,

        onStatus: (data) => {
          setThinkingStatus(
            data.message || "Processing your question...",
          );
        },

        onMetadata: (data) => {
          updateMessage(assistantMessageId, {
            meta: {
              page: data.page ?? null,
              cacheHit: data.cache_hit ?? false,
            },
          });
        },

        onToken: (data) => {
          const token = data.text ?? "";

          if (!token) {
            return;
          }

          setLoading(false);
          setThinkingStatus("");
          appendAssistantToken(assistantMessageId, token);
        },

        onDone: (data) => {
          updateMessage(assistantMessageId, {
            meta: {
              page: data.page ?? undefined,
              cacheHit: data.cache_hit ?? undefined,
              timings: data.timings ?? null,
            },
          });

          setThinkingStatus("");
          setLoading(false);
          setStreaming(false);
        },

        onError: (data) => {
          streamErrorHandled = true;

          updateMessage(assistantMessageId, {
            content:
              data.message ||
              "An error occurred while generating the answer.",
            error: true,
          });

          setThinkingStatus("");
          setLoading(false);
          setStreaming(false);
        },
      });
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      if (!streamErrorHandled) {
        updateMessage(assistantMessageId, {
          content:
            error.message || "Unable to reach the RAG backend.",
          error: true,
        });
      }

      setThinkingStatus("");
      setLoading(false);
      setStreaming(false);

      if (
        error instanceof TypeError ||
        error.message?.includes("connect") ||
        error.message?.includes("Failed to fetch")
      ) {
        setBackendStatus("offline");
      }
    } finally {
      activeRequestRef.current = null;
      setLoading(false);
      setStreaming(false);
      setThinkingStatus("");
    }
  }

  function clearConversation() {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;

    setMessages([welcomeMessage]);
    setInput("");
    setLoading(false);
    setStreaming(false);
    setThinkingStatus("");
  }

  const showSuggestions = messages.length === 1;
  const requestInProgress = loading || streaming;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#070b14] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-blue-600/8 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <ChatHeader
          backendStatus={backendStatus}
          onClear={clearConversation}
        />

        <main
          ref={viewportRef}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                streaming={
                  streaming &&
                  message.role === "assistant" &&
                  message.id === messages[messages.length - 1]?.id
                }
              />
            ))}

            {showSuggestions && (
              <SuggestionCards
                disabled={
                  backendStatus !== "online" || requestInProgress
                }
                onSelect={submitQuestion}
              />
            )}

            {loading && (
              <TypingIndicator status={thinkingStatus} />
            )}
          </div>
        </main>

        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={() => submitQuestion()}
          loading={requestInProgress}
          backendOnline={backendStatus === "online"}
        />
      </div>
    </div>
  );
}