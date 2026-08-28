"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Check, Copy, ExternalLink, FileText, Inbox, Mail, RefreshCw, RotateCcw,
  ShieldOff, Trash2, X,
} from 'lucide-react';
import DashboardShell from '@/components/user_dashboard/DashboardShell';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { useTheme } from '@/hooks/context/ThemeContext';
import { themeClasses } from '@/lib/theme';
import CaptureReviewModal from '@/components/user_dashboard/capture/CaptureReviewModal';
import { DocumentCapture, ScanAllowance, getCaptureFileUrl, getScanAllowance } from '@/lib/api/capture';
import { serverApiUrl } from '@/lib/api/client';
import {
  InboundAddress, InboundMessage, getDiscardedFromEmail, getInboundAddress, getInboundMessages,
  InboundDiagnostics, getInboundDiagnostics,
  deleteInboundMessage, getMessageCaptures, markMessageUnread,
  getPendingFromEmail, markMessageRead, restoreCapture, rotateInboundAddress, setInboundSender,
} from '@/lib/api/inbound';

/**
 * The email inbox.
 *
 * Three columns, because a document is in exactly one of three states and they
 * answer different questions: what turned up (Received), what needs me
 * (Pending), and what did I throw away (Recycle Bin). The first version stacked
 * these in one narrow column, which left half the screen empty and pushed the
 * queue — the only part with work in it — below the fold.
 *
 * An unopened message carries an amber dot. Read state is per WORKSPACE rather
 * than per person: this is a shared queue, and "a colleague already looked at
 * this" is exactly what you want to know.
 */
/**
 * "28 Aug, 14:32".
 *
 * The TIME is the point, not decoration. Every one of these lists is read
 * straight after forwarding something, and the only question being asked is
 * whether the row on screen is the thing that was just sent or the one from
 * yesterday. A date alone cannot answer that.
 */
function when(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * The document itself, inside the message.
 *
 * Opening an email and being told only that a document "came from" it is a
 * strange kind of answer — the thing people want to see is the thing they
 * sent. The bytes are already stored, so showing them costs one fetch.
 *
 * PDFs go through <object>, images through <img>, and both carry a link out to
 * the browser's own viewer: <object> renders nothing at all in some browsers,
 * and a preview that silently fails to appear is worse than no preview.
 */
function AttachmentPreview({ capture, isDark }: { capture: DocumentCapture; isDark: boolean }) {
  const { t } = useLanguage();
  const c = themeClasses(isDark);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    getCaptureFileUrl(capture.id)
      .then((u) => {
        // Revoke immediately if the dialog closed while this was in flight,
        // otherwise the object URL leaks for the life of the page.
        if (!alive) { URL.revokeObjectURL(u); return; }
        made = u;
        setUrl(u);
      })
      .catch(() => { /* the row still works without a picture */ });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [capture.id]);

  if (!url) return null;
  const isPdf = capture.mimeType === 'application/pdf';
  const isImage = capture.mimeType.startsWith('image/');
  if (!isPdf && !isImage) return null;

  return (
    <div className="space-y-1">
      <div className={`rounded-lg border overflow-hidden ${c.line} ${c.panel}`}>
        {isPdf ? (
          <object data={url} type="application/pdf" className="w-full h-64" aria-label={capture.originalFilename ?? 'PDF'} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={capture.originalFilename ?? ''} className="max-h-64 w-auto mx-auto object-contain" />
        )}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500 hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        {t("dashboard", "captureOpenInTab")}
      </a>
    </div>
  );
}

