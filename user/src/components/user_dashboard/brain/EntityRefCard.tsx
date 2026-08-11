"use client";

import Link from "next/link";
import { BookOpen, CircleAlert, ExternalLink, Layers, Receipt, Users } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { EntityType, ResolvedEntity, formatPinValue } from "@/lib/api/brain";

/**
 * A referenced ledger record, shown live.
 *
 * Every figure here was read at the moment the node was opened — nothing on
 * this card is stored on the node. That's what makes it safe to show money
 * beside a note: an invoice that got paid says paid, and a record that got
 * deleted says so instead of quoting a number that stopped being true.
 */

export const ENTITY_ICON: Record<EntityType, typeof Receipt> = {
  customer: Users,
  invoice: Receipt,
  entry: BookOpen,
  group: Layers,
};

/** Invoice statuses that get their own colour. Anything else renders plain. */
const STATUS_TONE: Record<string, string> = {
  paid: "bg-green-500/15 text-green-500",
  overdue: "bg-red-500/15 text-red-500",
  sent: "bg-blue-500/15 text-blue-500",
  viewed: "bg-blue-500/15 text-blue-500",
  draft: "bg-gray-500/15 text-gray-400",
  cancelled: "bg-gray-500/15 text-gray-400",
};

export default function EntityRefCard({
  isDark, entity,
}: {
  isDark: boolean;
  entity: ResolvedEntity;
}) {
  const { t } = useLanguage();

  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const border = isDark ? "border-gray-700" : "border-gray-200";
  const shell = isDark ? "bg-gray-900/40" : "bg-gray-50";

  const Icon = ENTITY_ICON[entity.entityType];
  const typeLabel = t("dashboard", `brainEntity_${entity.entityType}`);

  // The record is gone. Say so plainly and keep everything the user wrote —
  // the reasoning in the note is still true even when the row isn't there.
  if (!entity.exists) {
    return (
      <div className={`rounded-xl border p-4 ${border} ${shell}`}>
        <div className="flex items-center gap-2 mb-1">
          <CircleAlert className="h-4 w-4 flex-shrink-0 text-amber-500" />
          <span className={`text-[11px] uppercase tracking-wide ${sub}`}>{typeLabel}</span>
        </div>
        <p className={`text-sm font-semibold ${text}`}>{t("dashboard", "brainRefMissing")}</p>
        <p className={`text-xs mt-1 ${sub}`}>{t("dashboard", "brainRefMissingHint")}</p>
      </div>
    );
  }

  const tone = entity.status ? STATUS_TONE[entity.status] : undefined;

  return (
    <div className={`rounded-xl border p-4 ${border} ${shell}`}>
      <div className="flex items-start gap-2 mb-3">
        <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${sub}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] uppercase tracking-wide ${sub}`}>
            {typeLabel}
            {entity.date ? ` · ${entity.date}` : ""}
          </p>
          <p className={`text-sm font-semibold break-words ${text}`}>{entity.title}</p>
        </div>
        {entity.status && (
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 ${
            tone ?? (isDark ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600")
          }`}>
            {tone
              ? t("dashboard", `brainRefStatus_${entity.status}`)
              : entity.status}
          </span>
        )}
      </div>

      {entity.metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {entity.metrics.map((m) => (
            <div key={m.key}>
              <p className={`text-[11px] ${sub}`}>{t("dashboard", `brainPin_${m.key}`)}</p>
              <p className={`text-sm font-semibold tabular-nums ${text}`}>{formatPinValue(m)}</p>
            </div>
          ))}
        </div>
      )}

      <div className={`flex items-center justify-between gap-2 mt-3 pt-3 border-t ${border}`}>
        <p className={`text-[11px] ${sub}`}>{t("dashboard", "brainRefLiveNote")}</p>
        {entity.href && (
          <Link href={entity.href}
            className="flex items-center gap-1 text-xs font-semibold text-blue-500 hover:underline flex-shrink-0">
            {t("dashboard", "brainRefOpenRecord")}<ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
