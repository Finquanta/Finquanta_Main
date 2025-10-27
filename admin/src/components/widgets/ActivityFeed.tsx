'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ActivityItem {
  id: string;
  name: string;
  description: string;
  date: string;
  time: string;
  category?: string;
}

interface ActivityFeedProps {
  title?: string;
  activities: ActivityItem[];
  maxItems?: number;
}

export default function ActivityFeed({
  title = "Recent Activity",
  activities,
  maxItems = 10
}: ActivityFeedProps) {
  const displayActivities = activities.slice(0, maxItems);

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayActivities.map(activity => (
            <div key={activity.id} className="flex items-start space-x-3">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{activity.name}</p>
                  <div className="flex items-center space-x-2">
                    {activity.category && (
                      <Badge variant="outline" className="text-xs">
                        {activity.category}
                      </Badge>
                    )}
                    <span className="text-xs text-gray-500">{activity.time}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{activity.description}</p>
                <p className="text-xs text-gray-500">{activity.date}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}