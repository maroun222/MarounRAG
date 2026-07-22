const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

/**
 * Check whether the FastAPI backend is available.
 */
export async function checkHealth() {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error(`Backend health check failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Send a question using the original non-streaming endpoint.
 * This can remain available as a fallback.
 */
export async function sendChatMessage(message) {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
    }),
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;

    try {
      const errorData = await response.json();
      errorMessage =
        errorData.detail ||
        errorData.message ||
        errorData.error ||
        errorMessage;
    } catch {
      // The response was not JSON.
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Send a question to the SSE streaming endpoint.
 *
 * Supported backend events:
 * - status
 * - metadata
 * - token
 * - done
 * - error
 */
export async function streamChatMessage(
  message,
  {
    onStatus,
    onMetadata,
    onToken,
    onDone,
    onError,
    signal,
  } = {},
) {
  if (!message || !message.trim()) {
    throw new Error("The question cannot be empty.");
  }

  let response;

  try {
    response = await fetch(`${API_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message: message.trim(),
      }),
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    const networkError = new Error(
      "Could not connect to the backend. Make sure FastAPI is running on port 8000.",
    );

    onError?.({
      message: networkError.message,
    });

    throw networkError;
  }

  if (!response.ok) {
    let errorMessage = `Streaming request failed with status ${response.status}`;

    try {
      const errorData = await response.json();

      errorMessage =
        errorData.detail ||
        errorData.message ||
        errorData.error ||
        errorMessage;
    } catch {
      const responseText = await response.text();

      if (responseText) {
        errorMessage = responseText;
      }
    }

    const requestError = new Error(errorMessage);

    onError?.({
      message: errorMessage,
    });

    throw requestError;
  }

  if (!response.body) {
    const streamError = new Error(
      "The browser did not receive a readable response stream.",
    );

    onError?.({
      message: streamError.message,
    });

    throw streamError;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let buffer = "";
  let streamCompleted = false;

  /**
   * Process one complete SSE event block.
   *
   * Example:
   *
   * event: token
   * data: {"text":"Hello"}
   */
  const processEventBlock = (eventBlock) => {
    if (!eventBlock.trim()) {
      return;
    }

    const lines = eventBlock.split(/\r?\n/);

    let eventName = "message";
    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith(":")) {
        // SSE comment or keep-alive line.
        continue;
      }

      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim();
        continue;
      }

      if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart());
      }
    }

    if (dataLines.length === 0) {
      return;
    }

    const rawData = dataLines.join("\n");

    let data;

    try {
      data = JSON.parse(rawData);
    } catch {
      data = {
        message: rawData,
        text: rawData,
      };
    }

    switch (eventName) {
      case "status":
        onStatus?.(data);
        break;

      case "metadata":
        onMetadata?.(data);
        break;

      case "token":
        onToken?.(data);
        break;

      case "done":
        streamCompleted = true;
        onDone?.(data);
        break;

      case "error": {
        const message =
          data.message ||
          data.detail ||
          data.error ||
          "The backend reported a streaming error.";

        onError?.({
          ...data,
          message,
        });

        throw new Error(message);
      }

      default:
        console.warn("Unknown SSE event received:", eventName, data);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        buffer += decoder.decode();

        if (buffer.trim()) {
          processEventBlock(buffer);
        }

        break;
      }

      buffer += decoder.decode(value, {
        stream: true,
      });

      /*
       * SSE events are separated by a blank line.
       * This supports both:
       *
       * \n\n
       * \r\n\r\n
       */
      const eventBlocks = buffer.split(/\r?\n\r?\n/);

      // The last item may be an incomplete event.
      buffer = eventBlocks.pop() ?? "";

      for (const eventBlock of eventBlocks) {
        processEventBlock(eventBlock);
      }
    }

    /*
     * Normally the backend sends an explicit "done" event.
     * This fallback handles a stream that closes normally without one.
     */
    if (!streamCompleted) {
      onDone?.({
        stream_closed: true,
      });
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    onError?.({
      message: error.message || "The response stream failed.",
    });

    throw error;
  } finally {
    reader.releaseLock();
  }
}

export { API_URL };