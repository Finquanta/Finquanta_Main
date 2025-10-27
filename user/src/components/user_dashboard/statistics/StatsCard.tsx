import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import ChevronDownIcon from '../icons/ChevronDownIcon';

interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  period: string;
  description: string;
  icon?: string;
}

export default function StatsCard({
  title,
  value,
  change,
  changeType,
  period,
  description,
  icon
}: StatsCardProps) {
  const isPositive = changeType === 'positive';

  // Determine value color based on the card type
  const getValueColor = () => {
    if (title.toLowerCase().includes('revenue') || title.toLowerCase().includes('income')) {
      return 'text-[#63d51d]'; // Success green
    } else if (title.toLowerCase().includes('expenses') || title.toLowerCase().includes('cost')) {
      return 'text-[#ff8600]'; // Brand orange
    } else if (title.toLowerCase().includes('profit')) {
      return 'text-[#150578]'; // Brand primary blue
    } else if (title.toLowerCase().includes('growth') || title.toLowerCase().includes('rate')) {
      return isPositive ? 'text-[#63d51d]' : 'text-[#ff8600]';
    }
    return 'text-[#1b263b]'; // Default text primary
  };

  return (
    <div className="bg-white p-6 rounded-[20px] border border-gray-200 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-[#1b263b]">{title}</h3>
        <div className="flex items-center text-[13px] font-medium text-[#778da9] gap-2">
          {period}
          <ChevronDownIcon width={11} height={6} color="#778da9" />
        </div>
      </div>

      <div className={`text-[36px] font-bold leading-none mb-4 ${getValueColor()}`}>
        {value}
      </div>

      <div className="flex items-start justify-between mt-auto gap-3">
        <p className="text-[12px] font-normal text-[#778da9] leading-[15px] flex-1">
          {description}
        </p>
        <div className={`flex items-center text-[18px] font-medium gap-1 flex-shrink-0 ${
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