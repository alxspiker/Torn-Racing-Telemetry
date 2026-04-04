    const HistoryManager = {
        logStorageKey: 'racingHistoryLog_v3.1.0',
        storageMode: 'legacy',
        isLoaded: false,
        isChecking: false,
        loadPromise: null,

        updateLastKnownValues() {
            const latest = State.historyLog[0] || null;
            State.lastKnownSkill = latest ? latest.skill : null;
            State.lastKnownClass = latest ? latest.class : null;
            State.lastKnownPoints = latest ? latest.points : null;
        },
        applyLogEntries(entries) {
            State.historyLog = Array.isArray(entries) ? [...entries] : [];
            this.updateLastKnownValues();
        },
        loadLegacyLog() {
            try {
                const storedLog = GM_getValue(this.logStorageKey, '[]');
                const parsedLog = typeof storedLog === 'string'
                    ? JSON.parse(storedLog)
                    : (Array.isArray(storedLog) ? storedLog : []);
                const historyLimit = Config.get('historyLogLimit');
                const recentEntries = Array.isArray(parsedLog)
                    ? parsedLog
                        .map(entry => HistoryStore.normalizeEntry(entry))
                        .filter(Boolean)
                        .sort((left, right) => right.timestamp - left.timestamp)
                        .slice(0, historyLimit)
                    : [];

                this.applyLogEntries(recentEntries);
            } catch (e) {
                this.applyLogEntries([]);
                GM_setValue(this.logStorageKey, '[]');
            }
        },
        saveLegacyLog() {
            try {
                const historyLimit = Config.get('historyLogLimit');
                State.historyLog = State.historyLog.slice(0, historyLimit);
                GM_setValue(this.logStorageKey, JSON.stringify(State.historyLog));
            } catch (e) {}
        },
        async refreshLogCache() {
            if (this.storageMode === 'indexeddb') {
                try {
                    const recentEntries = await HistoryStore.getRecentEntries(Config.get('historyLogLimit'));
                    this.applyLogEntries(recentEntries);
                    return;
                } catch (e) {
                    console.error('Torn Racing Telemetry: Failed to read history from IndexedDB, falling back to GM storage.', e);
                    this.storageMode = 'legacy';
                }
            }

            this.loadLegacyLog();
        },
        async loadLog() {
            if (this.isLoaded) {
                return;
            }
            if (this.loadPromise) {
                return this.loadPromise;
            }

            this.loadPromise = (async () => {
                if (HistoryStore.isSupported()) {
                    try {
                        await HistoryStore.open();
                        await HistoryStore.migrateLegacyLog(this.logStorageKey);
                        this.storageMode = 'indexeddb';
                        await this.refreshLogCache();
                        this.isLoaded = true;
                        return;
                    } catch (e) {
                        console.error('Torn Racing Telemetry: IndexedDB history storage unavailable, falling back to GM storage.', e);
                    }
                }

                this.storageMode = 'legacy';
                this.loadLegacyLog();
                this.isLoaded = true;
            })();

            try {
                await this.loadPromise;
            } finally {
                this.loadPromise = null;
            }
        },
        getLog() {
            return [...State.historyLog];
        },
        async getFullLog() {
            if (!this.isLoaded) {
                await this.loadLog();
            }

            if (this.storageMode === 'indexeddb') {
                try {
                    return await HistoryStore.getAllEntries();
                } catch (e) {
                    console.error('Torn Racing Telemetry: Failed to read the full history log from IndexedDB.', e);
                    this.storageMode = 'legacy';
                }
            }

            return this.getLog();
        },
        async clearLog() {
            if (!this.isLoaded && !this.loadPromise) {
                await this.loadLog();
            }

            this.applyLogEntries([]);

            if (this.storageMode === 'indexeddb') {
                try {
                    await HistoryStore.clearEntries();
                } catch (e) {
                    console.error('Torn Racing Telemetry: Failed to clear IndexedDB history storage, falling back to GM storage.', e);
                    this.storageMode = 'legacy';
                }
            }

            GM_deleteValue(this.logStorageKey);
        },
        prependLogEntry(entry) {
            const normalizedEntry = HistoryStore.normalizeEntry(entry);
            if (!normalizedEntry) {
                return;
            }

            const historyLimit = Config.get('historyLogLimit');
            State.historyLog = [
                normalizedEntry,
                ...State.historyLog.filter(existing =>
                    existing.timestamp !== normalizedEntry.timestamp ||
                    existing.skill !== normalizedEntry.skill ||
                    existing.class !== normalizedEntry.class ||
                    existing.points !== normalizedEntry.points
                )
            ].slice(0, historyLimit);

            this.updateLastKnownValues();
        },
        async persistEntry(entry) {
            const normalizedEntry = HistoryStore.normalizeEntry(entry);
            if (!normalizedEntry) {
                return;
            }

            if (this.storageMode === 'indexeddb') {
                try {
                    await HistoryStore.addEntry(normalizedEntry);
                    this.prependLogEntry(normalizedEntry);
                    return;
                } catch (e) {
                    console.error('Torn Racing Telemetry: Failed to write history to IndexedDB, falling back to GM storage.', e);
                    this.storageMode = 'legacy';
                }
            }

            this.prependLogEntry(normalizedEntry);
            this.saveLegacyLog();
        },
        getCurrentSkillAndClass() {
            const skillElement = document.querySelector('div.banner div.skill');
            const classElement = document.querySelector('div.banner div.class-letter');
            const skill = skillElement ? parseFloat(skillElement.textContent) : null;
            const className = classElement ? classElement.textContent.trim().toUpperCase() : null;
            return { skill: !isNaN(skill) ? skill : null, class: className };
        },
        async checkAndLogUserStats() {
            if (!Config.get('historyEnabled') || !State.isRaceViewActive || !State.userId || this.isChecking) return;

            if (!this.isLoaded) {
                await this.loadLog();
            }

            this.isChecking = true;
            try {
                const { skill: currentSkill, class: currentClass } = this.getCurrentSkillAndClass();
                let currentPoints = State.lastKnownPoints;

                if (Utils.isApiKeyAvailable() && !State.isFetchingPoints) {
                    State.isFetchingPoints = true;
                    const apiKey = Config.get('apiKey');
                    try {
                        const fetchedPoints = await APIManager.fetchUserRacingPoints(apiKey, State.userId);
                        if (fetchedPoints !== null) currentPoints = fetchedPoints;
                    } catch (e) { }
                    finally { State.isFetchingPoints = false; }
                }

                const latestLogEntry = State.historyLog.length > 0 ? State.historyLog[0] : null;
                const skillChanged = currentSkill !== null && (!latestLogEntry || currentSkill !== latestLogEntry.skill);
                const classChanged = currentClass !== null && (!latestLogEntry || currentClass !== latestLogEntry.class);
                const pointsChanged = currentPoints !== null && (!latestLogEntry || currentPoints !== latestLogEntry.points);

                if (!latestLogEntry || skillChanged || classChanged || pointsChanged) {
                    if (currentSkill !== null || currentClass !== null || currentPoints !== null) {
                        const newEntry = { timestamp: Date.now(), skill: currentSkill, class: currentClass, points: currentPoints };
                        await this.persistEntry(newEntry);
                        if (State.historyPanelInstance) { UI.createHistoryPanel(); }
                    }
                }
            } finally {
                this.isChecking = false;
            }
        },
        startCheckInterval() {
            if (State.historyCheckIntervalId) clearInterval(State.historyCheckIntervalId);
            State.historyCheckIntervalId = null;

            if (!Config.get('historyEnabled') || !State.isInitialized || !State.isRaceViewActive || !State.userId) return;

            this.checkAndLogUserStats().catch(() => {});
            const intervalMs = Config.get('historyCheckInterval');
            State.historyCheckIntervalId = setInterval(() => { this.checkAndLogUserStats().catch(() => {}); }, intervalMs);
        },
        restartCheckInterval() {
            this.startCheckInterval();
        }
    };
