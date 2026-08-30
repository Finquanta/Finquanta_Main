"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdmin } from "@/lib/api/admin";
import {
  Audience, SentNotification, deleteNotification, getSentNotifications, sendNotification,
} from "@/lib/api/notifications";
import AdminSidebar, { readAdminDark } from "@/components/admin/AdminSidebar";
import { useConfirm } from "@/hooks/useConfirm";
import { Maintenance, getMaintenance, setMaintenance } from "@/lib/api/site";

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: "all", label: "Everyone", hint: "Every user with an account" },
  { value: "verified", label: "Verified users", hint: "Only users who confirmed their email" },
  { value: "unverified", label: "Unverified users", hint: "Nudge people who never confirmed" },
];

/**
 * Admin → Notifications: push a message to users' inboxes.
 *
 * Users who sign up AFTER a notification is sent don't receive it. An
 * announcement is a moment in time, not a standing message — a new user
 * shouldn't open their inbox to a year of old notices.
 */
export default function AdminNotificationsPage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [sent, setSent] = useState<SentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  /** Empty = send immediately. Otherwise a local datetime to hold it until. */
  const [scheduledFor, setScheduledFor] = useState("");

  /** The site-wide maintenance banner. */
  const [maint, setMaint] = useState<Maintenance>({
    enabled: false, manual: false, message: "",
    manualMessage: "", scheduledMessage: "",
    startsAt: null, endsAt: null, upcoming: false,
  });
  /**
   * Every consequential question on this page, through the shared hook — which
   * also gives the action a real busy state, where this page previously closed
   * the dialog first and ran the write with nothing on screen to show for it.
   */
  const { ask, dialog } = useConfirm(dark);
  const [maintBusy, setMaintBusy] = useState(false);

  const load = () => {
    setLoading(true);
    getSentNotifications()
      .then(setSent)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load notifications."))
      .finally(() => setLoading(false));
    getMaintenance().then(setMaint).catch(() => {});
  };

  const toggleMaintenance = async () => {
    // "Take it down" has to mean stop, whatever is currently holding it up —
    // the manual switch OR a running window.
    const next = !(maint.manual || maint.enabled);

    // Putting it up tells every visitor the product is broken. Worth a beat.
    if (next) {
      ask({
        title: "Show the maintenance banner to everyone, including logged-out visitors?",
        body: (
          <>
            <p>
              A yellow bar appears across the top of every page — the marketing site, the
              dashboard, the login screen — for signed-in users and strangers alike.
            </p>
            <p style={{ marginTop: 8 }}>
              Every sidebar also shows an <strong>Under Maintenance</strong> badge, which
              cannot be dismissed, until you take it down again.
            </p>
          </>
        ),
        confirmLabel: "Put the banner up",
        cancelLabel: "Cancel",
        tone: "warning",
        onConfirm: () => applyToggle(true),
      });
      return;
    }

    await applyToggle(false);
  };

  /** The write itself, shared by the confirmed path and taking it down. */
  const applyToggle = async (next: boolean) => {
    setMaintBusy(true);
    try {
      /**
       * Taking it down also cancels a window that has already STARTED —
       * otherwise the switch goes off and the schedule immediately puts the
       * banner back, which reads as the button not working.
       *
       * A window still in the future is left alone: cancelling maintenance now
       * is not the same as cancelling next Sunday's, and quietly deleting a
       * plan somebody made would be worse than leaving it.
       */
      const running = !next && !!maint.startsAt && new Date(maint.startsAt) <= new Date();
      setMaint(await setMaintenance({
        enabled: next,
        message: maint.manualMessage,
        ...(running ? { startsAt: "", endsAt: "" } : {}),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the banner.");
    } finally {
      setMaintBusy(false);
    }
  };

  /** `datetime-local` wants `YYYY-MM-DDTHH:mm` in LOCAL time, not an ISO UTC
   * string — feeding it the latter shows the wrong hour to the admin. */
  const toLocalInput = (iso: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  /** Save a schedule change. The server validates that end follows start. */
  const saveWindow = async (startsAt: string, endsAt: string) => {
    setMaintBusy(true);
    setError(null);
    try {
      setMaint(await setMaintenance({
        enabled: maint.manual,
        message: maint.manualMessage,
        scheduledMessage: maint.scheduledMessage,
        // A local datetime-local value has no zone; `new Date()` reads it as
        // local, which is what the admin meant, and toISOString sends UTC.
        startsAt: startsAt ? new Date(startsAt).toISOString() : "",
        endsAt: endsAt ? new Date(endsAt).toISOString() : "",
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the schedule.");
    } finally {
      setMaintBusy(false);
    }
  };

  /** Saving the wording on blur — no separate Save button to forget to press. */
  const saveMaintenanceMessage = async () => {
    if (!maint.manualMessage.trim()) return;
    try {
      await setMaintenance({ enabled: maint.manual, message: maint.manualMessage });
    } catch { /* the toggle is the thing that matters; wording can be retried */ }
  };

  /** The scheduled window's own wording, saved the same way. */
  const saveScheduledMessage = async () => {
    try {
      setMaint(await setMaintenance({
        enabled: maint.manual,
        message: maint.manualMessage,
        scheduledMessage: maint.scheduledMessage,
      }));
    } catch { /* retryable */ }
  };

  useEffect(() => { setDark(readAdminDark()); }, []);
  useEffect(() => {
    checkAdmin().then(load).catch(() => router.replace("/admin-login"));
  }, [router]);

  const send = async () => {
    setError(null);
    setOkMsg(null);
    if (!title.trim() || !body.trim()) {
      setError("A title and a message are both required.");
      return;
    }

    // datetime-local gives a local time with no zone. Converting through Date
    // makes it an absolute instant, so "9am" means 9am where the admin is.
    const when = scheduledFor ? new Date(scheduledFor) : null;
    if (when && Number.isNaN(when.getTime())) {
      setError("That scheduled time isn't valid.");
      return;
    }
    if (when && when.getTime() < Date.now()) {
      setError("That time has already passed. Pick a future time, or leave it blank to send now.");
      return;
    }

    // This lands in real people's inboxes and can't be un-sent quietly.
    const who = AUDIENCES.find((a) => a.value === audience)!.label.toLowerCase();
    const timing = when
      ? `It will be delivered on ${when.toLocaleString()}.`
      : "It appears in their notification inbox right away.";
    ask({
      title: `${when ? "Schedule" : "Send"} "${title.trim()}" to ${who}?`,
      body: <>{timing}</>,
      confirmLabel: when ? "Schedule it" : "Send it",
      cancelLabel: "Cancel",
      tone: "default",
      onConfirm: () => doSend(when),
    });
  };

  /** The write itself, once the question above has been answered. */
  const doSend = async (when: Date | null) => {
    setBusy(true);
    try {
      await sendNotification({
        title: title.trim(),
        body: body.trim(),
        audience,
        scheduledFor: when ? when.toISOString() : null,
      });
      setTitle("");
      setBody("");
      setAudience("all");
      setScheduledFor("");
      setOkMsg(when ? `Scheduled for ${when.toLocaleString()}.` : "Sent.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send that notification.");
    } finally {
      setBusy(false);
    }
  };

  const remove = (n: SentNotification) => {
    // Delivered and not-yet-delivered are different acts with different
    // consequences, so they get different words rather than one hedged sentence.
    ask({
      title: n.delivered ? `Delete "${n.title}"?` : `Cancel "${n.title}"?`,
      body: n.delivered
        ? <>It disappears from every inbox it was delivered to.</>
        : <>It has not gone out yet, so nobody will ever see it.</>,
      confirmLabel: n.delivered ? "Delete it" : "Cancel it",
      cancelLabel: "Cancel",
      tone: "danger",
      onConfirm: async () => {
        try {
          await deleteNotification(n.id);
          load();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not delete that notification.");
        }
      },
    });
  };

  const c = {
    bg: dark ? "#0f172a" : "#f4f5f7",
    card: dark ? "#1e293b" : "#fff",
    border: dark ? "#334155" : "#e5e7eb",
    text: dark ? "#f1f5f9" : "#0f172a",
    muted: dark ? "#94a3b8" : "#6b7280",
    input: dark ? "#0f172a" : "#fff",
  };

  const field: React.CSSProperties = {
    width: "100%", background: c.input, color: c.text, border: `1px solid ${c.border}`,
    borderRadius: 8, padding: "9px 11px", fontSize: 13, outline: "none",
  };
  const label: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 5,
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif", background: c.bg, color: c.text }}>
      {dialog}

      <AdminSidebar active="notifications" dark={dark} setDark={setDark} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Notifications</h1>
          <p style={{ fontSize: 13, color: c.muted, margin: "2px 0 20px" }}>
            Push a message straight to users&apos; notification inbox. People who sign up after you send it
            won&apos;t receive it.
          </p>

          {/* Maintenance banner — a site-wide message, so it lives with the other
              broadcasts rather than in a tab of its own. */}
          <div style={{
            background: c.card, border: `1px solid ${maint.enabled ? "#f59e0b" : c.border}`,
            borderRadius: 12, padding: 16, marginBottom: 24,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  Maintenance Banner
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                    color: maint.enabled ? "#f59e0b" : c.muted,
                    background: maint.enabled ? "rgba(245,158,11,0.12)" : "transparent",
                    border: maint.enabled ? "none" : `1px solid ${c.border}`,
                  }}>
                    {maint.enabled ? "LIVE ON THE SITE" : "OFF"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: c.muted, marginTop: 3 }}>
                  A yellow bar across the top of every page, for everyone — signed in or not.
                </div>
              </div>
              <button
                onClick={toggleMaintenance}
                disabled={maintBusy}
                style={{
                  background: maint.enabled ? "#ef4444" : "#f59e0b", color: "#fff", border: "none",
                  borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700,
                  cursor: maintBusy ? "default" : "pointer", opacity: maintBusy ? 0.6 : 1, flexShrink: 0,
                }}
              >
                {maintBusy ? "Saving…" : (maint.manual || maint.enabled) ? "Take it down" : "Put it up"}
              </button>
            </div>

            <textarea
              value={maint.manualMessage}
              onChange={(e) => setMaint({ ...maint, manualMessage: e.target.value })}
              onBlur={saveMaintenanceMessage}
              placeholder="What the banner says"
              style={{ ...field, minHeight: 58, resize: "vertical", marginTop: 12 }}
            />
            <p style={{ fontSize: 11, color: c.muted, margin: "5px 0 0" }}>
              Changing the wording un-dismisses it, so people who hid the old notice still see the new one.
            </p>

            {/* Scheduling. No cron anywhere: the window is stored and the read
                query compares it to NOW(), exactly as scheduled notifications
                already work — so a window cannot fail to start because a job
                did not run. */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${c.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Schedule one for later</div>
              <div style={{ fontSize: 11, color: c.muted, marginBottom: 10 }}>
                Separate from the switch above. That one is for right now — something is broken and
                you need it up this second. This is for planned work: set a window and the banner
                puts itself up and takes itself down, with its <strong>own wording</strong> and a
                heads-up notice beforehand so nobody is surprised. You can have both at once.
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 190px" }}>
                  <label style={label}>STARTS</label>
                  <input
                    type="datetime-local"
                    style={field}
                    value={toLocalInput(maint.startsAt)}
                    disabled={maintBusy}
                    onChange={(e) => saveWindow(e.target.value, toLocalInput(maint.endsAt))}
                  />
                </div>
                <div style={{ flex: "1 1 190px" }}>
                  <label style={label}>ENDS</label>
                  <input
                    type="datetime-local"
                    style={field}
                    value={toLocalInput(maint.endsAt)}
                    disabled={maintBusy}
                    onChange={(e) => saveWindow(toLocalInput(maint.startsAt), e.target.value)}
                  />
                </div>
              </div>

              <textarea
                value={maint.scheduledMessage}
                onChange={(e) => setMaint({ ...maint, scheduledMessage: e.target.value })}
                onBlur={saveScheduledMessage}
                placeholder="What the scheduled banner says (optional — a sensible default is used)"
                style={{ ...field, minHeight: 48, resize: "vertical", marginTop: 10 }}
              />

              {maint.upcoming && maint.startsAt && (
                <p style={{ fontSize: 11, color: "#f59e0b", margin: "8px 0 0", fontWeight: 600 }}>
                  Scheduled for {new Date(maint.startsAt).toLocaleString()}
                  {maint.endsAt ? ` until ${new Date(maint.endsAt).toLocaleString()}` : ""}. Visitors
                  are already being told.
                </p>
              )}
              {!maint.upcoming && maint.startsAt && maint.enabled && (
                <p style={{ fontSize: 11, color: "#ef4444", margin: "8px 0 0", fontWeight: 600 }}>
                  The scheduled window is running now
                  {maint.endsAt ? `, ending ${new Date(maint.endsAt).toLocaleString()}` : ""}.
                </p>
              )}
              {(maint.startsAt || maint.endsAt) && (
                <button
                  onClick={() => saveWindow("", "")}
                  disabled={maintBusy}
                  style={{
                    marginTop: 8, background: "transparent", border: `1px solid ${c.border}`,
                    color: c.muted, borderRadius: 8, padding: "5px 12px", fontSize: 11,
                    fontWeight: 600, cursor: maintBusy ? "default" : "pointer",
                  }}
                >
                  Clear schedule
                </button>
              )}
            </div>
          </div>

          {/* Compose */}
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 18, marginBottom: 24 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>TITLE</label>
              <input
                style={field}
                value={title}
                maxLength={160}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Invoices just got a lot smarter"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={label}>MESSAGE</label>
              <textarea
                style={{ ...field, minHeight: 96, resize: "vertical" }}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What do you want them to know?"
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={label}>SEND TO</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {AUDIENCES.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => setAudience(a.value)}
                    title={a.hint}
                    style={{
                      borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: audience === a.value ? "#3b82f6" : c.input,
                      color: audience === a.value ? "#fff" : c.text,
                      border: `1px solid ${audience === a.value ? "#3b82f6" : c.border}`,
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: c.muted, margin: "6px 0 0" }}>
                {AUDIENCES.find((a) => a.value === audience)!.hint}
              </p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={label}>WHEN</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="datetime-local"
                  style={{ ...field, width: "auto", flex: "0 0 auto" }}
                  value={scheduledFor}
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  onChange={(e) => setScheduledFor(e.target.value)}
                />
                {scheduledFor && (
                  <button
                    onClick={() => setScheduledFor("")}
                    style={{
                      background: "transparent", color: c.muted, border: `1px solid ${c.border}`,
                      borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <p style={{ fontSize: 11, color: c.muted, margin: "6px 0 0" }}>
                {scheduledFor
                  ? "Held until then. It'll reach everyone signed up by that time — and you can cancel it before it goes."
                  : "Leave blank to send immediately."}
              </p>
            </div>

            {error && <p style={{ color: "#ef4444", fontSize: 13, margin: "0 0 10px" }}>{error}</p>}
            {okMsg && <p style={{ color: "#10b981", fontSize: 13, margin: "0 0 10px" }}>{okMsg}</p>}

            <button
              onClick={send}
              disabled={busy || !title.trim() || !body.trim()}
              style={{
                background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8,
                padding: "9px 18px", fontSize: 13, fontWeight: 700,
                cursor: busy ? "default" : "pointer",
                opacity: busy || !title.trim() || !body.trim() ? 0.5 : 1,
              }}
            >
              {busy ? "Saving…" : scheduledFor ? "Schedule notification" : "Send notification"}
            </button>
          </div>

          {/* Sent */}
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>Sent</h2>
          {loading ? (
            <p style={{ fontSize: 13, color: c.muted }}>Loading…</p>
          ) : sent.length === 0 ? (
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 32, textAlign: "center" }}>
              <p style={{ fontSize: 13, color: c.muted, margin: 0 }}>You haven&apos;t sent any notifications yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sent.map((n) => (
                <div key={n.id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{n.title}</span>
                        {!n.delivered && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: "#f59e0b",
                            background: "rgba(245,158,11,0.12)", padding: "2px 7px", borderRadius: 999,
                          }}>
                            SCHEDULED
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: c.muted, marginTop: 3, whiteSpace: "pre-wrap" }}>{n.body}</div>
                    </div>
                    <button
                      onClick={() => remove(n)}
                      style={{
                        background: "transparent", color: "#ef4444", border: `1px solid ${c.border}`,
                        borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600,
                        cursor: "pointer", height: "fit-content", flexShrink: 0,
                      }}
                    >
                      {n.delivered ? "Delete" : "Cancel"}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: c.muted, marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <span>
                      {n.delivered
                        ? `Sent ${fmt(n.scheduledFor ?? n.createdAt)}`
                        : `Goes out ${fmt(n.scheduledFor!)}`}
                    </span>
                    <span>To: {AUDIENCES.find((a) => a.value === n.audience)?.label ?? n.audience}</span>
                    <span>
                      {n.delivered ? (
                        <>Read by <strong style={{ color: c.text }}>{n.readCount ?? 0}</strong> of {n.recipients ?? 0}</>
                      ) : (
                        <>Will reach ~{n.recipients ?? 0} users</>
                      )}
                    </span>
                    {n.authorName && <span>By {n.authorName}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
