import React from 'react';
import { MonthlyTrend } from '@/mockData/statisticsMockData';

interface FinancialTrendsChartProps {
  data: MonthlyTrend[];
}

export default function FinancialTrendsChart({ data }: FinancialTrendsChartProps) {
  // Find max values for scaling
  const maxValue = Math.max(
    ...data.map(d => Math.max(d.income, d.expenses, Math.abs(d.profit)))
  );

  // Scale factor for chart height (max height = 200px)
  const scaleFactor = maxValue > 0 ? 200 / maxValue : 1;

  return (
    <div className="bg-white p-6 rounded-[20px] border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-[#1b263b]">Financial Trends</h3>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#63d51d] rounded-full"></div>
            <span className="text-[#778da9]">Income</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#ff8600] rounded-full"></div>
            <span className="text-[#778da9]">Expenses</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#150578] rounded-full"></div>
            <span className="text-[#778da9]">Profit</span>
          </div>
        </div>
      </div>

      <div className="relative h-[250px]">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-[#778da9]">
          <span>${(maxValue).toLocaleString()}</span>
          <span>${(maxValue * 0.75).toLocaleString()}</span>
          <span>${(maxValue * 0.5).toLocaleString()}</span>
          <span>${(maxValue * 0.25).toLocaleString()}</span>
          <span>$0</span>
        </div>

        {/* Chart area */}
        <div className="absolute left-12 right-0 top-0 bottom-0 flex items-end justify-between">
          {data.map((item, index) => {
            const incomeHeight = item.income * scaleFactor;
            const expensesHeight = item.expenses * scaleFactor;
            const profitHeight = Math.abs(item.profit) * scaleFactor;

            return (
              <div key={index} className="flex-1 mx-1 relative group">
                {/* Bars */}
                <div className="relative h-full flex items-end justify-center gap-1">
                  {/* Income bar */}
                  <div
                    className="w-2 bg-[#63d51d] rounded-t-sm hover:bg-[#4fa619] transition-colors"
                    style={{ height: `${incomeHeight}px` }}
                    title={`Income: $${item.income.toLocaleString()}`}
                  ></div>

                  {/* Expenses bar */}
                  <div
                    className="w-2 bg-[#ff8600] rounded-t-sm hover:bg[#e67300] transition-colors"
                    style={{ height: `${expensesHeight}px` }}
                    title={`Expenses: $${item.expenses.toLocaleString()}`}
                  ></div>

                  {/* Profit bar (can be negative) */}
                  {item.profit >= 0 ? (
                    <div
                      className="w-2 bg-[#150578] rounded-t-sm hover:bg[#0d0342] transition-colors"
                      style={{ height: `${profitHeight}px` }}
                      title={`Profit: $${item.profit.toLocaleString()}`}
                    ></div>
                  ) : (
                    <div
                      className="absolute bottom-0 w-2 bg-[#dc2626] rounded-b-sm hover:bg[#b91c1c] transition-colors"
                      style={{ height: `${Math.min(profitHeight, 60)}px` }}
                      title={`Loss: $${Math.abs(item.profit).toLocaleString()}`}
                    ></div>
                  )}
                </div>

                {/* X-axis labels */}
                <div className="absolute -bottom-6 left-0 right-0 text-xs text-[#778da9] text-center">
                  {item.month}
                </div>

                {/* Hover tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white p-2 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  <div>Income: ${item.income.toLocaleString()}</div>
                  <div>Expenses: ${item.expenses.toLocaleString()}</div>
                  <div>Profit: ${item.profit >= 0 ? '+' : ''}${item.profit.toLocaleString()}</div>
                  <div>Transactions: {item.transactions}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Horizontal grid lines */}
        <div className="absolute left-12 right-0 top-0 bottom-6">
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
            <div
              key={fraction}
              className="absolute w-full border-t border-gray-100"
              style={{ bottom: `${fraction * 100}%` }}
            ></div>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-[#778da9] mb-1">Total Income</p>
          <p className="text-lg font-semibold text-[#63d51d]">
            ${data.reduce((sum, item) => sum + item.income, 0).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#778da9] mb-1">Total Expenses</p>
          <p className="text-lg font-semibold text-[#ff8600]">
            ${data.reduce((sum, item) => sum + item.expenses, 0).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#778da9] mb-1">Net Profit</p>
          <p className={`text-lg font-semibold ${data.reduce((sum, item) => sum + item.profit, 0) >= 0 ? 'text-[#150578]' : 'text-[#dc2626]'}`}>
            ${data.reduce((sum, item) => sum + item.profit, 0).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}