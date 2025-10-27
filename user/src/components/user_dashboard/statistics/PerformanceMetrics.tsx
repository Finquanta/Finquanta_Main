import React from 'react';
import { PerformanceMetric } from '@/mockData/statisticsMockData';

interface PerformanceMetricsProps {
  metrics: PerformanceMetric[];
}

export default function PerformanceMetrics({ metrics }: PerformanceMetricsProps) {
  const getStatusColor = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'excellent':
        return 'bg-[#63d51d]';
      case 'good':
        return 'bg-[#150578]';
      case 'average':
        return 'bg-[#ff8600]';
      case 'poor':
        return 'bg-[#dc2626]';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusTextColor = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'excellent':
        return 'text-[#63d51d]';
      case 'good':
        return 'text-[#150578]';
      case 'average':
        return 'text-[#ff8600]';
      case 'poor':
        return 'text-[#dc2626]';
      default:
        return 'text-gray-400';
    }
  };

  const getProgressColor = (achievement: number) => {
    if (achievement >= 100) return 'bg-[#63d51d]';
    if (achievement >= 80) return 'bg-[#150578]';
    if (achievement >= 60) return 'bg-[#ff8600]';
    return 'bg-[#dc2626]';
  };

  return (
    <div className="bg-white p-6 rounded-[20px] border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-[#1b263b]">Performance Metrics</h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#63d51d] rounded-full"></div>
            <span className="text-[#778da9]">Excellent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#150578] rounded-full"></div>
            <span className="text-[#778da9]">Good</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#ff8600] rounded-full"></div>
            <span className="text-[#778da9]">Average</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#dc2626] rounded-full"></div>
            <span className="text-[#778da9]">Poor</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {metrics.map((metric, index) => (
          <div key={index} className="space-y-3">
            {/* Metric Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h4 className="font-medium text-[#1b263b]">{metric.name}</h4>
                <div className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(metric.status)}`}>
                  {metric.status.charAt(0).toUpperCase() + metric.status.slice(1)}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <p className="text-[#778da9]">Current</p>
                  <p className={`font-semibold ${getStatusTextColor(metric.status)}`}>
                    {metric.value}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[#778da9]">Target</p>
                  <p className="font-semibold text-[#1b263b]">{metric.target}</p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${getProgressColor(metric.achievement)}`}
                  style={{ width: `${Math.min(metric.achievement, 100)}%` }}
                ></div>
              </div>

              {/* Achievement percentage */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-medium text-white mix-blend-difference">
                  {metric.achievement.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Additional context */}
            <div className="flex items-center justify-between text-xs text-[#778da9]">
              <span>
                {metric.achievement >= 100
                  ? `Target exceeded by ${(metric.achievement - 100).toFixed(1)}%`
                  : `${(100 - metric.achievement).toFixed(1)}% away from target`
                }
              </span>
              <span className={getStatusTextColor(metric.status)}>
                {metric.achievement >= 100 ? '✓ Exceeded' :
                 metric.achievement >= 80 ? 'On track' :
                 metric.achievement >= 60 ? 'Needs attention' : 'Critical'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Overall Performance Summary */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-4 gap-4 text-center">
          {metrics.map((metric, index) => (
            <div key={index}>
              <div className={`w-16 h-16 mx-auto rounded-full ${getStatusColor(metric.status)} bg-opacity-20 flex items-center justify-center mb-2`}>
                <div className={`w-12 h-12 rounded-full ${getStatusColor(metric.status)} flex items-center justify-center`}>
                  <span className="text-white font-bold text-lg">
                    {metric.achievement >= 100 ? '✓' : metric.achievement.toFixed(0)}
                  </span>
                </div>
              </div>
              <p className="text-xs font-medium text-[#1b263b]">{metric.name}</p>
              <p className={`text-xs font-semibold ${getStatusTextColor(metric.status)}`}>
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}