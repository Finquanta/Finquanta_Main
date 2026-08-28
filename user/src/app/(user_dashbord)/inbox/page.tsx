"use client";

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Check, Copy, Inbox, Mail, RefreshCw, RotateCcw, ShieldOff, Trash2,
} from 'lucide-react';
import DashboardShell from '@/components/user_dashboard/DashboardShell';
import { useTheme } from '@/hooks/context/ThemeContext';
import { themeClasses } from '@/lib/theme';
import CaptureReviewModal from '@/components/user_dashboard/capture/CaptureReviewModal';
import { DocumentCapture, ScanAllowance, getScanAllowance } from '@/lib/api/capture';
import { serverApiUrl } from '@/lib/api/client';
import {
  InboundAddress, InboundMessage, getDiscardedFromEmail, getInboundAddress, getInboundMessages,
  InboundDiagnostics, getInboundDiagnostics,
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
export default function InboxPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const c = themeClasses(isDark);

  const [address, setAddress] = useState<InboundAddress | null>(null);
  const [pending, setPending] = useState<DocumentCapture[]>([]);
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [discarded, setDiscarded] = useState<DocumentCapture[]>([]);
  const [reviewing, setReviewing] = useState<DocumentCapture | null>(null);
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
      setError('Could not copy. Select the address and copy it by hand.');
    }
  };

  const rotate = async () => {
    setBusy(true);
    setError(null);
    try {
      setAddress(await rotateInboundAddress());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the address.');
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
      setError(e instanceof Error ? e.message : 'Could not update that sender.');
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
      setError(e instanceof Error ? e.message : 'Could not restore that document.');
    } finally {
      setBusy(false);
    }
  };

  /** Opening a message is what clears its dot. Optimistic — it is cosmetic. */
  const open = (m: InboundMessage) => {
    if (m.openedAt) return;
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, openedAt: new Date().toISOString() } : x))
    );
    markMessageRead(m.id).catch(() => { /* the dot is not worth an error */ });
  };

  const quarantined = messages.filter((m) => m.status === 'quarantined');
  const unread = messages.filter((m) => !m.openedAt).length;
  const shortfall =
    allowance?.limit != null &&
    allowance.remaining != null &&
    pending.length > allowance.remaining;

  /** One column definition, so the three cannot drift apart visually. */
  const Column = ({
    title, count, accent, children,
  }: {
    title: string; count: number; accent?: string; children: React.ReactNode;
  }) => (
    <section className={`flex flex-col rounded-xl border ${c.surface} ${c.line}`}>
      <header className={`flex items-center justify-between gap-2 px-4 py-3 border-b ${c.line}`}>
        <h2 className={`text-sm font-semibold ${c.heading}`}>{title}</h2>
        {count > 0 && (
          <span
            className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${
              accent ?? (isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-600')
            }`}
          >
            {count}
          </span>
        )}
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
          Inbox
          {unread > 0 && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="unread" />}
        </h1>
        <p className={`mb-5 text-sm ${c.body}`}>
          Send or forward bills and payment notices to your workspace address — attach as many as
          you like in one email. Nothing reaches your books until you confirm it.
        </p>

        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        {/* The address, full width above the columns. */}
        <div className={`border rounded-xl p-4 mb-5 ${c.surface} ${c.line}`}>
          <p className={`font-semibold text-sm mb-1 ${c.heading}`}>Your workspace email address</p>
          <p className={`text-xs mb-3 ${c.muted}`}>
            Attach a whole batch and send it, give it to a supplier, or set a forwarding rule so
            their invoices arrive by themselves. Each workspace has its own address.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <code className={`flex-1 min-w-[16rem] rounded-lg px-3 py-2 text-sm font-mono ${c.panel} ${c.heading}`}>
              {address?.email ?? 'Loading…'}
            </code>
            <button
              onClick={copy}
              disabled={!address}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={rotate}
              disabled={busy || !address}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border disabled:opacity-60 ${c.line} ${c.hover} ${c.body}`}
            >
              <RefreshCw className="h-4 w-4" />
              New address
            </button>
          </div>

          <p className={`text-[11px] mt-2 ${c.muted}`}>
            Treat it like a password. Anyone who has it can send documents here — if it gets out,
            take a new one and the old address stops working immediately.
          </p>
        </div>

        {shortfall && (
          <p className={`mb-4 text-xs ${c.warn}`}>
            You have {allowance?.remaining ?? 0} scans left and {pending.length} documents waiting.
            The rest will have to wait for next month, or a larger plan.
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1 — what turned up */}
          <Column
            title="Received"
            count={unread}
            accent={unread > 0 ? 'bg-amber-500 text-white' : undefined}
          >
            {messages.length === 0 ? (
              <Empty text="Nothing yet. Forwarded email shows up here." />
            ) : (
              messages.map((m) => (
                <button
                  key={m.id}
                  onClick={() => open(m)}
                  className={`w-full text-left rounded-lg border px-3 py-2 ${c.line} ${c.hover}`}
                >
                  <span className="flex items-start gap-2">
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
                        {m.subject || '(no subject)'}
                      </span>
                      <span className={`block text-[11px] truncate ${c.muted}`}>{m.fromEmail}</span>
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
                        {m.status}
                        {m.attachmentCount > 0 ? ` · ${m.attachmentCount} attached` : ''}
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
            title="Pending"
            count={pending.length}
            accent={pending.length > 0 ? 'bg-purple-500 text-white' : undefined}
          >
            {pending.length === 0 ? (
              <Empty text="Nothing waiting. Documents that were read land here to check." />
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
                      {p.extractedFields.vendor || p.originalFilename || 'Document'}
                    </span>
                    <span className={`block text-[11px] ${c.muted}`}>
                      {p.extractedFields.total != null
                        ? `${p.extractedFields.currency ?? ''} ${p.extractedFields.total}`.trim()
                        : 'No amount read'}
                      {p.extractedFields.documentDate ? ` · ${p.extractedFields.documentDate}` : ''}
                    </span>
                  </span>
                  <span className="text-[11px] font-semibold text-purple-500 flex-shrink-0">
                    Review
                  </span>
                </button>
              ))
            )}
          </Column>

          {/* 3 — what I threw away */}
          <Column title="Recycle Bin" count={discarded.length}>
            {discarded.length === 0 ? (
              <Empty text="Empty. Documents you discard can be put back from here." />
            ) : (
              discarded.map((d) => (
                <div
                  key={d.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${c.line}`}
                >
                  <Trash2 className={`h-4 w-4 flex-shrink-0 ${c.muted}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs truncate ${c.body}`}>
                      {d.extractedFields.vendor || d.originalFilename || 'Document'}
                    </span>
                    <span className={`block text-[11px] ${c.muted}`}>
                      {d.extractedFields.total != null
                        ? `${d.extractedFields.currency ?? ''} ${d.extractedFields.total}`.trim()
                        : '—'}
                    </span>
                  </span>
                  <button
                    onClick={() => restore(d.id)}
                    disabled={busy}
                    title="Put it back"
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-purple-500 hover:underline disabled:opacity-60"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restore
                  </button>
                </div>
              ))
            )}
          </Column>
        </div>

        {/* Held back sits below the columns: it is a decision about PEOPLE, not
            about a document, so it does not belong in a document lane. */}
        {quarantined.length > 0 && (
          <div className={`border rounded-xl p-4 mt-4 ${c.surface} ${c.line}`}>
            <p className={`font-semibold text-sm flex items-center gap-1.5 ${c.heading}`}>
              <AlertTriangle className={`h-4 w-4 ${c.warn}`} />
              Held back
            </p>
            <p className={`text-xs mt-0.5 mb-3 ${c.muted}`}>
              From addresses this workspace has not seen before, so nothing was opened or read.
              Trust a sender and their future mail is processed automatically.
            </p>

            <div className="space-y-2">
              {quarantined.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 ${c.line}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium truncate ${c.heading}`}>
                      {m.subject || '(no subject)'}
                    </span>
                    <span className={`block text-xs truncate ${c.muted}`}>{m.fromEmail}</span>
                  </span>
                  <button
                    onClick={() => trust(m.fromEmail, 'trusted')}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white"
                  >
                    Trust sender
                  </button>
                  <button
                    onClick={() => trust(m.fromEmail, 'blocked')}
                    disabled={busy}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-60 ${c.line} ${c.hover} ${c.body}`}
                  >
                    <ShieldOff className="h-3 w-3" />
                    Block
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
            {showDiag ? 'Hide troubleshooting' : 'Nothing arriving? Check troubleshooting'}
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

      {reviewing && (
        <CaptureReviewModal
          capture={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={() => { setReviewing(null); load(); }}
          onOutOfScans={() => {
            setReviewing(null);
            setError('You have used all of this month’s document scans.');
          }}
        />
      )}
    </DashboardShell>
  );
}
