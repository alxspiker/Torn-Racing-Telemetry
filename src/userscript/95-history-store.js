    const HistoryStore = {
        dbName: 'TornRacingTelemetry',
        dbVersion: 1,
        storeName: 'historyLogEntries',
        dbPromise: null,

        isSupported() {
            return typeof window.indexedDB !== 'undefined';
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
        async clearEntries() {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readwrite');
                tx.objectStore(this.storeName).clear();
                tx.oncomplete = () => resolve();
                tx.onabort = () => reject(tx.error || new Error('History clear transaction aborted.'));
                tx.onerror = () => reject(tx.error || new Error('Failed to clear history entries.'));
            });
        }
    };
