import { changeType, formatCurrency, formatPercentChange, toNumber } from '../shared/formatters';
import {
  CreateGoalData,
  DashboardGoal,
  DashboardOverviewResponse,
  ExpenseSegment,
  LatestTransaction,
  RevenuePoint,
  RevenueRange,
  UpdateGoalData,
  WeeklyData
} from './dashboard.types';

export interface DashboardRepositoryPort {
  createGoal(userId: string, data: CreateGoalData): Promise<DashboardGoal>;
  updateGoal(userId: string, id: string, data: UpdateGoalData): Promise<DashboardGoal | null>;
  deleteGoal(userId: string, id: string): Promise<boolean>;
  getRevenueSeries(userId: string, range: RevenueRange): Promise<RevenuePoint[]>;
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
          title: 'Balance',
          amount: formatCurrency(balance),
          change: formatPercentChange(balance, previousBalance),
          changeType: changeType(balance, previousBalance),
          period: 'This month',
          description: 'This month your final balance has changed by'
        },
        {
          title: 'Cashflow',
          amount: formatCurrency(income),
          change: formatPercentChange(income, previousIncome),
          changeType: changeType(income, previousIncome),
          period: 'This month',
          description: 'This month cashflow has changed by'
        },
        {
          title: 'Expense',
          amount: formatCurrency(expenses),
          change: formatPercentChange(expenses, previousExpenses),
          changeType: expenses <= previousExpenses ? 'positive' : 'negative',
          period: 'This month',
          description: 'This month expenses have changed by'
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

  async createGoal(userId: string, data: CreateGoalData): Promise<DashboardGoal> {
    const name = (data.name ?? '').trim();
    if (!name) {
      throw new Error('Invalid goal name');
    }
    const target = Number(data.target);
    if (!Number.isFinite(target) || target <= 0) {
      throw new Error('Invalid goal target amount');
    }
    const current = data.current === undefined ? 0 : Number(data.current);
    if (!Number.isFinite(current) || current < 0) {
      throw new Error('Invalid goal current amount');
    }

    return this.repository.createGoal(userId, { ...data, name, target, current });
  }

  async updateGoal(userId: string, id: string, data: UpdateGoalData): Promise<DashboardGoal> {
    if (data.name !== undefined && !data.name.trim()) {
      throw new Error('Invalid goal name');
    }
    if (data.target !== undefined) {
      const target = Number(data.target);
      if (!Number.isFinite(target) || target <= 0) {
        throw new Error('Invalid goal target amount');
      }
    }
    if (data.current !== undefined) {
      const current = Number(data.current);
      if (!Number.isFinite(current) || current < 0) {
        throw new Error('Invalid goal current amount');
      }
    }

    const updated = await this.repository.updateGoal(userId, id, data);
    if (!updated) {
      throw new Error('Goal not found');
    }
    return updated;
  }

  async deleteGoal(userId: string, id: string): Promise<void> {
    const deleted = await this.repository.deleteGoal(userId, id);
    if (!deleted) {
      throw new Error('Goal not found');
    }
  }

  async getRevenue(userId: string, range: RevenueRange): Promise<{ range: RevenueRange; points: RevenuePoint[] }> {
    const normalized: RevenueRange = range === 'day' || range === 'month' || range === 'year' ? range : 'month';
    const points = await this.repository.getRevenueSeries(userId, normalized);
    return { range: normalized, points };
  }
}
