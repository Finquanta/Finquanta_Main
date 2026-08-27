"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Smartphone, X } from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import { useTheme } from "@/hooks/context/ThemeContext";
import {
  DocumentCapture, HandoffSession, cancelHandoff, createHandoff, pollHandoff,
} from "@/lib/api/capture";
import { PaymentRequiredError } from "@/lib/api/client";

/**
 * "Use my phone" — the desktop half of the QR handoff.
 *
 * Shows a QR code, then waits. When the phone that scanned it sends a photo,
 * the capture arrives HERE, over this tab's authenticated session, and opens
 * the ordinary review popup. The phone never sees what was read.
 *
 * Polling rather than a realtime service: the wait is seconds, this tab already
 * knows its own session id, and a pub/sub vendor for a ten-minute session that
 * ends in one message would be infrastructure bought for nothing.
 */

const POLL_MS = 2000;

interface Props {
  open: boolean;
  onClose: () => void;
  /** The phone's photo arrived — hand it to the review popup. */
  onCapture: (capture: DocumentCapture) => void;
  onOutOfScans: (error: PaymentRequiredError) => void;
}

export default function CaptureHandoffDialog({ open, onClose, onCapture, onOutOfScans }: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [session, setSession] = useState<HandoffSession | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Held in a ref as well as state so cleanup can cancel the session without
  // taking `session` as a dependency and tearing the whole effect down on
  // every render.
  const sessionRef = useRef<HandoffSession | null>(null);
  const doneRef = useRef(false);

  const close = useCallback(() => {
    // Kill the token on the way out. A QR code left live on a screen its owner
    // has walked away from is a credential lying in the open.
    const current = sessionRef.current;
    if (current && !doneRef.current) cancelHandoff(current.id).catch(() => { /* best effort */ });
    sessionRef.current = null;
    setSession(null);
    setQr(null);
    setError(null);
    onClose();
  }, [onClose]);

  /**
   * The callbacks and the translator, held in refs.
   *
   * THIS IS LOAD-BEARING, and its absence was a real bug: the effect below
   * MINTS A SESSION, so anything in its dependency array that changes identity
   * mints another one. `onClose`, `onOutOfScans` and `onCapture` are inline
   * arrow functions in the parent, so every render of the dashboard produced
   * new ones — and `t` is rebuilt whenever the language context renders. The
   * result was a fresh QR code every few seconds, with a countdown that read
   * "9:58" because each new code genuinely was that young.
   *
   * Refs give the effect the current callbacks without making it depend on
   * their identity, so the session outlives its parent's re-renders.
   */
  const handlers = useRef({ onClose, onOutOfScans, onCapture, t });
  handlers.current = { onClose, onOutOfScans, onCapture, t };

  /** Open a session and draw its QR code. Runs on OPEN, and on nothing else. */
  useEffect(() => {
    if (!open) return;

    let alive = true;
    doneRef.current = false;
    setError(null);
    setQr(null);

    createHandoff()
      .then(async (created) => {
        if (!alive) {
          // Unmounted while the request was in flight — do not leave a live
          // token behind for a dialog that no longer exists.
          cancelHandoff(created.id).catch(() => {});
          return;
        }
        sessionRef.current = created;
        setSession(created);

        // The URL the phone will open. Built from this tab's own origin, so it
        // is correct on localhost, on a preview deploy and in production
        // without an environment variable to keep in step.
        const url = `${window.location.origin}/capture/${created.token}`;
        const dataUrl = await QRCode.toDataURL(url, {
          width: 260,
          margin: 1,
          errorCorrectionLevel: "M",
          // Fixed black-on-white regardless of theme: a dark-mode QR code with
          // a light foreground is the classic way to make one unscannable.
          color: { dark: "#000000", light: "#ffffff" },
        });
        if (alive) setQr(dataUrl);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof PaymentRequiredError) {
          handlers.current.onOutOfScans(e);
          handlers.current.onClose();
          return;
        }
        setError(e instanceof Error ? e.message : handlers.current.t("dashboard", "genericError"));
      });

    return () => { alive = false; };
  }, [open]);

  /** Wait for the phone. Keyed on the session ID, not the session object, so a
   * new object with the same id cannot restart the poll. */
  const sessionId = session?.id ?? null;
  useEffect(() => {
    if (!open || !sessionId) return;

    let alive = true;
    const timer = setInterval(async () => {
      try {
        const result = await pollHandoff(sessionId);
        if (!alive) return;

        if (result.status === "uploaded" && result.capture) {
          // Mark done BEFORE closing, so cleanup does not cancel a session that
          // has already delivered — that would be a harmless no-op today, but
          // it would also log a failure for a flow that worked.
          doneRef.current = true;
          clearInterval(timer);
          handlers.current.onCapture(result.capture);
          return;
        }

        if (result.status === "expired") {
          clearInterval(timer);
          setError(handlers.current.t("dashboard", "captureHandoffExpired"));
        }
      } catch {
        /* A dropped poll is not worth surfacing; the next one is 2s away. */
      }
    }, POLL_MS);

    return () => { alive = false; clearInterval(timer); };
  }, [open, sessionId]);

  /** The countdown, so an expired code is visibly expired rather than silently
   * broken when the phone finally gets around to scanning it. */
  const expiresAt = session?.expiresAt ?? null;
  useEffect(() => {
    if (!open || !expiresAt) { setSecondsLeft(null); return; }
    const expiry = new Date(expiresAt).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.round((expiry - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [open, expiresAt]);

  if (!open) return null;

  const mmss =
    secondsLeft == null
      ? null
      : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="capture-handoff-title"
      onClick={close}
    >
      <div
        className={`w-full max-w-sm rounded-xl shadow-xl ${isDark ? "bg-gray-800" : "bg-white"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-start justify-between p-5 border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-purple-500" />
            <h2 id="capture-handoff-title" className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              {t("dashboard", "captureHandoffTitle")}
            </h2>
          </div>
          <button
            onClick={close}
            aria-label={t("dashboard", "captureHandoffClose")}
            className={isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center text-center">
          <p className={`text-sm mb-4 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
            {t("dashboard", "captureHandoffBody")}
          </p>

          {error ? (
            <p className="text-sm text-red-500 py-8">{error}</p>
          ) : qr ? (
            <>
              {/* Always on white, never on the themed surface — the quiet zone
                  around a QR code is part of the code. */}
              <div className="rounded-lg bg-white p-3 border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt={t("dashboard", "captureHandoffTitle")} width={260} height={260} />
              </div>
              {mmss && (
                <p className={`mt-3 text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {t("dashboard", "captureHandoffExpiresIn").replace("{time}", mmss)}
                </p>
              )}
              <p className={`mt-4 flex items-center justify-center gap-2 text-sm font-medium ${isDark ? "text-purple-400" : "text-purple-600"}`}>
                <span className="inline-block h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                {t("dashboard", "captureHandoffWaiting")}
              </p>
            </>
          ) : (
            <div className="h-[286px] flex items-center justify-center">
              <span className="inline-block h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
