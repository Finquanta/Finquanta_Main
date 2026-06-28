export interface SummaryCardData {
  title: 'Balance' | 'Cashflow' | 'Expense';
  amount: string;
  change: string;
  changeType: 'positive' | 'negative';
  period: string;
  description: string;
}

export interface WeeklyData {
  day: string;
  income: number;
  expense: number;
}

export interface ExpenseSegment {
  name: string;
  percentage: number;
  color: string;
}

export type RevenueRange = 'day' | 'month' | 'year';
export type RevenueMetric = 'revenue' | 'cashflow' | 'expense';

export interface RevenuePoint {
  label: string;   // short axis label, e.g. "Jun 19", "Jan", "2026"
  full: string;    // full label for tooltip, e.g. "Jun 19, 2026"
  value: number;   // revenue (cashflow / income) for the period
}

export interface RevenueSeries {
  range: RevenueRange;
  points: RevenuePoint[];
}

export interface DashboardGoal {
  id: string;
  name: string;
  current: number;
  target: number;
  color: string;
  updatedAt: string;
}

export interface CreateGoalData {
  name: string;
  target: number;
  current?: number;
  color?: string;
  period?: string;
}

export interface UpdateGoalData {
  name?: string;
  target?: number;
  current?: number;
  color?: string;
  period?: string;
}

export interface LatestTransaction {
  id: string;
  date: string;
  type: string;
  name: string;
  detail: string;
  invoice: string | null;
  price: number;
  amount: number;
  recurrence: string;
  hasReceipt: boolean;
}

export interface DashboardOverviewResponse {
  summaryCards: SummaryCardData[];
  totalFinancesData: {
    year: string;
    months: string[];
    highlightValue: string;
  };
  totalSavingsData: {
    period: string;
    weeklyData: WeeklyData[];
  };
  totalExpensesData: {
    period: string;
    totalAmount: number;
    segments: ExpenseSegment[];
  };
  goalsData: {
    period: string;
    goals: DashboardGoal[];
  };
  latestTransactions: LatestTransaction[];
}
