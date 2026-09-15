"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, MailCheck } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import { verifyEmail, resendVerification, VerifyError } from "@/lib/api/verify";

type Status = "ready" | "confirming" | "done" | "error" | "no-token";

const primary =
  "inline-flex h-11 w-full items-center justify-center rounded-lg bg-fq-green px-5 text-sm font-semibold text-fq-dark transition hover:bg-fq-green/90 disabled:opacity-60";

export default function VerifyEmailPage() {
  // We deliberately do NOT auto-confirm on load. Email link-scanners (Outlook
  // Safe Links, Gmail, corporate filters) pre-fetch the link, and an automatic
  // POST would let them burn the one-time token before the human ever clicks —
  // exactly the "expired link" bug. A real click is required to confirm.
  const [status, setStatus] = useState<Status>(() => {
    if (typeof window === "undefined") return "ready";
    return new URLSearchParams(window.location.search).get("token") ? "ready" : "no-token";
  });
  const [message, setMessage] = useState("");
  const [expired, setExpired] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const [resending, setResending] = useState(false);

  const confirm = async () => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("no-token");
      return;
    }
    setStatus("confirming");
    try {
      const result = await verifyEmail(token);
      setMessage(
        result === "already"
          ? "This email was already confirmed. You're all set!"
          : "Your email is confirmed. You're all set!"
      );
      setStatus("done");
    } catch (e) {
      setExpired(e instanceof VerifyError && e.reason === "expired");
      setMessage(e instanceof Error ? e.message : "Could not verify email.");
      setStatus("error");
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim() || resending) return;
    setResending(true);
    try {
      const r = await resendVerification(resendEmail.trim());
      setResendMsg(
        r === "already_verified"
          ? "That email is already confirmed — just log in."
          : "If that email is registered and unverified, a new link is on its way."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell>
      <div className="grid gap-3 text-center">
        {status === "ready" && (
          <>
            <MailCheck className="mx-auto h-10 w-10 text-fq-green" aria-hidden="true" />
            <h1 className="text-2xl font-semibold tracking-tight text-fq-ink">Confirm your email</h1>
            <p className="mb-2 text-sm text-fq-slate">Click below to finish confirming your Finquanta email address.</p>
            <button onClick={confirm} className={primary}>Confirm my email</button>
          </>
        )}

        {status === "confirming" && <p className="text-sm text-fq-slate">Confirming your email…</p>}

        {status === "no-token" && (
          <>
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
            <h1 className="text-2xl font-semibold tracking-tight text-fq-ink">Missing link</h1>
            <p className="mb-2 text-sm text-fq-slate">
              This verification link is missing its token. Open the link straight from your email, or request a new one below.
            </p>
            <ResendForm resendEmail={resendEmail} setResendEmail={setResendEmail} resendMsg={resendMsg} resending={resending} onSubmit={handleResend} />
          </>
        )}

        {status === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-fq-green" aria-hidden="true" />
            <h1 className="text-2xl font-semibold tracking-tight text-fq-ink">Email confirmed</h1>
            <p className="mb-2 text-sm text-fq-slate">{message}</p>
            <Link href="/dashboard" className={primary}>Go to dashboard</Link>
          </>
        )}

        {status === "error" && (
          <>
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
            <h1 className="text-2xl font-semibold tracking-tight text-fq-ink">Couldn&apos;t confirm</h1>
            <p className="mb-2 text-sm text-fq-slate">
              {message}{expired ? " Enter your email to get a fresh link." : ""}
            </p>
            <ResendForm resendEmail={resendEmail} setResendEmail={setResendEmail} resendMsg={resendMsg} resending={resending} onSubmit={handleResend} />
            <Link href="/login" className="mt-2 text-sm text-fq-slate hover:text-fq-ink hover:underline">Back to login</Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}

function ResendForm({
  resendEmail,
  setResendEmail,
  resendMsg,
  resending,
  onSubmit,
}: {
  resendEmail: string;
  setResendEmail: (v: string) => void;
  resendMsg: string;
  resending: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  if (resendMsg) return <p className="text-sm text-green-700">{resendMsg}</p>;
  return (
    <form onSubmit={onSubmit} className="grid gap-3 text-left">
      <label htmlFor="resend-email" className="sr-only">Email</label>
      <input
        id="resend-email"
        type="email"
        value={resendEmail}
        onChange={(e) => setResendEmail(e.target.value)}
        placeholder="you@example.com"
        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-fq-ink outline-none transition focus:border-fq-green focus:ring-2 focus:ring-fq-green/30"
      />
      <button type="submit" disabled={resending} className={primary}>
        {resending ? "Sending…" : "Resend verification email"}
      </button>
    </form>
  );
}
