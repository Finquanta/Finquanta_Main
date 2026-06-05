"use client";

import React from 'react';

export interface ActivityItem {
  id: string;
  name: string;
  description: string;
  date: string;
  time: string;
  category: string;
  avatar?: string;
}

interface RecentActivityProps {
  activities: ActivityItem[];
}

export default function RecentActivity({ activities }: RecentActivityProps) {
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Support': 'bg-blue-100 text-blue-700',
      'Content': 'bg-purple-100 text-purple-700',
      'Finances': 'bg-green-100 text-green-700',
      'Security': 'bg-red-100 text-red-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          See All
        </button>
      </div>

      {/* Activity List */}
      <div className="space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
          >
            {/* Avatar */}
            <div className="flex-shrink-0">
              {activity.avatar ? (
                <img
                  src={activity.avatar}
                  alt={activity.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                  {getInitials(activity.name)}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {activity.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {activity.description}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium text-gray-900">
                    {activity.date}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {activity.time}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(
                    activity.category
                  )}`}
                >
                  {activity.category}
                </span>
                <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                  View
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

