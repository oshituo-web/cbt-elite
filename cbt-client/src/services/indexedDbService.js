const DB_NAME = 'cbt_elite_offline'
const DB_VERSION = 1
const STORES = {
    QUESTIONS: 'questions',
    OFFLINE_SESSIONS: 'offline_sessions'
}

export const IndexedDbService = {
    _db: null,

    async getDb() {
        if (this._db) return this._db
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION)
            request.onupgradeneeded = (e) => {
                const db = e.target.result
                if (!db.objectStoreNames.contains(STORES.QUESTIONS)) {
                    db.createObjectStore(STORES.QUESTIONS, { keyPath: 'id' })
                }
                if (!db.objectStoreNames.contains(STORES.OFFLINE_SESSIONS)) {
                    db.createObjectStore(STORES.OFFLINE_SESSIONS, { keyPath: 'id', autoIncrement: true })
                }
            }
            request.onsuccess = (e) => {
                this._db = e.target.result
                resolve(this._db)
            }
            request.onerror = (e) => reject(e.target.error)
        })
    },

    async saveQuestions(questions) {
        const db = await this.getDb()
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.QUESTIONS, 'readwrite')
            const store = tx.objectStore(STORES.QUESTIONS)
            questions.forEach(q => store.put(q))
            tx.oncomplete = () => resolve(true)
            tx.onerror = () => reject(tx.error)
        })
    },

    async getQuestions(subject = null, limit = 50) {
        const db = await this.getDb()
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.QUESTIONS, 'readonly')
            const store = tx.objectStore(STORES.QUESTIONS)
            const request = store.getAll()
            request.onsuccess = () => {
                let results = request.result
                if (subject) {
                    results = results.filter(q => q.subject === subject)
                }
                resolve(results.slice(0, limit))
            }
            request.onerror = () => reject(request.error)
        })
    },

    async queueOfflineSession(sessionData) {
        const db = await this.getDb()
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.OFFLINE_SESSIONS, 'readwrite')
            const store = tx.objectStore(STORES.OFFLINE_SESSIONS)
            store.add({
                ...sessionData,
                timestamp: new Date().toISOString(),
                synced: false
            })
            tx.oncomplete = () => resolve(true)
            tx.onerror = () => reject(tx.error)
        })
    },

    async getUnsyncedSessions() {
        const db = await this.getDb()
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.OFFLINE_SESSIONS, 'readonly')
            const store = tx.objectStore(STORES.OFFLINE_SESSIONS)
            const request = store.getAll()
            request.onsuccess = () => {
                resolve(request.result.filter(s => !s.synced))
            }
            request.onerror = () => reject(request.error)
        })
    },

    async markSessionSynced(id) {
        const db = await this.getDb()
        const tx = db.transaction(STORES.OFFLINE_SESSIONS, 'readwrite')
        const store = tx.objectStore(STORES.OFFLINE_SESSIONS)
        const request = store.get(id)
        request.onsuccess = () => {
            const data = request.result
            if (data) {
                data.synced = true
                store.put(data)
            }
        }
    }
}
