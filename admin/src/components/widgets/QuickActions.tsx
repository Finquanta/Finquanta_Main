'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface QuickAction {
  id: string;
  label: string;
  action: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  icon?: React.ReactNode;
}

interface QuickActionsProps {
  title?: string;
  actions: QuickAction[];
}

export default function QuickActions({
  title = "Quick Actions",
  actions
}: QuickActionsProps) {
  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {actions.map(action => (
            <Button
              key={action.id}
              variant={action.variant || 'default'}
              onClick={action.action}
              className="w-full justify-start"
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}