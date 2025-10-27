"use client";

import { useCallback, useMemo } from "react";
import { useAppState, type AppActions, type AppState, selectors, type UserProfile, type ThemeMode } from "./useAppState";

/**
 * A thin "manager" hook that exposes curated selectors and composed actions.
 * This helps keep components lean and encourages a single place for orchestration logic.
 */
export function useAppStateManager() {
  // Select slices to avoid unnecessary re-renders
  const isAuthenticated = useAppState((s) => s.isAuthenticated);
  const user = useAppState((s) => s.user);
  const accessToken = useAppState((s) => s.accessToken);
  const refreshToken = useAppState((s) => s.refreshToken);

  const theme = useAppState((s) => s.theme);
  const sidebarOpen = useAppState((s) => s.sidebarOpen);
  const loadingCount = useAppState((s) => s.loadingCount);
  const lastToast = useAppState((s) => s.lastToast);

  const devMode = useAppState((s) => s.devMode);

  // Actions
  const login = useAppState((s) => s.login);
  const logout = useAppState((s) => s.logout);
  const setAccessToken = useAppState((s) => s.setAccessToken);
  const setUser = useAppState((s) => s.setUser);

  const setTheme = useAppState((s) => s.setTheme);
  const toggleSidebar = useAppState((s) => s.toggleSidebar);
  const beginLoading = useAppState((s) => s.beginLoading);
  const endLoading = useAppState((s) => s.endLoading);
  const toast = useAppState((s) => s.toast);

  const setDevMode = useAppState((s) => s.setDevMode);
  const devQuickLogin = useAppState((s) => s.devQuickLogin);
  const devQuickLogout = useAppState((s) => s.devQuickLogout);

  // Composed helpers
  // Avoid generic directly in TSX context by declaring function without generic, then casting
  const _withGlobalLoading = async (work: () => Promise<any>, onError?: (e: unknown) => void) => {
    beginLoading();
    try {
      const res = await work();
      return res;
    } catch (e) {
      onError?.(e);
      toast("error", (e as Error)?.message ?? "An error occurred");
      return undefined;
    } finally {
      endLoading();
    }
  };
  const withGlobalLoading = useCallback(
    _withGlobalLoading,
    [beginLoading, endLoading, toast]
  ) as <T>(work: () => Promise<T>, onError?: (e: unknown) => void) => Promise<T | undefined>;

  const manager = useMemo(
    () => ({
      // state
      isAuthenticated,
      user,
      accessToken,
      refreshToken,
      theme,
      sidebarOpen,
      loadingCount,
      lastToast,
      devMode,

      // basic actions
      login,
      logout,
      setAccessToken,
      setUser,
      setTheme,
      toggleSidebar,
      beginLoading,
      endLoading,
      toast,
      setDevMode,
      devQuickLogin,
      devQuickLogout,

      // composed actions
      withGlobalLoading,

      // convenience
      requireAuth: (message = "Authentication required") => {
        if (!isAuthenticated) {
          toast("error", message);
          return false;
        }
        return true;
      },

      switchTheme: (next?: ThemeMode) => {
        if (next) {
          setTheme(next);
          return;
        }
        setTheme(theme === "dark" ? "light" : "dark");
      },

      updateUserName: (name: string) => {
        if (!user) return;
        const updated: UserProfile = { ...user, name };
        setUser(updated);
      },
    }),
    [
      // state
      isAuthenticated,
      user,
      accessToken,
      refreshToken,
      theme,
      sidebarOpen,
      loadingCount,
      lastToast,
      devMode,
      // actions
      login,
      logout,
      setAccessToken,
      setUser,
      setTheme,
      toggleSidebar,
      beginLoading,
      endLoading,
      toast,
      setDevMode,
      devQuickLogin,
      devQuickLogout,
      // composed
      withGlobalLoading,
    ]
  );

  return manager;
}

// Re-export types and selectors for convenience
export type { AppState, AppActions, UserProfile, ThemeMode } from "./useAppState";
export const appSelectors = selectors;