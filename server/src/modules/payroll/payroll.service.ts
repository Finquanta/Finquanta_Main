import { PayrollOverview, PayrollTransaction } from './payroll.types';

export interface PayrollRepositoryPort {
  getTransactions(userId: string, period: string): Promise<PayrollTransaction[]>;
  getSummary(userId: string, period: string): Promise<{ payment: number; pending: number; paid: number; completionPercentage: number }>;
  getOutstandingSeries(userId: string, period: string): Promise<Array<{ date: string; value: number; label: string; highlighted?: boolean }>>;
  getClient(userId: string): Promise<{ name: string; company?: string; avatarUrl?: string } | null>;
}

export class PayrollService {
  constructor(private repository: PayrollRepositoryPort) {}

  async getOverview(userId: string, period: string): Promise<PayrollOverview> {
    const [transactions, summary, chartData, client] = await Promise.all([
      this.repository.getTransactions(userId, period),
      this.repository.getSummary(userId, period),
      this.repository.getOutstandingSeries(userId, period),
      this.repository.getClient(userId)
    ]);

    const normalizedTransactions = transactions.map(transaction => ({
      ...transaction,
      status: transaction.status.toUpperCase() as PayrollTransaction['status']
    }));
    const outstandingTotal = chartData.reduce((total, point) => total + point.value, 0);
    const [year, month] = period.split('-').map(Number);
    const start = new Date(Date.UTC(year || new Date().getUTCFullYear(), (month || 1) - 1, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));

    return {
      outstandingData: {
        total: outstandingTotal,
        percentageChange: 0,
        comparisonPeriod: 'last month',
        chartData,
        currentDate: new Date().toISOString(),
        selectedTimeframe: '1Y'
      },
      payrollSummary: {
        period: {
          start: start.toISOString(),
          end: end.toISOString()
        },
        ...summary
      },
      transactions: normalizedTransactions,
      previousPayroll: {
        amount: summary.paid,
        date: start.toISOString(),
        status: 'PAID'
      },
      upcomingPayroll: {
        amount: summary.pending,
        date: end.toISOString(),
        status: 'PENDING'
      },
      client: client ?? { name: 'User', company: '', avatarUrl: '' }
    };
  }
}
