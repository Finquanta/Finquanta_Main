/**
 * The version numbers shown in the sidebars.
 *
 * These live here, in one file, because the dashboard number was previously
 * hardcoded in TWO places — `DashboardSidebar.tsx` and the inline copy of that
 * sidebar still inside `app/(user_dashbord)/dashboard/page.tsx` — and the two
 * had to be edited together or the version a user saw depended on which page
 * they happened to be on. That is a bug waiting on somebody's memory. Now it is
 * one constant and the duplication cannot drift.
 *
 * (The inline sidebar copy itself is still an open cleanup. Removing it is a
 * larger job than this; this at least makes the version safe in the meantime.)
 *
 * THE TWO NUMBERS ARE DELIBERATELY DIFFERENT and track separately. They used to
 * move in lockstep until 2026-08-11, when the dashboard was bumped on its own.
 * Do not "fix" them into agreement.
 */

/**
 * User dashboard.
 *
 * 2.1.0 (2026-08-25) — a minor bump, not a major one. Document Capture arrived
 * as a genuinely new way to get data in: photograph or upload a bill and have
 * it read into a pre-filled entry, with the QR handoff letting a desktop user
 * photograph paper with their phone. Real capability, but it feeds the same
 * books through the same review-then-confirm path rather than changing what the
 * product is — which is the bar 2.0.0 was held to when the Company Brain
 * arrived as a new pillar.
 */
export const DASHBOARD_VERSION = '2.1.0';

/**
 * Admin panel.
 *
 * 1.4.0 (2026-08-25) — trials became adjustable in both directions from the
 * panel (previously the only way to shorten one was editing the database by
 * hand), alongside the workspace and member usage views growing real
 * subscription and document-scan figures to look at.
 */
export const ADMIN_VERSION = '1.4.0';
