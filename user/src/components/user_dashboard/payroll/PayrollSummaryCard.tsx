'use client';

import React from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/mockData/payrollMockData';

interface PayrollSummaryProps {
  data?: {
    period: { start: Date; end: Date };
    payment: number;
    pending: number;
    paid: number;
    completionPercentage: number;
  };
}

export default function PayrollSummaryCard({ data }: PayrollSummaryProps) {
  if (!data) return null;

  const summaryData = [
    { name: 'Payment', value: data.payment, color: '#51c6fb', label: 'Payment' },
    { name: 'Pending', value: data.pending, color: '#0a112f', label: 'Pending' },
    { name: 'Paid', value: data.paid, color: '#3981f7', label: 'Paid' }
  ];

  const chartConfig = {
    payment: { label: 'Payment', color: '#51c6fb' },
    pending: { label: 'Pending', color: '#0a112f' },
    paid: { label: 'Paid', color: '#3981f7' }
  };

  // Calculate total for percentage
  const total = data.payment + data.pending + data.paid;
  
  // Data for the donut chart
  const pieData = summaryData.map(item => ({
    name: item.name,
    value: item.value,
    percentage: Math.round((item.value / total) * 100)
  }));

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-medium text-[#0a112f]">Payroll Summary</h3>
          <Button variant="ghost" size="sm" className="text-[#3981f7] hover:text-[#3981f7]/80 p-0 h-auto font-normal">
            View report
          </Button>
        </div>
        <p className="text-base text-[#70707a] mt-1">
          From {formatDate(data.period.start)}, 2024
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-8 mb-8">
          {summaryData.map((item, index) => (
            <div key={item.name} className="flex items-start gap-3">
              <div className="w-1 h-14 rounded-full" style={{ backgroundColor: item.color }} />
              <div className="flex-1">
                <div className="text-sm text-[#70707a] mb-1">{item.label}</div>
                <div className="text-2xl font-medium text-[#0a112f] tracking-tight">
                  {formatCurrency(item.value)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Donut Chart */}
        <div className="flex justify-center">
          <div className="relative">
            <ChartContainer config={chartConfig} className="w-32 h-32">
                <PieChart width={128} height={128}>
                  <Pie
                    data={pieData}
                    cx={64}
                    cy={64}
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={summaryData[index].color} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            
            {/* Center percentage */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-xl font-medium text-[#0a112f]">{data.completionPercentage}%</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}