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


function createHeaders() {
  const accessToken =
    getAccessToken();

  const headers = {
    Accept:
      "application/json",

    "Content-Type":
      "application/json",

    /*
     * Temporary development ownership header.
     * It remains required by the current controllers.
     */
    "X-User-Id":
      DEV_USER_ID,
  };

  if (accessToken) {
    headers.Authorization =
      `Bearer ${accessToken}`;
  }

  return headers;
}


async function readErrorMessage(
  response,
) {
  try {
    const data =
      await response.json();

    return (
      data?.error ||
      data?.detail ||
      data?.title ||
      `Feedback request failed with status ${response.status}.`
    );
  } catch {
    return (
      `Feedback request failed with status ` +
      `${response.status}.`
    );
  }
}


export async function submitFeedback({
  conversationId,
  messageId,
  rating,
  comment = null,
  signal,
}) {
  if (!conversationId) {
    throw new Error(
      "A conversation is required before submitting feedback.",
    );
  }

  if (!messageId) {
    throw new Error(
      "An assistant message is required before submitting feedback.",
    );
  }

  if (
    rating !== "up" &&
    rating !== "down"
  ) {
    throw new Error(
      "Feedback rating must be up or down.",
    );
  }

  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/feedback`,
      {
        method:
          "PUT",

        headers:
          createHeaders(),

        body:
          JSON.stringify({
            conversation_id:
              conversationId,

            message_id:
              messageId,

            rating,

            comment,
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
      "Could not connect to the feedback service.",
    );
  }

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(
        response,
      ),
    );
  }

  return response.json();
}


export async function listConversationFeedback(
  conversationId,
  signal,
) {
  if (!conversationId) {
    return [];
  }

  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/feedback/conversations/${encodeURIComponent(
        conversationId,
      )}`,
      {
        method:
          "GET",

        headers:
          createHeaders(),

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
      "Could not load conversation feedback.",
    );
  }

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(
        response,
      ),
    );
  }

  return response.json();
}