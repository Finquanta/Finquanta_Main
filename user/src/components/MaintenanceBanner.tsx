"use client";

import { useEffect, useState } from "react";

/**
 * Site-wide "under maintenance" notice. The app stays fully usable — this only
 * sets expectations while we build the new financial modules.
 *
 * To take it down later, flip ENABLED to false (single line, nothing else to undo).
 */
const ENABLED = true;
const DISMISS_KEY = "maintenanceNoticeDismissedV1";

export default function MaintenanceBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!ENABLED) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

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
      <span>
        <strong>🚧 Finquanta is under active maintenance.</strong>{" "}
        We&apos;re building new bookkeeping, accounting and invoicing features. The site is still fully usable in the meantime — your data is safe.
      </span>
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
