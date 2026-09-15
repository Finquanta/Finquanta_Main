"use client"

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { useLanguage, LANGUAGE_OPTIONS } from "@/hooks/context/LanguageContext";
import { useSectionLink } from "@/hooks/useSectionLink";

/**
 * The marketing nav below md: everything the desktop pill holds — the section
 * links, Blog, the language list, Log in and Get started — in a panel that
 * slides in from the right.
 *
 * The links used to point at /features, /faq, /newsletter and /community,
 * routes that never existed; they now go to the homepage sections the desktop
 * nav scrolls to.
 */
const HamburgerMenu = () => {
  const { t, language, setLanguage } = useLanguage();
  const goTo = useSectionLink();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Open with a transition: wait a tick so the panel starts off-screen.
  useEffect(() => {
    if (open && !closing) {
      const timer = setTimeout(() => setMenuVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setMenuVisible(false);
    }
  }, [open, closing]);

  // Close on a click outside the panel.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        handleClose();
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [open]);

  const handleClose = () => {
    setMenuVisible(false);
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 300); // matches duration-300
  };

  const openSection = (id: string) => {
    handleClose();
    goTo(id);
  };

  const sections = [
    { id: "features", label: t("nav", "features") },
    { id: "brain", label: t("nav", "companyBrain") },
    { id: "pricing", label: t("nav", "pricing") },
  ];
  const rowClass = "block w-full py-2 text-left text-lg font-medium text-fq-ink hover:text-[#1E9E2A]";

  const portalContent = (
    <>
      <div
        className="fixed inset-0 z-[9999] bg-fq-dark/40 transition-opacity duration-300"
        aria-hidden="true"
        onClick={handleClose}
      />
      <nav
        ref={menuRef}
        className={`fixed right-0 top-0 z-[9999] h-[100dvh] w-72 max-w-[85vw] transform overflow-x-hidden bg-white shadow-lg transition-transform duration-300 ease-in-out motion-reduce:transition-none ${menuVisible ? "translate-x-0" : "translate-x-full"}`}
        tabIndex={-1}
      >
        <button
          aria-label={t("nav", "closeMenu")}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl text-fq-ink hover:bg-fq-card-alt"
          onClick={handleClose}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex h-full flex-col overflow-y-auto px-5 pb-8 pt-16">
          {/* Account actions at the top, where a thumb reaches first. */}
          <div className="flex flex-col gap-2">
            <Link
              href="/signup"
              onClick={handleClose}
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-fq-green text-base font-semibold text-fq-dark"
            >
              {t("nav", "getStarted")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/login"
              onClick={handleClose}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-fq-ink/15 text-base font-semibold text-fq-ink"
            >
              {t("nav", "logIn")}
            </Link>
          </div>

          <div className="my-5 border-t border-fq-ink/10" />

          <ul className="flex flex-col">
            {sections.map((section) => (
              <li key={section.id}>
                <button type="button" onClick={() => openSection(section.id)} className={rowClass}>
                  {section.label}
                </button>
              </li>
            ))}
            <li><Link href="/blog" onClick={handleClose} className={rowClass}>{t("nav", "blog")}</Link></li>
            <li><Link href="/demo" onClick={handleClose} className={rowClass}>{t("nav", "tryTheDemo")}</Link></li>
          </ul>

          <div className="my-5 border-t border-fq-ink/10" />

          <p className="text-xs font-semibold uppercase tracking-wide text-fq-slate">{t("nav", "language")}</p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {LANGUAGE_OPTIONS.map((option) => (
              <li key={option.code}>
                <button
                  type="button"
                  lang={option.code}
                  aria-current={option.code === language ? "true" : undefined}
                  onClick={() => setLanguage(option.code)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${option.code === language ? "bg-fq-ink font-semibold text-white" : "bg-fq-card-alt text-fq-ink"}`}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );

  return (
    <div className="relative">
      <button
        aria-label={t("nav", "openMenu")}
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-fq-ink hover:bg-fq-card-alt md:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>
      {mounted && (open || closing) && typeof window !== "undefined"
        ? createPortal(portalContent, document.body)
        : null}
    </div>
  );
};

export default HamburgerMenu;
