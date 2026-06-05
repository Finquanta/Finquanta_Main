import { apiFetch } from './client';

export async function getStatisticsOverview(): Promise<any> {
  return apiFetch<any>('/v1/statistics/overview');
}
