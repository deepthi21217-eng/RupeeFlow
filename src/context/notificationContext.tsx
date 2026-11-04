import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AppNotification,
  generateLoanReminders,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/utils/cloudNotifications';
import { ensureCloudRepayments, loadCloudLoans, loadCloudRepayments } from '@/utils/cloudLoans';

export interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const refresh = useCallback(async () => {
    try {
      const loans = await loadCloudLoans();
      const repayments = await loadCloudRepayments();
      const completeRepayments = await ensureCloudRepayments(loans, repayments);
      await generateLoanReminders(loans, completeRepayments);
      setNotifications(await loadNotifications());
    } catch {
      try {
        setNotifications(await loadNotifications());
      } catch {
        setNotifications([]);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifications((previous) => previous.map((notification) => (
      notification.id === id ? { ...notification, is_read: true } : notification
    )));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((previous) => previous.map((notification) => ({ ...notification, is_read: true })));
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, refresh, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}
