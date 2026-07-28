"use client";

import { useState } from "react";
import Link from "next/link";
import { verifyEmail, resendVerification, VerifyError } from "@/lib/api/verify";

type Status = "ready" | "confirming" | "done" | "error" | "no-token";

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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f7", fontFamily: "sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 440, width: "100%", background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 6px 24px rgba(0,0,0,0.06)", textAlign: "center" }}>
        <img src="/images/finquanta_logo.svg" alt="Finquanta" style={{ height: 36, margin: "0 auto 20px" }} />

        {status === "ready" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✉️</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Confirm your email</h1>
            <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 20px" }}>Click below to finish confirming your Finquanta email address.</p>
            <button onClick={confirm} style={{ background: "#22c55e", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              Confirm my email
            </button>
          </>
        )}

        {status === "confirming" && <p style={{ color: "#6b7280" }}>Confirming your email…</p>}

        {status === "no-token" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Missing link</h1>
            <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 20px" }}>This verification link is missing its token. Open the link straight from your email, or request a new one below.</p>
            <ResendForm resendEmail={resendEmail} setResendEmail={setResendEmail} resendMsg={resendMsg} resending={resending} onSubmit={handleResend} />
          </>
        )}

        {status === "done" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Email confirmed</h1>
            <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 20px" }}>{message}</p>
            <Link href="/dashboard" style={{ display: "inline-block", background: "#22c55e", color: "#fff", textDecoration: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 600, fontSize: 14 }}>
              Go to dashboard
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Couldn&apos;t confirm</h1>
            <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 20px" }}>
              {message}{expired ? " Enter your email to get a fresh link." : ""}
            </p>
            <ResendForm resendEmail={resendEmail} setResendEmail={setResendEmail} resendMsg={resendMsg} resending={resending} onSubmit={handleResend} />
            <p style={{ marginTop: 16 }}>
              <Link href="/login" style={{ color: "#2563eb", fontSize: 13, textDecoration: "none" }}>Back to login</Link>
            </p>
          </>
        )}
      </div>
    </div>
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
  if (resendMsg) return <p style={{ color: "#16a34a", fontSize: 14 }}>{resendMsg}</p>;
  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        type="email"
        value={resendEmail}
        onChange={(e) => setResendEmail(e.target.value)}
        placeholder="you@example.com"
        style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", fontSize: 14 }}
      />
      <button type="submit" disabled={resending} style={{ background: "#22c55e", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: resending ? "default" : "pointer", opacity: resending ? 0.7 : 1 }}>
        {resending ? "Sending…" : "Resend verification email"}
      </button>
    </form>
  );
}
