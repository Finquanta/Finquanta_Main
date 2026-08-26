'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  EmailPreferences, REMINDER_LABELS, REMINDER_TYPES, ReminderType,
  getUnsubscribeInfo, resubscribe, unsubscribe,
} from '@/lib/api/lifecycle';

/**
 * One-click unsubscribe, reached from a link in a reminder email.
 *
 * Deliberately works LOGGED OUT — the token in the link is the identity. Somebody
 * who wants to stop hearing from us should not first have to remember a password,
 * and both CAN-SPAM and Gmail's bulk-sender rules treat "you must sign in first"
 * as not having an unsubscribe mechanism at all.
 *
 * It offers per-type toggles as well as "stop everything", because the four
 * reminders are not the same kind of message: somebody sick of plan suggestions
 * may still want to be told their account has no recovery phone on it.
 */
function UnsubscribeInner() {
  const params = useSearchParams();
  const token = params?.get('t') || '';

  const [info, setInfo] = useState<{ email: string; preferences: EmailPreferences } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('This link is missing its code.'); return; }
    getUnsubscribeInfo(token)
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : 'That link is not valid.'));
  }, [token]);

  const stopAll = async () => {
    setBusy(true); setError(null);
    try {
      await unsubscribe(token, { all: true });
      setInfo((p) => p && {
        ...p,
        preferences: Object.fromEntries(REMINDER_TYPES.map((t) => [t, false])) as EmailPreferences,
      });
      setDone('You will not receive any more reminder emails.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that.');
    }
    setBusy(false);
  };

  /**
   * Both directions from the same link.
   *
   * Off-only made a misclick permanent for anybody who could not remember their
   * password — which is a large share of the people who reach this page, since
   * they arrived from an email rather than from inside the product.
   */
  const setOne = async (type: ReminderType, on: boolean) => {
    setBusy(true); setError(null);
    try {
      if (on) await resubscribe(token, type);
      else await unsubscribe(token, { type });
      setInfo((p) => p && { ...p, preferences: { ...p.preferences, [type]: on } });
      setDone(on
        ? `"${REMINDER_LABELS[type].title}" emails are back on.`
        : `You will not receive "${REMINDER_LABELS[type].title}" emails.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that.');
    }
    setBusy(false);
  };

  return (
    <main className="min-h-screen bg-white pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-lg">
        <h1 className="text-xl font-bold mb-2">Email Reminders</h1>

        {error && !info && (
          <p className="text-sm text-gray-600">
            {error} If you were trying to stop reminder emails, you can also turn them off in
            Settings once you are signed in.
          </p>
        )}

        {info && (
          <>
            <p className="text-sm text-gray-500 mb-6">{info.email}</p>

            {done && (
              <p className="mb-5 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                {done}
              </p>
            )}
            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <div className="space-y-3">
              {REMINDER_TYPES.map((t) => {
                const on = info.preferences[t];
                return (
                  <div key={t} className="flex items-start justify-between gap-4 border border-gray-200 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{REMINDER_LABELS[t].title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{REMINDER_LABELS[t].description}</p>
                    </div>
                    <button
                      onClick={() => setOne(t, !on)}
                      disabled={busy}
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-60 ${
                        on
                          ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          : 'border-green-500 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {on ? 'Turn off' : 'Turn back on'}
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={stopAll}
              disabled={busy}
              className="mt-6 w-full rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              Turn off all reminder emails
            </button>

            {/* Said plainly, because "unsubscribe" is easily read as "close my
                account" — and somebody who believes that is what they just did
                is a support ticket at best. */}
            <p className="mt-4 text-xs text-gray-500">
              This only affects reminder emails. Your account stays exactly as it is, and you will
              still receive things you ask for, such as password resets. You can change any of
              this later here, or in Settings → Notifications once you are signed in.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function UnsubscribePage() {
  // `useSearchParams` opts the route out of static rendering unless it sits
  // behind a Suspense boundary — `next build` fails on it where `next dev` does
  // not, so without this the deploy is what finds out.
  return (
    <Suspense fallback={null}>
      <UnsubscribeInner />
    </Suspense>
  );
}
