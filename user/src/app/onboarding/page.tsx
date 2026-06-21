"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BusinessProfile, getBusinessProfile, saveBusinessProfile } from "@/lib/api/business";

const ENTITY_TYPES = ["Solopreneur", "Sole Proprietorship", "LLC", "Corporation", "Partnership", "Nonprofit", "Other"];
const MATURITY_STAGES = ["Idea", "Startup", "Early-stage", "Growth", "Established", "Mature"];
const REVENUE_RANGES = ["Pre-revenue", "Under $10k", "$10k–$50k", "$50k–$250k", "$250k–$1M", "$1M–$5M", "$5M+"];
const EMPLOYEE_COUNTS = ["Just me", "2–5", "6–10", "11–50", "51–200", "200+"];

const empty: BusinessProfile = {
  businessName: "", businessType: "", industry: "", niche: "",
  entityType: "", maturityStage: "", revenueRange: "", employeeCount: "", financialGoals: "",
  country: "", incorporationLocation: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<BusinessProfile>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBusinessProfile().then((b) => setForm({ ...empty, ...b })).catch(() => {});
  }, []);

  const set = (key: keyof BusinessProfile, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    setError(null);
    if (!form.businessName?.trim()) return setError("Please enter your business name.");
    setSaving(true);
    try {
      await saveBusinessProfile({ ...form, onboardingCompleted: true });
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500";
  const label = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm p-6 sm:p-8">
        <div className="mb-6">
          <img src="/images/finquanta_logo.svg" alt="Finquanta" className="w-28 h-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Tell us about your business</h1>
          <p className="text-sm text-gray-500 mt-1">This helps us tailor Finquanta to you. You can change it later in settings.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={label}>Business name *</label>
            <input className={input} value={form.businessName ?? ""} onChange={(e) => set("businessName", e.target.value)} placeholder="e.g. Acme Co." />
          </div>
          <div>
            <label className={label}>Business type</label>
            <input className={input} value={form.businessType ?? ""} onChange={(e) => set("businessType", e.target.value)} placeholder="e.g. SaaS, Retail, Agency" />
          </div>
          <div>
            <label className={label}>Industry</label>
            <input className={input} value={form.industry ?? ""} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. Technology, Food" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Business niche</label>
            <input className={input} value={form.niche ?? ""} onChange={(e) => set("niche", e.target.value)} placeholder="e.g. Real estate wholesaling, vegan meal prep" />
          </div>
          <div>
            <label className={label}>Business structure</label>
            <select className={input} value={form.entityType ?? ""} onChange={(e) => set("entityType", e.target.value)}>
              <option value="">Select…</option>
              {ENTITY_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Country</label>
            <input className={input} value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} placeholder="e.g. United States" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Place of incorporation</label>
            <input className={input} value={form.incorporationLocation ?? ""} onChange={(e) => set("incorporationLocation", e.target.value)} placeholder="e.g. Delaware, USA" />
          </div>
          <div>
            <label className={label}>Maturity stage</label>
            <select className={input} value={form.maturityStage ?? ""} onChange={(e) => set("maturityStage", e.target.value)}>
              <option value="">Select…</option>
              {MATURITY_STAGES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Revenue range</label>
            <select className={input} value={form.revenueRange ?? ""} onChange={(e) => set("revenueRange", e.target.value)}>
              <option value="">Select…</option>
              {REVENUE_RANGES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Employees</label>
            <select className={input} value={form.employeeCount ?? ""} onChange={(e) => set("employeeCount", e.target.value)}>
              <option value="">Select…</option>
              {EMPLOYEE_COUNTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Financial goals</label>
            <textarea className={`${input} min-h-[80px]`} value={form.financialGoals ?? ""} onChange={(e) => set("financialGoals", e.target.value)} placeholder="e.g. Reach $20k/month revenue, cut expenses 15%, build 6-month runway" />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

        <div className="flex items-center justify-between mt-6">
          <button onClick={() => router.push("/dashboard")} className="text-sm text-gray-500 hover:underline">
            Skip for now
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-lg text-sm"
          >
            {saving ? "Saving…" : "Continue to dashboard"}
          </button>
        </div>
      </div>
    </div>
  );
}
