'use client';
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { logoutAndRedirect } from "@/lib/auth";
import { UserAuthForm } from "./components/auth-form";
import DemoHandoff from "@/components/demo/DemoHandoff";
 
export default function SignupPage() {
  const { t } = useLanguage();
 
  return (
    <div className="flex h-screen w-full">
      {/* No-op unless the visitor came from the Try-It Demo. */}
      <DemoHandoff />
      {/* Left Column - Branding */}
      <div className="hidden w-2/5 bg-gray-100 flex-col items-center justify-center lg:flex">
        <div className="flex flex-col items-center justify-center space-y-8">
          <Image
            src="/images/finquanta_logo.svg"
            width={180}
            height={80}
            alt="Finquanta AI Logo"
            className="mb-8"
          />
          <h1 className="text-center text-4xl font-bold leading-tight">
            {t("hero", "title")}
          </h1>
        </div>
      </div>
 
      {/* Right Column - Sign up Form.
          Scrolls, and centres with `my-auto` rather than `justify-center`: this
          form is taller than a short viewport, and a centred flex child that
          overflows gets clipped at the TOP with no way to scroll back up — which
          hid the Return Home / Login row entirely. `my-auto` centres when there's
          room and yields to scrolling when there isn't. */}
      <div className="w-full lg:w-3/5 flex flex-col items-center overflow-y-auto px-6 lg:px-16 py-10">
        <div className="w-full max-w-md my-auto">
          {/* Home link and Sign in link */}
          <div className="flex justify-between items-center mb-12">
            <button type="button" onClick={() => logoutAndRedirect("/home")} className="text-sm font-medium text-blue-600 hover:underline flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              {t("legal", "returnHome")}
            </button>
            <p className="text-sm text-gray-600">
              {t("auth", "alreadyHaveAccount")}{" "}
              <Link href="/login" className="font-medium text-blue-600 hover:underline">
                {t("auth", "login")}
              </Link>
            </p>
          </div>
 
          {/* Form title */}
          <h1 className="text-3xl font-bold mb-8">{t("auth", "signUp")}</h1>
 
          {/* Auth form component */}
          <UserAuthForm />
 
          {/* reCAPTCHA notice */}
          <p className="mt-8 text-xs text-center text-gray-500">
            This site is protected by reCAPTCHA and the{" "}
            <Link href="https://policies.google.com/privacy" className="hover:underline">
              Google Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
 