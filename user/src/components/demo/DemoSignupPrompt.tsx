'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DemoTriggerReason } from '@/lib/demo/types';
import { dismissTrigger, load, save } from '@/lib/demo/store';
import { triggerCopy, describeWork, nextTrigger } from '@/lib/demo/triggers';
import { stashForSignup } from '@/lib/demo/migrate';
import { isDemoFormOpen } from '@/lib/demo/formGuard';
import { useLanguage } from '@/hooks/context/LanguageContext';

/** How often to re-check. Two of the triggers are time-based, so a state change
 * alone isn't enough to notice them. */
const POLL_MS = 5_000;

/**
 * Pages that ARE a form. Prompting here risks the visitor clicking through to
 * signup and losing what they'd typed — the opposite of what the prompt is for.
 * Modal forms aren't routes, so `isDemoFormOpen()` covers those separately.
 */
const isFormRoute = (pathname: string | null) =>
  !!pathname && (pathname.endsWith('/invoices/new') || pathname.endsWith('/edit'));

export default function DemoSignupPrompt() {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [reason, setReason] = useState<DemoTriggerReason | null>(null);
  const [summary, setSummary] = useState('');

  /**
   * Whether a prompt is on screen. A ref rather than reading `reason`, because
   * the polling effect closes over its initial value and would never see it
   * change — and the state updater itself must stay pure, so the "already
   * showing" check can't live in there.
   */
  const showing = useRef(false);

  useEffect(() => {
    if (isFormRoute(pathname)) {
      showing.current = false;
      setReason(null);
      return;
    }
    const check = () => {
      // Don't swap the message out from under someone mid-read.
      if (showing.current) return;
      // Re-checked every tick, not once on mount: a modal can open and close
      // between polls, and the timer-driven triggers don't care that it did.
      if (isDemoFormOpen()) return;
      const state = load();
      const next = nextTrigger(state);
      if (!next) return;
      showing.current = true;
      setSummary(describeWork(state, t));
      setReason(next);
    };
    check();
    const id = window.setInterval(check, POLL_MS);
    return () => window.clearInterval(id);
  }, [pathname]);

  if (!reason) return null;

  const copy = triggerCopy(t)[reason];

  const dismiss = () => {
    const state = load();
    dismissTrigger(state, reason);
    save(state);
    showing.current = false;
    setReason(null);
  };

  const goSignup = () => {
    // Hand the session off before navigating — sessionStorage won't survive it.
    stashForSignup();
    router.push('/signup');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={dismiss}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-prompt-title"
      >
        <h2 id="demo-prompt-title" className="text-lg font-bold text-gray-900 mb-2">{copy.title}</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">{copy.body}</p>

        {summary && (
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-5">
            <p className="text-xs text-green-800">{t("demo","dWeWillCarry")}<span className="font-semibold">{summary}</span> — {t("demo","tgNoRetype")}
            </p>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            onClick={dismiss}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
          >{t("demo","dKeepExploring")}</button>
          <button
            onClick={goSignup}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-500 hover:bg-green-600"
          >
            {copy.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
