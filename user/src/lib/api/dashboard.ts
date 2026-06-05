import { apiFetch } from './client';

export interface DashboardOverviewResponse {
  summaryCards: {
    title: string;
    amount: number;
  }[];
  totalFinancesData: {
    year: string;
    months: string[];
    highlightValue: string;
  };
  totalSavingsData: {
    period: string;
    weeklyData: { day: string; amount: number }[];
  };
  totalExpensesData: {
    period: string;
    totalAmount: number;
    segments: { name: string; amount: number; color: string; percentage: number }[];
  };
  goalsData: {
    period: string;
    goals: { id: string; name: string; current: number; target: number; color: string }[];
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
  }[];
}

export async function getDashboardOverview(): Promise<DashboardOverviewResponse> {
  return apiFetch<DashboardOverviewResponse>('/v1/dashboard/overview');
}
