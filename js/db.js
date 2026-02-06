/**
 * מודול ניהול IndexedDB
 * מספק ממשק לאחסון ושליפת משימות באופן מקומי
 */

const DB = (function() {
    const DB_NAME = 'TodoPWA';
    const DB_VERSION = 1;
    const STORE_NAME = 'tasks';
    let db = null;

    /**
     * פתיחת חיבור למסד הנתונים
     */
    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('שגיאה בפתיחת מסד הנתונים:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                db = request.result;
                console.log('מסד הנתונים נפתח בהצלחה');
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                db = event.target.result;
                
                // מחיקת store קיים אם יש
                if (db.objectStoreNames.contains(STORE_NAME)) {
                    db.deleteObjectStore(STORE_NAME);
                }

                // יצירת object store חדש
                const objectStore = db.createObjectStore(STORE_NAME, { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });

                // יצירת אינדקסים
                objectStore.createIndex('date', 'date', { unique: false });
                objectStore.createIndex('completed', 'completed', { unique: false });
                objectStore.createIndex('createdAt', 'createdAt', { unique: false });

                console.log('מסד הנתונים נוצר בהצלחה');
            };
        });
    }

    /**
     * הוספת משימה חדשה
     */
    async function addTask(taskData) {
        if (!db) await openDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(STORE_NAME);

            const task = {
                title: taskData.title,
                date: taskData.date,
                completed: false,
                notification: null,
                createdAt: new Date().toISOString()
            };

            const request = objectStore.add(task);

            request.onsuccess = () => {
                task.id = request.result;
                resolve(task);
            };

            request.onerror = () => {
                console.error('שגיאה בהוספת משימה:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * שליפת כל המשימות לתאריך מסוים
     */
    async function getTasksByDate(date) {
        if (!db) await openDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(STORE_NAME);
            const index = objectStore.index('date');
            const request = index.getAll(date);

            request.onsuccess = () => {
                // מיון לפי תאריך יצירה (חדשים בהתחלה)
                const tasks = request.result.sort((a, b) => 
                    new Date(b.createdAt) - new Date(a.createdAt)
                );
                resolve(tasks);
            };

            request.onerror = () => {
                console.error('שגיאה בשליפת משימות:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * עדכון משימה קיימת
     */
    async function updateTask(task) {
        if (!db) await openDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.put(task);

            request.onsuccess = () => {
                resolve(task);
            };

            request.onerror = () => {
                console.error('שגיאה בעדכון משימה:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * מחיקת משימה
     */
    async function deleteTask(taskId) {
        if (!db) await openDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.delete(taskId);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                console.error('שגיאה במחיקת משימה:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * שליפת משימה לפי ID
     */
    async function getTaskById(taskId) {
        if (!db) await openDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.get(taskId);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('שגיאה בשליפת משימה:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * שליפת כל המשימות עם התראות
     */
    async function getAllTasksWithNotifications() {
        if (!db) await openDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.getAll();

            request.onsuccess = () => {
                const tasksWithNotifications = request.result.filter(
                    task => task.notification && !task.completed
                );
                resolve(tasksWithNotifications);
            };

            request.onerror = () => {
                console.error('שגיאה בשליפת משימות עם התראות:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * מחיקת כל המשימות (לצורכי ניקוי)
     */
    async function clearAllTasks() {
        if (!db) await openDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.clear();

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                console.error('שגיאה בניקוי מסד הנתונים:', request.error);
                reject(request.error);
            };
        });
    }

    // אתחול מסד הנתונים בטעינה
    openDB().catch(error => {
        console.error('כשל באתחול מסד הנתונים:', error);
    });

    // ממשק ציבורי
    return {
        addTask,
        getTasksByDate,
        updateTask,
        deleteTask,
        getTaskById,
        getAllTasksWithNotifications,
        clearAllTasks
    };
})();
