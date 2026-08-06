"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2Icon, MailIcon, LockIcon, CheckIcon, UserIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useAuth, useUI } from "@/hooks/context/SimpleAppProvider";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { captureReferralCode, clearReferralCode, storedReferralCode } from "@/lib/api/referrals";
import { PASSWORD_RULES, SYMBOL_EXAMPLES, SYMBOL_RE, firstPasswordProblem, passwordIsValid } from "@/lib/password-rules";
import { Turnstile } from "@/components/auth/Turnstile";
import { bindStashToUser } from "@/lib/demo/migrate";

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

const MIN_AGE = 16;

/** Whole years between a 'YYYY-MM-DD' date and today. NaN if invalid. */
function ageFrom(dob: string): number {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return NaN;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

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
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState<boolean>(false);
  const [acceptedRisk, setAcceptedRisk] = useState<boolean>(false);
  /** Set when they arrived on someone's referral link — shown as a confirmation. */
  const [referredBy, setReferredBy] = useState<string | undefined>(undefined);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Bumped on every failed attempt to issue a fresh captcha challenge — the
  // old token is spent the moment it's submitted, so without this a user who
  // corrects a rejected signup is told the captcha failed, forever.
  const [captchaNonce, setCaptchaNonce] = useState(0);

  /** A form-level error that STAYS on screen, unlike the 5s toast. */
  const [formError, setFormError] = useState<string | null>(null);

  const age = dateOfBirth ? ageFrom(dateOfBirth) : NaN;
  const ageValid = !isNaN(age) && age >= MIN_AGE;
  const allAccepted = acceptedTerms && acceptedPrivacy && acceptedRisk;
  const passwordOk = passwordIsValid(password);

  // Pre-fill the email when arriving from the homepage "Sign Up" box (?email=),
  // and remember a referral code if they arrived on someone's link (?ref=).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const prefill = params.get('email');
    if (prefill) {
      setEmail(prefill);
      setEmailValid(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prefill));
    }

    captureReferralCode(params.get('ref'));
    setReferredBy(storedReferralCode());
  }, []);

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


  /**
   * A password rule in the reader's language. Falls back to the English label
   * baked into the rule when a locale is missing the key, so a gap degrades to
   * English rather than rendering a raw `auth.pwRuleLen`.
   */
  const ruleText = (rule: { key: string; label: string }) => {
    const s = t("auth", rule.key);
    return s && !s.startsWith("auth.") ? s : rule.label;
  };

  /**
   * Show it inline AND as a toast — the toast alone is missable on a phone.
   * Does NOT touch the captcha: these fire before anything is sent, so the
   * token is still unused and still valid.
   */
  const showError = (message: string) => {
    setFormError(message);
    ui.toast("error", message, 6000);
  };

  /**
   * Same, but for failures after the request went out. Only then has the server
   * consumed the token — Turnstile tokens are single-use, so it has to be
   * retired and re-issued.
   *
   * Keep this off the client-side validation paths. Bumping the nonce remounts
   * the widget, which aborts any challenge still in flight: submitting before
   * Turnstile resolves would restart it, and a user clicking again would restart
   * it again, never getting a token.
   */
  const fail = (message: string) => {
    showError(message);
    setTurnstileToken(null);
    setCaptchaNonce((n) => n + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!emailValid || !password || !firstName || password !== confirmPassword) return;
    if (!turnstileToken) {
      showError(t("auth","aVerifyCheck"));
      return;
    }

    // The server enforces upper/lower/digit/special too. Check the same rules
    // here so nobody gets bounced by a requirement the form never mentioned.
    const problem = firstPasswordProblem(password);
    if (problem) {
      showError(t("auth","pwNeeds").split("{rule}").join(ruleText(problem)));
      return;
    }

    if (!dateOfBirth || isNaN(age)) {
      showError(t("auth","aDobRequired"));
      return;
    }
    if (!ageValid) {
      showError(t("auth","aMinAge").split("{n}").join(String(MIN_AGE)));
      return;
    }
    if (!allAccepted) {
      showError(t("auth","aAcceptTerms"));
      return;
    }

    setIsLoading(true);
    ui.beginLoading();
    auth.setAuthLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, password, firstName, lastName, dateOfBirth,
          acceptedTerms, acceptedPrivacy, acceptedRisk,
          // Whoever's link they arrived on, if any. The server ignores it if the
          // code is unknown, so a stale link can never block signup.
          referralCode: storedReferralCode(),
          turnstileToken,
        }),
      });

      if (res.ok) {
        // Attributed (or not) — either way it's spent, so don't credit it twice.
        clearReferralCode();
        const data = await res.json();
        // Name the account any stashed Try-It Demo session belongs to. Until this
        // runs the stash is provisional and the dashboard will refuse to replay
        // it, so this is what makes a demo handoff possible at all — and what
        // keeps it out of every other account on this browser.
        bindStashToUser(data.user.id);
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
        // `detail` carries the real reason; `error` is the generic wrapper. Read
        // both — reading only detail/message meant some failures showed nothing
        // useful at all.
        const errorMessage =
          apiData?.detail || apiData?.message || apiData?.error ||
          "Registration failed. Please try again.";
        fail(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Network error. Please try again.";
      fail(errorMessage);
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
      ui.endLoading();
      auth.setAuthLoading(false);
    }
  };

  // passwordOk mirrors the server's rules. It used to be `password.length >= 8`,
  // which let the button enable for passwords the server would reject.
  const canSubmit = emailValid && password && firstName && confirmPassword && !passwordMismatch && passwordOk && ageValid && allAccepted && !!turnstileToken;

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <div className="grid gap-4">
          {/* Arrived on someone's link — tell them it landed. */}
          {referredBy && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              <CheckIcon className="h-4 w-4 shrink-0" />
              <span>{t('auth', 'aInvitedPre')} <strong>{referredBy}</strong> {t('auth', 'aInvitedPost')}</span>
            </div>
          )}
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
              placeholder="Password"
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

          {/* The rules the server actually enforces, shown as you type. Without
              this people picked a sensible-looking password, the button enabled,
              and signup failed for a reason they never saw. */}
          {password.length > 0 && !passwordOk && (
            <div className="-mt-1">
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password);
                  return (
                    <li
                      key={rule.key}
                      className={cn("flex items-center gap-1.5 text-xs", met ? "text-green-600" : "text-gray-500")}
                    >
                      <span className={cn("flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold shrink-0",
                        met ? "bg-green-500 text-white" : "border border-gray-300")}>
                        {met ? "✓" : ""}
                      </span>
                      {ruleText(rule)}
                    </li>
                  );
                })}
              </ul>
              {/* Spell out what counts, but only once that's the bit they're
                  missing — "add a symbol" shouldn't be a guessing game. */}
              {!SYMBOL_RE.test(password) && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
                  {t("auth","pwAnyCount")} <span className="font-mono text-gray-700">{SYMBOL_EXAMPLES}</span>
                  <br />Letters, numbers and spaces don&apos;t.
                </p>
              )}
            </div>
          )}

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
            <p className="text-xs text-red-500 -mt-2">{t('auth', 'aPwMismatch')}</p>
          )}

          {/* Date of birth — enforces the 16+ age requirement */}
          <div>
            <label htmlFor="dob" className="block text-xs font-medium text-gray-600 mb-1">Date of birth</label>
            <Input
              type="date"
              id="dob"
              value={dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={cn("py-2 bg-white text-black border border-gray-300", dateOfBirth && !ageValid ? "border-red-500" : dateOfBirth && ageValid ? "border-green-500" : "")}
              disabled={isLoading}
              required
            />
            {dateOfBirth !== '' && !ageValid && (
              <p className="text-xs text-red-500 mt-1">You must be at least {MIN_AGE} years old to sign up.</p>
            )}
          </div>

          {/* Required legal agreements */}
          <div className="grid gap-2 text-xs text-gray-600">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} disabled={isLoading} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-500" />
              <span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Terms &amp; Conditions</a></span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={acceptedPrivacy} onChange={(e) => setAcceptedPrivacy(e.target.checked)} disabled={isLoading} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-500" />
              <span>I agree to the <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Privacy Policy</a></span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={acceptedRisk} onChange={(e) => setAcceptedRisk(e.target.checked)} disabled={isLoading} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-500" />
              <span>I acknowledge the <a href="/ai-risk-disclosure" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Risk Disclosure</a></span>
            </label>
          </div>

          {/* Sits next to the button and stays put. The toast is fixed to the
              top-right corner and clears after a few seconds — behind an iPhone
              keyboard that may as well be invisible, which is how three people
              hit a failing signup and saw nothing at all. */}
          {formError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} resetSignal={captchaNonce} />

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
