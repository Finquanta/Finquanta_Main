import { changeType, formatCurrency, formatPercentChange, toNumber } from '../shared/formatters';
import {
  CreateGoalData,
  DashboardGoal,
  DashboardOverviewResponse,
  ExpenseSegment,
  LatestTransaction,
  RevenueMetric,
  RevenuePoint,
  RevenueRange,
  UpdateGoalData,
  WeeklyData
} from './dashboard.types';

export interface DashboardRepositoryPort {
  createGoal(businessId: string, userId: string, data: CreateGoalData): Promise<DashboardGoal>;
  updateGoal(businessId: string, id: string, data: UpdateGoalData): Promise<DashboardGoal | null>;
  deleteGoal(businessId: string, id: string): Promise<boolean>;
  getRevenueSeries(businessId: string, range: RevenueRange, metric?: RevenueMetric): Promise<RevenuePoint[]>;
  getSummary(businessId: string, startDate: string, endDate: string): Promise<{
    totalIncome: string;
    totalExpenses: string;
    netIncome: string;
    transactionCount: number;
  }>;
  getPreviousSummary(businessId: string, startDate: string, endDate: string): Promise<{
    totalIncome: string;
    totalExpenses: string;
    netIncome: string;
    transactionCount: number;
  }>;
  getWeeklyTrend(businessId: string, startDate: string, endDate: string): Promise<WeeklyData[]>;
  getExpenseSegments(businessId: string, startDate: string, endDate: string): Promise<ExpenseSegment[]>;
  getGoals(businessId: string): Promise<DashboardOverviewResponse['goalsData']['goals']>;
  getLatestTransactions(businessId: string, limit?: number): Promise<LatestTransaction[]>;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export class DashboardService {
  constructor(private repository: DashboardRepositoryPort) {}

  async getOverview(businessId: string, startDate: string, endDate: string): Promise<DashboardOverviewResponse> {
    const [summary, previous, weeklyData, segments, goals, latestTransactions] = await Promise.all([
      this.repository.getSummary(businessId, startDate, endDate),
      this.repository.getPreviousSummary(businessId, startDate, endDate),
      this.repository.getWeeklyTrend(businessId, startDate, endDate),
      this.repository.getExpenseSegments(businessId, startDate, endDate),
      this.repository.getGoals(businessId),
      this.repository.getLatestTransactions(businessId, 5)
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

  async createGoal(businessId: string, userId: string, data: CreateGoalData): Promise<DashboardGoal> {
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

    return this.repository.createGoal(businessId, userId, { ...data, name, target, current });
  }

  async updateGoal(businessId: string, id: string, data: UpdateGoalData): Promise<DashboardGoal> {
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

    const updated = await this.repository.updateGoal(businessId, id, data);
    if (!updated) {
      throw new Error('Goal not found');
    }
    return updated;
  }

  async deleteGoal(businessId: string, id: string): Promise<void> {
    const deleted = await this.repository.deleteGoal(businessId, id);
    if (!deleted) {
      throw new Error('Goal not found');
    }
  }

  async getRevenue(businessId: string, range: RevenueRange, metric: RevenueMetric = 'revenue'): Promise<{ range: RevenueRange; metric: RevenueMetric; points: RevenuePoint[] }> {
    const normalized: RevenueRange = range === 'day' || range === 'month' || range === 'year' ? range : 'month';
    const normalizedMetric: RevenueMetric = metric === 'cashflow' || metric === 'expense' ? metric : 'revenue';
    const points = await this.repository.getRevenueSeries(businessId, normalized, normalizedMetric);
    return { range: normalized, metric: normalizedMetric, points };
  }
}
