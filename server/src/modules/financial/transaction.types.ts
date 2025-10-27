/**
 * Financial Transaction Type Definitions
 *
 * This module defines all TypeScript interfaces and enums for the financial
 * transaction system, ensuring type safety across the application.
 */

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense'
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface CreateTransactionData {
  type: TransactionType;
  category: string;
  subcategory?: string;
  amount: number;
  description?: string;
  date: string; // YYYY-MM-DD format
  invoice?: string;
  metadata?: Record<string, any>;
}

export interface UpdateTransactionData extends Partial<CreateTransactionData> {
  status?: TransactionStatus;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  category: string;
  subcategory?: string;
  amount: string; // Decimal as string for precision
  description?: string;
  date: string; // YYYY-MM-DD format
  invoice?: string;
  status: TransactionStatus;
  metadata?: Record<string, any>;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface TransactionFilters {
  type?: TransactionType;
  category?: string;
  subcategory?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  status?: TransactionStatus;
  invoice?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'date' | 'amount' | 'category' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionListResponse {
  transactions: Transaction[];
  totalCount: number;
  hasMore: boolean;
  filters: TransactionFilters;
}

export interface FinancialSummary {
  totalIncome: string; // Decimal as string
  totalExpenses: string; // Decimal as string
  netIncome: string; // Decimal as string
  transactionCount: number;
  periodStart: string;
  periodEnd: string;
}

export interface CategoryBreakdown {
  category: string;
  amount: string; // Decimal as string
  count: number;
  percentage: number; // of total for that transaction type
}

export interface MonthlyTrend {
  month: string; // YYYY-MM format
  income: string; // Decimal as string
  expenses: string; // Decimal as string
  net: string; // Decimal as string
  transactionCount: number;
}

export interface TransactionAnalytics {
  summary: FinancialSummary;
  incomeBreakdown: CategoryBreakdown[];
  expenseBreakdown: CategoryBreakdown[];
  monthlyTrends: MonthlyTrend[];
  averageTransactionValue: {
    income: string; // Decimal as string
    expense: string; // Decimal as string
  };
}

// Database row interfaces
export interface TransactionRow {
  id: string;
  user_id: string;
  type: TransactionType;
  category: string;
  subcategory?: string;
  amount: string; // PostgreSQL decimal type
  description?: string;
  date: string; // Date in YYYY-MM-DD format
  invoice?: string;
  status: TransactionStatus;
  metadata?: Record<string, any>;
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface AnalyticsCacheRow {
  id: string;
  user_id: string;
  report_type: string;
  period_start: string;
  period_end: string;
  data: Record<string, any>; // JSON data
  created_at: string;
  expires_at: string;
}