const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:5050";


/**
 * Read an error response without exposing raw backend details.
 */
async function getErrorMessage(response) {
  try {
    const data = await response.json();

    return (
      data?.error ||
      data?.detail ||
      data?.title ||
      `Request failed with status ${response.status}.`
    );
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}


/**
 * Check whether the .NET middleware is running.
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();

    return data?.status === "ok";
  } catch {
    return false;
  }
}


/**
 * Send a normal, non-streaming RAG request through the .NET middleware.
 */
export async function sendChatMessage(message, signal = undefined) {
  const normalizedMessage = message?.trim();

  if (!normalizedMessage) {
    throw new Error("Message cannot be empty.");
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}/api/rag/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        message: normalizedMessage,
      }),
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Could not connect to the middleware. " +
        "Make sure the .NET API is running on port 5050."
    );
  }

  if (!response.ok) {
    const errorMessage = await getErrorMessage(response);
    throw new Error(errorMessage);
  }

  return response.json();
}


/**
 * Parse one complete Server-Sent Events block.
 *
 * Example:
 *
 * event: token
 * data: {"text":"Hello"}
 */
function parseSseBlock(block) {
  let eventName = "message";
  const dataLines = [];

  const lines = block.split(/\r?\n/);

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
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
    return null;
  }

  const rawData = dataLines.join("\n");

  let data;

  try {
    data = JSON.parse(rawData);
  } catch {
    data = {
      message: rawData,
    };
  }

  return {
    event: eventName,
    data,
  };
}


/**
 * Send a streaming RAG request through:
 *
 * React
 *   -> .NET middleware
 *   -> Python RAG API
 *
 * Supported SSE events:
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
  } = {}
) {
  const normalizedMessage = message?.trim();

  if (!normalizedMessage) {
    throw new Error("Message cannot be empty.");
  }

  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/rag/query/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: normalizedMessage,
        }),
        signal,
      }
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Could not connect to the middleware. " +
        "Make sure the .NET API is running on port 5050."
    );
  }

  if (!response.ok) {
    const errorMessage = await getErrorMessage(response);
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error(
      "The middleware returned an empty streaming response."
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let buffer = "";

  const dispatchEvent = ({ event, data }) => {
    switch (event) {
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
        onDone?.(data);
        break;

      case "error":
        onError?.(data);
        break;

      default:
        // Ignore unknown SSE events safely.
        break;
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, {
        stream: true,
      });

      /*
       * SSE events are separated by an empty line.
       * This supports both:
       * - \n\n
       * - \r\n\r\n
       */
      const blocks = buffer.split(/\r?\n\r?\n/);

      /*
       * The final item may be incomplete, so keep it for
       * the next network chunk.
       */
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const parsedEvent = parseSseBlock(block);

        if (parsedEvent) {
          dispatchEvent(parsedEvent);
        }
      }
    }

    /*
     * Flush any bytes still held by TextDecoder.
     */
    buffer += decoder.decode();

    if (buffer.trim()) {
      const parsedEvent = parseSseBlock(buffer);

      if (parsedEvent) {
        dispatchEvent(parsedEvent);
      }
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "The connection to the middleware stream was interrupted."
    );
  } finally {
    reader.releaseLock();
  }
}


export { API_BASE_URL };