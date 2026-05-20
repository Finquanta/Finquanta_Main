export type PayrollStatus = 'COMPLETED' | 'PENDING' | 'FAILED';

export interface PayrollTransaction {
  id: string;
  employeeName: string;
  company?: string;
  date?: string;
  time?: string;
  amount: number;
  invoiceDate?: string;
  status: PayrollStatus;
  avatarUrl?: string;
}

export interface PayrollOverview {
  outstandingData: {
    total: number;
    percentageChange: number;
    comparisonPeriod: string;
    chartData: Array<{ date: string; value: number; label: string; highlighted?: boolean }>;
    currentDate: string;
    selectedTimeframe: '1M' | '3M' | '6M' | '1Y';
  };
  payrollSummary: {
    period: { start: string; end: string };
    payment: number;
    pending: number;
    paid: number;
    completionPercentage: number;
  };
  transactions: PayrollTransaction[];
  previousPayroll: { amount: number; date: string; status: 'PAID' | 'PENDING' | 'OVERDUE' };
  upcomingPayroll: { amount: number; date: string; status: 'PAID' | 'PENDING' | 'OVERDUE' };
  client: { name: string; company?: string; avatarUrl?: string };
}
