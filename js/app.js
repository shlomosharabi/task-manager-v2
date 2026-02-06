/**
 * אפליקציית Todo - קובץ ראשי
 * מנהל את כל הלוגיקה של האפליקציה
 */

class TodoApp {
    constructor() {
        this.currentDate = this.getTodayDate();
        this.tasks = [];
        this.currentTaskForNotification = null;
        
        // אלמנטים מה-DOM
        this.elements = {
            dateInput: document.getElementById('dateInput'),
            dateLabel: document.getElementById('dateLabel'),
            prevDayBtn: document.getElementById('prevDay'),
            nextDayBtn: document.getElementById('nextDay'),
            addTaskForm: document.getElementById('addTaskForm'),
            taskInput: document.getElementById('taskInput'),
            tasksList: document.getElementById('tasksList'),
            emptyState: document.getElementById('emptyState'),
            stats: document.getElementById('stats'),
            toast: document.getElementById('toast'),
            notificationModal: document.getElementById('notificationModal'),
            notificationTime: document.getElementById('notificationTime'),
            saveNotificationBtn: document.getElementById('saveNotification'),
            removeNotificationBtn: document.getElementById('removeNotification'),
            closeModalBtn: document.getElementById('closeModal'),
            installBtn: document.getElementById('installBtn')
        };

        this.init();
    }

    /**
     * אתחול האפליקציה
     */
    async init() {
        this.setupEventListeners();
        this.setupPWA();
        this.setupDateSelector();
        await this.loadTasks();
        this.updateUI();
    }

