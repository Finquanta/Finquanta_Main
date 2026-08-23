"use client";

import { useEffect, useState } from 'react';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { BusinessProfile, getBusinessProfile, saveBusinessProfile, uploadBusinessLogo } from '@/lib/api/business';
import { COUNTRIES } from '@/lib/countries';

/**
 * The option lists this form offers.
 *
 * Copied from the page this moved out of, which in turn duplicates onboarding —
 * the same seven revenue bands are now written in three files. Worth collapsing
 * into one shared module, but not in the same change that moves the form:
 * changing what the options ARE while relocating where they live would make any
 * resulting bug impossible to attribute.
 */
const ENTITY_TYPES = ["Solopreneur", "Sole Proprietorship", "LLC", "Corporation", "Partnership", "Nonprofit", "Other"];
const MATURITY_STAGES = ["Idea", "Startup", "Early-stage", "Growth", "Established", "Mature"];
const REVENUE_RANGES = ["Pre-revenue", "Under $10k", "$10k–$50k", "$50k–$250k", "$250k–$1M", "$1M–$5M", "$5M+"];
const EMPLOYEE_COUNTS = ["Just me", "2–5", "6–10", "11–50", "51–200", "200+"];
const DEBT_ANSWERS = ["Yes", "No", "Not sure"];
const PRIMARY_GOALS = ["Grow revenue", "Reduce expenses", "Improve cash flow", "Get organized"];

/**
 * A workspace's business profile.
 *
 * Lifted out of the global profile settings page, where it never belonged: a
 * business profile describes a WORKSPACE, not a person, and someone with two
 * workspaces had one form that silently edited whichever happened to be
 * active. Here it sits beside the other two workspace-scoped tabs and the
 * heading says which workspace is being edited.
 *
 * The form markup is unchanged from the page it came from — moving it and
 * rewriting it at the same time is how fields get quietly dropped.
 *
 * NOTE for anyone touching the data layer: `business_profiles` is one row per
 * BUSINESS but still carries `user_id`. Joining on `user_id` multiplies rows,
 * and `ON CONFLICT (user_id)` raises 42P10. The API already handles this; do
 * not "simplify" it.
 */
