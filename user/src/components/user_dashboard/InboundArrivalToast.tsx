"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mail, X } from "lucide-react";
import { useTheme } from "@/hooks/context/ThemeContext";
import { themeClasses } from "@/lib/theme";
import { getPendingFromEmail } from "@/lib/api/inbound";
import { DocumentCapture } from "@/lib/api/capture";

/**
 * "A document arrived by email."
 *
 * Email is the one way into the books that happens while nobody is looking.
 * A photograph or an upload ends in a review popup you are already staring at;
 * a forwarded invoice lands silently and waits, and without this the only way
 * to discover it is to think to visit /inbox.
 *
 * NOT the app's own toast (`ui.toast`), even though one exists and works: it
 * takes a message string and nothing else. The entire point of this notice is
 * the link — telling somebody a document arrived and leaving them to find it
 * is most of a notification and none of the use.
 *
 * Polling rather than a socket. There is no websocket client in this app, the
 * arrival is not time-critical, and a request a minute on a visible tab is a
 * smaller thing to own than a connection that has to survive Render sleeping.
 */

const POLL_MS = 45_000;
const SEEN_KEY = "inboundAnnouncedV1";
/** Enough ids to cover a busy day; trimmed so the entry cannot grow forever. */
const SEEN_CAP = 200;

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-SEEN_CAP)));
  } catch { /* a full or blocked store must not break the dashboard */ }
}

export default function InboundArrivalToast() {
  const { theme } = useTheme();
  const c = themeClasses(theme === "dark");
  const [fresh, setFresh] = useState<DocumentCapture[]>([]);
  /** Whether we have established a baseline yet, this page load. */
  const started = useRef(false);

  const check = useCallback(async () => {
    // Nothing is gained by polling a tab nobody is looking at, and Render's
    // free tier does not need the traffic.
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    let pending: DocumentCapture[];
    try {
      pending = await getPendingFromEmail();
    } catch {
      return; // Not signed in yet, or the server is waking. Try again later.
    }

    const seen = readSeen();
    const unseen = pending.filter((p) => !seen.includes(p.id));

    /**
     * The FIRST poll only records what is already there.
     *
     * Otherwise opening the dashboard would announce everything forwarded last
     * week as though it had just landed — which teaches people to ignore this.
     */
    if (!started.current) {
      started.current = true;
      if (unseen.length) writeSeen([...seen, ...unseen.map((p) => p.id)]);
      return;
    }

    if (!unseen.length) return;
    writeSeen([...seen, ...unseen.map((p) => p.id)]);
    setFresh((prev) => [...prev, ...unseen]);
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, POLL_MS);
    // Coming back to the tab is exactly when somebody wants to know.
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  if (!fresh.length) return null;

  const latest = fresh[fresh.length - 1]!;
  const vendor = latest.extractedFields.vendor?.trim();
  const total = latest.extractedFields.total;
  const currency = latest.extractedFields.currency ?? "";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[85] w-[min(22rem,calc(100vw-2rem))]"
    >
      <div className={`rounded-xl border shadow-2xl p-4 ${c.surface} ${c.line}`}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40">
            <Mail className="h-4 w-4 text-purple-600" />
          </span>

          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold ${c.heading}`}>
              {fresh.length === 1
                ? "A document arrived by email"
                : `${fresh.length} documents arrived by email`}
            </p>
            <p className={`mt-0.5 text-xs truncate ${c.body}`}>
              {vendor || latest.originalFilename || "Ready to review"}
              {total != null ? ` · ${`${currency} ${total}`.trim()}` : ""}
            </p>
            <p className={`mt-1 text-[11px] ${c.muted}`}>
              Nothing is in your books until you check it.
            </p>

            <Link
              href="/inbox"
              onClick={() => setFresh([])}
              className="mt-2 inline-block rounded-lg bg-purple-500 hover:bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Review it
            </Link>
          </div>

          <button
            onClick={() => setFresh([])}
            aria-label="Dismiss"
            className={`flex-shrink-0 ${c.quietControl}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
