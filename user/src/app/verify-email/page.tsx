"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { verifyEmail, resendVerification } from "@/lib/api/verify";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"checking" | "done" | "error">("checking");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing its token.");
      return;
    }
    verifyEmail(token)
      .then(() => { setStatus("done"); setMessage("Your email is confirmed. You're all set!"); })
      .catch((e) => { setStatus("error"); setMessage(e instanceof Error ? e.message : "Could not verify email."); });
  }, []);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    await resendVerification(resendEmail.trim());
    setResent(true);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f7", fontFamily: "sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 440, width: "100%", background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 6px 24px rgba(0,0,0,0.06)", textAlign: "center" }}>
        <img src="/images/finquanta_logo.svg" alt="Finquanta" style={{ height: 36, margin: "0 auto 20px" }} />

        {status === "checking" && <p style={{ color: "#6b7280" }}>Confirming your email…</p>}

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
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Couldn&apos;t verify</h1>
            <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 20px" }}>{message} The link may have expired. Enter your email to get a new one.</p>
            {resent ? (
              <p style={{ color: "#16a34a", fontSize: 14 }}>If that email is registered and unverified, a new link is on its way.</p>
            ) : (
              <form onSubmit={handleResend} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", fontSize: 14 }}
                />
                <button type="submit" style={{ background: "#22c55e", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  Resend verification email
                </button>
              </form>
            )}
            <p style={{ marginTop: 16 }}>
              <Link href="/login" style={{ color: "#2563eb", fontSize: 13, textDecoration: "none" }}>Back to login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
