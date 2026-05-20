import { BookkeepingService } from '../../../src/modules/bookkeeping/bookkeeping.service';

describe('BookkeepingService', () => {
  it('splits transactions into income, expense, and general buckets', async () => {
    const transactionService = {
      getFinancialSummary: jest.fn().mockResolvedValue({
        totalIncome: '85000.00',
        totalExpenses: '10000.00',
        netIncome: '75000.00'
      }),
      getUserTransactions: jest.fn().mockResolvedValue({
        transactions: [
          {
            id: '1',
            date: '2026-05-01',
            type: 'income',
            category: 'Sale',
            description: 'Amazon bookstore payment',
            invoice: 'UI8-8934AS',
            amount: '88.20'
          },
          {
            id: '2',
            date: '2026-05-13',
            type: 'expense',
            category: 'Rent',
            description: 'Office rent',
            invoice: 'UI8-8934AS',
            amount: '98.00'
          }
        ],
        totalCount: 2,
        hasMore: false,
        filters: {}
      })
    };

    const service = new BookkeepingService(transactionService);
    const result = await service.getOverview('user-1', '2026-05-01', '2026-05-31');

    expect(result.summaryData.balance).toBe(75000);
    expect(result.incomeTransactions[0]?.type).toBe('Sale');
    expect(result.expenseTransactions[0]?.type).toBe('Rent');
  });
});
