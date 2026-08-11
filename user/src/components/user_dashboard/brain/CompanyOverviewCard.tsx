"use client";

import { useEffect, useState } from "react";
import { Pencil, Building2, Upload } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import {
  BusinessProfile, getBusinessProfile, saveBusinessProfile, uploadBusinessLogo,
} from "@/lib/api/business";

/**
 * The Company Overview card — the first node in the Brain.
 *
 * This is the business's identity card: who it is, pulled from the answers it
 * already gave at onboarding. The CEO category further down is where the
 * *thinking* lives. Keeping them separate is deliberate — the overview stays
 * short and permanent while the categories fill up.
 *
 * Everything here reads GET /v1/me/business, which is keyed by user rather than
 * by business. That's a pre-existing quirk of the profile table, correct for
 * the single-workspace case; a user with two workspaces sees one shared profile.
 */
export default function CompanyOverviewCard({
  isDark, businessName,
}: {
  isDark: boolean;
  /** The active workspace's name, which IS per-business. Preferred over the
   *  profile's own name so switching workspace visibly changes the card. */
  businessName?: string | null;
}) {
  const { t } = useLanguage();

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BusinessProfile>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  /**
   * The logo has its own multipart endpoint, so it uploads immediately on pick
   * rather than waiting for Save — same as Profile Settings. PNG/JPEG, max 1MB;
   * the server rejects anything else and the message is surfaced inline.
   */
  const pickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setError(null);
    try {
      const saved = await uploadBusinessLogo(file);
      setProfile((p) => ({ ...(p ?? {}), logoUrl: saved.logoUrl }));
      setForm((p) => ({ ...p, logoUrl: saved.logoUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard", "errUploadLogo"));
    } finally {
      setLogoUploading(false);
      // Clear the input so re-picking the same file still fires onChange.
      e.target.value = "";
    }
  };

  const load = () => {
    getBusinessProfile()
      .then((p) => { setProfile(p); setForm(p); })
      .catch(() => setError(t("dashboard", "brainErrOverview")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Refetch when the workspace changes, so the card never keeps showing a
    // previous workspace's details.
    const handler = () => { setEditing(false); load(); };
    window.addEventListener("finna:businessChanged", handler);
    return () => window.removeEventListener("finna:businessChanged", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await saveBusinessProfile({
        businessName: form.businessName,
        description: form.description,
        niche: form.niche,
        industry: form.industry,
        maturityStage: form.maturityStage,
        employeeCount: form.employeeCount,
        primaryGoal: form.primaryGoal,
        foundedDate: form.foundedDate,
      });
      setProfile(saved);
      setForm(saved);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard", "brainErrOverviewSave"));
    } finally {
      setSaving(false);
    }
  };

  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";
  const field = `w-full text-sm rounded-lg px-3 py-2 border outline-none ${input}`;

  if (loading) {
    return (
      <div className={`rounded-xl border p-5 mb-5 ${card}`}>
        <p className={`text-sm ${sub}`}>{t("dashboard", "brainLoading")}</p>
      </div>
    );
  }

  const facts: { label: string; value?: string }[] = [
    { label: t("dashboard", "brainIndustry"), value: profile?.industry },
    { label: t("dashboard", "brainNiche"), value: profile?.niche },
    { label: t("dashboard", "brainMaturity"), value: profile?.maturityStage },
    { label: t("dashboard", "brainTeamSize"), value: profile?.employeeCount },
    { label: t("dashboard", "brainFounded"), value: profile?.foundedDate },
    { label: t("dashboard", "brainPrimaryGoal"), value: profile?.primaryGoal },
  ];

  if (editing) {
    return (
      <form onSubmit={save} className={`rounded-xl border p-5 mb-5 ${card}`}>
        <h2 className={`text-base font-bold mb-4 ${text}`}>{t("dashboard", "brainOverviewEdit")}</h2>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "invBusinessLogo")}</label>
            <div className="flex items-center gap-3">
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="" className="h-14 w-14 rounded-lg object-contain bg-white border flex-shrink-0" />
              ) : (
                <div className={`h-14 w-14 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
                  <Building2 className={`h-6 w-6 ${sub}`} />
                </div>
              )}
              <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium cursor-pointer ${
                isDark ? "border-gray-600 text-gray-200 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
              } ${logoUploading ? "opacity-60 pointer-events-none" : ""}`}>
                <Upload className="h-3.5 w-3.5" />
                {logoUploading ? t("dashboard", "brainSaving") : t("dashboard", "brainChangeLogo")}
                <input type="file" accept="image/png,image/jpeg" className="hidden"
                  disabled={logoUploading} onChange={pickLogo} />
              </label>
              <span className={`text-[11px] ${sub}`}>{t("dashboard", "brainLogoHint")}</span>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "brainBusinessName")}</label>
            <input value={form.businessName ?? ""} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "brainDescription")}</label>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t("dashboard", "brainDescriptionHint")}
              className={`${field} min-h-[70px]`}
            />
          </div>
          <div>
            <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "brainIndustry")}</label>
            <input value={form.industry ?? ""} onChange={(e) => setForm({ ...form, industry: e.target.value })} className={field} />
          </div>
          <div>
            <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "brainNiche")}</label>
            <input value={form.niche ?? ""} onChange={(e) => setForm({ ...form, niche: e.target.value })} className={field} />
          </div>
          <div>
            <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "brainMaturity")}</label>
            <input value={form.maturityStage ?? ""} onChange={(e) => setForm({ ...form, maturityStage: e.target.value })} className={field} />
          </div>
          <div>
            <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "brainTeamSize")}</label>
            <input value={form.employeeCount ?? ""} onChange={(e) => setForm({ ...form, employeeCount: e.target.value })} className={field} />
          </div>
          <div>
            <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "brainFounded")}</label>
            <input type="date" value={form.foundedDate ?? ""} onChange={(e) => setForm({ ...form, foundedDate: e.target.value })} className={field} />
          </div>
          <div>
            <label className={`block text-xs mb-1 ${sub}`}>{t("dashboard", "brainPrimaryGoal")}</label>
            <input value={form.primaryGoal ?? ""} onChange={(e) => setForm({ ...form, primaryGoal: e.target.value })} className={field} />
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <button type="button" onClick={() => { setEditing(false); setForm(profile ?? {}); }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border ${isDark ? "border-gray-600" : "border-gray-300"} ${text}`}>
            {t("dashboard", "invCancel")}
          </button>
          <button type="submit" disabled={saving}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm">
            {saving ? t("dashboard", "brainSaving") : t("dashboard", "brainSaveChanges")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={`rounded-xl border p-5 mb-5 ${card}`}>
      <div className="flex items-start gap-4">
        {profile?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.logoUrl} alt="" className="h-14 w-14 rounded-lg object-contain flex-shrink-0" />
        ) : (
          <div className={`h-14 w-14 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
            <Building2 className={`h-6 w-6 ${sub}`} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            {/* The workspace name wins: it is stored per business, whereas the
                onboarding profile below is stored per user and is therefore
                shared across all of this account's workspaces. */}
            <h2 className={`text-lg font-bold truncate ${text}`}>
              {businessName || profile?.businessName || t("dashboard", "brainUnnamedBusiness")}
            </h2>
            <button onClick={() => setEditing(true)} className={`flex-shrink-0 ${sub} hover:text-blue-500`}
              title={t("dashboard", "brainOverviewEdit")}>
              <Pencil className="h-4 w-4" />
            </button>
          </div>
          <p className={`text-sm mt-1 ${profile?.description ? sub : `italic ${sub}`}`}>
            {profile?.description || t("dashboard", "brainDescriptionEmpty")}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 mt-4">
            {facts.map((f) => (
              <div key={f.label}>
                <p className={`text-[11px] uppercase tracking-wide ${sub}`}>{f.label}</p>
                <p className={`text-sm ${f.value ? text : sub}`}>{f.value || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
    </div>
  );
}
