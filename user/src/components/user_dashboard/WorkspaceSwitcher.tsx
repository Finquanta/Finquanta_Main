"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2, ChevronDown, Plus, UserPlus, Copy, Check, X, Pencil, Eye, ArrowLeft, Trash2,
  LogOut, Crown, Send, Link as LinkIcon,
} from "lucide-react";
import {
  Business, BusinessMember, BusinessRole, BUSINESS_ROLES,
  listBusinesses, createBusiness, createInvite, renameBusiness, getMembers, removeMember,
  transferOwnership, leaveBusiness, changeMemberRole,
} from "@/lib/api/businesses";
import { MyBilling, getMyBilling } from "@/lib/api/billing";
import { planTone } from "@/lib/planColors";
import { COUNTRIES } from "@/lib/countries";
import ConfirmDialog from "./ConfirmDialog";
import { getMe } from "@/lib/api/me";
import { useLanguage } from "@/hooks/context/LanguageContext";

const ACTIVE_KEY = "activeBusinessId";
/**
 * Roles that can be assigned or invited.
 *
 * Owner is excluded because becoming one is a transfer, not a role change.
 * "Other" is excluded because it says nothing — it grants full working access
 * and a paid seat exactly like the named roles, while telling nobody what the
 * person actually does. Nobody holds it.
 *
 * It stays in BUSINESS_ROLES rather than being deleted: the server validates
 * against that list, and a value that is merely no longer offered is safer than
 * one that suddenly becomes invalid for any row that might still carry it.
 */
const INVITABLE_ROLES = BUSINESS_ROLES.filter((r) => r !== "Owner" && r !== "Other");

