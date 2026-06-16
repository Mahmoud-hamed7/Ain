import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'sos';

export interface ToastMessage {
  id:            string;
  type:          ToastType;
  title:         string;
  description?:  string;
  /** SOS-specific: community name shown as a chip */
  communityName?: string;
  /** SOS-specific: link to navigate when "View" is clicked */
  actionLink?:   string;
  /** SOS severity chip label */
  severity?:     string;
}

export interface NotificationItem {
  id:          string;
  type:        'report' | 'sos' | 'system';
  title:       string;
  description: string;
  time:        string;
  read:        boolean;
  /** optional link or report id */
  link?:       string;
}

interface NotificationStore {
  toasts:          ToastMessage[];
  notifications:   NotificationItem[];
  addToast:        (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast:     (id: string) => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'read' | 'time'>) => void;
  markRead:        (id: string) => void;
  markAllRead:     () => void;
  clearAll:        () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  toasts:        [],
  notifications: [],

  addToast: (toast) =>
    set((state) => {
      const newToast = { ...toast, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
      // Max 4 visible — oldest gets dropped
      const newToasts = [newToast, ...state.toasts].slice(0, 4);
      return { toasts: newToasts };
    }),

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          ...notification,
          id:   `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          read: false,
          time: new Date().toISOString(),
        },
        ...state.notifications,
      ].slice(0, 100), // keep last 100
    })),

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  clearAll: () => set({ notifications: [] }),
}));