/**
 * מודול ניהול התראות
 * מספק ממשק להתראות דחיפה (Push Notifications) באמצעות Service Worker
 */

const NotificationManager = (function() {
    let permission = 'default';

    /**
     * בדיקה אם ההתראות נתמכות בדפדפן
     */
    function isSupported() {
        return 'Notification' in window && 'serviceWorker' in navigator;
    }

    /**
     * בקשת הרשאות להתראות
     */
    async function requestPermission() {
        if (!isSupported()) {
            console.warn('התראות אינן נתמכות בדפדפן זה');
            return false;
        }

        try {
            permission = await Notification.requestPermission();
            console.log('סטטוס הרשאות התראות:', permission);
            return permission === 'granted';
        } catch (error) {
            console.error('שגיאה בבקשת הרשאות:', error);
            return false;
        }
    }

    /**
     * קבלת סטטוס הרשאות נוכחי
     */
    function getPermission() {
        if (!isSupported()) return 'denied';
        return Notification.permission;
    }

    /**
     * תזמון התראה למשימה
     */
    async function scheduleNotification(task, time) {
        if (getPermission() !== 'granted') {
            const granted = await requestPermission();
            if (!granted) {
                throw new Error('לא ניתנה הרשאה להתראות');
            }
        }

        // חישוב זמן ההתראה
        const [hours, minutes] = time.split(':').map(Number);
        const notificationDate = new Date(task.date);
        notificationDate.setHours(hours, minutes, 0, 0);

        // בדיקה שהזמן עדיין לא עבר
        const now = new Date();
        if (notificationDate <= now) {
            throw new Error('לא ניתן להגדיר התראה לזמן שעבר');
        }

        // שמירת מידע ההתראה
        task.notification = {
            time: time,
            scheduledFor: notificationDate.toISOString()
        };

        // עדכון המשימה במסד הנתונים
        await DB.updateTask(task);

        // רישום ההתראה ב-Service Worker
        await registerNotificationInServiceWorker(task);

        console.log('התראה תוזמנה בהצלחה:', task.title, 'ב-', time);
        return task;
    }

    /**
     * רישום התראה ב-Service Worker
     */
    async function registerNotificationInServiceWorker(task) {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker לא נתמך');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            
            // שליחת הודעה ל-Service Worker
            if (registration.active) {
                registration.active.postMessage({
                    type: 'SCHEDULE_NOTIFICATION',
                    task: task
                });
            }

            console.log('התראה נרשמה ב-Service Worker');
        } catch (error) {
            console.error('שגיאה ברישום התראה:', error);
        }
    }

    /**
     * ביטול התראה
     */
    async function cancelNotification(task) {
        // מחיקת מידע ההתראה מהמשימה
        task.notification = null;
        await DB.updateTask(task);

        // ביטול ב-Service Worker
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.ready;
                if (registration.active) {
                    registration.active.postMessage({
                        type: 'CANCEL_NOTIFICATION',
                        taskId: task.id
                    });
                }
            } catch (error) {
                console.error('שגיאה בביטול התראה:', error);
            }
        }

        console.log('התראה בוטלה:', task.title);
        return task;
    }

    /**
     * הצגת התראה מיידית (לבדיקה)
     */
    async function showNotification(title, body) {
        if (getPermission() !== 'granted') {
            const granted = await requestPermission();
            if (!granted) return false;
        }

        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification(title, {
                    body: body,
                    icon: '/icons/icon-192.png',
                    badge: '/icons/icon-192.png',
                    vibrate: [200, 100, 200],
                    tag: 'todo-notification',
                    requireInteraction: true,
                    dir: 'rtl',
                    lang: 'he'
                });
            } else {
                // fallback להתראה רגילה
                new Notification(title, {
                    body: body,
                    icon: '/icons/icon-192.png',
                    dir: 'rtl',
                    lang: 'he'
                });
            }
            return true;
        } catch (error) {
            console.error('שגיאה בהצגת התראה:', error);
            return false;
        }
    }

    /**
     * עדכון כל ההתראות התלויות
     */
    async function updateAllNotifications() {
        try {
            const tasks = await DB.getAllTasksWithNotifications();
            
            for (const task of tasks) {
                await registerNotificationInServiceWorker(task);
            }

            console.log(`עודכנו ${tasks.length} התראות`);
        } catch (error) {
            console.error('שגיאה בעדכון התראות:', error);
        }
    }

    /**
     * ניקוי התראות ישנות
     */
    async function cleanOldNotifications() {
        try {
            const tasks = await DB.getAllTasksWithNotifications();
            const now = new Date();

            for (const task of tasks) {
                if (!task.notification) continue;

                const scheduledTime = new Date(task.notification.scheduledFor);
                
                // אם ההתראה עברה, הסר אותה
                if (scheduledTime < now) {
                    await cancelNotification(task);
                }
            }
        } catch (error) {
            console.error('שגיאה בניקוי התראות:', error);
        }
    }

    // אתחול
    if (isSupported()) {
        // בדיקת הרשאות קיימות
        permission = Notification.permission;
        
        // ניקוי התראות ישנות בטעינה
        cleanOldNotifications();
    }

    // ממשק ציבורי
    return {
        isSupported,
        requestPermission,
        getPermission,
        scheduleNotification,
        cancelNotification,
        showNotification,
        updateAllNotifications,
        cleanOldNotifications
    };
})();
