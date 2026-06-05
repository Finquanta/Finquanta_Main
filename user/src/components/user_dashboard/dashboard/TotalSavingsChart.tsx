"use client";
import React from 'react';
import { BarChart, Bar, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import ChevronDownIcon from '../icons/ChevronDownIcon';

const chartConfig = {
  incomes: {
    label: "Incomes",
    color: "#150578",
  },
  expenses: {
    label: "Expenses",
    color: "#ff8600",
  },
};

const chartData = [
  { day: 'Mo', incomes: 300, expenses: 150 },
  { day: 'Tu', incomes: 450, expenses: 200 },
  { day: 'We', incomes: 250, expenses: 180 },
  { day: 'Th', incomes: 400, expenses: 160 },
  { day: 'Fr', incomes: 350, expenses: 120 },
  { day: 'Sa', incomes: 600, expenses: 280 },
  { day: 'Su', incomes: 500, expenses: 220 },
];

export default function TotalSavingsChart() {
  return (
    <div className="bg-white p-6 rounded-[20px] border border-gray-200 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-medium text-[#1b263b]">Total savings</h3>
        <div className="flex items-center text-[13px] font-medium text-[#778da9] gap-2">
          This week
          <ChevronDownIcon width={11} height={6} color="#778da9" />
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ChartContainer config={chartConfig} className="w-full h-full overflow-hidden">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 13, fill: '#778da9' }}
              className="text-[13px] font-medium text-[#778da9]"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 13, fill: '#778da9' }}
              tickFormatter={(value) => `$${value}`}
              className="text-[13px] font-medium text-[#778da9]"
            />
            <ChartTooltip
              content={<ChartTooltipContent
                formatter={(value, name) => [`$${value}`, chartConfig[name as keyof typeof chartConfig]?.label]}
                labelFormatter={(label) => `Day: ${label}`}
              />}
            />
            <Bar
              dataKey="incomes"
              fill="#150578"
              radius={[2, 2, 0, 0]}
              maxBarSize={12}
            />
            <Bar
              dataKey="expenses"
              fill="#ff8600"
              radius={[2, 2, 0, 0]}
              maxBarSize={12}
            />
          </BarChart>
        </ChartContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 pt-2 border-t border-[#dce4ee]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#150578] rounded-full"></div>
          <span className="text-xs font-medium text-[#778da9]">Incomes</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#ff8600] rounded-full"></div>
          <span className="text-xs font-medium text-[#778da9]">Expenses</span>
        </div>
      </div>
    </div>
  );
}