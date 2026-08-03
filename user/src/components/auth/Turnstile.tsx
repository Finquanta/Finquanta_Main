"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Cloudflare Turnstile widget. Renders a challenge and reports the resulting
 * token via onVerify — the caller sends that token to the backend, which is
 * the ONLY place it's actually checked (see auth.controller.ts checkCaptcha).
 * This widget is a UX gate, not the security boundary.
 *
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY falls back to Cloudflare's published
 * "always passes" test site key outside production, so localhost works with
 * no setup.
 */
const DEV_TEST_SITE_KEY = "1x00000000000000000000AA";
// render=explicit: we call window.turnstile.render() ourselves below. Without
// this, Cloudflare's script ALSO auto-renders into any .cf-turnstile element
// it finds (that class is its own auto-scan marker), racing our explicit
// render into the same container and corrupting the widget.
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

let scriptLoadPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Turnstile"));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export function Turnstile({ onVerify, onExpire }: { onVerify: (token: string) => void; onExpire?: () => void }) {
  const containerId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sitekey =
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      (process.env.NODE_ENV !== "production" ? DEV_TEST_SITE_KEY : "");
    if (!sitekey || !containerRef.current) return;

    loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey,
        callback: onVerify,
        "expired-callback": onExpire,
      });
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id={containerId} ref={containerRef} className="cf-turnstile" />;
}
