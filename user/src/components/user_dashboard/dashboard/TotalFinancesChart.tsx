"use client";
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
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
  { month: "Jan", incomes: 8000, expenses: 4000 },
  { month: "Feb", incomes: 7500, expenses: 4200 },
  { month: "Mar", incomes: 8200, expenses: 4500 },
  { month: "Apr", incomes: 7800, expenses: 4100 },
  { month: "May", incomes: 9000, expenses: 4800 },
  { month: "Jun", incomes: 8500, expenses: 4600 },
  { month: "Jul", incomes: 8800, expenses: 4900 },
  { month: "Aug", incomes: 9200, expenses: 5100 },
  { month: "Sep", incomes: 8600, expenses: 4700 },
  { month: "Oct", incomes: 8900, expenses: 4800 },
  { month: "Nov", incomes: 9100, expenses: 5000 },
  { month: "Dec", incomes: 9500, expenses: 5200 },
];

export default function TotalFinancesChart() {
  return (
    <div className="bg-white p-6 rounded-[20px] border border-gray-200 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-medium text-[#1b263b]">Total finances</h3>
        <div className="flex items-center text-[13px] font-medium text-[#778da9] gap-2">
          2024
          <ChevronDownIcon width={11} height={6} color="#778da9" />
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <ChartContainer config={chartConfig} className="w-full h-full">
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <defs>
                <linearGradient id="colorIncomes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#150578" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#150578" stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff8600" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#ff8600" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 13, fill: '#778da9' }}
                className="text-[13px] font-medium text-[#778da9]"
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 13, fill: '#778da9' }}
                tickFormatter={(value) => `$${value/1000}k`}
                className="text-[13px] font-medium text-[#778da9]"
              />
              <ChartTooltip 
                content={<ChartTooltipContent 
                  formatter={(value, name) => [`$${value.toLocaleString()}`, chartConfig[name as keyof typeof chartConfig]?.label]}
                  labelFormatter={(label) => `Month: ${label}`}
                />} 
              />
              <Area
                type="monotone"
                dataKey="incomes"
                stackId="1"
                stroke="#150578"
                strokeWidth={2}
                fill="url(#colorIncomes)"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stackId="2"
                stroke="#ff8600"
                strokeWidth={2}
                fill="url(#colorExpenses)"
              />
            </AreaChart>
          </ChartContainer>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#150578] rounded-full"></div>
          <span className="text-[15px] font-medium text-[#778da9]">Incomes</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#ff8600] rounded-full"></div>
          <span className="text-[15px] font-medium text-[#778da9]">Expenses</span>
        </div>
      </div>
    </div>
  );
}