export default function BusinessProfileSettings({ isDark }: { isDark: boolean }) {
  const { t } = useLanguage();
  const theme = isDark ? 'dark' : 'light';

  const [biz, setBiz] = useState<BusinessProfile>({});
  const [bizSaving, setBizSaving] = useState(false);
  const [bizSaved, setBizSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  // Re-read whenever the active workspace changes: the API is scoped by the
  // X-Business-Id header, so the same component shows a different profile.
  useEffect(() => { getBusinessProfile().then(setBiz).catch(() => {}); }, []);

  const setBizField = (key: keyof BusinessProfile, value: string) =>
    setBiz((p) => ({ ...p, [key]: value }));

  const saveBiz = async () => {
    setBizSaving(true);
    setBizSaved(false);
    try {
      const updated = await saveBusinessProfile(biz);
      setBiz(updated);
      setBizSaved(true);
      setTimeout(() => setBizSaved(false), 2500);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save business profile.');
    } finally {
      setBizSaving(false);
    }
  };

  const inputCls = `w-full border rounded-lg px-3 py-2 text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'}`;
  const labelCls = `text-sm mb-1 block ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`;

  return (
    <div className={`p-6 rounded-lg max-w-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
      <h2 className={`text-xl font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t('settings', 'bizProfile')}</h2>
      <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('settings', 'bizProfileDesc')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelCls}>{t('settings', 'fBusinessName')}</label>
          <input className={inputCls} value={biz.businessName ?? ''} onChange={(e) => setBizField('businessName', e.target.value)} placeholder={t("dashboard","psPhBizName")} />
        </div>
        <div>
          <label className={labelCls}>{t('settings', 'fBusinessType')}</label>
          <input className={inputCls} value={biz.businessType ?? ''} onChange={(e) => setBizField('businessType', e.target.value)} placeholder={t("dashboard","psPhBizType")} />
        </div>
        <div>
          <label className={labelCls}>{t('settings', 'fIndustry')}</label>
          <input className={inputCls} value={biz.industry ?? ''} onChange={(e) => setBizField('industry', e.target.value)} placeholder={t("dashboard","psPhIndustry")} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>{t('settings', 'fNiche')}</label>
          <input className={inputCls} value={biz.niche ?? ''} onChange={(e) => setBizField('niche', e.target.value)} placeholder={t("dashboard","psPhNiche")} />
        </div>
        <div>
          <label className={labelCls}>{t('settings', 'fStructure')}</label>
          <select className={inputCls} value={biz.entityType ?? ''} onChange={(e) => setBizField('entityType', e.target.value)}>
            <option value="">{t('settings', 'selectOption')}</option>
            {ENTITY_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('settings', 'fCountry')}</label>
          {/* A picker, not free text. This value is what the admin
              Overview groups workspaces by, so "USA" typed here and
              "United States" chosen at signup would be two countries. */}
          <select className={inputCls} value={biz.country ?? ''} onChange={(e) => setBizField('country', e.target.value)}>
            <option value="">Select a country…</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>{t('settings', 'fPlaceOfIncorporation')}</label>
          <input className={inputCls} value={biz.incorporationLocation ?? ''} onChange={(e) => setBizField('incorporationLocation', e.target.value)} placeholder={t("dashboard","psPhIncorporation")} />
        </div>
        <div>
          <label className={labelCls}>{t('settings', 'fMaturityStage')}</label>
          <select className={inputCls} value={biz.maturityStage ?? ''} onChange={(e) => setBizField('maturityStage', e.target.value)}>
            <option value="">{t('settings', 'selectOption')}</option>
            {MATURITY_STAGES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('settings', 'fRevenueRange')}</label>
          <select className={inputCls} value={biz.revenueRange ?? ''} onChange={(e) => setBizField('revenueRange', e.target.value)}>
            <option value="">{t('settings', 'selectOption')}</option>
            {REVENUE_RANGES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('settings', 'fEmployees')}</label>
          <select className={inputCls} value={biz.employeeCount ?? ''} onChange={(e) => setBizField('employeeCount', e.target.value)}>
            <option value="">{t('settings', 'selectOption')}</option>
            {EMPLOYEE_COUNTS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t("dashboard","psLoansOrDebt")}</label>
          <select className={inputCls} value={biz.hasDebt ?? ''} onChange={(e) => setBizField('hasDebt', e.target.value)}>
            <option value="">{t('settings', 'selectOption')}</option>
            {DEBT_ANSWERS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t("dashboard","psPrimaryGoal")}</label>
          <select className={inputCls} value={biz.primaryGoal ?? ''} onChange={(e) => setBizField('primaryGoal', e.target.value)}>
            <option value="">{t('settings', 'selectOption')}</option>
            {PRIMARY_GOALS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>{t('settings', 'fFinancialGoals')}</label>
          <textarea className={`${inputCls} min-h-[80px]`} value={biz.financialGoals ?? ''} onChange={(e) => setBizField('financialGoals', e.target.value)} placeholder={t("dashboard","psPhGoals")} />
        </div>
      </div>

      {/* Business Details — exactly what prints at the top of every invoice */}
      <div className={`mt-8 pt-6 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t("dashboard","psBizDetails")}</h3>
        <p className={`text-sm mb-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t("dashboard","psBizDetailsHint")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t("dashboard","invBusinessEmail")}</label>
            <input type="email" className={inputCls} value={biz.businessEmail ?? ''} onChange={(e) => setBizField('businessEmail', e.target.value)} placeholder="billing@yourbusiness.com" />
          </div>
          <div>
            <label className={labelCls}>{t("dashboard","invBusinessPhone")}</label>
            <input className={inputCls} value={biz.businessPhone ?? ''} onChange={(e) => setBizField('businessPhone', e.target.value)} placeholder="+1 555 000 0000" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>{t("dashboard","invWebsite")}</label>
            <input className={inputCls} value={biz.website ?? ''} onChange={(e) => setBizField('website', e.target.value)} placeholder={t("dashboard","invWebsite")} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>{t("dashboard","invBusinessAddress")}</label>
            <input className={`${inputCls} mb-2`} value={biz.addressLine1 ?? ''} onChange={(e) => setBizField('addressLine1', e.target.value)} placeholder={t("dashboard","invAddrLine1")} />
            <input className={inputCls} value={biz.addressLine2 ?? ''} onChange={(e) => setBizField('addressLine2', e.target.value)} placeholder={t("dashboard","invAddrLine2")} />
          </div>
          <div>
            <label className={labelCls}>{t("dashboard","invCity")}</label>
            <input className={inputCls} value={biz.city ?? ''} onChange={(e) => setBizField('city', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{t("dashboard","psStateRegion")}</label>
            <input className={inputCls} value={biz.region ?? ''} onChange={(e) => setBizField('region', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{t("dashboard","psZip")}</label>
            <input className={inputCls} value={biz.postalCode ?? ''} onChange={(e) => setBizField('postalCode', e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>{t("dashboard","invBusinessLogo")}</label>
            <div className="flex items-center gap-3">
              {biz.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={biz.logoUrl} alt="Logo" className="rounded-lg object-contain bg-white border" style={{ width: 56, height: 56 }} />
              ) : (
                <div className={`rounded-lg flex items-center justify-center text-xs ${theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-400'}`} style={{ width: 56, height: 56 }}>{t("dashboard","invNone")}</div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  disabled={logoUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setLogoUploading(true);
                    try {
                      const saved = await uploadBusinessLogo(file);
                      setBiz((p) => ({ ...p, logoUrl: saved.logoUrl }));
                    } catch (err) {
                      alert(err instanceof Error ? err.message : t("dashboard","errUploadLogo"));
                    } finally {
                      setLogoUploading(false);
                      e.target.value = '';
                    }
                  }}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white file:cursor-pointer disabled:opacity-60"
                />
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {logoUploading ? 'Uploading…' : 'PNG or JPEG, up to 1MB.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button onClick={saveBiz} disabled={bizSaving} className={`px-6 py-2 rounded-lg text-white font-medium disabled:opacity-60 ${theme === 'dark' ? 'bg-green-700 hover:bg-green-600' : 'bg-green-500 hover:bg-green-600'}`}>
          {bizSaving ? t('onboarding', 'saving') : t('settings', 'saveChanges')}
        </button>
        {bizSaved && <span className="text-sm text-green-500">{t('settings', 'bizSaved')}</span>}
      </div>
    </div>
  );
}
