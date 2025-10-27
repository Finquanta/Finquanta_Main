"use client";

import React from 'react';
import MainLayout from '@/components/MainLayout';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, CartesianGrid } from 'recharts';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  return <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">{initials}</div>;
}

export default function FinancesPage() {
  const [period, setPeriod] = React.useState<'1M'|'3M'|'6M'|'1Y'>('1M');

  const revenueData = [
    { date: 'Feb 1', value: 18000 },
    { date: 'May 8', value: 17500 },
    { date: 'May 10', value: 18200 },
    { date: 'May 12', value: 19700 },
    { date: 'May 15', value: 19100 },
    { date: 'May 18', value: 21000 },
    { date: 'May 27', value: 21400 },
    { date: 'Feb 28', value: 20300 },
    { date: 'Feb 28', value: 20300 },
    { date: 'Jun 1', value: 22135 },
  ];

  const subs = [
    { name:'Mickey mike', company:'JJ Family Company', date:'May 1, 2024', time:'08:00 AM', plan:'Business', tier:'Corporate', trend:'down' as const },
    { name:'Hannah Noah', company:'Pizza Hut', date:'May 3, 2024', time:'08:00 AM', plan:'Entrepreneur', tier:'Business', trend:'right' as const },
    { name:'Kristin Watson', company:'Nintendo', date:'May 5, 2024', time:'08:00 AM', plan:'Corporate', tier:'Free', trend:'up' as const },
    { name:'Cameron William', company:'eBay', date:'May 12, 2024', time:'08:00 AM', plan:'Entrepreneur', tier:'Free', trend:'up' as const },
    { name:'Ahmad Ali', company:'eBay', date:'May 19, 2022', time:'08:00 AM', plan:'Corporate', tier:'Entrepreneur', trend:'up' as const },
  ];

  const churns = [
    { name:'Mickey mike', company:'JJ Family Company', date:'May 1, 2024', time:'08:00 AM', action:'Deactivate', sub:'Account' },
    { name:'Hannah Noah', company:'Pizza Hut', date:'May 3, 2024', time:'08:00 AM', action:'Refund', sub:'Plan' },
    { name:'Kristin Watson', company:'Nintendo', date:'May 5, 2024', time:'08:00 AM', action:'Cancellation', sub:'Plan' },
    { name:'Cameron William', company:'eBay', date:'May 12, 2024', time:'08:00 AM', action:'Refund', sub:'Plan' },
    { name:'Ahmad Ali', company:'eBay', date:'May 19, 2022', time:'08:00 AM', action:'Downgrade', sub:'Account' },
  ];

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Revenue card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Revenue</p>
              <div className="mt-2 text-3xl md:text-4xl font-semibold text-gray-900">$22,135<span className="text-gray-400 text-2xl align-top">.69</span></div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2 text-xs">
                {(['1M','3M','6M','1Y'] as const).map((p) => (
                  <button key={p} onClick={()=>setPeriod(p)} className={`px-2 py-1 rounded font-medium ${period===p?'bg-gray-900 text-white':'text-gray-500 hover:text-gray-700'}`}>{p}</button>
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
              <AreaChart data={revenueData} margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="rev-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip content={({active,payload,label})=> active && payload && payload.length ? (
                  <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">{label}</div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-xs">Revenue</span>
                      <span className="text-xs font-semibold text-gray-900">${Number(payload[0].value).toLocaleString()}</span>
                    </div>
                  </div>
                ) : null} />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#rev-gradient)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subscriptions & Payments */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Subscriptions & Payments</h3>
              <button className="text-xs text-blue-600 font-medium">See All</button>
            </div>
            <ul className="divide-y divide-gray-100">
              {subs.map((u)=> (
                <li key={u.name} className="py-3">
                  <div className="grid grid-cols-[1.6fr_1fr_auto] items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={u.name} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-500 truncate">{u.company}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.date}</p>
                      <p className="text-xs text-gray-500">{u.time}</p>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      {u.trend==='down' ? (
                        <ArrowDownRight className="w-4 h-4 text-red-500" />
                      ) : u.trend==='up' ? (
                        <ArrowUpRight className="w-4 h-4 text-green-600" />
                      ) : null}
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{u.plan}</p>
                        <p className="text-xs text-gray-500">{u.tier}</p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Churns & Refunds */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Churns & Refunds</h3>
              <button className="text-xs text-blue-600 font-medium">See All</button>
            </div>
            <ul className="divide-y divide-gray-100">
              {churns.map((u)=> (
                <li key={u.name} className="py-3">
                  <div className="grid grid-cols-[1.6fr_1fr_auto] items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={u.name} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-500 truncate">{u.company}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.date}</p>
                      <p className="text-xs text-gray-500">{u.time}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{u.action}</p>
                      <p className="text-xs text-gray-500">{u.sub}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
