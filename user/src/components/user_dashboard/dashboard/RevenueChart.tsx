"use client";
import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getRevenue, RevenueRange, RevenueMetric, RevenuePoint } from '@/lib/api/dashboard';
import { useLanguage } from '@/hooks/context/LanguageContext';

const RANGES: { key: RevenueRange; labelKey: string }[] = [
  { key: 'day', labelKey: 'rangeDay' },
  { key: 'month', labelKey: 'rangeMonth' },
  { key: 'year', labelKey: 'rangeYear' },
];

const METRICS: { key: RevenueMetric; label: string; color: string }[] = [
  { key: 'revenue', label: 'Revenue', color: '#3b82f6' },
  { key: 'cashflow', label: 'Cashflow', color: '#22c55e' },
  { key: 'expense', label: 'Expense', color: '#ef4444' },
];

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const p = payload[0].payload as RevenuePoint;
    return (
      <div className="rounded-lg bg-gray-900 text-white text-xs px-3 py-2 shadow-lg">
        <div className="opacity-80">{p.full}</div>
        <div className="font-semibold">${Number(p.value).toLocaleString()}</div>
      </div>
    );
  }
  return null;
}

export default function RevenueChart({ isDark }: { isDark: boolean }) {
  const { t } = useLanguage();
  const [range, setRange] = useState<RevenueRange>('month');
  const [metric, setMetric] = useState<RevenueMetric>('revenue');
  const [points, setPoints] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(false);

  const color = METRICS.find((m) => m.key === metric)?.color ?? '#3b82f6';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRevenue(range, metric)
      .then((res) => { if (!cancelled) setPoints(res.points); })
      .catch(() => { if (!cancelled) setPoints([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range, metric]);

  const axisColor = isDark ? '#9ca3af' : '#778da9';
  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const tickInterval = range === 'day' ? 4 : 0;

  return (
    <div>
      {/* Metric toggle: revenue / cashflow / expense */}
      <div className="flex items-center gap-1 mb-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              metric === m.key ? 'text-white' : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={metric === m.key ? { backgroundColor: m.color } : undefined}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Timeframe toggle */}
      <div className="flex items-center gap-1 mb-3">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              range === r.key
                ? 'bg-blue-500 text-white'
                : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('dashboard', r.labelKey)}
          </button>
        ))}
      </div>

      <div className="h-40">
        {loading ? (
          <div className={`h-full flex items-center justify-center text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dashboard', 'loading')}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {range === 'day' ? (
              <LineChart data={points} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} interval={tickInterval} tick={{ fontSize: 10, fill: axisColor }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: axisColor }} tickFormatter={(v) => `$${v >= 1000 ? `${v / 1000}k` : v}`} width={40} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: color, strokeWidth: 1 }} />
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            ) : (
              <BarChart data={points} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} interval={tickInterval} tick={{ fontSize: 10, fill: axisColor }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: axisColor }} tickFormatter={(v) => `$${v >= 1000 ? `${v / 1000}k` : v}`} width={40} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
