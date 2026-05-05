import { DataService } from './data';

/**
 * Smart Notification System
 * Handles data-driven engagement alerts for Streak, Performance, Progression, Competition, and Rewards.
 */
export const NotificationService = {
    STORAGE_KEY: 'elite_notifications',
    HISTORY_LIMIT: 20,

    /**
     * Initialize the notification system
     */
    init(profile) {
        if (!profile) return;
        this._updateBadge();
        this._checkDataDrivenNotifications(profile);
    },

    /**
     * Main data-driven logic covering all aspects of the app
     */
    async _checkDataDrivenNotifications(profile) {
        const notifications = [];
        const now = new Date();
        const lastCheck = localStorage.getItem('last_notif_check');
        
        // Prevent frequent re-checks (throttle to 1 hour for background logic)
        if (lastCheck && (now - new Date(lastCheck)) < 3600000) return;
        localStorage.setItem('last_notif_check', now.toISOString());

        try {
            const createdAt = profile.created_at ? new Date(profile.created_at) : now;
            const isNewUser = (now - createdAt) < 86400000; // Account less than 24h old

            // 0. WELCOME MESSAGE (Onboarding)
            if (!localStorage.getItem('welcome_notif_sent')) {
                notifications.push({
                    type: 'system',
                    title: 'Welcome to CBT Elite! 🎓',
                    message: `Hey ${profile.username || 'Student'}, we're thrilled to have you! Explore your dashboard and start your first practice session to begin your journey to excellence.`,
                    action: 'home'
                });
                localStorage.setItem('welcome_notif_sent', 'true');
            }

            // Fetch analytics for performance-based triggers
            const analytics = await DataService.getUserAnalytics(profile.id);

            // 1. STREAK ALERTS (Retention) - Only for veterans with existing streaks
            if (!isNewUser && profile.streak_count > 0) {
                const lastSessionDate = profile.last_session_date ? new Date(profile.last_session_date) : null;
                const isSameDay = lastSessionDate && lastSessionDate.toDateString() === now.toDateString();
                
                if (!isSameDay) {
                    notifications.push({
                        type: 'streak',
                        title: 'Elite Streak Alert! 🔥',
                        message: `Your ${profile.streak_count}-day practice streak is at risk. Solve 50 questions now to keep it alive!`,
                        action: 'practice'
                    });
                }
            }

            // 2. COMPETITION & LEAGUE PROMOTION (Clash Status)
            const day = now.getDay(); // 0 = Sunday, 6 = Saturday
            const tier = profile.league_tier || 'Bronze';

            if (day === 0) { // Sunday: Elite League Day
                if (tier === 'elite' || tier === 'Elite') {
                    notifications.push({
                        type: 'competition',
                        title: 'Elite League Promotion! 💎',
                        message: `Congratulations! You've qualified for today's Elite League Championship. Enter the arena and claim your glory!`,
                        action: 'compete'
                    });
                } else if (!isNewUser) {
                    // Check if they were in top 3 on Saturday (Rankings)
                    const { data: clanLeaderboard } = await DataService.getLatestClashLeaderboard(profile.id, profile.department);
                    if (clanLeaderboard) {
                        const myRank = clanLeaderboard.findIndex(u => u.user_id === profile.id) + 1;
                        if (myRank > 0 && myRank <= 3) {
                            notifications.push({
                                type: 'competition',
                                title: 'Elite Promotion Earned 🏅',
                                message: `Amazing work! You finished #${myRank} in yesterday's clash. You've been promoted to the ${tier} League!`,
                                action: 'compete'
                            });
                        }
                    }
                }
            } else if (day === 6) { // Saturday: Clan Clash Day
                notifications.push({
                    type: 'competition',
                    title: 'The Clan Clash is LIVE! ⚔️',
                    message: `Your clan needs you! Compete today to climb the rankings and secure a promotion to the next tier.`,
                    action: 'compete'
                });
            }

            // 3. PERFORMANCE & WEAK AREAS (Only for users with significant data)
            if (!isNewUser && analytics && analytics.mastery) {
                const weakTopics = analytics.mastery.filter(m => m.mastery_percentage < 40 && m.total_attempted > 10);
                if (weakTopics.length > 0) {
                    const topic = weakTopics[0];
                    notifications.push({
                        type: 'performance',
                        title: 'Focused Study Needed 🧠',
                        message: `We've noticed you're struggling with "${topic.topic}" in ${topic.subject}. Spending 5 minutes on this today will boost your score!`,
                        action: 'practice'
                    });
                }
            }

            // 4. PROGRESSION & UPDATED DAILY TARGETS
            const dailyProgress = profile.daily_questions_count || 0;
            const target = parseInt(localStorage.getItem('elite_daily_goal') || '50');
            
            if (dailyProgress > 0 && dailyProgress < target) {
                notifications.push({
                    type: 'progression',
                    title: 'Daily Goal Progress 🎯',
                    message: `You're doing great! Answer ${target - dailyProgress} more questions today to hit your daily target of ${target}.`,
                    action: 'practice'
                });
            } else if (dailyProgress === 0) {
                notifications.push({
                    type: 'progression',
                    title: 'Set the Pace 🌅',
                    message: `Ready to conquer your goals? Start your first session now. Your daily target is 50 questions!`,
                    action: 'practice'
                });
            }

            // 5. REWARD ALERTS (Positive Reinforcement)
            const lastCoins = parseInt(localStorage.getItem('notif_last_coins') || profile.elite_coins || 0);
            if (profile.elite_coins > lastCoins) {
                const earned = profile.elite_coins - lastCoins;
                notifications.push({
                    type: 'reward',
                    title: 'Elite Coins Earned! 🪙',
                    message: `Ka-ching! You just earned ${earned} Elite Coins. Head to the store to see what you can unlock!`,
                    action: 'dashboard'
                });
                localStorage.setItem('notif_last_coins', profile.elite_coins);
            }

        } catch (e) {
            console.error("Smart Notification Engine Error:", e);
        }

        // Process discovered notifications
        for (const notif of notifications) {
            await this.add(notif);
        }
    },

    /**
     * Add a new notification to storage and trigger system alert
     */
    async add({ type, title, message, action }) {
        const history = this.getHistory();
        
        // Prevent duplicate types within 24 hours
        const tooRecent = history.find(n => n.type === type && (new Date() - new Date(n.timestamp)) < 86400000);
        if (tooRecent) return;

        const newNotif = {
            id: 'notif_' + Date.now(),
            type,
            title,
            message,
            action,
            timestamp: new Date().toISOString(),
            read: false
        };

        history.unshift(newNotif);
        this._saveHistory(history.slice(0, this.HISTORY_LIMIT));

        // Update UI state
        this._updateBadge();

        // System/Push Notification
        this._sendSystemNotification(title, message, type);
    },

    getHistory() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
        } catch (e) { return []; }
    },

    markAsRead(id) {
        const history = this.getHistory();
        const notif = history.find(n => n.id === id);
        if (notif) {
            notif.read = true;
            this._saveHistory(history);
            this._updateBadge();
        }
    },

    markAllAsRead() {
        const history = this.getHistory();
        history.forEach(n => n.read = true);
        this._saveHistory(history);
        this._updateBadge();
    },

    _saveHistory(history) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    },

    _updateBadge() {
        const history = this.getHistory();
        const unreadCount = history.filter(n => !n.read).length;
        
        const badges = [
            document.getElementById('notification-badge'),
            document.getElementById('more-notification-badge')
        ];
        
        badges.forEach(badge => {
            if (!badge) return;
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        });
    },

    async _sendSystemNotification(title, body, tag) {
        if (localStorage.getItem('push_notifications') !== 'true') return;
        if (!('Notification' in window)) return;
        
        try {
            if (Notification.permission === 'granted') {
                this._send(title, body, tag);
            } else if (Notification.permission !== 'denied') {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    this._send(title, body, tag);
                }
            }
        } catch (e) { console.warn("Push permission check failed", e); }
    },

    _send(title, body, tag) {
        try {
            new Notification(title, {
                body,
                tag,
                icon: '/pwa-icon.svg',
                badge: '/pwa-icon.svg'
            });
        } catch (e) { console.warn("System Notification failed", e); }
    },

    /**
     * Subscribe to Web Push Notifications (FCM / VAPID)
     */
    async subscribeToPush(profileId) {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push notifications are not supported by this browser.');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('Push permission denied.');
                return false;
            }

            const registration = await navigator.serviceWorker.ready;
            
            // Generate or fetch VAPID public key
            const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB-5-uM2OvcHkP9P8LzZqj_8c';
            
            // Helper function to convert base64 to Uint8Array
            const urlB64ToUint8Array = (base64String) => {
                const padding = '='.repeat((4 - base64String.length % 4) % 4);
                const base64 = (base64String + padding)
                    .replace(/\-/g, '+')
                    .replace(/_/g, '/');

                const rawData = window.atob(base64);
                const outputArray = new Uint8Array(rawData.length);

                for (let i = 0; i < rawData.length; ++i) {
                    outputArray[i] = rawData.charCodeAt(i);
                }
                return outputArray;
            };

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlB64ToUint8Array(vapidPublicKey)
            });

            console.log('[Push] User is subscribed.', subscription);

            // Save to database
            const saved = await DataService.savePushToken(profileId, subscription);
            return saved;
        } catch (err) {
            console.error('Failed to subscribe to push notifications', err);
            return false;
        }
    }
};
