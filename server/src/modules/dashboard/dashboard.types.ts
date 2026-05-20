export interface SummaryCardData {
  title: 'Current balance' | 'Expenses' | 'Income';
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

export interface DashboardGoal {
  id: string;
  name: string;
  current: number;
  target: number;
  color: string;
}

export interface LatestTransaction {
  id: string;
  date: string;
  type: string;
  detail: string;
  invoice: string | null;
  price: number;
  amount: number;
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
