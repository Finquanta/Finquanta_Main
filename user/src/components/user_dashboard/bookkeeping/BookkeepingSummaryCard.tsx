import React from 'react';
import { Info } from 'lucide-react';
import BalanceIcon from '@/components/icons/BalanceIcon';
import IncomeIcon from '@/components/icons/IncomeIcon';
import ExpenseIcon from '@/components/icons/ExpenseIcon';
import { formatCurrency } from '@/mockData/bookkeepingMockData';

interface BookkeepingSummaryCardProps {
  title: string;
  amount: number;
  icon: 'balance' | 'income' | 'expense';
}

export default function BookkeepingSummaryCard({
  title,
  amount,
  icon
}: BookkeepingSummaryCardProps) {
  const getIcon = () => {
    switch (icon) {
      case 'balance':
        return <BalanceIcon width={24} height={24} className="text-white" />;
      case 'income':
        return <IncomeIcon width={24} height={24} className="text-purple-600" />;
      case 'expense':
        return <ExpenseIcon width={24} height={24} className="text-blue-600" />;
      default:
        return <BalanceIcon width={24} height={24} className="text-white" />;
    }
  };

  const getIconBackground = () => {
    switch (icon) {
      case 'balance':
        return 'bg-gray-800';
      case 'income':
        return 'bg-purple-100';
      case 'expense':
        return 'bg-blue-100';
      default:
        return 'bg-gray-100';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 flex items-center gap-6">
      <div className={`p-3 rounded-lg ${getIconBackground()}`}>
        {getIcon()}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-gray-600">{title}</span>
          <Info className="h-3 w-3 text-gray-400" />
        </div>
        <div className="text-4xl font-semibold text-gray-900 leading-tight">
          {formatCurrency(amount)}
        </div>
      </div>
    </div>
  );
}