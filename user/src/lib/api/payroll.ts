import { apiFetch } from './client';

export async function getPayrollOverview(): Promise<any> {
  return apiFetch<any>('/v1/payroll/overview');
}
