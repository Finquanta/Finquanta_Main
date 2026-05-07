'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import FilterDropdown from './FilterDropdown';
import TransactionTypeBadge from './TransactionTypeBadge';
import AmountDisplay from './AmountDisplay';
import { formatDate, formatCurrency, Transaction } from '@/mockData/bookkeepingMockData';
import BookkeepingModal from './BookkeepingModal';

interface ManagementTableProps {
  title: string;
  data: Transaction[];
  actionText: string;
  period?: string;
}

export default function ManagementTable({
  title,
  data,
  actionText,
  period = 'Last 30 days'
}: ManagementTableProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleActionClick = () => setIsModalOpen(true);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-6 sm:w-4 sm:h-8 bg-cyan-400 rounded-sm"></div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{title}</h3>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <FilterDropdown
              value={selectedPeriod}
              onChange={setSelectedPeriod}
            />
            <Button
              onClick={handleActionClick}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold px-4 sm:px-6 py-2 rounded-lg"
            >
              {actionText}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                Detail
              </th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {data.map((row, index) => (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-25">
                <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-900">
                  {formatDate(row.date)}
                </td>
                <td className="px-3 sm:px-6 py-3 sm:py-4">
                  <TransactionTypeBadge type={row.type} />
                </td>
                <td className="px-3 sm:px-6 py-3 sm:py-4">
                  <div className="text-xs sm:text-sm font-semibold text-gray-900">{row.detail}</div>
                  <div className="text-[10px] sm:text-xs text-gray-500 mt-1">Invoice: {row.invoice}</div>
                </td>
                <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-900">
                  {formatCurrency(row.price)}
                </td>
                <td className="px-3 sm:px-6 py-3 sm:py-4">
                  <AmountDisplay amount={row.amount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    <BookkeepingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
}