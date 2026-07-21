const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function parseResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.detail || data?.message || "The backend request failed.";
    throw new Error(message);
  }

  return data;
}

export async function checkHealth(signal) {
  const response = await fetch(`${API_URL}/health`, { signal });
  return parseResponse(response);
}

export async function sendChatMessage(message, signal) {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
    signal,
  });

  return parseResponse(response);
}
