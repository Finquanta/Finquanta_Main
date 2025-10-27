// Mock data for statistics dashboard
// Aggregates and analyzes data from across the Fund Flow AI system

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatPercentage = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

// Type definitions for statistics data
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

export interface StatisticsPageProps {
  overviewCards: StatsCardData[];
  financialTrends: MonthlyTrend[];
  incomeSources: CategoryData[];
  expenseCategories: CategoryData[];
  performanceMetrics: PerformanceMetric[];
  tableData: StatisticsTableData[];
  period: string;
}

// Calculate aggregate statistics from existing data sources
const calculateAggregateStats = () => {
  // Dashboard data
  const dashboardBalance = 2041.78;
  const dashboardExpenses = 1980.56;
  const dashboardIncome = 10000;

  // Bookkeeping data
  const bookkeepingBalance = 128789;
  const bookkeepingIncome = 85000;
  const bookkeepingExpenses = 10000;

  // Payroll data
  const payrollTotal = 46764.14; // previous payroll amount

  // Calculate aggregates
  const totalIncome = dashboardIncome + bookkeepingIncome;
  const totalExpenses = dashboardExpenses + bookkeepingExpenses + payrollTotal;
  const netProfit = totalIncome - totalExpenses;

  return {
    totalIncome,
    totalExpenses,
    netProfit,
    totalTransactions: 50, // Mock total transactions
    avgTransaction: totalIncome / 50
  };
};

const aggregates = calculateAggregateStats();

