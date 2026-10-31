import { store } from './store.js';

class NotificationsService {
  async notifyUser(userId, { type, refId, title, message }) {
    if (!userId) return;

    const id = 'notif_' + Math.random().toString(36).substring(2, 9);
    const notif = {
      id,
      userId,
      type,
      refId: refId || null,
      title: title.trim(),
      message: message.trim(),
      read: false,
      createdAt: new Date().toISOString()
    };

    await store.setDoc('notifications', id, notif);

    // Optional Browser Notification API trigger if allowed
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`ShareBox: ${title}`, {
          body: message,
          icon: '/favicon.ico'
        });
      } catch (e) {}
    }

    return notif;
  }

  async create({ userId, type, refId, title, message }) {
    return this.notifyUser(userId, { type, refId, title, message });
  }

  async markAsRead(notificationId) {
    await store.updateDoc('notifications', notificationId, {
      read: true
    });
  }

  async markAllAsRead(userId) {
    const all = await store.getDocs('notifications');
    const userNotifs = all.filter(n => n.userId === userId && !n.read);
    for (const notif of userNotifs) {
      await store.updateDoc('notifications', notif.id, { read: true });
    }
  }

  async deleteNotification(notificationId) {
    await store.deleteDoc('notifications', notificationId);
  }

  async clearAll(userId) {
    const all = await store.getDocs('notifications');
    const userNotifs = all.filter(n => n.userId === userId);
    for (const notif of userNotifs) {
      await store.deleteDoc('notifications', notif.id);
    }
  }

  subscribeNotifications(userId, callback) {
    return store.subscribe('notifications', (n) => n.userId === userId, (items) => {
      const sorted = [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      callback(sorted);
    });
  }
}

export const notificationsService = new NotificationsService();
