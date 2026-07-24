import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  clearAuthSession,
  getAuthSession,
  loginWithGoogleCredential,
} from "../services/authService";


const GOOGLE_SCRIPT_URL =
  "https://accounts.google.com/gsi/client";

let googleScriptPromise = null;


function loadGoogleIdentityScript() {
  if (
    window.google?.accounts?.id
  ) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise =
    new Promise(
      (resolve, reject) => {
        const script =
          document.createElement(
            "script",
          );

        script.src =
          GOOGLE_SCRIPT_URL;

        script.async = true;
        script.defer = true;

        script.onload = () => {
          if (
            window.google
              ?.accounts?.id
          ) {
            resolve();
          } else {
            reject(
              new Error(
                "Google Identity Services did not initialize.",
              ),
            );
          }
        };

        script.onerror = () => {
          googleScriptPromise =
            null;

          reject(
            new Error(
              "Could not load Google Sign-In.",
            ),
          );
        };

        document.head.appendChild(
          script,
        );
      },
    );

  return googleScriptPromise;
}


function LoginScreen({
  onAuthenticated,
}) {
  const buttonRef = useRef(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const googleClientId =
    import.meta.env
      .VITE_GOOGLE_CLIENT_ID;


  useEffect(() => {
    let cancelled = false;

    async function initializeGoogle() {
      if (!googleClientId) {
        setError(
          "VITE_GOOGLE_CLIENT_ID is not configured.",
        );

        return;
      }

      try {
        await loadGoogleIdentityScript();

        if (
          cancelled ||
          !buttonRef.current
        ) {
          return;
        }

        window.google.accounts.id
          .initialize({
            client_id:
              googleClientId,

            auto_select: false,

            callback:
              async (
                credentialResponse,
              ) => {
                const credential =
                  credentialResponse
                    ?.credential;

                if (!credential) {
                  setError(
                    "Google did not return a credential.",
                  );

                  return;
                }

                setLoading(true);
                setError("");

                try {
                  const session =
                    await loginWithGoogleCredential(
                      credential,
                    );

                  if (!cancelled) {
                    onAuthenticated(
                      session,
                    );
                  }
                } catch (
                  loginError
                ) {
                  if (!cancelled) {
                    setError(
                      loginError
                        ?.message ||
                        "Google authentication failed.",
                    );
                  }
                } finally {
                  if (!cancelled) {
                    setLoading(
                      false,
                    );
                  }
                }
              },
          });

        buttonRef.current
          .replaceChildren();

        window.google.accounts.id
          .renderButton(
            buttonRef.current,
            {
              type: "standard",
              theme:
                "filled_black",
              size: "large",
              text:
                "signin_with",
              shape: "pill",
              logo_alignment:
                "left",
              width: 320,
            },
          );
      } catch (
        initializationError
      ) {
        if (!cancelled) {
          setError(
            initializationError
              ?.message ||
              "Unable to initialize Google Sign-In.",
          );
        }
      }
    }

    initializeGoogle();

    return () => {
      cancelled = true;

      if (buttonRef.current) {
        buttonRef.current
          .replaceChildren();
      }
    };
  }, [
    googleClientId,
    onAuthenticated,
  ]);


  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#070b14] px-4 text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:42px_42px]" />
      </div>

      <section className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.055] p-8 text-center shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-2xl">
          ◈
        </div>

        <h1 className="text-2xl font-semibold text-white">
          CIS Controls Assistant
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">
          Sign in to access your
          saved conversations and
          securely use the local RAG
          assistant.
        </p>

        <div className="mt-7 flex min-h-11 justify-center">
          <div ref={buttonRef} />
        </div>

        {loading && (
          <p className="mt-4 text-sm text-cyan-300">
            Verifying your Google
            account...
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-3 text-sm text-rose-200"
          >
            {error}
          </p>
        )}

        <p className="mt-6 text-xs leading-5 text-slate-600">
          Google verifies your
          identity. The application
          stores its own session token
          for this browser tab.
        </p>
      </section>
    </main>
  );
}


export default function AuthGate({
  children,
}) {
  const [session, setSession] =
    useState(() =>
      getAuthSession(),
    );


  function handleLogout() {
    clearAuthSession();

    window.google?.accounts?.id
      ?.disableAutoSelect();

    setSession(null);
  }


  if (!session) {
    return (
      <LoginScreen
        onAuthenticated={
          setSession
        }
      />
    );
  }


  return (
    <>
      {children}

      <div className="fixed right-3 top-3 z-50 flex items-center gap-2 rounded-full border border-white/10 bg-[#0c1320]/95 py-1.5 pl-1.5 pr-2 shadow-xl shadow-black/30 backdrop-blur">
        {session.user
          ?.picture_url ? (
          <img
            src={
              session.user
                .picture_url
            }
            alt=""
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full"
          />
        ) : (
          <div className="grid h-8 w-8 place-items-center rounded-full bg-cyan-300/10 text-xs font-semibold text-cyan-200">
            {session.user?.name
              ?.slice(0, 1)
              .toUpperCase() ||
              "U"}
          </div>
        )}

        <span className="hidden max-w-36 truncate text-xs text-slate-300 sm:block">
          {session.user?.name}
        </span>

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full px-2 py-1 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </>
  );
}