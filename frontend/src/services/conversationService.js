import {
  API_BASE_URL,
  DEV_USER_ID,
} from "./api";


async function readErrorMessage(response) {
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


async function requestJson(
  path,
  {
    method = "GET",
    body,
    signal,
  } = {}
) {
  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-User-Id": DEV_USER_ID,
        },
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body),
        signal,
      }
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Could not connect to the .NET middleware."
    );
  }

  if (!response.ok) {
    const message =
      await readErrorMessage(response);

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}


/**
 * Create a new conversation in MongoDB.
 */
export function createConversation(
  title = "New conversation",
  signal = undefined
) {
  return requestJson(
    "/api/conversations",
    {
      method: "POST",
      body: {
        title,
      },
      signal,
    }
  );
}


/**
 * Load the current user's conversation list.
 */
export function listConversations(
  signal = undefined
) {
  return requestJson(
    "/api/conversations",
    {
      signal,
    }
  );
}


/**
 * Load one conversation and all its messages.
 */
export function getConversation(
  conversationId,
  signal = undefined
) {
  if (!conversationId) {
    throw new Error(
      "Conversation ID is required."
    );
  }

  return requestJson(
    `/api/conversations/${encodeURIComponent(
      conversationId
    )}`,
    {
      signal,
    }
  );
}