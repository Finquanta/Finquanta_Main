import { TransactionRepository } from './transaction.repository';
import {
  Transaction,
  CreateTransactionData,
  UpdateTransactionData,
  TransactionFilters,
  FinancialSummary,
  TransactionType,
  TransactionStatus
} from './transaction.types';
import { WebSocketNotificationService } from '../websocket/notification.service';

export class TransactionService {
  // Business rule constants
  //
  // There is deliberately NO daily expense cap. There used to be one ($10,000),
  // which rejected any day whose expenses totalled more than that — one rent
  // payment, payroll run or equipment purchase hit it, and the entry was refused
  // outright. A bookkeeping tool has no business telling someone they spent too
  // much. Genuine data-entry slips are still caught by the max-reasonable-amount
  // check below ($10m per transaction).
  private static readonly MAX_TRANSACTIONS_PER_DAY = 100; // Max 100 transactions per day
  private static readonly MAX_CATEGORY_LENGTH = 100; // Max category name length

  constructor(
    private repository: TransactionRepository,
    private notificationService?: WebSocketNotificationService
  ) {}

  async createTransaction(businessId: string, userId: string, data: CreateTransactionData): Promise<Transaction> {
    // Validate required fields
    this.validateCreateData(data);

    // Business logic validations (scoped to the business)
    await this.validateBusinessRules(businessId, data);

    // Create transaction through repository
    const transaction = await this.repository.create(businessId, userId, data);

    // Send WebSocket notification if available
    if (this.notificationService) {
      this.notificationService.notifyTransactionCreated(userId, transaction);

      // Check for spending limits and send notifications
      await this.checkAndNotifyLimits(businessId, data);
    }

    return transaction;
  }

  async updateTransaction(
    id: string,
    businessId: string,
    data: UpdateTransactionData
  ): Promise<Transaction | null> {
    // Validate update data
    this.validateUpdateData(data);

    // Check if transaction exists in this business
    const existingTransaction = await this.repository.findById(id, businessId);
    if (!existingTransaction) {
      return null;
    }

    // Business logic validations for updates
    if (data.amount !== undefined || data.date !== undefined) {
      const mergedData = { ...existingTransaction, ...data };
      // Exclude the transaction being edited so it isn't flagged as a
      // duplicate of itself or double-counted against daily limits.
      await this.validateBusinessRules(businessId, mergedData as CreateTransactionData, id);
    }

    // Update transaction through repository
    const updatedTransaction = await this.repository.update(id, businessId, data);

    // Send WebSocket notification if available and update was successful
    if (this.notificationService && updatedTransaction) {
      this.notificationService.notifyTransactionUpdated(businessId, updatedTransaction);
    }

    return updatedTransaction;
  }

  async deleteTransaction(id: string, businessId: string): Promise<boolean> {
    // Check if transaction exists in this business
    const existingTransaction = await this.repository.findById(id, businessId);
    if (!existingTransaction) {
      return false;
    }

    // Delete transaction through repository
    const deleted = await this.repository.delete(id, businessId);

    // Send WebSocket notification if available and deletion was successful
    if (this.notificationService && deleted) {
      this.notificationService.notifyTransactionDeleted(businessId, existingTransaction);
    }

    return deleted;
  }

  async getUserTransactions(
    businessId: string,
    filters: TransactionFilters = {}
  ) {
    // Validate filters
    this.validateFilters(filters);

    return await this.repository.getUserTransactions(businessId, filters);
  }

  async getFinancialSummary(
    businessId: string,
    dateRange: { startDate: string; endDate: string }
  ): Promise<FinancialSummary> {
    // Validate date range
    this.validateDateRange(dateRange.startDate, dateRange.endDate);

    return await this.repository.calculateSummary(businessId, dateRange);
  }

  async getTransactionById(id: string, businessId: string): Promise<Transaction | null> {
    return await this.repository.findById(id, businessId);
  }

  private validateCreateData(data: CreateTransactionData): void {
    // Required field validations
    if (!data.type || !Object.values(TransactionType).includes(data.type)) {
      throw new Error('Invalid transaction type');
    }

    if (!data.category || data.category.trim().length === 0) {
      throw new Error('Category is required');
    }

    if (data.category.length > TransactionService.MAX_CATEGORY_LENGTH) {
      throw new Error(`Category must be less than ${TransactionService.MAX_CATEGORY_LENGTH} characters`);
    }

    if (data.amount === undefined || data.amount === null) {
      throw new Error('Amount is required');
    }

    if (!data.date) {
      throw new Error('Date is required');
    }

    // Business validations
    if (data.amount <= 0) {
      throw new Error('Amount must be positive');
    }

    // Date validation
    this.validateDate(data.date);

    // Optional field validations
    if (data.description && data.description.length > 500) {
      throw new Error('Description must be less than 500 characters');
    }

    if (data.invoice && data.invoice.length > 100) {
      throw new Error('Invoice number must be less than 100 characters');
    }
  }

