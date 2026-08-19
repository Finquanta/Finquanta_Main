"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminOverview, checkAdmin, getAdminOverview } from "@/lib/api/admin";
import AdminSidebar, { readAdminDark } from "@/components/admin/AdminSidebar";
import { planTone } from "@/lib/planColors";

/**
 * The admin Overview — the first tab, and the one that answers "how are we
 * doing" without reading a table.
 *
 * Every figure here is a COUNT over the whole platform, computed in SQL. None
 * of it is derived in the browser from a list, because the lists it would need
 * are the ones that grow: users, workspaces, memberships.
 *
 * The revenue figure is labelled PROJECTED everywhere it appears. It is price ×
 * billable seats over assigned plans — what the platform would bill today if
 * every plan were live. Trials and early-access windows contribute zero, which
 * matters most right now: nearly every workspace is grandfathered, so a number
 * that counted them would flatter revenue precisely when it is least true.
 */
export default function AdminOverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [preset, setPreset] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => { setDark(readAdminDark()); }, []);

  const bounceToLogin = useCallback(() => router.replace("/login"), [router]);

  useEffect(() => {
    setLoading(true);
    checkAdmin()
      .then(() => getAdminOverview({ from: from || null, to: to || null }))
      .then(setData)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Could not load the overview.";
        if (/unauthor|forbidden|session/i.test(msg)) return bounceToLogin();
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [bounceToLogin, from, to]);

  /**
   * Presets, because the common questions are "today", "this month", "this
   * year" — and typing two dates to ask them is friction for no gain. Custom
   * exposes the pair for anything else.
   */
  const applyPreset = (key: string) => {
    setPreset(key);
    const now = new Date();
    const iso = (dt: Date) => dt.toISOString().slice(0, 10);
    const first = (y: number, m: number) => iso(new Date(Date.UTC(y, m, 1)));

    if (key === "all") { setFrom(""); setTo(""); return; }
    if (key === "today") { setFrom(iso(now)); setTo(iso(now)); return; }
    if (key === "7d") {
      const d = new Date(now); d.setUTCDate(d.getUTCDate() - 6);
      setFrom(iso(d)); setTo(iso(now)); return;
    }
    if (key === "month") {
      setFrom(first(now.getUTCFullYear(), now.getUTCMonth())); setTo(iso(now)); return;
    }
    if (key === "year") {
      setFrom(first(now.getUTCFullYear(), 0)); setTo(iso(now)); return;
    }
    // "custom" keeps whatever is in the two inputs.
  };

  const d = {
    bg: dark ? "#0f172a" : "#f4f5f7", surface: dark ? "#1e293b" : "#fff",
    border: dark ? "#334155" : "#e5e7eb", text: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#6b7280", head: dark ? "#0f172a" : "#fafafa",
  };

  /** "in this period" phrasing, or empty when the range is open-ended. */
  const periodLabel = from || to
    ? (from && to && from === to ? `on ${from}` : `${from || "the start"} – ${to || "today"}`)
    : "";

  const money = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ border: `0.5px solid ${d.border}`, borderRadius: 12, padding: "16px 18px", background: d.surface }}>
      <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: d.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {title}
      </p>
      {children}
    </div>
  );

  /** A label and a number. The unit of this whole page. */
  const Stat = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
    <div style={{ minWidth: 120 }}>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: d.muted, marginTop: 2 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: d.muted, marginTop: 1 }}>{hint}</div>}
    </div>
  );

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>{children}</div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: d.bg, color: d.text }}>
      <AdminSidebar active="overview" dark={dark} setDark={setDark} />

      <main style={{ flex: 1, padding: "28px 32px", minWidth: 0 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Overview</h1>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: d.muted }}>
          Everything on the platform at a glance.
        </p>

        {/* Period. It scopes the DATED figures only — the snapshots below say
            so themselves rather than silently changing meaning. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 20 }}>
          {[
            ["all", "All time"], ["today", "Today"], ["7d", "Last 7 days"],
            ["month", "This month"], ["year", "This year"], ["custom", "Custom"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              style={{
                border: `0.5px solid ${preset === key ? "#22c55e" : d.border}`,
                background: preset === key ? (dark ? "#14532d33" : "#f0fdf4") : d.surface,
                color: d.text, borderRadius: 999, padding: "6px 14px",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}

          {preset === "custom" && (
            <span style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 4 }}>
              <input
                type="date" value={from} max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                style={{ background: d.surface, color: d.text, border: `0.5px solid ${d.border}`, borderRadius: 8, padding: "5px 8px", fontSize: 12 }}
              />
              <span style={{ fontSize: 12, color: d.muted }}>to</span>
              <input
                type="date" value={to} min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                style={{ background: d.surface, color: d.text, border: `0.5px solid ${d.border}`, borderRadius: 8, padding: "5px 8px", fontSize: 12 }}
              />
            </span>
          )}
        </div>

        {loading && <p style={{ fontSize: 13, color: d.muted }}>Loading…</p>}
        {error && <p style={{ fontSize: 13, color: "#dc2626" }}>{error}</p>}

        {data && (
          <div style={{ display: "grid", gap: 16 }}>
            {periodLabel && (
              <p style={{ margin: 0, fontSize: 12, color: d.muted }}>
                Showing dated figures for <strong>{periodLabel}</strong>. Revenue, plan mix, seats
                and active subscriptions are always as they stand today — a snapshot cannot be
                filtered by a date range without becoming meaningless.
              </p>
            )}

            {/* Revenue */}
            <Card title="Revenue (projected)">
              <Row>
                <Stat label="Projected MRR" value={money(data.projectedMrr)} />
                <Stat label="Projected ARR" value={money(data.projectedArr)} />
                <Stat
                  label="Billable seats"
                  value={data.seats.billable}
                  hint={`${data.seats.viewersFree} viewer${data.seats.viewersFree === 1 ? "" : "s"}, free`}
                />
              </Row>
              <p style={{ margin: "12px 0 0", fontSize: 11, color: d.muted, maxWidth: 560 }}>
                Price × billable seats on active plans. Trials and grandfathered workspaces count as
                $0 — they are not revenue, and counting them would flatter the number exactly when it
                is least true. Real MRR comes from Stripe once subscriptions are running.
              </p>
            </Card>

            {/* Plans — all of them, including the empty tiers. A plan with
                nobody on it is a fact worth seeing, not a gap to infer. */}
            <Card title="Plans">
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                {data.plans.map((p) => {
                  const c = planTone(p.plan, dark);
                  const revenue = p.contactSales ? null : p.monthly * p.seats;
                  return (
                    <div
                      key={p.plan}
                      style={{
                        border: `0.5px solid ${p.businesses > 0 ? c.fg : d.border}`,
                        borderRadius: 10,
                        padding: "12px 14px",
                        background: p.businesses > 0 ? c.bg : "transparent",
                        opacity: p.businesses > 0 ? 1 : 0.65,
                      }}
                    >
                      {/* Filled card -> text sits on the tint (fg). Empty card
                          -> it sits on the page, which is dark (text). */}
                      <div style={{ fontSize: 14, fontWeight: 700, color: p.businesses > 0 ? c.fg : c.text }}>{p.name}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{p.businesses}</div>
                      <div style={{ fontSize: 11, color: d.muted }}>
                        workspace{p.businesses === 1 ? "" : "s"}
                      </div>
                      <div style={{ fontSize: 11, color: d.muted, marginTop: 6 }}>
                        {p.seats} billable seat{p.seats === 1 ? "" : "s"}
                      </div>
                      <div style={{ fontSize: 11, color: d.muted }}>
                        {p.contactSales
                          ? "negotiated"
                          : p.monthly === 0
                            ? "free"
                            : `${money(revenue ?? 0)}/mo`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Churn */}
            <Card title="Churn & retention">
              <Row>
                <Stat label="Active subscriptions" value={data.churn.active} />
                <Stat
                  label="Cancelling"
                  value={data.churn.cancelling}
                  hint="still active, end date set"
                />
                <Stat label="Cancelled" value={data.churn.canceled} />
                <Stat
                  label="Churn rate"
                  value={`${data.churn.churnRate}%`}
                  hint="of everyone who ever subscribed"
                />
              </Row>
              <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 22 }}>
                <Stat label="Payment failing" value={data.churn.pastDue} />
                <Stat
                  label={periodLabel ? `Cancelled ${periodLabel}` : "Cancelled (all time)"}
                  value={periodLabel ? data.churn.cancelledInPeriod : data.churn.canceled}
                />
                <Stat label="On trial now" value={data.churn.trialing} />
                <Stat
                  label="Trials converted"
                  value={`${data.churn.trialsConverted} / ${data.churn.trialsStarted}`}
                  hint={data.churn.trialsStarted > 0
                    ? `${Math.round((data.churn.trialsConverted / data.churn.trialsStarted) * 100)}% went on to pay`
                    : "no trials started yet"}
                />
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 11, color: d.muted, maxWidth: 560 }}>
                <strong>Cancelling</strong> is the number to watch — those customers have already
                decided to leave and are running out their paid period. It is the only window in
                which anything can still be done about it.
              </p>
            </Card>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
              {/* Users */}
              <Card title="Users">
                <Row>
                  <Stat label="Total" value={data.users.total} />
                  <Stat
                    label="Verified"
                    value={data.users.verified}
                    hint={data.users.total > 0
                      ? `${Math.round((data.users.verified / data.users.total) * 100)}% of accounts`
                      : undefined}
                  />
                  <Stat
                    label={periodLabel ? `New ${periodLabel}` : "New (all time)"}
                    value={periodLabel ? data.users.newInPeriod : data.users.total}
                  />
                </Row>
                <Row>
                  <div style={{ marginTop: 14, display: "flex", gap: 22 }}>
                    <Stat label="Admins" value={data.users.admins} />
                    <Stat label="Suspended" value={data.users.suspended} />
                  </div>
                </Row>
              </Card>

              {/* Workspaces */}
              <Card title="Workspaces">
                <Row>
                  <Stat label="Total" value={data.businesses.total} />
                  <Stat
                    label="With a team"
                    value={data.businesses.multiMember}
                    hint="more than one member"
                  />
                  <Stat label="Avg members" value={data.businesses.avgMembers.toFixed(2)} />
                  <Stat
                    label={periodLabel ? `Created ${periodLabel}` : "Created (all time)"}
                    value={periodLabel ? data.businesses.newInPeriod : data.businesses.total}
                  />
                </Row>
                <Row>
                  <div style={{ marginTop: 14, display: "flex", gap: 22 }}>
                    <Stat label="Profile filled in" value={data.businesses.withProfile} />
                    <Stat label="Restricted" value={data.businesses.suspended} />
                  </div>
                </Row>
              </Card>
            </div>

            {/* Countries */}
            <Card title="Countries">
              {data.countries.length === 0 ? (
                <p style={{ fontSize: 13, color: d.muted }}>No countries recorded yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {data.countries.map((c) => {
                    const pct = data.businesses.total > 0
                      ? Math.round((c.businesses / data.businesses.total) * 100)
                      : 0;
                    return (
                      <div key={c.country} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, minWidth: 150 }}>{c.country}</span>
                        {/* A bar rather than a number alone: the shape of the
                            distribution is the thing worth seeing here. */}
                        <span style={{ flex: 1, height: 8, borderRadius: 999, background: dark ? "#0f172a" : "#f3f4f6", overflow: "hidden", minWidth: 60 }}>
                          <span style={{ display: "block", height: "100%", width: `${pct}%`, background: "#22c55e" }} />
                        </span>
                        <span style={{ fontSize: 12, color: d.muted, minWidth: 84, textAlign: "right" }}>
                          {c.businesses} · {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
