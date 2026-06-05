import { apiFetch } from './client';

export async function listBusinessPlans(): Promise<any[]> {
  return apiFetch<any[]>('/v1/business-plans');
}

export async function getBusinessPlanStats(): Promise<any> {
  return apiFetch<any>('/v1/business-plans/stats');
}

export async function getBusinessPlanMarketData(): Promise<any> {
  return apiFetch<any>('/v1/business-plans/market-data');
}
