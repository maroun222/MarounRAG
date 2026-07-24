import {
  useEffect,
  useRef,
  useState,
} from "react";

import ChatHeader from "./components/ChatHeader";
import ChatInput from "./components/ChatInput";
import ChatMessage from "./components/ChatMessage";
import ConversationSidebar from "./components/ConversationSidebar";
import SuggestionCards from "./components/SuggestionCards";
import TypingIndicator from "./components/TypingIndicator";

import {
  checkHealth,
  streamChatMessage,
} from "./services/api";

import {
  createConversation,
  getConversation,
  listConversations,
} from "./services/conversationService";


const SELECTED_CONVERSATION_KEY =
  "cis-rag-selected-conversation";


const welcomeMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello. I am your local CIS Controls assistant. " +
    "Ask a question and I will retrieve the most " +
    "relevant passage from your indexed document.",
};


function makeId() {
  return (
    `${Date.now()}-` +
    Math.random().toString(16).slice(2)
  );
}


function makeConversationTitle(question) {
  const normalized = question
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= 60) {
    return normalized;
  }

  return `${normalized.slice(0, 57)}...`;
}


function mapPersistedMessages(conversation) {
  const persistedMessages =
    conversation?.messages ?? [];

  if (persistedMessages.length === 0) {
    return [welcomeMessage];
  }

  return persistedMessages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    meta: {
      page: message.page ?? null,
      context: message.context ?? null,
    retrievalContext:
      message.retrieval_context ?? [],
    sources:
      message.sources ?? [],
    cacheHit:
      message.cache_hit ?? false,
    timings: message.timings ?? null,
    },
  }));
}


