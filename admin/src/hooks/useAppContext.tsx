'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAppStateManager } from './useAppStateManager';

interface AppContextType {
  user: any;
  isAuthenticated: boolean;
  notifications: number;
  isDarkMode: boolean;
  handleSignIn: () => void;
  handleSignOut: () => void;
  updateNotificationCount: (count: number) => void;
  handleDarkModeToggle: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const appState = useAppStateManager();

  return (
    <AppContext.Provider value={appState}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};