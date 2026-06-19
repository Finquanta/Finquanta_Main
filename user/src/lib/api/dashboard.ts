import { apiFetch } from './client';

export interface DashboardOverviewResponse {
  summaryCards: {
    title: string;
    amount: string;
  }[];
  totalFinancesData: {
    year: string;
    months: string[];
    highlightValue: string;
  };
  totalSavingsData: {
    period: string;
    weeklyData: { day: string; income: number; expense: number }[];
  };
  totalExpensesData: {
    period: string;
    totalAmount: number;
    segments: { name: string; amount: number; color: string; percentage: number }[];
  };
  goalsData: {
    period: string;
    goals: { id: string; name: string; current: number; target: number; color: string; updatedAt: string }[];
  };
  stockMarketData: {
    period: string;
    totalGain: string;
    totalPercentage: string;
    stocks: { name: string; symbol: string; price: number; change: number; isPositive: boolean }[];
  };
  latestTransactions: {
    id: string;
    date: string;
    type: string;
    detail: string;
    price: number;
    amount: number;
    recurrence: string;
    hasReceipt: boolean;
  }[];
}

export async function getDashboardOverview(): Promise<DashboardOverviewResponse> {
  return apiFetch<DashboardOverviewResponse>('/v1/dashboard/overview');
}

export interface GoalInput {
  name: string;
  target: number;
  current?: number;
  color?: string;
}

export interface Goal {
  id: string;
  name: string;
  current: number;
  target: number;
  color: string;
  updatedAt: string;
}

export async function createGoal(data: GoalInput): Promise<Goal> {
  return apiFetch<Goal>('/v1/dashboard/goals', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateGoal(id: string, data: Partial<GoalInput>): Promise<Goal> {
  return apiFetch<Goal>(`/v1/dashboard/goals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteGoal(id: string): Promise<void> {
  await apiFetch(`/v1/dashboard/goals/${id}`, { method: 'DELETE' });
}

export type RevenueRange = 'day' | 'month' | 'year';

export interface RevenuePoint {
  label: string;
  full: string;
  value: number;
}

export async function getRevenue(range: RevenueRange): Promise<{ range: RevenueRange; points: RevenuePoint[] }> {
  return apiFetch<{ range: RevenueRange; points: RevenuePoint[] }>(`/v1/dashboard/revenue?range=${range}`);
}
