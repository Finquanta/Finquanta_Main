"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, HeartPulse } from "lucide-react";
import { HealthScore, Ratio, formatRatio, getHealthScore, scoreColor } from "@/lib/api/health";
import { useLanguage } from "@/hooks/context/LanguageContext";

/**
 * Section 11 — the Financial Health Score card, top of the dashboard.
 *
 * Collapsed: the overall score plus the four sub-scores as compact bars.
 * Expanded: each ratio with its value, trend and plain-language explanation.
 * Below ~30 days of data it shows progress toward the first score instead of a
 * number — the spec is explicit that thin data must not produce advice.
 *
 * `source` exists so the Try-It Demo can render this exact card off its local
 * ledger instead of the authenticated endpoint. Defaults to the real fetch.
 */

/**
 * The ratio names, labels and explanations arrive from the API in English —
 * the server has no idea what language the reader uses. They are fixed per
 * ratio though, and `key` is a stable union, so the client can translate them
 * from the key alone without any round trip.
 */
const CAP: Record<string, string> = {
  liquidity: "Liquidity", profitability: "Profitability",
  debtRisk: "DebtRisk", cashFlow: "CashFlow",
};
const tRatio = (t: (ns: string, k: string) => string, kind: "hName" | "hLabel" | "hExp", key: string, fallback: string) => {
  const suffix = CAP[key];
  return suffix ? t("dashboard", kind + suffix) : fallback;
};

