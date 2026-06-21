"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BusinessProfile, getBusinessProfile, saveBusinessProfile } from "@/lib/api/business";

const ENTITY_TYPES = ["Solopreneur", "Sole Proprietorship", "LLC", "Corporation", "Partnership", "Nonprofit", "Other"];
const MATURITY_STAGES = ["Idea", "Startup", "Early-stage", "Growth", "Established", "Mature"];
const REVENUE_RANGES = ["Pre-revenue", "Under $10k", "$10k–$50k", "$50k–$250k", "$250k–$1M", "$1M–$5M", "$5M+"];
const EMPLOYEE_COUNTS = ["Just me", "2–5", "6–10", "11–50", "51–200", "200+"];

type StepType = "text" | "select" | "textarea";

interface Step {
  key: keyof BusinessProfile;
  question: string;
  hint?: string;
  type: StepType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

const STEPS: Step[] = [
  { key: "businessName", question: "What's your business name?", type: "text", placeholder: "e.g. Acme Co.", required: true },
  { key: "businessType", question: "What type of business is it?", type: "text", placeholder: "e.g. SaaS, Retail, Agency" },
  { key: "industry", question: "What industry are you in?", type: "text", placeholder: "e.g. Technology, Food" },
  { key: "niche", question: "What's your business niche?", hint: "Get specific — it helps us tailor things.", type: "text", placeholder: "e.g. vegan meal prep, real estate wholesaling" },
  { key: "entityType", question: "What's your business structure?", type: "select", options: ENTITY_TYPES },
  { key: "country", question: "What country are you based in?", type: "text", placeholder: "e.g. United States" },
  { key: "incorporationLocation", question: "Where is your business incorporated?", hint: "State / region / country of incorporation.", type: "text", placeholder: "e.g. Delaware, USA" },
  { key: "maturityStage", question: "What stage is your business at?", type: "select", options: MATURITY_STAGES },
  { key: "revenueRange", question: "What's your revenue range?", type: "select", options: REVENUE_RANGES },
  { key: "employeeCount", question: "How many people work in the business?", type: "select", options: EMPLOYEE_COUNTS },
  { key: "financialGoals", question: "What are your financial goals?", hint: "A sentence or two is plenty.", type: "textarea", placeholder: "e.g. Reach $20k/month, cut expenses 15%, build a 6-month runway" },
];

export default function OnboardingPage() {
  const router = useRouter();
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
      setError("This one's required to continue.");
      return;
    }
    if (!isLast) {
      setStepIndex((i) => i + 1);
      return;
    }
    // Last step → save everything.
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

  const goBack = () => { setError(null); setStepIndex((i) => Math.max(0, i - 1)); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Enter advances (except in the textarea, where Enter makes a new line).
    if (e.key === "Enter" && step.type !== "textarea") {
      e.preventDefault();
      goNext();
    }
  };

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
          Skip for now
        </button>
      </div>

      {/* Centered question */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-xl">
          <p className="text-sm font-medium text-blue-500 mb-3">
            Question {stepIndex + 1} of {STEPS.length}
          </p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {step.question}{step.required && <span className="text-blue-500"> *</span>}
          </h1>
          {step.hint && <p className="text-gray-500 mb-6">{step.hint}</p>}
          {!step.hint && <div className="mb-6" />}

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
              ← Back
            </button>
            <button
              onClick={goNext}
              disabled={saving}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold px-8 py-3 rounded-xl text-base"
            >
              {saving ? "Saving…" : isLast ? "Finish" : "Continue"}
            </button>
          </div>
          {step.type !== "textarea" && (
            <p className="text-xs text-gray-400 mt-3">Press <span className="font-medium">Enter ↵</span> to continue</p>
          )}
        </div>
      </div>
    </div>
  );
}
