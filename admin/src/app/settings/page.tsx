"use client";

import React from 'react';
import MainLayout from '@/components/MainLayout';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, Tooltip } from 'recharts';

interface QuickSetting {
  title: string;
  desc: string;
}

const quickSettings: QuickSetting[] = [
  { title: 'Account Profile', desc: 'Manage your personal information and avatar' },
  { title: 'Security', desc: 'Password, 2FA and session controls' },
  { title: 'Notifications', desc: 'Email, in-app and push preferences' },
  { title: 'Billing', desc: 'Plans, invoices and payment methods' },
  { title: 'Integrations', desc: 'Connect third‑party services and webhooks' },
  { title: 'Team & Roles', desc: 'Invite teammates and manage permissions' },
  { title: 'API Keys', desc: 'Create and rotate API credentials' },
  { title: 'Usage & Limits', desc: 'Track consumption and quotas' },
  { title: 'Data & Privacy', desc: 'Export/delete data and privacy settings' },
];

const healthData = [
  { date: 'Feb 1', score: 84 },
  { date: 'May 8', score: 80 },
  { date: 'May 10', score: 82 },
  { date: 'May 12', score: 81 },
  { date: 'May 15', score: 79 },
  { date: 'May 27', score: 88 },
  { date: 'Feb 28', score: 87 },
  { date: 'Jun 1', score: 90 },
];

function healthLabel(v: number){
  if (v >= 85) return 'Great';
  if (v >= 70) return 'Good';
  return 'Fair';
}

export default function SettingsPage() {
  const [query, setQuery] = React.useState('');
  const [period, setPeriod] = React.useState<'1M'|'3M'|'6M'|'1Y'>('1M');

  const filtered = React.useMemo(()=>{
    const q = query.trim().toLowerCase();
    if(!q) return quickSettings;
    return quickSettings.filter(s => (s.title + ' ' + s.desc).toLowerCase().includes(q));
  }, [query]);

  const renderHealthTooltip = ({active,label,payload}: any) => active && payload?.length ? (
    <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200 text-xs">
      <div className="text-gray-500 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"/> {healthLabel(payload[0].value)}</span>
        <span className="font-semibold text-gray-900">{`${payload[0].value}%`}</span>
      </div>
    </div>
  ) : null;

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Top: Settings quick list with search */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
            <div className="mx-auto w-full max-w-md relative">
              <Input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search" className="pl-10 rounded-full h-9" />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">See All</button>
          </div>

          <ul className="px-6 pb-4 space-y-5">
            {filtered.map((s)=> (
              <li key={s.title} className="max-w-md">
                <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                <p className="text-xs text-gray-500">{s.desc}</p>
              </li>
            ))}
          </ul>

          <div className="px-6 py-2 flex items-center justify-end gap-1 text-xs text-gray-400 border-t border-gray-100">
            <button className="p-1 rounded hover:bg-gray-100" aria-label="Previous"><ChevronLeft className="w-4 h-4"/></button>
            <button className="p-1 rounded hover:bg-gray-100" aria-label="Next"><ChevronRight className="w-4 h-4"/></button>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">System Health</h3>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Great</span>
            </div>
            <div className="flex gap-2 text-xs">
              {(['1M','3M','6M','1Y'] as const).map(p => (
                <button key={p} onClick={()=>setPeriod(p)} className={`px-2 py-1 rounded font-medium ${period===p?'bg-gray-900 text-white':'text-gray-500 hover:text-gray-700'}`}>{p}</button>
              ))}
            </div>
          </div>
          <div className="px-2 pb-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={healthData} margin={{ left: 10, right: 10 }}>
                  <defs>
                    <linearGradient id="healthGradientSettings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill:'#94a3b8', fontSize:12 }} />
                  <Tooltip content={renderHealthTooltip} />
                  <Area type="monotone" dataKey="score" stroke="#22c55e" strokeWidth={2} fill="url(#healthGradientSettings)" activeDot={{ r: 4, stroke:'#16a34a', strokeWidth:2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
