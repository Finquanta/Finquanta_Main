"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdmin } from "@/lib/api/admin";
import { AdminReferrals, getAdminReferrals } from "@/lib/api/referrals";
import AdminSidebar, { readAdminDark } from "@/components/admin/AdminSidebar";

/**
 * Section 13 — referral program, admin side.
 *
 * The number that matters is `qualified`: signed up, verified their email, AND
 * actually used the product. Signups on their own are noise — anyone can farm
 * those — so the funnel is shown in full to make the drop-off visible.
 */
export default function AdminReferralsPage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [data, setData] = useState<AdminReferrals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getAdminReferrals()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load referrals."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setDark(readAdminDark()); }, []);
  useEffect(() => {
    checkAdmin().then(load).catch(() => router.replace("/admin-login"));
  }, [router]);

  const c = {
    bg: dark ? "#0f172a" : "#f4f5f7",
    card: dark ? "#1e293b" : "#fff",
    border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#6b7280",
    head: dark ? "#0f172a" : "#f9fafb",
  };

  const th: React.CSSProperties = {
    textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 700,
    color: c.muted, borderBottom: `1px solid ${c.border}`, whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "10px 12px", fontSize: 13, borderBottom: `1px solid ${c.border}`,
  };

  const t = data?.totals;
  /** How many signups actually became real users. The honest headline. */
  const conversion = t && t.signedUp > 0 ? Math.round((t.qualified / t.signedUp) * 100) : 0;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif", background: c.bg, color: c.text }}>
      <AdminSidebar active="referrals" dark={dark} setDark={setDark} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Referrals</h1>
              <p style={{ fontSize: 13, color: c.muted, margin: "2px 0 0" }}>
                A referral only counts as qualified once the invited business verifies its email and records
                real activity — so throwaway signups earn nothing.
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              style={{ borderRadius: 8, background: c.card, color: c.text, border: `1px solid ${c.border}`, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {error && <p style={{ color: "#ef4444", fontSize: 13 }}>{error}</p>}

          {/* The funnel */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
            <Stat label="Referrers" value={t?.referrers ?? 0} hint="Users who've referred someone" c={c} />
            <Stat label="Signed up" value={t?.signedUp ?? 0} hint="Used a referral link" c={c} />
            <Stat label="Verified" value={t?.verified ?? 0} hint="Confirmed their email" c={c} />
            <Stat label="Qualified" value={t?.qualified ?? 0} hint={`${conversion}% of signups`} c={c} accent="#10b981" />
          </div>

          {/* Who's actually bringing people in */}
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 12px 0" }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Top referrers</h2>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                <thead style={{ background: c.head }}>
                  <tr>
                    <th style={th}>User</th>
                    <th style={th}>Code</th>
                    <th style={{ ...th, textAlign: "right" }}>Signed up</th>
                    <th style={{ ...th, textAlign: "right" }}>Verified</th>
                    <th style={{ ...th, textAlign: "right" }}>Qualified</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && (!data || data.leaderboard.length === 0) ? (
                    <tr>
                      <td style={{ ...td, color: c.muted, textAlign: "center", padding: 32 }} colSpan={5}>
                        Nobody has referred anyone yet.
                      </td>
                    </tr>
                  ) : (
                    data?.leaderboard.map((r) => (
                      <tr key={r.userId}>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{r.name}</div>
                          <div style={{ fontSize: 12, color: c.muted }}>{r.email}</div>
                        </td>
                        <td style={{ ...td, fontFamily: "monospace", color: c.muted }}>{r.code || "—"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{r.signedUp}</td>
                        <td style={{ ...td, textAlign: "right" }}>{r.verified}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: r.qualified > 0 ? "#10b981" : c.muted }}>
                          {r.qualified}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label, value, hint, c, accent,
}: {
  label: string; value: number; hint: string; accent?: string;
  c: { card: string; border: string; muted: string; text: string };
}) {
  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, color: c.muted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 2, color: accent ?? c.text }}>{value}</div>
      <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{hint}</div>
    </div>
  );
}
