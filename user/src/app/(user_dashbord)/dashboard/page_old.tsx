import React from 'react';
import SummaryCard from '@/components/user_dashboard/dashboard/SummaryCard';
import TotalFinancesChart from '@/components/user_dashboard/dashboard/TotalFinancesChart';
import TotalSavingsChart from '@/components/user_dashboard/dashboard/TotalSavingsChart';
import GoalsSection from '@/components/user_dashboard/dashboard/GoalsSection';
import StockMarketSection from '@/components/user_dashboard/dashboard/StockMarketSection';
import TotalExpensesCard from '@/components/user_dashboard/dashboard/TotalExpensesCard';
import { mockRootProps } from '@/mockData/dashboardMockData';

export default function DashboardPage() {
  const { summaryCards } = mockRootProps;

  return (
    <div className="w-full max-w-full overflow-x-hidden min-w-0">
      <div className="dashboard-grid w-full min-w-0">
      {/* Row 1: Top Summary Cards */}
      {summaryCards.map((card, index) => (
        <SummaryCard
          key={card.title}
          title={card.title}
          amount={card.amount}
          change={card.change}
          changeType={card.changeType}
          period={card.period}
          description={card.description}
        />
      ))}

      {/* Total Expenses - Spans rows 1 and 2 on desktop, normal on mobile */}
      <div className="lg:row-span-2">
        <TotalExpensesCard />
      </div>

      {/* Row 2: Middle Row */}
      <div className="md:col-span-2">
        <TotalFinancesChart />
      </div>
      <div>
        <TotalSavingsChart />
      </div>
      {/* Empty cell - occupied by Total Expenses spanning from row 1 on desktop */}

      {/* Row 3: Bottom Row */}
      <div className="md:col-span-2">
        <GoalsSection />
      </div>
      <div className="md:col-span-2">
        <StockMarketSection />
      </div>
      </div>
    </div>
  );
}