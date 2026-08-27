"use client";

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, Inbox, Mail, RefreshCw, ShieldOff } from 'lucide-react';
import DashboardShell from '@/components/user_dashboard/DashboardShell';
import { useTheme } from '@/hooks/context/ThemeContext';
import CaptureReviewModal from '@/components/user_dashboard/capture/CaptureReviewModal';
import { DocumentCapture, ScanAllowance, getScanAllowance } from '@/lib/api/capture';
import {
  InboundAddress, InboundMessage, getInboundAddress, getInboundMessages,
  getPendingFromEmail, rotateInboundAddress, setInboundSender,
} from '@/lib/api/inbound';

/**
 * The email inbox.
 *
 * This page was a placeholder reading "No messages yet" against nothing. It now
 * means something: forward a bill to the address shown at the top, and it turns
 * up here as a pre-filled entry waiting for a look.
 *
 * Reviewing goes through the SAME popup a photographed receipt uses. There is
 * one way into the books, and this is not a second one.
 */
export default function InboxPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [address, setAddress] = useState<InboundAddress | null>(null);
  const [pending, setPending] = useState<DocumentCapture[]>([]);
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [reviewing, setReviewing] = useState<DocumentCapture | null>(null);
  const [allowance, setAllowance] = useState<ScanAllowance | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getInboundAddress().then(setAddress).catch(() => setAddress(null));
    getPendingFromEmail().then(setPending).catch(() => setPending([]));
    getInboundMessages().then(setMessages).catch(() => setMessages([]));
    // Refreshed alongside the queue, because confirming from here spends one.
    getScanAllowance().then(setAllowance).catch(() => setAllowance(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const card = isDark ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-900';
  const muted = isDark ? 'text-gray-400' : 'text-gray-500';
  // Tailwind's `dark:` variants are inert here — see CaptureReviewModal.
  const warn = isDark ? 'text-amber-400' : 'text-amber-600';

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

  const quarantined = messages.filter((m) => m.status === 'quarantined');
  /** More waiting than can be confirmed. Worth saying BEFORE they start. */
  const shortfall =
    allowance?.limit != null &&
    allowance.remaining != null &&
    pending.length > allowance.remaining;

  return (
    <DashboardShell>
      <div className="p-6 max-w-4xl">
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
          <Inbox className="h-7 w-7 text-purple-500" />
          Inbox
        </h1>
        <p className={`mb-6 text-sm ${muted}`}>
          Send or forward bills and payment notices to your workspace address — attach as many as you
          like in one email — and they arrive here, read and ready to check. Nothing reaches your
          books until you confirm it.
        </p>

        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        {/* The address */}
        <div className={`border rounded-xl p-4 mb-4 ${card}`}>
          <p className="font-semibold text-sm mb-1">Your workspace email address</p>
          <p className={`text-xs mb-3 ${muted}`}>
            Attach a whole batch and send it, give the address to a supplier directly, or set a
            forwarding rule in Gmail or Outlook so their invoices arrive by themselves.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <code className={`flex-1 min-w-[16rem] rounded-lg px-3 py-2 text-sm font-mono ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
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
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border disabled:opacity-60 ${
                isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <RefreshCw className="h-4 w-4" />
              New address
            </button>
          </div>

          <p className={`text-[11px] mt-2 ${muted}`}>
            Treat it like a password. Anyone who has it can send documents to this workspace — if it
            gets out, take a new one and the old address stops working immediately.
          </p>
        </div>

        {/* Waiting for a look */}
        <div className={`border rounded-xl p-4 mb-4 ${card}`}>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <p className="font-semibold text-sm">
              Waiting for you {pending.length > 0 && <span className="text-purple-500">({pending.length})</span>}
            </p>
            {/* One scan per document, spent when you confirm it — so somebody
                about to work through a batch can see whether it will fit. */}
            {allowance?.limit != null && (
              <span className={`text-[11px] ${shortfall ? `${warn} font-semibold` : muted}`}>
                {allowance.remaining ?? 0} scans left this month
              </span>
            )}
          </div>

          {shortfall && (
            <p className={`mb-3 text-xs ${warn}`}>
              You have {allowance?.remaining ?? 0} scans left and {pending.length} documents waiting.
              Confirming them all needs {pending.length} — the rest will have to wait for next month,
              or a larger plan.
            </p>
          )}

          {pending.length === 0 ? (
            <p className={`text-sm ${muted}`}>Nothing waiting. Forwarded documents show up here.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setReviewing(c)}
                  className={`w-full flex items-center gap-3 text-left rounded-lg border px-3 py-2.5 transition-colors ${
                    isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Mail className="h-4 w-4 flex-shrink-0 text-purple-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">
                      {c.extractedFields.vendor || c.originalFilename || 'Document'}
                    </span>
                    <span className={`block text-xs ${muted}`}>
                      {c.extractedFields.total != null
                        ? `${c.extractedFields.currency ?? ''} ${c.extractedFields.total}`.trim()
                        : 'No amount read — needs filling in'}
                      {c.extractedFields.documentDate ? ` · ${c.extractedFields.documentDate}` : ''}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-purple-500 flex-shrink-0">Review</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Held back */}
        {quarantined.length > 0 && (
          <div className={`border rounded-xl p-4 mb-4 ${card}`}>
            <p className="font-semibold text-sm flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Held back
            </p>
            <p className={`text-xs mt-0.5 mb-3 ${muted}`}>
              These came from addresses this workspace has not seen before, so nothing was opened or
              read. Trust a sender and their future mail is processed automatically.
            </p>

            <div className="space-y-2">
              {quarantined.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 ${
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{m.subject || '(no subject)'}</span>
                    <span className={`block text-xs truncate ${muted}`}>{m.fromEmail}</span>
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
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-60 ${
                      isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <ShieldOff className="h-3 w-3" />
                    Block
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What has arrived */}
        <div className={`border rounded-xl p-4 ${card}`}>
          <p className="font-semibold text-sm mb-3">Recently received</p>
          {messages.length === 0 ? (
            <p className={`text-sm ${muted}`}>Nothing yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-xs text-left border-b ${muted} ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <th className="py-2 pr-3 font-medium">From</th>
                    <th className="py-2 px-3 font-medium">Subject</th>
                    <th className="py-2 pl-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((m) => (
                    <tr key={m.id} className={`border-b last:border-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <td className="py-2 pr-3 truncate max-w-[14rem]">{m.fromEmail}</td>
                      <td className={`py-2 px-3 truncate max-w-[18rem] ${muted}`}>{m.subject || '—'}</td>
                      <td className="py-2 pl-3 text-right">
                        <span className={`text-xs font-medium ${
                          m.status === 'processed' ? 'text-green-600'
                            : m.status === 'quarantined' ? 'text-amber-600'
                              : m.status === 'failed' ? 'text-red-500'
                                : muted
                        }`}>
                          {m.status}
                        </span>
                        {m.error && <span className={`block text-[11px] ${muted}`}>{m.error}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* The same popup a photographed receipt opens. */}
      {reviewing && (
        <CaptureReviewModal
          capture={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={() => { setReviewing(null); load(); }}
          onOutOfScans={() => { setReviewing(null); setError('You have used all of this month’s document scans.'); }}
        />
      )}
    </DashboardShell>
  );
}
