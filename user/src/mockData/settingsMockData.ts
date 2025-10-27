// Mock data for notification settings state
export const mockRootProps = {
  initialSettings: {
    filter: false as const,
    newsUpdates: false as const,
    reminders: false as const,
    pushNotifications: true as const,
    paymentUpdate: true as const,
    balanceNotification: false as const
  },
  activeSection: "notification-preference" as const
};