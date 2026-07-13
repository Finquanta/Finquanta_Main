import { apiFetch } from './client';

export type RatioKey = 'liquidity' | 'profitability' | 'debtRisk' | 'cashFlow';

export interface Ratio {
  key: RatioKey;
  name: string;
  label: string;
  value: number | null;
  format: 'ratio' | 'percent';
  score: number;
  trend: number | null;
  explanation: string;
  insight: string;
  note?: string;
}

export interface HealthScore {
  ready: boolean;
  daysOfData: number;
  daysRequired: number;
  score: number | null;
  trend: number | null;
  ratios: Ratio[];
  summary: string;
  periodDays: number;
}

export const getHealthScore = () => apiFetch<HealthScore>('/v1/health-score');

/** How a raw ratio reads to a person: '1.8×' or '12.4%'. */
export function formatRatio(r: Ratio): string {
  if (r.value === null) return '—';
  return r.format === 'percent' ? `${r.value}%` : `${r.value}×`;
}

/** Green / amber / red, by score. Used for both the ring and the sub-scores. */
export function scoreColor(score: number): string {
  if (score >= 70) return '#10b981';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}
