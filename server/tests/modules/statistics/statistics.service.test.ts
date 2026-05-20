import { StatisticsService } from '../../../src/modules/statistics/statistics.service';

describe('StatisticsService', () => {
  it('returns statistics overview shaped for the statistics page', async () => {
    const repository = {
      getMonthlyRows: jest.fn().mockResolvedValue([
        { month: '2026-01', income: 8500, expenses: 6200, transactions: 35 },
        { month: '2026-02', income: 9200, expenses: 7100, transactions: 42 }
      ]),
      getCategoryBreakdown: jest.fn().mockResolvedValue({
        incomeSources: [{ name: 'Sales', value: 45000, percentage: 70, color: '#150578', change: 12.5 }],
        expenseCategories: [{ name: 'Operations', value: 28000, percentage: 60, color: '#ff8600', change: 8.1 }]
      })
    };

    const service = new StatisticsService(repository);
    const result = await service.getOverview('user-1', 2026);

    expect(result.period).toBe('2026');
    expect(result.overviewCards.some(card => card.title === 'Total Revenue')).toBe(true);
    expect(result.financialTrends[0]?.profit).toBe(2300);
  });
});
