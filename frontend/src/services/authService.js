const API_BASE_URL =
  import.meta.env.VITE_API_URL
    ?.replace(/\/$/, "") ||
  "http://127.0.0.1:5050";

const AUTH_STORAGE_KEY =
  "cis-rag-auth-session";


async function readErrorMessage(response) {
  try {
    const data = await response.json();

    return (
      data?.error ||
      data?.detail ||
      data?.title ||
      `Authentication failed with status ${response.status}.`
    );
  } catch {
    return (
      `Authentication failed with status ` +
      `${response.status}.`
    );
  }
}


export async function loginWithGoogleCredential(
  credential,
) {
  if (!credential) {
    throw new Error(
      "Google did not return a credential.",
    );
  }

  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/auth/google`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credential,
        }),
      },
    );
  } catch {
    throw new Error(
      "Could not connect to the .NET middleware.",
    );
  }

  if (!response.ok) {
    const message =
      await readErrorMessage(response);

    throw new Error(message);
  }

  const authResponse =
    await response.json();

  const session = {
    accessToken:
      authResponse.access_token,
    tokenType:
      authResponse.token_type ||
      "Bearer",
    expiresAtUtc:
      authResponse.expires_at_utc,
    user:
      authResponse.user,
  };

  sessionStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify(session),
  );

  return session;
}


export function getAuthSession() {
  const storedValue =
    sessionStorage.getItem(
      AUTH_STORAGE_KEY,
    );

  if (!storedValue) {
    return null;
  }

  try {
    const session =
      JSON.parse(storedValue);

    if (
      !session?.accessToken ||
      !session?.expiresAtUtc ||
      !session?.user
    ) {
      clearAuthSession();
      return null;
    }

    const expirationTime =
      new Date(
        session.expiresAtUtc,
      ).getTime();

    if (
      Number.isNaN(expirationTime) ||
      expirationTime <= Date.now()
    ) {
      clearAuthSession();
      return null;
    }

    return session;
  } catch {
    clearAuthSession();
    return null;
  }
}


export function getAccessToken() {
  return (
    getAuthSession()?.accessToken ??
    null
  );
}


export function clearAuthSession() {
  sessionStorage.removeItem(
    AUTH_STORAGE_KEY,
  );
}