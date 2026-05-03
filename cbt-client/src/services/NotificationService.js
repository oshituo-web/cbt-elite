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
            // Fetch analytics for performance-based triggers
            const analytics = await DataService.getUserAnalytics(profile.id);

            // 1. STREAK ALERTS (Retention)
            const lastSessionDate = profile.last_session_date ? new Date(profile.last_session_date) : null;
            const isSameDay = lastSessionDate && lastSessionDate.toDateString() === now.toDateString();
            if (!isSameDay && profile.streak_count > 0) {
                notifications.push({
                    type: 'streak',
                    title: 'Keep it going! 🔥',
                    message: `You're on a ${profile.streak_count}-day streak. Don't let it break!`,
                    action: 'practice'
                });
            }

            // 2. COMPETITION & LEAGUE PROMOTION (Clash Status)
            const day = now.getDay(); // 0 = Sunday, 6 = Saturday
            if (day === 0) { // Sunday: Elite League Day
                if (profile.league_tier === 'elite' || profile.league_tier === 'Elite') {
                    notifications.push({
                        type: 'competition',
                        title: 'Elite League Promotion! 💎',
                        message: `Congratulations! You've qualified for today's Elite League Championship. Enter now!`,
                        action: 'compete'
                    });
                } else {
                    // Check if they were in top 3 on Saturday (Rankings)
                    const { data: clanLeaderboard } = await DataService.getLatestClashLeaderboard(profile.id, profile.department);
                    if (clanLeaderboard) {
                        const myRank = clanLeaderboard.findIndex(u => u.user_id === profile.id) + 1;
                        if (myRank > 0 && myRank <= 3) {
                            notifications.push({
                                type: 'competition',
                                title: 'Elite Promotion Earned 🏅',
                                message: `You finished #${myRank} in yesterday's clash. You are officially promoted to the Elite League!`,
                                action: 'compete'
                            });
                        }
                    }
                }
            } else if (day === 6) { // Saturday: Clan Clash Day
                notifications.push({
                    type: 'competition',
                    title: 'Clan Clash is LIVE! ⚔️',
                    message: `Join your clan today. Finish in the Top 3 to qualify for tomorrow's Elite League!`,
                    action: 'compete'
                });
            }

            // 3. PERFORMANCE & WEAK AREAS (Learning optimization)
            if (analytics && analytics.mastery) {
                const weakTopics = analytics.mastery.filter(m => m.mastery_percentage < 40 && m.total_attempted > 5);
                if (weakTopics.length > 0) {
                    const topic = weakTopics[0];
                    notifications.push({
                        type: 'performance',
                        title: 'Weak Spot Detected 🧠',
                        message: `You struggled with "${topic.topic}" in ${topic.subject}. Spend 5 minutes reviewing it today.`,
                        action: 'practice'
                    });
                }
            }

            // 4. PROGRESSION & UPDATED DAILY TARGETS (Daily Habit)
            const dailyProgress = profile.daily_questions_count || 0;
            const targets = [50, 100, 150];
            const nextTarget = targets.find(t => dailyProgress < t) || 150;
            
            if (dailyProgress > 0 && dailyProgress < nextTarget) {
                notifications.push({
                    type: 'progression',
                    title: 'Daily Goal Progress 🎯',
                    message: `You've answered ${dailyProgress} questions today. Only ${nextTarget - dailyProgress} more to hit your ${nextTarget} target!`,
                    action: 'practice'
                });
            } else if (dailyProgress === 0) {
                notifications.push({
                    type: 'progression',
                    title: 'Start your day 🌅',
                    message: `Set the pace! Your first daily target is 50 questions. Ready to start?`,
                    action: 'practice'
                });
            }

            // 5. REWARD ALERTS (Positive Reinforcement)
            const lastCoins = parseInt(localStorage.getItem('notif_last_coins') || profile.elite_coins || 0);
            if (profile.elite_coins > lastCoins) {
                notifications.push({
                    type: 'reward',
                    title: 'Elite Coins Earned! 🪙',
                    message: `You've earned ${profile.elite_coins - lastCoins} coins. Check the store for power-ups!`,
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
    }
};
