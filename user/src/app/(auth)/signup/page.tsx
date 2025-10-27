import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { UserAuthForm } from "./components/auth-form";

export const metadata: Metadata = {
  title: "Sign up - Fiscal AI",
  description: "Create your Fiscal AI account to transform your finances with AI power.",
};

export default function SignupPage() {
  return (
    <div className="flex h-screen w-full">
      {/* Left Column - Branding */}
      <div className="hidden w-2/5 bg-gray-100 flex-col items-center justify-center lg:flex">
        <div className="flex flex-col items-center justify-center space-y-8">
          <Image
            src="/images/ffai_logo.svg"
            width={180}
            height={80}
            alt="Fiscal AI Logo"
            className="mb-8"
          />
          <h1 className="text-center text-4xl font-bold leading-tight">
            Transform Your<br />Finances with<br />AI Power!
          </h1>
        </div>
      </div>

      {/* Right Column - Sign up Form */}
      <div className="w-full lg:w-3/5 flex flex-col items-center justify-center px-6 lg:px-16">
        <div className="w-full max-w-md">
          {/* Home link and Sign in link */}
          <div className="flex justify-between items-center mb-12">
            <Link href="/home" className="text-sm font-medium text-blue-600 hover:underline flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              Back to Home
            </Link>
            <p className="text-sm text-gray-600">
              Already a member?{" "}
              <Link href="/login" className="font-medium text-blue-600 hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          {/* Form title */}
          <h1 className="text-3xl font-bold mb-8">Sign up</h1>
          
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
