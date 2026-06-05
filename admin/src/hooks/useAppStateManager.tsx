import { useAppState } from './useAppState';

export const useAppStateManager = () => {
  const {
    user,
    isAuthenticated,
    notifications,
    isDarkMode,
    signIn,
    signOut,
    setNotifications,
    toggleDarkMode,
  } = useAppState();

  const handleSignIn = () => {
    const mockUser = {
      name: 'Khalifa Hm',
      avatar: '/images/user-avatar.png',
      bankAccount: '**** 4256'
    };
    signIn(mockUser);
  };

  const handleSignOut = () => {
    signOut();
  };

  const updateNotificationCount = (count: number) => {
    setNotifications(count);
  };

  const handleDarkModeToggle = () => {
    toggleDarkMode();
  };

  return {
    // State
    user,
    isAuthenticated,
    notifications,
    isDarkMode,
    
    // Actions
    handleSignIn,
    handleSignOut,
    updateNotificationCount,
    handleDarkModeToggle,
  };
};