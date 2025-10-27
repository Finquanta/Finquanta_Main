"use client";

import React from "react";
import { useAppContext } from "./useAppContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Minimal developer panel: only Login and Logout.
 */
export default function ContextDemo() {
  const app = useAppContext();

  return (
    <div className="p-2">
      <Card className="p-3 flex items-center justify-between gap-3">
        <div className="text-sm">
          {app.isAuthenticated ? (
            <>
              <span className="font-medium">Logged in</span>
              {app.user ? ` as ${app.user.name} (${app.user.role})` : null}
            </>
          ) : (
            <span className="font-medium">Logged out</span>
          )}
        </div>

        {!app.isAuthenticated ? (
          <Button
            size="sm"
            onClick={() => {
              app.setDevMode(true);
              app.devQuickLogin();
            }}
          >
            Dev Quick Login
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => app.devQuickLogout()}>
            Dev Logout
          </Button>
        )}
      </Card>
    </div>
  );
}