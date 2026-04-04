    const HistoryStore = {
        dbName: 'TornRacingTelemetry',
        dbVersion: 1,
        storeName: 'historyLogEntries',
        dbPromise: null,

        isSupported() {
            return typeof window.indexedDB !== 'undefined';
        },
        normalizeEntry(entry) {
            if (!entry || typeof entry !== 'object') return null;

            const timestamp = Number(entry.timestamp);
            if (!Number.isFinite(timestamp) || timestamp <= 0) return null;

            const skill = (typeof entry.skill === 'number' && Number.isFinite(entry.skill)) ? entry.skill : null;
            const className = (typeof entry.class === 'string' && entry.class.trim()) ? entry.class.trim().toUpperCase() : null;
            const points = (typeof entry.points === 'number' && Number.isFinite(entry.points)) ? entry.points : null;

            return { timestamp, skill, class: className, points };
        },
        open() {
            if (!this.isSupported()) {
                return Promise.reject(new Error('IndexedDB is not available in this environment.'));
            }
            if (this.dbPromise) {
                return this.dbPromise;
            }

            this.dbPromise = new Promise((resolve, reject) => {
                const request = window.indexedDB.open(this.dbName, this.dbVersion);

                request.onupgradeneeded = () => {
                    const db = request.result;
                    const store = db.objectStoreNames.contains(this.storeName)
                        ? request.transaction.objectStore(this.storeName)
                        : db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });

                    if (!store.indexNames.contains('timestamp')) {
                        store.createIndex('timestamp', 'timestamp');
                    }
                };

                request.onsuccess = () => {
                    const db = request.result;
                    db.onversionchange = () => {
                        db.close();
                        this.dbPromise = null;
                    };
                    resolve(db);
                };

                request.onerror = () => {
                    this.dbPromise = null;
                    reject(request.error || new Error('Failed to open IndexedDB.'));
                };
            });

            return this.dbPromise;
        },
        async countEntries() {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const request = db.transaction(this.storeName, 'readonly').objectStore(this.storeName).count();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error || new Error('Failed to count history entries.'));
            });
        },
        async getEntries(limit = null) {
            const db = await this.open();
            const normalizedLimit = (limit === null || typeof limit === 'undefined') ? null : Math.max(0, Number(limit) || 0);

            return new Promise((resolve, reject) => {
                const entries = [];
                let settled = false;
                const tx = db.transaction(this.storeName, 'readonly');
                const request = tx.objectStore(this.storeName).index('timestamp').openCursor(null, 'prev');

                const finish = (value) => {
                    if (!settled) {
                        settled = true;
                        resolve(value);
                    }
                };
                const fail = (error) => {
                    if (!settled) {
                        settled = true;
                        reject(error);
                    }
                };

                request.onsuccess = () => {
                    const cursor = request.result;
                    if (!cursor || (normalizedLimit !== null && entries.length >= normalizedLimit)) {
                        finish(entries);
                        return;
                    }

                    const entry = this.normalizeEntry(cursor.value);
                    if (entry) {
                        entries.push(entry);
                    }
                    cursor.continue();
                };

                request.onerror = () => fail(request.error || new Error('Failed to read history entries.'));
                tx.onabort = () => fail(tx.error || new Error('History read transaction aborted.'));
            });
        },
        async getRecentEntries(limit) {
            return this.getEntries(limit);
        },
        async getAllEntries() {
            return this.getEntries(null);
        },
        async addEntry(entry) {
            const normalizedEntry = this.normalizeEntry(entry);
            if (!normalizedEntry) {
                return;
            }

            const db = await this.open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readwrite');
                tx.objectStore(this.storeName).add(normalizedEntry);
                tx.oncomplete = () => resolve();
                tx.onabort = () => reject(tx.error || new Error('History write transaction aborted.'));
                tx.onerror = () => reject(tx.error || new Error('Failed to write history entry.'));
            });
        },
        async importEntries(entries) {
            const normalizedEntries = Array.isArray(entries)
                ? entries.map(entry => this.normalizeEntry(entry)).filter(Boolean)
                : [];

            if (normalizedEntries.length === 0) {
                return 0;
            }

            const db = await this.open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readwrite');
                const store = tx.objectStore(this.storeName);

                normalizedEntries.forEach(entry => {
                    store.add(entry);
                });

                tx.oncomplete = () => resolve(normalizedEntries.length);
                tx.onabort = () => reject(tx.error || new Error('History migration transaction aborted.'));
                tx.onerror = () => reject(tx.error || new Error('Failed to migrate history entries.'));
            });
        },
        async clearEntries() {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readwrite');
                tx.objectStore(this.storeName).clear();
                tx.oncomplete = () => resolve();
                tx.onabort = () => reject(tx.error || new Error('History clear transaction aborted.'));
                tx.onerror = () => reject(tx.error || new Error('Failed to clear history entries.'));
            });
        },
        async migrateLegacyLog(legacyKey) {
            const entryCount = await this.countEntries();
            const legacyLog = GM_getValue(legacyKey, null);

            if (entryCount > 0) {
                if (legacyLog !== null && typeof legacyLog !== 'undefined') {
                    GM_deleteValue(legacyKey);
                }
                return 0;
            }

            if (legacyLog === null || typeof legacyLog === 'undefined') {
                return 0;
            }

            let parsedLog = legacyLog;
            if (typeof legacyLog === 'string') {
                try {
                    parsedLog = JSON.parse(legacyLog);
                } catch (e) {
                    GM_setValue(legacyKey, '[]');
                    return 0;
                }
            }

            if (!Array.isArray(parsedLog) || parsedLog.length === 0) {
                GM_deleteValue(legacyKey);
                return 0;
            }

            const importedCount = await this.importEntries(parsedLog);
            GM_deleteValue(legacyKey);
            return importedCount;
        }
    };