export default function HealthScoreCard({
  isDark, refreshKey, source = getHealthScore,
}: {
  isDark: boolean;
  refreshKey?: number;
  source?: () => Promise<HealthScore>;
}) {
  const { t } = useLanguage();
  const [data, setData] = useState<HealthScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    source()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // Both callers pass a stable reference: the default module function, or a
    // memo that only changes with the language — so this can't loop.
  }, [refreshKey, source]);

  const card = `rounded-2xl border ${isDark ? "bg-[#1e1e2e] border-gray-700" : "bg-white border-gray-200"}`;
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";

  if (loading) {
    return <div className={`${card} p-5`}><p className={`text-sm ${sub}`}>{t("dashboard", "healthLoading")}</p></div>;
  }
  if (!data) return null;

  return (
    <div className={card}>
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-5 flex items-center gap-5 flex-wrap sm:flex-nowrap"
      >
        {data.ready && data.score !== null ? (
          <ScoreRing score={data.score} isDark={isDark} />
        ) : (
          <CollectingRing days={data.daysOfData} required={data.daysRequired} isDark={isDark} t={t} />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-blue-500" />
            <h2 className={`text-base font-bold ${text}`}>{t("dashboard", "healthTitle")}</h2>
            {data.ready && data.trend !== null && data.trend !== 0 && (
              <Trend value={data.trend} suffix=" pts" />
            )}
          </div>
          <p className={`text-sm mt-1 ${sub} line-clamp-2`}>{summaryText(t, data)}</p>

          {data.ready && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-3">
              {data.ratios.map((r) => (
                <div key={r.key}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-medium ${sub}`}>{tRatio(t, "hLabel", r.key, r.label)}</span>
                    <span className="text-[11px] font-bold" style={{ color: scoreColor(r.score) }}>{r.score}</span>
                  </div>
                  <div className={`h-1.5 rounded-full mt-1 ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${r.score}%`, backgroundColor: scoreColor(r.score) }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={sub}>{open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
      </button>

      {/* Expanded — the full breakdown */}
      {open && (
        <div className={`border-t ${isDark ? "border-gray-700" : "border-gray-200"} p-5 pt-4 space-y-4`}>
          {!data.ready && (
            <p className={`text-sm ${sub}`}>{t("dashboard", "healthNotScored")}</p>
          )}
          {data.ratios.map((r) => (
            <RatioRow key={r.key} ratio={r} ready={data.ready} isDark={isDark} t={t} />
          ))}
          <p className={`text-xs ${sub} pt-1`}>
            {t("dashboard", "healthPeriodNote").replace("{days}", String(data.periodDays))}
          </p>
        </div>
      )}
    </div>
  );
}

function RatioRow({ ratio, ready, isDark, t }: { ratio: Ratio; ready: boolean; isDark: boolean; t: (ns: string, k: string) => string }) {
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <h3 className={`text-sm font-semibold ${text}`}>{tRatio(t, "hName", ratio.key, ratio.name)}</h3>
          <span className={`text-[11px] ${sub}`}>{tRatio(t, "hLabel", ratio.key, ratio.label)}</span>
        </div>
        <div className="flex items-baseline gap-2 shrink-0">
          <span className={`text-base font-bold ${text}`}>{formatRatio(ratio)}</span>
          {ratio.trend !== null && ratio.trend !== 0 && <Trend value={ratio.trend} />}
          {ready && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{ color: scoreColor(ratio.score), backgroundColor: `${scoreColor(ratio.score)}1a` }}>
              {ratio.score}
            </span>
          )}
        </div>
      </div>
      <p className={`text-xs mt-1 ${sub}`}>{tRatio(t, "hExp", ratio.key, ratio.explanation)}</p>
      <p className={`text-xs mt-1.5 ${text}`}>{insightText(t, ratio)}</p>
      {ratio.note && <p className={`text-[11px] mt-1 italic ${sub}`}>{ratio.noteKey ? t("dashboard", ratio.noteKey) : ratio.note}</p>}
    </div>
  );
}

/** The overall score, as a ring. */
function ScoreRing({ score, isDark }: { score: number; isDark: boolean }) {
  const color = scoreColor(score);
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const filled = (score / 100) * circumference;

  return (
    <div className="relative h-[84px] w-[84px] shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7"
          stroke={isDark ? "#374151" : "#f3f4f6"} />
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          stroke={color} strokeDasharray={`${filled} ${circumference}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>{score}</span>
        <span className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>/ 100</span>
      </div>
    </div>
  );
}

/** Progress toward the first score, before there's enough data to say anything. */
function CollectingRing({ days, required, isDark, t }: { days: number; required: number; isDark: boolean; t: (s: string, k: string) => string }) {
  const pct = Math.min(100, Math.round((days / required) * 100));
  const r = 34;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="relative h-[84px] w-[84px] shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7"
          stroke={isDark ? "#374151" : "#f3f4f6"} />
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          stroke="#3b82f6" strokeDasharray={`${(pct / 100) * circumference} ${circumference}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-blue-500">{days}</span>
        <span className={`text-[10px] leading-tight text-center ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          {/* The translation carries its own line break, so it can wrap where
              each language reads best inside the ring. */}
          {t("dashboard", "healthDays").replace("{n}", String(required)).split("\n").map((line, i) => (
            <span key={i}>{i > 0 && <br />}{line}</span>
          ))}
        </span>
      </div>
    </div>
  );
}

function Trend({ value, suffix = "" }: { value: number; suffix?: string }) {
  const up = value > 0;
  const flat = value === 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const color = flat ? "text-gray-400" : up ? "text-emerald-500" : "text-red-500";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${color}`}>
      <Icon className="h-3 w-3" />
      {up ? "+" : ""}{value}{suffix}
    </span>
  );
}

/**
 * Compose the summary in the reader's language from `summaryParts`. Falls back
 * to the server's English sentence for responses that predate that field.
 */
function summaryText(t: (ns: string, k: string) => string, data: HealthScore): string {
  const p = data.summaryParts;
  if (!p) return data.summary;
  const band = { strong: "hBandStrong", stable: "hBandStable", weak: "hBandWeak", strained: "hBandStrained" }[p.band];
  const best = tRatio(t, "hLabel", p.bestKey, p.bestKey);
  const worst = tRatio(t, "hLabel", p.worstKey, p.worstKey);
  const body = t("dashboard", "hSummaryBody").replace("{best}", best).replace("{worst}", worst);
  // Explicit map rather than string concatenation: a key built by joining
  // strings silently becomes a missing key if the union ever gains a member,
  // and renders the raw key to the user.
  const adviceKey = {
    liquidity: "hAdviceLiquidity", profitability: "hAdviceProfitability",
    debtRisk: "hAdviceDebtRisk", cashFlow: "hAdviceCashFlow",
  }[p.worstKey];
  const advice = adviceKey ? t("dashboard", adviceKey) : "";
  const nudge = p.goalAligned ? " " + t("dashboard", "hGoalAligned") : "";
  return `${t("dashboard", band)} ${body} ${advice}${nudge}`;
}

/**
 * Render a ratio's insight in the reader's language. The server sends which
 * sentence it chose plus the raw figures; we format the numbers with the user's
 * own locale so thousands separators and currency placement are right too.
 * Falls back to the server's English prose when insightParts is absent.
 */
function insightText(t: (ns: string, k: string) => string, ratio: Ratio): string {
  const p = ratio.insightParts;
  if (!p) return ratio.insight;
  // Key is `hI` + the server's branch name verbatim (hI + liqStrong). Do not
  // capitalise: the locale keys are `hIliqStrong`, and upper-casing produced
  // `hILiqStrong`, which missed every time and silently fell back to English.
  let out = t("dashboard", "hI" + p.key);
  // An unknown branch would render the raw key — show the English rather than that.
  if (!out || out.startsWith("dashboard.")) return ratio.insight;
  for (const [name, value] of Object.entries(p.v ?? {})) {
    const money = name === "margin" ? String(value) : "$" + value.toLocaleString();
    out = out.split("{" + name + "}").join(money);
  }
  return out;
}
