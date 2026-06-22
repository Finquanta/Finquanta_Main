"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2Icon, MailIcon, LockIcon, CheckIcon, UserIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useAuth, useUI } from "@/hooks/context/SimpleAppProvider";
import { useLanguage } from "@/hooks/context/LanguageContext";

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const router = useRouter();
  const auth = useAuth();
  const ui = useUI();
  const { t } = useLanguage();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [emailValid, setEmailValid] = useState<boolean>(false);
  const [passwordMismatch, setPasswordMismatch] = useState<boolean>(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailValid(value.length > 0 ? validateEmail(value) : false);
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    setPasswordMismatch(password !== value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid || !password || !firstName || password !== confirmPassword) return;

    if (password.length < 8) {
      ui.toast("error", "Password must be at least 8 characters", 4000);
      return;
    }

    setIsLoading(true);
    ui.beginLoading();
    auth.setAuthLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      if (res.ok) {
        const data = await res.json();
        auth.login({
          token: data.accessToken,
          refreshToken: data.refreshToken,
          user: {
            id: data.user.id,
            name: `${data.user.firstName ?? ''} ${data.user.lastName ?? ''}`.trim() || data.user.email,
            email: data.user.email,
            role: data.user.role || 'user',
            avatarUrl: data.user.avatarUrl,
            createdAt: data.user.createdAt ? new Date(data.user.createdAt) : new Date(),
            lastLoginAt: new Date(),
            preferences: {
              notifications: data.user.preferences?.notifications ?? true,
              emailUpdates: data.user.preferences?.email_updates ?? true,
              darkMode: data.user.preferences?.dark_mode ?? false,
            }
          }
        });
        ui.toast("success", `Welcome, ${data.user.firstName || data.user.email}!`, 4000);
        router.push('/onboarding');
      } else {
        const apiData = await res.json().catch(() => ({}));
        const errorMessage = apiData?.detail || apiData?.message || "Registration failed. Please try again.";
        ui.toast("error", errorMessage, 5000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Network error. Please try again.";
      ui.toast("error", errorMessage, 5000);
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
      ui.endLoading();
      auth.setAuthLoading(false);
    }
  };

  const canSubmit = emailValid && password && firstName && confirmPassword && !passwordMismatch && password.length >= 8;

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <UserIcon className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="pl-10 py-2 bg-white text-black border border-gray-300"
                placeholder="First name"
                disabled={isLoading}
                required
              />
            </div>
            <div className="relative">
              <Input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="py-2 bg-white text-black border border-gray-300"
                placeholder="Last name"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <MailIcon className="h-5 w-5 text-gray-400" />
            </div>
            {emailValid && (
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <CheckIcon className="h-5 w-5 text-green-500" />
              </div>
            )}
            <Input
              type="email"
              id="signup-email"
              value={email}
              onChange={handleEmailChange}
              className={cn("pl-10 pr-10 py-2 bg-white text-black border border-gray-300", emailValid ? "border-green-500 focus:border-green-500" : "")}
              placeholder={t("auth", "email")}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              required
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <LockIcon className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type={showPassword ? "text" : "password"}
              id="signup-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (confirmPassword) setPasswordMismatch(confirmPassword !== e.target.value);
              }}
              className="pl-10 pr-10 py-2 bg-white text-black border border-gray-300"
              placeholder="Password (min 8 characters)"
              autoCapitalize="none"
              autoComplete="new-password"
              disabled={isLoading}
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <LockIcon className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type={showConfirmPassword ? "text" : "password"}
              id="confirm-password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              className={cn("pl-10 pr-10 py-2 bg-white text-black border border-gray-300", passwordMismatch ? "border-red-500" : confirmPassword && !passwordMismatch ? "border-green-500" : "")}
              placeholder="Confirm password"
              autoCapitalize="none"
              autoComplete="new-password"
              disabled={isLoading}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>

          {passwordMismatch && (
            <p className="text-xs text-red-500 -mt-2">Passwords do not match</p>
          )}

          <Button
            type="submit"
            disabled={isLoading || !canSubmit}
            className={cn("bg-blue-500 hover:bg-blue-600 text-white", !canSubmit ? "opacity-70" : "")}>
            {isLoading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
            {t("auth", "signUp") || "Create Account"}
          </Button>
        </div>
      </form>
    </div>
  );
}
