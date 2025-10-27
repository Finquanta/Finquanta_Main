import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import ChevronDownIcon from '../icons/ChevronDownIcon';

interface SummaryCardProps {
  title: string;
  amount: string;
  change: string;
  changeType: 'positive' | 'negative';
  period: string;
  description: string;
}

export default function SummaryCard({
  title,
  amount,
  change,
  changeType,
  period,
  description
}: SummaryCardProps) {
  const isPositive = changeType === 'positive';
  
  // Determine amount color based on the title/type
  const getAmountColor = () => {
    if (title.toLowerCase().includes('balance')) {
      return 'text-[#150578]'; // Brand primary blue
    } else if (title.toLowerCase().includes('expenses')) {
      return 'text-[#ff8600]'; // Brand orange
    } else if (title.toLowerCase().includes('income')) {
      return 'text-[#63d51d]'; // Success green
    }
    return 'text-[#1b263b]'; // Default text primary
  };
  
  return (
    <div className="bg-white p-6 rounded-[20px] border border-gray-200 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-medium text-[#1b263b]">{title}</h3>
        <div className="flex items-center text-sm font-medium text-[#778da9] gap-2">
          {period}
          <ChevronDownIcon width={10} height={5} color="#778da9" />
        </div>
      </div>

      <div className={`text-3xl font-normal leading-none mb-4 ${getAmountColor()}`}>
        {amount}
      </div>

      <div className="flex items-start justify-between mt-auto gap-4">
        <p className="text-xs text-[#778da9] leading-tight line-clamp-2 flex-1">
          {description}
        </p>
        <div className={`flex items-center text-lg font-normal gap-1 ${
          isPositive ? 'text-[#63d51d]' : 'text-[#ff8600]'
        }`}>
          {change}
          {isPositive ? (
            <TrendingUp className="h-5 w-5" />
          ) : (
            <TrendingDown className="h-5 w-5" />
          )}
        </div>
      </div>
    </div>
  );
}