export default function WorkspaceSwitcher({ isDark }: { isDark: boolean }) {
  const { t } = useLanguage();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  /**
   * Which country this business operates in — asked at creation because that is
   * the only moment the answer is obvious. Optional: somebody adding a
   * workspace in a hurry should not be stopped by it, and it is editable in
   * Settings -> Business profile afterwards.
   */
  const [newCountry, setNewCountry] = useState("");
  /**
   * The team panel opens for a SPECIFIC business, not the active one.
   *
   * It used to be a menu item at the bottom that always acted on whatever was
   * currently selected, so checking who was in another workspace meant
   * switching into it first — reloading every figure on screen to answer a
   * question about people. The eye on each row opens that row.
   */
  const [teamFor, setTeamFor] = useState<Business | null>(null);
  const [editingId, setEditingId] = useState<string>("");
  const [editName, setEditName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  // Position for the portalled dropdown (anchored under the button).
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const load = () => listBusinesses().then((bs) => {
    setBusinesses(bs);
    const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_KEY) : null;
    const valid = bs.find((b) => b.id === stored);
    const chosen = valid?.id || bs[0]?.id || "";
    setActiveId(chosen);
    if (chosen) localStorage.setItem(ACTIVE_KEY, chosen);
  }).catch(() => setBusinesses([]));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Toggle the dropdown, anchoring it under the trigger button (clamped so the
  // menu stays on screen on mobile).
  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v;
      if (next && btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        const width = 288;
        const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
        setPos({ top: r.bottom + 6, left, width });
      }
      return next;
    });
  };

  const active = businesses.find((b) => b.id === activeId);

  const switchTo = (id: string) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
    setOpen(false);
    window.dispatchEvent(new CustomEvent("finna:businessChanged", { detail: id }));
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const biz = await createBusiness(newName.trim(), newCountry || undefined);
      setNewName("");
      setNewCountry("");
      setCreating(false);
      await load();
      switchTo(biz.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not create workspace.");
    }
  };

  const startRename = (b: Business) => { setEditingId(b.id); setEditName(b.name); };

  const handleRename = async () => {
    if (!editName.trim() || !editingId) { setEditingId(""); return; }
    try {
      await renameBusiness(editingId, editName.trim());
      setEditingId("");
      setEditName("");
      await load();
      window.dispatchEvent(new CustomEvent("finna:businessChanged", { detail: activeId }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not rename workspace.");
    }
  };

  const colors = {
    btn: isDark ? "bg-gray-700 text-white border-gray-600" : "bg-gray-100 text-gray-900 border-gray-300",
    menu: isDark ? "bg-gray-800 border-gray-700 text-gray-200" : "bg-white border-gray-200 text-gray-900",
    item: isDark ? "hover:bg-gray-700" : "hover:bg-gray-50",
    input: isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900",
    sub: isDark ? "text-gray-400" : "text-gray-500",
    divider: isDark ? "border-gray-700" : "border-gray-200",
  };

  return (
    <div className="relative" ref={ref}>
      <button ref={btnRef} onClick={toggleOpen} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${colors.btn}`}>
        <Building2 className="h-4 w-4" />
        {/* "Workspace" is the user-facing name for a `businesses` row. One
            workspace is one business with its own books; a person belongs to as
            many as they like. The table keeps its internal name. */}
        <span className="max-w-[140px] truncate">{active?.name || t("dashboard", "businessLabel")}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && mounted && pos && createPortal(
        <div ref={menuRef} style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }} className={`rounded-xl border shadow-xl overflow-hidden ${colors.menu}`}>
          {/* Create sits at the TOP. It is the one action here rather than a
              choice among the rows, and at the bottom it drifted further out of
              reach with every business someone added. */}
          {creating ? (
            <div className="p-2 space-y-1.5">
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
                placeholder={t("settings","fBusinessName")} className={`w-full text-xs rounded-lg px-2 py-1.5 border outline-none ${colors.input}`} />
              {/* Per workspace, not per person: one business can be in the US
                  and another in Canada, with different books and different
                  rules. Optional, so it never blocks creating one. */}
              <select
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
                className={`w-full text-xs rounded-lg px-2 py-1.5 border outline-none ${colors.input}`}
              >
                <option value="">Country (optional)</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={!newName.trim()}
                  className="flex-1 bg-blue-500 disabled:opacity-50 text-white text-xs py-1.5 rounded-lg">Add</button>
                <button onClick={() => { setCreating(false); setNewName(""); setNewCountry(""); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${colors.divider} ${colors.sub}`}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setCreating(true)} className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 font-medium ${colors.item}`}>
              <Plus className="h-3.5 w-3.5" />{t("dashboard","wsCreateBusiness")}
            </button>
          )}

          <div className={`border-t ${colors.divider}`}>
            <div className={`px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide ${colors.sub}`}>{t("dashboard","wsYourBusinesses")}</div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {businesses.map((b) => {
              const canRename = b.role === "Owner" || b.role === "Admin";
              if (editingId === b.id) {
                return (
                  <div key={b.id} className="p-2 flex gap-2">
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditingId(""); }}
                      className={`flex-1 text-xs rounded-lg px-2 py-1.5 border outline-none ${colors.input}`} />
                    <button onClick={handleRename} className="text-green-500 hover:text-green-600" title={t("dashboard","grpSave")}><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditingId("")} className="text-gray-400 hover:text-gray-600" title={t("dashboard","invCancel")}><X className="h-4 w-4" /></button>
                  </div>
                );
              }
              return (
                <div key={b.id} className={`group w-full px-3 py-2 text-sm flex items-center justify-between gap-2 ${colors.item}`}>
                  <button onClick={() => switchTo(b.id)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{b.name}</span>
                      {b.plan && <PlanPill plan={b.plan} tone={b.planTone} isDark={isDark} />}
                    </span>
                    <span className={`block pl-[22px] text-[10px] ${colors.sub}`}>{b.role}</span>
                  </button>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    {canRename && (
                      <button onClick={() => startRename(b)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600" title={t("dashboard","grpRename")}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => { setOpen(false); setTeamFor(b); }} className="text-gray-400 hover:text-blue-500" title={t("dashboard","wsViewTeam")}>
                      <Eye className="h-4 w-4" />
                    </button>
                    {/* Fixed slot so the eye does not shift as the tick moves. */}
                    <span className="w-3.5 flex justify-center">
                      {b.id === activeId && <Check className="h-3.5 w-3.5 text-green-500" />}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}

      {teamFor && (
        <TeamModal
          business={teamFor}
          isDark={isDark}
          onClose={() => setTeamFor(null)}
          onChanged={() => {
            // Leaving or handing over changes which businesses exist for this
            // user and what role they hold, so the whole list is re-read.
            setTeamFor(null);
            load().then(() => {
              window.dispatchEvent(new CustomEvent("finna:businessChanged", { detail: activeId }));
            });
          }}
        />
      )}
    </div>
  );
}

/**
 * The plan beside a business's name, in the same colours the admin panel uses.
 *
 * Both the label and the tone come from the server, so a workspace looks the
 * same wherever it is shown. The label is what they PAY for when they pay for
 * anything — a workspace billed Entrepreneur used to read "Business" here
 * because the early-access window grants Business features, which is true of
 * the features and wrong about the plan.
 */
function PlanPill({ plan, tone, isDark }: { plan: string; tone?: string; isDark: boolean }) {
  const c = planTone(tone, isDark);
  return (
    <span
      style={{ background: c.bg, color: c.fg, border: `0.5px solid ${c.border}` }}
      className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
    >
      {plan}
    </span>
  );
}

/**
 * Team, and inviting, in one panel.
 *
 * They were two separate menu entries, which meant sending an invite told you
 * nothing about who was already in — so the easy mistake was inviting somebody
 * who was already a member. Seeing the list first and creating the link from
 * the same panel makes that the natural order.
 */
function TeamModal({ business, isDark, onClose, onChanged }: {
  business: Business; isDark: boolean; onClose: () => void; onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string>("");
  const [inviting, setInviting] = useState(false);
  const [handingOver, setHandingOver] = useState(false);
  /**
   * Set when the handover was reached by trying to LEAVE.
   *
   * The transfer is a step on the way out, not the destination — someone who
   * clicked "Leave workspace" and picked a successor has said what they want
   * twice, and stopping there to make them find the button again is asking a
   * third time.
   */
  const [leavingAfterHandover, setLeavingAfterHandover] = useState(false);
  /**
   * The plan, so a seat can be PRICED before it is granted.
   *
   * Without it the confirmation could only say "this adds a paid seat" and
   * leave the person to guess by how much — the kind of vagueness that makes
   * people avoid the control altogether.
   */
  const [billing, setBilling] = useState<MyBilling | null>(null);
  /** My own user id, so the members list can point out which row is me. */
  const [meId, setMeId] = useState<string>("");
  /**
   * The question currently on screen. One slot, because only one of these can
   * be asked at a time, and modelling it as a single value makes that true by
   * construction rather than by luck.
   */
  const [ask, setAsk] = useState<{
    title: string; body: React.ReactNode; confirmLabel: string;
    tone: "default" | "danger" | "warning"; run: () => Promise<void>;
  } | null>(null);

  const canManage = business.role === "Owner" || business.role === "Admin";
  const isOwner = business.role === "Owner";
  /** Who ownership could go to: everyone except the current owner. */
  const candidates = members.filter((m) => m.role !== "Owner");
  /** Who to ask, when you are not the one allowed to transfer. */
  const ownerName = (() => {
    const owner = members.find((m) => m.role === "Owner");
    return owner ? owner.name || owner.email : "";
  })();

  const load = () => {
    setLoading(true);
    getMembers(business.id)
      .then(setMembers)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load team."))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { getMyBilling().then(setBilling).catch(() => setBilling(null)); }, []);
  useEffect(() => { getMe().then((u) => setMeId(u.id)).catch(() => setMeId("")); }, []);

  /** What one seat costs a month on the plan being billed. Zero when none is. */
  /**
   * What a seat actually COSTS this workspace today — the price of the plan
   * being billed. Zero on a free window, which is why the seat-change dialogs
   * stay silent there: granting a seat during early access costs nothing, and
   * warning about a charge that will not happen is just noise.
   */
  const seatPrice = billing
    ? (billing.plans.find((p) => p.key === billing.plan)?.monthly ?? 0)
    : 0;

  /**
   * What a seat WOULD cost — the price of the plan currently in force.
   *
   * On a trial or early-access window these differ: nothing is charged, but the
   * workspace is using a paid plan. Showing the figure with the reason attached
   * is better than showing nothing, because the day the window ends is the day
   * that number starts arriving, and nobody should meet it for the first time
   * on an invoice.
   */
  const windowPrice = billing
    ? (billing.plans.find((p) => p.key === billing.effectivePlan)?.monthly ?? 0)
    : 0;

  /** Why this workspace is not being charged, when it is using a paid plan. */
  const freeBecause =
    billing?.reason === "grandfathered" ? "early access"
      : billing?.reason === "trial" ? "your free trial"
        : null;

  const shownPrice = seatPrice > 0 ? seatPrice : (freeBecause ? windowPrice : 0);
  const windowEnds = billing?.reason === "grandfathered"
    ? billing?.grandfatheredUntil
    : billing?.trialEndsAt;
  const endsOn = windowEnds
    ? new Date(windowEnds).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;

  const money = (n: number) => `$${n.toFixed(2)}`;
  const holdsSeat = (role: BusinessRole) => role !== "Viewer";
  const seatsUsed = members.filter((m) => holdsSeat(m.role)).length;

  /**
   * Grant or take back a seat — the same act as changing the role.
   *
   * A working role occupies a billable seat and a Viewer does not, so these are
   * one control rather than two. Two switches could disagree: somebody holding
   * a seat they cannot use, or working in a role nobody is paying for.
   *
   * Crossing the Viewer boundary changes the bill, so it asks first and says by
   * how much. Moving between two working roles costs nothing and gets no
   * dialog — a confirmation that appears when nothing is at stake teaches
   * people to dismiss the ones that matter.
   */
  const setMemberRole = async (m: BusinessMember, next: BusinessRole) => {
    if (next === m.role) return;
    const gaining = !holdsSeat(m.role) && holdsSeat(next);
    const releasing = holdsSeat(m.role) && !holdsSeat(next);
    const who = m.name || m.email;

    const apply = async () => {
      setBusyId(m.userId); setError(null);
      try {
        const res = await changeMemberRole(business.id, m.userId, next);
        setMembers((prev) => prev.map((x) => (x.userId === m.userId ? { ...x, role: next } : x)));
        setBilling((b) => (b ? { ...b, seats: res.seats } : b));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not change that role.");
      } finally {
        setBusyId("");
      }
    };

    if (gaining && seatPrice > 0) {
      setAsk({
        title: `Give ${who} a paid seat?`,
        confirmLabel: `Add seat · ${money(seatPrice)}/mo`,
        tone: "default",
        body: (
          <>
            They become a <strong>{next}</strong>, and your bill goes up by{" "}
            <strong>{money(seatPrice)} a month</strong> — added to your next invoice.
            <br /><br />
            Cancel to leave them as a Viewer: free, and read-only.
          </>
        ),
        run: apply,
      });
      return;
    }
    if (releasing && seatPrice > 0) {
      setAsk({
        title: `Make ${who} a Viewer?`,
        confirmLabel: "Free the seat",
        tone: "warning",
        body: (
          <>
            They keep read-only access and their seat is freed, so your bill goes down by{" "}
            <strong>{money(seatPrice)} a month</strong>, credited to your next invoice.
          </>
        ),
        run: apply,
      });
      return;
    }
    // Between two working roles nothing changes financially, and a dialog that
    // fires when nothing is at stake teaches people to click through the ones
    // that matter.
    await apply();
  };

  const remove = (m: BusinessMember) => setAsk({
    title: `Remove ${m.name || m.email}?`,
    confirmLabel: "Remove",
    tone: "danger",
    body: (
      <>
        They lose access to <strong>{business.name}</strong> immediately.
        {holdsSeat(m.role) && seatPrice > 0 ? (
          <> Their seat is freed, so your bill goes down by <strong>{money(seatPrice)} a month</strong>.</>
        ) : null}
      </>
    ),
    run: async () => {
      setBusyId(m.userId); setError(null);
      try { await removeMember(business.id, m.userId); setMembers((prev) => prev.filter((x) => x.userId !== m.userId)); }
      catch (e) { setError(e instanceof Error ? e.message : "Could not remove member."); }
      finally { setBusyId(""); }
    },
  });

  const leave = () => {
    /**
     * An owner cannot leave, and this is where that gets explained.
     *
     * The server refuses with a 409, so the rule is enforced regardless — but
     * discovering it as an error after clicking a red button is a poor way to
     * learn it. The dialog names the reason and its confirm button becomes the
     * step that fixes it, rather than a dead end with an OK.
     */
    if (isOwner) {
      /**
       * An owner with COLLEAGUES must hand over first — walking out would
       * strand people in a workspace nobody can administer.
       *
       * An owner who is ALONE simply leaves. There is nobody to hand it to, and
       * refusing would trap them in a workspace forever. The workspace and its
       * books survive them and become ownerless, which an admin can reassign if
       * it was a mistake.
       */
      if (candidates.length === 0) {
        setAsk({
          title: `Leave ${business.name}?`,
          confirmLabel: "Leave workspace",
          tone: "danger",
          body: (
            <>
              You are the only person here, so it will be left with{" "}
              <strong>no owner</strong>. Nothing is deleted — the books, invoices and history
              stay exactly as they are.
              <br /><br />
              It keeps your email recorded as the last owner, and an admin can hand it back to
              you or to somebody else.
            </>
          ),
          run: async () => {
            setBusyId("leave"); setError(null);
            try { await leaveBusiness(business.id); onChanged(); }
            catch (e) { setError(e instanceof Error ? e.message : "Could not leave."); setBusyId(""); }
          },
        });
        return;
      }

      setAsk({
        title: `You own ${business.name}`,
        confirmLabel: "Choose a successor",
        tone: "warning",
        body: (
          <>
            Other people work here, so the workspace needs an owner — without one, nobody can
            invite people, change the plan or close it down.
            <br /><br />
            Hand it to someone first, and you will leave as soon as they have it.
          </>
        ),
        run: async () => {
          // Remember WHY we are here, so the transfer finishes the job.
          setLeavingAfterHandover(true);
          setHandingOver(true);
        },
      });
      return;
    }

    setAsk({
      title: `Leave ${business.name}?`,
      confirmLabel: "Leave workspace",
      tone: "danger",
      body: <>You lose access to its books, and will need a new invite to come back.</>,
      run: async () => {
        setBusyId("leave"); setError(null);
        try { await leaveBusiness(business.id); onChanged(); }
        catch (e) { setError(e instanceof Error ? e.message : "Could not leave."); setBusyId(""); }
      },
    });
  };

  const handOver = (m: BusinessMember) => setAsk({
    title: `Make ${m.name || m.email} the owner?`,
    confirmLabel: leavingAfterHandover ? "Transfer and leave" : "Transfer ownership",
    tone: "warning",
    body: (
      <>
        They get full control of <strong>{business.name}</strong>, including billing and deleting
        the workspace.
        <br /><br />
        {leavingAfterHandover ? (
          <>
            You will then be removed from the workspace and lose access to its books — this is the
            last step of leaving.
          </>
        ) : (
          <>
            You stay on as an <strong>Admin</strong>. Only the owner can transfer, so from then on
            only they can hand it back.
          </>
        )}
      </>
    ),
    run: async () => {
      setBusyId(m.userId); setError(null);
      try {
        await transferOwnership(business.id, m.userId);
        /**
         * Then actually leave, if that is what this was for.
         *
         * Sequential and in this order, because the server refuses to let an
         * owner leave — the transfer is what makes the departure legal. If the
         * leave fails the transfer still stands, which is the safe half to keep:
         * the workspace has an owner either way.
         */
        if (leavingAfterHandover) await leaveBusiness(business.id);
        onChanged();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not transfer ownership.");
        setBusyId("");
      }
    },
  });

  const card = isDark ? "bg-gray-800 text-white" : "bg-white text-gray-900";
  const rowBorder = isDark ? "border-gray-700" : "border-gray-100";
  const sub = isDark ? "text-gray-400" : "text-gray-500";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      {/* Every confirmation this panel asks goes through one dialog, rendered
          above it. `window.confirm` looked like the browser scam prompts people
          dismiss without reading, which is the wrong place to ask about giving
          away a company or adding a charge to a bill. */}
      <ConfirmDialog
        open={!!ask}
        title={ask?.title ?? ""}
        body={ask?.body ?? null}
        confirmLabel={ask?.confirmLabel}
        tone={ask?.tone}
        busy={!!busyId}
        isDark={isDark}
        onCancel={() => setAsk(null)}
        onConfirm={async () => { const pending = ask; setAsk(null); await pending?.run(); }}
      />

      <div className={`rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl ${card}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {(inviting || handingOver) && (
              <button
                onClick={() => {
                  setInviting(false); setHandingOver(false); setError(null);
                  // Backing out cancels the departure too — otherwise a later,
                  // unrelated transfer would quietly remove you as well.
                  setLeavingAfterHandover(false);
                }}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                title={t("dashboard","wsViewTeam")}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="text-lg font-bold truncate">
              {handingOver
                ? `Transfer ${business.name}`
                : inviting
                  ? `Invite to ${business.name}`
                  : `Team · ${business.name}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X className="h-5 w-5" /></button>
        </div>

        {handingOver ? (
          <>
            <p className={`text-sm mb-3 ${sub}`}>
              {leavingAfterHandover
                ? "Choose who takes over. Once they have it, you will be removed from this workspace."
                : "Choose who takes over. They get full control, including billing and deleting the workspace — you stay on as an Admin."}
            </p>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="divide-y max-h-72 overflow-y-auto -mx-1">
              {candidates.map((m) => (
                <button
                  key={m.userId}
                  onClick={() => handOver(m)}
                  disabled={!!busyId}
                  className={`w-full flex items-center justify-between gap-3 px-1 py-2.5 text-left disabled:opacity-50 ${rowBorder} ${
                    isDark ? "hover:bg-gray-700/40" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{m.name || m.email}</span>
                    <span className={`block text-xs truncate ${sub}`}>{m.email}</span>
                  </span>
                  <span className={`text-xs flex-shrink-0 ${sub}`}>
                    {busyId === m.userId ? "Transferring…" : m.role}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : inviting ? (
          <InvitePanel business={business} isDark={isDark} seatPrice={seatPrice} onSent={load} />
        ) : (
          <>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            {/* What this team costs, and HOW it is arrived at.
                The total alone leaves people to infer the mechanism from the
                badges. Saying it here answers the question where it is actually
                asked — looking at the member list, wondering why the bill is
                what it is — rather than after an invoice that feels wrong.
                There is no way to buy fewer seats than you have working
                members: the seat count is the member count, so the only lever
                is the role, and it should be named. */}
            {shownPrice > 0 && !loading && members.length > 0 && (
              <div className={`text-xs mb-2 ${sub}`}>
                <p>
                  {seatsUsed} seat{seatsUsed === 1 ? "" : "s"} × {money(shownPrice)}/mo ={" "}
                  <span className="font-semibold">{money(seatsUsed * shownPrice)}/mo</span>
                </p>

                {/* Shown on a free window too, with the reason attached. Hiding
                    it there meant the workspace using the most expensive plan
                    was the one told least about what it costs — and the day the
                    window closes is the day that figure starts arriving. */}
                {freeBecause ? (
                  <p className={`mt-0.5 font-semibold ${isDark ? "text-amber-400" : "text-amber-700"}`}>
                    Not charged — you are on {freeBecause}
                    {endsOn ? `, which ends ${endsOn}` : ""}.
                  </p>
                ) : null}

                <p className="mt-0.5">
                  Every working role {freeBecause ? "counts as" : "is"} a paid seat. Change someone to{" "}
                  <span className="font-semibold">Viewer</span> for free read-only access.
                </p>
              </div>
            )}
            {loading ? (
              <p className={`text-sm ${sub}`}>{t("dashboard","wsLoadingTeam")}</p>
            ) : members.length === 0 ? (
              <p className={`text-sm ${sub}`}>{t("dashboard","wsNoMembers")}</p>
            ) : (
              <div className="divide-y max-h-72 overflow-y-auto -mx-1">
                {members.map((m) => (
                  <div key={m.userId} className={`flex items-center justify-between gap-2 px-1 py-2.5 ${rowBorder}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {m.name || m.email}
                        {/* Which row is you. Obvious with three people, not with
                            thirty — and it is the row whose role you least want
                            to change by accident. */}
                        {m.userId === meId && (
                          <span className={`ml-1.5 text-[10px] font-bold uppercase ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                            you
                          </span>
                        )}
                        {/* Which of them you are actually paying for. */}
                        {holdsSeat(m.role)
                          ? <span className="ml-1.5 text-[10px] font-bold uppercase text-green-600">seat</span>
                          : <span className={`ml-1.5 text-[10px] uppercase ${sub}`}>free</span>}
                      </p>
                      <p className={`text-xs truncate ${sub}`}>{m.email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canManage && m.role !== "Owner" ? (
                        <select
                          value={m.role}
                          disabled={busyId === m.userId}
                          onChange={(e) => setMemberRole(m, e.target.value as BusinessRole)}
                          className={`text-xs rounded-lg px-2 py-1 border outline-none disabled:opacity-50 ${
                            isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900"
                          }`}
                        >
                          {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span className={`text-xs ${sub}`}>{m.role}</span>
                      )}
                      {canManage && m.role !== "Owner" && (
                        <button onClick={() => remove(m)} disabled={busyId === m.userId} title={t("dashboard","wsRemoveMember")}
                          className="text-gray-400 hover:text-red-500 disabled:opacity-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canManage && (
              <button onClick={() => setInviting(true)}
                className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
                <UserPlus className="h-4 w-4" />{t("dashboard","wsInviteMember")}
              </button>
            )}

            {/* Handing over and walking out both live here, under the invite —
                they are the other two things you do to your own membership,
                and they were previously impossible without asking support. */}
            <div className={`mt-2 grid gap-2 ${isOwner ? "" : "grid-cols-1"}`}>
              {/* Shown to everyone, disabled for everyone but the owner.
                  Hiding it made "why can I not transfer this back?" impossible
                  to answer from the screen — the button was simply gone, with
                  nothing to say who is allowed to do it. */}
              <button
                onClick={() => { if (isOwner) setHandingOver(true); }}
                disabled={!isOwner || candidates.length === 0}
                title={
                  !isOwner
                    ? `Only the owner can transfer this workspace${ownerName ? ` — ask ${ownerName}` : ""}.`
                    : candidates.length === 0
                      ? "Invite somebody first — ownership can only pass to a member."
                      : undefined
                }
                className={`w-full border font-semibold py-2 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark ? "border-gray-600 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Crown className="h-4 w-4" />Transfer ownership
              </button>
              {!isOwner && (
                <p className={`text-[11px] ${sub}`}>
                  Only the owner can transfer.{ownerName ? ` Ask ${ownerName} to hand it back.` : ""}
                </p>
              )}
              {/* Shown to the owner too.
                  An ownerless workspace has nobody who can invite, transfer or
                  delete it, so an owner cannot simply walk out — but hiding the
                  button made that look like an oversight rather than a rule.
                  Clicking it now explains the rule and hands them straight to
                  the step that satisfies it. */}
              <button
                onClick={leave}
                disabled={!!busyId}
                className="w-full border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20 font-semibold py-2 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />{busyId === "leave" ? "Leaving…" : "Leave workspace"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The invite form itself — no dialog chrome, so it can sit inside the team panel.
 *
 * `seatPrice` is passed down rather than fetched again: the team panel above has
 * already loaded the plan, and an invite is the moment where choosing a role
 * quietly commits you to another month's charge. Saying so here is the whole
 * point — the alternative is finding out on the invoice.
 */
function InvitePanel({ business, isDark, seatPrice, onSent }: {
  business: Business; isDark: boolean; seatPrice: number; onSent?: () => void;
}) {
  const { t } = useLanguage();
  const [role, setRole] = useState<BusinessRole>("Viewer");
  const [password, setPassword] = useState("");
  const [expiry, setExpiry] = useState<"once" | "7d">("7d");
  const [email, setEmail] = useState("");
  /**
   * How this invite gets delivered. Two genuinely different jobs, so they are
   * two tabs rather than one form with an optional field: emailing needs an
   * address and nothing else, while a link is for when you do not have one —
   * you are handing it over in person, or in a chat you already trust.
   */
  const [mode, setMode] = useState<"email" | "link">("email");
  const [link, setLink] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canInvite = business.role === "Owner" || business.role === "Admin";

  /**
   * One button, two outcomes.
   *
   * With an address it sends the invite AND still shows the link; without one
   * it just makes the link. Emailing does not replace copy-and-paste — that is
   * the only path that works when you do not know somebody's address yet, or
   * want to hand the link over somewhere you already trust.
   */
  const generate = async () => {
    setError(null);
    const target = mode === "email" ? email.trim() : "";
    if (mode === "email" && !target) { setError("Enter an email address, or switch to Copy link."); return; }

    setBusy(true);
    try {
      const res = await createInvite(business.id, role, password.trim() || undefined, expiry, target || undefined);
      setLink(`${window.location.origin}/join/${res.token}`);
      // `emailed` comes from the server: an address being typed is not proof
      // the mail went anywhere, and claiming it did would leave someone waiting
      // for an invite that never arrived.
      setSentTo(res.emailed ? target : null);
      if (res.emailed) onSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create invite.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const input = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";

  if (!canInvite) return <p className="text-sm text-gray-500">{t("dashboard","wsOnlyOwnerInvite")}</p>;

  if (link) {
    return (
      <>
        {/* Said first when it applies, because "did it send?" is the only
            question on the reader's mind at this point. */}
        {sentTo && (
          <div className={`rounded-lg border p-2.5 mb-3 ${isDark ? "border-green-700 bg-green-900/20" : "border-green-300 bg-green-50"}`}>
            <p className={`text-xs font-semibold ${isDark ? "text-green-300" : "text-green-800"}`}>
              Invite emailed to {sentTo}
            </p>
            <p className={`text-xs ${isDark ? "text-green-200/80" : "text-green-700"}`}>
              The link below is the same one — share it directly if the email does not arrive.
            </p>
          </div>
        )}
        <p className="text-sm text-gray-500 mb-2">{t("dashboard","wsShareLink")}<strong>{role}</strong>). {expiry === "once" ? "It can be used once." : "It expires in 7 days."}</p>
        <div className="flex gap-2">
          <input readOnly value={link} className={`flex-1 text-xs rounded-lg px-3 py-2 border outline-none ${input}`} />
          <button onClick={copy} className="bg-blue-500 hover:bg-blue-600 text-white px-3 rounded-lg flex items-center gap-1 text-sm">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <button onClick={() => { setLink(null); setPassword(""); setEmail(""); setSentTo(null); }} className="text-xs text-blue-500 hover:underline mt-3">
          Invite someone else
        </button>
      </>
    );
  }

  return (
    <>
      {/* Delivery method first, because it changes what the rest of the form
          asks for and what the button at the bottom does. */}
      <div className={`flex gap-1 p-1 rounded-lg mb-4 ${isDark ? "bg-gray-900" : "bg-gray-100"}`}>
        {([
          ["email", "Send via email", Send],
          ["link", "Copy a link", LinkIcon],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => { setMode(key); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-md transition-colors ${
              mode === key
                ? (isDark ? "bg-gray-700 text-white" : "bg-white text-gray-900 shadow-sm")
                : (isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700")
            }`}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      <label className="block text-sm font-medium mb-1">{t("settings","role")}</label>
      <select value={role} onChange={(e) => setRole(e.target.value as BusinessRole)} className={`w-full text-sm rounded-lg px-3 py-2 border outline-none mb-2 ${input}`}>
        {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>

      {/* A working role is a paid seat. Said BEFORE the link is generated,
          with the free alternative one click away — after the invite is
          accepted the charge has already happened. */}
      {role !== "Viewer" && seatPrice > 0 ? (
        <div className={`rounded-lg border p-2.5 mb-4 ${isDark ? "border-amber-700 bg-amber-900/20" : "border-amber-300 bg-amber-50"}`}>
          <p className={`text-xs font-semibold ${isDark ? "text-amber-300" : "text-amber-800"}`}>
            This adds a paid seat — ${seatPrice.toFixed(2)} a month
          </p>
          <p className={`text-xs ${isDark ? "text-amber-200/80" : "text-amber-700"}`}>
            Charged from when they accept, added to your next invoice.
          </p>
          <button
            type="button"
            onClick={() => setRole("Viewer")}
            className={`mt-1.5 text-xs font-semibold underline ${isDark ? "text-amber-200" : "text-amber-900"}`}
          >
            Invite as a Viewer instead — free, read-only
          </button>
        </div>
      ) : (
        <p className={`text-xs mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          {role === "Viewer"
            ? "Viewers can look at the books but not change anything. They are free."
            : "This role can work in the books."}
        </p>
      )}

      {mode === "email" && (
        <>
          <label className="block text-sm font-medium mb-1">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") generate(); }}
            placeholder="name@example.com"
            autoFocus
            className={`w-full text-sm rounded-lg px-3 py-2 border outline-none mb-1 ${input}`}
          />
          {/* Said plainly: sending does not take the link away. If the mail is
              slow or lands in spam, the same link is on the next screen. */}
          <p className={`text-xs mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            We email them the invite, and you still get the link to share yourself.
          </p>
        </>
      )}

      <label className="block text-sm font-medium mb-1">{t("dashboard","wsLinkExpiry")}</label>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {([["once", "One-time use"], ["7d", "Expires in 7 days"]] as const).map(([val, lbl]) => (
          <button key={val} type="button" onClick={() => setExpiry(val)}
            className={`text-sm rounded-lg px-3 py-2 border text-center ${expiry === val ? "border-blue-500 text-blue-600 font-semibold" : input}`}>
            {lbl}
          </button>
        ))}
      </div>

      <label className="block text-sm font-medium mb-1">{t("dashboard","wsPasswordOptional")}</label>
      <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("dashboard","wsPhPassword")}
        className={`w-full text-sm rounded-lg px-3 py-2 border outline-none mb-2 ${input}`} />
      <p className="text-xs text-gray-500 mb-4">{t("dashboard","wsPasswordHint")}</p>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
      <button
        onClick={generate}
        disabled={busy || (mode === "email" && !email.trim())}
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
      >
        {mode === "email"
          ? (<><Send className="h-4 w-4" />{busy ? "Sending…" : "Send invite link via email"}</>)
          : (<><LinkIcon className="h-4 w-4" />{busy ? "Generating…" : "Generate invite link"}</>)}
      </button>
    </>
  );
}
