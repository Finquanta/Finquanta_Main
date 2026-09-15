'use client';
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { logoutAndRedirect } from "@/lib/auth";
import AuthShell from "@/components/auth/AuthShell";
import { UserAuthForm } from "./components/auth-form";

export default function LoginPage() {
  const { t } = useLanguage();

  return (
    <AuthShell>
      <button
        type="button"
        onClick={() => logoutAndRedirect("/home")}
        className="mb-10 inline-flex items-center gap-1.5 text-sm font-medium text-fq-slate transition-colors hover:text-fq-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("legal", "returnHome")}
      </button>

      <h1 className="mb-6 text-3xl font-semibold tracking-tight text-fq-ink">{t("auth", "login")}</h1>

      {/* Log in, the two-factor step, and forgot password all live in here. */}
      <UserAuthForm />

      <p className="mt-8 text-center text-sm text-fq-slate">
        {t("auth", "dontHaveAccount")}{" "}
        <Link href="/signup" className="font-semibold text-fq-ink underline-offset-4 hover:underline">
          {t("auth", "signUp")}
        </Link>
      </p>
    </AuthShell>
  );
}
