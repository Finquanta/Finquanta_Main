"use client";
import React from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import ChevronDownIcon from '../icons/ChevronDownIcon';

const chartConfig = {
  goods: {
    label: "Goods",
    color: "#150578",
  },
  services: {
    label: "Services", 
    color: "#034078",
  },
  subscriptions: {
    label: "Subscriptions",
    color: "#ff8600",
  },
  other: {
    label: "Other",
    color: "#1282a2",
  },
};

const chartData = [
  { name: 'Goods', value: 40, fill: '#150578' },
  { name: 'Services', value: 30, fill: '#034078' },
  { name: 'Subscriptions', value: 20, fill: '#ff8600' },
  { name: 'Other', value: 10, fill: '#1282a2' }
];

export default function TotalExpensesCard() {
  const CustomLabel = ({ cx, cy }: { cx: number; cy: number }) => {
    return (
      <g>
        <text x={cx} y={cy - 10} textAnchor="middle" dominantBaseline="middle" className="fill-[#1b263b] text-[15px] font-semibold">
          Total expenses
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle" className="fill-[#ff8600] text-2xl font-bold">
          -$1980
        </text>
      </g>
    );
  };

  return (
    <div className="bg-white p-6 rounded-[20px] border border-gray-200 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-medium text-[#1b263b]">Total expenses</h3>
        <div className="flex items-center text-[13px] font-medium text-[#778da9] gap-2">
          May 2024
          <ChevronDownIcon width={11} height={6} color="#778da9" />
        </div>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Donut Chart */}
        <div className="relative mb-4 w-[244px] h-[244px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip 
                  content={<ChartTooltipContent 
                    formatter={(value) => [`${value}%`, 'Percentage']}
                    labelFormatter={(label) => `Category: ${label}`}
                  />} 
                />
              </PieChart>
            </ChartContainer>
          
          {/* Center text - positioned absolutely */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-[15px] font-semibold text-[#1b263b] mb-1">Total expenses</div>
              <div className="text-2xl font-bold text-[#ff8600]">-$1980</div>
            </div>
          </div>
        </div>
        
        {/* Description text */}
        <div className="text-center space-y-2 max-w-[300px] mb-6">
          <p className="text-[13px] font-normal text-[#778da9] leading-relaxed">
            This month you spent the most on goods and services. Spending is 10% higher than last month
          </p>
          <p className="text-[13px] font-normal text-[#778da9]">
            Try <span className="text-[#ff8600] underline cursor-pointer hover:text-[#e67700]">planning your expenses</span> for the next month
          </p>
        </div>
        
        {/* Legend */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[15px] font-medium">
          {chartData.map((segment) => (
            <div key={segment.name} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full" style={{ backgroundColor: segment.fill }}></div>
              <span className="text-[#778da9]">{segment.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}