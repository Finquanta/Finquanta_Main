import { create } from 'zustand';
import { inboxData } from '@/lib/mockData';

interface User {
  name: string;
  avatar: string;
  bankAccount: string;
}

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  notifications: number;
  isDarkMode: boolean;
}

interface AppActions {
  signIn: (user: User) => void;
  signOut: () => void;
  setNotifications: (count: number) => void;
  toggleDarkMode: () => void;
}

type AppStore = AppState & AppActions;

export const useAppState = create<AppStore>((set) => ({
  // Initial state
  user: {
    name: 'Khalifa Hm',
    avatar: '/images/user-avatar.png',
    bankAccount: '**** 4256'
  },
  isAuthenticated: true,
  notifications: inboxData.metrics.unreadMessages,
  isDarkMode: false,

  // Actions
  signIn: (user) => set({ user, isAuthenticated: true }),
  signOut: () => set({ user: null, isAuthenticated: false }),
  setNotifications: (count) => set({ notifications: count }),
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
}));