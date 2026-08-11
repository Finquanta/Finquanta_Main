"use client";

import { Activity, Info } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { BrainPin, formatPinValue } from "@/lib/api/brain";
import { scoreColor } from "@/lib/api/health";

/**
 * A live data pin — a read-only window onto figures the platform already holds.
 *
 * This is the half of the Company Brain the user didn't write. Nothing here is
 * AI-generated or cached: every number comes straight from the ledger, the
 * health score and the groups report, so it can never disagree with what the
 * dashboard shows.
 */
export default function PinCard({ isDark, pin }: { isDark: boolean; pin: BrainPin }) {
  const { t } = useLanguage();

  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const border = isDark ? "border-gray-700" : "border-gray-200";

  if (!pin.available) return null;

  const health = pin.health;

  return (
    <div className={`rounded-xl border p-4 mb-4 ${card}`}>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-green-500" />
        <p className={`text-xs font-semibold uppercase tracking-wide ${sub}`}>
          {t("dashboard", "brainLiveData")}
        </p>
      </div>

      {health && (
        <div className={`flex items-center gap-4 pb-3 mb-3 border-b ${border}`}>
          {health.ready && health.score !== null ? (
            <>
              <div
                className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
                style={{ background: `${scoreColor(health.score)}20`, color: scoreColor(health.score) }}
              >
                {health.score}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${text}`}>{t("dashboard", "brainHealthScore")}</p>
                <p className={`text-xs ${sub}`}>
                  {health.trend === null
                    ? t("dashboard", "brainNoTrendYet")
                    : `${health.trend > 0 ? "▲" : health.trend < 0 ? "▼" : "■"} ${Math.abs(health.trend)} ${t("dashboard", "brainVsLastMonth")}`}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Info className={`h-4 w-4 flex-shrink-0 ${sub}`} />
              <p className={`text-xs ${sub}`}>
                {t("dashboard", "brainHealthCollecting")} ({health.daysOfData}/{health.daysRequired})
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-3">
        {pin.metrics.map((m) => (
          <div key={m.key}>
            <p className={`text-[11px] uppercase tracking-wide ${sub}`}>{t("dashboard", `brainPin_${m.key}`)}</p>
            <p className={`text-sm font-semibold tabular-nums ${text}`}>{formatPinValue(m)}</p>
          </div>
        ))}
      </div>

      {/* The four ratios, when this pin carries a health score. */}
      {health?.ready && health.ratios.length > 0 && (
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t ${border}`}>
          {health.ratios.map((r) => (
            <div key={r.key}>
              <p className={`text-[11px] uppercase tracking-wide ${sub}`}>{r.label}</p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: scoreColor(r.score) }}>
                {r.value === null ? "—" : r.format === "percent" ? `${r.value}%` : `${r.value}×`}
              </p>
            </div>
          ))}
        </div>
      )}

      {pin.noteKey && (
        <p className={`flex items-start gap-1.5 text-[11px] mt-3 ${sub}`}>
          <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
          {t("dashboard", `brain_${pin.noteKey}`)}
        </p>
      )}
    </div>
  );
}
