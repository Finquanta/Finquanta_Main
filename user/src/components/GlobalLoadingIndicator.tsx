"use client";

import { useEffect, useState } from "react";
import { subscribeLoading } from "@/lib/api/client";

/**
 * Small fixed badge that appears when a backend request is taking a while —
 * mainly Render's free-tier cold start (the first call after the server has
 * been idle). Fast requests never trigger it. Mounted once in the root layout.
 */
export default function GlobalLoadingIndicator() {
  const [active, setActive] = useState(false);

  useEffect(() => subscribeLoading(setActive), []);

  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "rgba(15,23,42,0.92)",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: 10,
        fontSize: 13,
        fontFamily: "sans-serif",
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          border: "2px solid rgba(255,255,255,0.35)",
          borderTopColor: "#fff",
          borderRadius: "50%",
          display: "inline-block",
          animation: "fq-spin 0.7s linear infinite",
        }}
      />
      Pulling data…
      <style>{"@keyframes fq-spin { to { transform: rotate(360deg); } }"}</style>
    </div>
  );
}
