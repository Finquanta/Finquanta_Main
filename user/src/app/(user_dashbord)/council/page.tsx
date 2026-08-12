"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, Loader2, Send, ChevronDown, ChevronUp, Scale, AlertTriangle,
  CheckCircle2, XCircle, CircleDot, ArrowRight, BrainCircuit,
} from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import { useLanguage } from "@/hooks/context/LanguageContext";
import DashboardShell from "@/components/user_dashboard/DashboardShell";
import {
  CouncilOverview, CouncilSession, Outcome, Vote,
  conveneCouncil, getCouncilOverview, getCouncilSession, recordCouncilOutcome,
} from "@/lib/api/council";

/**
 * The Finna Council — four specialists debate a decision.
 *
 * The whole page is inert until the user types a question and presses convene.
 * Nothing here polls, refreshes on a timer, or convenes on its own: spec §5
 * makes "never runs automatically" the first cost rule, and the UI has to
 * honour that as much as the server does.
 */

const VOTE_ICON: Record<Vote, typeof CheckCircle2> = {
  support: CheckCircle2,
  oppose: XCircle,
  conditional: CircleDot,
};

const VOTE_TONE: Record<Vote, string> = {
  support: "text-emerald-500",
  oppose: "text-red-500",
  conditional: "text-amber-500",
};