// Mock data for statistics page
export const statisticsMockData: StatisticsPageProps = {
  overviewCards: [
    {
      title: "Total Revenue",
      value: formatCurrency(aggregates.totalIncome),
      change: "+12.5%",
      changeType: "positive",
      period: "This year",
      description: "Year-over-year revenue growth",
      icon: "revenue"
    },
    {
      title: "Total Expenses",
      value: formatCurrency(aggregates.totalExpenses),
      change: "+8.3%",
      changeType: "negative",
      period: "This year",
      description: "Year-over-year expense change",
      icon: "expenses"
    },
    {
      title: "Net Profit",
      value: formatCurrency(aggregates.netProfit),
      change: "-24.8%",
      changeType: "negative",
      period: "This year",
      description: "Year-over-year profit change",
      icon: "profit"
    },
    {
      title: "Total Transactions",
      value: aggregates.totalTransactions.toString(),
      change: "+18.2%",
      changeType: "positive",
      period: "This year",
      description: "Total transaction volume",
      icon: "transactions"
    },
    {
      title: "Average Transaction",
      value: formatCurrency(aggregates.avgTransaction),
      change: "+5.7%",
      changeType: "positive",
      period: "This year",
      description: "Average transaction value",
      icon: "average"
    },
    {
      title: "Growth Rate",
      value: "15.3%",
      change: "+2.1%",
      changeType: "positive",
      period: "This quarter",
      description: "Quarterly growth rate",
      icon: "growth"
    }
  ],

  financialTrends: [
    { month: "Jan", income: 8500, expenses: 6200, profit: 2300, transactions: 35 },
    { month: "Feb", income: 9200, expenses: 7100, profit: 2100, transactions: 42 },
    { month: "Mar", income: 10100, expenses: 6800, profit: 3300, transactions: 38 },
    { month: "Apr", income: 9800, expenses: 7400, profit: 2400, transactions: 45 },
    { month: "May", income: 11200, expenses: 8900, profit: 2300, transactions: 51 },
    { month: "Jun", income: 12500, expenses: 8200, profit: 4300, transactions: 48 },
    { month: "Jul", income: 10800, expenses: 7600, profit: 3200, transactions: 44 },
    { month: "Aug", income: 11800, expenses: 8100, profit: 3700, transactions: 47 },
    { month: "Sep", income: 13200, expenses: 8800, profit: 4400, transactions: 52 },
    { month: "Oct", income: 12900, expenses: 9200, profit: 3700, transactions: 49 },
    { month: "Nov", income: 14100, expenses: 8600, profit: 5500, transactions: 55 },
    { month: "Dec", income: 15300, expenses: 9800, profit: 5500, transactions: 58 }
  ],

  incomeSources: [
    { name: "Sales", value: 45000, percentage: 35.2, color: "#150578", change: 12.5 },
    { name: "Services", value: 38000, percentage: 29.7, color: "#63d51d", change: 8.3 },
    { name: "Investments", value: 25000, percentage: 19.5, color: "#ff8600", change: -3.2 },
    { name: "Freelance", value: 12000, percentage: 9.4, color: "#06b6d4", change: 24.8 },
    { name: "Other", value: 8000, percentage: 6.2, color: "#778da9", change: 5.1 }
  ],

  expenseCategories: [
    { name: "Payroll", value: 46764, percentage: 45.8, color: "#150578", change: 8.1 },
    { name: "Operations", value: 28000, percentage: 27.4, color: "#ff8600", change: 12.3 },
    { name: "Marketing", value: 15000, percentage: 14.7, color: "#63d51d", change: -5.6 },
    { name: "Utilities", value: 8000, percentage: 7.8, color: "#f97316", change: 3.2 },
    { name: "Other", value: 4000, percentage: 4.3, color: "#06b6d4", change: 8.9 }
  ],

  performanceMetrics: [
    {
      name: "Revenue Growth",
      value: "15.3%",
      target: "20.0%",
      achievement: 76.5,
      status: "good"
    },
    {
      name: "Profit Margin",
      value: "18.7%",
      target: "25.0%",
      achievement: 74.8,
      status: "good"
    },
    {
      name: "Cost Control",
      value: "8.3%",
      target: "5.0%",
      achievement: 59.6,
      status: "average"
    },
    {
      name: "ROI",
      value: "124.5%",
      target: "100.0%",
      achievement: 124.5,
      status: "excellent"
    }
  ],

  tableData: [
    { id: 1, period: "January 2024", income: 8500, expenses: 6200, profit: 2300, transactions: 35, avgTransaction: 242.86, growthRate: 0 },
    { id: 2, period: "February 2024", income: 9200, expenses: 7100, profit: 2100, transactions: 42, avgTransaction: 219.05, growthRate: 8.2 },
    { id: 3, period: "March 2024", income: 10100, expenses: 6800, profit: 3300, transactions: 38, avgTransaction: 265.79, growthRate: 57.1 },
    { id: 4, period: "April 2024", income: 9800, expenses: 7400, profit: 2400, transactions: 45, avgTransaction: 217.78, growthRate: -27.3 },
    { id: 5, period: "May 2024", income: 11200, expenses: 8900, profit: 2300, transactions: 51, avgTransaction: 219.61, growthRate: -4.2 },
    { id: 6, period: "June 2024", income: 12500, expenses: 8200, profit: 4300, transactions: 48, avgTransaction: 260.42, growthRate: 87.0 },
    { id: 7, period: "July 2024", income: 10800, expenses: 7600, profit: 3200, transactions: 44, avgTransaction: 245.45, growthRate: -25.6 },
    { id: 8, period: "August 2024", income: 11800, expenses: 8100, profit: 3700, transactions: 47, avgTransaction: 251.06, growthRate: 15.6 },
    { id: 9, period: "September 2024", income: 13200, expenses: 8800, profit: 4400, transactions: 52, avgTransaction: 253.85, growthRate: 18.9 },
    { id: 10, period: "October 2024", income: 12900, expenses: 9200, profit: 3700, transactions: 49, avgTransaction: 263.27, growthRate: -15.9 },
    { id: 11, period: "November 2024", income: 14100, expenses: 8600, profit: 5500, transactions: 55, avgTransaction: 256.36, growthRate: 48.6 },
    { id: 12, period: "December 2024", income: 15300, expenses: 9800, profit: 5500, transactions: 58, avgTransaction: 263.79, growthRate: 0 }
  ],

  period: "2024"
};