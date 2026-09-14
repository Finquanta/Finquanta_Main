"use client";

import { useEffect, useState } from "react";
import { FlaskConical, RefreshCw } from "lucide-react";
import Switch from "./Switch";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { getMembers, listBusinesses, type Business, type BusinessMember } from "@/lib/api/businesses";
import {
  getWorkspaceBeta,
  openInBeta,
  refreshWorkspaceBeta,
  setWorkspaceBeta,
  type WorkspaceBeta,
} from "@/lib/api/betaImport";
import { parseHost } from "@/lib/hosts";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Workspace settings → Beta.
 *
 * A beta workspace is copied into beta.finquanta.ai, where new features can be
 * tried on real numbers without touching the real books. The owner turns it
 * on (which starts the copy), picks who may test it, and refreshes the copy
 * when they want fresh data. "Open in beta" goes there signed in.
 *
 * Scoped to the active workspace, like the other tabs.
 */
export default function BetaSettings({ isDark }: { isDark: boolean }) {
  const { t } = useLanguage();
  const [onBetaSite, setOnBetaSite] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [beta, setBeta] = useState<WorkspaceBeta | null>(null);
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Beta itself has nothing to manage: its copies are driven from the real site.
    if (parseHost(window.location.host).kind === "beta") {
      setOnBetaSite(true);
      return;
    }
    const activeId = localStorage.getItem("activeBusinessId");
    listBusinesses()
      .then(async (list) => {
        const current = list.find((b) => b.id === activeId) ?? list[0] ?? null;
        setBusiness(current);
        if (!current) return;
        const [state, people] = await Promise.all([getWorkspaceBeta(current.id), getMembers(current.id)]);
        setBeta(state);
        const others = people.filter((m) => m.role !== "Owner");
        setMembers(others);
        setTicked(new Set(others.filter((m) => m.betaTester).map((m) => m.userId)));
      })
      .catch((e) => setError(message(e)));
  }, []);

  // While a copy runs, check back every few seconds so the status moves on its own.
  const copying = beta?.copyStatus === "copying";
  useEffect(() => {
    if (!business || !copying) return;
    const timer = setInterval(() => {
      getWorkspaceBeta(business.id).then(setBeta).catch(() => undefined);
    }, 5000);
    return () => clearInterval(timer);
  }, [business, copying]);

  const run = async (change: () => Promise<WorkspaceBeta>) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      setBeta(await change());
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (userId: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const isOwner = business?.role === "Owner";
  const canOpen = Boolean(beta?.enabled && (isOwner || business?.betaTester));

  const box = `rounded-xl border p-4 ${isDark ? "border-gray-700" : "border-gray-200"}`;
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const secondary = `rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 ${
    isDark ? "border-gray-600 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"
  }`;

  const status = (() => {
    if (!beta) return "";
    if (beta.copyStatus === "copying") return t("dashboard", "wsBetaStatusCopying");
    if (beta.copyStatus === "failed") return t("dashboard", "wsBetaStatusFailed");
    if (beta.copyStatus === "done" && beta.copiedAt) {
      return `${t("dashboard", "wsBetaStatusDone")} ${new Date(beta.copiedAt).toLocaleString()}`;
    }
    return t("dashboard", "wsBetaStatusNone");
  })();

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-violet-500" />
          {t("dashboard", "wsBetaTitle")}
        </h3>
        <p className={`text-sm ${sub}`}>{t("dashboard", "wsBetaIntro")}</p>
      </div>

      {onBetaSite ? (
        <p className="text-sm">{t("dashboard", "wsBetaOnBetaNote")}</p>
      ) : beta && business ? (
        <>
          {!beta.configured && <p className="text-sm text-amber-600">{t("dashboard", "wsBetaNotSetUp")}</p>}

          <div className={`${box} flex items-center justify-between gap-4`}>
            <div className="min-w-0">
              <p className="text-sm font-medium">{t("dashboard", "wsBetaOn")}</p>
              <p className={`text-xs ${sub}`}>{t("dashboard", "wsBetaOffNote")}</p>
            </div>
            {isOwner ? (
              <Switch
                checked={beta.enabled}
                onChange={(enabled) => { if (!busy) run(() => setWorkspaceBeta(business.id, { enabled })); }}
              />
            ) : (
              <span className={`text-xs ${sub}`}>{t("dashboard", "wsBetaOwnerOnly")}</span>
            )}
          </div>

          {beta.enabled && (
            <div className={`${box} space-y-3`}>
              <p className="text-sm" aria-live="polite">{status}</p>
              {beta.copyStatus === "failed" && beta.copyError && (
                <p className="text-xs text-red-500">{beta.copyError}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {canOpen && (
                  <button
                    onClick={() => openInBeta(business.id).catch((e) => setError(message(e)))}
                    className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2"
                  >
                    {t("dashboard", "wsBetaOpen")}
                  </button>
                )}
                {isOwner && (
                  <button
                    onClick={() => run(() => refreshWorkspaceBeta(business.id))}
                    disabled={busy || copying || !beta.configured}
                    className={secondary}
                  >
                    <RefreshCw className="inline h-4 w-4 mr-1.5 -mt-0.5" />
                    {t("dashboard", "wsBetaRefresh")}
                  </button>
                )}
              </div>
              {isOwner && <p className={`text-xs ${sub}`}>{t("dashboard", "wsBetaRefreshHint")}</p>}
            </div>
          )}

          {isOwner && (
            <div className={`${box} space-y-3`}>
              <div>
                <p className="text-sm font-medium">{t("dashboard", "wsBetaTesters")}</p>
                <p className={`text-xs ${sub}`}>{t("dashboard", "wsBetaTestersHint")}</p>
              </div>
              {members.length === 0 ? (
                <p className={`text-sm ${sub}`}>{t("dashboard", "wsBetaNoMembers")}</p>
              ) : (
                <>
                  <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                    {members.map((m) => (
                      <li key={m.userId}>
                        <label className="flex items-center gap-3 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={ticked.has(m.userId)}
                            onChange={() => toggle(m.userId)}
                          />
                          <span className="min-w-0">
                            <span className="block truncate">{m.name || m.email}</span>
                            <span className={`block text-xs truncate ${sub}`}>{m.email} · {m.role}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      await run(() => setWorkspaceBeta(business.id, { memberUserIds: [...ticked] }));
                      setSaved(true);
                    }}
                    className={secondary}
                  >
                    {saved ? "✓ " : ""}{t("dashboard", "wsBetaSaveTesters")}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      ) : null}

      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