  private validateUpdateData(data: UpdateTransactionData): void {
    // Amount validation
    if (data.amount !== undefined && data.amount <= 0) {
      throw new Error('Amount must be positive');
    }

    // Category validation
    if (data.category !== undefined) {
      if (!data.category || data.category.trim().length === 0) {
        throw new Error('Category cannot be empty');
      }
      if (data.category.length > TransactionService.MAX_CATEGORY_LENGTH) {
        throw new Error(`Category must be less than ${TransactionService.MAX_CATEGORY_LENGTH} characters`);
      }
    }

    // Date validation
    if (data.date !== undefined) {
      this.validateDate(data.date);
    }

    // Type validation
    if (data.type !== undefined && !Object.values(TransactionType).includes(data.type)) {
      throw new Error('Invalid transaction type');
    }

    // Status validation
    if (data.status !== undefined && !Object.values(TransactionStatus).includes(data.status)) {
      throw new Error('Invalid transaction status');
    }

    // Description validation
    if (data.description !== undefined && data.description.length > 500) {
      throw new Error('Description must be less than 500 characters');
    }

    // Invoice validation
    if (data.invoice !== undefined && data.invoice.length > 100) {
      throw new Error('Invoice number must be less than 100 characters');
    }
  }

  private validateFilters(filters: TransactionFilters): void {
    // Validate limit
    if (filters.limit !== undefined && filters.limit <= 0) {
      throw new Error('Limit must be positive');
    }

    if (filters.limit !== undefined && filters.limit > 1000) {
      throw new Error('Limit cannot exceed 1000');
    }

    // Validate offset
    if (filters.offset !== undefined && filters.offset < 0) {
      throw new Error('Offset cannot be negative');
    }

    // Validate date range if both provided
    if (filters.startDate && filters.endDate) {
      this.validateDateRange(filters.startDate, filters.endDate);
    }

    // Validate individual dates
    if (filters.startDate) {
      this.validateDate(filters.startDate);
    }
    if (filters.endDate) {
      this.validateDate(filters.endDate);
    }

    // Validate transaction type
    if (filters.type !== undefined && !Object.values(TransactionType).includes(filters.type)) {
      throw new Error('Invalid transaction type');
    }

    // Validate status
    if (filters.status !== undefined && !Object.values(TransactionStatus).includes(filters.status)) {
      throw new Error('Invalid transaction status');
    }
  }

  private validateDate(date: string): void {
    // Check YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    // Check if it's a valid date
    const parsedDate = new Date(date + 'T00:00:00.000Z');
    if (isNaN(parsedDate.getTime())) {
      throw new Error('Invalid date');
    }

    // Check year range (reasonable bounds)
    const year = parsedDate.getFullYear();
    if (year < 1900 || year > 2100) {
      throw new Error('Date year must be between 1900 and 2100');
    }
  }

  private validateDateRange(startDate: string, endDate: string): void {
    this.validateDate(startDate);
    this.validateDate(endDate);

    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T00:00:00.000Z');

    if (start > end) {
      throw new Error('End date must be after start date');
    }

    // Reasonable range limit (e.g., 5 years)
    const maxRange = 5 * 365 * 24 * 60 * 60 * 1000; // 5 years in milliseconds
    if (end.getTime() - start.getTime() > maxRange) {
      throw new Error('Date range cannot exceed 5 years');
    }
  }

  private async validateBusinessRules(businessId: string, data: CreateTransactionData, excludeId?: string): Promise<void> {
    // Rule 1: Expense transactions cannot have future dates
    if (data.type === TransactionType.EXPENSE) {
      const transactionDate = new Date(data.date + 'T00:00:00.000Z');
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day

      if (transactionDate > today) {
        throw new Error('Expense transactions cannot have future dates');
      }
    }

    // Rule 2: Daily transaction limit. When editing, ignore the transaction
    // being updated so it doesn't count against the user's own limits.
    const dayQuery = await this.repository.getUserTransactions(businessId, {
      startDate: data.date,
      endDate: data.date,
      limit: TransactionService.MAX_TRANSACTIONS_PER_DAY + 1
    });
    const dayTransactions = {
      transactions: dayQuery.transactions.filter(t => t.id !== excludeId)
    };

    if (dayTransactions.transactions.length >= TransactionService.MAX_TRANSACTIONS_PER_DAY) {
      throw new Error(`Cannot create more than ${TransactionService.MAX_TRANSACTIONS_PER_DAY} transactions per day`);
    }

    // Rule 3: Reasonable transaction amount (prevent data entry errors)
    const maxReasonableAmount = 10000000; // $10 million
    if (data.amount > maxReasonableAmount) {
      throw new Error(`Transaction amount exceeds maximum reasonable limit of $${maxReasonableAmount.toLocaleString()}`);
    }

    // NOTE: duplicate-transaction blocking was removed intentionally — users may
    // legitimately record identical entries on the same day, and it also broke
    // restoring a just-deleted entry.
  }

