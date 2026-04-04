    const HistoryManager = {
        logStorageKey: 'racingHistoryLog_v3.1.0',

        loadLog() {
            try {
                const storedLog = GM_getValue(this.logStorageKey, '[]');
                State.historyLog = JSON.parse(storedLog);
                if (State.historyLog.length > 0) {
                    const latest = State.historyLog[0];
                    State.lastKnownSkill = latest.skill;
                    State.lastKnownClass = latest.class;
                    State.lastKnownPoints = latest.points;
                } else {
                    State.lastKnownSkill = null;
                    State.lastKnownClass = null;
                    State.lastKnownPoints = null;
                }
            } catch (e) {
                State.historyLog = [];
                State.lastKnownSkill = null;
                State.lastKnownClass = null;
                State.lastKnownPoints = null;
                GM_setValue(this.logStorageKey, '[]');
            }
        },
        saveLog() {
            try {
                const limit = Config.get('historyLogLimit');
                if (State.historyLog.length > limit) {
                    State.historyLog = State.historyLog.slice(0, limit);
                }
                GM_setValue(this.logStorageKey, JSON.stringify(State.historyLog));
            } catch (e) {}
        },
        getLog() {
            return [...State.historyLog];
        },
        clearLog() {
            State.historyLog = [];
            State.lastKnownSkill = null;
            State.lastKnownClass = null;
            State.lastKnownPoints = null;
            GM_deleteValue(this.logStorageKey);
        },
        getCurrentSkillAndClass() {
            const skillElement = document.querySelector('div.banner div.skill');
            const classElement = document.querySelector('div.banner div.class-letter');
            const skill = skillElement ? parseFloat(skillElement.textContent) : null;
            const className = classElement ? classElement.textContent.trim().toUpperCase() : null;
            return { skill: !isNaN(skill) ? skill : null, class: className };
        },
        async checkAndLogUserStats() {
            if (!Config.get('historyEnabled') || !State.isRaceViewActive || !State.userId) return;

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
                     State.historyLog.unshift(newEntry);
                     const limit = Config.get('historyLogLimit');
                     if (State.historyLog.length > limit) { State.historyLog = State.historyLog.slice(0, limit); }
                     this.saveLog();
                     State.lastKnownSkill = currentSkill;
                     State.lastKnownClass = currentClass;
                     State.lastKnownPoints = currentPoints;
                     if (State.historyPanelInstance) { UI.createHistoryPanel(); }
                 }
            }
        },
        startCheckInterval() {
            if (State.historyCheckIntervalId) clearInterval(State.historyCheckIntervalId);
            State.historyCheckIntervalId = null;

            if (!Config.get('historyEnabled') || !State.isInitialized || !State.isRaceViewActive || !State.userId) return;

            this.checkAndLogUserStats();
            const intervalMs = Config.get('historyCheckInterval');
            State.historyCheckIntervalId = setInterval(() => { this.checkAndLogUserStats(); }, intervalMs);
        },
         restartCheckInterval() {
            this.startCheckInterval();
        }
    };
