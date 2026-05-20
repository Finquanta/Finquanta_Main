import { changeType, formatCurrency, formatPercentChange, toNumber } from '../shared/formatters';
import { DashboardOverviewResponse, ExpenseSegment, LatestTransaction, WeeklyData } from './dashboard.types';

export interface DashboardRepositoryPort {
  getSummary(userId: string, startDate: string, endDate: string): Promise<{
    totalIncome: string;
    totalExpenses: string;
    netIncome: string;
    transactionCount: number;
  }>;
  getPreviousSummary(userId: string, startDate: string, endDate: string): Promise<{
    totalIncome: string;
    totalExpenses: string;
    netIncome: string;
    transactionCount: number;
  }>;
  getWeeklyTrend(userId: string, startDate: string, endDate: string): Promise<WeeklyData[]>;
  getExpenseSegments(userId: string, startDate: string, endDate: string): Promise<ExpenseSegment[]>;
  getGoals(userId: string): Promise<DashboardOverviewResponse['goalsData']['goals']>;
  getLatestTransactions(userId: string, limit?: number): Promise<LatestTransaction[]>;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export class DashboardService {
  constructor(private repository: DashboardRepositoryPort) {}

  async getOverview(userId: string, startDate: string, endDate: string): Promise<DashboardOverviewResponse> {
    const [summary, previous, weeklyData, segments, goals, latestTransactions] = await Promise.all([
      this.repository.getSummary(userId, startDate, endDate),
      this.repository.getPreviousSummary(userId, startDate, endDate),
      this.repository.getWeeklyTrend(userId, startDate, endDate),
      this.repository.getExpenseSegments(userId, startDate, endDate),
      this.repository.getGoals(userId),
      this.repository.getLatestTransactions(userId, 5)
    ]);

    const income = toNumber(summary.totalIncome);
    const expenses = toNumber(summary.totalExpenses);
    const balance = toNumber(summary.netIncome);
    const previousIncome = toNumber(previous.totalIncome);
    const previousExpenses = toNumber(previous.totalExpenses);
    const previousBalance = toNumber(previous.netIncome);
    const year = startDate.slice(0, 4);

    return {
      summaryCards: [
        {
          title: 'Current balance',
          amount: formatCurrency(balance),
          change: formatPercentChange(balance, previousBalance),
          changeType: changeType(balance, previousBalance),
          period: 'This month',
          description: 'This month your final balance has changed by'
        },
        {
          title: 'Expenses',
          amount: `-${formatCurrency(expenses)}`,
          change: formatPercentChange(expenses, previousExpenses),
          changeType: expenses <= previousExpenses ? 'positive' : 'negative',
          period: 'This month',
          description: 'This month expenses have changed by'
        },
        {
          title: 'Income',
          amount: formatCurrency(income),
          change: formatPercentChange(income, previousIncome),
          changeType: changeType(income, previousIncome),
          period: 'This month',
          description: 'This month incomes have changed by'
        }
      ],
      totalFinancesData: {
        year,
        months,
        highlightValue: formatCurrency(income)
      },
      totalSavingsData: {
        period: 'This week',
        weeklyData
      },
      totalExpensesData: {
        period: 'This month',
        totalAmount: -expenses,
        segments
      },
      goalsData: {
        period: 'This month',
        goals
      },
      latestTransactions
    };
  }
}
