// src/components/widgets/ChartWidget.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartData {
  date: string;
  value: number;
}

interface ChartWidgetProps {
  title: string;
  data: ChartData[];
  type?: 'line' | 'bar';
  height?: number;
}

export default function ChartWidget({
  title,
  data,
  type = 'line',
  height = 200
}: ChartWidgetProps) {
  // Simple SVG chart implementation
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: `${height}px` }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${data.length * 50} ${height}`}>
            {data.map((point, index) => {
              const x = index * 50 + 25;
              const y = height - ((point.value - minValue) / range) * (height - 40) - 20;

              return (
                <g key={index}>
                  {type === 'line' && index > 0 && (
                    <line
                      x1={(index - 1) * 50 + 25}
                      y1={height - ((data[index - 1].value - minValue) / range) * (height - 40) - 20}
                      x2={x}
                      y2={y}
                      stroke="#ff8600"
                      strokeWidth="2"
                    />
                  )}
                  {type === 'bar' && (
                    <rect
                      x={x - 15}
                      y={y}
                      width="30"
                      height={height - y - 20}
                      fill="#ff8600"
                    />
                  )}
                  <circle cx={x} cy={y} r="3" fill="#ff8600" />
                  <text
                    x={x}
                    y={height - 5}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#666"
                  >
                    {point.date}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}