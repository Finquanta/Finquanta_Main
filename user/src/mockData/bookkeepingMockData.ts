// Mock data for bookkeeping dashboard

// Transaction types for the bookkeeping system
export enum TransactionType {
  SALE = 'Sale',
  SERVICE = 'Service', 
  INVESTMENT = 'investment',
  RENT = 'Rent',
  UTILITIES = 'Utilities',
  DEPOSITED = 'Deposited',
  WITHDRAWAL = 'Withdrawal'
}

// Summary card types
export enum SummaryCardType {
  BALANCE = 'balance',
  INCOME = 'income', 
  EXPENSE = 'expense'
}

// Summary card color themes
export enum CardColorTheme {
  GREEN = 'green',
  PURPLE = 'purple',
  BLUE = 'blue'
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).toLowerCase();
};

export const formatAmount = (amount: number): string => {
  const formatted = formatCurrency(Math.abs(amount));
  return amount >= 0 ? `+${formatted}` : `-${formatted}`;
};

// Props types (data passed to components)
export interface BookkeepingPageProps {
  summaryData: SummaryData;
  incomeTransactions: Transaction[];
  expenseTransactions: Transaction[];
  generalTransactions: Transaction[];
}

export interface SummaryData {
  balance: number;
  income: number;
  expense: number;
}

export interface Transaction {
  id: number;
  date: Date;
  type: string;
  detail: string;
  invoice: string;
  price: number;
  amount: number;
}

// Mock data for bookkeeping dashboard
export const mockRootProps = {
  summaryData: {
    balance: 128789,
    income: 85000,
    expense: 10000
  },
  incomeTransactions: [
    {
      id: 1,
      date: new Date('2024-05-01'),
      type: 'Sale' as const,
      detail: 'Amazon bookstore payment',
      invoice: 'UI8-8934AS',
      price: 98.00,
      amount: 88.20
    },
    {
      id: 2,
      date: new Date('2024-05-05'),
      type: 'Service' as const,
      detail: 'Design freelance payment', 
      invoice: 'UI8-8934AS',
      price: 98.00,
      amount: 88.20
    },
    {
      id: 3,
      date: new Date('2024-05-22'),
      type: 'investment' as const,
      detail: 'Apple NCH',
      invoice: 'UI8-8934AS', 
      price: 98.00,
      amount: -9.80
    }
  ],
  expenseTransactions: [
    {
      id: 4,
      date: new Date('2024-05-13'),
      type: 'Rent' as const,
      detail: 'Fleet - Travel shopping UI Design kit',
      invoice: 'UI8-8934AS',
      price: 98.00,
      amount: 88.20
    },
    {
      id: 5,
      date: new Date('2024-05-09'),
      type: 'Utilities' as const,
      detail: 'Fleet - Travel shopping UI Design kit',
      invoice: 'UI8-8934AS',
      price: 98.00,
      amount: 88.20
    }
  ],
  generalTransactions: [
    {
      id: 6,
      date: new Date('2024-05-24'),
      type: 'Deposited' as const,
      detail: 'Joe Philips',
      invoice: 'Paypal',
      price: 98.00,
      amount: 88.20
    },
    {
      id: 7,
      date: new Date('2024-05-26'),
      type: 'Withdrawal' as const,
      detail: 'Samuel Jackson',
      invoice: 'Bank of America',
      price: 98.00,
      amount: 88.20
    }
  ]
};