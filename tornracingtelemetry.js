// ==UserScript==
// @name         Torn Racing Telemetry
// @namespace    https://www.torn.com/profiles.php?XID=2782979
// @version      3.5.4
// @description  Enhanced Torn Racing UI: Telemetry, driver stats, advanced stats panel, history tracking, and race results export.
// @match        https://www.torn.com/page.php?sid=racing*
// @match        https://www.torn.com/loader.php?sid=racing*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_info
// @grant        GM_setClipboard
// @connect      api.torn.com
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/522245/Torn%20Racing%20Telemetry.user.js
// @updateURL https://update.greasyfork.org/scripts/522245/Torn%20Racing%20Telemetry.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const ScriptInfo = {
        version: '3.5.4',
        author: "TheProgrammer",
        contactId: "2782979",
        contactUrl: function() { return `https://www.torn.com/profiles.php?XID=${this.contactId}`; },
        description: "Provides enhanced telemetry, stats analysis, historical tracking, and race results export for Torn Racing.",
        notes: [
            "v3.5.4: Refined the driver list with compact stacked Speed/Accel values, thin full-race and current-lap progress bars, and a compact finish-time display. The Show Progress setting now controls the bars. Estimated lap time moved to expanded driver details and now uses an 8-second rolling speed average. Speed and Accel share live green/red acceleration colors.",
            "v3.5.3: Thanks to The_GoodGuy [4012936] for the suggestion. Click a racer to select them on the track; use the new arrow to view their details.",
            "v3.5.2: Detailed JSON exports now include finish times, best laps, racing skill, skill gain, and car details. Finished-driver cards now show Race Time, Best Lap, and Skill Gained. Crashes are labeled correctly.",
            "v3.5.1: Thanks to @CharmRiver[2334174] for reporting the issue. Fixed theme consistency by defaulting telemetry UI panels/cards to the dark palette so layout readability stays stable even when Torn is in light mode.",
            "v3.5.0: Major architecture and panel overhaul. Migrated to modular source + build pipeline, replaced chart-based history/stats views with API-first timeline/cards/tables, added true paginated /user/races sync, redesigned driver dropdown telemetry UI, improved animation behavior (including progress mode), updated panel styling/colors, and removed deprecated dead code paths.",
            "v3.4.2: Thanks to @MikeyJDoug[2137820] for noticing. Fixed a critical error in the stats panel for new users or users with no official race history. The panel will now display a proper message instead of crashing.",
            "v3.4.1: Implemented Race ID capture for unique race identification in logs and exports. Improved User ID detection for better script initialization.",
            "v3.4.0: Major telemetry engine overhaul. Implemented advanced EMA smoothing for speed & acceleration, robust handling for data gaps to prevent artifacts, and a more predictive lap time estimation model for significantly improved accuracy and stability.",
            "Your API key and all other script data (settings, history log) are stored **locally** in your browser's userscript storage. They are **never** transmitted anywhere except to the official Torn API when fetching data.",
        ]
    };

    if (window.racingCustomUITelemetryHasRun) return;
    window.racingCustomUITelemetryHasRun = true;

    // Check if we're running in Torn PDA
    const isPDA = typeof window.flutter_inappwebview !== 'undefined' &&
                typeof window.flutter_inappwebview.callHandler === 'function';

    const Config = {
        defaults: {
            telemetryDisplayOptions: ['speed'],
            colorCode: true, animateChanges: true, speedUnit: 'mph',
            minUpdateInterval: 300, telemetryVisible: true, hideOriginalList: true, showLapEstimate: true,
            lapEstimateSmoothingFactor: 0.15, fetchApiStatsOnClick: true,
            historicalRaceLimit: 20,
            historyEnabled: true,
            statsPanelEnabled: true,
            speedSmoothingFactor: 0.7,
            maxAnimationDurationMs: 1000
        },
        data: {},
        storageKey: 'racingCustomUITelemetryConfig_v3.5.0', //never change or delete this comment unless absolutely game breaking update
        apiKeyStorageKey: 'racingCustomUITelemetryApiKey_persistent',

        load() {
            try {
                this.data = {...this.defaults, ...JSON.parse(GM_getValue(this.storageKey, '{}'))};
                this.data.apiKey = GM_getValue(this.apiKeyStorageKey, '');
            } catch (e) {
                this.data = {...this.defaults};
                this.data.apiKey = GM_getValue(this.apiKeyStorageKey, '');
            }
            for (const key in this.defaults) {
                if (!(key in this.data)) {
                    this.data[key] = this.defaults[key];
                }
            }
             if (!('speedSmoothingFactor' in this.data)) {
                this.data.speedSmoothingFactor = this.defaults.speedSmoothingFactor;
            }
             if (!('maxAnimationDurationMs' in this.data)) {
                this.data.maxAnimationDurationMs = this.defaults.maxAnimationDurationMs;
            }
            if ('animationLerpRate' in this.data) {
                delete this.data.animationLerpRate;
                this.save();
            }
            let hasDeprecatedHistoryKeys = false;
            ['historyCheckInterval', 'historyLogLimit'].forEach(key => {
                if (key in this.data) {
                    delete this.data[key];
                    hasDeprecatedHistoryKeys = true;
                }
            });
            if (hasDeprecatedHistoryKeys) {
                this.save();
            }
            return this.data;
        },
        save() {
            const dataToSave = { ...this.data };
            delete dataToSave.apiKey;
            GM_setValue(this.storageKey, JSON.stringify(dataToSave));
        },
        get(key) {
            return key in this.data ? this.data[key] : this.defaults[key];
        },
        set(key, value) {
            if (key === 'apiKey') {
                this.data.apiKey = value;
                GM_setValue(this.apiKeyStorageKey, value);
            } else {
                this.data[key] = value;
                this.save();
            }
        },
        async clearData() {
            const currentApiKey = GM_getValue(this.apiKeyStorageKey, '');
            this.data = { ...this.defaults };
            this.data.apiKey = currentApiKey;
            this.save();
        },
        clearApiKey() {
             this.data.apiKey = '';
             GM_deleteValue(this.apiKeyStorageKey);
        }
    };
    Config.load();

    const State = {
        userId: null, previousMetrics: {},
        trackInfo: { id: null, name: null, laps: 5, length: 3.4, get total() { return this.laps * this.length; } },
        observers: [], isUpdating: false,
        customUIContainer: null, originalLeaderboard: null,
        settingsPopupInstance: null, advancedStatsPanelInstance: null, historyPanelInstance: null, infoPanelInstance: null, downloadPopupInstance: null,
        trackNameMap: null, carBaseStatsMap: null, currentRaceClass: null,
        isInitialized: false, isRaceViewActive: false, raceFinished: false, currentRaceId: null,
        controlsContainer: null,
        historyStoragePurged: false,
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
            document.querySelectorAll('.custom-driver-item[data-stats-loaded]').forEach(el => {
                el.removeAttribute('data-stats-loaded');
                el.querySelectorAll('.api-stat').forEach(span => span.textContent = '...');
                el.querySelector('.api-stats-container')?.classList.remove('error', 'loaded', 'no-key');
            });
            this.raceFinished = false;
            this.finalRaceData = [];
            this.currentRaceId = null;
            this.mapSelectionInitializedForRace = null;
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

    const Utils = {
        convertSpeed(speed, unit) { return unit === 'kmh' ? speed * 1.60934 : speed; },
        formatTime(seconds, showMs = false) { if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '--:--' + (showMs ? '.---' : ''); const min = Math.floor(seconds / 60); const sec = Math.floor(seconds % 60); const ms = showMs ? '.' + (seconds % 1).toFixed(3).substring(2) : ''; return `${min}:${sec < 10 ? '0' : ''}${sec}${ms}`; },
        sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); },
        formatDate(timestamp, includeTime = false) {
            if (!timestamp || timestamp <= 0) return 'N/A';
            try {
                const date = new Date(timestamp);
                const dateString = date.toISOString().split('T')[0];
                if (includeTime) {
                    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                    return `${dateString} ${timeString}`;
                }
                return dateString;
            } catch (e) {
                return 'N/A';
            }
        },
        isApiKeyAvailable() {
            const apiKey = Config.get('apiKey');
            if (!apiKey) return false;
            if (apiKey.trim() !== '###PDA-APIKEY###') return true;
            return isPDA;
        },
        parseTime(timeString) { if (!timeString?.includes(':')) return 0; const parts = timeString.split(':'); if (parts.length === 2) { return (parseInt(parts[0], 10) || 0) * 60 + (parseFloat(parts[1]) || 0); } return 0; },
        parseProgress(text) { const match = text?.match(/(\d+\.?\d*)%/); return match ? parseFloat(match[1]) : 0; },
        makeAbsoluteUrl(url) { if (!url || url.startsWith('http') || url.startsWith('data:')) return url; if (url.startsWith('//')) return `${window.location.protocol}${url}`; if (url.startsWith('/')) return `${window.location.protocol}//${window.location.host}${url}`; const base = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')); return `${window.location.protocol}//${window.location.host}${base}/${url}`; },
        showNotification(message, type = 'info') { const notif = document.createElement('div'); notif.style.cssText = `position: fixed; bottom: 20px; right: 20px; background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'}; color: white; padding: 12px 20px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 9999; font-size: 14px; opacity: 0; transition: opacity 0.3s ease-in-out;`; notif.textContent = message; document.body.appendChild(notif); setTimeout(() => notif.style.opacity = '1', 10); setTimeout(() => { notif.style.opacity = '0'; setTimeout(() => notif.remove(), 300); }, 3000); },
        createElement(tagName, options = {}) {
            const element = document.createElement(tagName);
            const { className, text, html, attrs, dataset, children } = options;

            if (className) {
                element.className = className;
            }
            if (typeof text !== 'undefined') {
                element.textContent = text;
            } else if (typeof html !== 'undefined') {
                element.innerHTML = html;
            }
            if (attrs && typeof attrs === 'object') {
                Object.entries(attrs).forEach(([key, value]) => {
                    if (value !== null && typeof value !== 'undefined') {
                        element.setAttribute(key, String(value));
                    }
                });
            }
            if (dataset && typeof dataset === 'object') {
                Object.entries(dataset).forEach(([key, value]) => {
                    if (value !== null && typeof value !== 'undefined') {
                        element.dataset[key] = String(value);
                    }
                });
            }
            if (Array.isArray(children)) {
                children.filter(Boolean).forEach(child => element.appendChild(child));
            }

            return element;
        },
        escapeCSVField(field) {
            if (field === null || field === undefined) {
                return '';
            }
            const stringField = String(field);
            if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                return `"${stringField.replace(/"/g, '""')}"`;
            }
            return stringField;
        }
    };

    const Telemetry = {
        lapEstimateSpeedWindowMs: 8000,
        easeInOutQuad(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; },
        interpolateColor(color1, color2, factor) { const result = color1.map((c, i) => Math.round(c + factor * (color2[i] - c))); return `rgb(${result[0]}, ${result[1]}, ${result[2]})`; },
        getTelemetryColor(acceleration) { const grey = [136, 136, 136]; const green = [76, 175, 80]; const red = [244, 67, 54]; const defaultColor = getComputedStyle(document.documentElement).getPropertyValue('--telemetry-default-color').match(/\d+/g)?.map(Number) || grey; const accelColor = getComputedStyle(document.documentElement).getPropertyValue('--telemetry-accel-color').match(/\d+/g)?.map(Number) || green; const decelColor = getComputedStyle(document.documentElement).getPropertyValue('--telemetry-decel-color').match(/\d+/g)?.map(Number) || red; if (!Config.get('colorCode')) return `rgb(${defaultColor.join(', ')})`; const maxAcc = 1.0; let factor = Math.min(Math.abs(acceleration) / maxAcc, 1); factor = isNaN(factor) ? 0 : factor; if (acceleration > 0.05) return this.interpolateColor(defaultColor, accelColor, factor); if (acceleration < -0.05) return this.interpolateColor(defaultColor, decelColor, factor); return `rgb(${defaultColor.join(', ')})`; },
        ensureDisplayRefs(container) {
            if (!container) return null;
            if (container._displayRefs?.speedValue && container._displayRefs?.status) {
                return container._displayRefs;
            }

            const createStat = (className, label) => {
                const stat = document.createElement('span');
                stat.className = `telemetry-stat ${className}`;
                const labelSpan = document.createElement('span');
                labelSpan.className = 'telemetry-label';
                labelSpan.textContent = label;
                const valueSpan = document.createElement('span');
                valueSpan.className = 'telemetry-stat-value';
                stat.append(labelSpan, valueSpan);
                return { stat, value: valueSpan };
            };

            const statsWrap = document.createElement('span');
            statsWrap.className = 'telemetry-value telemetry-stats';
            const performanceColumn = document.createElement('span');
            performanceColumn.className = 'telemetry-column telemetry-performance';
            const raceColumn = document.createElement('span');
            raceColumn.className = 'telemetry-column telemetry-race';
            const speed = createStat('telemetry-speed', 'Speed');
            const acceleration = createStat('telemetry-acceleration', 'Accel');
            const statusSpan = document.createElement('span');
            statusSpan.className = 'telemetry-status telemetry-stat';

            performanceColumn.append(speed.stat, acceleration.stat);
            raceColumn.append(statusSpan);
            statsWrap.append(performanceColumn, raceColumn);

            container.replaceChildren(statsWrap);

            container._displayRefs = {
                statsWrap,
                performanceColumn,
                raceColumn,
                status: statusSpan,
                speedStat: speed.stat,
                speedValue: speed.value,
                accelerationStat: acceleration.stat,
                accelerationValue: acceleration.value,
            };
            return container._displayRefs;
        },
        setTelemetryDisplay(container, text, color) {
            const refs = this.ensureDisplayRefs(container);
            if (!refs) return;

            const parts = text.split('|').map(part => part.trim()).filter(Boolean);
            const speed = parts.find(part => /\s(?:mph|km\/h)$/i.test(part));
            const acceleration = parts.find(part => /\sg$/i.test(part));
            const status = parts.find(part => part !== speed && part !== acceleration && !/%$/.test(part));
            const hasTelemetryContent = Boolean(speed || acceleration || status);

            refs.statsWrap.hidden = !hasTelemetryContent;
            if (!hasTelemetryContent) {
                refs.speedStat.hidden = true;
                refs.accelerationStat.hidden = true;
                refs.status.hidden = true;
            } else if (speed || acceleration) {
                refs.speedStat.hidden = !speed;
                refs.accelerationStat.hidden = !acceleration;
                refs.status.hidden = !status;
                refs.speedValue.textContent = speed || '';
                refs.accelerationValue.textContent = acceleration || '';
                refs.status.textContent = status || '';
                refs.speedValue.style.color = color;
                refs.accelerationValue.style.color = color;
                refs.status.style.color = color;
            } else {
                refs.speedStat.hidden = true;
                refs.accelerationStat.hidden = true;
                refs.status.textContent = text;
                refs.status.style.color = color;
                refs.status.hidden = false;
            }
            const updateColumnState = (column, children) => {
                const visibleCount = children.filter(child => !child.hidden).length;
                column.hidden = visibleCount === 0;
                column.dataset.itemCount = String(visibleCount);
            };
            updateColumnState(refs.performanceColumn, [refs.speedStat, refs.accelerationStat]);
            updateColumnState(refs.raceColumn, [refs.status]);
        },
        ema(current, prev, alpha) {
            if (prev === null || typeof prev === 'undefined' || !isFinite(prev)) return current;
            return alpha * current + (1 - alpha) * prev;
        },
        calculateDriverMetrics(driverId, progressPercentage, timestamp) {
            const prev = State.previousMetrics[driverId] || {
                progress: 0, time: timestamp - Config.get('minUpdateInterval'),
                lastProgressValueAtChange: 0, lastProgressChangeTimestamp: timestamp - Config.get('minUpdateInterval'),
                reportedSpeed: 0, acceleration: 0, lastDisplayedSpeed: 0, lastDisplayedAcceleration: 0,
                firstUpdate: true, currentLap: 1, progressInLap: 0,
                rawLapEstimate: null, smoothedLapEstimate: null, statusClass: 'ready',
                raceStartTime: timestamp, totalTimeElapsed: 0, totalDistanceTraveled: 0, wasStale: false
            };

            const minDt = Config.get('minUpdateInterval') / 1000;
            const dtSinceLastUpdate = (timestamp - prev.time) / 1000;
            const staleThresholdMs = 1500;

            if (prev.firstUpdate) {
                const totalLaps = State.trackInfo.laps || 1;
                const percentPerLap = 100 / totalLaps;
                const currentLap = Math.min(totalLaps, Math.floor(progressPercentage / percentPerLap) + 1);
                const startPercentOfLap = (currentLap - 1) * percentPerLap;
                const progressInLap = percentPerLap > 0 ? Math.max(0, Math.min(100, ((progressPercentage - startPercentOfLap) / percentPerLap) * 100)) : 0;

                State.previousMetrics[driverId] = {
                    ...prev, progress: progressPercentage, time: timestamp,
                    lastProgressValueAtChange: progressPercentage, lastProgressChangeTimestamp: timestamp,
                    reportedSpeed: 0, acceleration: 0, lastDisplayedSpeed: 0, lastDisplayedAcceleration: 0,
                    firstUpdate: false, currentLap: currentLap, progressInLap: progressInLap,
                    raceStartTime: timestamp, wasStale: false
                };
                return { speed: 0, acceleration: 0, timeDelta: dtSinceLastUpdate * 1000, noUpdate: true };
            }

            // REVISED: Stale data handling. If no update for a while, decay speed.
            if (dtSinceLastUpdate * 1000 > staleThresholdMs) {
                const decayFactor = 0.85;
                const decayedSpeed = prev.reportedSpeed * decayFactor;
                const gentleDeceleration = -0.5;
                prev.time = timestamp;
                prev.reportedSpeed = decayedSpeed;
                prev.acceleration = this.ema(gentleDeceleration, prev.acceleration, 0.1);
                prev.wasStale = true;
                return { speed: prev.reportedSpeed, acceleration: prev.acceleration, timeDelta: dtSinceLastUpdate * 1000, noUpdate: false };
            }

            if (dtSinceLastUpdate < minDt) {
                 return { speed: prev.reportedSpeed, acceleration: prev.acceleration, timeDelta: dtSinceLastUpdate * 1000, noUpdate: true };
            }

            let currentSpeed = prev.reportedSpeed;
            let calculatedSpeedThisTick = false;
            const epsilon = 0.001;
            const progressChanged = Math.abs(progressPercentage - prev.lastProgressValueAtChange) > epsilon;
            let distanceDelta = 0;

            if (progressChanged) {
                 const dtSinceChange = (timestamp - prev.lastProgressChangeTimestamp) / 1000;
                 const progressDeltaSinceChange = progressPercentage - prev.lastProgressValueAtChange;

                 if (dtSinceChange > 0 && progressDeltaSinceChange > 0) {
                    distanceDelta = State.trackInfo.total * (progressDeltaSinceChange / 100);
                    const rawSpeedMph = (distanceDelta / dtSinceChange) * 3600;

                    // REVISED: Use explicit EMA with faster catch-up after stale period
                    let speedAlpha = 1.0 - Config.get('speedSmoothingFactor');
                    if (prev.wasStale) speedAlpha = Math.min(0.9, speedAlpha * 2);
                    currentSpeed = this.ema(rawSpeedMph, prev.reportedSpeed, speedAlpha);

                    calculatedSpeedThisTick = true;
                    prev.lastProgressValueAtChange = progressPercentage;
                    prev.lastProgressChangeTimestamp = timestamp;
                 } else {
                    currentSpeed = prev.reportedSpeed * Math.max(0.1, 1.0 - (dtSinceChange * 0.5));
                 }
            }

            currentSpeed = Math.max(0, currentSpeed);
            const speedDeltaMps = (currentSpeed - prev.reportedSpeed) * 0.44704;
            const rawAcceleration = (dtSinceLastUpdate <= 0) ? 0 : (speedDeltaMps / dtSinceLastUpdate) / 9.81;

            // REVISED: Dual-stage smoothing. Apply a separate, gentle EMA to acceleration.
            const accelAlpha = 0.25; // More smoothing for acceleration
            let smoothedAcceleration = this.ema(rawAcceleration, prev.acceleration, accelAlpha);
            smoothedAcceleration = Math.max(-3.0, Math.min(3.0, smoothedAcceleration)); // Clamp to realistic values

            const totalLaps = State.trackInfo.laps || 1;
            const percentPerLap = 100 / totalLaps;
            const currentLap = Math.min(totalLaps, Math.floor(progressPercentage / percentPerLap) + 1);
            const startPercentOfLap = (currentLap - 1) * percentPerLap;
            const progressInLap = percentPerLap > 0 ? Math.max(0, Math.min(100, ((progressPercentage - startPercentOfLap) / percentPerLap) * 100)) : 0;

            const totalTimeElapsed = (timestamp - prev.raceStartTime) / 1000;
            const totalDistanceTraveled = (prev.totalDistanceTraveled || 0) + distanceDelta;

            State.previousMetrics[driverId] = {
                 ...prev,
                 progress: progressPercentage, time: timestamp,
                 reportedSpeed: currentSpeed, acceleration: smoothedAcceleration,
                 lastDisplayedSpeed: currentSpeed, lastDisplayedAcceleration: smoothedAcceleration,
                 currentLap, progressInLap,
                 totalTimeElapsed, totalDistanceTraveled,
                 wasStale: false
            };

            return {
                speed: currentSpeed, acceleration: smoothedAcceleration,
                timeDelta: dtSinceLastUpdate * 1000, noUpdate: !calculatedSpeedThisTick
            };
        },
        calculateSmoothedLapEstimate(driverId, metrics) {
            const driverState = State.previousMetrics[driverId];
            if (!driverState) return null;

            const now = Date.now();
            const samples = driverState.lapEstimateSpeedSamples ||= [];
            samples.push({ time: now, speed: Math.max(0, Number(metrics.speed) || 0) });

            const windowStart = now - this.lapEstimateSpeedWindowMs;
            while (samples.length > 1 && samples[1].time <= windowStart) {
                samples.shift();
            }
            if (samples.length && samples[0].time < windowStart) {
                samples[0] = { ...samples[0], time: windowStart };
            }
            if ((driverState.totalTimeElapsed || 0) < 5) return null;

            let speedDistance = 0;
            let sampledDuration = 0;
            for (let index = 1; index < samples.length; index++) {
                const duration = samples[index].time - samples[index - 1].time;
                if (duration > 0) {
                    speedDistance += samples[index - 1].speed * duration;
                    sampledDuration += duration;
                }
            }
            const baseSpeed = sampledDuration > 0 ? speedDistance / sampledDuration : metrics.speed;
            if (baseSpeed <= 1) return null;

            const lapLength = State.trackInfo.length || 0;
            if (lapLength <= 0) return null;

            const remainingProgressInLap = 100 - driverState.progressInLap;
            const remainingDistance = lapLength * (remainingProgressInLap / 100);
            const rawEstimate = (remainingDistance / baseSpeed) * 3600;
            driverState.rawLapEstimate = rawEstimate;

            const alpha = Config.get('lapEstimateSmoothingFactor');
            let smoothedEstimate = this.ema(rawEstimate, driverState.smoothedLapEstimate, alpha);

            if (smoothedEstimate > 3600 || smoothedEstimate < 0 || !isFinite(smoothedEstimate)) {
                smoothedEstimate = driverState.smoothedLapEstimate ?? rawEstimate;
            }

            driverState.smoothedLapEstimate = smoothedEstimate;
            return smoothedEstimate;
        },
        animateTelemetry(element, fromSpeed, toSpeed, fromAcc, toAcc, duration, displayMode, speedUnit) {
            let startTime = null;
            const easeFunction = this.easeInOutQuad;
            const getColor = this.getTelemetryColor.bind(this);

            fromSpeed = Number(fromSpeed) || 0;
            toSpeed = Number(toSpeed) || 0;
            fromAcc = Number(fromAcc) || 0;
            toAcc = Number(toAcc) || 0;
            duration = Math.max(Config.get('minUpdateInterval'), Math.min(Number(duration) || Config.get('minUpdateInterval'), Config.get('maxAnimationDurationMs')));

            function step(timestamp) {
                if (!startTime) startTime = timestamp;
                let linearProgress = Math.min((timestamp - startTime) / duration, 1);
                if (isNaN(linearProgress) || duration <= 0) linearProgress = 1;

                let progress = easeFunction(linearProgress);
                let currentSpeed = fromSpeed + (toSpeed - fromSpeed) * progress;
                let currentAcc = fromAcc + (toAcc - fromAcc) * progress;
                element._currentAnimSpeed = currentSpeed;
                element._currentAnimAcc = currentAcc;

                let color = Config.get('colorCode') ? getColor(currentAcc) : 'var(--telemetry-default-color)';
                let text = '';

                if (displayMode === 'speed') { text = `${Math.round(currentSpeed)} ${speedUnit}`; }
                else if (displayMode === 'acceleration') { text = `${currentAcc.toFixed(1)} g`; }
                else if (displayMode === 'both') { text = `${Math.round(currentSpeed)} ${speedUnit} | ${currentAcc.toFixed(1)} g`; }

                Telemetry.setTelemetryDisplay(element, text, color);

                if (linearProgress < 1) {
                    element._animationRAF = requestAnimationFrame(step);
                } else {
                    element._animationRAF = null;
                    let finalSpeedText = `${Math.round(toSpeed)} ${speedUnit}`;
                    let finalAccelText = `${toAcc.toFixed(1)} g`;
                    let finalText = '';
                    if (displayMode === 'speed') { finalText = finalSpeedText; }
                    else if (displayMode === 'acceleration') { finalText = finalAccelText; }
                    else if (displayMode === 'both') { finalText = `${finalSpeedText} | ${finalAccelText}`; }
                    Telemetry.setTelemetryDisplay(element, finalText, Config.get('colorCode') ? getColor(toAcc) : 'var(--telemetry-default-color)');
                    element._currentAnimSpeed = undefined;
                    element._currentAnimAcc = undefined;
                }
            }

            if (element._animationRAF) {
                cancelAnimationFrame(element._animationRAF);
            }
            element._animationRAF = requestAnimationFrame(step);
        },
    };

    const UI = {
        createSettingsPopup() {
            if (State.settingsPopupInstance) State.settingsPopupInstance.remove();

            const popup = document.createElement('div');
            popup.className = 'settings-popup';
            const content = document.createElement('div');
            content.className = 'settings-popup-content';

            const displayOptions = Config.get('telemetryDisplayOptions');

            const createDivider = () => Utils.createElement('hr', {
                attrs: { style: 'border: none; border-top: 1px solid var(--border-color); margin: 20px 0;' }
            });
            const createToggleControl = (id, labelText) => {
                const container = Utils.createElement('div', { className: 'toggle-container' });
                const label = Utils.createElement('label', { attrs: { for: id }, text: labelText });
                const switchLabel = Utils.createElement('label', { className: 'switch' });
                const input = Utils.createElement('input', { attrs: { type: 'checkbox', id } });
                const slider = Utils.createElement('span', { className: 'slider' });
                switchLabel.append(input, slider);
                container.append(label, switchLabel);
                return container;
            };
            const createSettingsItem = ({ labelText = null, control = null, helpText = null }) => {
                const item = Utils.createElement('div', { className: 'settings-item' });
                if (labelText) {
                    item.appendChild(Utils.createElement('label', { text: labelText }));
                }
                if (control) {
                    item.appendChild(control);
                }
                if (helpText) {
                    item.appendChild(Utils.createElement('small', {
                        attrs: { style: 'color: #aaa; margin-top: 5px;' },
                        text: helpText
                    }));
                }
                return item;
            };

            const titleRow = Utils.createElement('div', { className: 'settings-title' });
            titleRow.append('Telemetry & UI Settings ');
            titleRow.appendChild(Utils.createElement('button', { className: 'settings-close', text: '\u00D7' }));

            const settingsContent = Utils.createElement('div', { className: 'settings-content' });
            settingsContent.appendChild(createSettingsItem({ control: createToggleControl('historyEnabled', 'Enable History Panel') }));
            settingsContent.appendChild(createSettingsItem({ control: createToggleControl('statsPanelEnabled', 'Enable Stats Panel') }));
            settingsContent.appendChild(createDivider());

            const telemetryGroup = Utils.createElement('div', { className: 'telemetry-options-group' });
            telemetryGroup.appendChild(createToggleControl('telemetryShowSpeed', 'Show Speed'));
            telemetryGroup.appendChild(createToggleControl('telemetryShowAcceleration', 'Show Acceleration'));
            telemetryGroup.appendChild(createToggleControl('telemetryShowProgress', 'Show Progress %'));
            settingsContent.appendChild(createSettingsItem({ labelText: 'Telemetry Display Options:', control: telemetryGroup }));

            const speedUnitSelect = Utils.createElement('select', { attrs: { id: 'speedUnit' } });
            speedUnitSelect.append(
                Utils.createElement('option', { attrs: { value: 'mph' }, text: 'mph' }),
                Utils.createElement('option', { attrs: { value: 'kmh' }, text: 'km/h' })
            );
            settingsContent.appendChild(createSettingsItem({ labelText: 'Speed Unit', control: speedUnitSelect }));
            settingsContent.appendChild(createSettingsItem({ control: createToggleControl('colorCode', 'Color Code Telemetry (by Accel)') }));
            settingsContent.appendChild(createSettingsItem({
                control: createToggleControl('animateChanges', 'Animate Changes (Simple Cases)'),
                helpText: 'Smoothly animates telemetry value changes between updates.'
            }));

            settingsContent.appendChild(createSettingsItem({
                labelText: 'Speed Smoothing Factor (0.1-0.9)',
                control: Utils.createElement('input', { attrs: { type: 'number', id: 'speedSmoothingFactor', min: '0.1', max: '0.9', step: '0.1' } }),
                helpText: `Weight of *previous* speed vs. new calculation (higher = smoother). Default: ${Config.defaults.speedSmoothingFactor}`
            }));
            settingsContent.appendChild(createSettingsItem({
                labelText: 'Max Animation Duration (ms)',
                control: Utils.createElement('input', { attrs: { type: 'number', id: 'maxAnimationDurationMs', min: '100', max: '3000', step: '100' } }),
                helpText: `Caps animation time for large update gaps. Default: ${Config.defaults.maxAnimationDurationMs}`
            }));
            settingsContent.appendChild(createSettingsItem({ control: createToggleControl('showLapEstimate', 'Show Est. Lap Time') }));
            settingsContent.appendChild(createSettingsItem({
                labelText: 'Lap Est. Display Smoothing (0.01-1.0)',
                control: Utils.createElement('input', { attrs: { type: 'number', id: 'lapEstimateSmoothingFactor', min: '0.01', max: '1.0', step: '0.01' } }),
                helpText: 'The estimate uses an 8-second rolling speed average. This setting adds final display smoothing (higher = more responsive).'
            }));
            settingsContent.appendChild(createDivider());

            settingsContent.appendChild(createSettingsItem({
                control: createToggleControl('fetchApiStatsOnClick', 'Load Driver API Stats on Click'),
                helpText: '(Requires API key)'
            }));
            const tosContainer = Utils.createElement('div', { className: 'api-tos-container' });
            tosContainer.innerHTML = `
                <p><strong>API Key Usage (ToS):</strong> This script stores your key and data locally in your browser only. It is never shared. Please expand the details below for full compliance information.</p>
                <details>
                    <summary>View API Usage Details (Torn ToS)</summary>
                    <table>
                        <thead>
                            <tr>
                                <th>Data Storage</th>
                                <th>Data Sharing</th>
                                <th>Purpose of Use</th>
                                <th>Key Storage & Sharing</th>
                                <th>Key Access Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Only locally</td>
                                <td>Nobody</td>
                                <td>Non-malicious statistical analysis</td>
                                <td>Stored locally / Not shared</td>
                                <td>Custom selections: <code>user (personalstats, races)</code>, <code>racing (tracks, cars, records)</code>. A 'Limited Access' key is sufficient.</td>
                            </tr>
                        </tbody>
                    </table>
                </details>`;
            settingsContent.appendChild(tosContainer);

            settingsContent.appendChild(createSettingsItem({
                labelText: 'Torn API Key (Limited Access Recommended)',
                control: Utils.createElement('input', { attrs: { type: 'password', id: 'apiKey', placeholder: "Enter API Key or use '###PDA-APIKEY###' in Torn PDA" } })
            }));
            settingsContent.appendChild(createSettingsItem({
                labelText: 'Advanced Stats: Races to Analyze',
                control: Utils.createElement('input', { attrs: { type: 'number', id: 'historicalRaceLimit', min: '10', max: '1000', step: '10' } })
            }));
            settingsContent.appendChild(createDivider());
            settingsContent.appendChild(createSettingsItem({ control: createToggleControl('hideOriginalList', "Hide Torn's Leaderboard") }));

            const settingsButtons = Utils.createElement('div', { className: 'settings-buttons' });
            settingsButtons.append(
                Utils.createElement('button', { className: 'settings-btn toggle-telemetry-btn', text: 'Toggle Telemetry' }),
                Utils.createElement('button', { className: 'settings-btn primary', attrs: { id: 'saveSettings' }, text: 'Save & Close' })
            );
            settingsContent.appendChild(settingsButtons);

            const dataButtons = Utils.createElement('div', { className: 'settings-data-buttons' });
            dataButtons.append(
                Utils.createElement('button', { className: 'settings-btn danger', attrs: { id: 'clearData' }, text: 'Clear Script Data' }),
                Utils.createElement('button', { className: 'settings-btn danger', attrs: { id: 'clearApiKey' }, text: 'Clear API Key' })
            );
            settingsContent.appendChild(dataButtons);

            content.append(titleRow, settingsContent);

            content.querySelector('#historyEnabled').checked = Config.get('historyEnabled');
            content.querySelector('#statsPanelEnabled').checked = Config.get('statsPanelEnabled');
            content.querySelector('#telemetryShowSpeed').checked = displayOptions.includes('speed');
            content.querySelector('#telemetryShowAcceleration').checked = displayOptions.includes('acceleration');
            content.querySelector('#telemetryShowProgress').checked = displayOptions.includes('progress');
            content.querySelector('#speedUnit').value = Config.get('speedUnit');
            content.querySelector('#colorCode').checked = Config.get('colorCode');
            content.querySelector('#animateChanges').checked = Config.get('animateChanges');
            content.querySelector('#speedSmoothingFactor').value = Config.get('speedSmoothingFactor');
            content.querySelector('#maxAnimationDurationMs').value = Config.get('maxAnimationDurationMs');
            content.querySelector('#showLapEstimate').checked = Config.get('showLapEstimate');
            content.querySelector('#lapEstimateSmoothingFactor').value = Config.get('lapEstimateSmoothingFactor');
            content.querySelector('#fetchApiStatsOnClick').checked = Config.get('fetchApiStatsOnClick');
            content.querySelector('#historicalRaceLimit').value = Config.get('historicalRaceLimit');
            content.querySelector('#hideOriginalList').checked = Config.get('hideOriginalList');
            content.querySelector('.toggle-telemetry-btn').textContent = Config.get('telemetryVisible') ? 'Hide Telemetry' : 'Show Telemetry';

            const apiKeyInput = content.querySelector('#apiKey');
            apiKeyInput.value = Config.get('apiKey');
            if (isPDA && apiKeyInput.value.trim() === '###PDA-APIKEY###') {
                apiKeyInput.disabled = true;
                const pdaNote = document.createElement('small');
                pdaNote.style.cssText = 'color: var(--api-info-color); margin-top: 5px; display: block;';
                pdaNote.textContent = 'Using Torn PDA managed API key. To change, edit in Torn PDA settings.';
                apiKeyInput.parentNode.insertBefore(pdaNote, apiKeyInput.nextSibling);
            }

            const closePopup = () => {
                popup.remove();
                State.settingsPopupInstance = null;
            };

            content.querySelector('.settings-close').addEventListener('click', closePopup);
            popup.addEventListener('click', e => { if (e.target === popup) closePopup(); });
            content.querySelector('.toggle-telemetry-btn').addEventListener('click', e => {
                const newState = !Config.get('telemetryVisible');
                Config.set('telemetryVisible', newState);
                document.body.classList.toggle('telemetry-hidden', !newState);
                e.target.textContent = newState ? 'Hide Telemetry' : 'Show Telemetry';
                Utils.showNotification(`Telemetry display ${newState ? 'shown' : 'hidden'}.`);
            });
            content.querySelector('#hideOriginalList').addEventListener('change', e => {
                const hide = e.target.checked;
                Config.set('hideOriginalList', hide);
                document.body.classList.toggle('hide-original-leaderboard', hide);
                if (!hide) {
                    RaceManager.stableUpdateCustomList();
                }
            });

            content.querySelector('#saveSettings').addEventListener('click', async () => {
                const selectedOptions = [];

                if (content.querySelector('#telemetryShowSpeed').checked) selectedOptions.push('speed');
                if (content.querySelector('#telemetryShowAcceleration').checked) selectedOptions.push('acceleration');
                if (content.querySelector('#telemetryShowProgress').checked) selectedOptions.push('progress');
                Config.set('telemetryDisplayOptions', selectedOptions);

                Config.set('historyEnabled', content.querySelector('#historyEnabled').checked);
                Config.set('statsPanelEnabled', content.querySelector('#statsPanelEnabled').checked);
                Config.set('speedUnit', content.querySelector('#speedUnit').value);
                Config.set('colorCode', content.querySelector('#colorCode').checked);
                Config.set('animateChanges', content.querySelector('#animateChanges').checked);

                let speedSmooth = parseFloat(content.querySelector('#speedSmoothingFactor').value);
                if (isNaN(speedSmooth) || speedSmooth < 0.1 || speedSmooth > 0.9) {
                    speedSmooth = Config.defaults.speedSmoothingFactor;
                    content.querySelector('#speedSmoothingFactor').value = speedSmooth;
                    Utils.showNotification('Invalid Speed Smoothing Factor, reset to default.', 'error');
                }
                Config.set('speedSmoothingFactor', speedSmooth);

                let animDuration = parseInt(content.querySelector('#maxAnimationDurationMs').value, 10);
                if (isNaN(animDuration) || animDuration < 100 || animDuration > 3000) {
                    animDuration = Config.defaults.maxAnimationDurationMs;
                    content.querySelector('#maxAnimationDurationMs').value = animDuration;
                    Utils.showNotification('Invalid Max Animation Duration, reset to default.', 'error');
                }
                Config.set('maxAnimationDurationMs', animDuration);

                Config.set('showLapEstimate', content.querySelector('#showLapEstimate').checked);
                Config.set('fetchApiStatsOnClick', content.querySelector('#fetchApiStatsOnClick').checked);

                const apiKeyInputFromUser = content.querySelector('#apiKey').value.trim();
                if (apiKeyInputFromUser.length > 0 && apiKeyInputFromUser.length < 16 && apiKeyInputFromUser !== '###PDA-APIKEY###') {
                    Utils.showNotification('API Key seems too short.', 'error');
                } else {
                    Config.set('apiKey', apiKeyInputFromUser);
                }

                let lapSmoothFactor = parseFloat(content.querySelector('#lapEstimateSmoothingFactor').value);
                if (isNaN(lapSmoothFactor) || lapSmoothFactor < 0.01 || lapSmoothFactor > 1.0) {
                    lapSmoothFactor = Config.defaults.lapEstimateSmoothingFactor;
                    content.querySelector('#lapEstimateSmoothingFactor').value = lapSmoothFactor;
                    Utils.showNotification('Invalid Lap Est. Smoothing Factor, reset to default.', 'error');
                }
                Config.set('lapEstimateSmoothingFactor', lapSmoothFactor);

                let raceLimit = parseInt(content.querySelector('#historicalRaceLimit').value, 10);
                if (isNaN(raceLimit) || raceLimit < 10 || raceLimit > 1000) {
                    raceLimit = Config.defaults.historicalRaceLimit;
                    content.querySelector('#historicalRaceLimit').value = raceLimit;
                    Utils.showNotification('Invalid Race Limit, reset to default.', 'error');
                }
                Config.set('historicalRaceLimit', raceLimit);
                Utils.showNotification('Settings saved!', 'success');
                closePopup();
                UI.updateControlButtonsVisibility();

                RaceManager.stableUpdateCustomList();
            });

            content.querySelector('#clearData').addEventListener('click', async () => {
                if (confirm('Are you sure you want to clear all script settings (except API key)? This cannot be undone.')) {
                    await Config.clearData();
                    Utils.showNotification('Script data cleared!', 'success');
                    closePopup();
                    UI.updateControlButtonsVisibility();
                    RaceManager.stableUpdateCustomList();
                }
            });

            content.querySelector('#clearApiKey').addEventListener('click', () => {
                if (confirm('Are you sure you want to clear your API key? You will need to re-enter it to use API features.')) {
                    Config.clearApiKey();
                    content.querySelector('#apiKey').value = '';
                    Utils.showNotification('API Key cleared!', 'success');
                }
            });

            popup.appendChild(content);
            document.body.appendChild(popup);
            State.settingsPopupInstance = popup;
        },
        createPanelMessage(className, text, tagName = 'p') {
            return Utils.createElement(tagName, { className, text });
        },
        createIssueBanner(messages) {
            const banner = Utils.createElement('div', { className: 'error-msg' });
            banner.appendChild(Utils.createElement('strong', { text: 'Encountered issues:' }));
            messages.forEach(message => {
                banner.appendChild(document.createElement('br'));
                banner.append(message);
            });
            return banner;
        },
        createStatsCards(items, wrapperClass = 'stats-summary-cards') {
            const wrapper = Utils.createElement('div', { className: wrapperClass });
            items.forEach(item => {
                const card = Utils.createElement('div', { className: 'stats-summary-card' });
                const label = Utils.createElement('div', { className: 'stats-summary-label', text: item.label });
                const value = Utils.createElement('div', {
                    className: `stats-summary-value${item.trendClass ? ` ${item.trendClass}` : ''}`,
                    text: item.value
                });
                card.append(label, value);
                wrapper.appendChild(card);
            });
            return wrapper;
        },
        aggregateRaceWindow(entries) {
            const races = Array.isArray(entries) ? entries : [];
            const finished = races.filter(entry => !entry.crashed && Number.isFinite(entry.position));
            const crashes = races.filter(entry => entry.crashed).length;
            const wins = finished.filter(entry => entry.position === 1).length;
            const avgPosition = finished.length ? (finished.reduce((sum, entry) => sum + entry.position, 0) / finished.length) : null;
            const winRate = finished.length ? (wins / finished.length) * 100 : null;
            const crashRate = races.length ? (crashes / races.length) * 100 : null;
            const bestLapValues = races.map(entry => entry.bestLap).filter(value => Number.isFinite(value));
            const avgBestLap = bestLapValues.length
                ? (bestLapValues.reduce((sum, value) => sum + value, 0) / bestLapValues.length)
                : null;
            const skillGainTotal = races.reduce((sum, entry) => sum + (Number.isFinite(entry.skillGain) ? entry.skillGain : 0), 0);
            const avgSkillGainPerRace = races.length ? (skillGainTotal / races.length) : null;
            return { races: races.length, avgPosition, winRate, crashRate, avgBestLap, skillGainTotal, avgSkillGainPerRace };
        },
        getComparisonWindows(entries, targetWindow = 20) {
            const normalizedEntries = Array.isArray(entries) ? entries : [];
            const maxWindow = Math.max(1, Number(targetWindow) || 20);
            const availablePairs = Math.floor(normalizedEntries.length / 2);
            const windowSize = Math.min(maxWindow, availablePairs);
            if (windowSize <= 0) {
                return { recentWindow: [], previousWindow: [], hasPrevious: false };
            }

            const recentWindow = normalizedEntries.slice(0, windowSize);
            const previousWindow = normalizedEntries.slice(windowSize, windowSize * 2);
            return { recentWindow, previousWindow, hasPrevious: previousWindow.length > 0 };
        },
        createSortableStatsTableSection({ title, columns, rows, defaultSortKey, defaultSortDir = 'desc', emptyMessage = 'No data available.' }) {
            const section = document.createDocumentFragment();
            section.appendChild(Utils.createElement('h3', { text: title }));

            if (!Array.isArray(rows) || rows.length === 0) {
                section.appendChild(this.createPanelMessage('info-msg', emptyMessage));
                return section;
            }

            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const tbody = document.createElement('tbody');
            const sortState = {
                key: defaultSortKey || columns[0]?.key,
                dir: defaultSortDir
            };

            const getColumn = key => columns.find(column => column.key === key) || columns[0];
            const getSortValue = (row, column) => {
                if (typeof column.sortValue === 'function') return column.sortValue(row);
                return row[column.key];
            };
            const compareRows = (left, right) => {
                const column = getColumn(sortState.key);
                const leftValue = getSortValue(left, column);
                const rightValue = getSortValue(right, column);
                const leftMissing = leftValue === null || typeof leftValue === 'undefined';
                const rightMissing = rightValue === null || typeof rightValue === 'undefined';

                let result = 0;
                if (leftMissing && rightMissing) result = 0;
                else if (leftMissing) result = 1;
                else if (rightMissing) result = -1;
                else if (typeof leftValue === 'number' && typeof rightValue === 'number') result = leftValue - rightValue;
                else result = String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: 'base', numeric: true });

                return sortState.dir === 'asc' ? result : -result;
            };
            const renderRows = () => {
                const sortedRows = [...rows].sort(compareRows);
                const nodes = sortedRows.map(row => {
                    const tr = Utils.createElement('tr', { className: row.className || '' });
                    columns.forEach(column => {
                        const td = Utils.createElement('td', { className: column.className || '' });
                        const value = typeof column.render === 'function'
                            ? column.render(row)
                            : row[column.key];
                        if (value instanceof Node) {
                            td.appendChild(value);
                        } else {
                            td.textContent = value ?? '';
                        }
                        tr.appendChild(td);
                    });
                    return tr;
                });
                tbody.replaceChildren(...nodes);
            };

            columns.forEach(column => {
                const th = Utils.createElement('th', { className: column.className || '' });
                const button = Utils.createElement('button', {
                    className: 'stats-sort-btn',
                    text: column.label,
                    attrs: { type: 'button' }
                });
                button.addEventListener('click', () => {
                    if (sortState.key === column.key) {
                        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortState.key = column.key;
                        sortState.dir = column.defaultDir || (column.className?.includes('numeric') ? 'desc' : 'asc');
                    }
                    renderRows();
                });
                th.appendChild(button);
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.append(thead, tbody);
            renderRows();
            section.appendChild(table);
            return section;
        },
        formatCentisecondsAsLapTime(lapTimeCs) {
            if (!Number.isFinite(lapTimeCs)) return '-';
            return Utils.formatTime(lapTimeCs / 100, true);
        },
        createStatsTable(headers, rows) {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tbody = document.createElement('tbody');
            const headerRow = document.createElement('tr');

            headers.forEach(header => {
                headerRow.appendChild(Utils.createElement('th', {
                    className: header.className || '',
                    text: header.text
                }));
            });

            rows.forEach(row => {
                const tr = Utils.createElement('tr', { className: row.className || '' });
                row.cells.forEach(cell => {
                    const td = Utils.createElement('td', { className: cell.className || '' });
                    if (cell.node) {
                        td.appendChild(cell.node);
                    } else {
                        td.textContent = cell.text ?? '';
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });

            thead.appendChild(headerRow);
            table.append(thead, tbody);
            return table;
        },
        createInlineStatPairs(pairs, className = '') {
            const container = Utils.createElement('span', className ? { className } : {});
            pairs.forEach((pair, index) => {
                if (index > 0) container.append(' | ');
                if (pair.label) {
                    container.appendChild(Utils.createElement('strong', { text: `${pair.label}:` }));
                    container.append(` ${pair.value}`);
                } else {
                    container.append(pair.text ?? '');
                }
            });
            return container;
        },
        async createAdvancedStatsPanel() {
            if (!Config.get('statsPanelEnabled')) return;
            if (State.advancedStatsPanelInstance) State.advancedStatsPanelInstance.remove();

            const popup = document.createElement('div');
            popup.className = 'stats-panel';
            const content = document.createElement('div');
            content.className = 'stats-panel-content';
            const statsContentDiv = document.createElement('div');
            statsContentDiv.className = 'stats-content';
            statsContentDiv.replaceChildren(this.createPanelMessage('loading-msg', 'Loading advanced stats...', 'div'));
            content.innerHTML = '<div class="stats-title">Advanced Race Statistics <button class="stats-close">&times;</button></div>';
            content.appendChild(statsContentDiv);

            const closePanel = () => {
                popup.remove();
                State.advancedStatsPanelInstance = null;
            };

            content.querySelector('.stats-close').addEventListener('click', closePanel);
            popup.addEventListener('click', e => { if (e.target === popup) closePanel(); });
            popup.appendChild(content);
            document.body.appendChild(popup);
            State.advancedStatsPanelInstance = popup;

            const errorMessages = [];
            let historicalStatsContent = null;
            let trackAnalysisContent = null;
            let processedData = null;
            let trackRecords = null;
            let topCarsData = null;
            let raceEntries = [];
            let userRacingRecords = [];

            try {
                if (!Utils.isApiKeyAvailable()) throw new Error('API Key not configured in Settings.');
                const apiKey = Config.get('apiKey');
                if (!State.userId) throw new Error('User ID not found.');

                if (!State.trackNameMap) {
                    try {
                        State.trackNameMap = await APIManager.fetchTrackData(apiKey);
                    } catch (e) {
                        errorMessages.push(`Could not fetch track names: ${e.message}`);
                        State.trackNameMap = {};
                    }
                }
                if (!State.carBaseStatsMap) {
                    try {
                        State.carBaseStatsMap = await APIManager.fetchCarBaseStats(apiKey);
                    } catch (e) {
                        errorMessages.push(`Could not fetch car base stats: ${e.message}`);
                        State.carBaseStatsMap = {};
                    }
                }

                await RaceManager.updateTrackAndClassInfo();
                const currentTrackId = State.trackInfo.id;
                const currentTrackName = State.trackInfo.name || `Track ${currentTrackId || 'Unknown'}`;
                const currentRaceClass = State.currentRaceClass;
                let currentUserCar = null;

                try {
                    currentUserCar = this.parseCurrentUserCarStats();
                } catch (e) { }

                if (!currentTrackId) errorMessages.push('Could not identify the current track.');
                if (!currentRaceClass) errorMessages.push('Could not identify the race class from page banner.');

                const historicalPromise = APIManager.fetchHistoricalRaceData(apiKey, State.userId, Config.get('historicalRaceLimit'));
                const personalRecordsPromise = APIManager.fetchUserRacingRecords(apiKey);
                const trackRecordsPromise = (currentTrackId && currentRaceClass)
                    ? APIManager.fetchTrackRecords(apiKey, currentTrackId, currentRaceClass)
                    : Promise.resolve(null);

                const [histResult, personalRecordsResult, recordResult] = await Promise.allSettled([
                    historicalPromise,
                    personalRecordsPromise,
                    trackRecordsPromise
                ]);

                if (personalRecordsResult.status === 'fulfilled') {
                    userRacingRecords = personalRecordsResult.value;
                } else {
                    errorMessages.push(`Could not fetch personal racing records: ${personalRecordsResult.reason?.message || 'Unknown error.'}`);
                }

                if (histResult.status === 'fulfilled') {
                    processedData = StatsCalculator.processRaceData(histResult.value, State.userId);
                    raceEntries = histResult.value
                        .map(race => this.normalizeHistoryRaceEntry(race, State.userId))
                        .filter(Boolean);
                    historicalStatsContent = this.buildHistoricalStatsHTML(processedData, raceEntries, userRacingRecords);
                } else {
                    errorMessages.push(`Could not fetch historical races: ${histResult.reason?.message || 'Unknown error.'}`);
                    historicalStatsContent = this.buildHistoricalStatsHTML(null, [], userRacingRecords);
                }

                if (recordResult.status === 'fulfilled' && recordResult.value !== null) {
                    trackRecords = recordResult.value;
                    topCarsData = StatsCalculator.processTrackRecords(trackRecords);
                } else if (recordResult.status === 'rejected') {
                    if (!recordResult.reason?.message?.includes('404')) {
                        errorMessages.push(`Could not fetch track records: ${recordResult.reason?.message || 'Unknown error.'}`);
                    } else {
                        trackRecords = [];
                        topCarsData = [];
                    }
                }

                if (currentTrackId && currentRaceClass) {
                    trackAnalysisContent = this.buildTrackAnalysisHTML(trackRecords, currentUserCar, currentTrackName, currentRaceClass, topCarsData);
                } else {
                    trackAnalysisContent = document.createDocumentFragment();
                    trackAnalysisContent.appendChild(this.createPanelMessage('info-msg', 'Track analysis requires knowing the track and race class.'));
                }
            } catch (error) {
                errorMessages.push(`An unexpected error occurred: ${error.message}`);
                if (!historicalStatsContent) {
                    historicalStatsContent = document.createDocumentFragment();
                    historicalStatsContent.appendChild(this.createPanelMessage('error-msg', 'Failed to load historical data.'));
                }
                if (!trackAnalysisContent) {
                    trackAnalysisContent = document.createDocumentFragment();
                    trackAnalysisContent.appendChild(this.createPanelMessage('error-msg', 'Failed to load track analysis data.'));
                }
            } finally {
                const finalFragment = document.createDocumentFragment();
                if (errorMessages.length > 0) {
                    finalFragment.appendChild(this.createIssueBanner(errorMessages));
                }
                if (historicalStatsContent) {
                    finalFragment.appendChild(historicalStatsContent);
                }
                if (trackAnalysisContent) {
                    finalFragment.appendChild(trackAnalysisContent);
                }
                if (State.advancedStatsPanelInstance !== popup || !document.body.contains(popup)) {
                    return;
                }
                statsContentDiv.replaceChildren(finalFragment);
            }
        },
        buildHistoricalStatsHTML(processedData, raceEntries = [], userRacingRecords = []) {
            const fragment = document.createDocumentFragment();
            fragment.appendChild(Utils.createElement('h3', { text: 'Performance Snapshot' }));

            if (!processedData || processedData.totalRaces === 0) {
                fragment.appendChild(this.createPanelMessage('info-msg', 'No recent official race data found to analyze.'));
            } else {
                const overall = processedData.overall;
                const trackStats = Object.values(processedData.trackStats);
                const carStats = Object.values(processedData.carStats);
                const bestLap = raceEntries
                    .map(entry => entry.bestLap)
                    .filter(value => Number.isFinite(value))
                    .sort((left, right) => left - right)[0];

                const analyzedParagraph = document.createElement('p');
                analyzedParagraph.append('Analyzed ');
                analyzedParagraph.appendChild(Utils.createElement('strong', { text: String(overall.races) }));
                analyzedParagraph.append(` official races from ${Utils.formatDate(processedData.firstRaceTime)} to ${Utils.formatDate(processedData.lastRaceTime)}.`);
                fragment.appendChild(analyzedParagraph);

                fragment.appendChild(this.createStatsCards([
                    { label: 'Races', value: String(overall.races) },
                    { label: 'Wins / Podiums', value: `${overall.wins} / ${overall.podiums}` },
                    { label: 'Avg Position', value: overall.avgPosition.toFixed(2) },
                    { label: 'Win Rate', value: `${overall.winRate.toFixed(1)}%` },
                    { label: 'Crash Rate', value: `${overall.crashRate.toFixed(1)}%` },
                    { label: 'Best Lap', value: Number.isFinite(bestLap) ? Utils.formatTime(bestLap, true) : 'N/A' }
                ]));

                const { recentWindow, previousWindow, hasPrevious } = this.getComparisonWindows(raceEntries, 20);
                const recentAgg = this.aggregateRaceWindow(recentWindow);
                const previousAgg = this.aggregateRaceWindow(previousWindow);
                const avgPosDelta = hasPrevious && Number.isFinite(recentAgg.avgPosition) && Number.isFinite(previousAgg.avgPosition)
                    ? recentAgg.avgPosition - previousAgg.avgPosition
                    : null;
                const winRateDelta = hasPrevious && Number.isFinite(recentAgg.winRate) && Number.isFinite(previousAgg.winRate)
                    ? recentAgg.winRate - previousAgg.winRate
                    : null;
                const crashRateDelta = hasPrevious && Number.isFinite(recentAgg.crashRate) && Number.isFinite(previousAgg.crashRate)
                    ? recentAgg.crashRate - previousAgg.crashRate
                    : null;
                const lapDelta = hasPrevious && Number.isFinite(recentAgg.avgBestLap) && Number.isFinite(previousAgg.avgBestLap)
                    ? recentAgg.avgBestLap - previousAgg.avgBestLap
                    : null;
                const skillGainValues = raceEntries
                    .map(entry => entry.skillGain)
                    .filter(value => Number.isFinite(value));
                const avgSkillGainShown = skillGainValues.length
                    ? (skillGainValues.reduce((sum, value) => sum + value, 0) / skillGainValues.length)
                    : null;

                fragment.appendChild(this.createStatsCards([
                    { label: 'Window', value: `Last ${recentWindow.length} vs Prev ${previousWindow.length}` },
                    {
                        label: 'Avg Pos Δ',
                        value: this.formatSignedNumber(avgPosDelta, 2),
                        trendClass: avgPosDelta < 0 ? 'positive' : (avgPosDelta > 0 ? 'negative' : '')
                    },
                    {
                        label: 'Win Rate Δ',
                        value: Number.isFinite(winRateDelta) ? `${this.formatSignedNumber(winRateDelta, 1)} pp` : 'N/A',
                        trendClass: winRateDelta > 0 ? 'positive' : (winRateDelta < 0 ? 'negative' : '')
                    },
                    {
                        label: 'Crash Rate Δ',
                        value: Number.isFinite(crashRateDelta) ? `${this.formatSignedNumber(crashRateDelta, 1)} pp` : 'N/A',
                        trendClass: crashRateDelta < 0 ? 'positive' : (crashRateDelta > 0 ? 'negative' : '')
                    },
                    {
                        label: 'Avg Lap Δ',
                        value: Number.isFinite(lapDelta) ? `${this.formatSignedNumber(lapDelta, 3)}s` : 'N/A',
                        trendClass: lapDelta < 0 ? 'positive' : (lapDelta > 0 ? 'negative' : '')
                    },
                    {
                        label: 'Avg Skill / Race',
                        value: this.formatSignedNumber(avgSkillGainShown, 4),
                        trendClass: avgSkillGainShown > 0 ? 'positive' : (avgSkillGainShown < 0 ? 'negative' : '')
                    }
                ], 'stats-delta-cards'));

                fragment.appendChild(this.createSortableStatsTableSection({
                    title: 'Track Breakdown',
                    columns: [
                        { key: 'name', label: 'Track' },
                        { key: 'races', label: 'Races', className: 'numeric', defaultDir: 'desc' },
                        { key: 'avgPosition', label: 'Avg Pos', className: 'numeric', defaultDir: 'asc', render: row => row.avgPosition.toFixed(2) },
                        { key: 'winRate', label: 'Win %', className: 'numeric', defaultDir: 'desc', render: row => row.winRate.toFixed(1) },
                        { key: 'podiumRate', label: 'Podium %', className: 'numeric', defaultDir: 'desc', render: row => row.podiumRate.toFixed(1) },
                        { key: 'crashRate', label: 'Crash %', className: 'numeric', defaultDir: 'asc', render: row => row.crashRate.toFixed(1) },
                        {
                            key: 'bestLap',
                            label: 'Best Lap',
                            className: 'numeric',
                            defaultDir: 'asc',
                            sortValue: row => Number.isFinite(row.bestLap) ? row.bestLap : null,
                            render: row => Number.isFinite(row.bestLap) ? Utils.formatTime(row.bestLap, true) : '-'
                        }
                    ],
                    rows: trackStats,
                    defaultSortKey: 'races',
                    defaultSortDir: 'desc',
                    emptyMessage: 'No track-specific data.'
                }));

                fragment.appendChild(this.createSortableStatsTableSection({
                    title: 'Car Breakdown',
                    columns: [
                        { key: 'name', label: 'Car' },
                        { key: 'races', label: 'Races', className: 'numeric', defaultDir: 'desc' },
                        { key: 'avgPosition', label: 'Avg Pos', className: 'numeric', defaultDir: 'asc', render: row => row.avgPosition.toFixed(2) },
                        { key: 'winRate', label: 'Win %', className: 'numeric', defaultDir: 'desc', render: row => row.winRate.toFixed(1) },
                        { key: 'podiumRate', label: 'Podium %', className: 'numeric', defaultDir: 'desc', render: row => row.podiumRate.toFixed(1) },
                        { key: 'crashRate', label: 'Crash %', className: 'numeric', defaultDir: 'asc', render: row => row.crashRate.toFixed(1) }
                    ],
                    rows: carStats,
                    defaultSortKey: 'races',
                    defaultSortDir: 'desc',
                    emptyMessage: 'No car-specific data.'
                }));

                fragment.appendChild(this.createSortableStatsTableSection({
                    title: `Recent Official Races (${raceEntries.length})`,
                    columns: [
                        { key: 'timestamp', label: 'Date', defaultDir: 'desc', render: row => Utils.formatDate(row.timestamp, true) },
                        { key: 'trackName', label: 'Track' },
                        {
                            key: 'position',
                            label: 'Pos',
                            className: 'numeric',
                            defaultDir: 'asc',
                            sortValue: row => row.crashed ? Number.POSITIVE_INFINITY : (Number.isFinite(row.position) ? row.position : Number.POSITIVE_INFINITY),
                            render: row => row.crashed ? 'CR' : (Number.isFinite(row.position) ? String(row.position) : '-')
                        },
                        {
                            key: 'skillGain',
                            label: 'Skill Δ',
                            className: 'numeric',
                            defaultDir: 'desc',
                            sortValue: row => Number.isFinite(row.skillGain) ? row.skillGain : null,
                            render: row => this.formatSignedNumber(row.skillGain, 4)
                        },
                        {
                            key: 'bestLap',
                            label: 'Best Lap',
                            className: 'numeric',
                            defaultDir: 'asc',
                            sortValue: row => Number.isFinite(row.bestLap) ? row.bestLap : null,
                            render: row => Number.isFinite(row.bestLap) ? Utils.formatTime(row.bestLap, true) : '-'
                        },
                        {
                            key: 'raceTime',
                            label: 'Race Time',
                            className: 'numeric',
                            defaultDir: 'asc',
                            sortValue: row => Number.isFinite(row.raceTime) ? row.raceTime : null,
                            render: row => Number.isFinite(row.raceTime) ? Utils.formatTime(row.raceTime, true) : '-'
                        },
                        { key: 'carName', label: 'Car' },
                        { key: 'carClass', label: 'Class', render: row => row.carClass || '-' }
                    ],
                    rows: raceEntries,
                    defaultSortKey: 'timestamp',
                    defaultSortDir: 'desc',
                    emptyMessage: 'No recent races available.'
                }));
            }

            const records = Array.isArray(userRacingRecords) ? userRacingRecords : [];
            if (records.length === 0) {
                fragment.appendChild(this.createPanelMessage('info-msg', 'No personal racing records returned by the API.'));
                return fragment;
            }

            const trackRecordRows = records.map(record => {
                const laps = (record.records || []).map(entry => Number(entry?.lap_time)).filter(value => Number.isFinite(value));
                if (laps.length === 0) return null;
                const bestLapCs = Math.min(...laps);
                const worstLapCs = Math.max(...laps);
                const bestRecord = (record.records || []).find(entry => Number(entry?.lap_time) === bestLapCs) || {};
                return {
                    trackName: record.track?.name || `Track ${record.track?.id ?? '?'}`,
                    bestLapCs,
                    bestCar: bestRecord.car_name || 'Unknown Car',
                    entries: laps.length,
                    spreadCs: worstLapCs - bestLapCs
                };
            }).filter(Boolean);

            fragment.appendChild(this.createSortableStatsTableSection({
                title: 'Personal Record Tracks',
                columns: [
                    { key: 'trackName', label: 'Track' },
                    { key: 'bestLapCs', label: 'Best Lap', className: 'numeric', defaultDir: 'asc', render: row => this.formatCentisecondsAsLapTime(row.bestLapCs) },
                    { key: 'bestCar', label: 'Best Car' },
                    { key: 'entries', label: 'Record Entries', className: 'numeric', defaultDir: 'desc' },
                    { key: 'spreadCs', label: 'Spread', className: 'numeric', defaultDir: 'asc', render: row => this.formatCentisecondsAsLapTime(row.spreadCs) }
                ],
                rows: trackRecordRows,
                defaultSortKey: 'bestLapCs',
                defaultSortDir: 'asc',
                emptyMessage: 'No personal track records available.'
            }));

            const carMap = {};
            records.forEach(record => {
                (record.records || []).forEach(entry => {
                    const carName = entry?.car_name || 'Unknown Car';
                    const lapTime = Number(entry?.lap_time);
                    if (!carMap[carName]) {
                        carMap[carName] = { carName, entries: 0, bestLapCs: Number.POSITIVE_INFINITY, totalLapCs: 0, lapCount: 0 };
                    }
                    carMap[carName].entries++;
                    if (Number.isFinite(lapTime)) {
                        carMap[carName].bestLapCs = Math.min(carMap[carName].bestLapCs, lapTime);
                        carMap[carName].totalLapCs += lapTime;
                        carMap[carName].lapCount++;
                    }
                });
            });
            const carRecordRows = Object.values(carMap).map(row => ({
                ...row,
                avgLapCs: row.lapCount > 0 ? row.totalLapCs / row.lapCount : null
            }));

            fragment.appendChild(this.createSortableStatsTableSection({
                title: 'Cars In Personal Records',
                columns: [
                    { key: 'carName', label: 'Car' },
                    { key: 'entries', label: 'Entries', className: 'numeric', defaultDir: 'desc' },
                    {
                        key: 'bestLapCs',
                        label: 'Best Lap',
                        className: 'numeric',
                        defaultDir: 'asc',
                        sortValue: row => Number.isFinite(row.bestLapCs) ? row.bestLapCs : null,
                        render: row => Number.isFinite(row.bestLapCs) ? this.formatCentisecondsAsLapTime(row.bestLapCs) : '-'
                    },
                    {
                        key: 'avgLapCs',
                        label: 'Avg Lap',
                        className: 'numeric',
                        defaultDir: 'asc',
                        sortValue: row => Number.isFinite(row.avgLapCs) ? row.avgLapCs : null,
                        render: row => Number.isFinite(row.avgLapCs) ? this.formatCentisecondsAsLapTime(row.avgLapCs) : '-'
                    }
                ],
                rows: carRecordRows,
                defaultSortKey: 'entries',
                defaultSortDir: 'desc',
                emptyMessage: 'No car record data available.'
            }));

            return fragment;
        },
        buildTrackAnalysisHTML(trackRecords, currentUserCar, trackName, raceClass, topCarsData) {
            const fragment = document.createDocumentFragment();
            fragment.appendChild(Utils.createElement('h3', { text: `Track Analysis: ${trackName} (Class ${raceClass || 'Unknown'})` }));
            fragment.appendChild(Utils.createElement('h4', { className: 'track-analysis-subheading', text: 'Your Current Car' }));

            if (currentUserCar && currentUserCar.stats) {
                const carNameParagraph = document.createElement('p');
                carNameParagraph.appendChild(Utils.createElement('strong', { text: currentUserCar.name }));
                carNameParagraph.append(` (ID: ${currentUserCar.id})`);
                fragment.appendChild(carNameParagraph);

                const statOrder = ['Top Speed', 'Acceleration', 'Handling', 'Braking', 'Dirt', 'Tarmac', 'Safety'];
                const statPairs = statOrder
                    .map(statName => currentUserCar.stats[statName] !== undefined ? { label: statName, value: currentUserCar.stats[statName] } : null)
                    .filter(Boolean);
                const statsParagraph = document.createElement('p');
                statsParagraph.appendChild(this.createInlineStatPairs(statPairs, 'car-stats-inline'));
                fragment.appendChild(statsParagraph);
            } else if (currentUserCar) {
                const fallbackParagraph = document.createElement('p');
                fallbackParagraph.appendChild(Utils.createElement('strong', { text: currentUserCar.name }));
                fallbackParagraph.append(` (ID: ${currentUserCar.id}) - `);
                fallbackParagraph.appendChild(Utils.createElement('i', { text: 'Stats could not be parsed.' }));
                fragment.appendChild(fallbackParagraph);
            } else {
                fragment.appendChild(this.createPanelMessage('info-msg', 'Could not identify your currently selected car.'));
            }

            fragment.appendChild(Utils.createElement('h4', { className: 'track-analysis-subheading', text: 'Track Records (Top 5)' }));
            if (trackRecords && trackRecords.length > 0) {
                fragment.appendChild(this.createStatsTable(
                    [
                        { text: '#', className: 'numeric' },
                        { text: 'Lap Time', className: 'numeric' },
                        { text: 'Car' },
                        { text: 'Driver' }
                    ],
                    trackRecords.slice(0, 5).map((record, index) => {
                        const isUserCar = currentUserCar && record.car_item_id === currentUserCar.id;
                        const driverLink = Utils.createElement('a', {
                            text: `${record.driver_name} [${record.driver_id}]`,
                            attrs: {
                                href: `/profiles.php?XID=${record.driver_id}`,
                                target: '_blank',
                                rel: 'noopener noreferrer'
                            }
                        });

                        return {
                            className: isUserCar ? 'user-car-highlight' : '',
                            cells: [
                                { text: String(index + 1), className: 'numeric' },
                                { text: `${record.lap_time.toFixed(2)}s`, className: 'numeric' },
                                { text: `${record.car_item_name}${isUserCar ? ' (Your Car)' : ''}` },
                                { node: driverLink }
                            ]
                        };
                    })
                ));

                fragment.appendChild(Utils.createElement('h4', { className: 'track-analysis-subheading', text: 'Top Performing Cars Analysis' }));
                if (topCarsData && topCarsData.length > 0) {
                    fragment.appendChild(this.createStatsTable(
                        [
                            { text: 'Car' },
                            { text: `Times in Top ${trackRecords.length}`, className: 'numeric' },
                            { text: 'Key Stats' }
                        ],
                        topCarsData.slice(0, 5).map(carData => {
                            const baseStats = State.carBaseStatsMap?.[carData.car_item_id];
                            const isUserCar = currentUserCar && carData.car_item_id === currentUserCar.id;
                            let statsNode;

                            if (baseStats) {
                                statsNode = this.createInlineStatPairs([
                                    { label: 'Spd', value: baseStats.top_speed },
                                    { label: 'Acc', value: baseStats.acceleration },
                                    { label: 'Hnd', value: baseStats.handling },
                                    { label: 'Brk', value: baseStats.braking },
                                    { label: 'Drt', value: baseStats.dirt }
                                ], 'car-stats-inline');
                            } else {
                                statsNode = Utils.createElement('i', { text: 'Base stats unavailable' });
                            }

                            return {
                                className: isUserCar ? 'user-car-highlight' : '',
                                cells: [
                                    { text: `${carData.car_item_name}${isUserCar ? ' (Your Car)' : ''}` },
                                    { text: String(carData.count), className: 'numeric' },
                                    { node: statsNode }
                                ]
                            };
                        })
                    ));
                } else {
                    fragment.appendChild(Utils.createElement('p', { text: 'Could not analyze top performing cars.' }));
                }
            } else if (trackRecords) {
                fragment.appendChild(this.createPanelMessage('info-msg', 'No records found for this track/class.'));
            } else {
                fragment.appendChild(this.createPanelMessage('error-msg', 'Track records could not be loaded.'));
            }

            return fragment;
        },
        parseCurrentUserCarStats() {
            const carDiv = document.querySelector('div.car-selected.left');
            if (!carDiv) return null;

            try {
                const nameEl = carDiv.querySelector('.model p:first-child');
                const imgEl = carDiv.querySelector('.model .img img.torn-item');
                const name = nameEl ? nameEl.textContent.trim() : 'Unknown Car';
                let id = null;

                if (imgEl && imgEl.src) {
                    const idMatch = imgEl.src.match(/\/items\/(\d+)\//);
                    if (idMatch) id = parseInt(idMatch[1], 10);
                }

                const stats = {};
                const statItems = carDiv.querySelectorAll('ul.properties-wrap li');
                statItems.forEach(li => {
                    const titleEl = li.querySelector('.title');
                    const progressBarEl = li.querySelector('.progressbar-wrap');
                    if (titleEl && progressBarEl && progressBarEl.title) {
                        const statName = titleEl.textContent.trim();
                        const valueMatch = progressBarEl.title.match(/^(\d+)\s*\(/);
                        if (valueMatch) {
                            stats[statName] = parseInt(valueMatch[1], 10);
                        }
                    }
                });

                if (Object.keys(stats).length === 0) {
                    return { name, id, stats: null };
                }

                return { name, id, stats };
            } catch (e) {
                return null;
            }
        },
        formatSignedNumber(value, decimals = 2) {
            if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return 'N/A';
            const sign = value > 0 ? '+' : '';
            return `${sign}${value.toFixed(decimals)}`;
        },
        normalizeHistoryRaceEntry(race, userId) {
            if (!race || !Array.isArray(race.results)) return null;
            const userResult = race.results.find(result => String(result.driver_id) === String(userId));
            if (!userResult) return null;

            const endTimestampSec = userResult.time_ended ?? race.schedule?.end ?? race.schedule?.start ?? null;
            const endTimestampMs = Number.isFinite(endTimestampSec) ? endTimestampSec * 1000 : Date.now();
            const position = Number.isFinite(userResult.position) ? userResult.position : null;
            const crashed = userResult.has_crashed === true;
            const raceTime = Number.isFinite(userResult.race_time) ? userResult.race_time : null;
            const bestLap = Number.isFinite(userResult.best_lap_time) ? userResult.best_lap_time : null;
            const participants = race.participants?.current ?? race.results.length ?? null;
            const skillGain = Number.isFinite(race.skill_gain) ? race.skill_gain : null;
            const trackName = State.trackNameMap?.[race.track_id] || `Track ${race.track_id ?? '?'}`;

            let resultLabel = 'Unknown';
            if (crashed) resultLabel = 'Crashed';
            else if (position !== null) resultLabel = `#${position}`;
            else if (race.status) resultLabel = race.status;

            return {
                raceId: race.id ?? null,
                trackId: race.track_id ?? null,
                trackName,
                title: race.title || '',
                status: race.status || '',
                timestamp: endTimestampMs,
                position,
                crashed,
                resultLabel,
                participants,
                skillGain,
                bestLap,
                raceTime,
                carName: userResult.car_item_name || 'Unknown Car',
                carClass: userResult.car_class || null
            };
        },
        createHistoryDeltaCards(raceEntries) {
            const cardsWrapper = Utils.createElement('div', { className: 'history-summary-cards' });
            const finishedEntries = raceEntries.filter(entry => !entry.crashed && Number.isFinite(entry.position));
            const wins = finishedEntries.filter(entry => entry.position === 1).length;
            const podiums = finishedEntries.filter(entry => entry.position <= 3).length;
            const crashCount = raceEntries.filter(entry => entry.crashed).length;
            const avgPosition = finishedEntries.length
                ? (finishedEntries.reduce((sum, entry) => sum + entry.position, 0) / finishedEntries.length)
                : null;
            const { recentWindow, previousWindow, hasPrevious } = this.getComparisonWindows(raceEntries, 20);
            const recentAgg = this.aggregateRaceWindow(recentWindow);
            const previousAgg = this.aggregateRaceWindow(previousWindow);
            const avgPosDelta = hasPrevious && Number.isFinite(recentAgg.avgPosition) && Number.isFinite(previousAgg.avgPosition)
                ? recentAgg.avgPosition - previousAgg.avgPosition
                : null;
            const skillGainValues = raceEntries
                .map(entry => entry.skillGain)
                .filter(value => Number.isFinite(value));
            const avgSkillGainShown = skillGainValues.length
                ? (skillGainValues.reduce((sum, value) => sum + value, 0) / skillGainValues.length)
                : null;

            const summaryItems = [
                {
                    label: 'Window',
                    value: `Last ${recentWindow.length} vs Prev ${previousWindow.length}`,
                    trendClass: ''
                },
                {
                    label: 'Recent Races',
                    value: String(raceEntries.length),
                    trendClass: ''
                },
                {
                    label: 'Wins / Podiums',
                    value: `${wins} / ${podiums}`,
                    trendClass: ''
                },
                {
                    label: 'Avg Pos / Crashes',
                    value: `${avgPosition !== null ? avgPosition.toFixed(2) : 'N/A'} / ${crashCount}`,
                    trendClass: ''
                },
                {
                    label: 'Avg Pos \u0394',
                    value: this.formatSignedNumber(avgPosDelta, 2),
                    trendClass: avgPosDelta < 0 ? 'positive' : (avgPosDelta > 0 ? 'negative' : '')
                },
                {
                    label: 'Avg Skill / Race',
                    value: this.formatSignedNumber(avgSkillGainShown, 4),
                    trendClass: avgSkillGainShown > 0 ? 'positive' : (avgSkillGainShown < 0 ? 'negative' : '')
                }
            ];

            summaryItems.forEach(item => {
                const card = Utils.createElement('div', { className: 'history-summary-card' });
                const label = Utils.createElement('div', { className: 'history-summary-label', text: item.label });
                const value = Utils.createElement('div', {
                    className: `history-summary-value${item.trendClass ? ` ${item.trendClass}` : ''}`,
                    text: item.value
                });
                card.append(label, value);
                cardsWrapper.appendChild(card);
            });

            return cardsWrapper;
        },
        createHistoryRaceTimeline(raceEntries) {
            const section = document.createDocumentFragment();
            section.appendChild(Utils.createElement('h3', { text: 'Race Timeline' }));

            if (raceEntries.length === 0) {
                section.appendChild(this.createPanelMessage('no-history-msg', 'No race events loaded yet.'));
                return section;
            }

            const timeline = Utils.createElement('ul', { className: 'history-race-timeline' });
            raceEntries.slice(0, 15).forEach(entry => {
                const liClass = `history-race-item ${entry.crashed ? 'crash' : (entry.position === 1 ? 'win' : 'normal')}`;
                const item = Utils.createElement('li', { className: liClass });
                const mainLine = Utils.createElement('div', { className: 'history-race-main' });
                mainLine.append(
                    Utils.createElement('span', { className: 'history-race-track', text: entry.trackName }),
                    Utils.createElement('span', { className: 'history-race-result', text: entry.resultLabel }),
                    Utils.createElement('span', {
                        className: `history-race-skill ${entry.skillGain > 0 ? 'positive' : (entry.skillGain < 0 ? 'negative' : '')}`,
                        text: `Skill ${this.formatSignedNumber(entry.skillGain, 4)}`
                    })
                );
                const detailLine = Utils.createElement('div', {
                    className: 'history-race-meta',
                    text: `${Utils.formatDate(entry.timestamp, true)} • ${entry.carName} • Time ${entry.raceTime !== null ? Utils.formatTime(entry.raceTime, true) : 'N/A'}`
                });
                item.append(mainLine, detailLine);
                timeline.appendChild(item);
            });

            section.appendChild(timeline);
            return section;
        },
        createSortableHistoryRacesTable(raceEntries) {
            const section = document.createDocumentFragment();
            section.appendChild(Utils.createElement('h3', { text: `Recent Races (${raceEntries.length})` }));

            if (raceEntries.length === 0) {
                section.appendChild(this.createPanelMessage('no-history-msg', 'No races available for table view.'));
                return section;
            }

            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const tbody = document.createElement('tbody');

            const sortState = { key: 'timestamp', dir: 'desc' };
            const columns = [
                { key: 'timestamp', label: 'Date', className: '' },
                { key: 'trackName', label: 'Track', className: '' },
                { key: 'position', label: 'Pos', className: 'numeric' },
                { key: 'skillGain', label: 'Skill \u0394', className: 'numeric' },
                { key: 'bestLap', label: 'Best Lap', className: 'numeric' },
                { key: 'raceTime', label: 'Race Time', className: 'numeric' },
                { key: 'carName', label: 'Car', className: '' }
            ];

            const getSortValue = (entry, key) => {
                if (key === 'position') return entry.position ?? Number.POSITIVE_INFINITY;
                if (key === 'timestamp') return entry.timestamp ?? 0;
                if (key === 'skillGain') return entry.skillGain ?? Number.NEGATIVE_INFINITY;
                if (key === 'bestLap') return entry.bestLap ?? Number.POSITIVE_INFINITY;
                if (key === 'raceTime') return entry.raceTime ?? Number.POSITIVE_INFINITY;
                return entry[key] ?? '';
            };
            const compare = (left, right) => {
                const leftValue = getSortValue(left, sortState.key);
                const rightValue = getSortValue(right, sortState.key);
                let result = 0;
                if (typeof leftValue === 'number' && typeof rightValue === 'number') result = leftValue - rightValue;
                else result = String(leftValue).localeCompare(String(rightValue));
                return sortState.dir === 'asc' ? result : -result;
            };
            const formatPosition = (entry) => {
                if (entry.crashed) return 'CR';
                if (Number.isFinite(entry.position)) return String(entry.position);
                return '-';
            };

            const renderRows = () => {
                const sorted = [...raceEntries].sort(compare);
                const rowNodes = sorted.map(entry => {
                    const row = document.createElement('tr');
                    const skillClass = entry.skillGain > 0 ? 'change-positive' : (entry.skillGain < 0 ? 'change-negative' : '');

                    row.append(
                        Utils.createElement('td', { text: Utils.formatDate(entry.timestamp, true) }),
                        Utils.createElement('td', { text: entry.trackName }),
                        Utils.createElement('td', { className: 'numeric', text: formatPosition(entry) }),
                        Utils.createElement('td', { className: `numeric ${skillClass}`.trim(), text: this.formatSignedNumber(entry.skillGain, 4) }),
                        Utils.createElement('td', { className: 'numeric', text: entry.bestLap !== null ? Utils.formatTime(entry.bestLap, true) : '-' }),
                        Utils.createElement('td', { className: 'numeric', text: entry.raceTime !== null ? Utils.formatTime(entry.raceTime, true) : '-' }),
                        Utils.createElement('td', { text: entry.carName })
                    );
                    return row;
                });
                tbody.replaceChildren(...rowNodes);
            };

            columns.forEach(column => {
                const th = Utils.createElement('th', { className: column.className });
                const button = Utils.createElement('button', {
                    className: 'history-sort-btn',
                    text: column.label,
                    attrs: { type: 'button' }
                });
                button.addEventListener('click', () => {
                    if (sortState.key === column.key) {
                        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortState.key = column.key;
                        sortState.dir = column.key === 'timestamp' ? 'desc' : 'asc';
                    }
                    renderRows();
                });
                th.appendChild(button);
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.append(thead, tbody);

            renderRows();
            section.appendChild(table);
            return section;
        },
        async createHistoryPanel() {
            if (!Config.get('historyEnabled')) return;
            if (State.historyPanelInstance) State.historyPanelInstance.remove();

            const popup = document.createElement('div');
            popup.className = 'history-panel';
            const content = document.createElement('div');
            content.className = 'history-panel-content';
            const historyContentDiv = document.createElement('div');
            historyContentDiv.className = 'history-content';
            historyContentDiv.replaceChildren(this.createPanelMessage('loading-msg', 'Loading history panel...', 'div'));

            const historyTitle = Utils.createElement('div', { className: 'history-title' });
            historyTitle.append('Your Racing Stats History ');
            historyTitle.appendChild(Utils.createElement('button', { className: 'history-close', text: '\u00D7' }));
            content.append(historyTitle, historyContentDiv);

            const closePanel = () => {
                popup.remove();
                State.historyPanelInstance = null;
            };
            content.querySelector('.history-close').addEventListener('click', closePanel);
            popup.addEventListener('click', e => { if (e.target === popup) closePanel(); });

            popup.appendChild(content);
            document.body.appendChild(popup);
            State.historyPanelInstance = popup;

            const historyFragment = document.createDocumentFragment();
            let raceEntries = [];

            if (Utils.isApiKeyAvailable() && State.userId) {
                const apiKey = Config.get('apiKey');
                try {
                    if (!State.trackNameMap) {
                        State.trackNameMap = await APIManager.fetchTrackData(apiKey);
                    }
                } catch (e) {
                    historyFragment.appendChild(this.createPanelMessage('info-msg', `Track names unavailable: ${e.message}`));
                }

                try {
                    const raceLimit = Math.max(20, Math.min(500, Number(Config.get('historicalRaceLimit')) || 100));
                    const races = await APIManager.fetchHistoricalRaceData(apiKey, State.userId, raceLimit);
                    raceEntries = races
                        .map(race => this.normalizeHistoryRaceEntry(race, State.userId))
                        .filter(Boolean);
                } catch (e) {
                    historyFragment.appendChild(this.createPanelMessage('error-msg', `Could not load race history: ${e.message}`));
                }
            } else {
                historyFragment.appendChild(this.createPanelMessage('info-msg', 'Configure an API key to load race timeline and recent-races table.'));
            }

            historyFragment.appendChild(this.createHistoryDeltaCards(raceEntries));
            historyFragment.appendChild(this.createHistoryRaceTimeline(raceEntries));
            historyFragment.appendChild(this.createSortableHistoryRacesTable(raceEntries));

            if (State.historyPanelInstance !== popup || !document.body.contains(popup)) {
                return;
            }
            historyContentDiv.replaceChildren(historyFragment);
        },
        createInfoPanel() {
            if (State.infoPanelInstance) State.infoPanelInstance.remove();

            const popup = document.createElement('div');
            popup.className = 'info-panel';
            const content = document.createElement('div');
            content.className = 'info-panel-content';
            const notesHTML = ScriptInfo.notes.map(note => `<li>${note}</li>`).join('');

            content.innerHTML = `
                <div class="info-title">Script Information <button class="info-close">&times;</button></div>
                <div class="info-content">
                    <h3>Torn Racing Telemetry</h3>
                    <p><strong>Version:</strong> ${ScriptInfo.version}</p>
                    <p><strong>Author:</strong> ${ScriptInfo.author} [<a href="${ScriptInfo.contactUrl()}" target="_blank" rel="noopener noreferrer">${ScriptInfo.contactId}</a>]</p>
                    <p><strong>Description:</strong> ${ScriptInfo.description}</p>
                    <h3>Contact & Support</h3>
                    <p>For suggestions, bug reports, or questions, please contact <a href="${ScriptInfo.contactUrl()}" target="_blank" rel="noopener noreferrer">${ScriptInfo.author} [${ScriptInfo.contactId}]</a> via Torn mail.</p>
                    <h3>Important Notes</h3>
                    <ul>${notesHTML}</ul>
                </div>`;

            const closePanel = () => {
                popup.remove();
                State.infoPanelInstance = null;
            };

            content.querySelector('.info-close').addEventListener('click', closePanel);
            popup.addEventListener('click', e => { if (e.target === popup) closePanel(); });
            popup.appendChild(content);
            document.body.appendChild(popup);
            State.infoPanelInstance = popup;
        },
        createDownloadPopup() {
            if (State.downloadPopupInstance) State.downloadPopupInstance.remove();

            const popup = document.createElement('div');
            popup.className = 'download-popup';
            const content = document.createElement('div');
            content.className = 'download-popup-content';

            content.innerHTML = `
                <div class="download-title">Export Race Results <button class="download-close">&times;</button></div>
                <div class="download-content">
                    <div class="download-options">
                        <div class="format-group">
                            <label for="downloadFormat">Format:</label>
                            <select id="downloadFormat">
                                <option value="html">HTML Table</option>
                                <option value="md">Markdown Table</option>
                                <option value="csv">CSV (Comma Separated)</option>
                                <option value="txt">Plain Text</option>
                                <option value="json">JSON Data (Detailed)</option>
                            </select>
                        </div>
                        <div class="action-group">
                            <button id="downloadFileBtn" class="primary">\u{1F4BE} Download File</button>
                            <button id="copyClipboardBtn">\u{1F4CB} Copy to Clipboard</button>
                        </div>
                    </div>
                </div>`;

            const closePopup = () => {
                popup.remove();
                State.downloadPopupInstance = null;
            };

            content.querySelector('.download-close').addEventListener('click', closePopup);
            popup.addEventListener('click', e => { if (e.target === popup) closePopup(); });

            const formatSelect = content.querySelector('#downloadFormat');
            const downloadBtn = content.querySelector('#downloadFileBtn');
            const copyBtn = content.querySelector('#copyClipboardBtn');

            const performAction = async actionType => {
                const format = formatSelect.value;
                let dataString;
                let fileExt;
                let mimeType;

                try {
                    switch (format) {
                        case 'html':
                            dataString = DataExporter.formatAsHTML();
                            fileExt = 'html';
                            mimeType = 'text/html';
                            break;
                        case 'md':
                            dataString = DataExporter.formatAsMarkdown();
                            fileExt = 'md';
                            mimeType = 'text/markdown';
                            break;
                        case 'csv':
                            dataString = DataExporter.formatAsCSV();
                            fileExt = 'csv';
                            mimeType = 'text/csv';
                            break;
                        case 'txt':
                            dataString = DataExporter.formatAsPlainText();
                            fileExt = 'txt';
                            mimeType = 'text/plain';
                            break;
                        case 'json':
                        default:
                            dataString = await DataExporter.formatAsJSON();
                            fileExt = 'json';
                            mimeType = 'application/json';
                            break;
                    }

                    if (actionType === 'download') {
                        DataExporter.downloadData(dataString, fileExt, mimeType);
                        Utils.showNotification('File download initiated.', 'success');
                    } else if (actionType === 'copy') {
                        DataExporter.copyToClipboard(dataString);
                        Utils.showNotification('Copied to clipboard!', 'success');
                    }
                    closePopup();
                } catch (e) {
                    Utils.showNotification(`Error preparing data: ${e.message}`, 'error');
                }
            };

            downloadBtn.addEventListener('click', () => performAction('download'));
            copyBtn.addEventListener('click', () => performAction('copy'));

            popup.appendChild(content);
            document.body.appendChild(popup);
            State.downloadPopupInstance = popup;
        },
        updateControlButtonsVisibility() {
            if (!State.controlsContainer) return;

            const historyBtn = State.controlsContainer.querySelector('.telemetry-history-button');
            const statsBtn = State.controlsContainer.querySelector('.telemetry-stats-button');
            const downloadBtn = State.controlsContainer.querySelector('.telemetry-download-button');

            if (historyBtn) historyBtn.style.display = Config.get('historyEnabled') ? 'inline-block' : 'none';
            if (statsBtn) statsBtn.style.display = Config.get('statsPanelEnabled') ? 'inline-block' : 'none';
            if (downloadBtn) downloadBtn.style.display = State.raceFinished ? 'inline-block' : 'none';
        },
        initializeControls() {
            if (!State.controlsContainer) return;
            State.controlsContainer.innerHTML = '';

            const infoButton = document.createElement('button');
            infoButton.className = 'telemetry-info-button';
            infoButton.textContent = '\u2139\uFE0F Info';
            infoButton.title = 'View Script Information';
            infoButton.addEventListener('click', () => { this.createInfoPanel(); });
            State.controlsContainer.appendChild(infoButton);

            const historyButton = document.createElement('button');
            historyButton.className = 'telemetry-history-button';
            historyButton.textContent = '\u{1F4DC} History';
            historyButton.title = 'View Your Racing Stats History';
            historyButton.style.display = 'none';
            historyButton.addEventListener('click', () => { this.createHistoryPanel(); });
            State.controlsContainer.appendChild(historyButton);

            const statsButton = document.createElement('button');
            statsButton.className = 'telemetry-stats-button';
            statsButton.textContent = '\u{1F4CA} Stats';
            statsButton.title = 'Open Advanced Race Statistics';
            statsButton.style.display = 'none';
            statsButton.addEventListener('click', () => {
                RaceManager.updateTrackAndClassInfo()
                    .then(() => { this.createAdvancedStatsPanel(); })
                    .catch(() => { Utils.showNotification('Error getting latest track/class info.', 'error'); });
            });
            State.controlsContainer.appendChild(statsButton);

            const downloadButton = document.createElement('button');
            downloadButton.className = 'telemetry-download-button';
            downloadButton.textContent = '\u{1F4BE} Export';
            downloadButton.title = 'Export Race Results';
            downloadButton.style.display = 'none';
            downloadButton.addEventListener('click', () => { this.createDownloadPopup(); });
            State.controlsContainer.appendChild(downloadButton);

            const settingsButton = document.createElement('button');
            settingsButton.className = 'telemetry-settings-button';
            settingsButton.textContent = '\u2699 Settings';
            settingsButton.title = 'Open Telemetry & UI Settings';
            settingsButton.addEventListener('click', () => { this.createSettingsPopup(); });
            State.controlsContainer.appendChild(settingsButton);

            this.updateControlButtonsVisibility();
            document.body.classList.toggle('telemetry-hidden', !Config.get('telemetryVisible'));
        }
    };

    const APIManager = {
        isFetching: new Set(),
        createApiError(responseLike, errorPayload = null) {
            let errorMessage = responseLike?.status
                ? `API Error (${responseLike.status}): ${responseLike.statusText || 'Request failed'}`
                : 'API request failed.';

            const payload = errorPayload?.error && typeof errorPayload.error === 'object'
                ? errorPayload.error
                : errorPayload;

            if (payload?.error) {
                errorMessage = `API Error: ${payload.error}${payload.code ? ` (Code ${payload.code})` : ''}`;
            }

            const error = new Error(errorMessage);
            error.statusCode = responseLike?.status ?? null;
            error.apiCode = payload?.code ?? null;
            return error;
        },
        async parseJsonResponse(response) {
            let data = null;

            try {
                data = await response.json();
            } catch (e) { }

            if (!response.ok) {
                throw this.createApiError(response, data);
            }
            if (data?.error) {
                throw this.createApiError(response, data.error);
            }

            return data ?? {};
        },
        shouldRetryRequest(error, attempt, retries) {
            if (attempt >= retries - 1) {
                return false;
            }

            return error?.statusCode === 429 ||
                error?.apiCode === 2 ||
                error?.message?.includes('Too many requests') ||
                error?.message?.includes('Code 2');
        },
        getRetryDelay(baseDelay, attempt) {
            const backoffDelay = baseDelay * (2 ** attempt);
            const jitter = Math.round(Math.random() * Math.max(250, baseDelay * 0.25));
            return backoffDelay + jitter;
        },
        normalizeApiUrl(urlLike, base = 'https://api.torn.com') {
            if (!urlLike || typeof urlLike !== 'string') return null;
            try {
                return new URL(urlLike, base).toString();
            } catch (e) {
                return null;
            }
        },
        async fetchJson(url, options = {}) {
            const response = await fetch(url, options);
            return this.parseJsonResponse(response);
        },
        async fetchWithAuthHeader(url, apiKey, options = {}, retries = 3, baseDelay = 1000) {
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    return await this.fetchJson(url, {
                        ...options,
                        headers: {
                            'Accept': 'application/json',
                            'Authorization': `ApiKey ${apiKey}`,
                            ...(options.headers || {})
                        }
                    });
                } catch (error) {
                    if (!this.shouldRetryRequest(error, attempt, retries)) {
                        throw error;
                    }

                    await Utils.sleep(this.getRetryDelay(baseDelay, attempt));
                }
            }

            throw new Error('Max retries reached');
        },
        async fetchAndDisplayRacingStats(driverItem, userId) {
            const detailsDiv = driverItem.querySelector('.driver-details');
            const statsContainer = detailsDiv?.querySelector('.api-stats-container');
            if (!statsContainer || !userId || this.isFetching.has(userId)) return;
            const hideUnavailableApiCards = () => {
                statsContainer.querySelectorAll('.driver-api-item').forEach(card => {
                    const value = card.querySelector('.driver-api-value')?.textContent.trim() || '';
                    card.style.display = value.includes('N/A') || value === '-' ? 'none' : '';
                });
            };

            if (!Utils.isApiKeyAvailable()) {
                statsContainer.classList.add('no-key');
                statsContainer.querySelector('.api-stat-error-msg').textContent = 'API key not configured in settings.';
                statsContainer.querySelectorAll('.api-stat').forEach(span => span.textContent = 'N/A');
                hideUnavailableApiCards();
                driverItem.dataset.statsLoaded = 'true';
                return;
            }

            const apiKey = Config.get('apiKey');
            this.isFetching.add(userId);
            statsContainer.classList.remove('error', 'loaded', 'no-key');
            statsContainer.classList.add('loading');
            statsContainer.querySelector('.api-stat-error-msg').textContent = '';
            statsContainer.querySelectorAll('.api-stat').forEach(span => span.textContent = '...');
            const apiUrl = `https://api.torn.com/v2/user?selections=personalstats&id=${userId}&cat=racing&key=${apiKey}`;
            try {
                const data = await this.fetchJson(apiUrl, { headers: { 'Accept': 'application/json' } });
                const racingStats = data?.personalstats?.racing;

                if (racingStats && typeof racingStats === 'object') {
                    const skill = racingStats.skill?.toLocaleString() ?? 'N/A';
                    statsContainer.querySelector('.stat-skill').textContent = skill;
                    statsContainer.querySelector('.stat-points').textContent = racingStats.points?.toLocaleString() ?? 'N/A';
                    const racesEntered = racingStats.races?.entered;
                    const racesWon = racingStats.races?.won;
                    statsContainer.querySelector('.stat-races-entered').textContent = racesEntered?.toLocaleString() ?? 'N/A';
                    statsContainer.querySelector('.stat-races-won').textContent = racesWon?.toLocaleString() ?? 'N/A';
                    const winRate = (racesEntered && racesWon > 0) ? ((racesWon / racesEntered) * 100).toFixed(1) + '%' : (racesEntered > 0 ? '0.0%' : 'N/A');
                    statsContainer.querySelector('.stat-win-rate').textContent = winRate;
                    statsContainer.classList.add('loaded');
                    hideUnavailableApiCards();
                    driverItem.dataset.statsLoaded = 'true';
                } else {
                    statsContainer.classList.add('error');
                    statsContainer.querySelector('.api-stat-error-msg').textContent = 'No racing stats found (or permission denied).';
                    statsContainer.querySelectorAll('.api-stat').forEach(span => span.textContent = 'N/A');
                    hideUnavailableApiCards();
                    driverItem.dataset.statsLoaded = 'true';
                }
            } catch (error) {
                statsContainer.classList.add('error');
                statsContainer.querySelector('.api-stat-error-msg').textContent = `Error: ${error.message}`;
                statsContainer.querySelectorAll('.api-stat').forEach(span => span.textContent = '-');
                hideUnavailableApiCards();
                delete driverItem.dataset.statsLoaded;
                Utils.showNotification(error.message, 'error');
            } finally {
                statsContainer.classList.remove('loading');
                this.isFetching.delete(userId);
            }
        },
        async fetchTrackData(apiKey) {
            const cached = GM_getValue('tornTrackCache', null);
            if (cached && Date.now() - cached.timestamp < 86400000) return cached.data;
            const data = await this.fetchWithAuthHeader('https://api.torn.com/v2/racing/tracks', apiKey);
            const trackMap = data.tracks ? data.tracks.reduce((map, t) => { map[t.id] = t.title; return map; }, {}) : {};
            GM_setValue('tornTrackCache', { data: trackMap, timestamp: Date.now() });
            return trackMap;
        },
        async fetchCarBaseStats(apiKey) {
            const cached = GM_getValue('tornCarCache', null);
            if (cached && Date.now() - cached.timestamp < 86400000) return cached.data;
            const data = await this.fetchWithAuthHeader('https://api.torn.com/v2/racing/cars', apiKey);
            const carMap = data.cars ? data.cars.reduce((map, c) => { map[c.car_item_id] = c; return map; }, {}) : {};
            GM_setValue('tornCarCache', { data: carMap, timestamp: Date.now() });
            return carMap;
        },
        async fetchHistoricalRaceData(apiKey, userId, limit) {
            if (!apiKey) throw new Error("API Key required.");
            if (!userId) throw new Error("User ID required.");

            const boundedLimit = Math.max(10, Math.min(5000, Number(limit) || 100));
            const pageSize = Math.min(100, boundedLimit);
            let nextUrl = `https://api.torn.com/v2/user/races?cat=official&sort=DESC&limit=${pageSize}`;
            const allRaces = [];
            const visitedUrls = new Set();

            while (nextUrl && allRaces.length < boundedLimit) {
                if (visitedUrls.has(nextUrl)) {
                    break;
                }
                visitedUrls.add(nextUrl);

                const data = await this.fetchWithAuthHeader(nextUrl, apiKey);
                const pageRaces = Array.isArray(data?.races) ? data.races : [];
                if (pageRaces.length === 0) {
                    break;
                }

                allRaces.push(...pageRaces);
                if (allRaces.length >= boundedLimit) {
                    break;
                }

                const metadataLinks = data?._metadata?.links || {};
                nextUrl = this.normalizeApiUrl(metadataLinks.next) || this.normalizeApiUrl(metadataLinks.prev);
            }

            return allRaces.slice(0, boundedLimit);
        },
        async fetchUserRacingRecords(apiKey) {
            if (!apiKey) throw new Error("API Key required.");
            const data = await this.fetchWithAuthHeader('https://api.torn.com/v2/user/racingrecords', apiKey);
            return Array.isArray(data?.racingrecords) ? data.racingrecords : [];
        },
        async fetchTrackRecords(apiKey, trackId, raceClass) { if (!trackId) throw new Error("Track ID required."); if (!raceClass) throw new Error("Race Class required."); const url = `https://api.torn.com/v2/racing/${trackId}/records?cat=${raceClass}`; const data = await this.fetchWithAuthHeader(url, apiKey); return data.records || []; }
    };

    APIManager.raceData = {
        cacheStorageKey: 'racingCustomUITelemetryLugburzSkillCache_v1',
        cacheMaxAgeMs: 24 * 60 * 60 * 1000,
        installed: false,
        latestRacePayload: null,
        skillCache: null,
        skillGainCache: new Map(),
        skillGainRequests: new Map(),
        raceResultCache: new Map(),
        raceResultRequests: new Map(),

        install() {
            if (this.installed) return;
            this.installed = true;
            const $ = window.jQuery || window.$;
            if (!$?.fn?.jquery) return;

            $(document).on('ajaxComplete.rttRaceData', (_event, xhr) => {
                try {
                    const payload = JSON.parse(xhr.responseText);
                    if (payload?.raceData?.cars && payload?.raceData?.carInfo && payload?.raceData?.trackData?.intervals) {
                        this.latestRacePayload = payload;
                    }
                } catch (e) { }
            });
        },

        getSkillGainDisplay(raceId) {
            const gain = this.skillGainCache.get(String(raceId));
            if (!Number.isFinite(gain)) return 'N/A';
            return `${gain > 0 ? '+' : ''}${gain.toFixed(4)}`;
        },

        async loadSkillGain(raceId) {
            const key = String(raceId || '');
            if (!key || !Utils.isApiKeyAvailable() || !State.userId) return null;
            if (this.skillGainCache.has(key)) return this.skillGainCache.get(key);
            if (this.skillGainRequests.has(key)) return this.skillGainRequests.get(key);

            const request = (async () => {
                try {
                    const races = await APIManager.fetchHistoricalRaceData(Config.get('apiKey'), State.userId, 10);
                    const race = races.find(entry => String(entry.id) === key);
                    const gain = Number(race?.skill_gain);
                    if (Number.isFinite(gain)) {
                        this.skillGainCache.set(key, gain);
                        return gain;
                    }
                    return null;
                } finally {
                    this.skillGainRequests.delete(key);
                }
            })();
            this.skillGainRequests.set(key, request);
            return request;
        },

        loadCache() {
            if (this.skillCache) return this.skillCache;
            try {
                const saved = GM_getValue(this.cacheStorageKey, '{}');
                this.skillCache = typeof saved === 'string' ? JSON.parse(saved) : saved;
            } catch (e) {
                this.skillCache = {};
            }
            return this.skillCache;
        },

        getCachedSkill(userId) {
            const entry = this.loadCache()?.[userId];
            return entry && Date.now() - entry.timestamp < this.cacheMaxAgeMs && Number.isFinite(entry.value) ? entry.value : null;
        },

        saveSkill(userId, value) {
            const cache = this.loadCache();
            cache[userId] = { value, timestamp: Date.now() };
            GM_setValue(this.cacheStorageKey, JSON.stringify(cache));
        },

        async getCompletedRaceData(drivers) {
            if (!drivers?.length) throw new Error('No completed race data is available.');
            const raceId = State.currentRaceId;
            if (!raceId) throw new Error('The race ID is unavailable.');

            let results = this.buildResultsFromLeaderboard(drivers);
            let apiResultsLoaded = false;
            if (Utils.isApiKeyAvailable()) {
                try {
                    const apiResults = await this.loadApiRaceResults(raceId);
                    if (apiResults.size) {
                        this.mergeApiRaceResults(results, apiResults);
                        apiResultsLoaded = true;
                    }
                } catch (error) {
                    console.warn('Telemetry Script: Could not load detailed race results:', error);
                }
            }
            if (!apiResultsLoaded) {
                try {
                    const payloadResults = this.buildResults(await this.waitForRacePayload(raceId, 4));
                    if (payloadResults.size) results = payloadResults;
                } catch (payloadError) { }
            }
            if (!results.size) throw new Error('Completed-race data was not available.');

            const driverIds = drivers.map(driver => driver.userId).filter(Boolean);
            const skills = Utils.isApiKeyAvailable() ? await this.loadSkills(driverIds) : new Map();
            return { results, skills };
        },

        async loadApiRaceResults(raceId) {
            const key = String(raceId || '');
            if (!key || !Utils.isApiKeyAvailable()) return new Map();
            if (this.raceResultCache.has(key)) return this.raceResultCache.get(key);
            if (this.raceResultRequests.has(key)) return this.raceResultRequests.get(key);

            const request = (async () => {
                try {
                    const data = await APIManager.fetchWithAuthHeader(`https://api.torn.com/v2/racing/${encodeURIComponent(key)}/race`, Config.get('apiKey'));
                    const rows = Array.isArray(data?.race?.results) ? data.race.results : (Array.isArray(data?.results) ? data.results : []);
                    const results = new Map(rows.map(row => [String(row.driver_id), row]));
                    this.raceResultCache.set(key, results);
                    return results;
                } finally {
                    this.raceResultRequests.delete(key);
                }
            })();
            this.raceResultRequests.set(key, request);
            return request;
        },

        mergeApiRaceResults(results, apiResults) {
            apiResults.forEach((apiResult, userId) => {
                const existing = results.get(userId) || {};
                const crashed = apiResult.has_crashed === true || existing.crashed === true;
                const raceTime = Number(apiResult.race_time);
                const bestLap = Number(apiResult.best_lap_time);
                results.set(userId, {
                    ...existing,
                    userId,
                    position: Number.isFinite(apiResult.position) ? apiResult.position : existing.position,
                    crashed,
                    raceTime: Number.isFinite(raceTime) ? raceTime : existing.raceTime,
                    bestLap: !crashed && Number.isFinite(bestLap) ? bestLap : existing.bestLap ?? null,
                    displayTime: existing.displayTime || (Number.isFinite(raceTime) ? Utils.formatTime(raceTime, true) : null)
                });
            });
        },

        async waitForRacePayload(raceId, attempts = 16) {
            for (let attempt = 0; attempt < attempts; attempt++) {
                if (this.latestRacePayload && String(this.latestRacePayload.raceID) === String(raceId)) return this.latestRacePayload;
                await Utils.sleep(500);
            }
            throw new Error('Race payload was not captured.');
        },

        buildResultsFromLeaderboard(drivers) {
            const results = new Map();
            drivers.forEach((driver, index) => {
                const originalRow = document.getElementById(driver.originalId);
                const status = originalRow?.querySelector('.status-wrap > div');
                const crashed = driver.statusClass === 'crashed' || status?.classList.contains('crash') || status?.classList.contains('crashed');
                const time = originalRow?.querySelector('.time')?.textContent.trim() || null;
                if (!crashed && !time) return;
                results.set(String(driver.userId), { userId: String(driver.userId), position: index + 1, crashed, displayTime: time, bestLap: null });
            });
            return results;
        },

        buildResults(payload) {
            const intervalsPerLap = payload.raceData.trackData.intervals.length;
            const results = [];
            const crashes = [];
            Object.entries(payload.raceData.cars).forEach(([playerName, encodedIntervals]) => {
                const userId = String(payload.raceData.carInfo[playerName]?.userID || '');
                if (!userId) return;
                const intervals = this.decodeIntervals(encodedIntervals);
                if (intervals.length / intervalsPerLap !== Number(payload.laps)) {
                    crashes.push({ userId, crashed: true });
                    return;
                }
                let raceTime = 0;
                let bestLap = Infinity;
                for (let lap = 0; lap < Number(payload.laps); lap++) {
                    const lapTime = intervals.slice(lap * intervalsPerLap, (lap + 1) * intervalsPerLap).reduce((total, value) => total + value, 0);
                    raceTime += lapTime;
                    bestLap = Math.min(bestLap, lapTime);
                }
                results.push({ userId, raceTime, bestLap, crashed: false });
            });
            results.sort((left, right) => left.raceTime - right.raceTime);
            const byUserId = new Map();
            results.forEach((result, index) => byUserId.set(result.userId, { ...result, position: index + 1 }));
            crashes.forEach((result, index) => byUserId.set(result.userId, { ...result, position: results.length + index + 1 }));
            return byUserId;
        },

        decodeIntervals(encoded) {
            try { return atob(encoded).split(',').map(Number).filter(Number.isFinite); } catch (e) { return []; }
        },

        async loadSkills(userIds) {
            const skills = new Map();
            const missingIds = [];
            userIds.forEach(userId => {
                const cached = this.getCachedSkill(userId);
                if (cached === null) missingIds.push(userId);
                else skills.set(userId, cached);
            });
            if (missingIds.length) Utils.showNotification(`Loading racing skill for ${missingIds.length} racer${missingIds.length === 1 ? '' : 's'}…`);
            for (let index = 0; index < missingIds.length; index++) {
                const userId = missingIds[index];
                const skill = await this.fetchSkill(userId);
                if (Number.isFinite(skill)) {
                    skills.set(userId, skill);
                    this.saveSkill(userId, skill);
                }
                if (index < missingIds.length - 1) await Utils.sleep(index < 19 ? 250 : 1000);
            }
            return skills;
        },

        async fetchSkill(userId) {
            const apiKey = Config.get('apiKey');
            const url = `https://api.torn.com/v2/user?selections=personalstats&id=${encodeURIComponent(userId)}&cat=racing&key=${encodeURIComponent(apiKey)}`;
            const data = await APIManager.fetchJson(url, { headers: { Accept: 'application/json' } });
            const value = data?.personalstats?.racing?.skill ?? data?.personalstats?.racingskill;
            const skill = Number(value);
            return Number.isFinite(skill) ? skill : null;
        },

    };

    const StatsCalculator = {
        processRaceData(races, userId) {
            if (!races || races.length === 0 || !userId) {
                return {
                    overall: { races: 0, wins: 0, podiums: 0, crashes: 0, positionSum: 0, winRate: 0, podiumRate: 0, crashRate: 0, avgPosition: 0 },
                    trackStats: {},
                    carStats: {},
                    totalRaces: 0,
                    firstRaceTime: null,
                    lastRaceTime: null
                };
            }
            const overall = { races: 0, wins: 0, podiums: 0, crashes: 0, positionSum: 0 };
            const trackStats = {};
            const carStats = {};
            let firstRaceTime = Infinity;
            let lastRaceTime = 0;
            races.forEach(race => {
                if (race.status !== 'finished' || !race.results) return;
                const userResult = race.results.find(r => r.driver_id == userId);
                if (!userResult) return;
                overall.races++;
                const raceTime = race.schedule?.end || 0;
                if (raceTime > 0) {
                    firstRaceTime = Math.min(firstRaceTime, raceTime * 1000);
                    lastRaceTime = Math.max(lastRaceTime, raceTime * 1000);
                }
                const trackId = race.track_id;
                const carName = userResult.car_item_name || 'Unknown Car';
                const trackName = State.trackNameMap?.[trackId] || `Track ${trackId}`;
                if (!trackStats[trackId]) trackStats[trackId] = { name: trackName, races: 0, wins: 0, podiums: 0, crashes: 0, positionSum: 0, bestLap: Infinity };
                if (!carStats[carName]) carStats[carName] = { name: carName, races: 0, wins: 0, podiums: 0, crashes: 0, positionSum: 0 };
                trackStats[trackId].races++;
                carStats[carName].races++;
                if (userResult.has_crashed) {
                    overall.crashes++;
                    trackStats[trackId].crashes++;
                    carStats[carName].crashes++;
                } else {
                    const position = userResult.position;
                    overall.positionSum += position;
                    trackStats[trackId].positionSum += position;
                    carStats[carName].positionSum += position;
                    if (position === 1) {
                        overall.wins++;
                        trackStats[trackId].wins++;
                        carStats[carName].wins++;
                    }
                    if (position <= 3) {
                        overall.podiums++;
                        trackStats[trackId].podiums++;
                        carStats[carName].podiums++;
                    }
                    if (userResult.best_lap_time && userResult.best_lap_time < trackStats[trackId].bestLap) {
                        trackStats[trackId].bestLap = userResult.best_lap_time;
                    }
                }
            });
            const calcRates = (stats) => {
                const finishedRaces = stats.races - stats.crashes;
                stats.winRate = finishedRaces > 0 ? (stats.wins / finishedRaces) * 100 : 0;
                stats.podiumRate = finishedRaces > 0 ? (stats.podiums / finishedRaces) * 100 : 0;
                stats.crashRate = stats.races > 0 ? (stats.crashes / stats.races) * 100 : 0;
                stats.avgPosition = finishedRaces > 0 ? (stats.positionSum / finishedRaces) : 0;
                return stats;
            };
            calcRates(overall);
            Object.values(trackStats).forEach(calcRates);
            Object.values(carStats).forEach(calcRates);
            return { overall, trackStats, carStats, totalRaces: overall.races, firstRaceTime: firstRaceTime === Infinity ? null : firstRaceTime, lastRaceTime: lastRaceTime === 0 ? null : lastRaceTime };
        },
        processTrackRecords(records) { if (!records || records.length === 0) return []; const carCounts = {}; records.forEach(rec => { if (!carCounts[rec.car_item_id]) { carCounts[rec.car_item_id] = { car_item_id: rec.car_item_id, car_item_name: rec.car_item_name, count: 0 }; } carCounts[rec.car_item_id].count++; }); return Object.values(carCounts).sort((a, b) => b.count - a.count); }
    };

    const DataExporter = {
        getFinalData() {
            const raceData = {
                 raceId: State.currentRaceId,
                 trackInfo: { ...State.trackInfo },
                 results: State.finalRaceData.map((driver, index) => ({
                     position: index + 1,
                     name: driver.name,
                     userId: driver.userId,
                     car: driver.carTitle,
                     status: driver.statusClass,
                     finalTimeOrStatus: driver.originalStatusText
                 }))
            };
            return raceData;
        },
        formatAsHTML() {
            const data = this.getFinalData();
            let tableRows = data.results.map(r => `
                <tr>
                    <td>${r.position}</td>
                    <td><a href="https://www.torn.com/profiles.php?XID=${r.userId}" target="_blank">${r.name} [${r.userId}]</a></td>
                    <td>${r.car}</td>
                    <td>${r.status === 'finished' ? r.finalTimeOrStatus : r.status.toUpperCase()}</td>
                </tr>`).join('');

            return `<!DOCTYPE html>
<html>
<head>
<title>Torn Race Results - ${data.trackInfo.name || 'Unknown Track'}</title>
<meta charset="UTF-8">
<style>
    body { font-family: sans-serif; line-height: 1.4; background-color: #f0f0f0; color: #333; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin-top: 15px; background-color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background-color: #e9e9e9; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    a { color: #007bff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    h1, h2 { color: #555; }
</style>
</head>
<body>
    <h1>Race Results</h1>
    <h2>Race ID: ${data.raceId || 'N/A'}</h2>
    <h2>Track: ${data.trackInfo.name || 'Unknown'} (${data.trackInfo.laps} Laps, ${data.trackInfo.length} Miles)</h2>
    <table>
        <thead>
            <tr><th>Pos</th><th>Driver</th><th>Car</th><th>Time/Status</th></tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>
    <p><small>Exported by Torn Racing Telemetry Script v${ScriptInfo.version}</small></p>
</body>
</html>`;
        },
        formatAsMarkdown() {
            const data = this.getFinalData();
            let md = `# Race Results\n\n`;
            md += `**Race ID:** ${data.raceId || 'N/A'}\n`;
            md += `**Track:** ${data.trackInfo.name || 'Unknown'} (${data.trackInfo.laps} Laps, ${data.trackInfo.length} Miles)\n\n`;
            md += `| Pos | Driver | Car | Time/Status |\n`;
            md += `|----:|--------|-----|-------------|\n`;
            data.results.forEach(r => {
                const driverLink = `[${r.name} [${r.userId}]](https://www.torn.com/profiles.php?XID=${r.userId})`;
                const status = r.status === 'finished' ? r.finalTimeOrStatus : r.status.toUpperCase();
                md += `| ${r.position} | ${driverLink} | ${r.car} | ${status} |\n`;
            });
            md += `\n*Exported by Torn Racing Telemetry Script v${ScriptInfo.version}*`;
            return md;
        },
         formatAsCSV() {
            const data = this.getFinalData();
            const esc = Utils.escapeCSVField;
            const header = ["Position", "Driver Name", "Driver ID", "Car Name", "Status", "Final Time/Status"];
            const rows = data.results.map(r => [
                r.position,
                r.name,
                r.userId,
                r.car,
                r.status,
                r.status === 'finished' ? r.finalTimeOrStatus : r.status.toUpperCase()
            ].map(esc).join(','));

            let csvString = `# Torn Race Results\n`;
            csvString += `# Race ID: ${esc(data.raceId || 'N/A')}\n`;
            csvString += `# Track: ${esc(data.trackInfo.name || 'Unknown')} (${data.trackInfo.laps} Laps, ${data.trackInfo.length} Miles)\n`;
            csvString += `# Exported: ${new Date().toISOString()}\n`;
            csvString += `# Script Version: ${ScriptInfo.version}\n`;
            csvString += header.map(esc).join(',') + '\n';
            csvString += rows.join('\n');
            return csvString;
        },
        formatAsPlainText() {
            const data = this.getFinalData();
            let txt = `Torn Race Results\n`;
            txt += `Race ID: ${data.raceId || 'N/A'}\n`;
            txt += `Track: ${data.trackInfo.name || 'Unknown'} (${data.trackInfo.laps} Laps, ${data.trackInfo.length} Miles)\n`;
            txt += `--------------------------------------------------\n`;
            data.results.forEach(r => {
                const status = r.status === 'finished' ? r.finalTimeOrStatus : r.status.toUpperCase();
                txt += `${String(r.position).padStart(3)}. ${r.name} [${r.userId}] (${r.car}) - ${status}\n`;
            });
            txt += `--------------------------------------------------\n`;
            txt += `Exported by Torn Racing Telemetry Script v${ScriptInfo.version}\n`;
            return txt;
        },
        getDetailedRaceFields() {
            const values = {};
            document.querySelectorAll('.car-selected.left .properties-wrap li, .car-selected.left div.cont-black.bottom-round > ul > li').forEach(item => {
                const title = item.querySelector('.properties > .title')?.textContent.trim();
                const separator = title?.indexOf(':');
                if (separator > 0) values[title.slice(0, separator).trim()] = title.slice(separator + 1).trim();
            });

            return {
                raceID: Number.parseInt(values.ID || State.currentRaceId, 10) || State.currentRaceId || null,
                raceName: values.Name || '', eventType: values.Type || '',
                timeCreated: values['Time created'] || '', timeStarted: values['Time started'] || '', timeEnded: values['Time ended'] || '',
                trackName: values.Track || State.trackInfo.name || '', lapsAmount: values.Laps || String(State.trackInfo.laps || ''),
                participantsAmount: values.Participants || String(State.finalRaceData.length), driversRequired: values['Drivers required'] || '',
                maximumDrivers: values['Maximum Drivers'] || '', carsAllowed: values['Cars allowed'] || '',
                upgradesAllowed: values['Upgrades allowed'] || '', betAmount: values['Bet amount'] || ''
            };
        },
        async formatAsJSON() {
            const liveDrivers = [...document.querySelectorAll('#leaderBoard > li[id^="lbr-"]')]
                .map(row => RaceManager.parseDriverData(row))
                .filter(Boolean);
            const drivers = liveDrivers.length ? liveDrivers : State.finalRaceData;
            if (!State.raceFinished || !drivers.length) throw new Error('JSON export is available after a race has finished.');

            Utils.showNotification('Preparing detailed JSON export…');
            const { results, skills } = await APIManager.raceData.getCompletedRaceData(drivers);
            const raceFields = this.getDetailedRaceFields();
            const skillGain = await APIManager.raceData.loadSkillGain(State.currentRaceId);
            const exportedAt = new Date().toISOString();

            // Core race-tracking fields stay at top level; telemetry adds
            // richer native details without complicating simple imports.
            const records = drivers.map((driver, index) => {
                const result = results.get(String(driver.userId));
                const crashed = Boolean(result?.crashed || driver.statusClass === 'crashed');
                const finishTime = crashed ? 'crashed' : (result?.displayTime || driver.originalStatusText || '');
                const inferredBestLap = !crashed && Number(raceFields.lapsAmount) === 1 ? Utils.parseTime(finishTime) : null;
                const bestLapSeconds = Number.isFinite(result?.bestLap) ? result.bestLap : inferredBestLap;
                const bestLap = crashed ? 'crashed' : (Number.isFinite(result?.bestLap)
                    ? Utils.formatTime(result.bestLap, true)
                    : (Number.isFinite(inferredBestLap) ? finishTime : 'N/A'));
                const racingSkill = skills.get(driver.userId);
                const driverSkillGain = String(driver.userId) === String(State.userId) && Number.isFinite(skillGain) ? skillGain : null;

                return {
                    userName: driver.name, position: result?.position || index + 1, finishTime, lapTime: bestLap,
                    racingSkill: Number.isFinite(racingSkill) ? String(racingSkill) : '', userID: String(driver.userId), carUsed: driver.carTitle,
                    ...raceFields,
                    telemetry: {
                        schemaVersion: ScriptInfo.version, exportedAt, status: driver.statusClass,
                        progressPercent: driver.statusClass === 'finished' ? 100 : driver.progress,
                        trackId: State.trackInfo.id ?? null, trackLength: State.trackInfo.length ?? null,
                        bestLapSeconds: Number.isFinite(bestLapSeconds) ? bestLapSeconds : null,
                        racingSkill: Number.isFinite(racingSkill) ? racingSkill : null,
                        skillGain: driverSkillGain,
                        // Preserve the information previously available in the
                        // native nested JSON export as well.
                        trackInfo: { ...State.trackInfo },
                        nativeResult: {
                            position: result?.position || index + 1,
                            name: driver.name,
                            userId: driver.userId,
                            car: driver.carTitle,
                            status: driver.statusClass,
                            finalTimeOrStatus: driver.originalStatusText
                        }
                    }
                };
            });
            return JSON.stringify(records, null, 2);
        },
        downloadData(dataString, fileExt, mimeType) {
            const blob = new Blob([dataString], { type: mimeType + ';charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const trackNameSafe = (State.trackInfo.name || 'UnknownTrack').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `torn_race_${State.currentRaceId || trackNameSafe}_${timestamp}.${fileExt}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
        copyToClipboard(text) {
             if (typeof GM_setClipboard !== 'undefined') {
                 GM_setClipboard(text);
             } else if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).catch(err => {
                     Utils.showNotification('Failed to copy to clipboard.', 'error');
                 });
             } else {
                Utils.showNotification('Clipboard copy not supported by browser/script manager.', 'error');
             }
        }
    };

    const RaceManager = {
        getRaceId() {
            const firstDriverLi = document.querySelector('#leaderBoard > li[data-id]');
            if (firstDriverLi && firstDriverLi.dataset.id) {
                const parts = firstDriverLi.dataset.id.split('-');
                if (parts.length === 2 && /^\d+$/.test(parts[0])) {
                    return parts[0];
                }
            }
            return null;
        },
        parseDriverData(originalLi) {
            if (!originalLi || !originalLi.matches('li[id^="lbr-"]')) return null;

            const nameEl = originalLi.querySelector('.name span');
            const carEl = originalLi.querySelector('.car img');
            const colorEl = originalLi.querySelector('.color');
            const timeEl = originalLi.querySelector('.time');
            const statusDiv = originalLi.querySelector('.status-wrap > div');
            const dataId = originalLi.dataset.id;
            const userId = dataId ? dataId.split('-')[1] : null;

            if (!userId) {
                return null;
            }

            const progressText = timeEl ? timeEl.textContent.trim() : '0%';
            const progressPercentage = Utils.parseProgress(progressText);
            let statusClass = 'unknown';
            let isFinished = false;
            let isCrashed = false;

            if (statusDiv) {
                const classList = statusDiv.classList;
                // Torn's live leaderboard uses "crash"; retain "crashed" for
                // any alternate/legacy markup.
                if (classList.contains('crash') || classList.contains('crashed')) {
                    isCrashed = true;
                    statusClass = 'crashed';
                } else if (classList.contains('gold') || classList.contains('silver') || classList.contains('bronze') || classList.contains('finished')) {
                    isFinished = true;
                    statusClass = 'finished';
                }
            }

            if (!isFinished && !isCrashed && timeEl && timeEl.textContent.includes(':')) {
                isFinished = true;
                statusClass = 'finished';
            }

            if (!isCrashed && !isFinished) {
                if (progressPercentage > 0) {
                    statusClass = 'racing';
                } else {
                    let raceStarted = false;
                    const anyTimeEl = document.querySelector('#leaderBoard li .time:not(:empty)');
                    if (anyTimeEl) {
                        raceStarted = true;
                    }
                    statusClass = raceStarted ? 'racing' : 'ready';
                }
            }

            if (State.previousMetrics[userId]?.statusClass === 'finished' && statusClass !== 'crashed') {
                statusClass = 'finished';
            }

            return {
                userId,
                originalId: originalLi.id,
                name: nameEl ? nameEl.textContent.trim() : 'N/A',
                carImgRaw: carEl ? carEl.getAttribute('src') : '',
                carTitle: carEl ? carEl.title : 'Unknown Car',
                colorClass: colorEl ? colorEl.className.replace('color', '').trim() : 'color-default',
                statusClass,
                originalStatusText: progressText,
                progress: progressPercentage
            };
        },
        async updateTrackAndClassInfo() {
            let trackInfoUpdated = false;
            let classInfoUpdated = false;

            try {
                const infoElement = document.querySelector('div.track-info');
                const trackHeader = document.querySelector('.drivers-list .title-black');

                if (infoElement && infoElement.title) {
                    const trackNameFromTitle = infoElement.title.trim();
                    const lengthMatch = infoElement.dataset.length?.match(/(\d+\.?\d*)/);
                    const lapsMatch = trackHeader?.textContent.match(/(\d+)\s+laps?/i);
                    const laps = lapsMatch ? parseInt(lapsMatch[1], 10) : (State.trackInfo.laps || 5);
                    const length = lengthMatch ? parseFloat(lengthMatch[1]) : (State.trackInfo.length || 3.4);
                    let trackId = State.trackInfo.id;
                    let trackName = State.trackInfo.name;

                    if (!trackId || trackNameFromTitle !== trackName) {
                        if (!State.trackNameMap && Utils.isApiKeyAvailable()) {
                            try {
                                const apiKey = Config.get('apiKey');
                                if (apiKey) {
                                    State.trackNameMap = await APIManager.fetchTrackData(apiKey);
                                }
                            } catch (e) {
                                State.trackNameMap = {};
                            }
                        }

                        if (State.trackNameMap) {
                            const foundEntry = Object.entries(State.trackNameMap).find(([id, name]) => name.toLowerCase() === trackNameFromTitle.toLowerCase());
                            if (foundEntry) {
                                trackId = parseInt(foundEntry[0], 10);
                                trackName = foundEntry[1];
                            } else {
                                trackName = trackNameFromTitle;
                                trackId = null;
                            }
                        } else {
                            trackName = trackNameFromTitle;
                            trackId = null;
                        }
                    }

                    const raceGeometryChanged =
                        trackId !== State.trackInfo.id ||
                        laps !== State.trackInfo.laps ||
                        Math.abs(length - State.trackInfo.length) > 0.01;
                    const trackIdentityChanged = raceGeometryChanged || trackName !== State.trackInfo.name;

                    if (trackIdentityChanged) {
                        if (raceGeometryChanged) {
                            State.resetRaceState();
                        }
                        State.trackInfo = { id: trackId, name: trackName, laps, length, get total() { return this.laps * this.length; } };
                        trackInfoUpdated = true;
                    }
                }

                const classElement = document.querySelector('div.banner div.class-letter');
                const detectedClass = classElement ? classElement.textContent.trim().toUpperCase() : null;
                if (detectedClass && detectedClass !== State.currentRaceClass) {
                    State.currentRaceClass = detectedClass;
                    classInfoUpdated = true;
                }
            } catch (e) {
                console.error('Telemetry Script: Error in updateTrackAndClassInfo:', e);
            }

            return trackInfoUpdated || classInfoUpdated;
        },
        getPositionIndicator(position, statusClass) {
            if (statusClass === 'finished') {
                if (position === 1) return '\u{1F947}';
                if (position === 2) return '\u{1F948}';
                if (position === 3) return '\u{1F949}';
                return String(position);
            }
            if (statusClass === 'crashed') return '\u{1F4A5}';
            if (statusClass === 'ready') return '-';
            return String(position);
        },
        setDriverName(nameDiv, name, isSelf) {
            if (!nameDiv) return;
            if (nameDiv._displayName === name && nameDiv._displayIsSelf === isSelf) {
                return;
            }

            nameDiv.textContent = name;
            if (isSelf) {
                nameDiv.appendChild(Utils.createElement('span', { className: 'self-tag', text: '(You)' }));
            }
            nameDiv._displayName = name;
            nameDiv._displayIsSelf = isSelf;
        },
        selectDriverOnMap(originalId) {
            const originalRow = document.getElementById(originalId);
            if (!originalRow) return;
            if (!originalRow.classList.contains('selected')) originalRow.click();
            this.syncMapSelection();
        },
        syncMapSelection() {
            const selectedOriginalId = document.querySelector('#leaderBoard > li.selected')?.id;
            State.customUIContainer?.querySelectorAll('.custom-driver-item[data-original-id]').forEach(item => {
                item.classList.toggle('map-selected', item.dataset.originalId === selectedOriginalId);
            });
        },
        hideUnavailableMetricCards(detailsDiv) {
            detailsDiv?.querySelectorAll('.driver-metric-item:not(.metric-est-lap)').forEach(card => {
                const value = card.querySelector('.driver-metric-value')?.textContent.trim();
                const unavailableValues = new Set([
                    'N/A', '0.00%', '-/-', '-%',
                    '- mph', '0 mph', '0.0 mph',
                    '- g', '0 g', '0.000 g'
                ]);
                card.style.display = unavailableValues.has(value) ? 'none' : '';
            });
        },
        ensureElementRefs(element) {
            if (element?._uiRefs?.colorIndicator && element?._uiRefs?.telemetryDiv) {
                return element._uiRefs;
            }

            element._uiRefs = {
                colorIndicator: element.querySelector('.driver-color-indicator'),
                carImg: element.querySelector('.driver-car-img'),
                nameDiv: element.querySelector('.driver-name'),
                telemetryDiv: element.querySelector('.driver-telemetry-display'),
                progressBars: element.querySelector('.driver-progress-bars'),
                fullProgressBar: element.querySelector('.driver-progress-full .driver-progress-fill'),
                lapProgressBar: element.querySelector('.driver-progress-lap .driver-progress-fill'),
                detailsButton: element.querySelector('.driver-details-toggle'),
                detailsDiv: element.querySelector('.driver-details')
            };
            return element._uiRefs;
        },
        createDriverElement(driverData, position) {
            const item = document.createElement('div');
            item.className = 'custom-driver-item';
            item.dataset.originalId = driverData.originalId;
            item.dataset.userId = driverData.userId;

            const isSelf = driverData.userId === State.userId;
            if (isSelf) item.classList.add('is-self');
            item.classList.add(`status-${driverData.statusClass}`);

            const infoRow = Utils.createElement('div', { className: 'driver-info-row' });
            const colorIndicator = Utils.createElement('div', { className: `driver-color-indicator ${driverData.colorClass}` });
            const carImg = Utils.createElement('img', {
                className: 'driver-car-img',
                attrs: {
                    src: Utils.makeAbsoluteUrl(driverData.carImgRaw),
                    alt: driverData.carTitle,
                    title: driverData.carTitle
                }
            });
            const nameDiv = Utils.createElement('div', { className: 'driver-name' });
            const telemetryDiv = Utils.createElement('div', { className: 'driver-telemetry-display' });
            const progressBars = Utils.createElement('div', { className: 'driver-progress-bars' });
            const fullProgressTrack = Utils.createElement('div', { className: 'driver-progress-track driver-progress-full' });
            const fullProgressBar = Utils.createElement('div', { className: 'driver-progress-fill' });
            const lapProgressTrack = Utils.createElement('div', { className: 'driver-progress-track driver-progress-lap' });
            const lapProgressBar = Utils.createElement('div', { className: 'driver-progress-fill' });
            fullProgressTrack.append(fullProgressBar);
            lapProgressTrack.append(lapProgressBar);
            progressBars.append(fullProgressTrack, lapProgressTrack);
            const detailsButton = Utils.createElement('button', {
                className: 'driver-details-toggle',
                text: '+',
                attrs: {
                    type: 'button',
                    title: 'Show driver details',
                    'aria-label': 'Show driver details',
                    'aria-expanded': 'false'
                }
            });
            const detailsDiv = Utils.createElement('div', { className: 'driver-details' });

            this.setDriverName(nameDiv, driverData.name, isSelf);
            Telemetry.ensureDisplayRefs(telemetryDiv);

            infoRow.append(colorIndicator, carImg, nameDiv, telemetryDiv, detailsButton);
            item.append(infoRow, progressBars, detailsDiv);
            item._uiRefs = { colorIndicator, carImg, nameDiv, telemetryDiv, progressBars, fullProgressBar, lapProgressBar, detailsButton, detailsDiv };

            this.updateDriverElement(item, driverData, position);
            return item;
        },
        updateDriverElement(element, driverData, position) {
            const driverId = driverData.userId;
            const isSelf = driverId === State.userId;
            const now = Date.now();
            const detailsVisible = element.classList.contains('details-visible');
            const driverState = State.previousMetrics[driverId];
            const refs = this.ensureElementRefs(element);

            const mapSelected = document.getElementById(driverData.originalId)?.classList.contains('selected');
            element.className = `custom-driver-item status-${driverData.statusClass} ${isSelf ? 'is-self' : ''} ${detailsVisible ? 'details-visible' : ''} ${mapSelected ? 'map-selected' : ''}`.trim().replace(/\s+/g, ' ');

            if (refs.detailsButton) {
                refs.detailsButton.textContent = detailsVisible ? '−' : '+';
                refs.detailsButton.title = detailsVisible ? 'Hide driver details' : 'Show driver details';
                refs.detailsButton.setAttribute('aria-label', refs.detailsButton.title);
                refs.detailsButton.setAttribute('aria-expanded', String(detailsVisible));
            }

            const colorIndicator = refs.colorIndicator;
            if (colorIndicator) {
                const nextClassName = `driver-color-indicator ${driverData.colorClass}`;
                if (colorIndicator.className !== nextClassName) {
                    colorIndicator.className = nextClassName;
                }
                colorIndicator.textContent = this.getPositionIndicator(position, driverData.statusClass);
            }

            const carImg = refs.carImg;
            const newCarSrc = Utils.makeAbsoluteUrl(driverData.carImgRaw);
            if (carImg) {
                if (carImg.getAttribute('src') !== newCarSrc) {
                    carImg.src = newCarSrc;
                }
                if (carImg.alt !== driverData.carTitle || carImg.title !== driverData.carTitle) {
                    carImg.alt = driverData.carTitle;
                    carImg.title = driverData.carTitle;
                }
            }

            this.setDriverName(refs.nameDiv, driverData.name, isSelf);

            const telemetryDiv = refs.telemetryDiv;
            if (telemetryDiv) {
                const displayOptions = Config.get('telemetryDisplayOptions') || [];
                const speedUnit = Config.get('speedUnit');

                if (driverData.statusClass === 'crashed' || driverData.statusClass === 'finished' || driverData.statusClass === 'ready') {
                    if (telemetryDiv._animationRAF) {
                        cancelAnimationFrame(telemetryDiv._animationRAF);
                        telemetryDiv._animationRAF = null;
                        telemetryDiv._currentAnimSpeed = undefined;
                        telemetryDiv._currentAnimAcc = undefined;
                    }

                    let telemetryText = '';
                    let telemetryColor = 'var(--telemetry-default-color)';

                    if (driverData.statusClass === 'crashed') {
                        telemetryText = 'Crashed';
                        telemetryColor = 'var(--telemetry-decel-color)';
                    } else if (driverData.statusClass === 'finished') {
                        const finishTimeText = driverData.originalStatusText || '--:--';
                        telemetryText = `\u{1F3C1} ${finishTimeText}`;
                    } else {
                        const displayParts = [];
                        if (displayOptions.includes('speed')) displayParts.push(`0 ${speedUnit}`);
                        if (displayOptions.includes('acceleration')) displayParts.push('0.0 g');
                        telemetryText = displayParts.length > 0 ? displayParts.join(' | ') : '-';
                    }

                    Telemetry.setTelemetryDisplay(telemetryDiv, telemetryText, telemetryColor);
                } else {
                    const metrics = Telemetry.calculateDriverMetrics(driverId, driverData.progress, now);
                    const targetSpeed = Utils.convertSpeed(metrics.speed, speedUnit);
                    const targetAcc = metrics.acceleration;

                    if (Config.get('showLapEstimate') && driverData.progress < 100 && State.trackInfo.id && driverState) {
                        Telemetry.calculateSmoothedLapEstimate(driverId, metrics);
                    }

                    const canAnimate =
                        Config.get('animateChanges') &&
                        driverState &&
                        !driverState.firstUpdate &&
                        (displayOptions.includes('speed') || displayOptions.includes('acceleration'));

                    if (canAnimate) {
                        const fromSpeed = telemetryDiv._currentAnimSpeed !== undefined
                            ? telemetryDiv._currentAnimSpeed
                            : Math.round(Utils.convertSpeed(driverState.lastDisplayedSpeed || 0, speedUnit));
                        const fromAcc = telemetryDiv._currentAnimAcc !== undefined
                            ? telemetryDiv._currentAnimAcc
                            : driverState.lastDisplayedAcceleration || 0;
                        const animationDuration = Math.min(metrics.timeDelta || Config.get('minUpdateInterval'), Config.get('maxAnimationDurationMs'));

                        const animationMode = displayOptions.includes('speed')
                            ? (displayOptions.includes('acceleration') ? 'both' : 'speed')
                            : 'acceleration';

                        Telemetry.animateTelemetry(
                            telemetryDiv,
                            fromSpeed,
                            Math.round(targetSpeed),
                            fromAcc,
                            targetAcc,
                            animationDuration,
                            animationMode,
                            speedUnit
                        );
                    } else {
                        if (telemetryDiv._animationRAF) {
                            cancelAnimationFrame(telemetryDiv._animationRAF);
                            telemetryDiv._animationRAF = null;
                            telemetryDiv._currentAnimSpeed = undefined;
                            telemetryDiv._currentAnimAcc = undefined;
                        }

                        let staticColor = 'var(--telemetry-default-color)';
                        const parts = [];

                        if (displayOptions.includes('speed')) {
                            parts.push(`${Math.round(targetSpeed)} ${speedUnit}`);
                        }
                        if (displayOptions.includes('acceleration')) {
                            parts.push(`${targetAcc.toFixed(1)} g`);
                            if (Config.get('colorCode')) {
                                staticColor = Telemetry.getTelemetryColor(targetAcc);
                            }
                        }
                        const staticText = parts.join(' | ') || '-';
                        Telemetry.setTelemetryDisplay(telemetryDiv, staticText, staticColor);
                    }

                    if (driverState) {
                        driverState.lastDisplayedSpeed = metrics.speed;
                        driverState.lastDisplayedAcceleration = metrics.acceleration;
                    }
                }
            }

            if (refs.progressBars) {
                const showProgressBars = (Config.get('telemetryDisplayOptions') || []).includes('progress');
                const fullProgress = Math.max(0, Math.min(100, driverData.progress || 0));
                const laps = Math.max(1, Number(State.trackInfo.laps) || 1);
                const progressPerLap = 100 / laps;
                const lapProgress = fullProgress >= 100 ? 100 : ((fullProgress % progressPerLap) / progressPerLap) * 100;
                refs.progressBars.hidden = !showProgressBars;
                refs.fullProgressBar.style.width = `${fullProgress.toFixed(2)}%`;
                refs.lapProgressBar.style.width = `${Math.max(0, Math.min(100, lapProgress)).toFixed(2)}%`;
                refs.progressBars.title = `Race progress: ${fullProgress.toFixed(1)}% | Current lap: ${lapProgress.toFixed(1)}%`;
            }

            const detailsDiv = refs.detailsDiv;
            if (detailsDiv) {
                const needsHTMLStructure = detailsVisible && !detailsDiv.hasChildNodes();
                if (needsHTMLStructure) {
                    const apiStatsHTML = Config.get('fetchApiStatsOnClick')
                        ? `
                            <div class="api-stats-container">
                                <div class="driver-section-title">API Racing Stats</div>
                                <div class="driver-api-grid">
                                    <div class="driver-api-item">
                                        <span class="driver-api-label">Skill</span>
                                        <span class="driver-api-value"><span class="api-stat stat-skill">...</span></span>
                                    </div>
                                    <div class="driver-api-item">
                                        <span class="driver-api-label">Points</span>
                                        <span class="driver-api-value"><span class="api-stat stat-points">...</span></span>
                                    </div>
                                    <div class="driver-api-item">
                                        <span class="driver-api-label">Races</span>
                                        <span class="driver-api-value"><span class="api-stat stat-races-entered">...</span> (<span class="api-stat stat-races-won">...</span> wins)</span>
                                    </div>
                                    <div class="driver-api-item">
                                        <span class="driver-api-label">Win Rate</span>
                                        <span class="driver-api-value"><span class="api-stat stat-win-rate">...</span></span>
                                    </div>
                                </div>
                                <span class="api-stat-error-msg"></span>
                            </div>`
                        : '';

                    detailsDiv.innerHTML = `
                        <div class="driver-details-shell">
                            <div class="driver-details-topline">
                                <div class="driver-identity">
                                    <span class="driver-identity-label">User</span>
                                    <span class="driver-identity-value">${driverData.name} [<a href="/profiles.php?XID=${driverId}" target="_blank" rel="noopener noreferrer" title="View Profile">${driverId}</a>] ${isSelf ? '<strong>(You)</strong>' : ''}</span>
                                </div>
                                <div class="driver-status-wrap">
                                    <span class="driver-identity-label">Status</span>
                                    <span class="driver-status-chip detail-status">${driverData.statusClass}</span>
                                    <span class="detail-original-status"></span>
                                </div>
                            </div>
                            <div class="driver-meta-row">
                                <span class="driver-identity-label">Car</span>
                                <span class="driver-identity-value">${driverData.carTitle}</span>
                            </div>
                            <div class="driver-metrics-grid">
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Position</span>
                                    <span class="driver-metric-value detail-stat detail-position">${driverData.statusClass === 'crashed' ? 'Crashed' : position}</span>
                                </div>
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Progress</span>
                                    <span class="driver-metric-value detail-stat detail-progress">${driverData.progress.toFixed(2)}%</span>
                                </div>
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Skill Gained</span>
                                    <span class="driver-metric-value detail-skill-gain">${isSelf ? APIManager.raceData.getSkillGainDisplay(State.currentRaceId) : 'N/A'}</span>
                                </div>
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Race Time</span>
                                    <span class="driver-metric-value detail-race-time">N/A</span>
                                </div>
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Best Lap</span>
                                    <span class="driver-metric-value detail-best-lap">N/A</span>
                                </div>
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Lap</span>
                                    <span class="driver-metric-value detail-stat detail-lap">-/-</span>
                                </div>
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Lap Progress</span>
                                    <span class="driver-metric-value detail-stat detail-lap-progress">-%</span>
                                </div>
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Calc Speed</span>
                                    <span class="driver-metric-value"><span class="detail-stat detail-calc-speed">-</span><span class="metric-unit"> mph</span></span>
                                </div>
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Calc Accel</span>
                                    <span class="driver-metric-value"><span class="detail-stat detail-calc-accel">-</span><span class="metric-unit"> g</span></span>
                                </div>
                                <div class="driver-metric-item metric-est-lap p-est-lap-time" style="display: none;">
                                    <span class="driver-metric-label">Est. Lap Time</span>
                                    <span class="driver-metric-value detail-stat detail-est-lap-time">N/A</span>
                                </div>
                            </div>
                            ${apiStatsHTML}
                            <div class="driver-details-footer">Source ID: ${driverData.originalId}</div>
                        </div>`;

                    if (Config.get('fetchApiStatsOnClick') && driverId && !element.hasAttribute('data-stats-loaded') && !APIManager.isFetching.has(driverId)) {
                        setTimeout(() => APIManager.fetchAndDisplayRacingStats(element, driverId), 50);
                    }
                }

                if (detailsVisible) {
                    const updateDetailStat = (selector, value, placeholder = '-', isLiveData = true) => {
                        const detailEl = detailsDiv.querySelector(selector);
                        const usePlaceholder = isLiveData && driverData.statusClass !== 'racing';
                        if (detailEl) {
                            detailEl.textContent = usePlaceholder ? placeholder : value;
                        }
                    };

                    updateDetailStat('.detail-position', driverData.statusClass === 'crashed' ? 'Crashed' : position, '-', false);
                    updateDetailStat('.detail-progress', `${driverData.progress.toFixed(2)}%`, '0.00%', false);
                    const skillGainEl = detailsDiv.querySelector('.detail-skill-gain');
                    if (skillGainEl && isSelf && driverData.statusClass === 'finished') {
                        APIManager.raceData.loadSkillGain(State.currentRaceId)
                            .then(() => {
                                skillGainEl.textContent = APIManager.raceData.getSkillGainDisplay(State.currentRaceId);
                                this.hideUnavailableMetricCards(detailsDiv);
                            })
                            .catch(() => {
                                skillGainEl.textContent = 'N/A';
                                this.hideUnavailableMetricCards(detailsDiv);
                            });
                    }

                    if (driverData.statusClass === 'finished') {
                        APIManager.raceData.loadApiRaceResults(State.currentRaceId)
                            .then(results => {
                                const result = results.get(String(driverId));
                                const raceTime = Number(result?.race_time);
                                const bestLap = Number(result?.best_lap_time);
                                const raceTimeEl = detailsDiv.querySelector('.detail-race-time');
                                const bestLapEl = detailsDiv.querySelector('.detail-best-lap');
                                if (raceTimeEl) raceTimeEl.textContent = Number.isFinite(raceTime) ? Utils.formatTime(raceTime, true) : 'N/A';
                                if (bestLapEl) bestLapEl.textContent = Number.isFinite(bestLap) ? Utils.formatTime(bestLap, true) : 'N/A';
                                this.hideUnavailableMetricCards(detailsDiv);
                            })
                            .catch(() => this.hideUnavailableMetricCards(detailsDiv));
                    }

                    const statusEl = detailsDiv.querySelector('.detail-status');
                    if (statusEl) statusEl.textContent = driverData.statusClass;

                    const statusSpan = detailsDiv.querySelector('.detail-original-status');
                    if (statusSpan) {
                        statusSpan.textContent = (driverData.originalStatusText && !['finished', 'crashed'].includes(driverData.statusClass))
                            ? `(${driverData.originalStatusText})`
                            : '';
                    }

                    if (driverState || driverData.statusClass !== 'racing') {
                        updateDetailStat('.detail-lap', `${driverState?.currentLap || '-'}/${State.trackInfo.laps || '-'}`, '-/-');
                        updateDetailStat('.detail-lap-progress', `${driverState?.progressInLap !== undefined ? driverState.progressInLap.toFixed(1) : '-'}%`, '-%');
                        updateDetailStat('.detail-calc-speed', `${driverState?.lastDisplayedSpeed !== undefined ? driverState.lastDisplayedSpeed.toFixed(1) : '-'}`, '-');
                        updateDetailStat('.detail-calc-accel', `${driverState?.lastDisplayedAcceleration !== undefined ? driverState.lastDisplayedAcceleration.toFixed(3) : '-'}`, '-');

                        const estLapTimeEl = detailsDiv.querySelector('.detail-est-lap-time');
                        const estLapParaEl = detailsDiv.querySelector('.p-est-lap-time');
                        if (estLapTimeEl && estLapParaEl) {
                            const isRacing = driverData.statusClass === 'racing';
                            const estLapVisible =
                                isRacing &&
                                Config.get('showLapEstimate') &&
                                driverState?.smoothedLapEstimate !== null &&
                                isFinite(driverState?.smoothedLapEstimate) &&
                                State.trackInfo.id &&
                                driverState?.smoothedLapEstimate > 0;

                            if (estLapVisible) {
                                estLapTimeEl.textContent = `${Utils.formatTime(driverState.smoothedLapEstimate)} (Raw: ${driverState.rawLapEstimate !== null && isFinite(driverState.rawLapEstimate) ? Utils.formatTime(driverState.rawLapEstimate) : '--:--'})`;
                                estLapParaEl.style.display = '';
                            } else {
                                estLapTimeEl.textContent = 'N/A';
                                estLapParaEl.style.display = 'none';
                            }
                        }
                    }

                    if (Config.get('fetchApiStatsOnClick') && driverId && !element.hasAttribute('data-stats-loaded') && !APIManager.isFetching.has(driverId)) {
                        const statsContainer = detailsDiv.querySelector('.api-stats-container');
                        if (statsContainer && !statsContainer.matches('.loading, .loaded, .error, .no-key')) {
                            setTimeout(() => APIManager.fetchAndDisplayRacingStats(element, driverId), 50);
                        }
                    }
                    this.hideUnavailableMetricCards(detailsDiv);
                }
            }

            if (driverState) driverState.statusClass = driverData.statusClass;
        },
        stableUpdateCustomList() {
            if (!Config.get('hideOriginalList')) {
                if (State.isInitialized) {
                    State.resetRaceState();
                }
                return;
            }
            if (State.isUpdating || !State.customUIContainer || !State.originalLeaderboard || !document.body.contains(State.originalLeaderboard)) {
                return;
            }

            State.isUpdating = true;
            // Track metadata changes reset race state. Reacquire the ID here so finished
            // race adapters still have it on first render and when viewing historic logs.
            if (!State.currentRaceId) {
                State.currentRaceId = this.getRaceId();
            }
            const savedScrollTop = State.customUIContainer.scrollTop;
            const hadFocus = document.activeElement === State.customUIContainer || State.customUIContainer.contains(document.activeElement);
            const originalListItems = Array.from(State.originalLeaderboard.querySelectorAll(':scope > li[id^="lbr-"]'));
            const newDriversData = originalListItems.map(this.parseDriverData).filter(data => data !== null);
            const currentElementsMap = new Map();

            State.customUIContainer.querySelectorAll(':scope > .custom-driver-item[data-user-id]').forEach(el => {
                currentElementsMap.set(el.dataset.userId, el);
            });

            const newElementsToProcess = new Map();
            newDriversData.forEach((driverData, index) => {
                const position = index + 1;
                let element = currentElementsMap.get(driverData.userId);

                if (element) {
                    this.updateDriverElement(element, driverData, position);
                    newElementsToProcess.set(driverData.userId, { data: driverData, element, position });
                    currentElementsMap.delete(driverData.userId);
                } else {
                    element = this.createDriverElement(driverData, position);
                    newElementsToProcess.set(driverData.userId, { data: driverData, element, position });
                }
            });

            currentElementsMap.forEach((elementToRemove, removedUserId) => {
                const telemetryDiv = this.ensureElementRefs(elementToRemove).telemetryDiv;
                if (telemetryDiv?._animationRAF) {
                    cancelAnimationFrame(telemetryDiv._animationRAF);
                }
                if (State.previousMetrics[removedUserId]) {
                    delete State.previousMetrics[removedUserId];
                }
                elementToRemove.remove();
            });

            let previousElement = null;
            newDriversData.forEach(driverData => {
                const { element } = newElementsToProcess.get(driverData.userId);
                const insertBeforeNode = previousElement ? previousElement.nextSibling : State.customUIContainer.firstChild;
                if (element !== insertBeforeNode) {
                    State.customUIContainer.insertBefore(element, insertBeforeNode);
                }
                previousElement = element;
            });

            const mapSelectionRaceKey = State.currentRaceId || newDriversData.map(driver => driver.originalId).join(',');
            if (State.mapSelectionInitializedForRace !== mapSelectionRaceKey) {
                const selfDriver = newDriversData.find(driver => driver.userId === State.userId);
                if (selfDriver) this.selectDriverOnMap(selfDriver.originalId);
                State.mapSelectionInitializedForRace = mapSelectionRaceKey;
            }

            const finishedOrCrashed = ['finished', 'crashed'];
            const allDriversFinished = newDriversData.length > 0 && newDriversData.every(d => finishedOrCrashed.includes(d.statusClass));

            if (allDriversFinished && !State.raceFinished) {
                State.raceFinished = true;
                State.finalRaceData = newDriversData;
                UI.updateControlButtonsVisibility();
            } else if (allDriversFinished) {
                // Torn can populate image titles after the result rows first render.
                // Keep the export snapshot aligned with the latest original markup.
                State.finalRaceData = newDriversData;
            } else if (!allDriversFinished && State.raceFinished) {
                State.raceFinished = false;
                State.finalRaceData = [];
                UI.updateControlButtonsVisibility();
            }

            this.syncMapSelection();

            if (hadFocus && document.body.contains(State.customUIContainer)) {
                State.customUIContainer.scrollTop = savedScrollTop;
            }
            State.isUpdating = false;
        }
    };

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

    const ThemeManager = {
        observer: null,
        mediaQueryList: null,
        mediaQueryHandler: null,
        applyRafId: null,
        stylesInjected: false,
        forceDarkTheme: true,
        defaults: {
            text: [224, 224, 224],
            background: [26, 26, 26],
            accent: [100, 181, 246]
        },

        initialize() {
            if (!this.stylesInjected) {
                GM_addStyle(TELEMETRY_STYLE_TEXT);
                this.stylesInjected = true;
            }

            this.applyTheme();
            this.observeThemeChanges();
        },
        disconnect() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            if (this.mediaQueryList && this.mediaQueryHandler) {
                this.mediaQueryList.removeEventListener('change', this.mediaQueryHandler);
            }
            this.mediaQueryList = null;
            this.mediaQueryHandler = null;
            if (this.applyRafId) {
                cancelAnimationFrame(this.applyRafId);
                this.applyRafId = null;
            }
        },
        observeThemeChanges() {
            if (!document.body || this.observer) {
                return;
            }

            this.observer = new MutationObserver(() => this.scheduleApplyTheme());
            const observerConfig = { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] };
            this.observer.observe(document.documentElement, observerConfig);
            this.observer.observe(document.body, observerConfig);

            if (!this.mediaQueryList && typeof window.matchMedia === 'function') {
                this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
                this.mediaQueryHandler = () => this.scheduleApplyTheme();
                this.mediaQueryList.addEventListener('change', this.mediaQueryHandler);
            }
        },
        scheduleApplyTheme() {
            if (this.applyRafId) {
                cancelAnimationFrame(this.applyRafId);
            }
            this.applyRafId = requestAnimationFrame(() => {
                this.applyRafId = null;
                this.applyTheme();
            });
        },
        parseColor(value, fallback = null) {
            if (!value) return fallback;

            const trimmed = value.trim();
            const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
            if (rgbMatch) {
                const parts = rgbMatch[1].split(',').map(part => parseFloat(part.trim()));
                if (parts.length >= 3 && parts.every(part => Number.isFinite(part))) {
                    if (parts[3] === 0) return fallback;
                    return parts.slice(0, 3).map(part => Math.max(0, Math.min(255, Math.round(part))));
                }
            }

            const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
            if (hexMatch) {
                const hex = hexMatch[1];
                const normalized = hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex;
                return [
                    parseInt(normalized.slice(0, 2), 16),
                    parseInt(normalized.slice(2, 4), 16),
                    parseInt(normalized.slice(4, 6), 16)
                ];
            }

            return fallback;
        },
        mixColors(baseColor, targetColor, ratio) {
            return baseColor.map((channel, index) => {
                const targetChannel = targetColor[index] ?? channel;
                return Math.round(channel + (targetChannel - channel) * ratio);
            });
        },
        toCssColor(color) {
            return `rgb(${color.join(', ')})`;
        },
        getLuminance(color) {
            const [r, g, b] = color.map(channel => {
                const normalized = channel / 255;
                return normalized <= 0.03928
                    ? normalized / 12.92
                    : ((normalized + 0.055) / 1.055) ** 2.4;
            });

            return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
        },
        getAccentColor() {
            const linkTarget = document.querySelector('a[href]') || document.body || document.documentElement;
            const computed = linkTarget ? getComputedStyle(linkTarget).color : '';
            return this.parseColor(computed, this.defaults.accent);
        },
        getThemePalette() {
            let background;
            let text;
            let accent;
            let isDark;

            if (this.forceDarkTheme) {
                background = this.defaults.background;
                text = this.defaults.text;
                accent = this.defaults.accent;
                isDark = true;
            } else {
                const bodyStyle = document.body ? getComputedStyle(document.body) : null;
                const rootStyle = getComputedStyle(document.documentElement);
                background = this.parseColor(
                    bodyStyle?.backgroundColor,
                    this.parseColor(rootStyle.backgroundColor, this.defaults.background)
                );
                text = this.parseColor(bodyStyle?.color, this.parseColor(rootStyle.color, this.defaults.text));
                accent = this.getAccentColor();
                isDark = this.getLuminance(background) < 0.35;
            }

            const contrastTarget = isDark ? [255, 255, 255] : [0, 0, 0];

            const panelBase = this.mixColors(background, contrastTarget, isDark ? 0.08 : 0.03);
            const panelRaised = this.mixColors(panelBase, contrastTarget, isDark ? 0.08 : 0.05);
            const border = this.mixColors(text, panelBase, 0.75);
            const detailsBg = this.mixColors(panelBase, contrastTarget, isDark ? 0.04 : 0.02);
            const tableHeaderBg = this.mixColors(panelBase, contrastTarget, isDark ? 0.1 : 0.05);
            const tableRowAltBg = this.mixColors(panelBase, contrastTarget, isDark ? 0.04 : 0.02);
            const panelHeading = this.mixColors(text, accent, isDark ? 0.35 : 0.30);
            const panelHoverBg = this.mixColors(panelRaised, accent, isDark ? 0.18 : 0.10);

            return {
                '--text-color': this.toCssColor(text),
                '--background-dark': this.toCssColor(panelBase),
                '--background-light': this.toCssColor(panelRaised),
                '--border-color': this.toCssColor(border),
                '--accent-color': this.toCssColor(accent),
                '--panel-link-color': '#74c0fc',
                '--panel-heading-color': this.toCssColor(panelHeading),
                '--panel-hover-bg': this.toCssColor(panelHoverBg),
                '--primary-color': 'rgb(76, 175, 80)',
                '--telemetry-default-color': this.toCssColor(this.mixColors(text, panelBase, 0.45)),
                '--telemetry-accel-color': 'rgb(76, 175, 80)',
                '--telemetry-decel-color': 'rgb(244, 67, 54)',
                '--details-bg': this.toCssColor(detailsBg),
                '--self-highlight-bg': this.toCssColor(this.mixColors(panelBase, [76, 175, 80], isDark ? 0.16 : 0.10)),
                '--self-highlight-border': 'rgb(76, 175, 80)',
                '--api-loading-color': this.toCssColor(this.mixColors(text, panelBase, 0.35)),
                '--api-error-color': 'rgb(255, 138, 128)',
                '--api-info-color': this.toCssColor(accent),
                '--table-header-bg': this.toCssColor(tableHeaderBg),
                '--table-row-alt-bg': this.toCssColor(tableRowAltBg),
                '--history-color': 'rgb(255, 193, 7)',
                '--danger-color': 'rgb(244, 67, 54)',
                '--danger-hover-color': 'rgb(211, 47, 47)',
                '--info-color': 'rgb(33, 150, 243)',
                '--download-color': 'rgb(156, 39, 176)'
            };
        },
        applyTheme() {
            const palette = this.getThemePalette();
            const root = document.documentElement;
            Object.entries(palette).forEach(([property, value]) => {
                root.style.setProperty(property, value);
            });
        }
    };

    const TELEMETRY_STYLE_TEXT = `
        :root {
            --text-color: #e0e0e0;
            --background-dark: #1a1a1a;
            --background-light: #2a2a2a;
            --border-color: #404040;
            --accent-color: #64B5F6;
            --panel-link-color: #74c0fc;
            --panel-heading-color: #9BC4E8;
            --panel-hover-bg: #3A5D7E;
            --primary-color: #4CAF50;
            --telemetry-default-color: rgb(136, 136, 136);
            --telemetry-accel-color: rgb(76, 175, 80);
            --telemetry-decel-color: rgb(244, 67, 54);
            --details-bg: #2f2f2f;
            --self-highlight-bg: #2a3a2a;
            --self-highlight-border: #4CAF50;
            --api-loading-color: #aaa;
            --api-error-color: #ff8a80;
            --api-info-color: #64B5F6;
            --table-header-bg: #333;
            --table-row-alt-bg: #222;
            --history-color: #FFC107;
            --danger-color: #f44336;
            --danger-hover-color: #d32f2f;
            --info-color: #2196F3;
            --download-color: #9C27B0;
        }
        #custom-driver-list-container { display: none; }
        #drivers-scrollbar { display: block !important; }
        #telemetryControlsContainer { display: flex; }
        body.hide-original-leaderboard #drivers-scrollbar { display: none !important; }
        body.hide-original-leaderboard #custom-driver-list-container { display: block; }
        #custom-driver-list-container { margin-top: 10px; border: 1px solid var(--border-color); border-radius: 5px; background-color: var(--background-dark); color: var(--text-color); padding: 0; max-height: 450px; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; scrollbar-color: #555 var(--background-dark); position: relative; }
        #custom-driver-list-container::-webkit-scrollbar { width: 8px; }
        #custom-driver-list-container::-webkit-scrollbar-track { background: var(--background-dark); border-radius: 4px; }
        #custom-driver-list-container::-webkit-scrollbar-thumb { background-color: #555; border-radius: 4px; border: 2px solid var(--background-dark); }
        .custom-driver-item { display: flex; padding: 6px 8px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background-color 0.2s ease; position: relative; flex-direction: column; align-items: stretch; }
        .driver-info-row { display: flex; align-items: center; width: 100%; }
        .custom-driver-item:last-child { border-bottom: none; }
        .custom-driver-item:hover { background-color: var(--background-light); }
        .custom-driver-item.map-selected { background-color: var(--self-highlight-bg); border-left: 3px solid var(--self-highlight-border); padding-left: 5px; }
        .custom-driver-item.map-selected:hover { filter: brightness(1.05); }
        .driver-color-indicator { width: 10px; height: 20px; margin-right: 8px; border-radius: 3px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; font-weight: bold; line-height: 1; overflow: hidden; text-shadow: 0 0 2px rgba(0,0,0,0.7); }
        .driver-car-img { width: 38px; height: 19px; margin-right: 8px; object-fit: contain; flex-shrink: 0; }
        .driver-name { flex-grow: 1; font-weight: bold; margin-right: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 100px; }
        .driver-name .self-tag { color: #90EE90; font-weight: normal; margin-left: 4px; }
        .driver-telemetry-display { font-size: 0.85em; color: var(--telemetry-default-color); margin-left: auto; flex-shrink: 0; display: flex; align-items: center; white-space: nowrap; min-width: 70px; text-align: right; transition: opacity 0.3s ease; opacity: 1; }
        .driver-telemetry-display .telemetry-stats { display: inline-flex; align-items: stretch; gap: 3px; }
        .driver-telemetry-display .telemetry-column { display: flex; flex-direction: column; justify-content: center; min-width: 76px; background: rgba(0,0,0,0.28); border-radius: 4px; overflow: hidden; }
        .driver-telemetry-display .telemetry-stat { display: flex; align-items: baseline; justify-content: center; padding: 1px 6px; min-height: 14px; line-height: 1.15; }
        .driver-telemetry-display .telemetry-stat[hidden], .driver-telemetry-display .telemetry-column[hidden] { display: none !important; }
        .driver-telemetry-display .telemetry-stat + .telemetry-stat:not([hidden]) { border-top: 1px solid rgba(255,255,255,0.1); }
        .driver-telemetry-display .telemetry-label { display: none; }
        .driver-telemetry-display .telemetry-stat-value { color: var(--telemetry-default-color); font-weight: 700; font-variant-numeric: tabular-nums; }
        .driver-telemetry-display .telemetry-status { justify-content: center; color: var(--telemetry-default-color); font-weight: 700; font-variant-numeric: tabular-nums; }
        .driver-progress-bars { display: flex; flex-direction: column; gap: 0; margin: 4px -8px -6px; }
        .driver-progress-bars[hidden] { display: none !important; }
        .custom-driver-item.map-selected .driver-progress-bars { margin-left: -5px; }
        .driver-progress-track { height: 2px; overflow: hidden; background: rgba(255,255,255,0.12); border-radius: 2px; }
        .driver-progress-fill { height: 100%; border-radius: inherit; transition: width 0.35s ease-out; }
        .driver-progress-full .driver-progress-fill { background: rgba(116, 192, 252, 0.72); }
        .driver-progress-lap .driver-progress-fill { background: rgba(129, 199, 132, 0.9); }
        .driver-telemetry-display .lap-estimate:empty { display: none; }
        body.telemetry-hidden .driver-telemetry-display { opacity: 0; pointer-events: none; min-width: 0; padding: 0; }
        .driver-details-toggle { width: 26px; height: 26px; margin-left: 6px; padding: 0; border: 1px solid var(--border-color); border-radius: 4px; background: rgba(0, 0, 0, 0.2); color: var(--text-color); cursor: pointer; font-size: 18px; line-height: 20px; flex-shrink: 0; }
        .driver-details-toggle:hover, .driver-details-toggle:focus-visible { background: var(--background-light); border-color: var(--panel-link-color); outline: none; }
        .driver-details { width: 100%; background-color: var(--details-bg); margin-top: 0; padding: 0 10px; box-sizing: border-box; max-height: 0; opacity: 0; overflow: hidden; border-radius: 4px; color: #bbb; font-size: 0.9em; transition: max-height 0.4s ease-out, opacity 0.3s ease-in, padding-top 0.4s ease-out, padding-bottom 0.4s ease-out, margin-top 0.4s ease-out; }
        .driver-details p { margin: 5px 0; line-height: 1.4; }
        .driver-details strong { color: #ddd; }
        .driver-details a { color: var(--panel-link-color); text-decoration: none; }
        .driver-details a:hover { text-decoration: underline; }
        .custom-driver-item.details-visible .driver-details { max-height: 520px; opacity: 1; padding-top: 8px; padding-bottom: 8px; margin-top: 6px; }
        .driver-details-shell { display: flex; flex-direction: column; gap: 8px; }
        .driver-details-topline { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
        .driver-identity, .driver-status-wrap { display: flex; flex-direction: column; gap: 2px; }
        .driver-identity { flex: 1 1 220px; min-width: 0; }
        .driver-status-wrap { margin-left: auto; align-items: flex-end; min-width: 96px; }
        .driver-identity-label { font-size: 0.72em; letter-spacing: 0.06em; text-transform: uppercase; color: #9ca4ad; font-weight: 700; }
        .driver-identity-value { color: var(--text-color); font-weight: 600; line-height: 1.3; }
        .driver-status-chip { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; background: rgba(0, 0, 0, 0.24); border: 1px solid var(--border-color); color: var(--text-color); font-weight: 700; text-transform: capitalize; }
        .custom-driver-item.status-ready .driver-status-chip { background: rgba(144, 164, 174, 0.18); border-color: rgba(144, 164, 174, 0.45); color: #cfd8dc; }
        .custom-driver-item.status-racing .driver-status-chip { background: rgba(116, 192, 252, 0.16); border-color: rgba(116, 192, 252, 0.45); color: #cfe8ff; }
        .custom-driver-item.status-finished .driver-status-chip { background: rgba(129, 199, 132, 0.18); border-color: rgba(129, 199, 132, 0.45); color: #d7f4db; }
        .custom-driver-item.status-crashed .driver-status-chip { background: rgba(229, 115, 115, 0.2); border-color: rgba(229, 115, 115, 0.45); color: #ffd9d9; }
        .detail-original-status { color: #9ca4ad; font-size: 0.85em; }
        .detail-original-status:empty { display: none; }
        .driver-meta-row { display: grid; grid-template-columns: auto 1fr; align-items: baseline; column-gap: 8px; }
        .driver-metrics-grid, .driver-api-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 7px; }
        .driver-metric-item, .driver-api-item { border: 1px solid var(--border-color); border-radius: 6px; background: rgba(0, 0, 0, 0.16); padding: 5px 7px; min-height: 42px; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
        .driver-metric-label, .driver-api-label { font-size: 0.72em; color: #9ca4ad; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 700; }
        .driver-metric-value, .driver-api-value { color: var(--text-color); font-weight: 700; line-height: 1.25; }
        .driver-metric-value .metric-unit { color: #9ca4ad; font-weight: 500; }
        .driver-metric-item.metric-est-lap { grid-column: 1 / -1; }
        .api-stats-container { margin-top: 0; padding-top: 0; border-top: none; }
        .driver-section-title { font-size: 0.72em; letter-spacing: 0.06em; text-transform: uppercase; color: #9ca4ad; font-weight: 700; margin-bottom: 6px; }
        .api-stats-container.loading .api-stat { color: var(--api-loading-color); font-style: italic; }
        .api-stats-container.error .api-stat-error-msg, .api-stats-container.no-key .api-stat-error-msg { color: var(--api-error-color); display: block; font-style: italic; }
        .api-stats-container.no-key .api-stat-error-msg { color: var(--api-info-color); }
        .api-stat-error-msg { display: none; margin-top: 6px; }
        .api-stat { font-weight: bold; color: var(--text-color); }
        .driver-details-footer { border-top: 1px dashed var(--border-color); padding-top: 6px; color: #9ca4ad; font-size: 0.78em; }
        #telemetryControlsContainer { margin: 10px 0 5px 0; justify-content: flex-end; gap: 5px; }
        .telemetry-download-button, .telemetry-info-button, .telemetry-history-button, .telemetry-stats-button, .telemetry-settings-button { background: var(--background-light); color: var(--text-color); border: 1px solid var(--border-color); padding: 6px 12px; text-align: center; cursor: pointer; transition: all 0.2s ease; font-size: 13px; border-radius: 4px; display: inline-block; }
        .telemetry-info-button:hover, .telemetry-history-button:hover, .telemetry-stats-button:hover, .telemetry-settings-button:hover, .telemetry-download-button:hover { background-color: var(--panel-hover-bg); color: var(--text-color); }
        .telemetry-history-button:hover { background-color: var(--history-color); color: var(--background-dark); }
        .telemetry-info-button:hover { background-color: var(--info-color); color: var(--background-dark); }
        .telemetry-download-button:hover { background-color: var(--download-color); color: white; }
        .telemetry-download-button { display: none; }
        .settings-popup, .stats-panel, .history-panel, .info-panel, .download-popup { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(3px); }
        .stats-panel, .history-panel, .info-panel, .download-popup { z-index: 1010; scrollbar-width: thin; scrollbar-color: #555 var(--background-dark); }
        .settings-popup-content, .stats-panel-content, .history-panel-content, .info-panel-content, .download-popup-content { background: var(--background-dark); border-radius: 10px; border: 1px solid var(--border-color); width: 90%; max-height: 90vh; overflow-y: auto; padding: 20px; box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3); }
        .settings-popup-content { max-width: 500px; }
        .stats-panel-content { max-width: 800px; }
        .history-panel-content { max-width: 750px; }
        .info-panel-content { max-width: 600px; }
        .download-popup-content { max-width: 450px; }
        .settings-title, .stats-title, .history-title, .info-title, .download-title { font-size: 20px; font-weight: bold; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
        .settings-title { color: var(--primary-color); }
        .stats-title { color: var(--panel-heading-color); }
        .history-title { color: var(--history-color); }
        .info-title { color: var(--info-color); }
        .download-title { color: var(--download-color); }
        .settings-close, .stats-close, .history-close, .info-close, .download-close { background: var(--background-light); color: var(--text-color); border: none; border-radius: 4px; padding: 8px 15px; cursor: pointer; transition: all 0.2s ease; }
        .settings-close:hover, .stats-close:hover, .history-close:hover, .info-close:hover, .download-close:hover { background: var(--panel-hover-bg); color: var(--text-color); }
        .history-panel .panel-actions { display: flex; justify-content: flex-end; margin-top: 15px; padding-top: 10px; border-top: 1px solid var(--border-color); }
        .history-clear-button { background: var(--danger-color); color: white; border: none; border-radius: 4px; padding: 8px 15px; cursor: pointer; transition: background-color 0.2s ease; font-size: 0.9em; }
        .history-clear-button:hover { background: var(--danger-hover-color); }
        .settings-content, .stats-content, .history-content, .info-content, .download-content { padding-top: 10px; }
        .stats-content, .history-content, .info-content, .download-content { font-size: 0.9em; }
        .download-content .download-options { display: flex; flex-direction: column; gap: 15px; }
        .download-content .format-group, .download-content .action-group { display: flex; align-items: center; gap: 10px; }
        .download-content label { font-weight: bold; min-width: 60px; }
        .download-content select { padding: 8px; background: var(--background-light); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-color); flex-grow: 1; }
        .download-content button { background: var(--background-light); color: var(--text-color); border: 1px solid var(--border-color); padding: 8px 15px; border-radius: 4px; cursor: pointer; transition: all 0.2s ease; }
        .download-content button:hover { background: var(--panel-hover-bg); color: var(--text-color); }
        .download-content button.primary { background: var(--download-color); color: white; }
        .download-content button.primary:hover { background: #7B1FA2; }
        .info-content h3 { color: var(--primary-color); margin-top: 20px; margin-bottom: 10px; font-size: 1.1em; }
        .info-content p, .info-content ul { margin-bottom: 10px; line-height: 1.5; color: var(--text-color); }
        .info-content ul { list-style: disc; padding-left: 25px; }
        .info-content li { margin-bottom: 5px; }
        .settings-content a, .stats-content a, .history-content a, .info-content a, .download-content a, .api-tos-container a { color: var(--panel-link-color); }
        .settings-content a:hover, .stats-content a:hover, .history-content a:hover, .info-content a:hover, .download-content a:hover, .api-tos-container a:hover { text-decoration: underline; }
        .stats-content h3, .history-content h3 { color: var(--primary-color); margin-top: 20px; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px dashed var(--border-color); font-size: 1.2em; }
        .stats-content h3:first-child, .history-content h3:first-child { margin-top: 0; }
        .stats-content h4 { color: var(--panel-heading-color); margin-top: 15px; margin-bottom: 8px; font-size: 1.1em; }
        .stats-content h4.track-analysis-subheading { color: var(--primary-color); }
        .stats-content p { margin: 5px 0 10px 0; line-height: 1.5; color: #ccc; }
        .stats-content strong { color: var(--text-color); }
        .stats-content .loading-msg, .stats-content .error-msg, .stats-content .info-msg { padding: 10px; border-radius: 4px; margin: 15px 0; text-align: center; }
        .history-content .loading-msg, .history-content .error-msg, .history-content .info-msg { padding: 10px; border-radius: 4px; margin: 15px 0; text-align: center; }
        .stats-content .loading-msg { background-color: rgba(170, 170, 170, 0.2); color: var(--api-loading-color); }
        .stats-content .error-msg { background-color: rgba(255, 138, 128, 0.2); color: var(--api-error-color); }
        .stats-content .info-msg { background-color: rgba(100, 181, 246, 0.2); color: var(--api-info-color); }
        .history-content .loading-msg { background-color: rgba(170, 170, 170, 0.2); color: var(--api-loading-color); }
        .history-content .error-msg { background-color: rgba(255, 138, 128, 0.2); color: var(--api-error-color); }
        .history-content .info-msg { background-color: rgba(100, 181, 246, 0.2); color: var(--api-info-color); }
        .stats-content table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; font-size: 0.95em; }
        .stats-content th, .stats-content td { border: 1px solid var(--border-color); padding: 6px 8px; text-align: left; }
        .stats-content th { background-color: var(--table-header-bg); font-weight: bold; color: var(--text-color); }
        .stats-content tr:nth-child(even) { background-color: var(--table-row-alt-bg); }
        .stats-content td.numeric, .stats-content th.numeric { text-align: right; }
        .stats-content .stat-label { color: #bbb; }
        .stats-content .stat-value { font-weight: bold; color: var(--text-color); }
        .stats-content .car-stats-inline { font-size: 0.8em; color: #aaa; }
        .stats-content .car-stats-inline strong { color: #bbb; }
        .stats-content .user-car-highlight { background-color: rgba(76, 175, 80, 0.15); }
        .stats-content a { text-decoration: none; }
        .stats-content a:hover { text-decoration: underline; }
        .stats-content td { color: var(--text-color); padding: 2px !important; }
        .stats-summary-cards, .stats-delta-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
        .stats-summary-card { border: 1px solid var(--border-color); border-radius: 6px; background: var(--background-light); padding: 10px; }
        .stats-summary-label { font-size: 0.78em; color: #aaa; text-transform: uppercase; letter-spacing: 0.04em; }
        .stats-summary-value { margin-top: 4px; font-size: 1.05em; font-weight: 700; color: var(--text-color); }
        .stats-summary-value.positive { color: #81C784; }
        .stats-summary-value.negative { color: #E57373; }
        .history-content table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.95em; }
        .history-content th, .history-content td { border: 1px solid var(--border-color); padding: 5px 8px; text-align: left; color: var(--text-color); }
        .history-content th { background-color: var(--table-header-bg); font-weight: bold; }
        .history-content tr:nth-child(even) { background-color: var(--table-row-alt-bg); }
        .history-content td.numeric, .history-content th.numeric { text-align: right; }
        .history-content .no-history-msg { padding: 15px; text-align: center; color: #aaa; font-style: italic; }
        .history-content .change-indicator { margin-left: 5px; font-weight: bold; font-size: 0.9em; }
        .history-content .change-positive { color: #81C784; }
        .history-content .change-negative { color: #E57373; }
        .history-content .change-neutral { color: #90A4AE; }
        .history-summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
        .history-summary-card { border: 1px solid var(--border-color); border-radius: 6px; background: var(--background-light); padding: 10px; }
        .history-summary-label { font-size: 0.8em; color: #aaa; text-transform: uppercase; letter-spacing: 0.04em; }
        .history-summary-value { margin-top: 4px; font-size: 1.1em; font-weight: 700; color: var(--text-color); }
        .history-summary-value.positive { color: #81C784; }
        .history-summary-value.negative { color: #E57373; }
        .history-race-timeline { list-style: none; padding: 0; margin: 10px 0 18px 0; display: flex; flex-direction: column; gap: 8px; }
        .history-race-item { border: 1px solid var(--border-color); border-radius: 6px; background: var(--background-light); padding: 8px 10px; }
        .history-race-item.win { border-left: 4px solid #81C784; }
        .history-race-item.crash { border-left: 4px solid #E57373; }
        .history-race-main { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 4px; }
        .history-race-track { font-weight: 600; color: var(--text-color); }
        .history-race-result { font-weight: 600; color: #ccc; }
        .history-race-skill { margin-left: auto; font-weight: 700; color: #bbb; }
        .history-race-skill.positive { color: #81C784; }
        .history-race-skill.negative { color: #E57373; }
        .history-race-meta { font-size: 0.85em; color: #9ca4ad; }
        .history-sort-btn, .stats-sort-btn { background: transparent; border: none; color: inherit; font: inherit; cursor: pointer; padding: 0; text-decoration: none; }
        .history-sort-btn:hover, .stats-sort-btn:hover { text-decoration: underline; }
        .settings-item { margin-bottom: 15px; display: flex; flex-direction: column; }
        .settings-item label:not(.switch) { margin-bottom: 8px; color: var(--text-color); font-weight: bold; display: block; }
        .settings-item .telemetry-options-group { display: flex; flex-direction: column; gap: 10px; margin-top: 5px; border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; background: var(--background-light); }
        .settings-item .telemetry-options-group .toggle-container { margin-bottom: 0; }
        .settings-item select, .settings-item input[type=number], .settings-item input[type=text], .settings-item input[type=password] { padding: 8px; background: var(--background-light); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-color); width: 100%; box-sizing: border-box; }
        .settings-item input[type=password] { font-family: monospace; }
        .toggle-container { padding: 0; display: flex; align-items: center; justify-content: space-between; background: none; border: none; }
        .toggle-container label:first-child { margin-bottom: 0; }
        .settings-buttons { display: flex; justify-content: space-between; margin-top: 25px; padding-top: 15px; border-top: 1px solid var(--border-color); gap: 10px; flex-wrap: wrap; }
        .settings-btn { padding: 10px 15px; border-radius: 4px; border: none; cursor: pointer; background: var(--background-light); color: var(--text-color); transition: all 0.2s ease; flex-grow: 1; }
        .settings-btn:hover { background: var(--panel-hover-bg); color: var(--text-color); }
        .settings-btn.primary { background: var(--primary-color); color: white; }
        .settings-btn.primary:hover { background: #388E3C; }
        .settings-btn.danger { background-color: var(--danger-color); color: white; }
        .settings-btn.danger:hover { background-color: var(--danger-hover-color); }
        .settings-data-buttons { display: flex; gap: 10px; width: 100%; margin-top: 10px; }
        .switch { position: relative; display: inline-block; width: 45px; height: 24px; flex-shrink: 0; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; inset: 0; background-color: #4d4d4d; transition: .3s; border-radius: 12px; }
        .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 2px; background-color: #f4f4f4; transition: .3s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--primary-color); }
        input:checked + .slider:before { transform: translateX(21px); }
        .api-tos-container { margin-top: 10px; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 0.85em; color: #ccc; line-height: 1.4; border: 1px solid var(--border-color); }
        .api-tos-container p { margin: 0 0 8px 0; }
        .api-tos-container details { margin-top: 10px; }
        .api-tos-container summary { cursor: pointer; font-weight: bold; color: var(--text-color); }
        .api-tos-container table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.95em; }
        .api-tos-container th, .api-tos-container td { border: 1px solid var(--border-color); padding: 5px; text-align: left; vertical-align: top; }
        .api-tos-container th { background-color: var(--table-header-bg); }
        .api-tos-container td { color: var(--text-color); }
        .api-tos-container code { background: var(--background-light); padding: 2px 4px; border-radius: 3px; font-family: monospace; }
        .color-1 { background-color: #DC143C; } .color-2 { background-color: #4682B4; } .color-3 { background-color: #32CD32; } .color-4 { background-color: #FFD700; } .color-5 { background-color: #FF8C00; } .color-6 { background-color: #9932CC; } .color-7 { background-color: #00CED1; } .color-8 { background-color: #FF1493; } .color-9 { background-color: #8B4513; } .color-10 { background-color: #7FFF00; } .color-11 { background-color: #00FA9A; } .color-12 { background-color: #D2691E; } .color-13 { background-color: #6495ED; } .color-14 { background-color: #F08080; } .color-15 { background-color: #20B2AA; } .color-16 { background-color: #B0C4DE; } .color-17 { background-color: #DA70D6; } .color-18 { background-color: #FF6347; } .color-19 { background-color: #40E0D0; } .color-20 { background-color: #C71585; } .color-21 { background-color: #6A5ACD; } .color-22 { background-color: #FA8072; } .color-default { background-color: #666; }
        @media (max-width: 768px) { .custom-driver-item { padding: 5px; } .driver-info-row { margin-bottom: 4px; } .driver-name { min-width: 80px; } .driver-telemetry-display { font-size: 0.8em; min-width: 60px; margin-left: 5px; } .driver-telemetry-display .telemetry-column { min-width: 70px; } .driver-progress-bars { margin: 3px -5px -5px; } .custom-driver-item.map-selected .driver-progress-bars { margin-left: -2px; } .driver-details { font-size: 0.85em; } #custom-driver-list-container { max-height: 350px; } .telemetry-download-button, .telemetry-info-button, .telemetry-history-button, .telemetry-stats-button, .telemetry-settings-button { font-size: 12px; padding: 5px 10px; } .settings-popup-content, .stats-panel-content, .history-panel-content, .info-panel-content, .download-popup-content { width: 95%; padding: 15px; } .settings-title, .stats-title, .history-title, .info-title, .download-title { font-size: 18px; } .settings-btn { padding: 8px 12px; font-size: 14px; } .custom-driver-item.details-visible .driver-details { max-height: 500px; } .driver-metrics-grid, .driver-api-grid { grid-template-columns: 1fr 1fr; } .driver-status-wrap { margin-left: 0; align-items: flex-start; min-width: 0; } .stats-content table { font-size: 0.9em; } .stats-content th, .stats-content td { padding: 4px 6px; } .history-content table { font-size: 0.9em; } .history-content th, .history-content td { padding: 4px 6px; } }
        @media (max-width: 480px) { .driver-name { min-width: 60px; } .driver-telemetry-display { min-width: 55px; font-size: 0.75em; } .driver-metrics-grid, .driver-api-grid { grid-template-columns: 1fr 1fr; } .driver-meta-row { grid-template-columns: 1fr; row-gap: 2px; } .stats-content table { font-size: 0.85em; } .stats-content th, .stats-content td { padding: 3px 4px; } .history-content table { font-size: 0.85em; } .history-content th, .history-content td { padding: 3px 4px; } .settings-buttons { flex-direction: column; } .settings-data-buttons { flex-direction: column; } }
        @media (max-width: 400px) { .driver-metrics-grid, .driver-api-grid { grid-template-columns: 1fr; } }
    `;

    function toggleDetails(event) { const driverItem = event.target.closest('.custom-driver-item'); if (!driverItem || State.isUpdating) return; const detailsToggle = event.target.closest('.driver-details-toggle'); if (!detailsToggle) { if (!event.target.closest('.driver-details') && event.target.tagName !== 'A') RaceManager.selectDriverOnMap(driverItem.dataset.originalId); return; } const driverId = driverItem.dataset.userId; const isOpening = !driverItem.classList.contains('details-visible'); driverItem.classList.toggle('details-visible'); const position = Array.from(driverItem.parentNode.children).indexOf(driverItem) + 1; const driverData = RaceManager.parseDriverData(document.getElementById(driverItem.dataset.originalId)); if (driverData) { RaceManager.updateDriverElement(driverItem, driverData, position); } if (isOpening && Config.get('fetchApiStatsOnClick') && driverId && !driverItem.hasAttribute('data-stats-loaded') && !APIManager.isFetching.has(driverId)) { setTimeout(() => APIManager.fetchAndDisplayRacingStats(driverItem, driverId), 50); } }

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
