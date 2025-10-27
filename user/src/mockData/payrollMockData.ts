// Payment status types
export enum PaymentStatus {
  PAID = 'PAID',
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE'
}

// Chart timeframe options
export enum ChartTimeframe {
  ONE_MONTH = '1M',
  THREE_MONTHS = '3M', 
  SIX_MONTHS = '6M',
  ONE_YEAR = '1Y'
}

// Transaction status types
export enum TransactionStatus {
  COMPLETED = 'COMPLETED',
  PENDING = 'PENDING',
  FAILED = 'FAILED'
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

export const formatTime = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
};

export const formatPercentage = (value: number): string => {
  return `${value > 0 ? '+' : ''}${value}%`;
};

export const formatPaymentStatus = (status: PaymentStatus): string => {
  return status;
};

export const formatTimeframe = (timeframe: ChartTimeframe): string => {
  return timeframe;
};

// Mock data for API queries
export const mockQuery = {
  outstandingData: {
    total: 22135.69,
    percentageChange: 23,
    comparisonPeriod: 'last month',
    chartData: [
      { date: new Date('2024-05-08'), value: 4200, label: 'May 8' },
      { date: new Date('2024-05-10'), value: 3800, label: 'May 10' },
      { date: new Date('2024-05-12'), value: 4100, label: 'May 12' },
      { date: new Date('2024-05-15'), value: 4251, label: 'May 15', highlighted: true },
      { date: new Date('2024-05-18'), value: 4000, label: 'May 18' },
      { date: new Date('2024-05-27'), value: 4150, label: 'May 27' }
    ],
    currentDate: new Date('2024-05-28'),
    selectedTimeframe: ChartTimeframe.ONE_YEAR as const
  },
  
  payrollSummary: {
    period: { start: new Date('2024-05-01'), end: new Date('2024-05-31') },
    payment: 201.54,
    pending: 57.13,
    paid: 407.10,
    completionPercentage: 45
  },
  
  transactions: [
    {
      id: '1',
      employeeName: 'Mickey mike',
      company: 'The Walt Disney Company',
      date: new Date('2024-05-01'),
      time: new Date('2024-05-01T08:00:00'),
      amount: 1546.12,
      invoiceDate: new Date('2024-05-01'),
      status: TransactionStatus.COMPLETED as const,
      avatarUrl: '/images/avatars/mickey-mike-avatar.svg'
    },
    {
      id: '2', 
      employeeName: 'Hannah Noah',
      company: 'Pizza Hut',
      date: new Date('2024-05-03'),
      time: new Date('2024-05-03T08:00:00'),
      amount: 1546.12,
      invoiceDate: new Date('2024-05-03'),
      status: TransactionStatus.COMPLETED as const,
      avatarUrl: '/images/avatars/hannah-noah-avatar.svg'
    },
    {
      id: '3',
      employeeName: 'Kristin Watson', 
      company: 'Nintendo',
      date: new Date('2024-05-05'),
      time: new Date('2024-05-05T08:00:00'),
      amount: 1546.12,
      invoiceDate: new Date('2024-05-05'),
      status: TransactionStatus.COMPLETED as const,
      avatarUrl: '/images/avatars/kristin-watson-avatar.svg'
    },
    {
      id: '4',
      employeeName: 'Cameron Williamson',
      company: 'eBay',
      date: new Date('2024-05-12'),
      time: new Date('2024-05-12T08:00:00'),
      amount: 1546.12,
      invoiceDate: new Date('2024-03-12'),
      status: TransactionStatus.COMPLETED as const,
      avatarUrl: '/images/avatars/cameron-williamson-avatar.svg'
    },
    {
      id: '5',
      employeeName: 'Ahmad Ali',
      company: 'eBay', 
      date: new Date('2022-05-19'),
      time: new Date('2022-05-19T08:00:00'),
      amount: 1546.12,
      invoiceDate: new Date('2024-05-19'),
      status: TransactionStatus.COMPLETED as const,
      avatarUrl: '/images/avatars/ahmad-ali-avatar.svg'
    }
  ],
  
  previousPayroll: {
    amount: 46764.14,
    date: new Date('2024-05-01'),
    status: PaymentStatus.PAID as const
  },
  
  upcomingPayroll: {
    amount: 3470.40,
    date: new Date('2024-06-01'),
    status: PaymentStatus.PENDING as const
  },
  
  client: {
    name: 'john mike',
    company: 'apple Inc.',
    avatarUrl: '/images/avatars/john-mike-avatar.svg'
  }
};

// Data passed as props to the root component
export const mockRootProps = {
  currentDate: new Date('2024-05-28')
};