"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/context/SimpleAppProvider";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { useTheme } from "@/hooks/context/ThemeContext";
import { signInToBeta } from "@/lib/api/betaImport";

/**
 * On BETA: where "Open in beta" lands.
 *
 * The link carries a one-time code from the real site. Beta's server checks it
 * with the real site, which says who it belongs to, and signs that person in —
 * creating their beta account the first time. Nobody signs up on beta.
 *
 * The code is spent on first use, so it is dropped from the address bar before
 * anything else happens: a refresh or the back button must not replay it.
 */
export default function BetaSsoPage() {
  const router = useRouter();
  const auth = useAuth();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const workspace = params.get("workspace");
    window.history.replaceState(null, "", "/sso");

    if (!code) {
      setError(t("dashboard", "wsBetaSsoMissing"));
      return;
    }

    signInToBeta(code)
      .then((data) => {
        // The same session the login form stores.
        auth.login({
          token: data.accessToken,
          refreshToken: data.refreshToken,
          user: {
            id: data.user.id,
            name: `${data.user.firstName ?? ""} ${data.user.lastName ?? ""}`.trim() || data.user.email,
            email: data.user.email,
            // The server sends production's role as a plain string.
            role: (data.user.role || "user") as Parameters<typeof auth.login>[0]["user"]["role"],
            avatarUrl: undefined,
            createdAt: new Date(),
            lastLoginAt: new Date(),
            preferences: { notifications: true, emailUpdates: true, darkMode: false },
          },
        });
        if (workspace) localStorage.setItem("activeBusinessId", workspace);
        router.replace("/dashboard");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [auth, router, t]);

  return (
    <main className={`min-h-screen flex items-center justify-center px-4 ${isDark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      <div className={`w-full max-w-md rounded-2xl border p-6 space-y-2 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
        {error ? (
          <>
            <h1 className="text-lg font-semibold">{t("dashboard", "wsBetaSsoFailed")}</h1>
            <p role="alert" className="text-sm text-red-500">{error}</p>
          </>
        ) : (
          <p className="text-sm" aria-live="polite">{t("dashboard", "wsBetaSsoSigningIn")}</p>
        )}
      </div>
    </main>
  );
}
