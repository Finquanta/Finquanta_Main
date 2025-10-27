'use client';

import React, { useState } from 'react';
import { StatisticsTableData } from '@/mockData/statisticsMockData';
import { TrendingUp, TrendingDown, ChevronDownIcon } from 'lucide-react';

interface StatisticsTableProps {
  data: StatisticsTableData[];
}

export default function StatisticsTable({ data }: StatisticsTableProps) {
  const [sortField, setSortField] = useState<keyof StatisticsTableData | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Sort and paginate data
  const sortedData = React.useMemo(() => {
    if (!sortField) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortField, sortDirection]);

  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(data.length / itemsPerPage);

  const handleSort = (field: keyof StatisticsTableData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getGrowthIcon = (rate: number) => {
    if (rate > 0) {
      return <TrendingUp className="h-4 w-4 text-[#63d51d]" />;
    } else if (rate < 0) {
      return <TrendingDown className="h-4 w-4 text-[#ff8600]" />;
    }
    return null;
  };

  const getGrowthColor = (rate: number) => {
    if (rate > 0) return 'text-[#63d51d]';
    if (rate < 0) return 'text-[#ff8600]';
    return 'text-[#778da9]';
  };

  return (
    <div className="bg-white p-6 rounded-[20px] border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-[#1b263b]">Monthly Statistics</h3>
        <div className="flex items-center gap-4">
          <button className="px-4 py-2 text-sm font-medium text-[#150578] border border-[#150578] rounded-lg hover:bg-[#150578] hover:text-white transition-colors">
            Export CSV
          </button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-[#150578] rounded-lg hover:bg-[#0d0342] transition-colors">
            Export PDF
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-[#1b263b]">
                <button
                  onClick={() => handleSort('period')}
                  className="flex items-center gap-1 hover:text-[#150578] transition-colors"
                >
                  Period
                  <ChevronDownIcon width={16} height={16} color="#778da9" />
                </button>
              </th>
              <th className="text-right py-3 px-4 font-medium text-[#1b263b]">
                <button
                  onClick={() => handleSort('income')}
                  className="flex items-center gap-1 hover:text-[#150578] transition-colors ml-auto"
                >
                  Income
                  <ChevronDownIcon width={16} height={16} color="#778da9" />
                </button>
              </th>
              <th className="text-right py-3 px-4 font-medium text-[#1b263b]">
                <button
                  onClick={() => handleSort('expenses')}
                  className="flex items-center gap-1 hover:text-[#150578] transition-colors ml-auto"
                >
                  Expenses
                  <ChevronDownIcon width={16} height={16} color="#778da9" />
                </button>
              </th>
              <th className="text-right py-3 px-4 font-medium text-[#1b263b]">
                <button
                  onClick={() => handleSort('profit')}
                  className="flex items-center gap-1 hover:text-[#150578] transition-colors ml-auto"
                >
                  Profit/Loss
                  <ChevronDownIcon width={16} height={16} color="#778da9" />
                </button>
              </th>
              <th className="text-right py-3 px-4 font-medium text-[#1b263b]">
                <button
                  onClick={() => handleSort('transactions')}
                  className="flex items-center gap-1 hover:text-[#150578] transition-colors ml-auto"
                >
                  Transactions
                  <ChevronDownIcon width={16} height={16} color="#778da9" />
                </button>
              </th>
              <th className="text-right py-3 px-4 font-medium text-[#1b263b]">
                <button
                  onClick={() => handleSort('avgTransaction')}
                  className="flex items-center gap-1 hover:text-[#150578] transition-colors ml-auto"
                >
                  Avg Transaction
                  <ChevronDownIcon width={16} height={16} color="#778da9" />
                </button>
              </th>
              <th className="text-right py-3 px-4 font-medium text-[#1b263b]">
                <button
                  onClick={() => handleSort('growthRate')}
                  className="flex items-center gap-1 hover:text-[#150578] transition-colors ml-auto"
                >
                  Growth Rate
                  <ChevronDownIcon width={16} height={16} color="#778da9" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-4 px-4 font-medium text-[#1b263b]">{row.period}</td>
                <td className="py-4 px-4 text-right text-[#63d51d] font-medium">
                  {formatCurrency(row.income)}
                </td>
                <td className="py-4 px-4 text-right text-[#ff8600] font-medium">
                  {formatCurrency(row.expenses)}
                </td>
                <td className={`py-4 px-4 text-right font-medium ${row.profit >= 0 ? 'text-[#150578]' : 'text-[#dc2626]'}`}>
                  {formatCurrency(row.profit)}
                </td>
                <td className="py-4 px-4 text-right text-[#778da9]">{row.transactions}</td>
                <td className="py-4 px-4 text-right text-[#778da9]">{formatCurrency(row.avgTransaction)}</td>
                <td className="py-4 px-4 text-right">
                  <div className={`flex items-center justify-end gap-1 font-medium ${getGrowthColor(row.growthRate)}`}>
                    {getGrowthIcon(row.growthRate)}
                    {row.growthRate.toFixed(1)}%
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Row */}
      <div className="mt-4 pt-4 border-t border-gray-200 bg-gray-50 -mx-6 px-6 -mb-6 py-4 rounded-b-[20px]">
        <div className="grid grid-cols-7 gap-4 text-sm">
          <div>
            <p className="text-[#778da9] mb-1">Total</p>
            <p className="font-semibold text-[#1b263b]">{data.length} months</p>
          </div>
          <div className="text-right">
            <p className="text-[#778da9] mb-1">Total Income</p>
            <p className="font-semibold text-[#63d51d]">
              {formatCurrency(data.reduce((sum, row) => sum + row.income, 0))}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[#778da9] mb-1">Total Expenses</p>
            <p className="font-semibold text-[#ff8600]">
              {formatCurrency(data.reduce((sum, row) => sum + row.expenses, 0))}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[#778da9] mb-1">Net Profit</p>
            <p className={`font-semibold ${data.reduce((sum, row) => sum + row.profit, 0) >= 0 ? 'text-[#150578]' : 'text-[#dc2626]'}`}>
              {formatCurrency(data.reduce((sum, row) => sum + row.profit, 0))}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[#778da9] mb-1">Total Transactions</p>
            <p className="font-semibold text-[#778da9]">
              {data.reduce((sum, row) => sum + row.transactions, 0)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[#778da9] mb-1">Avg Transaction</p>
            <p className="font-semibold text-[#778da9]">
              {formatCurrency(
                data.reduce((sum, row) => sum + row.income, 0) /
                data.reduce((sum, row) => sum + row.transactions, 0)
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[#778da9] mb-1">Avg Growth Rate</p>
            <p className="font-semibold text-[#63d51d]">
              +{(data.reduce((sum, row) => sum + row.growthRate, 0) / data.length).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
          <div className="text-sm text-[#778da9]">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, data.length)} of {data.length} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 text-sm rounded-md transition-colors ${
                    currentPage === page
                      ? 'bg-[#150578] text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}