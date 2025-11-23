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
    <div className="bg-white p-2 sm:p-3 md:p-4 lg:p-6 rounded-[8px] sm:rounded-[12px] md:rounded-[16px] lg:rounded-[20px] border border-gray-200 h-full flex flex-col overflow-hidden min-w-0 max-w-full w-full" style={{maxWidth: '100vw', minWidth: 0, boxSizing: 'border-box'}}>
      <div className="flex items-center justify-between mb-1 sm:mb-2 md:mb-3 lg:mb-4 min-w-0">
        <h3 className="text-xs sm:text-sm md:text-base lg:text-lg font-medium text-[#1b263b] truncate pr-1 sm:pr-2 flex-1 min-w-0">{title}</h3>
        <div className="flex items-center text-xs sm:text-sm font-medium text-[#778da9] gap-0.5 sm:gap-1 md:gap-2 flex-shrink-0">
          <span className="hidden xs:inline">{period}</span>
          <ChevronDownIcon width={8} height={4} color="#778da9" />
        </div>
      </div>

      <div className={`text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-normal leading-none mb-1 sm:mb-2 md:mb-3 lg:mb-4 ${getAmountColor()} break-words`}>
        {amount}
      </div>

      <div className="flex items-start justify-between mt-auto gap-0.5 sm:gap-1 md:gap-2 lg:gap-4 min-w-0">
        <p className="text-xs text-[#778da9] leading-tight line-clamp-1 sm:line-clamp-2 flex-1 min-w-0 break-words">
          {description}
        </p>
        <div className={`flex items-center text-xs sm:text-sm md:text-base font-normal gap-0.5 sm:gap-1 flex-shrink-0 ${isPositive ? 'text-[#63d51d]' : 'text-[#ff8600]'
          }`}>
          <span className="truncate max-w-[40px] sm:max-w-[60px] md:max-w-[80px]">{change}</span>
          {isPositive ? (
            <TrendingUp className="h-3 w-3 sm:h-3 sm:w-3 md:h-4 md:w-4 lg:h-5 lg:w-5 flex-shrink-0" />
          ) : (
            <TrendingDown className="h-3 w-3 sm:h-3 sm:w-3 md:h-4 md:w-4 lg:h-5 lg:w-5 flex-shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}