export default function InboxPage() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const c = themeClasses(isDark);

  const [address, setAddress] = useState<InboundAddress | null>(null);
  const [pending, setPending] = useState<DocumentCapture[]>([]);
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [discarded, setDiscarded] = useState<DocumentCapture[]>([]);
  const [reviewing, setReviewing] = useState<DocumentCapture | null>(null);
  /** The message being looked at, and what it produced. null = still loading. */
  const [detail, setDetail] = useState<InboundMessage | null>(null);
  const [detailCaptures, setDetailCaptures] = useState<DocumentCapture[] | null>(null);
  /** Deleting asks first, in the dialog — not through a browser confirm box. */
  const [confirmDelete, setConfirmDelete] = useState(false);
  /**
   * Selection mode on the Received list.
   *
   * Off by default: a checkbox on every card all the time turns a list you
   * mostly read into a form you mostly ignore. "Edit" asks for it.
   */
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmBulk, setConfirmBulk] = useState(false);
  /**
   * Read by the poll timer, which is created once and must not be torn down
   * and rebuilt every time a checkbox moves.
   */
  const selectingRef = useRef(false);
  useEffect(() => { selectingRef.current = selecting; }, [selecting]);
  const [allowance, setAllowance] = useState<ScanAllowance | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Collapsed by default: useful when something is wrong, noise otherwise. */
  const [diag, setDiag] = useState<InboundDiagnostics | null>(null);
  const [showDiag, setShowDiag] = useState(false);
  /** Which API this page is actually pointed at — local or the live server. */
  const apiBase = serverApiUrl('');
  const isLocal = /localhost|127\.0\.0\.1|192\.168\./.test(apiBase);

  const load = useCallback(() => {
    getInboundAddress().then(setAddress).catch(() => setAddress(null));
    getPendingFromEmail().then(setPending).catch(() => setPending([]));
    getInboundMessages().then(setMessages).catch(() => setMessages([]));
    getDiscardedFromEmail().then(setDiscarded).catch(() => setDiscarded([]));
    getScanAllowance().then(setAllowance).catch(() => setAllowance(null));
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Email arrives while nobody is looking, so this page has to notice on its
   * own — having to reload the page to find out whether something turned up
   * defeats the point of a queue.
   *
   * Polling, not a socket: there is no websocket client in this app, thirty
   * seconds is well inside what anyone would wait, and a paused tab costs
   * nothing because the timer checks visibility before it asks.
   */
  useEffect(() => {
    const tick = () => {
      // Never while a selection is open: replacing the list under somebody
      // mid-selection either drops what they picked or, worse, keeps the ids
      // and applies the action to a list they are no longer looking at.
      if (selectingRef.current) return;
      if (document.visibilityState === 'visible') load();
    };
    const timer = setInterval(tick, 30_000);
    // Coming back to the tab is exactly the moment somebody wants to know.
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  /**
   * Every list here is workspace data, and the switcher changes workspace in
   * place without a reload. Without this the page would go on showing the
   * previous workspace's documents — the same event the dashboard and Company
   * Brain already listen for.
   */
  useEffect(() => {
    const onSwitch = () => {
      setAddress(null);
      setPending([]);
      setMessages([]);
      setDiscarded([]);
      /**
       * The diagnostics too — it reports the workspace's OWN inbound address,
       * so leaving the previous one on screen is worse than showing nothing:
       * somebody would copy an address belonging to a workspace they are no
       * longer in. Re-read only if the panel is actually open.
       */
      setDiag(null);
      if (showDiag) getInboundDiagnostics().then(setDiag).catch(() => setDiag(null));
      load();
    };
    window.addEventListener('finna:businessChanged', onSwitch);
    return () => window.removeEventListener('finna:businessChanged', onSwitch);
  }, [load, showDiag]);

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("dashboard", "inboxErrCopy"));
    }
  };

  const rotate = async () => {
    setBusy(true);
    setError(null);
    try {
      setAddress(await rotateInboundAddress());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "inboxErrRotate"));
    } finally {
      setBusy(false);
    }
  };

  const trust = async (email: string, status: 'trusted' | 'blocked') => {
    setBusy(true);
    setError(null);
    try {
      await setInboundSender(email, status);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "inboxErrSender"));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (id: string) => {
    setBusy(true);
    try {
      await restoreCapture(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "inboxErrRestore"));
    } finally {
      setBusy(false);
    }
  };

  /**
   * The status in words.
   *
   * These were rendered straight from the database — "quarantined", "ignored" —
   * which are the names the code uses, not answers to the question somebody is
   * asking, which is always "so what happened to my document?". "ignored" in
   * particular reads as though the product could not be bothered.
   */
  const statusLabel = (status: InboundMessage['status']): string =>
    t("dashboard",
      status === 'quarantined' ? 'inboxStatusQuarantined'
        : status === 'processing' ? 'inboxStatusProcessing'
          : status === 'processed' ? 'inboxStatusProcessed'
            : status === 'failed' ? 'inboxStatusFailed'
              : 'inboxStatusIgnored');

  /** Reading something is not the same as having dealt with it. */
  const setRead = async (m: InboundMessage, read: boolean) => {
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, openedAt: read ? new Date().toISOString() : null } : x))
    );
    setDetail((d) => (d && d.id === m.id ? { ...d, openedAt: read ? new Date().toISOString() : null } : d));
    try {
      await (read ? markMessageRead(m.id) : markMessageUnread(m.id));
    } catch {
      // Cosmetic. The next poll corrects it either way.
    }
  };

  const removeMessage = async (m: InboundMessage) => {
    setBusy(true);
    setError(null);
    try {
      await deleteInboundMessage(m.id);
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
      setDetail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "inboxErrDelete"));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** Leave selection mode cleanly — a stale selection is a mis-click waiting. */
  const stopSelecting = () => {
    setSelecting(false);
    setSelected([]);
    setConfirmBulk(false);
  };

  const bulkRead = async (read: boolean) => {
    if (!selected.length) return;
    setBusy(true);
    setError(null);
    const stamp = read ? new Date().toISOString() : null;
    try {
      await Promise.all(selected.map((id) => (read ? markMessageRead(id) : markMessageUnread(id))));
      setMessages((prev) =>
        prev.map((m) => (selected.includes(m.id) ? { ...m, openedAt: stamp } : m))
      );
      setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "inboxErrSender"));
    } finally {
      setBusy(false);
    }
  };

  const bulkDelete = async () => {
    if (!selected.length) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all(selected.map((id) => deleteInboundMessage(id)));
      setMessages((prev) => prev.filter((m) => !selected.includes(m.id)));
      stopSelecting();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard", "inboxErrDelete"));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Open a received message.
   *
   * This used to do nothing but clear the unread dot, which made the Received
   * column a dead end: you could see that something had arrived and what its
   * status was, but there was no way to look at what you had actually sent.
   * The queue beside it only lists what is still pending, so anything already
   * confirmed, discarded or quarantined had nowhere to be opened from.
   */
  const open = (m: InboundMessage) => {
    setDetail(m);
    setDetailCaptures(null);
    setConfirmDelete(false);
    getMessageCaptures(m.id).then(setDetailCaptures).catch(() => setDetailCaptures([]));

    // Marking it read is optimistic — the dot is cosmetic and not worth an error.
    if (!m.openedAt) {
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, openedAt: new Date().toISOString() } : x))
      );
      markMessageRead(m.id).catch(() => { /* the dot is not worth an error */ });
    }
  };

  const quarantined = messages.filter((m) => m.status === 'quarantined');
  const unread = messages.filter((m) => !m.openedAt).length;
  const shortfall =
    allowance?.limit != null &&
    allowance.remaining != null &&
    pending.length > allowance.remaining;

  /** One column definition, so the three cannot drift apart visually. */
  const Column = ({
    title, count, accent, action, children,
  }: {
    title: string; count: number; accent?: string;
    /** A control in the header, right-aligned — "Edit" on Received. */
    action?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <section className={`flex flex-col rounded-xl border ${c.surface} ${c.line}`}>
      <header className={`flex items-center justify-between gap-2 px-4 py-3 border-b ${c.line}`}>
        <h2 className={`text-sm font-semibold ${c.heading}`}>{title}</h2>
        <div className="flex items-center gap-2">
          {count > 0 && (
            <span
              className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${
                accent ?? (isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-600')
              }`}
            >
              {count}
            </span>
          )}
          {action}
        </div>
      </header>
      <div className="p-3 space-y-2 overflow-y-auto max-h-[28rem]">{children}</div>
    </section>
  );

  const Empty = ({ text }: { text: string }) => (
    <p className={`text-xs px-1 py-3 ${c.muted}`}>{text}</p>
  );

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 max-w-7xl">
        <h1 className={`text-2xl font-bold mb-1 flex items-center gap-2 ${c.heading}`}>
          <Inbox className="h-6 w-6 text-purple-500" />
          {t("dashboard", "inboxTitle")}
          {unread > 0 && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label={t("dashboard", "inboxUnreadLabel")} />}
        </h1>
        <p className={`mb-5 text-sm ${c.body}`}>
          {t("dashboard", "inboxIntro")}
        </p>

        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        {/* The address, full width above the columns. */}
        <div className={`border rounded-xl p-4 mb-5 ${c.surface} ${c.line}`}>
          <p className={`font-semibold text-sm mb-1 ${c.heading}`}>{t("dashboard", "inboxAddressTitle")}</p>
          <p className={`text-xs mb-3 ${c.muted}`}>
            {t("dashboard", "inboxAddressHelp")}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <code className={`flex-1 min-w-[16rem] rounded-lg px-3 py-2 text-sm font-mono ${c.panel} ${c.heading}`}>
              {address?.email ?? t("dashboard", "inboxLoading")}
            </code>
            <button
              onClick={copy}
              disabled={!address}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t("dashboard", "inboxCopied") : t("dashboard", "inboxCopy")}
            </button>
            <button
              onClick={rotate}
              disabled={busy || !address}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border disabled:opacity-60 ${c.line} ${c.hover} ${c.body}`}
            >
              <RefreshCw className="h-4 w-4" />
              {t("dashboard", "inboxNewAddress")}
            </button>
          </div>

          <p className={`text-[11px] mt-2 ${c.muted}`}>
            {t("dashboard", "inboxAddressWarning")}
          </p>
        </div>

        {shortfall && (
          <p className={`mb-4 text-xs ${c.warn}`}>
            {t("dashboard", "inboxShortfall")
              .replace("{n}", String(allowance?.remaining ?? 0))
              .replace("{m}", String(pending.length))}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1 — what turned up */}
          <Column
            title={t("dashboard", "inboxColReceived")}
            count={unread}
            accent={unread > 0 ? 'bg-amber-500 text-white' : undefined}
            action={messages.length > 0 ? (
              <button
                onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
                className={`text-[11px] font-semibold ${selecting ? 'text-purple-500' : c.muted} hover:underline`}
              >
                {selecting ? t("dashboard", "inboxDone") : t("dashboard", "inboxEdit")}
              </button>
            ) : undefined}
          >
            {/* The bulk bar, only while selecting. */}
            {selecting && messages.length > 0 && (
              <div className={`rounded-lg border p-2 space-y-2 ${c.line} ${c.panel}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`text-[11px] font-semibold ${c.body}`}>
                    {t("dashboard", "inboxSelected").replace("{n}", String(selected.length))}
                  </span>
                  <button
                    onClick={() =>
                      setSelected(selected.length === messages.length ? [] : messages.map((m) => m.id))
                    }
                    className="text-[11px] font-semibold text-purple-500 hover:underline"
                  >
                    {selected.length === messages.length
                      ? t("dashboard", "inboxSelectNone")
                      : t("dashboard", "inboxSelectAll")}
                  </button>
                </div>

                {confirmBulk ? (
                  <div className="space-y-2">
                    <p className={`text-[11px] ${c.muted}`}>
                      {t("dashboard", "inboxBulkDeleteConfirm").replace("{n}", String(selected.length))}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setConfirmBulk(false)}
                        disabled={busy}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${c.line} ${c.body} ${c.hover}`}
                      >
                        {t("dashboard", "phoneCancel")}
                      </button>
                      <button
                        onClick={bulkDelete}
                        disabled={busy}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60"
                      >
                        {busy ? t("dashboard", "inboxDeleting") : t("dashboard", "inboxDelete")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => bulkRead(true)}
                      disabled={busy || !selected.length}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border disabled:opacity-50 ${c.line} ${c.body} ${c.hover}`}
                    >
                      {t("dashboard", "inboxMarkRead")}
                    </button>
                    <button
                      onClick={() => bulkRead(false)}
                      disabled={busy || !selected.length}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border disabled:opacity-50 ${c.line} ${c.body} ${c.hover}`}
                    >
                      {t("dashboard", "inboxMarkUnread")}
                    </button>
                    <button
                      onClick={() => setConfirmBulk(true)}
                      disabled={busy || !selected.length}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-red-500 border border-red-300 disabled:opacity-50 hover:bg-red-500 hover:text-white"
                    >
                      {t("dashboard", "inboxDelete")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {messages.length === 0 ? (
              <Empty text={t("dashboard", "inboxEmptyReceived")} />
            ) : (
              messages.map((m) => (
                <button
                  key={m.id}
                  onClick={() => (selecting ? toggle(m.id) : open(m))}
                  className={`w-full text-left rounded-lg border px-3 py-2 ${c.hover} ${
                    selecting && selected.includes(m.id)
                      ? 'border-purple-500 ring-1 ring-purple-500'
                      : c.line
                  }`}
                >
                  <span className="flex items-start gap-2">
                    {selecting && (
                      // Presentational: the whole card is the control, so a real
                      // checkbox here would be a second tab stop doing the same job.
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded border flex items-center justify-center ${
                          selected.includes(m.id)
                            ? 'bg-purple-500 border-purple-500 text-white'
                            : c.line
                        }`}
                      >
                        {selected.includes(m.id) && <Check className="h-3 w-3" />}
                      </span>
                    )}
                    {/* The dot IS the unread marker, rather than bolding everything. */}
                    <span
                      className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${
                        m.openedAt ? 'bg-transparent' : 'bg-amber-500'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-xs truncate ${
                          m.openedAt ? c.body : `font-semibold ${c.heading}`
                        }`}
                      >
                        {m.subject || t("dashboard", "inboxNoSubject")}
                      </span>
                      <span className={`block text-[11px] truncate ${c.muted}`}>{m.fromEmail}</span>
                      <span className={`block text-[11px] ${c.muted}`}>{when(m.receivedAt)}</span>
                      <span
                        className={`block text-[11px] mt-0.5 ${
                          m.status === 'processed'
                            ? 'text-green-600'
                            : m.status === 'quarantined'
                              ? c.warn
                              : m.status === 'failed'
                                ? c.danger
                                : c.muted
                        }`}
                      >
                        {statusLabel(m.status)}
                        {m.attachmentCount > 0
                          ? ` · ${t("dashboard", "inboxAttached").replace("{n}", String(m.attachmentCount))}`
                          : ''}
                      </span>
                      {m.error && (
                        <span className={`block text-[11px] mt-0.5 ${c.muted}`}>{m.error}</span>
                      )}
                    </span>
                  </span>
                </button>
              ))
            )}
          </Column>

          {/* 2 — what needs me */}
          <Column
            title={t("dashboard", "inboxColPending")}
            count={pending.length}
            accent={pending.length > 0 ? 'bg-purple-500 text-white' : undefined}
          >
            {pending.length === 0 ? (
              <Empty text={t("dashboard", "inboxEmptyPending")} />
            ) : (
              pending.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setReviewing(p)}
                  className={`w-full flex items-center gap-2 text-left rounded-lg border px-3 py-2 ${c.line} ${c.hover}`}
                >
                  <Mail className="h-4 w-4 flex-shrink-0 text-purple-500" />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs font-medium truncate ${c.heading}`}>
                      {p.extractedFields.vendor || p.originalFilename || t("dashboard", "inboxDocument")}
                    </span>
                    <span className={`block text-[11px] ${c.muted}`}>
                      {p.extractedFields.total != null
                        ? `${p.extractedFields.currency ?? ''} ${p.extractedFields.total}`.trim()
                        : t("dashboard", "inboxNoAmount")}
                      {p.extractedFields.documentDate ? ` · ${p.extractedFields.documentDate}` : ''}
                    </span>
                    {/* The date READ OFF the document above; the date it reached
                        you here. They are different questions and often
                        different days. */}
                    <span className={`block text-[11px] ${c.muted}`}>
                      {t("dashboard", "inboxArrived").replace("{when}", when(p.createdAt))}
                    </span>
                  </span>
                  <span className="text-[11px] font-semibold text-purple-500 flex-shrink-0">
                    {t("dashboard", "inboxReview")}
                  </span>
                </button>
              ))
            )}
          </Column>

          {/* 3 — what I threw away */}
          <Column title={t("dashboard", "inboxColBin")} count={discarded.length}>
            {discarded.length === 0 ? (
              <Empty text={t("dashboard", "inboxEmptyBin")} />
            ) : (
              /**
               * The bin is emptied on a schedule, so it has to SAY so. A
               * recycle bin that silently destroys things after a month is
               * worse than one that keeps nothing, because it looks permanent
               * right up until the thing you wanted is gone.
               */
              discarded.map((d) => (
                <div
                  key={d.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${c.line}`}
                >
                  <Trash2 className={`h-4 w-4 flex-shrink-0 ${c.muted}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs truncate ${c.body}`}>
                      {d.extractedFields.vendor || d.originalFilename || t("dashboard", "inboxDocument")}
                    </span>
                    <span className={`block text-[11px] ${c.muted}`}>
                      {d.extractedFields.total != null
                        ? `${d.extractedFields.currency ?? ''} ${d.extractedFields.total}`.trim()
                        : '—'}
                      {` · ${when(d.createdAt)}`}
                    </span>
                  </span>
                  <button
                    onClick={() => restore(d.id)}
                    disabled={busy}
                    title={t("dashboard", "inboxPutItBack")}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-purple-500 hover:underline disabled:opacity-60"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {t("dashboard", "inboxRestore")}
                  </button>
                </div>
              ))
            )}

            {discarded.length > 0 && (
              <p className={`pt-1 text-[11px] ${c.muted}`}>
                {t("dashboard", "inboxBinRetention")}
              </p>
            )}
          </Column>
        </div>

        {/* Held back sits below the columns: it is a decision about PEOPLE, not
            about a document, so it does not belong in a document lane. */}
        {quarantined.length > 0 && (
          <div className={`border rounded-xl p-4 mt-4 ${c.surface} ${c.line}`}>
            <p className={`font-semibold text-sm flex items-center gap-1.5 ${c.heading}`}>
              <AlertTriangle className={`h-4 w-4 ${c.warn}`} />
              {t("dashboard", "inboxHeldBack")}
            </p>
            <p className={`text-xs mt-0.5 mb-3 ${c.muted}`}>
              {t("dashboard", "inboxHeldBackHelp")}
            </p>

            <div className="space-y-2">
              {quarantined.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 ${c.line}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium truncate ${c.heading}`}>
                      {m.subject || t("dashboard", "inboxNoSubject")}
                    </span>
                    <span className={`block text-xs truncate ${c.muted}`}>{m.fromEmail}</span>
                  </span>
                  <button
                    onClick={() => trust(m.fromEmail, 'trusted')}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white"
                  >
                    {t("dashboard", "inboxTrustSender")}
                  </button>
                  <button
                    onClick={() => trust(m.fromEmail, 'blocked')}
                    disabled={busy}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-60 ${c.line} ${c.hover} ${c.body}`}
                  >
                    <ShieldOff className="h-3 w-3" />
                    {t("dashboard", "inboxBlock")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Troubleshooting. Behind a toggle because it answers a question you
            only ask when something has not turned up. */}
        <div className="mt-4">
          <button
            onClick={() => {
              setShowDiag((v) => !v);
              if (!diag) getInboundDiagnostics().then(setDiag).catch(() => setDiag(null));
            }}
            className={`text-xs font-medium underline ${c.muted}`}
          >
            {showDiag
              ? t("dashboard", "inboxHideTroubleshooting")
              : t("dashboard", "inboxShowTroubleshooting")}
          </button>

          {showDiag && (
            <div className={`mt-2 rounded-xl border p-4 text-xs ${c.surface} ${c.line}`}>
              {!diag ? (
                <p className={c.muted}>Loading…</p>
              ) : (
                <>
                  {/* WHICH SERVER AM I READING? First, and on its own, because
                      every confusing hour this feature has caused came from a
                      local answer being read as if it described production.
                      Resend cannot reach localhost, so a local server will
                      never receive a webhook and its counters are all zero by
                      definition. */}
                  {isLocal && (
                    <p className={`mb-3 rounded-lg border px-3 py-2 ${isDark ? 'border-amber-800 bg-amber-900/20 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                      <strong>This is your local server.</strong> Resend can only deliver to the
                      live site, so everything below describes a server that will never receive
                      email. Open this page on the live site to diagnose delivery — and note the
                      address above is a different one, because local and production use separate
                      databases.
                    </p>
                  )}

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    {(() => {
                      const rows: [string, string][] = [
                        ['Talking to', apiBase],
                        /**
                         * The exact URL Resend must be pointed at.
                         *
                         * "Talking to" is the app's API base, which is NOT the
                         * webhook URL — reading one as the other is an easy and
                         * completely invisible mistake. Spelling it out here
                         * means it can be copied rather than assembled.
                         */
                        ['Webhook URL for Resend', `${apiBase.replace(/\/$/, '')}/v1/inbound/resend`],
                        ['This workspace’s address', diag.address],
                        ['Receiving domain', diag.inboundDomain],
                        ['Signing secret set', diag.signingSecretSet ? 'yes' : 'NO — the webhook will be refused'],
                        ['Resend API key set', diag.apiKeySet ? 'yes' : 'NO — mail cannot be read'],
                        ['Deliveries seen', String(diag.webhook.total)],
                        ['Signature rejected', String(diag.webhook.badSignature)],
                        ['Payload unrecognised', String(diag.webhook.unreadable)],
                        ['Address not found', String(diag.webhook.unknownAddress)],
                        ['Routed to this server', String(diag.webhook.routed)],
                      ];

                      // The reason, when there is one. A count says a delivery
                      // was refused; only this says what to change.
                      if (diag.webhook.lastFailure) {
                        rows.push(['Why it was rejected', diag.webhook.lastFailure]);
                      }

                      /**
                       * The secret's shape, shown only once something has
                       * actually been refused — it is noise otherwise, and it
                       * distinguishes a bad paste from a genuine mismatch.
                       */
                      if (diag.webhook.badSignature > 0 && diag.secret) {
                        rows.push(
                          ['Secret starts with whsec_', diag.secret.hasWhsecPrefix ? 'yes' : 'NO'],
                          ['Secret decodes as base64', diag.secret.looksBase64 ? 'yes' : 'NO — wrong value pasted'],
                          ['Secret had stray spaces', diag.secret.hadSurroundingWhitespace ? 'YES — re-paste it' : 'no'],
                          ['Secret key length', `${diag.secret.keyBytes} bytes`],
                        );
                      }

                      return rows;
                    })().map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3">
                        <dt className={c.muted}>{k}</dt>
                        <dd className={`font-mono text-right break-all ${c.heading}`}>{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <p className={`mt-3 ${c.muted}`}>
                    {isLocal
                      ? 'Nothing here indicates a problem — a local server is not connected to Resend at all.'
                      : diag.webhook.total === 0
                      ? 'Resend has not called this server since it last restarted. Check the webhook exists, points at the URL above, and is SUBSCRIBED TO INBOUND EMAIL — a webhook listening only to sending events never fires when mail arrives.'
                      : diag.webhook.unknownAddress > 0
                        ? 'Mail arrived for an address this database does not have. Addresses are per environment — use the one shown above, from THIS site.'
                        : diag.webhook.badSignature > 0
                          ? (diag.secret && !diag.secret.looksBase64
                            ? 'The signing secret is not a valid whsec_ key — something else was pasted into it. Copy the Signing Secret from the webhook in Resend, not an API key.'
                            : diag.webhook.lastFailure?.startsWith('timestamp')
                              ? 'The signature is fine but the timestamp is out of step — the delivery was delayed or this server’s clock is off.'
                              : 'Deliveries are being refused: the signing secret here does not match the one on THIS webhook. If you have more than one webhook in Resend, each has its own secret.')
                          : 'Deliveries are arriving and routing. If a document is missing, look in Received above for its status.'}
                  </p>
                  <p className={`mt-1 ${c.muted}`}>
                    Counts reset whenever the server restarts, and they count EVERY request to the
                    webhook — including a manual test. Compare them against Resend’s own delivery
                    log rather than reading them as proof Resend called.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/**
        * What one email turned into.
        *
        * The Received column answers "did it arrive"; this answers "and then
        * what?" — which is the question somebody actually has when a document
        * they forwarded is not where they expected it. It opens the documents
        * the email produced, including ones already confirmed or discarded,
        * which the Pending queue by definition cannot show.
        */}
      {detail && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="message-detail-title"
          onClick={() => setDetail(null)}
        >
          <div
            className={`w-full max-w-lg rounded-xl shadow-xl ${c.surface}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-start justify-between gap-3 p-5 border-b ${c.line}`}>
              <div className="min-w-0">
                <h2 id="message-detail-title" className={`text-base font-bold truncate ${c.heading}`}>
                  {detail.subject || t("dashboard", "inboxNoSubject")}
                </h2>
                <p className={`text-xs mt-0.5 truncate ${c.muted}`}>
                  {t("dashboard", "inboxFrom")}{' '}
                  {detail.fromName ? `${detail.fromName} · ` : ''}{detail.fromEmail}
                </p>
                <p className={`text-xs ${c.muted}`}>
                  {t("dashboard", "inboxReceivedAt")} {when(detail.receivedAt)}
                </p>
              </div>
              <button
                onClick={() => setDetail(null)}
                aria-label={t("dashboard", "inboxClose")}
                className={`flex-shrink-0 ${c.quietControl}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {detail.status === 'quarantined' && (
                <div className={`rounded-lg border p-3 text-xs ${c.line}`}>
                  <p className={c.body}>
                    <span className="font-semibold">{t("dashboard", "inboxDetailHeldBack")}</span>{' '}
                    {t("dashboard", "inboxDetailHeldBackBody")}
                  </p>
                  <button
                    onClick={() => { trust(detail.fromEmail, 'trusted'); setDetail(null); }}
                    disabled={busy}
                    className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-purple-500 hover:bg-purple-600 disabled:opacity-60"
                  >
                    {t("dashboard", "inboxTrustThisSender").replace("{email}", detail.fromEmail)}
                  </button>
                  <p className={`mt-1 ${c.muted}`}>
                    {t("dashboard", "inboxTrustApplies")}
                  </p>
                </div>
              )}

              {detail.status === 'failed' && (
                <p className={`text-xs ${c.danger}`}>
                  {detail.error || t("dashboard", "inboxCouldNotRead")}
                </p>
              )}

              {detailCaptures === null ? (
                <p className={`text-xs ${c.muted}`}>{t("dashboard", "inboxLooking")}</p>
              ) : detailCaptures.length === 0 ? (
                <p className={`text-xs ${c.muted}`}>
                  {detail.status === 'quarantined'
                    ? t("dashboard", "inboxNoDocByDesign")
                    : detail.attachmentCount > 0
                      ? t("dashboard", "inboxNoDocFromAttachments")
                      : t("dashboard", "inboxNoDocNoAttachment")}
                </p>
              ) : (
                <>
                  <p className={`text-xs font-semibold ${c.label}`}>
                    {detailCaptures.length === 1
                      ? t("dashboard", "inboxOneDoc")
                      : t("dashboard", "inboxManyDocs").replace("{n}", String(detailCaptures.length))}
                  </p>
                  {detailCaptures.map((d) => (
                    <div key={d.id} className="space-y-2">
                    <button
                      onClick={() => { setReviewing(d); setDetail(null); }}
                      className={`w-full flex items-center gap-2 text-left rounded-lg border px-3 py-2 ${c.line} ${c.hover}`}
                    >
                      <FileText className="h-4 w-4 flex-shrink-0 text-purple-500" />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-xs font-medium truncate ${c.heading}`}>
                          {d.extractedFields.vendor || d.originalFilename || t("dashboard", "inboxDocument")}
                        </span>
                        <span className={`block text-[11px] ${c.muted}`}>
                          {d.status === 'pending_review'
                            ? t("dashboard", "inboxWaitingForYou")
                            : d.status === 'confirmed'
                              ? t("dashboard", "inboxAlreadyInBooks")
                              : t("dashboard", "inboxInBin")}
                          {d.extractedFields.total != null
                            ? ` · ${`${d.extractedFields.currency ?? ''} ${d.extractedFields.total}`.trim()}`
                            : ''}
                        </span>
                      </span>
                      <span className="text-[11px] font-semibold text-purple-500 flex-shrink-0">
                        {t("dashboard", "inboxOpen")}
                      </span>
                    </button>
                      <AttachmentPreview capture={d} isDark={isDark} />
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Actions on the EMAIL itself, separated from what it produced. */}
            <div className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t ${c.line}`}>
              <button
                onClick={() => setRead(detail, !detail.openedAt)}
                className={`text-xs font-medium underline ${c.muted}`}
              >
                {detail.openedAt
                  ? t("dashboard", "inboxMarkUnread")
                  : t("dashboard", "inboxMarkRead")}
              </button>

              {confirmDelete ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className={`text-[11px] ${c.muted}`}>
                    {t("dashboard", "inboxDeleteConfirm")}
                  </span>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={busy}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${c.line} ${c.body} ${c.hover}`}
                  >
                    {t("dashboard", "phoneCancel")}
                  </button>
                  <button
                    onClick={() => removeMessage(detail)}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60"
                  >
                    {busy ? t("dashboard", "inboxDeleting") : t("dashboard", "inboxDelete")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 text-xs font-medium text-red-500 hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("dashboard", "inboxDelete")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {reviewing && (
        <CaptureReviewModal
          capture={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={() => { setReviewing(null); load(); }}
          onOutOfScans={() => {
            setReviewing(null);
            setError(t("dashboard", "inboxErrNoScans"));
          }}
        />
      )}
    </DashboardShell>
  );
}
