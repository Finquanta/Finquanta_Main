'use client';

import React from 'react';
import OutstandingChart from '@/components/user_dashboard/payroll/OutstandingChart';
import TransactionHistory from '@/components/user_dashboard/payroll/TransactionHistory';
import PayrollSummaryCard from '@/components/user_dashboard/payroll/PayrollSummaryCard';
import PayrollStatusCard from '@/components/user_dashboard/payroll/PayrollStatusCard';
import ClientSection from '@/components/user_dashboard/payroll/ClientSection';
import { mockQuery } from '@/mockData/payrollMockData';

export default function PayrollPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f2f3f4] min-h-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 min-w-full">
        {/* Left Column - Charts and History */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
          <OutstandingChart data={mockQuery.outstandingData} />
          <TransactionHistory data={mockQuery.transactions} />
        </div>

        {/* Right Column - Summary and Status Cards */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          <PayrollSummaryCard data={mockQuery.payrollSummary} />

          <PayrollStatusCard
            type="previous"
            data={mockQuery.previousPayroll}
          />

          <PayrollStatusCard
            type="upcoming"
            data={mockQuery.upcomingPayroll}
          />

          <ClientSection data={mockQuery.client} />
        </div>
      </div>
    </div>
  );
}