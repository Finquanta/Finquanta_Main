"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BusinessProfile, getBusinessProfile, saveBusinessProfile } from "@/lib/api/business";
import { useLanguage } from "@/hooks/context/LanguageContext";

const ENTITY_TYPES = ["Solopreneur", "Sole Proprietorship", "LLC", "Corporation", "Partnership", "Nonprofit", "Other"];
const MATURITY_STAGES = ["Idea", "Startup", "Early-stage", "Growth", "Established", "Mature"];
const REVENUE_RANGES = ["Pre-revenue", "Under $10k", "$10k–$50k", "$50k–$250k", "$250k–$1M", "$1M–$5M", "$5M+"];
const EMPLOYEE_COUNTS = ["Just me", "2–5", "6–10", "11–50", "51–200", "200+"];

type StepType = "text" | "select" | "textarea";

interface Step {
  key: keyof BusinessProfile;
  qKey: string;
  hintKey?: string;
  type: StepType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

const STEPS: Step[] = [
  { key: "businessName", qKey: "qBusinessName", type: "text", placeholder: "e.g. Acme Co.", required: true },
  { key: "businessType", qKey: "qBusinessType", type: "text", placeholder: "e.g. SaaS, Retail, Agency" },
  { key: "industry", qKey: "qIndustry", type: "text", placeholder: "e.g. Technology, Food" },
  { key: "niche", qKey: "qNiche", hintKey: "hintNiche", type: "text", placeholder: "e.g. vegan meal prep, real estate wholesaling" },
  { key: "entityType", qKey: "qEntity", type: "select", options: ENTITY_TYPES },
  { key: "country", qKey: "qCountry", type: "text", placeholder: "e.g. United States" },
  { key: "incorporationLocation", qKey: "qIncorporation", hintKey: "hintIncorporation", type: "text", placeholder: "e.g. Delaware, USA" },
  { key: "maturityStage", qKey: "qMaturity", type: "select", options: MATURITY_STAGES },
  { key: "revenueRange", qKey: "qRevenue", type: "select", options: REVENUE_RANGES },
  { key: "employeeCount", qKey: "qEmployees", type: "select", options: EMPLOYEE_COUNTS },
  { key: "financialGoals", qKey: "qGoals", hintKey: "hintGoals", type: "textarea", placeholder: "e.g. Reach $20k/month, cut expenses 15%, build a 6-month runway" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [form, setForm] = useState<BusinessProfile>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBusinessProfile().then((b) => { if (b) setForm((f) => ({ ...f, ...b })); }).catch(() => {});
  }, []);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const value = (form[step.key] as string) ?? "";
  const progress = useMemo(() => Math.round(((stepIndex + 1) / STEPS.length) * 100), [stepIndex]);

  const set = (val: string) => setForm((f) => ({ ...f, [step.key]: val }));

  const goNext = async () => {
    setError(null);
    if (step.required && !value.trim()) {
      setError(t("onboarding", "required"));
      return;
    }
    if (!isLast) {
      setStepIndex((i) => i + 1);
      return;
    }
    setSaving(true);
    try {
      await saveBusinessProfile({ ...form, onboardingCompleted: true });
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("onboarding", "saveError"));
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => { setError(null); setStepIndex((i) => Math.max(0, i - 1)); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step.type !== "textarea") {
      e.preventDefault();
      goNext();
    }
  };

  const progressLabel = t("onboarding", "progress")
    .replace("{current}", String(stepIndex + 1))
    .replace("{total}", String(STEPS.length));

  const fieldBase = "w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-lg text-gray-900 outline-none focus:border-blue-500 transition-colors";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-200">
        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Top bar: logo + skip */}
      <div className="flex items-center justify-between px-6 py-4">
        <img src="/images/finquanta_logo.svg" alt="Finquanta" className="w-24 h-auto" />
        <button onClick={() => { if (typeof window !== "undefined") sessionStorage.setItem("onboardingSkipped", "1"); router.push("/dashboard"); }} className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
          {t("onboarding", "skip")}
        </button>
      </div>

      {/* Centered question */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-xl">
          <p className="text-sm font-medium text-blue-500 mb-3">{progressLabel}</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t("onboarding", step.qKey)}{step.required && <span className="text-blue-500"> *</span>}
          </h1>
          {step.hintKey ? <p className="text-gray-500 mb-6">{t("onboarding", step.hintKey)}</p> : <div className="mb-6" />}

          {step.type === "text" && (
            <input autoFocus className={fieldBase} value={value} onChange={(e) => set(e.target.value)} onKeyDown={onKeyDown} placeholder={step.placeholder} />
          )}
          {step.type === "textarea" && (
            <textarea autoFocus className={`${fieldBase} min-h-[120px]`} value={value} onChange={(e) => set(e.target.value)} placeholder={step.placeholder} />
          )}
          {step.type === "select" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {step.options!.map((opt) => (
                <button
                  key={opt}
                  onClick={() => set(opt)}
                  className={`text-left px-4 py-3 rounded-xl border-2 text-base transition-colors ${
                    value === opt ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={goBack}
              disabled={stepIndex === 0}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-0 disabled:cursor-default"
            >
              ← {t("onboarding", "back")}
            </button>
            <button
              onClick={goNext}
              disabled={saving}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold px-8 py-3 rounded-xl text-base"
            >
              {saving ? t("onboarding", "saving") : isLast ? t("onboarding", "finish") : t("onboarding", "continue")}
            </button>
          </div>
          {step.type !== "textarea" && (
            <p className="text-xs text-gray-400 mt-3">{t("onboarding", "enterHint")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
