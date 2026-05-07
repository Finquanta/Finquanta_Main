"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000)); // replace with real API call
    setSent(true);
    setLoading(false);
  };

  return (
    <div style={{
      width: "100%", height: "100vh",
      background: "linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden"
    }}>
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "#22c55e", opacity: .05, top: -100, right: -80 }} />
      <div style={{ position: "absolute", width: 250, height: 250, borderRadius: "50%", background: "#16a34a", opacity: .05, bottom: -60, left: -40 }} />

      <div style={{ background: "#fff", borderRadius: 14, padding: "36px 32px", width: 320, zIndex: 2, position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <img src="/images/finquanta_logo.svg" alt="Finquanta" style={{ height: 36, width: "auto" }} />
        </div>

        {sent ? (
          <div style={{ textAlign: "center", display: "grid", gap: 12 }}>
            <div style={{ fontSize: 36 }}>✉️</div>
            <p style={{ fontWeight: 700, fontSize: 15 }}>Check your email</p>
            <p style={{ fontSize: 12, color: "#6b7280" }}>We sent a reset link to <strong>{email}</strong></p>
            <button onClick={() => router.push("/admin-login")} style={{
              width: "100%", background: "#22c55e", color: "#fff", border: "none",
              borderRadius: 7, padding: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8
            }}>Back to Login</button>
          </div>
        ) : (
          <>
            <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Reset your password</p>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Enter your admin email and we'll send a reset link.</p>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4, fontWeight: 500 }}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="hello@finquanta.com"
                  style={{ width: "100%", padding: "8px 12px", border: "0.5px solid #e5e7eb", borderRadius: 7, fontSize: 13, outline: "none", background: "#f9fafb", boxSizing: "border-box" }} />
              </div>
              <button type="submit" disabled={loading || !email} style={{
                width: "100%", background: "#22c55e", color: "#fff", border: "none",
                borderRadius: 7, padding: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                opacity: !email || loading ? 0.7 : 1
              }}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
            <button onClick={() => router.push("/admin-login")} style={{
              width: "100%", background: "none", border: "none", marginTop: 12,
              fontSize: 12, color: "#6b7280", cursor: "pointer", textDecoration: "underline"
            }}>
              Back to Login
            </button>
          </>
        )}
      </div>
      <span style={{ position: "absolute", bottom: 12, fontSize: 11, color: "rgba(255,255,255,.25)" }}>
        Finquanta Ltd. © 2024 · Administration Portal
      </span>
    </div>
  );
}