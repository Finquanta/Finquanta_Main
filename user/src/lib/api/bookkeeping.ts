import { apiFetch } from './client';

export interface BookkeepingOverview {
  summaryData: {
    balance: number;
    income: number;
    expense: number;
  };
  incomeTransactions: {
    id: number;
    date: Date;
    type: string;
    detail: string;
    invoice: string;
    price: number;
    amount: number;
  }[];
  expenseTransactions: {
    id: number;
    date: Date;
    type: string;
    detail: string;
    invoice: string;
    price: number;
    amount: number;
  }[];
  generalTransactions: {
    id: number;
    date: Date;
    type: string;
    detail: string;
    invoice: string;
    price: number;
    amount: number;
  }[];
}

export async function getBookkeepingOverview(): Promise<BookkeepingOverview> {
  return apiFetch<BookkeepingOverview>('/v1/bookkeeping/overview');
}
