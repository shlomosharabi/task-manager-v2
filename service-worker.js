⁹/**
 * Service Worker
 * מספק תמיכה באופליין ומנהל התראות
 */

const CACHE_NAME = 'todo-pwa-v1';
const urlsToCache = [
    '/',
    '/index.html/',
    '/task-manager-v2/',
    '/task-manager-v2/index.html', 
    '/css/style.css',
    '/js/app.js',
    '/js/db.js',
    '/js/notifications.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// מאגר התראות מתוזמנות
const scheduledNotifications = new Map();

/**
 * אירוע התקנה - שמירת קבצים במטמון
 */
self.addEventListener('install', (event) => {
    console.log('Service Worker: מתקין...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: שומר קבצים במטמון');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('שגיאה בשמירת קבצים במטמון:', error);
            })
    );
    
    // אכיפת Service Worker החדש
    self.skipWaiting();
});

/**
 * אירוע הפעלה - ניקוי מטמון ישן
 */
self.addEventListener('activate', (event) => {
    console.log('Service Worker: מופעל');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: מוחק מטמון ישן:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // השתלטות מיידית על כל הלקוחות
    return self.clients.claim();
});

/**
 * אירוע fetch - טיפול בבקשות רשת
 */
self.addEventListener('fetch', (event) => {
    // דלג על בקשות שאינן HTTP/HTTPS
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // אם יש במטמון, החזר מהמטמון
                if (response) {
                    return response;
                }

                // אם אין במטמון, נסה לשלוף מהרשת
                return fetch(event.request)
                    .then((response) => {
                        // בדוק שהתשובה תקינה
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        // שכפל את התשובה
                        const responseToCache = response.clone();

                        // שמור במטמון לשימוש עתידי
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // אם אין חיבור לאינטרנט, החזר דף אופליין אם קיים
                        return caches.match('/index.html');
                    });
            })
    );
});

/**
 * קבלת הודעות מהאפליקציה
 */
self.addEventListener('message', (event) => {
    const { type, task, taskId } = event.data;

    switch (type) {
        case 'SCHEDULE_NOTIFICATION':
            scheduleNotification(task);
            break;
        case 'CANCEL_NOTIFICATION':
            cancelScheduledNotification(taskId);
            break;
        case 'UPDATE_NOTIFICATIONS':
            updateAllNotifications();
            break;
    }
});

/**
 * תזמון התראה
 */
function scheduleNotification(task) {
    if (!task.notification) return;

    const notificationTime = new Date(task.notification.scheduledFor);
    const now = new Date();
    const delay = notificationTime - now;

    // אם הזמן כבר עבר, אל תתזמן
    if (delay <= 0) {
        console.log('זמן ההתראה כבר עבר:', task.title);
        return;
    }

    // ביטול התראה קודמת אם קיימת
    if (scheduledNotifications.has(task.id)) {
        clearTimeout(scheduledNotifications.get(task.id));
    }

    // תזמון התראה חדשה
    const timeoutId = setTimeout(() => {
        showNotification(task);
        scheduledNotifications.delete(task.id);
    }, delay);

    scheduledNotifications.set(task.id, timeoutId);
    console.log(`התראה תוזמנה: ${task.title} ב-${task.notification.time}`);
}

/**
 * ביטול התראה מתוזמנת
 */
function cancelScheduledNotification(taskId) {
    if (scheduledNotifications.has(taskId)) {
        clearTimeout(scheduledNotifications.get(taskId));
        scheduledNotifications.delete(taskId);
        console.log('התראה בוטלה:', taskId);
    }
}

/**
 * הצגת התראה
 */
async function showNotification(task) {
    const title = '⏰ תזכורת למשימה';
    const options = {
        body: task.title,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: `task-${task.id}`,
        requireInteraction: true,
        dir: 'rtl',
        lang: 'he',
        data: {
            taskId: task.id,
            date: task.date
        },
        actions: [
            {
                action: 'complete',
                title: '✅ סמן כהושלם'
            },
            {
                action: 'view',
                title: '👁️ צפה במשימה'
            }
        ]
    };

    try {
        await self.registration.showNotification(title, options);
        console.log('התראה הוצגה:', task.title);
    } catch (error) {
        console.error('שגיאה בהצגת התראה:', error);
    }
}

/**
 * טיפול בלחיצה על התראה
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const { taskId, date } = event.notification.data;

    if (event.action === 'complete') {
        // סימון המשימה כהושלמה
        event.waitUntil(
            markTaskAsComplete(taskId)
        );
    } else {
        // פתיחת האפליקציה
        event.waitUntil(
            clients.openWindow('/?date=' + date)
        );
    }
});

/**
 * סימון משימה כהושלמה (דורש גישה ל-IndexedDB)
 */
async function markTaskAsComplete(taskId) {
    try {
        // שליחת הודעה לכל הלקוחות הפתוחים
        const allClients = await clients.matchAll();
        allClients.forEach(client => {
            client.postMessage({
                type: 'COMPLETE_TASK',
                taskId: taskId
            });
        });
    } catch (error) {
        console.error('שגיאה בסימון משימה:', error);
    }
}

/**
 * עדכון כל ההתראות
 */
async function updateAllNotifications() {
    try {
        // ניקוי כל ההתראות הקיימות
        scheduledNotifications.forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        scheduledNotifications.clear();

        console.log('כל ההתראות עודכנו');
    } catch (error) {
        console.error('שגיאה בעדכון התראות:', error);
    }
}

/**
 * ניקוי תקופתי של התראות ישנות
 */
setInterval(() => {
    const now = new Date();
    scheduledNotifications.forEach((timeoutId, taskId) => {
        // בדיקה פשוטה - אם התזמון עדיין קיים אבל הזמן עבר
        // במקרה זה, נניח שמשהו השתבש ונוכל לנקות
    });
}, 60000); // כל דקה

console.log('Service Worker: מוכן לפעולה');
