"use client";
import React from 'react';
import { LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { ChartContainer } from '@/components/ui/chart';
import ChevronDownIcon from '../icons/ChevronDownIcon';

interface Stock {
  name: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  chartColor: string;
  chartData: { x: number; y: number }[];
}

export default function StockMarketSection() {
  const stocks: Stock[] = [
    { 
      name: 'Apple', 
      value: '$101.40', 
      change: '+3.32%', 
      changeType: 'positive', 
      chartColor: '#63d51d',
      chartData: [
        { x: 0, y: 20 }, { x: 1, y: 15 }, { x: 2, y: 25 }, { x: 3, y: 18 }, { x: 4, y: 10 }, { x: 5, y: 5 }
      ]
    },
    { 
      name: 'Gold', 
      value: '$2,417.4', 
      change: '+2.49%', 
      changeType: 'positive', 
      chartColor: '#ff8600',
      chartData: [
        { x: 0, y: 25 }, { x: 1, y: 20 }, { x: 2, y: 15 }, { x: 3, y: 12 }, { x: 4, y: 8 }, { x: 5, y: 5 }
      ]
    },
    { 
      name: 'Tesla', 
      value: '$1046.5', 
      change: '-2.47%', 
      changeType: 'negative', 
      chartColor: '#3b82f6',
      chartData: [
        { x: 0, y: 10 }, { x: 1, y: 15 }, { x: 2, y: 20 }, { x: 3, y: 18 }, { x: 4, y: 22 }, { x: 5, y: 25 }
      ]
    },
  ];

  const MiniChart = ({ color, trend, data }: { color: string; trend: 'up' | 'down'; data: { x: number; y: number }[] }) => {
    return (
      <div className="w-[60px] h-[30px]">
        <ChartContainer config={{}} className="w-full h-full">
            <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <Line
                type="monotone"
                dataKey="y"
                stroke={color}
                strokeWidth={2}
                dot={{ fill: color, strokeWidth: 0, r: 1.5 }}
                activeDot={false}
              />
            </LineChart>
          </ChartContainer>
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-[20px] border border-gray-200 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-medium text-[#1b263b]">Stock market</h3>
        <div className="flex items-center text-[13px] font-medium text-[#778da9] gap-2">
          Today
          <ChevronDownIcon width={11} height={6} color="#778da9" />
        </div>
      </div>
      
      <div className="flex gap-16">
        {/* Left side - Performance Summary */}
        <div className="flex-1">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl font-normal text-[#63d51d]">+$501.21</span>
              <div className="flex items-center gap-1 text-[18px] font-normal text-[#63d51d]">
                <span>+10.11%</span>
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
            <p className="text-[13px] font-normal text-[#778da9] leading-[20px]">
              In the last 24 hours, your assets have increased by 10%. Get a personal selection of worlds best recommended{' '}
              <span className="text-[#150578] font-medium underline cursor-pointer">
                companies
              </span>{' '}
              for investment
            </p>
          </div>
        </div>
        
        {/* Right side - Individual Stocks */}
        <div className="flex gap-8">
          {/* Stock names */}
          <div className="flex flex-col gap-10">
            {stocks.map((stock) => (
              <div key={stock.name} className="text-[18px] font-medium text-[#1b263b]">
                {stock.name}
              </div>
            ))}
          </div>
          
          {/* Mini charts */}
          <div className="flex flex-col gap-6">
            {stocks.map((stock) => (
              <div key={`${stock.name}-chart`} className="h-8 flex items-center">
                <MiniChart 
                  color={stock.chartColor} 
                  trend={stock.changeType === 'positive' ? 'up' : 'down'}
                  data={stock.chartData}
                />
              </div>
            ))}
          </div>
          
          {/* Stock values and changes */}
          <div className="flex flex-col gap-8">
            {stocks.map((stock) => (
              <div key={`${stock.name}-value`} className="text-right">
                <div className="text-[15px] font-medium text-[#1b263b] mb-1">{stock.value}</div>
                <div className={`text-[13px] font-medium ${
                  stock.changeType === 'positive' ? 'text-[#63d51d]' : 'text-[#ff8600]'
                }`}>
                  {stock.change}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}