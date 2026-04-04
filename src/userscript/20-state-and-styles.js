    const State = {
        userId: null, previousMetrics: {},
        trackInfo: { id: null, name: null, laps: 5, length: 3.4, get total() { return this.laps * this.length; } },
        observers: [], lastUpdateTimes: {}, periodicCheckIntervalId: null, isUpdating: false,
        customUIContainer: null, originalLeaderboard: null,
        settingsPopupInstance: null, advancedStatsPanelInstance: null, historyPanelInstance: null, infoPanelInstance: null, downloadPopupInstance: null,
        trackNameMap: null, carBaseStatsMap: null, currentRaceClass: null,
        isInitialized: false, isRaceViewActive: false, raceFinished: false, currentRaceId: null,
        controlsContainer: null,
        lastKnownSkill: null, lastKnownClass: null, lastKnownPoints: null, historyLog: [], historyCheckIntervalId: null, isFetchingPoints: false,
        activeCharts: [],
        finalRaceData: [],

        resetRaceState() {
            document.querySelectorAll('.driver-telemetry-display').forEach(el => {
                if (el._animationRAF) cancelAnimationFrame(el._animationRAF);
                el._animationRAF = null;
                el._currentAnimSpeed = undefined;
                el._currentAnimAcc = undefined;
            });

            this.previousMetrics = {};
            this.lastUpdateTimes = {};
            if (this.periodicCheckIntervalId) clearInterval(this.periodicCheckIntervalId);
            this.periodicCheckIntervalId = null;
            document.querySelectorAll('.custom-driver-item[data-stats-loaded]').forEach(el => {
                el.removeAttribute('data-stats-loaded');
                el.querySelectorAll('.api-stat').forEach(span => span.textContent = '...');
                el.querySelector('.api-stats-container')?.classList.remove('error', 'loaded', 'no-key');
            });
            this.destroyActiveCharts();
            this.raceFinished = false;
            this.finalRaceData = [];
            this.currentRaceId = null;
            UI.updateControlButtonsVisibility();
        },
        clearPopupsAndFullReset() {
            this.resetRaceState();
            this.settingsPopupInstance?.remove(); this.settingsPopupInstance = null;
            this.advancedStatsPanelInstance?.remove(); this.advancedStatsPanelInstance = null;
            this.historyPanelInstance?.remove(); this.historyPanelInstance = null;
            this.infoPanelInstance?.remove(); this.infoPanelInstance = null;
            this.downloadPopupInstance?.remove(); this.downloadPopupInstance = null;
            this.trackInfo = { id: null, name: null, laps: 5, length: 3.4, get total() { return this.laps * this.length; } };
            this.currentRaceClass = null;
            this.trackNameMap = null;
            this.carBaseStatsMap = null;
            this.isInitialized = false;
            this.controlsContainer = null;
            this.customUIContainer = null;
            if (this.historyCheckIntervalId) clearInterval(this.historyCheckIntervalId);
            this.historyCheckIntervalId = null;
            this.lastKnownSkill = null;
            this.lastKnownClass = null;
            this.lastKnownPoints = null;
            this.historyLog = [];
            this.isFetchingPoints = false;
            this.destroyActiveCharts();
            this.raceFinished = false;
            this.finalRaceData = [];
            this.currentRaceId = null;
        },
        destroyActiveCharts() {
            this.activeCharts.forEach(chart => {
                if (chart && typeof chart.destroy === 'function') {
                    try { chart.destroy(); } catch (e) {}
                }
            });
            this.activeCharts = [];
        }
    };
