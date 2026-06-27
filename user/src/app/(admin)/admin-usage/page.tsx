"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdmin } from "@/lib/api/admin";
import AdminSidebar, { readAdminDark } from "@/components/admin/AdminSidebar";

const USAGE_URL = "https://platform.claude.com/settings/usage";
const COST_URL = "https://platform.claude.com/settings/cost";

export default function AdminUsagePage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);

  useEffect(() => { setDark(readAdminDark()); }, []);
  useEffect(() => {
    checkAdmin().catch(() => router.replace("/admin-login"));
  }, [router]);

  const c = {
    bg: dark ? "#0f172a" : "#f4f5f7",
    card: dark ? "#1e293b" : "#fff",
    border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#6b7280",
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif", background: c.bg, color: c.text }}>
      <AdminSidebar active="usage" dark={dark} setDark={setDark} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>API Usage</h1>
            <p style={{ fontSize: 13, color: c.muted, margin: "2px 0 0" }}>Track your Anthropic spend so you know when to top up credits.</p>
          </div>

          <div style={{ borderRadius: 12, border: `1px solid ${c.border}`, background: c.card, padding: 24, display: "grid", gap: 14 }}>
            <p style={{ fontWeight: 600, margin: 0 }}>View your spend on Anthropic&apos;s dashboard</p>
            <p style={{ fontSize: 13, color: c.muted, margin: 0, lineHeight: 1.5 }}>
              Anthropic shows your exact API costs and token usage in their Console — no setup or key needed. Open it any time to see how
              much Finna has spent and how many credits are left. Sign in with the same Anthropic account that holds your API key.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 4 }}>
              <a href={USAGE_URL} target="_blank" rel="noopener noreferrer"
                style={{ borderRadius: 8, background: "#16a34a", color: "#fff", border: "none", padding: "10px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                Open Usage dashboard →
              </a>
              <a href={COST_URL} target="_blank" rel="noopener noreferrer"
                style={{ borderRadius: 8, background: "transparent", color: c.text, border: `1px solid ${c.border}`, padding: "10px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                Open Cost dashboard →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
