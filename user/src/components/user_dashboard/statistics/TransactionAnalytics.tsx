import React from 'react';
import { CategoryData } from '@/mockData/statisticsMockData';

interface TransactionAnalyticsProps {
  incomeSources: CategoryData[];
  expenseCategories: CategoryData[];
}

export default function TransactionAnalytics({ incomeSources, expenseCategories }: TransactionAnalyticsProps) {
  const renderDonutChart = (data: CategoryData[], title: string, primaryColor: string) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let cumulativePercentage = 0;

    return (
      <div className="bg-white p-6 rounded-[20px] border border-gray-200">
        <h3 className="text-xl font-semibold text-[#1b263b] mb-6">{title}</h3>

        <div className="flex items-center justify-between">
          {/* Donut chart */}
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              {data.map((item, index) => {
                const startAngle = cumulativePercentage * 3.6;
                const endAngle = startAngle + (item.percentage * 3.6);
                const largeArcFlag = item.percentage > 50 ? 1 : 0;

                const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);

                cumulativePercentage += item.percentage;

                return (
                  <path
                    key={index}
                    d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                    fill={item.color}
                    stroke="white"
                    strokeWidth="2"
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <title>{item.name}: ${item.value.toLocaleString()} ({item.percentage.toFixed(1)}%)</title>
                  </path>
                );
              })}
              {/* Inner circle for donut effect */}
              <circle cx="50" cy="50" r="20" fill="white" />
            </svg>

            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-[#778da9]">Total</span>
              <span className="text-lg font-bold text-[#1b263b]">${(total / 1000).toFixed(0)}k</span>
            </div>
          </div>

          {/* Legend with details */}
          <div className="flex-1 ml-8 space-y-3">
            {data.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <div>
                    <p className="text-sm font-medium text-[#1b263b]">{item.name}</p>
                    <p className="text-xs text-[#778da9]">${item.value.toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#1b263b]">{item.percentage.toFixed(1)}%</p>
                  {item.change !== undefined && (
                    <p className={`text-xs font-medium ${
                      item.change >= 0 ? 'text-[#63d51d]' : 'text-[#ff8600]'
                    }`}>
                      {item.change >= 0 ? '+' : ''}{item.change.toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderDonutChart(incomeSources, "Income Sources", "#63d51d")}
      {renderDonutChart(expenseCategories, "Expense Categories", "#ff8600")}
    </div>
  );
}