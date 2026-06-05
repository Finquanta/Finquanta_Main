'use client';

import React, { useState } from 'react';
import { useAppContext } from '@/hooks/useAppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, X } from 'lucide-react';

export default function DeveloperPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, user, handleSignIn, handleSignOut, notifications, updateNotificationCount } = useAppContext();

  return (
    <>
      {/* Floating Toggle Button */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-full w-12 h-12 bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
          size="icon"
        >
          {isOpen ? <X size={20} /> : <Settings size={20} />}
        </Button>
      </div>

      {/* Developer Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-80">
          <Card className="shadow-xl border-purple-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-purple-800">
                Developer Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Authentication Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant={isAuthenticated ? "default" : "secondary"}>
                  {isAuthenticated ? "Signed In" : "Signed Out"}
                </Badge>
              </div>

              {/* User Info */}
              {isAuthenticated && user && (
                <div className="text-sm space-y-1">
                  <div><strong>User:</strong> {user.name}</div>
                  <div><strong>Account:</strong> {user.bankAccount}</div>
                </div>
              )}

              {/* Authentication Controls */}
              <div className="space-y-2">
                <Button
                  onClick={handleSignIn}
                  disabled={isAuthenticated}
                  className="w-full"
                  variant="outline"
                >
                  Sign In
                </Button>
                <Button
                  onClick={handleSignOut}
                  disabled={!isAuthenticated}
                  className="w-full"
                  variant="outline"
                >
                  Sign Out
                </Button>
              </div>

              {/* Notification Controls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Notifications:</span>
                  <Badge variant="secondary">{notifications}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => updateNotificationCount(0)}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={() => updateNotificationCount(notifications + 1)}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                  >
                    Add +1
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}