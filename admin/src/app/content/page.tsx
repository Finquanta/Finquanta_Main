"use client";

import React from 'react';
import MainLayout from '@/components/MainLayout';
import { ResponsiveContainer, LineChart, Line, XAxis, CartesianGrid, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { Clock, RefreshCw } from 'lucide-react';

export default function ContentPage() {
  const [period,setPeriod] = React.useState<'1M'|'3M'|'6M'|'1Y'>('1M');

  const impressions = [
    { date:'Feb 1', Blog:38235, News:30210, Letter:29500, Socials:28110 },
    { date:'May 8', Blog:37500, News:29800, Letter:28900, Socials:27600 },
    { date:'May 10', Blog:38100, News:30400, Letter:29300, Socials:27900 },
    { date:'May 12', Blog:40100, News:31600, Letter:30500, Socials:28700 },
    { date:'May 15', Blog:39600, News:31100, Letter:30000, Socials:28500 },
    { date:'May 27', Blog:42500, News:33000, Letter:31800, Socials:30100 },
    { date:'Feb 28', Blog:41800, News:32400, Letter:31300, Socials:29600 },
    { date:'Feb 28', Blog:40900, News:31800, Letter:30700, Socials:29200 },
    { date:'Feb 28', Blog:41000, News:32000, Letter:30900, Socials:29300 },
    { date:'Jun 1', Blog:43800, News:34500, Letter:32700, Socials:31200 },
  ];

  const createOptions = [
    { title:'Blog', desc:'Create a blog post' },
    { title:'Newsletter', desc:'Create an article' },
    { title:'News', desc:'Create a news post' },
    { title:'Socials', desc:'Create a social media post' },
    { title:'More', desc:'Search more options' },
  ];

  const schedule = [
    { title:'Blog #14', sub:'AI in Finance', eta:'4D 23:35:22' },
    { title:'Newsletter #14', sub:'AI in Finance', eta:'4D 23:35:22' },
    { title:'News', sub:'AI in Finance', eta:'4D 23:35:22' },
    { title:'Blog #14', sub:'AI in Finance', eta:'4D 23:35:22' },
  ];

  const renderTooltip = ({active,label,payload}: any) => active && payload?.length ? (
    <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200 text-xs">
      <div className="text-gray-500 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{background:p.stroke}} />
          <span>{p.dataKey}</span>
          <span className="font-semibold text-gray-900">{Number(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Impressions card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Impressions</p>
              <div className="mt-2 text-3xl md:text-4xl font-semibold text-gray-900">23,325,33 <span className="text-gray-500 text-lg font-normal">Views</span></div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2 text-xs">{(['1M','3M','6M','1Y'] as const).map(p => (
                <button key={p} onClick={()=>setPeriod(p)} className={`px-2 py-1 rounded font-medium ${period===p?'bg-gray-900 text-white':'text-gray-500 hover:text-gray-700'}`}>{p}</button>
              ))}</div>
              <div className="text-xs text-gray-500"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium mr-1">+23%</span>vs last month</div>
            </div>
          </div>
          <div className="mt-4 h-56 md:h-64 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={impressions} margin={{ left: 10, right: 10 }}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill:'#94a3b8', fontSize:12 }} />
                <Tooltip content={renderTooltip} />
                <Line type="monotone" dataKey="Blog" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="News" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Letter" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Socials" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Content */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold">Create Content</h3><button className="text-xs text-blue-600 font-medium">See All</button></div>
            <ul className="divide-y divide-gray-100">{createOptions.map((o)=> (
              <li key={o.title} className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{o.title}</p>
                    <p className="text-xs text-gray-500">{o.desc}</p>
                  </div>
                  {o.title!=='More' && <div className="w-7 h-7 rounded-full border text-gray-400 flex items-center justify-center"><RefreshCw className="w-3.5 h-3.5"/></div>}
                </div>
              </li>
            ))}</ul>
          </div>

          {/* Schedule Content */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold">Schedule Content</h3><button className="text-xs text-blue-600 font-medium">See All</button></div>
            <ul className="divide-y divide-gray-100">{schedule.map((it,idx)=> (
              <li key={idx} className="py-3">
                <div className="grid grid-cols-[1.4fr_auto_auto] items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{it.title}</p>
                    <p className="text-xs text-gray-500">{it.sub}</p>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 text-xs"><Clock className="w-4 h-4"/>{it.eta}</div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="rounded-full px-4">Modify</Button>
                    <Button variant="outline" size="sm" className="rounded-full px-4">Cancel</Button>
                  </div>
                </div>
              </li>
            ))}</ul>
          </div>

          {/* Feedback */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 lg:col-start-2">
            <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold">Feedback</h3><button className="text-xs text-blue-600 font-medium">See All</button></div>
            <div className="text-sm text-gray-500">No new feedback.</div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
