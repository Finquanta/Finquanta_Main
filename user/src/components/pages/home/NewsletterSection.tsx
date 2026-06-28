"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <section id="newsletter" className="min-h-screen flex items-center bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
        <Image src="/images/getInTouch.svg" alt="Envelope icon for newsletter signup" width={180} height={180} className="mb-10" />
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-8">{t("newsletter", "title")}</h2>
        <p className="text-gray-600 mb-8 max-w-lg text-base sm:text-lg">{t("newsletter", "description")}</p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch justify-center gap-3 w-full max-w-md px-4">
          <Input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (status !== 'idle') { setStatus('idle'); setMessage(''); } }}
            placeholder={t("newsletter", "emailPlaceholder")}
            className="flex-grow w-full sm:w-auto border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-200 focus:border-green-500"
          />
          <Button type="submit" disabled={status === 'loading'} variant="outline" className="w-full sm:w-auto text-green-600 border-2 border-green-600 hover:bg-green-50 rounded-lg px-6 py-3 text-sm sm:text-base font-medium disabled:opacity-60">
            {status === 'loading' ? '…' : t("newsletter", "subscribe")}
          </Button>
        </form>
        {message && (
          <p className={`mt-4 text-sm ${status === 'error' ? 'text-red-600' : 'text-green-600'}`} role="status">
            {message}
          </p>
        )}
      </div>
    </section>
  );
};

export default NewsletterSection;
