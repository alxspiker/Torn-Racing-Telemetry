    function toggleDetails(event) { if (event.target.tagName === 'A') return; const driverItem = event.target.closest('.custom-driver-item'); if (driverItem && !State.isUpdating) { const driverId = driverItem.dataset.userId; const isOpening = !driverItem.classList.contains('details-visible'); driverItem.classList.toggle('details-visible'); const position = Array.from(driverItem.parentNode.children).indexOf(driverItem) + 1; const driverData = RaceManager.parseDriverData(document.getElementById(driverItem.dataset.originalId)); if (driverData) { RaceManager.updateDriverElement(driverItem, driverData, position); } if (isOpening && Config.get('fetchApiStatsOnClick') && driverId) { if (!driverItem.hasAttribute('data-stats-loaded') && !APIManager.isFetching.has(driverId)) { setTimeout(() => APIManager.fetchAndDisplayRacingStats(driverItem, driverId), 50); } } } }

    function cleanupScriptState(reason = "Unknown") {
        if (State.observers.length > 0) { State.observers.forEach(obs => obs.disconnect()); State.observers = []; }
        document.querySelectorAll('.driver-telemetry-display').forEach(el => {
            if (el._animationRAF) cancelAnimationFrame(el._animationRAF);
             el._animationRAF = null;
             el._currentAnimSpeed = undefined;
             el._currentAnimAcc = undefined;
        });
        State.controlsContainer?.remove();
        State.customUIContainer?.remove();
        State.customUIContainer = null;
        State.controlsContainer = null;
        State.clearPopupsAndFullReset();
        State.isRaceViewActive = false;
        document.body.classList.remove('hide-original-leaderboard', 'telemetry-hidden');
    }

    async function purgeHistoryStorageIfNeeded() {
        if (State.historyStoragePurged) {
            return;
        }
        State.historyStoragePurged = true;

        try {
            GM_deleteValue('racingHistoryLog_v3.1.0');
        } catch (e) { }

        if (typeof HistoryStore !== 'undefined' && HistoryStore?.isSupported?.()) {
            try {
                await HistoryStore.clearEntries();
            } catch (e) { }
        }
    }

    async function initialize() {
        if (State.isInitialized) { return true; }
        try {
            let userIdFound = false;
            // Primary source: topBannerInitData global object
            const userIdFromBanner = window.topBannerInitData?.user?.data?.userID;
            if (userIdFromBanner) {
                State.userId = userIdFromBanner.toString();
                userIdFound = true;
            }

            // Fallback source: #torn-user input element
            if (!userIdFound) {
                const userInput = document.getElementById('torn-user');
                if (userInput) {
                    const userData = JSON.parse(userInput.value);
                    State.userId = userData.id?.toString();
                    if (State.userId) {
                        userIdFound = true;
                    }
                }
            }

            if (!userIdFound) throw new Error("User ID could not be determined.");


            // Auto-configure PDA key if running in PDA and no key is set
            if (isPDA && Config.get('apiKey') === '') {
                Config.set('apiKey', '###PDA-APIKEY###');
                Utils.showNotification('Torn PDA API key automatically configured.', 'success');
            }
            await purgeHistoryStorageIfNeeded();

            State.originalLeaderboard = document.getElementById('leaderBoard');
            const originalScrollbarContainer = document.getElementById('drivers-scrollbar');
            if (!State.originalLeaderboard || !originalScrollbarContainer) { throw new Error("Leaderboard elements not found."); }
            APIManager.raceData.install();
            const parentContainer = originalScrollbarContainer.parentNode;

            if (!State.controlsContainer) {
                State.controlsContainer = document.getElementById('telemetryControlsContainer');
                if (!State.controlsContainer) {
                    State.controlsContainer = document.createElement('div');
                    State.controlsContainer.id = 'telemetryControlsContainer';
                    State.controlsContainer.className = 'telemetry-controls-container';
                    parentContainer.insertBefore(State.controlsContainer, originalScrollbarContainer);
                }
            }

            if (!State.customUIContainer) {
                State.customUIContainer = document.getElementById('custom-driver-list-container');
                if (State.customUIContainer) { State.customUIContainer.removeEventListener('click', toggleDetails); }
                else { State.customUIContainer = document.createElement('div'); State.customUIContainer.id = 'custom-driver-list-container'; parentContainer.insertBefore(State.customUIContainer, originalScrollbarContainer); }
                State.customUIContainer.addEventListener('click', toggleDetails);
            }

            UI.initializeControls();
            State.currentRaceId = RaceManager.getRaceId();
            await RaceManager.updateTrackAndClassInfo();
            document.body.classList.toggle('hide-original-leaderboard', Config.get('hideOriginalList'));

            if (Config.get('hideOriginalList') && State.originalLeaderboard.children.length > 0) { RaceManager.stableUpdateCustomList(); }
            else if (!Config.get('hideOriginalList')) { State.resetRaceState(); }

            State.isInitialized = true;

            if (State.observers.length === 0 && document.body.contains(State.originalLeaderboard)) {
                const observer = new MutationObserver(() => {
                    window.requestAnimationFrame(async () => {
                        if (State.isUpdating || !State.isInitialized) return;
                         try {
                             const detectedRaceId = RaceManager.getRaceId();
                             if (detectedRaceId && detectedRaceId !== State.currentRaceId) {
                                 State.currentRaceId = detectedRaceId;
                             }
                            await RaceManager.updateTrackAndClassInfo();
                            RaceManager.stableUpdateCustomList();
                        } catch (e) {
                             console.error("Telemetry Script: Error during leaderboard update:", e);
                        }
                    });
                });
                const observerConfig = { childList: true, subtree: true, attributes: true, characterData: true };
                observer.observe(State.originalLeaderboard, observerConfig);
                State.observers.push(observer);
            }

            RaceManager.stableUpdateCustomList();

            return true;
        } catch (e) { Utils.showNotification(`Init Error: ${e.message}`, "error"); cleanupScriptState("Initialization error"); return false; }
    }

    let currentHref = document.location.href;
    const pageObserver = new MutationObserver(() => { if (currentHref !== document.location.href) { currentHref = document.location.href; if (State.isInitialized) { cleanupScriptState("Page Navigation"); } } });
    const raceViewObserver = new MutationObserver((mutations) => { let raceViewEntered = false; let raceViewExited = false; for (const mutation of mutations) { if (mutation.addedNodes.length) { for (const node of mutation.addedNodes) { if (node.nodeType === 1 && (node.id === 'racingupdates' || node.querySelector('#racingupdates'))) { raceViewEntered = true; break; } } } if (raceViewEntered) break; if (mutation.removedNodes.length) { for (const node of mutation.removedNodes) { if (node.nodeType === 1 && node.id === 'racingupdates') { raceViewExited = true; break; } } } if (raceViewExited) break; } if (raceViewEntered && !State.isRaceViewActive) { State.isRaceViewActive = true; setTimeout(initialize, 150); } else if (raceViewExited && State.isRaceViewActive) { State.isRaceViewActive = false; if (State.isInitialized) { cleanupScriptState("Exited Race View"); } } });

    function startObservers() { ThemeManager.initialize(); pageObserver.observe(document.body, { childList: true, subtree: true }); raceViewObserver.observe(document.body, { childList: true, subtree: true }); if (document.getElementById('racingupdates')) { if (!State.isRaceViewActive) { State.isRaceViewActive = true; setTimeout(initialize, 100); } } else { State.isRaceViewActive = false; } }
    if (document.readyState === 'complete' || document.readyState === 'interactive') { startObservers(); } else { document.addEventListener('DOMContentLoaded', startObservers); }
    window.addEventListener('unload', () => { ThemeManager.disconnect(); pageObserver.disconnect(); raceViewObserver.disconnect(); if (State.isInitialized) { cleanupScriptState("Window Unload"); } });

})();