  /**
   * Check for spending limits and send notifications via WebSocket
   */
  private async checkAndNotifyLimits(businessId: string, data: CreateTransactionData): Promise<void> {
    if (!this.notificationService || data.type !== TransactionType.EXPENSE) {
      return;
    }

    // Check daily spending limit (80% warning threshold)
    const today = new Date().toISOString().split('T')[0];
    const dayTransactions = await this.repository.getUserTransactions(businessId, {
      startDate: today,
      endDate: today
    });

    // The "approaching your daily spending limit" notification went with the
    // limit itself — there is no daily expense cap to approach any more, so the
    // day-wide total it was computed from is gone too. `dayTransactions` is
    // still needed below for the per-category check.

    // Check category spending (example: $1000 per category daily limit)
    const categoryLimit = 1000;
    const categoryExpenses = dayTransactions.transactions
      .filter(t => t.type === TransactionType.EXPENSE && t.category === data.category)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalCategoryExpense = categoryExpenses + data.amount;
    const categoryWarning = categoryLimit * 0.9; // 90% of category limit

    if (totalCategoryExpense > categoryWarning) {
      this.notificationService.notifyLimitReached(businessId, {
        type: 'category_limit',
        currentAmount: totalCategoryExpense,
        limitAmount: categoryLimit,
        category: data.category
      });
    }
  }

  /**
   * Validate a whole import without writing anything.
   *
   * Returns one result per row, in order, so the preview can show exactly which
   * lines are wrong and why. NOTHING is created here: a half-applied import is
   * worse than a refused one, because the user cannot tell which rows landed.
   *
   * Applies the same rules manual entry does, MINUS the per-day cap — see
   * createManyForImport for why.
   */
  validateImportRows(rows: CreateTransactionData[]): { index: number; error: string }[] {
    const problems: { index: number; error: string }[] = [];

    rows.forEach((data, index) => {
      try {
        this.validateCreateData(data);

        // Rule 1, kept: a future-dated expense in a spreadsheet is a data error
        // (usually a mistyped year), and silently accepting it would put a
        // transaction in the books that has not happened.
        if (data.type === TransactionType.EXPENSE) {
          const when = new Date(data.date + 'T00:00:00.000Z');
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (when > today) throw new Error('Expense cannot be dated in the future');
        }

        // Rule 3, kept: still a data-entry guard, and a stray column in a
        // spreadsheet is exactly how a $10m row gets in.
        if (data.amount > 10000000) {
          throw new Error('Amount exceeds the $10,000,000 limit');
        }
      } catch (error) {
        problems.push({ index, error: error instanceof Error ? error.message : 'Invalid row' });
      }
    });

    return problems;
  }

  /**
   * Create many transactions from a deliberate import.
   *
   * Two differences from createTransaction, both deliberate:
   *
   *  - **The per-day cap is not applied.** MAX_TRANSACTIONS_PER_DAY guards
   *    against runaway MANUAL entry; an import is a different act, already
   *    governed by its own monthly cap (importsPerMonth). Applying it here
   *    would fail a 150-row day halfway through — and it costs a database
   *    query per row, so skipping it is also what makes a large import fast.
   *  - **No per-transaction notification.** 400 rows would fire 400 of them.
   *    The caller announces the import once instead.
   *
   * Rows are expected to have been through validateImportRows already.
   *
   * ALL OR NOTHING. The write goes through `createManyAtomic`, which runs every
   * row inside one database transaction — so an import either lands completely
   * or leaves the books exactly as it found them. There is no state where some
   * rows are in and the user cannot tell which.
   *
   * That matters more than it sounds: a half-applied import cannot safely be
   * re-run, because retrying duplicates whatever already made it. Validating
   * first (above) removes the likely failure, bad data; this removes the
   * remaining one, the connection dropping mid-write.
   */
  async createManyForImport(
    businessId: string,
    userId: string,
    rows: CreateTransactionData[]
  ): Promise<{ created: number; ids: string[] }> {
    const transactions = await this.repository.createManyAtomic(businessId, userId, rows);
    return { created: transactions.length, ids: transactions.map((t) => t.id) };
  }
}
