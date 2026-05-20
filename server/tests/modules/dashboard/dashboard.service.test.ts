import { DashboardService } from '../../../src/modules/dashboard/dashboard.service';

describe('DashboardService', () => {
  it('builds overview cards from financial aggregates', async () => {
    const repository = {
      getSummary: jest.fn().mockResolvedValue({
        totalIncome: '10000.00',
        totalExpenses: '1980.56',
        netIncome: '8019.44',
        transactionCount: 8
      }),
      getPreviousSummary: jest.fn().mockResolvedValue({
        totalIncome: '9000.00',
        totalExpenses: '2100.00',
        netIncome: '6900.00',
        transactionCount: 6
      }),
      getWeeklyTrend: jest.fn().mockResolvedValue([{ day: 'Mo', income: 300, expense: 150 }]),
      getExpenseSegments: jest.fn().mockResolvedValue([{ name: 'Goods', percentage: 100, color: '#1e1b4b' }]),
      getGoals: jest.fn().mockResolvedValue([]),
      getLatestTransactions: jest.fn().mockResolvedValue([])
    };

    const service = new DashboardService(repository);
    const result = await service.getOverview('user-1', '2026-05-01', '2026-05-31');

    expect(result.summaryCards[0]?.title).toBe('Current balance');
    expect(result.summaryCards[0]?.amount).toBe('$8,019.44');
    expect(result.totalSavingsData.weeklyData[0]?.day).toBe('Mo');
  });
});
