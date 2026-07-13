"use client";

import { useEffect, useState } from "react";
import { getMaintenance } from "@/lib/api/site";

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
 */
const DISMISS_KEY = "maintenanceNoticeDismissedV1";

export default function MaintenanceBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let alive = true;
    getMaintenance()
      .then((m) => {
        if (!alive || !m.enabled) return;
        // The dismissal is per message: if an admin changes the notice, someone
        // who dismissed the last one still sees the new one.
        const dismissed = localStorage.getItem(DISMISS_KEY);
        if (dismissed === m.message) return;
        setMessage(m.message);
      })
      .catch(() => { /* no banner rather than a broken page */ });

    return () => { alive = false; };
  }, []);

  const dismiss = () => {
    if (message) localStorage.setItem(DISMISS_KEY, message);
    setMessage(null);
  };

  if (!message) return null;

  return (
    <div
      role="status"
      style={{
        position: "relative",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        flexWrap: "wrap",
        background: "#fef3c7",
        color: "#78350f",
        borderBottom: "1px solid #fcd34d",
        padding: "10px 16px",
        fontSize: 13,
        fontFamily: "sans-serif",
        lineHeight: 1.4,
        textAlign: "center",
      }}
    >
      <span>{message}</span>
      <button
        onClick={dismiss}
        style={{
          flexShrink: 0,
          background: "transparent",
          border: "1px solid #d97706",
          color: "#92400e",
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
