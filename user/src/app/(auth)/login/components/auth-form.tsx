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
    await new Promise(r => setTimeout(r, 1000));
    setResetSent(true);
    setIsLoading(false);
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
      <div className="grid gap-3">
        <p className="text-sm text-center text-gray-700">{t("auth", "loginWithGoogle")}</p>
        <div className="grid grid-cols-2 gap-4">
          <Button variant="outline" type="button" className="flex items-center gap-2 bg-black text-white hover:bg-gray-800 border-black">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.1711 8.36788H17.4998V8.33329H9.99984V11.6666H14.7094C14.0223 13.6071 12.1761 15.0001 9.99984 15.0001C7.23869 15.0001 4.99984 12.7613 4.99984 10.0001C4.99984 7.23895 7.23869 5.00008 9.99984 5.00008C11.2744 5.00008 12.434 5.48167 13.3169 6.26507L15.6744 3.90758C14.1844 2.52206 12.1948 1.66675 9.99984 1.66675C5.39775 1.66675 1.6665 5.39799 1.6665 10.0001C1.6665 14.6022 5.39775 18.3334 9.99984 18.3334C14.6019 18.3334 18.3332 14.6022 18.3332 10.0001C18.3332 9.44028 18.2757 8.89416 18.1711 8.36788Z" fill="#FBC02D"/>
              <path d="M2.6286 6.36019L5.36485 8.36269C6.10401 6.46269 7.90068 5.00008 10.0003 5.00008C11.2749 5.00008 12.4344 5.48167 13.3173 6.26507L15.6748 3.90758C14.1848 2.52206 12.1953 1.66675 10.0003 1.66675C6.82964 1.66675 4.10026 3.57373 2.6286 6.36019Z" fill="#E93131"/>
              <path d="M9.99984 18.3334C12.1511 18.3334 14.1057 17.505 15.5836 16.17L13.0078 13.9876C12.1556 14.6552 11.0946 15.0001 9.99984 15.0001C7.83359 15.0001 5.99317 13.6176 5.29775 11.6926L2.58301 13.7826C4.03817 16.5384 6.79317 18.3334 9.99984 18.3334Z" fill="#4CAF50"/>
              <path d="M18.1711 8.36788H17.4998V8.33329H9.99984V11.6666H14.7094C14.3869 12.5897 13.8264 13.3893 13.0073 13.9883L13.0086 13.9875L15.5844 16.1699C15.4049 16.3316 18.3332 14.1666 18.3332 10.0001C18.3332 9.44028 18.2757 8.89416 18.1711 8.36788Z" fill="#1976D2"/>
            </svg>
            Google
          </Button>
          <Button variant="outline" type="button" className="flex items-center gap-2 bg-black text-white hover:bg-gray-800 border-black">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15.7943 10.5581C15.7726 8.91697 16.788 7.67964 18.8333 6.79797C17.7217 5.26381 16.0461 4.43464 13.8688 4.28797C11.8024 4.14797 9.51305 5.51964 8.86638 5.51964C8.17055 5.51964 6.11722 4.34797 4.64388 4.34797C1.92055 4.39131 0 6.19797 0 9.08797C0 10.0846 0.173883 11.1213 0.521883 12.1946C1.01472 13.7263 3.19222 17.9963 5.46055 17.9213C6.55722 17.8846 7.31055 17.0913 8.77388 17.0913C10.1861 17.0913 10.8826 17.9213 12.1077 17.9213C14.4016 17.8846 16.3581 14.0213 16.8206 12.4846C13.6333 10.9329 13.7943 10.6413 15.7943 10.5581ZM12.871 3.32797C13.7616 2.32131 13.6696 1.39297 13.6333 0.988308C12.8833 1.02631 12.0133 1.44964 11.5033 1.95131C10.936 2.49131 10.4703 3.25131 10.5996 4.24131C11.4288 4.30797 12.1973 4.13297 12.871 3.32797Z" fill="white"/>
            </svg>
            Apple ID
          </Button>
        </div>
      </div>
 
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-300"></span>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-600">{t("auth", "email").toUpperCase()}</span>
        </div>
      </div>
 
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