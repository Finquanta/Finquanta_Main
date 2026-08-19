"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminBusiness, AdminBillingOverview, checkAdmin, deleteAdminBusiness,
  extendAdminBusinessTrial, getAdminBillingOverview, listAdminBusinesses,
  assignAdminBusinessOwner, setAdminBusinessGrandfather, setAdminBusinessPlan, setAdminBusinessStatus,
  startAdminBusinessTrial, updateAdminBusiness,
} from "@/lib/api/admin";
import AdminSidebar, { readAdminDark } from "@/components/admin/AdminSidebar";
import { planTone as planToneColors } from "@/lib/planColors";

/**
 * Workspaces, one row each.
 *
 * This tab exists because business data used to be columns on the Users tab,
 * joined on `user_id`. `business_profiles` became one row per BUSINESS in the
 * 2026-08-10 migration, so that join multiplied rows: 26 users rendered as 29,
 * and an owner of four workspaces appeared four times. Here one row per
 * business is the point rather than a bug.
 */
export default function AdminBusinessesPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [myRole, setMyRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(false);
  const [busyId, setBusyId] = useState<string>("");
  const [openMenuId, setOpenMenuId] = useState<string>("");
  const [editBiz, setEditBiz] = useState<AdminBusiness | null>(null);
  const [form, setForm] = useState({ name: "", country: "" });
  const [billing, setBilling] = useState<AdminBillingOverview | null>(null);
  /** Which row has its plan dropdown open. */
  const [planFor, setPlanFor] = useState<AdminBusiness | null>(null);

  const bounceToLogin = (msg: string) => {
    if (/admin access|authentication|session|401|403/i.test(msg)) { router.replace("/admin-login"); return true; }
    return false;
  };

  const load = () =>
    Promise.all([listAdminBusinesses(), getAdminBillingOverview().catch(() => null)])
      .then(([data, bill]) => { setBusinesses(data); setBilling(bill); })
      .catch((e) => { const m = e instanceof Error ? e.message : ""; if (!bounceToLogin(m)) setError(m || "Could not load businesses."); });

  useEffect(() => { setDark(readAdminDark()); }, []);

  useEffect(() => {
    checkAdmin()
      .then((me) => { setMyRole(me.role); return load(); })
      .catch((e) => { if (!bounceToLogin(e instanceof Error ? e.message : "")) router.replace("/admin-login"); })
      .finally(() => setLoading(false));
  }, [router]);

  // Same capability matrix as the Users tab, but applied to the workspace
  // OWNER's role. Deleting someone's workspace destroys the same financial
  // history deleting their account does, so it cannot be the softer path.
  const rank = (r: string) => ({ user: 0, admin: 1, super_admin: 2, owner: 3 } as Record<string, number>)[r] ?? 0;
  const canRestrict = (t: string) => myRole === "owner" || (myRole === "super_admin" && rank(t) <= 1) || (myRole === "admin" && t === "user");
  const canDelete = (t: string) => myRole === "owner" || (myRole === "super_admin" && rank(t) <= 1);
  const canEditName = (t: string) => myRole === "owner" || (myRole === "super_admin" && rank(t) <= 1) || (myRole === "admin" && t === "user");
  // The list doesn't carry the owner's role, so actions are offered against a
  // plain user and the server re-checks properly against the real role.
  const canManage = () => canRestrict("user") || canDelete("user") || canEditName("user");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter((b) =>
      [b.name, b.ownerName, b.ownerEmail, b.previousOwnerEmail, b.country, b.industry, b.businessPhone, b.plan, b.effectivePlan, b.badgeLabel].some((f) => (f || "").toLowerCase().includes(q))
    );
  }, [businesses, query]);

  const act = async (fn: () => Promise<void>, id: string) => {
    setBusyId(id); setError(null); setOpenMenuId("");
    try { await fn(); await load(); }
    catch (e) { const m = e instanceof Error ? e.message : "Action failed."; if (!bounceToLogin(m)) setError(m); }
    finally { setBusyId(""); }
  };

  const startEdit = (b: AdminBusiness) => {
    setForm({ name: b.name || "", country: b.country || "" });
    setEditBiz(b);
    setOpenMenuId("");
  };
  const saveEdit = () => {
    if (!editBiz) return;
    act(() => updateAdminBusiness(editBiz.id, {
      name: form.name.trim(), country: form.country.trim(),
    }).then(() => setEditBiz(null)), editBiz.id);
  };
  const toggleStatus = (b: AdminBusiness) =>
    act(() => setAdminBusinessStatus(b.id, b.status === "suspended" ? "active" : "suspended"), b.id);

  /**
   * Hand an abandoned workspace to someone, by email.
   *
   * A prompt rather than a picker: this is a rare recovery action, the admin
   * already knows whose it should be, and a searchable list of every account on
   * the platform is a lot of machinery for something used once in a while.
   */
  const assignOwner = async (b: AdminBusiness) => {
    setOpenMenuId("");
    const email = window.prompt(
      `Assign an owner to "${b.name}".

` +
      (b.previousOwnerEmail ? `It previously belonged to ${b.previousOwnerEmail}.

` : "") +
      `Enter the email address of the account that should own it. They are added ` +
      `to the workspace as Owner.`,
      b.previousOwnerEmail || ""
    );
    if (!email?.trim()) return;

    // The server resolves the address and says so if it matches nobody.
    act(() => assignAdminBusinessOwner(b.id, { email: email.trim() }), b.id);
  };

  const changePlan = (b: AdminBusiness, plan: string) =>
    act(() => setAdminBusinessPlan(b.id, plan).then(() => setPlanFor(null)), b.id);

  /**
   * Grandfathering, chosen from the plan picker — which means it has to BECOME
   * the workspace's plan, not sit alongside the one it already has.
   *
   * A paid plan is cleared first. Otherwise picking "Grandfathered" on an
   * Entrepreneur workspace left it billed as Entrepreneur, so the badge went on
   * reading "Entrepreneur" and the choice appeared to do nothing — the label
   * shows what is being paid for whenever anything is.
   *
   * The Stripe caveat is spelled out rather than handled silently: comping a
   * customer here does NOT cancel a live subscription, and an admin who assumes
   * it does has just given away the product while still charging for it.
   */
  const grandfatherFromPicker = async (b: AdminBusiness) => {
    setPlanFor(null);

    const paid = b.planKey !== "freemium";
    if (paid && !window.confirm(
      `Move ${b.name} from ${b.plan} to grandfathered?

` +
      `Their paid plan is cleared and they get full access free until the date you choose.` +
      (b.subscriptionStatus === "active"
        ? `

WARNING: they have a live Stripe subscription. This does NOT cancel it — ` +
          `cancel it in Stripe as well, or they will keep being charged.`
        : "")
    )) return;

    const raw = window.prompt(
      `Grandfather "${b.name}".

` +
      `They keep Business features free until the date this sets.

` +
      `Enter a number of months from today, or 0 to remove it.`,
      "6"
    );
    if (raw === null) return;
    const months = Number(raw);
    if (!Number.isFinite(months) || months < 0) { setError("Enter a number of months."); return; }

    act(async () => {
      // Clear the paid plan first: grandfathered is a state of NOT paying, and
      // leaving the old plan behind is what made this look like a no-op.
      if (paid && months > 0) await setAdminBusinessPlan(b.id, "freemium");
      await setAdminBusinessGrandfather(b.id, months === 0 ? null : Math.round(months));
    }, b.id);
  };

  const startTrial = (b: AdminBusiness) =>
    act(() => startAdminBusinessTrial(b.id), b.id);

  const setGrandfather = (b: AdminBusiness) => {
    setOpenMenuId("");
    const current = b.grandfatheredUntil
      ? `Currently grandfathered until ${fmtDate(b.grandfatheredUntil)}.`
      : "Not grandfathered yet.";
    const raw = window.prompt(
      `Grandfather "${b.name}".\n\n${current}\n\n` +
      `They keep Business features free until the date this sets, whatever ` +
      `plan they are billed for.\n\n` +
      `Enter a number of months from today, or 0 to remove it.`,
      "6"
    );
    if (raw === null) return;
    const months = Number(raw);
    if (!Number.isFinite(months) || months < 0) { setError("Enter a number of months."); return; }
    act(() => setAdminBusinessGrandfather(b.id, months === 0 ? null : Math.round(months)), b.id);
  };

  const extendTrial = (b: AdminBusiness) => {
    setOpenMenuId("");
    const raw = window.prompt(`Extend the trial for "${b.name}" by how many days?`, "14");
    if (!raw) return;
    const days = Number(raw);
    if (!Number.isFinite(days) || days <= 0) { setError("Enter a number of days."); return; }
    act(() => extendAdminBusinessTrial(b.id, Math.round(days)), b.id);
  };
  const remove = (b: AdminBusiness) => {
    // Spelled out because this is not the same as deleting a note: the cascade
    // takes the whole ledger — invoices, transactions, customers, the Brain.
    const ok = window.confirm(
      `Delete the workspace "${b.name}" owned by ${b.ownerEmail}?\n\n` +
      `This permanently removes its entire financial history — invoices, transactions, customers, groups and Company Brain. ` +
      `It cannot be undone.`
    );
    if (ok) act(() => deleteAdminBusiness(b.id), b.id);
  };

  const d = {
    bg: dark ? "#0f172a" : "#f4f5f7", surface: dark ? "#1e293b" : "#fff", border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a", muted: dark ? "#94a3b8" : "#6b7280", input: dark ? "#0f172a" : "#f9fafb",
    head: dark ? "#0f172a" : "#fafafa", menuHover: dark ? "#334155" : "#f3f4f6",
  };
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");

  /**
   * The badge. Both the words and the colour come from the SERVER
   * (`planBadgeFor`), so this table and the business switcher in the dashboard
   * cannot describe the same workspace differently — which is exactly what
   * happened when each surface decided for itself.
   *
   * The palette itself lives in lib/planColors, shared for the same reason.
   */
  const planBadge = (plan: string, tone: string) => {
    const c = planToneColors(tone, dark);
    return (
      <span style={{ background: c.bg, color: c.fg, border: `0.5px solid ${c.border}`, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>
        {plan}
      </span>
    );
  };

  const MenuItem = ({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) => (
    <button
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = d.menuHover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", fontSize: 13, background: "transparent", border: "none", cursor: "pointer", color: danger ? "#dc2626" : d.text }}
    >
      {label}
    </button>
  );

  const restrictedCount = businesses.filter((b) => b.status === "suspended").length;
  const multiMember = businesses.filter((b) => b.memberCount > 1).length;

  return (
    <div style={{ display: "flex", height: "100vh", background: d.bg, fontFamily: "sans-serif", fontSize: 14, color: d.text }}>
      <AdminSidebar active="businesses" dark={dark} setDark={setDark} />

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 28px", borderBottom: `0.5px solid ${d.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Businesses</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: d.muted }}>{loading ? "Loading…" : `${businesses.length} workspaces`}</p>
          </div>
          <input placeholder="Search business, owner, country…" value={query} onChange={(e) => setQuery(e.target.value)}
            style={{ width: 300, padding: "8px 12px", border: `0.5px solid ${d.border}`, borderRadius: 8, fontSize: 13, outline: "none", background: d.input, color: d.text }} />
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 28px" }}>
          {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, maxWidth: 660, marginBottom: 16 }}>
            <div style={{ border: `0.5px solid ${d.border}`, borderRadius: 12, padding: "14px 16px", background: d.head }}>
              <p style={{ margin: 0, fontSize: 12, color: d.muted, fontWeight: 600 }}>Workspaces</p>
              <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700 }}>{businesses.length}</p>
            </div>
            <div style={{ border: `0.5px solid ${d.border}`, borderRadius: 12, padding: "14px 16px", background: d.head }}>
              <p style={{ margin: 0, fontSize: 12, color: d.muted, fontWeight: 600 }}>With a team</p>
              <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: "#16a34a" }}>{multiMember}</p>
            </div>
            <div style={{ border: `0.5px solid ${d.border}`, borderRadius: 12, padding: "14px 16px", background: d.head }}>
              <p style={{ margin: 0, fontSize: 12, color: d.muted, fontWeight: 600 }}>Restricted</p>
              <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700, color: restrictedCount ? "#dc2626" : d.text }}>{restrictedCount}</p>
            </div>
          </div>

          {/* Revenue and plan mix (spec 08 §4.3). */}
          {billing && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 16 }}>
              <div style={{ border: `0.5px solid ${d.border}`, borderRadius: 12, padding: "14px 16px", background: d.head }}>
                <p style={{ margin: 0, fontSize: 12, color: d.muted, fontWeight: 600 }}>Projected MRR</p>
                <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700 }}>
                  ${billing.projectedMrr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {/* Said plainly so nobody quotes this as revenue in a board deck. */}
                <p style={{ margin: "6px 0 0", fontSize: 11, color: d.muted, lineHeight: 1.4 }}>
                  Price x seats on active plans. Nothing is being charged yet — trials and
                  grandfathered accounts count as $0. Real MRR arrives with Stripe.
                </p>
              </div>
              <div style={{ border: `0.5px solid ${d.border}`, borderRadius: 12, padding: "14px 16px", background: d.head }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: d.muted, fontWeight: 600 }}>Plan distribution</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                  {billing.distribution.map((row) => (
                    <div key={row.plan} style={{ minWidth: 110 }}>
                      {/* Same colour as the rows below, so a plan looks like
                          itself in both halves of the tab. These are BILLED
                          plans, so no window colours apply here. */}
                      <div style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize", color: planToneColors(row.plan, dark).text }}>{row.plan}</div>
                      <div style={{ fontSize: 12, color: d.muted }}>
                        {row.businesses} workspace{row.businesses === 1 ? "" : "s"} · {row.seats} seat{row.seats === 1 ? "" : "s"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {loading ? <p style={{ color: d.muted, fontSize: 13 }}>Loading workspaces…</p> : filtered.length === 0 ? <p style={{ color: d.muted, fontSize: 13 }}>No workspaces found.</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: d.muted, background: d.head }}>
                  {["Workspace", "Owner", "Members", "Plan", "Phone", "Country", "Status", "Created", ""].map((h, i) => (
                    <th key={i} style={{ padding: "10px 12px", fontWeight: 600, borderBottom: `0.5px solid ${d.border}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const busy = busyId === b.id;
                  // Dim only the content cells for restricted workspaces — never
                  // the actions cell, or its dropdown inherits the low opacity
                  // (CSS opacity on a parent caps its children) and renders
                  // see-through.
                  const dim = b.status === "suspended" ? 0.55 : 1;
                  return (
                    <tr key={b.id} style={{ borderBottom: `0.5px solid ${d.border}` }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, opacity: dim }}>{b.name || "—"}</td>
                      <td style={{ padding: "10px 12px", opacity: dim }}>
                        {/* An ownerless workspace is the one an admin is most
                            likely to be looking for, so it says so loudly and
                            keeps the previous owner underneath — that is what
                            makes an accidental departure recoverable. */}
                        {b.ownerless ? (
                          <>
                            <div style={{ color: "#dc2626", fontWeight: 700 }}>No owner</div>
                            <div style={{ color: d.muted, fontSize: 12 }}>
                              {b.previousOwnerEmail ? `was ${b.previousOwnerEmail}` : "previous owner unknown"}
                            </div>
                          </>
                        ) : (
                          <>
                            <div>{b.ownerName}</div>
                            <div style={{ color: d.muted, fontSize: 12 }}>{b.ownerEmail}</div>
                          </>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", opacity: dim }}>{b.memberCount}</td>
                      <td style={{ padding: "10px 12px", opacity: dim }}>
                        {/* The EFFECTIVE plan leads, because it is the label
                            the customer sees in their own business switcher.
                            This column used to show the billed plan alone, so
                            a grandfathered workspace read "Freemium" here and
                            "Business" to its owner — two true answers to
                            different questions, and no way to tell them apart. */}
                        {planBadge(b.badgeLabel, b.badgeTone)}
                        {/* WHAT the window grants, until WHEN, and what we are
                            actually billing — the three things needed to answer
                            "why does this account have Council?" without
                            opening Stripe. The badge above names the window, so
                            this line carries the plan it grants. */}
                        {b.onFreeWindow && (
                          <div style={{ fontSize: 11, color: d.muted, marginTop: 3 }}>
                            {`${b.effectivePlan} features`}
                            {b.subscriptionStatus === "trialing" && b.trialEndsAt
                              ? ` until ${fmtDate(b.trialEndsAt)}`
                              : b.grandfatheredUntil
                                ? ` until ${fmtDate(b.grandfatheredUntil)}`
                                : ""}
                            {` · billed ${b.plan}`}
                          </div>
                        )}
                      </td>
                      {/* The BUSINESS's phone, not any individual's — those
                          are on the Users tab. Two separate numbers on purpose. */}
                      <td style={{ padding: "10px 12px", color: d.muted, opacity: dim }}>{b.businessPhone || "—"}</td>
                      <td style={{ padding: "10px 12px", opacity: dim }}>{b.country || "—"}</td>
                      <td style={{ padding: "10px 12px", opacity: dim }}>
                        <span style={{ color: b.status === "suspended" ? "#dc2626" : "#16a34a", fontWeight: 600, fontSize: 12 }}>
                          {b.status === "suspended" ? "restricted" : "active"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: d.muted, whiteSpace: "nowrap", opacity: dim }}>{fmtDate(b.createdAt)}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap", position: "relative", textAlign: "right" }}>
                        {!canManage() ? <span style={{ color: d.muted }}>—</span> : (
                          <>
                            <button disabled={busy} onClick={() => setOpenMenuId(openMenuId === b.id ? "" : b.id)}
                              style={{ background: "transparent", border: `0.5px solid ${d.border}`, borderRadius: 6, padding: "3px 9px", fontSize: 16, lineHeight: 1, cursor: "pointer", color: d.text }}>
                              ⋯
                            </button>
                            {openMenuId === b.id && (
                              <>
                                <div onClick={() => setOpenMenuId("")} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                                <div style={{ position: "absolute", right: 12, top: 40, zIndex: 50, background: d.surface, border: `0.5px solid ${d.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.18)", minWidth: 160, overflow: "hidden", paddingTop: 4, paddingBottom: 4 }}>
                                  {/* Only offered where it applies. Reassigning
                                      a workspace that HAS an owner would be
                                      taking a business off somebody, which is
                                      a graver thing than recovering an
                                      abandoned one — the server refuses it. */}
                                  {b.ownerless && (
                                    <MenuItem label="Assign owner" onClick={() => assignOwner(b)} />
                                  )}
                                  <MenuItem label="Edit" onClick={() => startEdit(b)} />
                                  <MenuItem label="Change plan" onClick={() => { setOpenMenuId(""); setPlanFor(b); }} />
                                  {/* A trial can only begin once; after that it
                                      is extended, never restarted. */}
                                  {b.subscriptionStatus === "trialing"
                                    ? <MenuItem label="Extend trial" onClick={() => extendTrial(b)} />
                                    : b.trialEndsAt
                                      ? <MenuItem label="Extend trial" onClick={() => extendTrial(b)} />
                                      : <MenuItem label="Start trial" onClick={() => startTrial(b)} />}
                                  {/* Named "Grandfather", not "Grant early
                                      access". They were always the same
                                      action, but the badge on the row says
                                      "Grandfathered" — two words for one thing
                                      reads as two features, one of which looks
                                      like it is missing. */}
                                  <MenuItem
                                    label={b.grandfatheredUntil ? "Change grandfathering" : "Grandfather workspace"}
                                    onClick={() => setGrandfather(b)}
                                  />
                                  <MenuItem label={b.status === "suspended" ? "Unrestrict" : "Restrict"} onClick={() => toggleStatus(b)} />
                                  <MenuItem label="Delete" danger onClick={() => remove(b)} />
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Plan picker. Every plan is offered including Corporate — comping a
          design partner is a real need, and the audit log is the control here
          rather than a permission matrix. */}
      {planFor && billing && (
        <div onClick={() => setPlanFor(null)} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "90vw", background: d.surface, color: d.text, borderRadius: 14, padding: 24, boxShadow: "0 12px 40px rgba(0,0,0,.3)" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>Change plan</h2>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: d.muted }}>
              {planFor.name} · {planFor.memberCount} seat{planFor.memberCount === 1 ? "" : "s"} · billed {planFor.plan}{planFor.onFreeWindow ? ` · using ${planFor.effectivePlan}` : ""}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {/* Grandfathered sits WITH the plans, not in a separate menu.
                  It is the answer to the same question — "what should this
                  workspace be on?" — and having it elsewhere meant putting a
                  workspace back on early access looked impossible from the one
                  screen built for changing what it is on. */}
              {(() => {
                const isGrandfathered = planFor.onFreeWindow && planFor.subscriptionStatus !== "trialing";
                const c = planToneColors("grandfathered", dark);
                return (
                  <button
                    disabled={busyId === planFor.id}
                    onClick={() => grandfatherFromPicker(planFor)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                      border: `0.5px solid ${isGrandfathered ? c.fg : d.border}`,
                      background: isGrandfathered ? c.bg : d.input,
                      color: d.text, textAlign: "left",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      Grandfathered
                      {isGrandfathered && (
                        <span style={{ color: c.fg, fontWeight: 500 }}>
                          {" · until " + fmtDate(planFor.grandfatheredUntil)}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 12, color: d.muted }}>
                      {isGrandfathered ? "change or remove" : "free, full access"}
                    </span>
                  </button>
                );
              })()}

              {billing.plans.map((p) => {
                const current = p.key === planFor.planKey;
                const total = p.contactSales ? null : p.monthly * planFor.memberCount;
                return (
                  <button
                    key={p.key}
                    disabled={current || busyId === planFor.id}
                    onClick={() => changePlan(planFor, p.key)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "11px 14px", borderRadius: 10, cursor: current ? "default" : "pointer",
                      border: `0.5px solid ${current ? "#22c55e" : d.border}`,
                      background: current ? (dark ? "#14532d33" : "#f0fdf4") : d.input,
                      color: d.text, textAlign: "left",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {p.name}{current && <span style={{ color: "#16a34a", fontWeight: 500 }}> · current</span>}
                    </span>
                    <span style={{ fontSize: 12, color: d.muted }}>
                      {p.contactSales
                        ? "contact sales"
                        : p.monthly === 0
                          ? "free"
                          // Per seat, so show what this workspace would actually cost.
                          : `$${p.monthly}/seat → $${(total ?? 0).toFixed(2)}/mo`}
                    </span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setPlanFor(null)} style={{ marginTop: 14, background: d.input, color: d.text, border: `0.5px solid ${d.border}`, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {editBiz && (
        <div onClick={() => setEditBiz(null)} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: "90vw", background: d.surface, color: d.text, borderRadius: 14, padding: 24, boxShadow: "0 12px 40px rgba(0,0,0,.3)" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>Edit workspace</h2>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: d.muted }}>Owned by {editBiz.ownerEmail}</p>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ fontSize: 12, color: d.muted }}>Business name
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ marginTop: 4, width: "100%", padding: "8px 10px", border: `0.5px solid ${d.border}`, borderRadius: 8, background: d.input, color: d.text, fontSize: 13, boxSizing: "border-box" }} />
              </label>
              <label style={{ fontSize: 12, color: d.muted }}>Country
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} style={{ marginTop: 4, width: "100%", padding: "8px 10px", border: `0.5px solid ${d.border}`, borderRadius: 8, background: d.input, color: d.text, fontSize: 13, boxSizing: "border-box" }} />
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button disabled={busyId === editBiz.id || !form.name.trim()} onClick={saveEdit} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: busyId === editBiz.id || !form.name.trim() ? 0.6 : 1 }}>{busyId === editBiz.id ? "Saving…" : "Save"}</button>
                <button onClick={() => setEditBiz(null)} style={{ background: d.input, color: d.text, border: `0.5px solid ${d.border}`, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
