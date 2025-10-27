// src/components/widgets/MetricCard.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MetricCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  period?: string;
  chartData?: Array<{ date: string; value: number }>;
}

export default function MetricCard({
  title,
  value,
  subValue,
  change,
  changeType = 'neutral',
  period,
  chartData
}: MetricCardProps) {
  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        {change && (
          <Badge
            variant={changeType === 'positive' ? 'default' : 'secondary'}
            className={changeType === 'positive' ? 'bg-green-100 text-green-800' :
                       changeType === 'negative' ? 'bg-red-100 text-red-800' :
                       'bg-gray-100 text-gray-800'}
          >
            {change}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
        {period && <p className="text-xs text-gray-500">{period}</p>}
      </CardContent>
    </Card>
  );
}