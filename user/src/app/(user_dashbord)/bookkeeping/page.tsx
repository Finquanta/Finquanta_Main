'use client';

import React, { useEffect, useState } from 'react';
import BookkeepingSummaryCard from '@/components/user_dashboard/bookkeeping/BookkeepingSummaryCard';
import ManagementTable from '@/components/user_dashboard/bookkeeping/ManagementTable';
import { mockRootProps } from '@/mockData/bookkeepingMockData';
import { BookkeepingOverview, getBookkeepingOverview } from '@/lib/api/bookkeeping';

export default function BookkeepingPage() {
  const [data, setData] = useState<BookkeepingOverview | null>(null);
  const { summaryData, incomeTransactions, expenseTransactions, generalTransactions } = data ?? mockRootProps;

  useEffect(() => {
    getBookkeepingOverview()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <div className="h-full flex flex-col space-y-6 sm:space-y-8 p-4 sm:p-6 overflow-hidden">
      {/* Title */}
      <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex-shrink-0">Bookkeeping</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-16 flex-shrink-0">
        <BookkeepingSummaryCard
          title="Balance"
          amount={summaryData.balance}
          icon="balance"
        />
        <BookkeepingSummaryCard
          title="Income"
          amount={summaryData.income}
          icon="income"
        />
        <BookkeepingSummaryCard
          title="Expense"
          amount={summaryData.expense}
          icon="expense"
        />
      </div>

      {/* Management Tables */}
      <div className="flex-1 space-y-6 sm:space-y-8 overflow-y-auto pr-2">
        <ManagementTable
          title="Income management"
          data={incomeTransactions}
          actionText="Download invoice"
        />

        <ManagementTable
          title="Expense management"
          data={expenseTransactions}
          actionText="Download invoice"
        />

        <ManagementTable
          title="Transactions"
          data={generalTransactions}
          actionText="Get Statement"
        />
      </div>
    </div>
  );
}
