"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminBusiness, checkAdmin, listAdminBusinesses, refreshAdminBusinessBeta, setAdminBusinessBeta,
} from "@/lib/api/admin";
import { openInBeta } from "@/lib/api/betaImport";
import {
  AdminBetaFeature, FeatureStage, listAdminBetaFeatures, setAdminBetaFeatureStage,
} from "@/lib/api/betaFeatures";
import AdminSidebar, { readAdminDark } from "@/components/admin/AdminSidebar";

/**
 * Beta workspaces: every workspace cloned into beta.finquanta.ai.
 *
 * A workspace is added from Workspaces → ⋯ → Make beta, or by its owner in
 * workspace settings. This tab is the list of them — how many, how each copy
 * went — and the place to refresh or remove one.
 */
export default function AdminBetaPage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [rows, setRows] = useState<AdminBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<AdminBetaFeature[]>([]);
  const [savingFeature, setSavingFeature] = useState("");

  const setStage = async (key: string, stage: FeatureStage) => {
    setSavingFeature(key);
    setError(null);
    try { setFeatures(await setAdminBetaFeatureStage(key, stage)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not change the feature."); }
    finally { setSavingFeature(""); }
  };

  const load = () => {
    setLoading(true);
    listAdminBetaFeatures()
      .then(setFeatures)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load beta features."));
    listAdminBusinesses()
      .then((list) => setRows(list.filter((b) => b.beta)))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load beta workspaces."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setDark(readAdminDark()); }, []);
  useEffect(() => {
    checkAdmin().then(load).catch(() => router.replace("/admin-login"));
  }, [router]);

  // A copy runs in the background; keep checking until none is still going.
  const anyCopying = rows.some((b) => b.betaCopyStatus === "copying");
  useEffect(() => {
    if (!anyCopying) return;
    const timer = setInterval(() => {
      listAdminBusinesses().then((list) => setRows(list.filter((b) => b.beta))).catch(() => undefined);
    }, 5000);
    return () => clearInterval(timer);
  }, [anyCopying]);

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try { await fn(); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
    finally { setBusyId(""); }
  };

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const c = {
    bg: dark ? "#0f172a" : "#f4f5f7",
    card: dark ? "#1e293b" : "#fff",
    border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#6b7280",
    head: dark ? "#0f172a" : "#f9fafb",
  };

  const Status = ({ b }: { b: AdminBusiness }) => {
    const look = {
      none: { label: "Not Copied", fg: c.muted, bg: dark ? "rgba(148,163,184,.18)" : "#f1f5f9" },
      copying: { label: "Copying…", fg: dark ? "#c4b5fd" : "#5b21b6", bg: dark ? "rgba(139,92,246,.2)" : "#ede9fe" },
      done: { label: "Copied", fg: dark ? "#4ade80" : "#15803d", bg: dark ? "rgba(34,197,94,.18)" : "#dcfce7" },
      failed: { label: "Failed", fg: dark ? "#f87171" : "#b91c1c", bg: dark ? "rgba(239,68,68,.18)" : "#fee2e2" },
    }[b.betaCopyStatus] ?? { label: b.betaCopyStatus, fg: c.muted, bg: "transparent" };
    return (
      <span title={b.betaCopyError ?? undefined} style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: look.bg, color: look.fg }}>
        {look.label}
      </span>
    );
  };

  const copying = rows.filter((b) => b.betaCopyStatus === "copying").length;
  const failed = rows.filter((b) => b.betaCopyStatus === "failed").length;
  const button = (primary = false) => ({
    borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: `1px solid ${primary ? "#16a34a" : c.border}`,
    background: primary ? "#16a34a" : c.card, color: primary ? "#fff" : c.text,
  });

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif", background: c.bg, color: c.text }}>
      <AdminSidebar active="beta" dark={dark} setDark={setDark} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Beta Workspaces</h1>
              <p style={{ fontSize: 13, color: c.muted, margin: "2px 0 0" }}>
                Workspaces copied into beta.finquanta.ai, where new features are tried on real numbers without
                touching the real books. Add one from Workspaces → ⋯ → Make beta.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={() => openInBeta().catch((e) => setError(e instanceof Error ? e.message : String(e)))} style={button(true)}>
                Open Beta
              </button>
              <button onClick={load} disabled={loading} style={{ ...button(), opacity: loading ? 0.6 : 1 }}>
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
            <div style={{ border: `0.5px solid ${c.border}`, borderRadius: 12, padding: "14px 16px", background: c.card, minWidth: 160 }}>
              <p style={{ margin: 0, fontSize: 12, color: c.muted, fontWeight: 600 }}>Beta Workspaces</p>
              <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700 }}>{rows.length}</p>
            </div>
            <div style={{ border: `0.5px solid ${c.border}`, borderRadius: 12, padding: "14px 16px", background: c.card, minWidth: 160 }}>
              <p style={{ margin: 0, fontSize: 12, color: c.muted, fontWeight: 600 }}>Copying Now</p>
              <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700 }}>{copying}</p>
            </div>
            <div style={{ border: `0.5px solid ${c.border}`, borderRadius: 12, padding: "14px 16px", background: c.card, minWidth: 160 }}>
              <p style={{ margin: 0, fontSize: 12, color: c.muted, fontWeight: 600 }}>Last Copy Failed</p>
              <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: failed ? "#dc2626" : c.text }}>{failed}</p>
            </div>
          </div>

          {error && <p style={{ color: "#dc2626", fontSize: 13, margin: "12px 0" }}>{error}</p>}

          {/* Each new feature's stage. Beta: beta workspaces on the real site,
              and everyone on beta.finquanta.ai. Everyone: the whole product. */}
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "8px 0 4px" }}>Beta Features</h2>
          <p style={{ fontSize: 12, color: c.muted, margin: "0 0 10px" }}>
            Off hides a feature. Beta shows it to beta workspaces only. Everyone shows it to every workspace.
          </p>
          <div style={{ borderRadius: 12, border: `1px solid ${c.border}`, background: c.card, overflow: "hidden", marginBottom: 24 }}>
            {features.length === 0 ? (
              <p style={{ padding: 16, margin: 0, color: c.muted, fontSize: 13 }}>No beta features.</p>
            ) : (
              features.map((f, i) => (
                <div key={f.key} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 14px",
                  borderTop: i ? `1px solid ${c.border}` : "none", flexWrap: "wrap",
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: c.muted }}>{f.description}</div>
                  </div>
                  <div style={{ display: "flex", border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                    {(["off", "beta", "all"] as FeatureStage[]).map((stage) => {
                      const on = f.stage === stage;
                      return (
                        <button
                          key={stage}
                          disabled={savingFeature === f.key}
                          onClick={() => { if (!on) setStage(f.key, stage); }}
                          style={{
                            padding: "6px 12px", fontSize: 12, fontWeight: 600, border: "none", cursor: on ? "default" : "pointer",
                            background: on ? (stage === "off" ? "#6b7280" : "#16a34a") : c.card,
                            color: on ? "#fff" : c.text, opacity: savingFeature === f.key ? 0.6 : 1,
                          }}
                        >
                          {stage === "off" ? "Off" : stage === "beta" ? "Beta" : "Everyone"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Beta Workspaces</h2>

          <div style={{ borderRadius: 12, border: `1px solid ${c.border}`, background: c.card, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: c.head, color: c.muted, textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }}>Workspace</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }}>Owner</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }}>Copy</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }}>Last Copied</th>
                  <th style={{ padding: "10px 14px", fontWeight: 600 }} />
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 20, color: c.muted }}>Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 20, color: c.muted }}>No beta workspaces yet.</td></tr>
                ) : (
                  rows.map((b) => (
                    <tr key={b.id} style={{ borderTop: `1px solid ${c.border}` }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{b.name || "—"}</td>
                      <td style={{ padding: "10px 14px", color: c.muted }}>{b.ownerEmail || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <Status b={b} />
                        {b.betaCopyStatus === "failed" && b.betaCopyError && (
                          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4, maxWidth: 320 }}>{b.betaCopyError}</div>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", color: c.muted, whiteSpace: "nowrap" }}>{fmt(b.betaCopiedAt)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          disabled={busyId === b.id || b.betaCopyStatus === "copying"}
                          onClick={() => act(b.id, () => refreshAdminBusinessBeta(b.id))}
                          style={{ ...button(), marginRight: 6, opacity: busyId === b.id || b.betaCopyStatus === "copying" ? 0.5 : 1 }}
                        >
                          Refresh Copy
                        </button>
                        <button
                          disabled={busyId === b.id}
                          onClick={() => act(b.id, () => setAdminBusinessBeta(b.id, false))}
                          style={{ ...button(), color: "#dc2626", opacity: busyId === b.id ? 0.5 : 1 }}
                        >
                          Remove from Beta
                        </button>
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
  );
}
