    const State = {
        userId: null, previousMetrics: {},
        trackInfo: { id: null, name: null, laps: 5, length: 3.4, get total() { return this.laps * this.length; } },
        observers: [], isUpdating: false,
        customUIContainer: null, originalLeaderboard: null,
        settingsPopupInstance: null, advancedStatsPanelInstance: null, historyPanelInstance: null, infoPanelInstance: null, downloadPopupInstance: null,
        trackNameMap: null, carBaseStatsMap: null, currentRaceClass: null,
        isInitialized: false, isRaceViewActive: false, raceFinished: false, currentRaceId: null,
        controlsContainer: null,
        finalRaceData: [],
        mapSelectionInitializedForRace: null,

        resetRaceState() {
            document.querySelectorAll('.driver-telemetry-display').forEach(el => {
                if (el._animationRAF) cancelAnimationFrame(el._animationRAF);
                el._animationRAF = null;
                el._currentAnimSpeed = undefined;
                el._currentAnimAcc = undefined;
            });

            this.previousMetrics = {};
            this.raceFinished = false;
            this.finalRaceData = [];
            this.currentRaceId = null;
            this.mapSelectionInitializedForRace = null;
            if (typeof TabWorkspace !== 'undefined') TabWorkspace.invalidateRaceBoundViews();
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
            this.raceFinished = false;
            this.finalRaceData = [];
            this.currentRaceId = null;
            this.mapSelectionInitializedForRace = null;
        }
    };
