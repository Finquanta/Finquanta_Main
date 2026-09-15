"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/hooks/context/LanguageContext';
import { useSectionLink } from '@/hooks/useSectionLink';
import { SOCIAL_LINKS } from '@/components/SocialIcons';

type FooterProps = {
  onContactClick: () => void;
};

const linkClass = 'text-sm text-white/60 transition-colors hover:text-white';

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  );
}

const Footer = ({ onContactClick }: FooterProps) => {
  const { t } = useLanguage();
  const goTo = useSectionLink();

  return (
    <footer className="bg-fq-ink text-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Image src="/images/finquanta_logo.svg" width={150} height={36} alt="Finquanta" className="h-8 w-auto brightness-0 invert" />
            <p className="mt-4 max-w-xs text-sm text-white/60">{t('auth', 'shellTagline')}</p>
            <ul className="mt-6 flex gap-2">
              {SOCIAL_LINKS.map(({ name, href, Icon }) => (
                <li key={name}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={name}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:bg-white hover:text-fq-ink"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <Column title={t('footer', 'product')}>
            <li><button type="button" onClick={() => goTo('brain')} className={linkClass}>{t('nav', 'companyBrain')}</button></li>
            <li><button type="button" onClick={() => goTo('compare')} className={linkClass}>{t('nav', 'compare')}</button></li>
            <li><Link href="/pricing" className={linkClass}>{t('nav', 'pricing')}</Link></li>
            <li><Link href="/demo" className={linkClass}>{t('nav', 'tryTheDemo')}</Link></li>
          </Column>

          <Column title={t('footer', 'company')}>
            <li><Link href="/blog" className={linkClass}>{t('nav', 'blog')}</Link></li>
            <li><button type="button" onClick={() => goTo('newsletter')} className={linkClass}>{t('nav', 'newsletter')}</button></li>
            <li><button type="button" onClick={onContactClick} className={linkClass}>{t('footer', 'contactUs')}</button></li>
          </Column>

          <Column title={t('footer', 'legal')}>
            <li><Link href="/terms" className={linkClass}>{t('footer', 'termsOfService')}</Link></li>
            <li><Link href="/privacy" className={linkClass}>{t('footer', 'privacyNotice')}</Link></li>
            <li><Link href="/ai-risk-disclosure" className={linkClass}>{t('footer', 'aiRiskDisclosure')}</Link></li>
          </Column>
        </div>

        <p className="mt-12 border-t border-white/10 pt-6 text-xs text-white/45">
          {t('footer', 'rights').replace('{year}', String(new Date().getFullYear()))}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
