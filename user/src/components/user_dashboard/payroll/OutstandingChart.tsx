'use client';

import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceDot } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import RevenueIcon from '@/components/icons/RevenueIcon';
import { ChartTimeframe, formatCurrency, formatPercentage } from '@/mockData/payrollMockData';

interface ChartDataPoint {
  date: Date;
  value: number;
  label: string;
  highlighted?: boolean;
}

interface OutstandingChartProps {
  data?: {
    total: number;
    percentageChange: number;
    comparisonPeriod: string;
    chartData: ChartDataPoint[];
    currentDate: Date;
    selectedTimeframe: ChartTimeframe;
  };
}

const timeframes = [
  { key: ChartTimeframe.ONE_MONTH, label: '1M' },
  { key: ChartTimeframe.THREE_MONTHS, label: '3M' },
  { key: ChartTimeframe.SIX_MONTHS, label: '6M' },
  { key: ChartTimeframe.ONE_YEAR, label: '1Y' }
];

export default function OutstandingChart({ data }: OutstandingChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>(
    data?.selectedTimeframe || ChartTimeframe.ONE_YEAR
  );

  if (!data) return null;

  const chartConfig = {
    value: {
      label: 'Revenue',
      color: '#3b82f6',
    },
  };

  // Transform data for recharts
  const chartData = data.chartData.map((point, index) => ({
    name: point.label,
    value: point.value,
    highlighted: point.highlighted,
    originalDate: point.date
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (data.highlighted) {
        return (
          <div className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm">
            <div className="flex items-center gap-2">
              <RevenueIcon width={16} height={16} />
              <span>Revenue: {formatCurrency(data.value)}</span>
            </div>
          </div>
        );
      }
    }
    return null;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-medium text-[#0a112f] mb-2">Total Outstanding</h3>
            <div className="flex items-center gap-2">
              <span className="text-4xl font-medium text-[#0a112f] tracking-tight">
                {formatCurrency(Math.floor(data.total))}
              </span>
              <span className="text-sm text-[#9096a2]">
                .{(data.total % 1).toFixed(2).slice(2)}
              </span>
              <div className="flex items-center gap-1 ml-4">
                <span className="text-sm font-medium text-[#0aaf60]">
                  {formatPercentage(data.percentageChange)}
                </span>
                <span className="text-sm text-[#70707a]">vs {data.comparisonPeriod}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
            {timeframes.map((timeframe) => (
              <Button
                key={timeframe.key}
                variant={selectedTimeframe === timeframe.key ? "default" : "ghost"}
                size="sm"
                className={`text-sm px-3 py-1 h-8 ${
                  selectedTimeframe === timeframe.key 
                    ? 'bg-white shadow-sm text-[#0a112f]' 
                    : 'text-[#70707a] hover:text-[#0a112f]'
                }`}
                onClick={() => setSelectedTimeframe(timeframe.key)}
              >
                {timeframe.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="h-64 w-full">
          <ChartContainer config={chartConfig} className="w-full h-full">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9096a2' }}
                  className="text-xs"
                />
                <YAxis hide />
                <ChartTooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, stroke: '#1f2937', strokeWidth: 2, fill: '#3b82f6' }}
                />
                {/* Highlight specific point */}
                {chartData.map((point, index) => 
                  point.highlighted ? (
                    <ReferenceDot
                      key={index}
                      x={point.name}
                      y={point.value}
                      r={6}
                      fill="#3b82f6"
                      stroke="#1f2937"
                      strokeWidth={2}
                    />
                  ) : null
                )}
              </LineChart>
            </ChartContainer>
        </div>

        <div className="mt-4 text-sm text-[#70707a]">
          <span className="font-medium">Tuesday, may 28, 2024</span>
        </div>
      </CardContent>
    </Card>
  );
}