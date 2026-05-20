export interface StatsCardData {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  period: string;
  description: string;
  icon?: string;
}

export interface MonthlyTrend {
  month: string;
  income: number;
  expenses: number;
  profit: number;
  transactions: number;
}

export interface CategoryData {
  name: string;
  value: number;
  percentage: number;
  color: string;
  change?: number;
}

export interface PerformanceMetric {
  name: string;
  value: string;
  target: string;
  achievement: number;
  status: 'excellent' | 'good' | 'average' | 'poor';
}

export interface StatisticsTableData {
  id: number;
  period: string;
  income: number;
  expenses: number;
  profit: number;
  transactions: number;
  avgTransaction: number;
  growthRate: number;
}

export interface StatisticsOverview {
  overviewCards: StatsCardData[];
  financialTrends: MonthlyTrend[];
  incomeSources: CategoryData[];
  expenseCategories: CategoryData[];
  performanceMetrics: PerformanceMetric[];
  tableData: StatisticsTableData[];
  period: string;
}
