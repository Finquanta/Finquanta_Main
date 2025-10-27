// Mock data for dashboard components

export const formatCurrency = (amount: number): string => {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${amount}`;
};

export const formatLargeCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)} 000`;
  }
  return `$${amount}`;
};

export const formatPercentage = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value}%`;
};

export const formatStockValue = (value: number): string => {
  if (value >= 1000) {
    return `$${value.toLocaleString()}`;
  }
  return `$${value.toFixed(2)}`;
};

// Type definitions for dashboard data structures
export interface SummaryCardData {
  title: string;
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

export interface Goal {
  name: string;
  current: number;
  target: number;
  color: string;
}

export interface Stock {
  name: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
}

export interface DashboardProps {
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
    goals: Goal[];
  };
  stockMarketData: {
    period: string;
    totalGain: string;
    totalPercentage: string;
    stocks: Stock[];
  };
}

export const mockRootProps = {
  summaryCards: [
    {
      title: "Current balance",
      amount: "$2041.78",
      change: "+4%",
      changeType: "positive" as const,
      period: "This month",
      description: "This month your final balance has increased by"
    },
    {
      title: "Expenses", 
      amount: "-$1980.56",
      change: "-3.4%",
      changeType: "negative" as const,
      period: "This week",
      description: "This month expenses have decreased by"
    },
    {
      title: "Income",
      amount: "+$10,000", 
      change: "+8.5%",
      changeType: "positive" as const,
      period: "May 2024",
      description: "This month incomes have increased"
    }
  ],
  totalFinancesData: {
    year: "2024",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    highlightValue: "$6000"
  },
  totalSavingsData: {
    period: "This week",
    weeklyData: [
      { day: "Mo", income: 300, expense: 150 },
      { day: "Tu", income: 450, expense: 200 },
      { day: "We", income: 250, expense: 180 },
      { day: "Th", income: 400, expense: 160 },
      { day: "Fr", income: 350, expense: 120 },
      { day: "Sa", income: 600, expense: 280 },
      { day: "Su", income: 500, expense: 220 }
    ]
  },
  totalExpensesData: {
    period: "May 2024",
    totalAmount: -1980,
    segments: [
      { name: "Goods", percentage: 40, color: "#1e1b4b" },
      { name: "Services", percentage: 30, color: "#0f766e" },
      { name: "Subscriptions", percentage: 20, color: "#f97316" },
      { name: "Other", percentage: 10, color: "#06b6d4" }
    ]
  },
  goalsData: {
    period: "This month",
    goals: [
      { name: "Car", current: 9700, target: 15000, color: "bg-orange-500" },
      { name: "Vacation", current: 0, target: 8000, color: "bg-purple-600" },
      { name: "House", current: 0, target: 190000, color: "bg-blue-600" },
      { name: "shopping", current: 0, target: 13000, color: "bg-cyan-500" }
    ]
  },
  stockMarketData: {
    period: "Today",
    totalGain: "+$501.21",
    totalPercentage: "+10.11%",
    stocks: [
      { name: "Apple", value: "$101.40", change: "+3.32%", changeType: "positive" as const },
      { name: "Gold", value: "$2,417.4", change: "+2.49%", changeType: "positive" as const },
      { name: "Tesla", value: "$1046.5", change: "-2.47%", changeType: "negative" as const }
    ]
  }
};