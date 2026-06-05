"use client";

import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface Alert {
  id: string;
  type: string;
  system: string;
  date: string;
  time: string;
}

interface AlertsProps {
  alerts: Alert[];
}

export default function Alerts({ alerts }: AlertsProps) {
  const getAlertIcon = (type: string) => {
    return (
      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
        <AlertCircle className="w-4 h-4 text-red-600" />
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Alerts</h3>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-semibold">
            {alerts.length}
          </span>
        </div>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          See All
        </button>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {/* Left Side */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {getAlertIcon(alert.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{alert.type}</p>
                <p className="text-xs text-gray-500 mt-0.5">{alert.system}</p>
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <p className="text-xs font-medium text-gray-900">{alert.date}</p>
                <p className="text-xs text-gray-500 mt-0.5">{alert.time}</p>
              </div>
              <button className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 rounded transition-colors">
                View
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

