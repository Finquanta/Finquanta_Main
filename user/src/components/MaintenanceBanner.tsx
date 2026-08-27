"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMaintenanceShared } from "@/lib/api/site";

/**
 * Site-wide maintenance notice, controlled from the admin panel.
 *
 * This used to be a hardcoded `const ENABLED = true`, which meant putting the
 * notice up (or taking it down) needed a code change and a deploy — the exact
 * wrong shape for something you want to flip the moment something breaks. It now
 * reads a flag an admin owns.
 *
 * If the lookup fails, nothing renders. A settings call must never be able to
 * take the marketing site down with it.
 *
 * WHY IT IS FIXED, AND WHY IT PUBLISHES ITS HEIGHT
 *
 * It used to sit in normal document flow at the top of <body>, and on the
 * marketing site it was invisible: the navbar is `fixed top-0`, which pins it
 * to the top of the VIEWPORT regardless of what is above it in the document, so
 * the navbar simply sat on top of the notice. An admin could turn the banner on
 * and see no change — which is the worst possible failure for the one control
 * you reach for when something is already broken.
 *
 * On the dashboard the opposite went wrong: `DashboardShell` is `h-screen`, so a
 * banner above it pushed a full 100vh of layout down and the bottom of the app
 * ran off the screen.
 *
 * Both are fixed the same way. The banner pins itself to the top, above
 * everything, and publishes its own measured height as `--maintenance-h` on
 * <html>. Anything that needs to get out of the way reads that variable and
 * offsets by it. Measured rather than hardcoded because the message wraps to two
 * or three lines on a phone, and a guessed constant would be wrong there.
 */
const DISMISS_KEY = "maintenanceNoticeDismissedV1";
const HEIGHT_VAR = "--maintenance-h";

export default function MaintenanceBanner() {
  const [notice, setNotice] = useState<{ text: string; upcoming: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const clearHeight = useCallback(() => {
    document.documentElement.style.setProperty(HEIGHT_VAR, "0px");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let alive = true;
    getMaintenanceShared()
      .then((m) => {
        if (!alive) return;

        /**
         * Two different notices, and the difference matters.
         *
         * `upcoming` is a heads-up: maintenance is scheduled but nothing is
         * wrong yet, so it names the time and stays calm. `enabled` means it is
         * happening now. Showing the same sentence for both would train people
         * to ignore the one that is actually true.
         */
        const text = m.upcoming && m.startsAt
          // The heads-up always names the time, then adds whatever the admin
          // wrote for that window — the date is the part they need, and the
          // wording is the part they wrote.
          ? `🗓 Scheduled maintenance on ${new Date(m.startsAt).toLocaleString()}` +
            (m.endsAt ? `, until ${new Date(m.endsAt).toLocaleString()}` : "") +
            ". " +
            (m.scheduledMessage || "Your data is safe and the site stays usable.")
          : m.enabled
            // `message` is already resolved server-side: the manual wording when
            // the switch is on, the scheduled wording when a window is running.
            ? m.message
            : null;
        if (!text) return;

        // The dismissal is per message: if an admin changes the notice — or the
        // heads-up becomes the real thing — someone who hid the last one still
        // sees the new one.
        if (localStorage.getItem(DISMISS_KEY) === text) return;
        setNotice({ text, upcoming: !!m.upcoming && !m.enabled });
      })
      .catch(() => { /* no banner rather than a broken page */ });

    return () => { alive = false; };
  }, []);

  /** Keep `--maintenance-h` in step with what is actually on screen. */
  useEffect(() => {
    const el = ref.current;
    if (!notice || !el) {
      clearHeight();
      return;
    }

    const publish = () => {
      document.documentElement.style.setProperty(HEIGHT_VAR, `${el.offsetHeight}px`);
    };
    publish();

    // The message wraps differently as the window narrows, so the height is not
    // a constant. ResizeObserver is the only thing that catches that reliably —
    // a window resize listener misses a font loading in late.
    const observer = new ResizeObserver(publish);
    observer.observe(el);

    return () => {
      observer.disconnect();
      clearHeight();
    };
  }, [notice, clearHeight]);

  const dismiss = () => {
    if (notice) localStorage.setItem(DISMISS_KEY, notice.text);
    setNotice(null);
    clearHeight();
  };

  if (!notice) return null;

  // Calmer for a heads-up than for the real thing.
  const palette = notice.upcoming
    ? { bg: "#eff6ff", fg: "#1e3a8a", edge: "#bfdbfe", button: "#1d4ed8" }
    : { bg: "#fef3c7", fg: "#78350f", edge: "#fcd34d", button: "#92400e" };

  return (
    <div
      ref={ref}
      role="status"
      style={{
        // Fixed, not relative: see the note above. The z-index sits above the
        // marketing navbar (z-50) and the dashboard's own overlays.
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10001,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        flexWrap: "wrap",
        background: palette.bg,
        color: palette.fg,
        borderBottom: `1px solid ${palette.edge}`,
        padding: "10px 16px",
        fontSize: 13,
        fontFamily: "sans-serif",
        lineHeight: 1.4,
        textAlign: "center",
      }}
    >
      <span>{notice.text}</span>
      <button
        onClick={dismiss}
        style={{
          flexShrink: 0,
          background: "transparent",
          border: `1px solid ${palette.edge}`,
          color: palette.button,
          borderRadius: 6,
          padding: "3px 10px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
