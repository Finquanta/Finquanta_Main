/**
 * One colour per plan, used everywhere a plan is named.
 *
 * Defined once because the admin panel and the business switcher show the same
 * six labels, and two copies of a palette drift the moment one is edited. The
 * server decides WHICH tone a workspace gets (`planBadgeFor`); this file only
 * decides what each tone looks like.
 *
 * Corporate is white on purpose, which needs a border in light mode — white on
 * a white table is an invisible badge.
 */

export type PlanTone =
  | 'freemium' | 'entrepreneur' | 'business' | 'corporate'
  | 'grandfathered' | 'trial';

export interface ToneColors {
  bg: string;
  /** Foreground for text sitting ON `bg` — i.e. inside a filled pill. */
  fg: string;
  border: string;
  /**
   * Foreground for the label rendered as PLAIN TEXT on the page background.
   *
   * Usually the same as `fg`, and different for Corporate: its pill is a solid
   * white chip with dark text, but that same dark text on a dark page is
   * invisible. Separating the two is what lets one palette serve both.
   */
  text: string;
}

const LIGHT: Record<PlanTone, ToneColors> = {
  freemium: { bg: '#dcfce7', fg: '#15803d', border: 'transparent', text: '#15803d' },
  entrepreneur: { bg: '#dbeafe', fg: '#1d4ed8', border: 'transparent', text: '#1d4ed8' },
  business: { bg: '#fee2e2', fg: '#b91c1c', border: 'transparent', text: '#b91c1c' },
  corporate: { bg: '#ffffff', fg: '#374151', border: '#d1d5db', text: '#374151' },
  grandfathered: { bg: '#f3e8ff', fg: '#7e22ce', border: 'transparent', text: '#7e22ce' },
  trial: { bg: '#ffedd5', fg: '#c2410c', border: 'transparent', text: '#c2410c' },
};

const DARK: Record<PlanTone, ToneColors> = {
  freemium: { bg: 'rgba(34,197,94,.16)', fg: '#4ade80', border: 'transparent', text: '#4ade80' },
  entrepreneur: { bg: 'rgba(59,130,246,.16)', fg: '#60a5fa', border: 'transparent', text: '#60a5fa' },
  business: { bg: 'rgba(239,68,68,.16)', fg: '#f87171', border: 'transparent', text: '#f87171' },
  // The pill stays a solid white chip with dark text; the plain-text form goes
  // white, because near-black on a dark page cannot be read at all.
  corporate: { bg: '#f8fafc', fg: '#0f172a', border: 'transparent', text: '#f8fafc' },
  grandfathered: { bg: 'rgba(168,85,247,.18)', fg: '#c084fc', border: 'transparent', text: '#c084fc' },
  trial: { bg: 'rgba(249,115,22,.18)', fg: '#fb923c', border: 'transparent', text: '#fb923c' },
};

const FALLBACK_LIGHT: ToneColors = { bg: '#f3f4f6', fg: '#6b7280', border: 'transparent', text: '#6b7280' };
const FALLBACK_DARK: ToneColors = { bg: '#334155', fg: '#cbd5e1', border: 'transparent', text: '#cbd5e1' };

/** Colours for a tone. Unknown tones fall back to grey rather than crashing. */
export function planTone(tone: string | undefined, isDark: boolean): ToneColors {
  const table = isDark ? DARK : LIGHT;
  return table[(tone ?? '') as PlanTone] ?? (isDark ? FALLBACK_DARK : FALLBACK_LIGHT);
}
