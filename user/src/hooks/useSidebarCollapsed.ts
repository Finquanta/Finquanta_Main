"use client";

import { useEffect, useState } from "react";

/** One key per surface, so collapsing the admin panel leaves the app sidebar alone. */
export const APP_SIDEBAR_KEY = "fq_sidebar_collapsed";
export const ADMIN_SIDEBAR_KEY = "fq_admin_sidebar_collapsed";

/**
 * Whether a sidebar is collapsed to icons, remembered on this device.
 *
 * Read after mount: localStorage doesn't exist during the server render, and
 * reading it into the initial state would mismatch the server HTML. Storage can
 * also throw (private windows, blocked site data), so every access is guarded
 * and the sidebar simply starts expanded.
 *
 * `animate` stays false until someone clicks the toggle, so a sidebar restored
 * as collapsed doesn't visibly shrink on every page load.
 */
export function useSidebarCollapsed(key: string) {
  const [collapsed, setCollapsed] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(key) === "1");
    } catch {
      // Blocked storage: stay expanded.
    }
  }, [key]);

  const toggle = () => {
    const next = !collapsed;
    setAnimate(true);
    setCollapsed(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {
      // Not remembered, but the toggle still works for this visit.
    }
  };

  return { collapsed, toggle, animate };
}
