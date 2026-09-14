"use client";

import Image from "next/image";
import { ReactNode } from "react";
import { useLanguage } from "@/hooks/context/LanguageContext";

/**
 * The layout every customer auth screen shares: log in, sign up, forgot
 * password (a view inside log in), reset password and verify email.
 *
 * One component so moving between them never changes the page — only the form
 * on the right. The admin panel's own login deliberately does not use this.
 *
 * Left panel (`md` and up): the dark brand field with the wordmark, tagline and
 * three slowly drifting green blobs. It starts at `md` rather than `lg` so a
 * half-screen browser window still gets it; below `md` the form needs the
 * whole width. Between `md` and `lg` the form column takes 3/5, because sign up
 * is too wide for half of a 768px window.
 */
export default function AuthShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  /** Sign up has a two-column name row and a password-rule grid; 360px is too tight for it. */
  wide?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div
      className="flex w-full bg-white"
      // Shortened by the maintenance banner's height and pushed below it.
      // 0px when there is no banner. See components/MaintenanceBanner.tsx.
      style={{
        marginTop: "var(--maintenance-h, 0px)",
        height: "calc(100vh - var(--maintenance-h, 0px))",
      }}
    >
      <aside className="relative hidden items-center justify-center overflow-hidden bg-fq-dark md:flex md:w-2/5 lg:w-1/2">
        <AuthBlobs />
        <div className="relative z-10 flex max-w-md flex-col items-center px-8 text-center lg:px-10">
          <Image
            src="/images/finquanta_logo.svg"
            width={220}
            height={52}
            alt="Finquanta"
            // The source SVG is brand green; brightness-0 + invert renders it
            // pure white on the dark field while staying a crisp vector.
            className="h-auto w-44 brightness-0 invert lg:w-52"
            priority
          />
          <p className="mt-7 text-xl font-medium leading-snug text-white/85 lg:text-2xl">
            {t("auth", "shellTagline")}
          </p>
        </div>
      </aside>

      {/* Scrolls, and centres with `my-auto` rather than `justify-center`: the
          sign-up form is taller than a short viewport, and a centred flex child
          that overflows gets clipped at the TOP with no way to scroll back up.
          `my-auto` centres when there's room and yields to scrolling when not. */}
      <main className="flex w-full flex-col items-center overflow-y-auto px-6 py-10 md:w-3/5 md:px-10 lg:w-1/2 lg:px-12">
        <div className={`my-auto w-full ${wide ? "max-w-[420px]" : "max-w-[360px]"}`}>
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * Three soft radial gradients, each on its own loop length (13s, 17s, 20s) and
 * path, so the pattern never visibly repeats even though each blob does.
 *
 * The softness is in the gradient's own stops, not a CSS `blur()`. A 64px blur
 * on three large moving layers made the browser redraw that blur every frame —
 * heavy on a slow machine, and it competed with the Turnstile widget beside it.
 * Transform-only animation otherwise: no JavaScript, no canvas. Stops entirely
 * for people who ask for reduced motion.
 */
function AuthBlobs() {
  const blob = "absolute rounded-full will-change-transform motion-reduce:animate-none";
  const glow = (peak: number) =>
    `radial-gradient(circle, rgba(58,213,66,${peak}) 0%, rgba(58,213,66,${peak * 0.55}) 30%, rgba(58,213,66,${peak * 0.2}) 52%, rgba(58,213,66,0) 70%)`;
  return (
    <div aria-hidden="true" data-testid="auth-blobs" className="pointer-events-none absolute inset-0">
      <div
        className={`${blob} -left-32 top-[4%] h-[560px] w-[560px] animate-blob-drift-1`}
        style={{ background: glow(0.4) }}
      />
      <div
        className={`${blob} -right-40 top-[34%] h-[640px] w-[640px] animate-blob-drift-2`}
        style={{ background: glow(0.28) }}
      />
      <div
        className={`${blob} bottom-[-180px] left-[18%] h-[500px] w-[500px] animate-blob-drift-3`}
        style={{ background: glow(0.32) }}
      />
    </div>
  );
}
