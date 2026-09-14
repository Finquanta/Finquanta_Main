"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { useTheme } from "@/hooks/context/ThemeContext";
import { getMembers, listBusinesses, type Business, type BusinessMember } from "@/lib/api/businesses";
import { createBetaImportLink } from "@/lib/api/betaImport";
import { rememberPostAuthPath } from "@/lib/pendingInvite";

/**
 * On the REAL site (app.finquanta.ai): choose which workspace to copy into
 * beta, and which members may test it there.
 *
 * Reached from the "Import my real books" item on beta. Confirming here, signed
 * in as the real owner, is what authorises the copy — beta never holds a key to
 * the real site, only the one-time link this page produces.
 */
export default function BetaImportPage() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [owned, setOwned] = useState<Business[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [businessId, setBusinessId] = useState("");
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hasSession = Boolean(localStorage.getItem("accessToken"));
    setSignedIn(hasSession);
    if (!hasSession) return;
    listBusinesses()
      .then((list) => {
        // Only an owner can copy a workspace; the server refuses anyone else.
        const mine = list.filter((b) => b.role === "Owner");
        setOwned(mine);
        const active = localStorage.getItem("activeBusinessId");
        setBusinessId(mine.find((b) => b.id === active)?.id ?? mine[0]?.id ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!businessId) {
      setMembers([]);
      return;
    }
    getMembers(businessId)
      .then((list) => {
        const others = list.filter((m) => m.role !== "Owner");
        setMembers(others);
        // Start from whoever was ticked last time.
        setTicked(new Set(others.filter((m) => m.betaTester).map((m) => m.userId)));
      })
      .catch(() => setMembers([]));
  }, [businessId]);

  const logIn = () => {
    rememberPostAuthPath("/beta-import");
    window.location.href = "/login";
  };

  const toggle = (userId: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const continueToBeta = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await createBetaImportLink(businessId, [...ticked]);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const card = isDark ? "bg-gray-800 border-gray-700 text-gray-100" : "bg-white border-gray-200 text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const field = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";

  return (
    <main className={`min-h-screen flex items-center justify-center px-4 py-10 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
      <div className={`w-full max-w-lg rounded-2xl border p-6 space-y-5 ${card}`}>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold">{t("dashboard", "bimpTitle")}</h1>
          <p className={`text-sm ${sub}`}>{t("dashboard", "bimpIntro")}</p>
        </div>

        {signedIn === false && (
          <div className="space-y-3">
            <p className="text-sm">{t("dashboard", "bimpLoginFirst")}</p>
            <button onClick={logIn} className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5">
              {t("dashboard", "bimpLogin")}
            </button>
          </div>
        )}

        {signedIn && loaded && owned.length === 0 && !error && (
          <p className="text-sm">{t("dashboard", "bimpNoOwned")}</p>
        )}

        {signedIn && owned.length > 0 && (
          <>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">{t("dashboard", "bimpWorkspace")}</span>
              <select
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${field}`}
              >
                {owned.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("dashboard", "bimpMembers")}</p>
              <p className={`text-xs ${sub}`}>{t("dashboard", "bimpMembersHint")}</p>
              {members.length === 0 ? (
                <p className={`text-sm ${sub}`}>{t("dashboard", "bimpNoMembers")}</p>
              ) : (
                <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                  {members.map((m) => (
                    <li key={m.userId}>
                      <label className="flex items-center gap-3 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ticked.has(m.userId)}
                          onChange={() => toggle(m.userId)}
                          className="h-4 w-4"
                        />
                        <span className="min-w-0">
                          <span className="block truncate">{m.name || m.email}</span>
                          <span className={`block text-xs truncate ${sub}`}>{m.email} · {m.role}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={`text-xs space-y-1 ${sub}`}>
              <p>{t("dashboard", "bimpIncludes")}</p>
              <p>{t("dashboard", "bimpRefreshNote")}</p>
            </div>

            <button
              onClick={continueToBeta}
              disabled={busy || !businessId}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5"
            >
              {busy ? t("dashboard", "bimpWorking") : t("dashboard", "bimpContinue")}
            </button>
          </>
        )}

        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      </div>
    </main>
  );
}
