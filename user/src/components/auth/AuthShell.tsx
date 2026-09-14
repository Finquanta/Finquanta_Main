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
 * Left panel (`lg` and up only): the dark brand field with the wordmark,
 * tagline and three slowly drifting green blobs. Hidden on small screens, where
 * the form needs the whole width.
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
      <aside className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-fq-dark lg:flex">
        <AuthBlobs />
        <div className="relative z-10 flex max-w-md flex-col items-center px-10 text-center">
          <Image
            src="/images/finquanta_logo.svg"
            width={220}
            height={52}
            alt="Finquanta"
            // The source SVG is brand green; brightness-0 + invert renders it
            // pure white on the dark field while staying a crisp vector.
            className="h-auto w-52 brightness-0 invert"
            priority
          />
          <p className="mt-7 text-2xl font-medium leading-snug text-white/85">
            {t("auth", "shellTagline")}
          </p>
        </div>
      </aside>

      {/* Scrolls, and centres with `my-auto` rather than `justify-center`: the
          sign-up form is taller than a short viewport, and a centred flex child
          that overflows gets clipped at the TOP with no way to scroll back up.
          `my-auto` centres when there's room and yields to scrolling when not. */}
      <main className="flex w-full flex-col items-center overflow-y-auto px-6 py-10 lg:w-1/2 lg:px-12">
        <div className={`my-auto w-full ${wide ? "max-w-[420px]" : "max-w-[360px]"}`}>
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * Three heavily blurred radial gradients, each on its own loop length (13s,
 * 17s, 20s) and path, so the pattern never visibly repeats even though each
 * blob does. Transform-only animation: compositor work, no JavaScript, no
 * canvas. Stops entirely for people who ask for reduced motion.
 */
function AuthBlobs() {
  const blob =
    "absolute rounded-full blur-3xl will-change-transform motion-reduce:animate-none";
  return (
    <div aria-hidden="true" data-testid="auth-blobs" className="pointer-events-none absolute inset-0">
      <div
        className={`${blob} -left-24 top-[8%] h-[440px] w-[440px] animate-blob-drift-1`}
        style={{ background: "radial-gradient(circle, rgba(58,213,66,0.45) 0%, rgba(58,213,66,0) 70%)" }}
      />
      <div
        className={`${blob} -right-32 top-[38%] h-[520px] w-[520px] animate-blob-drift-2`}
        style={{ background: "radial-gradient(circle, rgba(58,213,66,0.30) 0%, rgba(58,213,66,0) 70%)" }}
      />
      <div
        className={`${blob} bottom-[-120px] left-[22%] h-[380px] w-[380px] animate-blob-drift-3`}
        style={{ background: "radial-gradient(circle, rgba(58,213,66,0.35) 0%, rgba(58,213,66,0) 70%)" }}
      />
    </div>
  );
}
