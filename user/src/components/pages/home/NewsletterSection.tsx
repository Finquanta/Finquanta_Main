"use client";
import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { subscribeNewsletter } from '@/lib/api/newsletter';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NewsletterSection = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'loading') return;
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const res = await subscribeNewsletter(value, 'newsletter');
      setStatus('done');
      setMessage(res.alreadySubscribed ? "You're already on the list — thanks!" : 'Thanks for subscribing!');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <section id="newsletter" className="scroll-mt-24 px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="mx-auto grid max-w-6xl gap-8 rounded-3xl border border-fq-ink/10 bg-white px-6 py-10 sm:px-10 md:grid-cols-2 md:items-center">
        <div>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-fq-green/15 text-[#1E9E2A]">
            <Mail className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-2xl font-medium tracking-[-0.02em] text-fq-ink sm:text-3xl">{t("newsletter", "title")}</h2>
          <p className="mt-3 max-w-md text-fq-slate">{t("newsletter", "description")}</p>
        </div>
        <div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:rounded-full sm:border sm:border-fq-ink/10 sm:bg-fq-bg sm:p-1.5">
            <label htmlFor="newsletter-email" className="sr-only">{t("newsletter", "emailPlaceholder")}</label>
            <input
              id="newsletter-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (status !== 'idle') { setStatus('idle'); setMessage(''); } }}
              placeholder={t("newsletter", "emailPlaceholder")}
              className="h-12 w-full rounded-full border border-fq-ink/10 bg-white px-5 text-sm text-fq-ink placeholder:text-fq-slate/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-fq-green sm:h-10 sm:border-0 sm:bg-transparent sm:px-4"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-fq-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-fq-ink/90 disabled:opacity-60 sm:h-10"
            >
              {status === 'loading' ? '…' : t("newsletter", "subscribe")}
            </button>
          </form>
          {message && (
            <p className={`mt-3 text-sm ${status === 'error' ? 'text-red-600' : 'text-[#1E9E2A]'}`} role="status">
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
