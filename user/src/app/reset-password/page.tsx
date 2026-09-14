"use client";
import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";

/**
 * Where the password-reset email lands. Uses the shared auth layout so the
 * flow (log in → forgot password → email → here) never changes look halfway.
 * Behaviour is unchanged from the previous standalone page.
 */
function ResetPasswordInner() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || data?.message || "Could not reset your password.");
        return;
      }
      setDone(true);
    } catch {
      setError("The server is waking up. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const input =
    "h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-fq-ink outline-none transition focus:border-fq-green focus:ring-2 focus:ring-fq-green/30";
  const primary =
    "inline-flex h-11 w-full items-center justify-center rounded-lg bg-fq-green text-sm font-semibold text-fq-dark transition hover:bg-fq-green/90 disabled:opacity-60";
  const quiet = "mt-3 w-full text-center text-sm text-fq-slate hover:text-fq-ink hover:underline";

  return (
    <AuthShell>
      {!token ? (
        <div className="grid gap-3 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
          <h1 className="text-xl font-semibold tracking-tight text-fq-ink">Invalid reset link</h1>
          <p className="text-sm text-fq-slate">This link is missing or malformed. Please request a new password reset.</p>
          <button onClick={() => router.push("/login")} className={primary}>Back to Login</button>
        </div>
      ) : done ? (
        <div className="grid gap-3 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-fq-green" aria-hidden="true" />
          <h1 className="text-xl font-semibold tracking-tight text-fq-ink">Password updated</h1>
          <p className="text-sm text-fq-slate">You can now log in with your new password.</p>
          <button onClick={() => router.push("/login")} className={primary}>Go to Login</button>
        </div>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-tight text-fq-ink">Choose a new password</h1>
          <p className="mb-6 mt-2 text-sm text-fq-slate">
            Must be at least 8 characters, with upper &amp; lower case, a number, and a special character.
          </p>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-xs font-medium text-fq-slate">New password</label>
              <div className="relative">
                <input
                  id="new-password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={`${input} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-new-password" className="mb-1.5 block text-xs font-medium text-fq-slate">Confirm password</label>
              <input
                id="confirm-new-password"
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className={input}
              />
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className={primary}>
              {loading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Updating…" : "Reset Password"}
            </button>
          </form>
          <button onClick={() => router.push("/login")} className={quiet}>Back to Login</button>
        </>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
