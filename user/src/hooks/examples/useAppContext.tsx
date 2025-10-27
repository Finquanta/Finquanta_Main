"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useAppState } from "./useAppState";
import { useAppStateManager } from "./useAppStateManager";

/**
 * Although Zustand does not need React Context, this provider can be useful
 * if you want a clear boundary for client components and a single place
 * to initialize side-effects in the future.
 */

type AppContextValue = ReturnType<typeof useAppStateManager>;

// Create a context holding the manager facade
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Ensure the store is created (side-effect free)
  useAppState();

  const manager = useAppStateManager();
  const value = useMemo(() => manager, [manager]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return ctx;
}