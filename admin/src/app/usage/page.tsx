"use client";

import React from 'react';
import MainLayout from '@/components/MainLayout';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  CartesianGrid,
  BarChart,
  Bar,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

function numberFmt(n: number) {
  return new Intl.NumberFormat().format(n);
}

// Simple halfdonut gauge
function SemiGauge({ value = 45, color = '#3b82f6' }: { value: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const data = [
    { name: 'value', value: clamped },
    { name: 'rest', value: 100 - clamped },
  ];
  return (
    <div className="relative w-full h-36">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={80}
            stroke="none"
          >
            <Cell key="val" fill={color} />
            <Cell key="rest" fill="#e5e7eb" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-900">{clamped}</div>
        </div>
      </div>
    </div>
  );
}

export default function UsagePage() {
  const [period, setPeriod] = React.useState<'1M'|'3M'|'6M'|'1Y'>('1M');

  // Mock data
  const userbaseData = [
    { date: 'Feb 1', value: 19000 },
    { date: 'May 8', value: 18000 },
    { date: 'May 10', value: 18500 },
    { date: 'May 12', value: 20500 },
    { date: 'May 15', value: 20000 },
    { date: 'May 18', value: 22000 },
    { date: 'May 27', value: 22500 },
    { date: 'Feb 28', value: 21000 },
    { date: 'Feb 28', value: 21000 },
    { date: 'Feb 28', value: 21000 },
    { date: 'Jun 1', value: 21800 },
  ];

  const durationData = [
    { day: 'Mo', Free: 8, Entrepreneur: 18, Business: 20 },
    { day: 'Tu', Free: 7, Entrepreneur: 16, Business: 22 },
    { day: 'We', Free: 10, Entrepreneur: 20, Business: 21 },
    { day: 'Th', Free: 9, Entrepreneur: 19, Business: 23 },
    { day: 'Fr', Free: 12, Entrepreneur: 22, Business: 24 },
    { day: 'Sa', Free: 6, Entrepreneur: 12, Business: 20 },
    { day: 'Su', Free: 8, Entrepreneur: 14, Business: 21 },
  ];

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Top: Userbase area */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Userbase</p>
              <div className="mt-2 text-3xl md:text-4xl font-semibold text-gray-900">24,263</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2 text-xs">
                {(['1M','3M','6M','1Y'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-2 py-1 rounded font-medium transition-colors ${
                      period === p ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-500">
                <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 font-medium mr-1">+23%</span>
                vs last month
              </div>
            </div>
          </div>
          <div className="mt-4 h-56 md:h-64 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userbaseData} margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="usage-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
                          <div className="text-xs text-gray-500 mb-1">{label}</div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-xs">Growth</span>
                            <span className="text-xs font-semibold text-gray-900">
                              {numberFmt((payload[0].value as number) - 19000)}+
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#usage-gradient)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Usage Summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 lg:col-span-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Usage Summary</h3>
                <p className="text-xs text-gray-500 mt-1">From 1-31 May, 2024</p>
              </div>
              <button className="text-xs font-medium text-blue-600 hover:text-blue-700">View report</button>
            </div>

            {/* Metrics row 1 */}
            <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="flex items-center gap-2 text-gray-500">
                  <span className="inline-block w-1 h-4 bg-blue-500 rounded" /> Daily Users
                </div>
                <div className="text-lg font-semibold text-gray-900">2,562</div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-gray-500">
                  <span className="inline-block w-1 h-4 bg-yellow-400 rounded" /> Churn
                </div>
                <div className="text-lg font-semibold text-gray-900">57</div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-gray-500">
                  <span className="inline-block w-1 h-4 bg-gray-400 rounded" /> Inactive
                </div>
                <div className="text-lg font-semibold text-gray-900">4,162</div>
              </div>
            </div>

            {/* Gauges */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <span className="inline-block w-1 h-4 bg-green-500 rounded" /> Free
                  <span className="ml-2 inline-block w-1 h-4 bg-sky-600 rounded" /> Entrepreneur
                  <span className="ml-2 inline-block w-1 h-4 bg-blue-500 rounded" /> Business
                </div>
                <div className="mt-1 text-xl font-semibold text-gray-900">1,253 <span className="text-sm font-normal text-gray-500">Free</span></div>
                <SemiGauge value={45} color="#3b82f6" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <span className="inline-block w-1 h-4 bg-green-500 rounded" /> Free
                  <span className="ml-2 inline-block w-1 h-4 bg-sky-600 rounded" /> Entrepreneur
                  <span className="ml-2 inline-block w-1 h-4 bg-blue-500 rounded" /> Business
                </div>
                <div className="mt-1 text-xl font-semibold text-gray-900">4,162 <span className="text-sm font-normal text-gray-500">Business</span></div>
                <SemiGauge value={45} color="#ef4444" />
              </div>
            </div>
          </div>

          {/* Usage Duration */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold text-gray-900">Usage Duration</h3>
              <div className="text-xs text-gray-500">This week</div>
            </div>
            <div className="mt-4 h-64 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={durationData} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis domain={[0, 24]} tickFormatter={(v) => `${v}H`} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [`${v}h`, ''] as any} />
                  <Bar dataKey="Free" fill="#16a34a" radius={[4,4,0,0]} />
                  <Bar dataKey="Entrepreneur" fill="#2563eb" radius={[4,4,0,0]} />
                  <Bar dataKey="Business" fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-600 inline-block" /> Free</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" /> Entrepreneur</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Business</div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
