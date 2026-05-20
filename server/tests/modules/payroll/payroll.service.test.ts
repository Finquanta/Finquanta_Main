import { PayrollService } from '../../../src/modules/payroll/payroll.service';

describe('PayrollService', () => {
  it('builds payroll overview for the payroll page', async () => {
    const repository = {
      getTransactions: jest.fn().mockResolvedValue([
        { id: '1', employeeName: 'Mickey Mike', amount: 1546.12, status: 'completed' }
      ]),
      getSummary: jest.fn().mockResolvedValue({
        payment: 201.54,
        pending: 57.13,
        paid: 407.10,
        completionPercentage: 45
      }),
      getOutstandingSeries: jest.fn().mockResolvedValue([
        { date: '2026-05-15', value: 4251, label: 'May 15', highlighted: true }
      ]),
      getClient: jest.fn().mockResolvedValue({
        name: 'John Mike',
        company: 'Apple Inc.',
        avatarUrl: '/images/avatars/john-mike-avatar.svg'
      })
    };

    const service = new PayrollService(repository);
    const result = await service.getOverview('user-1', '2026-05');

    expect(result.payrollSummary.payment).toBe(201.54);
    expect(result.transactions[0]?.employeeName).toBe('Mickey Mike');
    expect(result.transactions[0]?.status).toBe('COMPLETED');
  });
});
