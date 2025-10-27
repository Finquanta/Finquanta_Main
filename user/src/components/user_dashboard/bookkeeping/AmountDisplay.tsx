import React from 'react';
import { formatAmount } from '@/mockData/bookkeepingMockData';

interface AmountDisplayProps {
  amount: number;
  className?: string;
}

export default function AmountDisplay({ amount, className = '' }: AmountDisplayProps) {
  const isPositive = amount >= 0;
  const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
  
  return (
    <span className={`text-sm font-semibold ${colorClass} ${className}`}>
      {formatAmount(amount)}
    </span>
  );
}