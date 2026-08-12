/**
 * Whether the floating Finna widget is shown.
 *
 * A UI preference, so it lives in localStorage rather than costing a round trip
 * — but the nav bar and the widget are in different React trees with no shared
 * provider between them, so a plain write wouldn't reach the widget until the
 * next navigation. The custom event closes that gap: the toggle writes, the
 * widget hears it, and the change is immediate.
 *
 * Defaults to VISIBLE. Someone who has never touched the toggle should see
 * Finna, and an unreadable localStorage (private mode, disabled storage) must
 * fail towards the assistant existing rather than silently hiding it.
 */

const KEY = "finna_hidden";
export const FINNA_VISIBILITY_EVENT = "finna:visibility";

export function isFinnaHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setFinnaHidden(hidden: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (hidden) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // Preference lost, but the toggle below still takes effect for this tab.
  }
  window.dispatchEvent(new CustomEvent(FINNA_VISIBILITY_EVENT, { detail: { hidden } }));
}
