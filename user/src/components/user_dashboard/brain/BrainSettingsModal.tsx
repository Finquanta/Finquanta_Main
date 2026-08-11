"use client";

import { useEffect, useState } from "react";
import { X, Sparkles, Link2, ShieldCheck, Loader2 } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import {
  AccessLevel, ACCESS_LEVELS, BrainAccessMember, BrainSettings,
  getBrainAccess, getBrainSettings, setBrainAccess, updateBrainSettings,
} from "@/lib/api/brain";

/**
 * Brain settings — background enrichment (spec §7.1) and access (§10).
 *
 * The two toggles are deliberately not presented as equals. Auto-linking is
 * pure Postgres similarity: free, instant, on by default. Auto-summarizing
 * spends an AI call per changed note, so it is off until someone turns it on
 * and it says so in plain words rather than hiding the cost behind a switch.
 *
 * The access list only loads for owners and admins — the server refuses it for
 * anyone else, and the list itself names every member of the business.
 */
export default function BrainSettingsModal({
  isOpen, isDark, canManageAccess, onClose,
}: {
  isOpen: boolean;
  isDark: boolean;
  /** Owner or admin. Gates the access half of the modal. */
  canManageAccess: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  const [settings, setSettings] = useState<BrainSettings | null>(null);
  const [members, setMembers] = useState<BrainAccessMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getBrainSettings().catch(() => null),
      // Non-privileged members get a 403 here; that isn't an error worth
      // showing, the access section simply doesn't render for them.
      canManageAccess ? getBrainAccess().catch(() => null) : Promise.resolve(null),
    ])
      .then(([s, a]) => {
        if (s) setSettings(s);
        if (a) setMembers(a.members);
      })
      .finally(() => setLoading(false));
  }, [isOpen, canManageAccess]);

  const save = async (patch: Partial<BrainSettings>) => {
    if (!settings) return;
    // Optimistic: a toggle that waits on a round trip feels broken.
    const previous = settings;
    setSettings({ ...settings, ...patch });
    setBusy(true);
    try {
      setSettings(await updateBrainSettings(patch));
    } catch (e) {
      setSettings(previous);
      setError(e instanceof Error ? e.message : t("dashboard", "brainErrSettings"));
    } finally {
      setBusy(false);
    }
  };

  const changeLevel = async (userId: string, level: AccessLevel) => {
    setBusy(true);
    try {
      await setBrainAccess(userId, level);
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, level, explicit: true } : m))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "brainErrAccess"));
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const border = isDark ? "border-gray-700" : "border-gray-200";
  const input = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";

  const toggle = (on: boolean, set: (v: boolean) => void) => (
    <button
      onClick={() => set(!on)} disabled={busy}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
        on ? "bg-blue-500" : isDark ? "bg-gray-600" : "bg-gray-300"
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${on ? "translate-x-[19px]" : "translate-x-[3px]"}`} />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto ${isDark ? "bg-gray-800 text-white" : "bg-white text-gray-900"}`}
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b ${border}`}>
          <h2 className="text-lg font-bold">{t("dashboard", "brainSettings")}</h2>
          <button onClick={onClose} className={sub} aria-label={t("dashboard", "invCancel")}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <p className={`text-sm p-6 ${sub}`}>{t("dashboard", "brainLoading")}</p>
        ) : (
          <div className="p-6 space-y-5">
            {error && <p className="text-red-500 text-sm">{error}</p>}

            {settings && (
              <>
                <div className={`flex items-start gap-3 p-3 rounded-xl border ${border}`}>
                  <Link2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${text}`}>{t("dashboard", "brainAutoLink")}</p>
                    <p className={`text-xs mt-0.5 ${sub}`}>{t("dashboard", "brainAutoLinkHint")}</p>
                  </div>
                  {toggle(settings.autoLink, (v) => save({ autoLink: v }))}
                </div>

                <div className={`flex items-start gap-3 p-3 rounded-xl border ${border}`}>
                  <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${text}`}>{t("dashboard", "brainAutoSummarize")}</p>
                    <p className={`text-xs mt-0.5 ${sub}`}>{t("dashboard", "brainAutoSummarizeHint")}</p>

                    {/* The cap only means anything while summaries are on. */}
                    {settings.autoSummarize && (
                      <label className={`flex items-center gap-2 mt-3 text-xs ${sub}`}>
                        {t("dashboard", "brainDailyCap")}
                        <input
                          type="number" min={0} max={500}
                          value={settings.dailySummaryCap}
                          onChange={(e) => setSettings({ ...settings, dailySummaryCap: Number(e.target.value) })}
                          onBlur={(e) => save({ dailySummaryCap: Number(e.target.value) })}
                          className={`w-20 text-sm rounded-lg px-2 py-1 border outline-none ${input}`}
                        />
                      </label>
                    )}
                  </div>
                  {toggle(settings.autoSummarize, (v) => save({ autoSummarize: v }))}
                </div>
              </>
            )}

            {canManageAccess && members.length > 0 && (
              <div className={`border-t pt-5 ${border}`}>
                <p className={`flex items-center gap-1.5 text-sm font-semibold mb-1 ${text}`}>
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                  {t("dashboard", "brainAccessTitle")}
                </p>
                <p className={`text-xs mb-3 ${sub}`}>{t("dashboard", "brainAccessHint")}</p>

                <div className="flex flex-col gap-1.5">
                  {members.map((m) => (
                    <div key={m.userId} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${border}`}>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${text}`}>{m.name || m.email}</p>
                        <p className={`text-[11px] ${sub}`}>
                          {m.role}
                          {!m.explicit && ` · ${t("dashboard", "brainAccessDefault")}`}
                        </p>
                      </div>
                      <select
                        value={m.level} disabled={busy}
                        onChange={(e) => changeLevel(m.userId, e.target.value as AccessLevel)}
                        className={`text-xs rounded-lg px-2 py-1.5 border outline-none ${input}`}
                      >
                        {ACCESS_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {t("dashboard", `brainAccessLevel_${lvl}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {busy && (
              <p className={`flex items-center gap-1.5 text-xs ${sub}`}>
                <Loader2 className="h-3 w-3 animate-spin" />{t("dashboard", "brainSaving")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
