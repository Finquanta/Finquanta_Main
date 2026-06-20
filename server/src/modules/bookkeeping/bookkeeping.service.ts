import { TransactionService } from '../financial/transaction.service';
import { TransactionType } from '../financial/transaction.types';
import { BookkeepingOverview, BookkeepingTransaction } from './bookkeeping.types';

export class BookkeepingService {
  constructor(private transactionService: Pick<TransactionService, 'getFinancialSummary' | 'getUserTransactions'> & Partial<Pick<TransactionService, 'createTransaction' | 'updateTransaction' | 'deleteTransaction'>>) {}

  async getOverview(businessId: string, startDate: string, endDate: string): Promise<BookkeepingOverview> {
    const [summary, list] = await Promise.all([
      this.transactionService.getFinancialSummary(businessId, { startDate, endDate }),
      this.transactionService.getUserTransactions(businessId, { startDate, endDate, limit: 100, sortBy: 'date', sortOrder: 'desc' })
    ]);

    const mapped = list.transactions.map((transaction: any) => this.mapTransaction(transaction));

    return {
      summaryData: {
        balance: Number.parseFloat(summary.netIncome),
        income: Number.parseFloat(summary.totalIncome),
        expense: Number.parseFloat(summary.totalExpenses)
      },
      incomeTransactions: mapped.filter(transaction => transaction.amount >= 0),
      expenseTransactions: mapped.filter(transaction => transaction.amount < 0),
      generalTransactions: mapped
    };
  }

  createTransaction(businessId: string, userId: string, data: any) {
    if (!this.transactionService.createTransaction) {
      throw new Error('Transaction creation is not available');
    }
    return this.transactionService.createTransaction(businessId, userId, data);
  }

  updateTransaction(id: string, businessId: string, data: any) {
    if (!this.transactionService.updateTransaction) {
      throw new Error('Transaction updates are not available');
    }
    return this.transactionService.updateTransaction(id, businessId, data);
  }

  deleteTransaction(id: string, businessId: string) {
    if (!this.transactionService.deleteTransaction) {
      throw new Error('Transaction deletion is not available');
    }
    return this.transactionService.deleteTransaction(id, businessId);
  }

  private mapTransaction(transaction: any): BookkeepingTransaction {
    const amount = Number.parseFloat(transaction.amount);
    const signedAmount = transaction.type === TransactionType.EXPENSE || transaction.type === 'expense' ? -amount : amount;
    return {
      id: transaction.id,
      date: transaction.date,
      type: transaction.category,
      detail: transaction.description ?? transaction.category,
      invoice: transaction.invoice ?? '',
      price: amount,
      amount: signedAmount
    };
  }
}
