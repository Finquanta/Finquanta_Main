"use client";

import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

interface StatCardProps {
  title: string;
  value: string;
  subValue?: string;
  change: string;
  changeType: 'positive' | 'negative';
  period: string;
  chartData: Array<{ date: string; value: number }>;
  timeFilters?: string[];
}

export default function StatCard({
  title,
  value,
  subValue,
  change,
  changeType,
  period,
  chartData,
  timeFilters = ['1M', '3M', '6M', '1Y']
}: StatCardProps) {
  const [activeFilter, setActiveFilter] = React.useState('1M');

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <div className="flex gap-2">
          {timeFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                activeFilter === filter
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Value */}
      <div className="mb-2">
        <span className="text-3xl font-semibold text-gray-900">{value}</span>
        {subValue && (
          <span className="text-lg text-gray-400 ml-1">{subValue}</span>
        )}
      </div>

      {/* Change Indicator */}
      <div className="flex items-center gap-2 mb-6">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            changeType === 'positive'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {change}
        </span>
        <span className="text-xs text-gray-500">{period}</span>
      </div>

      {/* Chart */}
      <div className="h-32 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-xs font-medium text-gray-600">{title}</span>
                        <span className="text-xs font-semibold text-gray-900">
                          {payload[0].value?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              fill={`url(#gradient-${title})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-gray-600">{period}</span>
            <span className="font-semibold text-gray-900">{subValue || value}</span>
          </div>
          <span className="text-gray-400">{chartData[chartData.length - 1]?.date}</span>
        </div>
      </div>
    </div>
  );
}