export default function App() {
  const [messages, setMessages] = useState([
    welcomeMessage,
  ]);

  const [input, setInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] =
    useState(false);

  const [
    conversationLoading,
    setConversationLoading,
  ] = useState(false);

  const [thinkingStatus, setThinkingStatus] =
    useState("");

  const [backendStatus, setBackendStatus] =
    useState("checking");

  const [conversations, setConversations] =
    useState([]);

  const [
    selectedConversationId,
    setSelectedConversationId,
  ] = useState(null);

  const [historyLoading, setHistoryLoading] =
    useState(true);

  const [historyError, setHistoryError] =
    useState("");

  const viewportRef = useRef(null);
  const activeRequestRef = useRef(null);


  // =========================================================
  // Initial health and history loading
  // =========================================================

  useEffect(() => {
    const controller = new AbortController();

    async function initialize() {
      const healthy = await checkHealth();

      if (!healthy) {
        setBackendStatus("offline");
        setHistoryLoading(false);
        return;
      }

      setBackendStatus("online");

      try {
        const conversationList =
          await listConversations(
            controller.signal,
          );

        setConversations(conversationList);

        const storedConversationId =
          localStorage.getItem(
            SELECTED_CONVERSATION_KEY,
          );

        const storedConversationExists =
          storedConversationId &&
          conversationList.some(
            (conversation) =>
              conversation.id ===
              storedConversationId,
          );

        if (!storedConversationExists) {
          localStorage.removeItem(
            SELECTED_CONVERSATION_KEY,
          );

          return;
        }

        setConversationLoading(true);

        const savedConversation =
          await getConversation(
            storedConversationId,
            controller.signal,
          );

        setSelectedConversationId(
          storedConversationId,
        );

        setMessages(
          mapPersistedMessages(
            savedConversation,
          ),
        );
      } catch (error) {
        if (error?.name !== "AbortError") {
          setHistoryError(
            error?.message ||
              "Unable to load saved conversations.",
          );
        }
      } finally {
        setHistoryLoading(false);
        setConversationLoading(false);
      }
    }

    initialize();

    return () => {
      controller.abort();
    };
  }, []);


  // =========================================================
  // Auto-scroll
  // =========================================================

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: streaming ? "auto" : "smooth",
    });
  }, [
    messages,
    loading,
    streaming,
    thinkingStatus,
  ]);


  // =========================================================
  // Abort active request on unmount
  // =========================================================

  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort();
    };
  }, []);


  // =========================================================
  // Message helpers
  // =========================================================

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


  function appendAssistantToken(
    messageId,
    token,
  ) {
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
          content:
            `${message.content || ""}${token}`,
        };
      }),
    );
  }


  async function refreshConversationList() {
    try {
      const conversationList =
        await listConversations();

      setConversations(conversationList);
      setHistoryError("");
    } catch (error) {
      setHistoryError(
        error?.message ||
          "Unable to refresh conversations.",
      );
    }
  }


  // =========================================================
  // Conversation selection
  // =========================================================

  async function openConversation(
    conversationId,
  ) {
    if (
      !conversationId ||
      loading ||
      streaming ||
      conversationLoading
    ) {
      return;
    }

    activeRequestRef.current?.abort();

    setConversationLoading(true);
    setHistoryError("");

    try {
      const conversation =
        await getConversation(conversationId);

      setSelectedConversationId(
        conversationId,
      );

      localStorage.setItem(
        SELECTED_CONVERSATION_KEY,
        conversationId,
      );

      setMessages(
        mapPersistedMessages(conversation),
      );

      setInput("");
      setThinkingStatus("");
    } catch (error) {
      setHistoryError(
        error?.message ||
          "Unable to load the conversation.",
      );
    } finally {
      setConversationLoading(false);
    }
  }


  function startNewConversation() {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;

    localStorage.removeItem(
      SELECTED_CONVERSATION_KEY,
    );

    setSelectedConversationId(null);
    setMessages([welcomeMessage]);
    setInput("");
    setLoading(false);
    setStreaming(false);
    setThinkingStatus("");
  }


  // =========================================================
  // Submit RAG question
  // =========================================================

  async function submitQuestion(
    questionOverride,
  ) {
    const question = (
      questionOverride ?? input
    ).trim();

    if (
      !question ||
      loading ||
      streaming ||
      conversationLoading ||
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
        context: null,
        retrievalContext: [],
        sources: [],
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
    setThinkingStatus(
      selectedConversationId
        ? "Connecting to the RAG backend..."
        : "Creating a new conversation...",
    );

    const controller = new AbortController();
    activeRequestRef.current = controller;

    let streamErrorHandled = false;
    let streamCompleted = false;

    let activeConversationId =
      selectedConversationId;

    try {
      if (!activeConversationId) {
        const createdConversation =
          await createConversation(
            makeConversationTitle(question),
            controller.signal,
          );

        activeConversationId =
          createdConversation.id;

        setSelectedConversationId(
          activeConversationId,
        );

        localStorage.setItem(
          SELECTED_CONVERSATION_KEY,
          activeConversationId,
        );

        setConversations(
          (currentConversations) => [
            createdConversation,
            ...currentConversations.filter(
              (conversation) =>
                conversation.id !==
                createdConversation.id,
            ),
          ],
        );
      }

      setStreaming(true);
      setThinkingStatus(
        "Connecting to the RAG backend...",
      );

      await streamChatMessage(question, {
        conversationId:
          activeConversationId,

        signal: controller.signal,

        onStatus: (data) => {
          setThinkingStatus(
            data.message ||
              "Processing your question...",
          );
        },

        onMetadata: (data) => {
          updateMessage(
            assistantMessageId,
            {
              meta: {
                page: data.page ?? null,
                context:
                  data.context ?? null,
                retrievalContext:
                  data.retrieval_context ??
                  [],
                sources:
                  data.sources ?? [],
                cacheHit:
                  data.cache_hit ?? false,
              },
            },
          );
        },

        onToken: (data) => {
          const token = data.text ?? "";

          if (!token) {
            return;
          }

          setLoading(false);
          setThinkingStatus("");

          appendAssistantToken(
            assistantMessageId,
            token,
          );
        },

        onDone: (data) => {
          streamCompleted = true;

          updateMessage(
            assistantMessageId,
            {
              meta: {
                page:
                  data.page ?? undefined,
                context:
                  data.context ?? undefined,
                retreivalContext:
                  data.retreival_context ??
                  undefined,
                sources:
                  data.sources ?? undefined,
                cacheHit:
                  data.cache_hit ??
                  undefined,
                timings:
                  data.timings ?? null,
              },
            },
          );

          setThinkingStatus("");
          setLoading(false);
          setStreaming(false);
        },

        onError: (data) => {
          streamErrorHandled = true;

          updateMessage(
            assistantMessageId,
            {
              content:
                data.message ||
                "An error occurred while generating the answer.",
              error: true,
            },
          );

          setThinkingStatus("");
          setLoading(false);
          setStreaming(false);
        },
      });

      /*
       * After the stream closes, the middleware has completed
       * MongoDB persistence. Reload the authoritative messages.
       */
      if (
        streamCompleted &&
        activeConversationId
      ) {
        try {
          const savedConversation =
            await getConversation(
              activeConversationId,
            );

          setMessages(
            mapPersistedMessages(
              savedConversation,
            ),
          );
        } catch {
          /*
           * Keep the already-streamed UI messages if the
           * history reload fails.
           */
        }

        await refreshConversationList();
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      if (!streamErrorHandled) {
        updateMessage(
          assistantMessageId,
          {
            content:
              error?.message ||
              "Unable to reach the RAG backend.",
            error: true,
          },
        );
      }

      if (
        error instanceof TypeError ||
        error?.message?.includes("connect") ||
        error?.message?.includes(
          "Failed to fetch",
        )
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


  const showSuggestions =
    messages.length === 1 &&
    messages[0].id === welcomeMessage.id;

  const requestInProgress =
    loading ||
    streaming ||
    conversationLoading;


  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#070b14] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-cyan-500/8 blur-3xl" />

        <div className="absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-blue-600/8 blur-3xl" />

        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
      </div>

      <div className="relative z-10 flex min-h-screen w-full">
        <ConversationSidebar
          conversations={conversations}
          selectedConversationId={
            selectedConversationId
          }
          loading={historyLoading}
          error={historyError}
          disabled={requestInProgress}
          onSelect={openConversation}
          onNewConversation={
            startNewConversation
          }
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <ChatHeader
            backendStatus={backendStatus}
            onClear={startNewConversation}
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
                    message.role ===
                      "assistant" &&
                    message.id ===
                      messages[
                        messages.length - 1
                      ]?.id
                  }
                />
              ))}

              {showSuggestions && (
                <SuggestionCards
                  disabled={
                    backendStatus !==
                      "online" ||
                    requestInProgress
                  }
                  onSelect={submitQuestion}
                />
              )}

              {conversationLoading && (
                <TypingIndicator status="Loading conversation..." />
              )}

              {loading && (
                <TypingIndicator
                  status={thinkingStatus}
                />
              )}
            </div>
          </main>

          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={() =>
              submitQuestion()
            }
            loading={requestInProgress}
            backendOnline={
              backendStatus === "online"
            }
          />
        </div>
      </div>
    </div>
  );
}