import React from 'react';
import { statisticsMockData } from '@/mockData/statisticsMockData';
import StatsCard from '@/components/user_dashboard/statistics/StatsCard';
import FinancialTrendsChart from '@/components/user_dashboard/statistics/FinancialTrendsChart';
import TransactionAnalytics from '@/components/user_dashboard/statistics/TransactionAnalytics';
import PerformanceMetrics from '@/components/user_dashboard/statistics/PerformanceMetrics';
import StatisticsTable from '@/components/user_dashboard/statistics/StatisticsTable';

export default function StatisticsPage() {
  const {
    overviewCards,
    financialTrends,
    incomeSources,
    expenseCategories,
    performanceMetrics,
    tableData,
    period
  } = statisticsMockData;

  return (
    <div className="p-4 sm:p-6 bg-[#f2f3f4] min-h-full">
      {/* Page Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1b263b] mb-2">Statistics</h1>
        <p className="text-sm sm:text-base text-[#778da9]">
          Comprehensive financial analytics and insights for {period}
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {overviewCards.map((card, index) => (
          <StatsCard
            key={index}
            title={card.title}
            value={card.value}
            change={card.change}
            changeType={card.changeType}
            period={card.period}
            description={card.description}
            icon={card.icon}
          />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Financial Trends Chart - Takes 2 columns */}
        <div className="xl:col-span-2">
          <FinancialTrendsChart data={financialTrends} />
        </div>

        {/* Performance Metrics - Takes 1 column */}
        <div>
          <PerformanceMetrics metrics={performanceMetrics} />
        </div>
      </div>

      {/* Transaction Analytics - Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div>
          <TransactionAnalytics
            incomeSources={incomeSources}
            expenseCategories={[]}
          />
        </div>
        <div>
          <TransactionAnalytics
            incomeSources={[]}
            expenseCategories={expenseCategories}
          />
        </div>
      </div>

      {/* Statistics Table - Full width */}
      <div className="mb-6 sm:mb-8 overflow-x-auto">
        <StatisticsTable data={tableData} />
      </div>

      {/* Footer */}
      <div className="text-center text-xs sm:text-sm text-[#778da9] pt-6 sm:pt-8 border-t border-gray-200">
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <p className="mt-2">
          Data is automatically refreshed every 24 hours. For real-time updates,
          please check individual dashboard sections.
        </p>
      </div>
    </div>
  );
}