"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import HamburgerMenu from "./ui/HamburgerMenu";
import LanguagePill from "./LanguagePill";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { useSectionLink } from "@/hooks/useSectionLink";
import { BetaBadge } from "./user_dashboard/BetaChip";

/**
 * The marketing nav: a floating pill with the F mark, the section links, a
 * language pill, Log in and a green Get started.
 *
 * Below md it is the mark and a menu button; the links, language and Log in
 * move into HamburgerMenu. Features, Company Brain and Pricing are homepage
 * sections, so on any other marketing page they open the homepage at that
 * section (see useSectionLink).
 */
export function NavBarComponent() {
  const { t } = useLanguage();
  const goTo = useSectionLink();

  const sections = [
    { id: "features", label: t("nav", "features") },
    { id: "brain", label: t("nav", "companyBrain") },
    { id: "pricing", label: t("nav", "pricing") },
  ];
  const linkClass = "rounded-lg px-3 py-1.5 text-sm text-fq-ink/70 transition-colors hover:text-fq-ink";

  return (
    <header
      className="fixed inset-x-0 z-50 px-3"
      // Not a fixed `top`: the maintenance banner is fixed above this and
      // publishes its height. Without the offset the nav covers the banner and
      // an admin turning the notice on sees nothing happen.
      style={{ top: "calc(var(--maintenance-h, 0px) + 0.75rem)" }}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 rounded-2xl border border-fq-ink/10 bg-white/80 pl-2 pr-2 shadow-[0_10px_30px_-15px_rgba(15,18,16,0.25)] backdrop-blur-md"
      >
        <div className="flex items-center gap-1">
          <Link href="/home" aria-label="Finquanta" className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-fq-card-alt">
            <Image src="/favicon.svg" width={28} height={29} alt="" className="h-7 w-auto" priority />
          </Link>
          {/* The marketing site has no dark mode. */}
          <BetaBadge isDark={false} />
        </div>

        <div className="hidden items-center md:flex">
          {sections.map((section) => (
            <button key={section.id} type="button" onClick={() => goTo(section.id)} className={linkClass}>
              {section.label}
            </button>
          ))}
          <Link href="/blog" className={linkClass}>{t("nav", "blog")}</Link>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <LanguagePill />
          <Link href="/login" className="px-2 text-sm font-medium text-fq-ink/80 transition-colors hover:text-fq-ink">
            {t("nav", "logIn")}
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-fq-green px-4 text-sm font-semibold text-fq-dark transition-colors hover:bg-fq-green/90"
          >
            {t("nav", "getStarted")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="md:hidden">
          <HamburgerMenu />
        </div>
      </nav>
    </header>
  );
}
