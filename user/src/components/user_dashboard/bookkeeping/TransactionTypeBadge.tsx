import React from 'react';

interface TransactionTypeBadgeProps {
  type: string;
}

export default function TransactionTypeBadge({ type }: TransactionTypeBadgeProps) {
  const getTypeStyles = (type: string) => {
    switch (type.toLowerCase()) {
      case 'sale':
        return 'bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium';
      case 'service':
        return 'bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium';
      case 'investment':
        return 'bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-medium';
      case 'rent':
        return 'bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium';
      case 'utilities':
        return 'bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium';
      case 'deposited':
        return 'bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium';
      case 'withdrawal':
        return 'bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-medium';
      default:
        return 'bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-medium';
    }
  };

  return (
    <span className={getTypeStyles(type)}>
      {type}
    </span>
  );
}