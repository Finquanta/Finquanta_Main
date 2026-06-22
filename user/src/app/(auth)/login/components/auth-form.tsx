"use client";
 
import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2Icon, MailIcon, LockIcon, CheckIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useAuth, useUI } from "@/hooks/context/SimpleAppProvider";
import { useLanguage } from "@/hooks/context/LanguageContext";
 
interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}
 
export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const router = useRouter();
  const auth = useAuth();
  const ui = useUI();
  const { t } = useLanguage();
 
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [emailValid, setEmailValid] = useState<boolean>(false);
  const [forgotPassword, setForgotPassword] = useState<boolean>(false);
  const [resetSent, setResetSent] = useState<boolean>(false);
 
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
 
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (value.length > 0) {
      setEmailValid(validateEmail(value));
    } else {
      setEmailValid(false);
    }
  };
 
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };
 
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid) return;
    setIsLoading(true);
    try {
      await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      /* Always show the same confirmation — never reveal whether the email exists. */
    } finally {
      setResetSent(true);
      setIsLoading(false);
    }
  };
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid || !password) return;
 
    setIsLoading(true);
    ui.beginLoading();
    auth.setAuthLoading(true);
 
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
        ui.toast("success", `Welcome back, ${data.user.firstName || data.user.email}!`, 4000);
        router.push('/dashboard');
      } else {
        const demoUsers = [
          { email: "demo@Finquantaai.com", password: "demopassword", id: "demo-1", name: "Demo User", role: "user" as const },
          { email: "admin@Finquantaai.com", password: "adminpassword", id: "admin-1", name: "Admin User", role: "admin" as const }
        ];
 
        const demoUser = demoUsers.find(u => u.email === email && u.password === password);
 
        if (demoUser) {
          auth.login({
            token: `demo_token_${demoUser.id}_${Date.now()}`,
            refreshToken: `demo_refresh_${demoUser.id}_${Date.now()}`,
            user: {
              id: demoUser.id,
              name: demoUser.name,
              email: demoUser.email,
              role: demoUser.role,
              avatarUrl: null,
              createdAt: new Date(),
              lastLoginAt: new Date(),
              preferences: { notifications: true, emailUpdates: true, darkMode: false }
            }
          });
          ui.toast("success", `Welcome, ${demoUser.name}! (Demo Mode)`, 4000);
          router.push('/dashboard');
        } else {
          const apiData = await res.json().catch(() => ({}));
          const errorMessage = apiData?.detail || apiData?.message || "Invalid email or password";
          ui.toast("error", errorMessage, 5000);
          ui.addError(errorMessage, "login");
          auth.incrementLoginAttempts();
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Network error. Please try again.";
      ui.toast("error", errorMessage, 5000);
      ui.addError(errorMessage, "login");
      auth.incrementLoginAttempts();
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
      ui.endLoading();
      auth.setAuthLoading(false);
    }
  };
 
  // Forgot password view
  if (forgotPassword) {
    return (
      <div className={cn("grid gap-6", className)} {...props}>
        {resetSent ? (
          <div className="grid gap-4 text-center">
            <div className="flex justify-center">
              <CheckIcon className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="font-semibold text-lg text-black">{t("auth", "checkEmail")}</h3>
            <p className="text-sm text-gray-600">
              {t("auth", "resetLinkSent")} <strong>{email}</strong>
            </p>
            <Button
              variant="outline"
              onClick={() => { setForgotPassword(false); setResetSent(false); }}>
              {t("auth", "backToSignIn")}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-1">
              <h3 className="font-semibold text-lg text-black">{t("auth", "resetPassword")}</h3>
              <p className="text-sm text-gray-600">{t("auth", "resetPasswordDesc")}</p>
            </div>
            <form onSubmit={handleReset}>
              <div className="grid gap-4">
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
                    value={email}
                    onChange={handleEmailChange}
                    className={cn("pl-10 pr-10 py-2 bg-white text-black border border-gray-300", emailValid ? "border-green-500" : "")}
                    placeholder={t("auth", "email")}
                    disabled={isLoading}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading || !emailValid}
                  className="bg-blue-500 hover:bg-blue-600 text-white">
                  {isLoading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                  {t("auth", "sendResetLink")}
                </Button>
                <button
                  type="button"
                  onClick={() => setForgotPassword(false)}
                  className="text-sm text-gray-600 hover:underline text-center">
                  {t("auth", "backToSignIn")}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    );
  }
 
  // Normal login view
  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <div className="grid gap-4">
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
              id="email"
              value={email}
              onChange={handleEmailChange}
              className={cn("pl-10 pr-10 py-2 bg-white text-black border border-gray-300", emailValid ? "border-green-500 focus:border-green-500" : "")}
              placeholder={t("auth", "email")}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
            />
          </div>
 
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <LockIcon className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={handlePasswordChange}
              className="pl-10 pr-10 py-2 bg-white text-black border border-gray-300"
              placeholder={t("auth", "password")}
              autoCapitalize="none"
              autoComplete="current-password"
              disabled={isLoading}
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
 
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setForgotPassword(true)}
              className="text-sm text-gray-600 hover:underline">
              {t("auth", "forgotPassword")}
            </button>
          </div>
 
          <Button
            type="submit"
            disabled={isLoading || !emailValid || !password}
            className={cn("bg-blue-500 hover:bg-blue-600 text-white", (!emailValid || !password || isLoading) ? "opacity-70" : "")}>
            {isLoading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
            {t("auth", "loginButton")}
          </Button>
 
          {auth.loginAttempts > 0 && (
            <div className="text-sm text-orange-600 flex items-center justify-center mt-2">
              <span>Login attempts: {auth.loginAttempts}</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}