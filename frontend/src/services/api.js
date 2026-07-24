import {
  getAccessToken,
} from "./authService";


const API_BASE_URL =
  import.meta.env.VITE_API_URL
    ?.replace(/\/$/, "") ||
  "http://127.0.0.1:5050";

const DEV_USER_ID =
  import.meta.env.VITE_DEV_USER_ID ||
  "local-dev-user";


/**
 * Build headers shared by normal and streaming requests.
 *
 * The application JWT is sent when the user has signed in.
 * X-User-Id is temporarily retained because the current
 * .NET RAG and conversation controllers still require it.
 */
function createRequestHeaders(
  accept,
) {
  const accessToken =
    getAccessToken();

  const headers = {
    Accept: accept,

    "Content-Type":
      "application/json",

    "X-User-Id":
      DEV_USER_ID,
  };

  if (accessToken) {
    headers.Authorization =
      `Bearer ${accessToken}`;
  }

  return headers;
}


/**
 * Read a safe error message returned by the middleware.
 */
async function getErrorMessage(
  response,
) {
  try {
    const data =
      await response.json();

    return (
      data?.error ||
      data?.detail ||
      data?.title ||
      `Request failed with status ${response.status}.`
    );
  } catch {
    return (
      `Request failed with status ` +
      `${response.status}.`
    );
  }
}


/**
 * Check whether the .NET middleware is running.
 */
export async function checkHealth() {
  try {
    const response =
      await fetch(
        `${API_BASE_URL}/health`,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",
          },
        },
      );

    if (!response.ok) {
      return false;
    }

    const data =
      await response.json();

    return (
      data?.status ===
      "ok"
    );
  } catch {
    return false;
  }
}


/**
 * Send a normal non-streaming RAG request.
 */
export async function sendChatMessage(
  message,
  {
    conversationId,
    useCache = true,
    signal,
  } = {},
) {
  const normalizedMessage =
    message?.trim();

  if (!normalizedMessage) {
    throw new Error(
      "Message cannot be empty.",
    );
  }

  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/rag/query`,
      {
        method: "POST",

        headers:
          createRequestHeaders(
            "application/json",
          ),

        body: JSON.stringify({
          conversation_id:
            conversationId ||
            null,

          message:
            normalizedMessage,

          use_cache:
            useCache,
        }),

        signal,
      },
    );
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw error;
    }

    throw new Error(
      "Could not connect to the middleware. " +
        "Make sure the .NET API is running on port 5050.",
    );
  }

  if (!response.ok) {
    const errorMessage =
      await getErrorMessage(
        response,
      );

    throw new Error(
      errorMessage,
    );
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
function parseSseBlock(
  block,
) {
  let eventName =
    "message";

  const dataLines =
    [];

  const lines =
    block.split(/\r?\n/);

  for (
    const line
    of lines
  ) {
    if (
      !line ||
      line.startsWith(":")
    ) {
      continue;
    }

    if (
      line.startsWith(
        "event:",
      )
    ) {
      eventName = line
        .slice(
          "event:".length,
        )
        .trim();

      continue;
    }

    if (
      line.startsWith(
        "data:",
      )
    ) {
      dataLines.push(
        line
          .slice(
            "data:".length,
          )
          .trimStart(),
      );
    }
  }

  if (
    dataLines.length === 0
  ) {
    return null;
  }

  const rawData =
    dataLines.join("\n");

  let data;

  try {
    data =
      JSON.parse(
        rawData,
      );
  } catch {
    data = {
      message:
        rawData,
    };
  }

  return {
    event:
      eventName,

    data,
  };
}


/**
 * Stream a RAG request through:
 *
 * React
 *   -> .NET middleware
 *   -> Python RAG API
 *
 * Supported events:
 * - status
 * - metadata
 * - token
 * - done
 * - error
 */
export async function streamChatMessage(
  message,
  {
    conversationId,
    useCache = true,
    onStatus,
    onMetadata,
    onToken,
    onDone,
    onError,
    signal,
  } = {},
) {
  const normalizedMessage =
    message?.trim();

  if (!normalizedMessage) {
    throw new Error(
      "Message cannot be empty.",
    );
  }

  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/rag/query/stream`,
      {
        method: "POST",

        headers:
          createRequestHeaders(
            "text/event-stream",
          ),

        body: JSON.stringify({
          conversation_id:
            conversationId ||
            null,

          message:
            normalizedMessage,

          /*
           * Regeneration sends false so Python bypasses
           * its answer cache.
           */
          use_cache:
            useCache,
        }),

        signal,
      },
    );
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw error;
    }

    throw new Error(
      "Could not connect to the middleware. " +
        "Make sure the .NET API is running on port 5050.",
    );
  }

  if (!response.ok) {
    const errorMessage =
      await getErrorMessage(
        response,
      );

    throw new Error(
      errorMessage,
    );
  }

  if (!response.body) {
    throw new Error(
      "The middleware returned an empty streaming response.",
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder(
      "utf-8",
    );

  let buffer = "";

  function dispatchEvent({
    event,
    data,
  }) {
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
        /*
         * Unknown events are ignored so future SSE event
         * types do not break the frontend.
         */
        break;
    }
  }


  try {
    while (true) {
      const {
        value,
        done,
      } =
        await reader.read();

      if (done) {
        break;
      }

      buffer +=
        decoder.decode(
          value,
          {
            stream: true,
          },
        );

      /*
       * SSE messages are separated by a blank line.
       */
      const blocks =
        buffer.split(
          /\r?\n\r?\n/,
        );

      /*
       * The final block may be incomplete.
       */
      buffer =
        blocks.pop() ??
        "";

      for (
        const block
        of blocks
      ) {
        const parsedEvent =
          parseSseBlock(
            block,
          );

        if (parsedEvent) {
          dispatchEvent(
            parsedEvent,
          );
        }
      }
    }

    /*
     * Flush remaining TextDecoder bytes.
     */
    buffer +=
      decoder.decode();

    if (
      buffer.trim()
    ) {
      const parsedEvent =
        parseSseBlock(
          buffer,
        );

      if (parsedEvent) {
        dispatchEvent(
          parsedEvent,
        );
      }
    }
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw error;
    }

    throw new Error(
      "The connection to the middleware stream was interrupted.",
    );
  } finally {
    reader.releaseLock();
  }
}


export {
  API_BASE_URL,
  DEV_USER_ID,
};