export default function CouncilPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [overview, setOverview] = useState<CouncilOverview | null>(null);
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState<CouncilSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const field = `w-full rounded-lg border px-3 py-2 text-sm outline-none ${
    isDark
      ? "bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-500"
      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
  }`;

  const load = useCallback(() => {
    getCouncilOverview().then(setOverview).catch(() => setOverview(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  /**
   * `?session=<id>` opens one straight away — the widget's "Full transcript"
   * link lands here. Read off `window.location` rather than `useSearchParams`
   * so the page doesn't need a Suspense boundary just to read one param.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("session");
    if (!id) return;
    getCouncilSession(id).then((s) => { setActive(s); setShowTranscript(true); }).catch(() => {});
  }, []);

  const convene = async () => {
    if (question.trim().length < 10 || running) return;
    setRunning(true);
    setError(null);
    setActive(null);
    setShowTranscript(false);
    try {
      const session = await conveneCouncil(question.trim());
      setActive(session);
      setQuestion("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "councilError"));
    } finally {
      setRunning(false);
    }
  };

  /** Free — reads the stored transcript, no AI call. */
  const openPast = async (id: string) => {
    setError(null);
    setShowTranscript(false);
    try {
      setActive(await getCouncilSession(id));
    } catch {
      setError(t("dashboard", "councilError"));
    }
  };

  const quota = overview?.quota;
  const outOfQuota = quota ? !quota.allowed : false;
  const verdict = active?.verdict ?? null;

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-purple-500" />
          <h1 className={`text-xl font-semibold ${text}`}>{t("dashboard", "councilTitle")}</h1>
        </div>
        <p className={`text-sm ${sub} mb-1`}>{t("dashboard", "councilSubtitle")}</p>
        <p className={`text-[11px] ${sub} mb-5`}>{t("dashboard", "councilNotAdvice")}</p>

        {/* Ask */}
        <div className={`rounded-xl border ${card} p-4 mb-6`}>
          <label className={`block text-xs mb-2 ${sub}`}>{t("dashboard", "councilAskLabel")}</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("dashboard", "councilPlaceholder")}
            rows={3}
            disabled={running || outOfQuota}
            className={`${field} resize-y min-h-[80px]`}
          />

          <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
            {quota && (
              <p className={`text-[11px] ${outOfQuota ? "text-amber-500" : sub}`}>
                {outOfQuota
                  ? t("dashboard", quota.scope === "global" ? "councilQuotaGlobal" : "councilQuotaSpent")
                  : `${quota.limit - quota.used} ${t("dashboard", "councilQuotaLeft")}`}
              </p>
            )}
            <button
              onClick={convene}
              disabled={question.trim().length < 10 || running || outOfQuota}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm disabled:opacity-40"
            >
              {running
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("dashboard", "councilDeliberating")}</>
                : <><Send className="w-4 h-4" /> {t("dashboard", "councilConvene")}</>}
            </button>
          </div>

          {running && (
            <p className={`text-[11px] mt-2 ${sub}`}>{t("dashboard", "councilTakesAMoment")}</p>
          )}
          {error && <p className="text-xs mt-2 text-red-500">{error}</p>}
        </div>

        {/* The result */}
        {active && verdict && (
          <div className={`rounded-xl border ${card} p-4 mb-6`}>
            <p className={`text-[11px] ${sub} mb-1`}>{t("dashboard", "councilOnQuestion")}</p>
            <p className={`text-sm font-medium mb-4 ${text}`}>{active.question}</p>

            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-4 h-4 text-purple-500" />
              <h2 className={`text-sm font-semibold ${text}`}>{t("dashboard", "councilVerdict")}</h2>
            </div>
            <p className={`text-sm mb-4 whitespace-pre-wrap ${text}`}>{verdict.verdict}</p>

            {/* Votes — disagreement made visible, which is the whole point. */}
            {verdict.votes.length > 0 && (
              <div className="mb-4">
                <h3 className={`text-xs font-semibold mb-2 ${sub}`}>{t("dashboard", "councilVotes")}</h3>
                <div className="space-y-1.5">
                  {verdict.votes.map((v, i) => {
                    const Icon = VOTE_ICON[v.vote] ?? CircleDot;
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${VOTE_TONE[v.vote] ?? sub}`} />
                        <p className={`text-xs ${text}`}>
                          <span className="font-medium">{v.member}</span>
                          <span className={sub}> — {v.because}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {verdict.keyTension && (
              <div className={`rounded-lg border p-3 mb-4 ${
                isDark ? "border-amber-500/30 bg-amber-500/5" : "border-amber-200 bg-amber-50"
              }`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {t("dashboard", "councilKeyTension")}
                  </h3>
                </div>
                <p className={`text-xs ${text}`}>{verdict.keyTension}</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              {verdict.conditions.length > 0 && (
                <div>
                  <h3 className={`text-xs font-semibold mb-1.5 ${sub}`}>{t("dashboard", "councilConditions")}</h3>
                  <ul className="space-y-1">
                    {verdict.conditions.map((c, i) => (
                      <li key={i} className={`text-xs ${text}`}>• {c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {verdict.watchItems.length > 0 && (
                <div>
                  <h3 className={`text-xs font-semibold mb-1.5 ${sub}`}>{t("dashboard", "councilWatch")}</h3>
                  <ul className="space-y-1">
                    {verdict.watchItems.map((w, i) => (
                      <li key={i} className={`text-xs ${text}`}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {verdict.nextAction && (
              <div className="flex items-start gap-2 mb-4">
                <ArrowRight className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                <p className={`text-sm ${text}`}>
                  <span className={`font-medium`}>{t("dashboard", "councilNextAction")}: </span>
                  {verdict.nextAction}
                </p>
              </div>
            )}

            {/* The transcript is what builds trust — most people read the
                summary, but it has to be there to be checked. */}
            <button
              onClick={() => setShowTranscript((s) => !s)}
              className={`text-xs ${sub} hover:text-purple-500 flex items-center gap-1`}
            >
              {showTranscript ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {t("dashboard", "councilTranscript")}
            </button>

            {showTranscript && (
              <div className="mt-3 space-y-4">
                <div>
                  <h3 className={`text-xs font-semibold mb-2 ${sub}`}>{t("dashboard", "councilOpenings")}</h3>
                  <div className="space-y-2">
                    {active.openings.map((o, i) => (
                      <div key={i} className={`rounded-lg border p-2.5 ${card}`}>
                        <p className={`text-xs font-medium mb-1 ${text}`}>{o.member}</p>
                        <p className={`text-xs ${sub}`}>{o.position}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {active.crossExamination.length > 0 && (
                  <div>
                    <h3 className={`text-xs font-semibold mb-2 ${sub}`}>{t("dashboard", "councilCrossExam")}</h3>
                    <div className="space-y-2">
                      {active.crossExamination.map((c, i) => (
                        <div key={i} className={`rounded-lg border p-2.5 ${card}`}>
                          <p className={`text-xs font-medium mb-1 ${text}`}>{c.member}</p>
                          <p className={`text-xs ${sub}`}>{c.position}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Outcome review (§7). Only once the decision is old enough to
                judge — asking the day it was made would be noise. */}
            {active.reviewDueAt && new Date(active.reviewDueAt) <= new Date() && (
              <div className={`mt-4 rounded-lg border p-3 ${card}`}>
                {active.outcome ? (
                  <p className={`text-xs ${sub}`}>
                    {t("dashboard", "councilOutcomeRecorded")}:{" "}
                    <span className={text}>{t("dashboard", `councilOutcome_${active.outcome}`)}</span>
                  </p>
                ) : (
                  <>
                    <p className={`text-xs font-semibold mb-2 ${text}`}>
                      {t("dashboard", "councilOutcomeAsk")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(["worked", "mixed", "did_not_work", "not_done"] as Outcome[]).map((o) => (
                        <button
                          key={o}
                          onClick={async () => {
                            const updated = await recordCouncilOutcome(active.id, o).catch(() => null);
                            if (updated) { setActive(updated); load(); }
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg border ${card} hover:border-purple-400 ${text}`}
                        >
                          {t("dashboard", `councilOutcome_${o}`)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {active.brainNodeId && (
              <Link
                href={`/brain?node=${active.brainNodeId}`}
                className="flex items-center gap-1.5 text-xs text-purple-500 hover:underline mt-4"
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                {t("dashboard", "councilSavedToBrain")}
              </Link>
            )}
          </div>
        )}

        {/* Past sessions — free to reopen. */}
        {overview && overview.sessions.length > 0 && (
          <div className={`rounded-xl border ${card} p-4`}>
            <h2 className={`text-sm font-semibold mb-1 ${text}`}>{t("dashboard", "councilPast")}</h2>
            <p className={`text-[11px] ${sub} mb-3`}>{t("dashboard", "councilPastFree")}</p>
            <div className="space-y-1.5">
              {overview.sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openPast(s.id)}
                  className={`w-full text-left rounded-lg border p-2.5 ${card} hover:border-purple-400`}
                >
                  <p className={`text-xs ${text}`}>{s.question}</p>
                  <p className={`text-[11px] ${sub}`}>
                    {new Date(s.createdAt).toLocaleDateString()}
                    {s.status === "failed" && ` · ${t("dashboard", "councilFailed")}`}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
