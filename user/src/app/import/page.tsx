"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { useTheme } from "@/hooks/context/ThemeContext";
import { runBetaImport, type BetaImportResult } from "@/lib/api/betaImport";
import { rememberPostAuthPath } from "@/lib/pendingInvite";
import { realAppUrl } from "@/lib/hosts";

type Phase = "starting" | "noCode" | "needLogin" | "copying" | "done" | "failed";

/**
 * On BETA: receive the one-time link from the real site and copy the workspace in.
 *
 * The code is spent the moment the server redeems it, so this runs once per
 * page load and then drops the code from the address bar — a refresh must not
 * look like a second, failing import.
 */
export default function ImportPage() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [phase, setPhase] = useState<Phase>("starting");
  const [result, setResult] = useState<BetaImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      setPhase("noCode");
      return;
    }
    if (!localStorage.getItem("accessToken")) {
      // Back here, code intact, once they have logged in (or signed up) on beta.
      rememberPostAuthPath(`/import?code=${encodeURIComponent(code)}`);
      setPhase("needLogin");
      return;
    }

    setPhase("copying");
    runBetaImport(code)
      .then((r) => {
        setResult(r);
        setPhase("done");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("failed");
      })
      .finally(() => window.history.replaceState(null, "", "/import"));
  }, []);

  const openWorkspace = () => {
    if (!result) return;
    localStorage.setItem("activeBusinessId", result.businessId);
    window.location.href = "/dashboard";
  };

  const startAgain = () => {
    window.location.href = realAppUrl("/beta-import") ?? "/dashboard";
  };

  const card = isDark ? "bg-gray-800 border-gray-700 text-gray-100" : "bg-white border-gray-200 text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const primary = "w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5";

  return (
    <main className={`min-h-screen flex items-center justify-center px-4 py-10 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
      <div className={`w-full max-w-lg rounded-2xl border p-6 space-y-4 ${card}`}>
        <h1 className="text-xl font-semibold">{t("dashboard", "bimpTitle")}</h1>

        {phase === "noCode" && (
          <>
            <p className="text-sm">{t("dashboard", "bimpNoCode")}</p>
            <button onClick={startAgain} className={primary}>{t("dashboard", "bimpTryAgain")}</button>
          </>
        )}

        {phase === "needLogin" && (
          <>
            <p className="text-sm">{t("dashboard", "bimpLoginFirst")}</p>
            <button onClick={() => { window.location.href = "/login"; }} className={primary}>
              {t("dashboard", "bimpLogin")}
            </button>
          </>
        )}

        {(phase === "starting" || phase === "copying") && (
          <p className={`text-sm ${sub}`} aria-live="polite">{t("dashboard", "bimpCopying")}</p>
        )}

        {phase === "done" && result && (
          <>
            <p className="text-base font-medium">{t("dashboard", "bimpDone")}</p>
            <p className="text-sm">{result.businessName}</p>
            {result.filesFailed > 0 && (
              <p className="text-sm text-amber-600">{t("dashboard", "bimpFilesFailed")}</p>
            )}
            <button onClick={openWorkspace} className={primary}>{t("dashboard", "bimpOpen")}</button>
          </>
        )}

        {phase === "failed" && (
          <>
            <p className="text-base font-medium">{t("dashboard", "bimpFailed")}</p>
            {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
            <button onClick={startAgain} className={primary}>{t("dashboard", "bimpTryAgain")}</button>
          </>
        )}
      </div>
    </main>
  );
}
