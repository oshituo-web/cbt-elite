export const NotificationService = {
  async notify(title, body, tag = 'general') {
    if (localStorage.getItem('push_notifications') !== 'true') return;
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      this._send(title, body, tag);
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this._send(title, body, tag);
      }
    }
  },

  _send(title, body, tag) {
    new Notification(title, {
      body,
      tag,
      icon: '/pwa-icon.svg',
      badge: '/pwa-icon.svg'
    });
  }
};
