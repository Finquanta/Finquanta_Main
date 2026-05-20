export interface BookkeepingTransaction {
  id: string;
  date: string;
  type: string;
  detail: string;
  invoice: string;
  price: number;
  amount: number;
}

export interface BookkeepingOverview {
  summaryData: {
    balance: number;
    income: number;
    expense: number;
  };
  incomeTransactions: BookkeepingTransaction[];
  expenseTransactions: BookkeepingTransaction[];
  generalTransactions: BookkeepingTransaction[];
}
