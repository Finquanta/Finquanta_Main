"use client";
import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

  const field: React.CSSProperties = {
    width: "100%", padding: "8px 12px", border: "0.5px solid #e5e7eb", borderRadius: 7,
    fontSize: 13, outline: "none", background: "#f9fafb", color: "#0f172a", boxSizing: "border-box",
  };
  const greenBtn: React.CSSProperties = {
    width: "100%", background: "#22c55e", color: "#fff", border: "none", borderRadius: 7,
    padding: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 12,
  };

  return (
    <div style={{
      width: "100%", height: "100vh", background: "linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "#22c55e", opacity: .05, top: -100, right: -80 }} />
      <div style={{ position: "absolute", width: 250, height: 250, borderRadius: "50%", background: "#16a34a", opacity: .05, bottom: -60, left: -40 }} />

      <div style={{ background: "#fff", borderRadius: 14, padding: "36px 32px", width: 320, zIndex: 2, position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <img src="/images/finquanta_logo.svg" alt="Finquanta" style={{ height: 36, width: "auto" }} />
        </div>

        {!token ? (
          <div style={{ textAlign: "center", display: "grid", gap: 12 }}>
            <p style={{ fontWeight: 700, fontSize: 15 }}>Invalid reset link</p>
            <p style={{ fontSize: 12, color: "#6b7280" }}>This link is missing or malformed. Please request a new password reset.</p>
            <button onClick={() => router.push("/login")} style={greenBtn}>Back to Login</button>
          </div>
        ) : done ? (
          <div style={{ textAlign: "center", display: "grid", gap: 12 }}>
            <div style={{ fontSize: 36 }}>✅</div>
            <p style={{ fontWeight: 700, fontSize: 15 }}>Password updated</p>
            <p style={{ fontSize: 12, color: "#6b7280" }}>You can now log in with your new password.</p>
            <button onClick={() => router.push("/login")} style={greenBtn}>Go to Login</button>
          </div>
        ) : (
          <>
            <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Choose a new password</p>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Must be at least 8 characters, with upper &amp; lower case, a number, and a special character.</p>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4, fontWeight: 500 }}>New password</label>
                <div style={{ position: "relative" }}>
                  <input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={field} />
                  <span onClick={() => setShow(!show)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer", fontSize: 12, color: "#9ca3af" }}>{show ? "Hide" : "Show"}</span>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4, fontWeight: 500 }}>Confirm password</label>
                <input type={show ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" style={field} />
              </div>
              {error && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 8, marginBottom: 0 }}>{error}</p>}
              <button type="submit" disabled={loading} style={{ ...greenBtn, opacity: loading ? 0.7 : 1, cursor: loading ? "default" : "pointer" }}>
                {loading ? "Updating…" : "Reset Password"}
              </button>
            </form>
            <button onClick={() => router.push("/login")} style={{ width: "100%", background: "none", border: "none", marginTop: 12, fontSize: 12, color: "#6b7280", cursor: "pointer", textDecoration: "underline" }}>Back to Login</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
