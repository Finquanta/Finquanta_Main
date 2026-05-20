import { formatCurrency, formatPercentChange } from '../shared/formatters';
import { CategoryData, MonthlyTrend, PerformanceMetric, StatisticsOverview, StatisticsTableData } from './statistics.types';

export interface StatisticsRepositoryPort {
  getMonthlyRows(userId: string, year: number): Promise<Array<{ month: string; income: number; expenses: number; transactions: number }>>;
  getCategoryBreakdown(userId: string, year: number): Promise<{ incomeSources: CategoryData[]; expenseCategories: CategoryData[] }>;
}

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fullMonthLabels = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export class StatisticsService {
  constructor(private repository: StatisticsRepositoryPort) {}

  async getOverview(userId: string, year: number): Promise<StatisticsOverview> {
    const [monthlyRows, categories] = await Promise.all([
      this.repository.getMonthlyRows(userId, year),
      this.repository.getCategoryBreakdown(userId, year)
    ]);

    const rowMap = new Map(monthlyRows.map(row => [row.month, row]));
    const trends = monthLabels.map((label, index) => {
      const key = `${year}-${String(index + 1).padStart(2, '0')}`;
      const row = rowMap.get(key);
      const income = row?.income ?? 0;
      const expenses = row?.expenses ?? 0;
      return {
        month: label,
        income,
        expenses,
        profit: income - expenses,
        transactions: row?.transactions ?? 0
      };
    });

    const totals = trends.reduce((acc, row) => ({
      income: acc.income + row.income,
      expenses: acc.expenses + row.expenses,
      profit: acc.profit + row.profit,
      transactions: acc.transactions + row.transactions
    }), { income: 0, expenses: 0, profit: 0, transactions: 0 });

    const previousProfit = trends.length > 1 ? trends[trends.length - 2]?.profit ?? 0 : 0;
    const lastProfit = trends[trends.length - 1]?.profit ?? 0;
    const avgTransaction = totals.transactions === 0 ? 0 : totals.income / totals.transactions;
    const profitMargin = totals.income === 0 ? 0 : (totals.profit / totals.income) * 100;

    return {
      overviewCards: [
        {
          title: 'Total Revenue',
          value: formatCurrency(totals.income),
          change: formatPercentChange(totals.income, totals.income - (trends[trends.length - 1]?.income ?? 0)),
          changeType: 'positive',
          period: 'This year',
          description: 'Year-over-year revenue growth',
          icon: 'revenue'
        },
        {
          title: 'Total Expenses',
          value: formatCurrency(totals.expenses),
          change: formatPercentChange(totals.expenses, totals.expenses - (trends[trends.length - 1]?.expenses ?? 0)),
          changeType: 'negative',
          period: 'This year',
          description: 'Year-over-year expense change',
          icon: 'expenses'
        },
        {
          title: 'Net Profit',
          value: formatCurrency(totals.profit),
          change: formatPercentChange(lastProfit, previousProfit),
          changeType: lastProfit >= previousProfit ? 'positive' : 'negative',
          period: 'This year',
          description: 'Year-over-year profit change',
          icon: 'profit'
        },
        {
          title: 'Total Transactions',
          value: String(totals.transactions),
          change: '+0%',
          changeType: 'positive',
          period: 'This year',
          description: 'Total transaction volume',
          icon: 'transactions'
        },
        {
          title: 'Average Transaction',
          value: formatCurrency(avgTransaction),
          change: '+0%',
          changeType: 'positive',
          period: 'This year',
          description: 'Average transaction value',
          icon: 'average'
        },
        {
          title: 'Growth Rate',
          value: formatPercentChange(lastProfit, previousProfit).replace('+', ''),
          change: formatPercentChange(lastProfit, previousProfit),
          changeType: lastProfit >= previousProfit ? 'positive' : 'negative',
          period: 'This quarter',
          description: 'Quarterly growth rate',
          icon: 'growth'
        }
      ],
      financialTrends: trends,
      incomeSources: categories.incomeSources,
      expenseCategories: categories.expenseCategories,
      performanceMetrics: this.buildPerformanceMetrics(profitMargin, totals.expenses, totals.income),
      tableData: this.buildTableData(trends, year),
      period: String(year)
    };
  }

  private buildPerformanceMetrics(profitMargin: number, expenses: number, income: number): PerformanceMetric[] {
    const costRatio = income === 0 ? 0 : (expenses / income) * 100;
    return [
      { name: 'Revenue Growth', value: '0.0%', target: '20.0%', achievement: 0, status: 'average' },
      { name: 'Profit Margin', value: `${profitMargin.toFixed(1)}%`, target: '25.0%', achievement: Number(((profitMargin / 25) * 100).toFixed(1)), status: profitMargin >= 25 ? 'excellent' : 'good' },
      { name: 'Cost Control', value: `${costRatio.toFixed(1)}%`, target: '50.0%', achievement: Number(Math.max(0, 100 - costRatio).toFixed(1)), status: costRatio <= 50 ? 'good' : 'average' },
      { name: 'ROI', value: `${Math.max(profitMargin, 0).toFixed(1)}%`, target: '100.0%', achievement: Number(Math.max(profitMargin, 0).toFixed(1)), status: profitMargin >= 100 ? 'excellent' : 'good' }
    ];
  }

  private buildTableData(trends: MonthlyTrend[], year: number): StatisticsTableData[] {
    return trends.map((row, index) => {
      const previousProfit = index === 0 ? 0 : trends[index - 1]?.profit ?? 0;
      const growthRate = previousProfit === 0 ? 0 : ((row.profit - previousProfit) / Math.abs(previousProfit)) * 100;
      return {
        id: index + 1,
        period: `${fullMonthLabels[index]} ${year}`,
        income: row.income,
        expenses: row.expenses,
        profit: row.profit,
        transactions: row.transactions,
        avgTransaction: row.transactions === 0 ? 0 : Number((row.income / row.transactions).toFixed(2)),
        growthRate: Number(growthRate.toFixed(1))
      };
    });
  }
}
