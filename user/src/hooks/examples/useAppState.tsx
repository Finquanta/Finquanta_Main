"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * App-wide domain types
 */
export type Role = "guest" | "user" | "admin" | "developer";

export type ThemeMode = "light" | "dark" | "system";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
  user?: UserProfile | null;
}

export interface UIState {
  theme: ThemeMode;
  sidebarOpen: boolean;
  loadingCount: number; // global async activity counter
  lastToast?: { type: "success" | "error" | "info"; message: string; ts: number } | null;
}

export interface DevState {
  devMode: boolean; // toggle for developer helpers
}

/**
 * Root app state managed by Zustand
 */
export interface AppState extends AuthState, UIState, DevState {}

export interface AppActions {
  // Auth
  login: (payload: { token: string; user: UserProfile; refreshToken?: string | null }) => void;
  logout: () => void;
  setAccessToken: (token: string | null) => void;
  setUser: (user: UserProfile | null) => void;

  // UI
  setTheme: (mode: ThemeMode) => void;
  toggleSidebar: (open?: boolean) => void;
  beginLoading: () => void;
  endLoading: () => void;
  toast: (type: "success" | "error" | "info", message: string) => void;

  // Dev
  setDevMode: (on: boolean) => void;
  devQuickLogin: () => void;
  devQuickLogout: () => void;
}

/**
 * Initial state
 */
const initialState: AppState = {
  // Auth
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  user: null,

  // UI
  theme: "system",
  sidebarOpen: false,
  loadingCount: 0,
  lastToast: null,

  // Dev
  devMode: false,
};

/**
 * Store creation with persist (localStorage)
 */
export const useAppState = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Auth
      login: ({ token, user, refreshToken }) =>
        set(() => ({
          isAuthenticated: true,
          accessToken: token,
          refreshToken: refreshToken ?? null,
          user,
        })),
      logout: () => set(() => ({ ...initialState, theme: get().theme, devMode: get().devMode })),
      setAccessToken: (token) => set(() => ({ accessToken: token })),
      setUser: (user) => set(() => ({ user })),

      // UI
      setTheme: (mode) => set(() => ({ theme: mode })),
      toggleSidebar: (open) =>
        set((state) => ({
          sidebarOpen: typeof open === "boolean" ? open : !state.sidebarOpen,
        })),
      beginLoading: () => set((s) => ({ loadingCount: Math.max(0, s.loadingCount + 1) })),
      endLoading: () => set((s) => ({ loadingCount: Math.max(0, s.loadingCount - 1) })),
      toast: (type, message) => set(() => ({ lastToast: { type, message, ts: Date.now() } })),

      // Dev
      setDevMode: (on) => set(() => ({ devMode: on })),
      devQuickLogin: () => {
        const devUser: UserProfile = {
          id: "dev-123",
          name: "Developer",
          email: "dev@example.com",
          role: "developer",
          avatarUrl: null,
        };
        get().login({ token: "dev-token", refreshToken: "dev-refresh", user: devUser });
        get().toast("success", "Logged in as Developer");
      },
      devQuickLogout: () => {
        get().logout();
        get().toast("info", "Developer logged out");
      },
    }),
    {
      name: "app-state",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : undefined as any)),
      // Do not persist volatile fields
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        devMode: state.devMode,
      }),
    }
  )
);

/**
 * Selectors (ergonomic helpers)
 */
export const selectors = {
  auth: (s: AppState) => ({
    isAuthenticated: s.isAuthenticated,
    user: s.user,
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
  }),
  ui: (s: AppState) => ({
    theme: s.theme,
    sidebarOpen: s.sidebarOpen,
    loadingCount: s.loadingCount,
    lastToast: s.lastToast,
  }),
  dev: (s: AppState) => ({ devMode: s.devMode }),
};