    /**
     * הגדרת מאזיני אירועים
     */
    setupEventListeners() {
        // טופס הוספת משימה
        this.elements.addTaskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });

        // ניווט בין תאריכים
        this.elements.prevDayBtn.addEventListener('click', () => this.changeDate(-1));
        this.elements.nextDayBtn.addEventListener('click', () => this.changeDate(1));
        this.elements.dateInput.addEventListener('change', (e) => {
            this.currentDate = e.target.value;
            this.loadTasks();
        });

        // מודל התראות
        this.elements.closeModalBtn.addEventListener('click', () => this.closeNotificationModal());
        this.elements.saveNotificationBtn.addEventListener('click', () => this.saveNotification());
        this.elements.removeNotificationBtn.addEventListener('click', () => this.removeNotification());

        // סגירת מודל בלחיצה על רקע
        this.elements.notificationModal.addEventListener('click', (e) => {
            if (e.target === this.elements.notificationModal) {
                this.closeNotificationModal();
            }
        });

        // מקש ESC לסגירת מודל
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.notificationModal.classList.contains('show')) {
                this.closeNotificationModal();
            }
        });
    }

    /**
     * הגדרת בורר תאריכים
     */
    setupDateSelector() {
        const today = this.getTodayDate();
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        const fiveYearsFromNow = new Date();
        fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);

        this.elements.dateInput.min = fiveYearsAgo.toISOString().split('T')[0];
        this.elements.dateInput.max = fiveYearsFromNow.toISOString().split('T')[0];
        this.elements.dateInput.value = today;
        
        this.updateDateLabel();
    }

    /**
     * קבלת תאריך היום בפורמט YYYY-MM-DD
     */
    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * שינוי תאריך (קדימה/אחורה)
     */
    changeDate(days) {
        const date = new Date(this.currentDate);
        date.setDate(date.getDate() + days);
        this.currentDate = date.toISOString().split('T')[0];
        this.elements.dateInput.value = this.currentDate;
        this.loadTasks();
    }

    /**
     * עדכון תווית התאריך
     */
    updateDateLabel() {
        const date = new Date(this.currentDate + 'T00:00:00');
        const today = this.getTodayDate();
        
        const daysOfWeek = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
        const dayName = daysOfWeek[date.getDay()];
        
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const dateStr = date.toLocaleDateString('he-IL', options);
        
        let label = `יום ${dayName}, ${dateStr}`;
        
        if (this.currentDate === today) {
            label = `היום - ${label}`;
        } else {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            
            if (this.currentDate === yesterdayStr) {
                label = `אתמול - ${label}`;
            } else if (this.currentDate === tomorrowStr) {
                label = `מחר - ${label}`;
            }
        }
        
        this.elements.dateLabel.textContent = label;
    }

    /**
     * טעינת משימות מהמסד
     */
    async loadTasks() {
        try {
            this.tasks = await DB.getTasksByDate(this.currentDate);
            this.updateDateLabel();
            this.updateUI();
        } catch (error) {
            console.error('שגיאה בטעינת משימות:', error);
            this.showToast('שגיאה בטעינת המשימות', 'error');
        }
    }

    /**
     * הוספת משימה חדשה
     */
    async addTask() {
        const title = this.elements.taskInput.value.trim();
        
        if (!title) return;

        try {
            const task = await DB.addTask({
                title: title,
                date: this.currentDate
            });

            this.tasks.unshift(task);
            this.elements.taskInput.value = '';
            this.updateUI();
            
            const messages = ['מעולה! 💪', 'נוסף בהצלחה! ✨', 'יופי! 🎉', 'כל הכבוד! 👏'];
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            this.showToast(randomMessage, 'success');
        } catch (error) {
            console.error('שגיאה בהוספת משימה:', error);
            this.showToast('שגיאה בהוספת המשימה', 'error');
        }
    }

    /**
     * שינוי סטטוס השלמה של משימה
     */
    async toggleTask(taskId) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task) return;

            task.completed = !task.completed;
            await DB.updateTask(task);
            
            this.updateUI();
            
            if (task.completed) {
                const messages = ['כל הכבוד! 🎉', 'יפה מאוד! ⭐', 'עבודה מצוינת! 💪', 'מושלם! ✨'];
                const randomMessage = messages[Math.floor(Math.random() * messages.length)];
                this.showToast(randomMessage, 'success');
            }
        } catch (error) {
            console.error('שגיאה בעדכון משימה:', error);
            this.showToast('שגיאה בעדכון המשימה', 'error');
        }
    }

    /**
     * מחיקת משימה
     */
    async deleteTask(taskId) {
        try {
            // מחיקת התראה אם קיימת
            const task = this.tasks.find(t => t.id === taskId);
            if (task && task.notification) {
                await NotificationManager.cancelNotification(task);
            }

            await DB.deleteTask(taskId);
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.updateUI();
            this.showToast('המשימה נמחקה', 'success');
        } catch (error) {
            console.error('שגיאה במחיקת משימה:', error);
            this.showToast('שגיאה במחיקת המשימה', 'error');
        }
    }

    /**
     * פתיחת מודל התראות
     */
    openNotificationModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.currentTaskForNotification = task;
        
        // אם יש התראה קיימת, הצג אותה
        if (task.notification) {
            this.elements.notificationTime.value = task.notification.time;
        } else {
            // ברירת מחדל - שעה קדימה
            const now = new Date();
            now.setHours(now.getHours() + 1);
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            this.elements.notificationTime.value = timeStr;
        }

        this.elements.notificationModal.classList.add('show');
    }

    /**
     * סגירת מודל התראות
     */
    closeNotificationModal() {
        this.elements.notificationModal.classList.remove('show');
        this.currentTaskForNotification = null;
        this.elements.notificationTime.value = '';
    }

    /**
     * שמירת התראה
     */
    async saveNotification() {
        if (!this.currentTaskForNotification) return;

        const time = this.elements.notificationTime.value;
        if (!time) {
            this.showToast('יש לבחור שעה להתראה', 'error');
            return;
        }

        try {
            // בדיקת הרשאות
            if (NotificationManager.getPermission() !== 'granted') {
                const granted = await NotificationManager.requestPermission();
                if (!granted) {
                    this.showToast('יש לאשר התראות כדי להשתמש בתכונה זו', 'error');
                    return;
                }
            }

            await NotificationManager.scheduleNotification(this.currentTaskForNotification, time);
            
            // עדכון המשימה ברשימה
            const taskIndex = this.tasks.findIndex(t => t.id === this.currentTaskForNotification.id);
            if (taskIndex !== -1) {
                this.tasks[taskIndex] = this.currentTaskForNotification;
            }

            this.updateUI();
            this.closeNotificationModal();
            this.showToast('התראה הוגדרה בהצלחה ⏰', 'success');
        } catch (error) {
            console.error('שגיאה בהגדרת התראה:', error);
            this.showToast(error.message || 'שגיאה בהגדרת התראה', 'error');
        }
    }

    /**
     * הסרת התראה
     */
    async removeNotification() {
        if (!this.currentTaskForNotification) return;

        try {
            await NotificationManager.cancelNotification(this.currentTaskForNotification);
            
            // עדכון המשימה ברשימה
            const taskIndex = this.tasks.findIndex(t => t.id === this.currentTaskForNotification.id);
            if (taskIndex !== -1) {
                this.tasks[taskIndex] = this.currentTaskForNotification;
            }

            this.updateUI();
            this.closeNotificationModal();
            this.showToast('ההתראה הוסרה', 'success');
        } catch (error) {
            console.error('שגיאה בהסרת התראה:', error);
            this.showToast('שגיאה בהסרת ההתראה', 'error');
        }
    }

    /**
     * עדכון ממשק המשתמש
     */
    updateUI() {
        this.renderTasks();
        this.updateStats();
    }

    /**
     * רינדור רשימת המשימות
     */
    renderTasks() {
        if (this.tasks.length === 0) {
            this.elements.tasksList.innerHTML = '';
            this.elements.emptyState.classList.remove('hidden');
            return;
        }

        this.elements.emptyState.classList.add('hidden');
        
        const tasksHTML = this.tasks.map(task => `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                <input 
                    type="checkbox" 
                    class="task-checkbox" 
                    ${task.completed ? 'checked' : ''}
                    onchange="app.toggleTask(${task.id})"
                >
                <div class="task-text">${this.escapeHtml(task.title)}</div>
                <div class="task-actions">
                    <button 
                        class="task-notification-btn ${task.notification ? 'active' : ''}" 
                        onclick="app.openNotificationModal(${task.id})"
                        title="${task.notification ? 'התראה פעילה: ' + task.notification.time : 'הוסף התראה'}"
                    >
                        ${task.notification ? '🔔' : '🔕'}
                    </button>
                    <button 
                        class="task-delete-btn" 
                        onclick="app.deleteTask(${task.id})"
                    >
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');

        this.elements.tasksList.innerHTML = tasksHTML;
    }

    /**
     * עדכון סטטיסטיקות
     */
    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;

        this.elements.stats.innerHTML = `
            <div class="stat-item">
                <div class="stat-value">${total}</div>
                <div class="stat-label">סה"כ משימות</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${completed}</div>
                <div class="stat-label">הושלמו</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${pending}</div>
                <div class="stat-label">בהמתנה</div>
            </div>
        `;
    }

    /**
     * הצגת הודעת Toast
     */
    showToast(message, type = 'success') {
        this.elements.toast.textContent = message;
        this.elements.toast.className = `toast ${type}`;
        this.elements.toast.classList.add('show');

        setTimeout(() => {
            this.elements.toast.classList.remove('show');
        }, 3000);
    }

    /**
     * Escape HTML לביטחון
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * הגדרת PWA
     */
    setupPWA() {
        // רישום Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker נרשם בהצלחה:', registration);
                })
                .catch(error => {
                    console.error('שגיאה ברישום Service Worker:', error);
                });
        }

        // התקנת PWA
        let deferredPrompt;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            this.elements.installBtn.style.display = 'block';
        });

        this.elements.installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;

            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                this.showToast('האפליקציה הותקנה בהצלחה! 🎉', 'success');
            }
            
            deferredPrompt = null;
            this.elements.installBtn.style.display = 'none';
        });

        // הסתרת כפתור התקנה אם האפליקציה כבר מותקנת
        window.addEventListener('appinstalled', () => {
            this.elements.installBtn.style.display = 'none';
            this.showToast('האפליקציה הותקנה! 🎉', 'success');
        });
    }
}

// אתחול האפליקציה
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TodoApp();
});
