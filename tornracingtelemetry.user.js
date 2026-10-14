// ==UserScript==
// @name         Torn Racing Telemetry
// @namespace    https://www.torn.com/profiles.php?XID=2782979
// @version      4.0.0
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
        version: '4.0.0',
        author: "TheProgrammer",
        contactId: "2782979",
        contactUrl: function() { return `https://www.torn.com/profiles.php?XID=${this.contactId}`; },
        description: "Provides enhanced telemetry, stats analysis, historical tracking, and race results export for Torn Racing.",
        notes: [
            "v4.0.0: Redesigned racing tabs and driver details, integrated live map and car controls, and improved telemetry, exports, settings validation and API errors.",
            "v3.5.5: Removed tap/hover tooltips from the + / − driver-details control and progress bars. Fixed stale telemetry carrying into new races, improved reliability when Torn loads race data late, hid live progress bars for finished drivers, kept API keys out of request URLs, and enabled Speed, Accel, and progress bars by default for new installs.",
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
            telemetryDisplayOptions: ['speed', 'acceleration', 'progress'],
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
        escapeHTML(value) {
            return String(value ?? '').replace(/[&<>"']/g, character => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[character]);
        },
        escapeMarkdownCell(value) {
            return String(value ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
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

            const createStat = className => {
                const stat = document.createElement('span');
                stat.className = `telemetry-stat ${className}`;
                const valueSpan = document.createElement('span');
                valueSpan.className = 'telemetry-stat-value';
                stat.append(valueSpan);
                return { stat, value: valueSpan };
            };

            const statsWrap = document.createElement('span');
            statsWrap.className = 'telemetry-value telemetry-stats';
            const performanceColumn = document.createElement('span');
            performanceColumn.className = 'telemetry-column telemetry-performance';
            const raceColumn = document.createElement('span');
            raceColumn.className = 'telemetry-column telemetry-race';
            const speed = createStat('telemetry-speed');
            const acceleration = createStat('telemetry-acceleration');
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
            const speed = parts.find(part => /\s(?:mph|km\/?h)$/i.test(part));
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

            const progressChangedSinceSample = Math.abs(progressPercentage - prev.lastProgressValueAtChange) > 0.001;
            // Delayed *new* progress is still usable: calculate over the full elapsed
            // interval. Only decay an estimate when no new race progress has arrived.
            if (dtSinceLastUpdate * 1000 > staleThresholdMs && !progressChangedSinceSample) {
                const decay = Math.exp(-Math.min(dtSinceLastUpdate, 30) / 3);
                prev.reportedSpeed = Math.max(0, prev.reportedSpeed * decay);
                prev.acceleration = 0; // Unknown, not a physical braking event.
                prev.time = timestamp;
                prev.wasStale = true;
                return { speed: prev.reportedSpeed, acceleration: 0, timeDelta: dtSinceLastUpdate * 1000, noUpdate: true };
            }

            if (dtSinceLastUpdate < minDt) {
                 return { speed: prev.reportedSpeed, acceleration: prev.acceleration, timeDelta: dtSinceLastUpdate * 1000, noUpdate: true };
            }

            let currentSpeed = prev.reportedSpeed;
            let calculatedSpeedThisTick = false;
            const epsilon = 0.001;
            const progressChanged = Math.abs(progressPercentage - prev.lastProgressValueAtChange) > epsilon;
            let distanceDelta = 0;

            if (progressPercentage + epsilon < prev.lastProgressValueAtChange) {
                delete State.previousMetrics[driverId];
                return this.calculateDriverMetrics(driverId, progressPercentage, timestamp);
            }
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
        // One accessible, small-screen-first navigation system across all telemetry panels.
        // Sections are real DOM nodes: existing controls, sortable tables and listeners survive tab switches.
        buildPanelSections(sections, defaultKey) {
            const root = Utils.createElement('div', { className: 'rtt-panel-workspace' });
            const nav = Utils.createElement('div', { className: 'rtt-panel-navigation' });
            nav.setAttribute('role', 'tablist');
            const body = Utils.createElement('div', { className: 'rtt-panel-viewports' });
            const entries = [];
            for (const section of sections) {
                const tab = Utils.createElement('button', { className: 'rtt-panel-nav-button', text: section.title });
                tab.type = 'button';
                tab.id = `rtt-tab-${section.key}-${this.panelNonce = (this.panelNonce || 0) + 1}`;
                tab.setAttribute('role', 'tab');
                tab.dataset.section = section.key;
                const viewport = Utils.createElement('section', { className: 'rtt-panel-section' });
                viewport.setAttribute('role', 'tabpanel');
                viewport.setAttribute('aria-labelledby', tab.id);
                viewport.append(section.content);
                tab.addEventListener('click', () => activate(section.key));
                tab.addEventListener('keydown', event => {
                    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                    event.preventDefault();
                    const index = entries.findIndex(entry => entry.key === section.key);
                    const next = entries[(index + (event.key === 'ArrowRight' ? 1 : -1) + entries.length) % entries.length];
                    activate(next.key);
                    next.tab.focus();
                });
                entries.push({ key: section.key, tab, viewport });
                nav.append(tab);
                body.append(viewport);
            }
            function activate(key) {
                for (const entry of entries) {
                    const active = entry.key === key;
                    entry.tab.setAttribute('aria-selected', String(active));
                    entry.tab.tabIndex = active ? 0 : -1;
                    entry.viewport.hidden = !active;
                }
            }
            activate(defaultKey || sections[0]?.key);
            root.append(nav, body);
            return root;
        },
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
            telemetryGroup.appendChild(createToggleControl('telemetryShowProgress', 'Show Progress Bars'));
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
                Utils.createElement('button', { className: 'settings-btn primary', attrs: { id: 'saveSettings' }, text: 'Save' })
            );
            settingsContent.appendChild(settingsButtons);

            const dataButtons = Utils.createElement('div', { className: 'settings-data-buttons' });
            dataButtons.append(
                Utils.createElement('button', { className: 'settings-btn danger', attrs: { id: 'clearData' }, text: 'Clear Script Data' }),
                Utils.createElement('button', { className: 'settings-btn danger', attrs: { id: 'clearApiKey' }, text: 'Clear API Key' })
            );
            settingsContent.appendChild(dataButtons);

            // Group existing settings rather than duplicating inputs or their event listeners.
            const settingsTabs = [
                { key: 'display', title: 'Display', ids: ['historyEnabled', 'statsPanelEnabled', 'hideOriginalList', 'telemetryShowSpeed', 'speedUnit', 'colorCode', 'animateChanges', 'showLapEstimate'] },
                { key: 'tuning', title: 'Tuning', ids: ['speedSmoothingFactor', 'maxAnimationDurationMs', 'lapEstimateSmoothingFactor'] },
                { key: 'data', title: 'API & Data', ids: ['fetchApiStatsOnClick', 'apiKey', 'historicalRaceLimit'] }
            ];
            const groups = settingsTabs.map(spec => ({
                key: spec.key, title: spec.title,
                content: Utils.createElement('div', { className: 'rtt-settings-group' })
            }));
            for (const section of settingsTabs) {
                for (const id of section.ids) {
                    const control = settingsContent.querySelector(`#${id}`);
                    const item = control?.closest('.settings-item');
                    if (item) groups.find(group => group.key === section.key).content.append(item);
                }
            }
            const dataGroup = groups.find(group => group.key === 'data');
            dataGroup.content.append(tosContainer, dataButtons);
            settingsContent.replaceChildren(this.buildPanelSections(groups, 'display'));
            settingsButtons.classList.add('rtt-panel-footer-actions');
            content.append(titleRow, settingsContent, settingsButtons);

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
                if (State.settingsPopupInstance === popup) State.settingsPopupInstance = null;
            };

            content.querySelector('.settings-close').addEventListener('click', closePopup);
            popup.addEventListener('click', e => { if (e.target === popup && !popup.classList.contains('rtt-inline-tab-content')) closePopup(); });
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
                // Validate every field before writing any settings.
                const numericFields = [
                    ['speedSmoothingFactor', 'Speed smoothing factor', 0.1, 0.9, false],
                    ['maxAnimationDurationMs', 'Max animation duration', 100, 3000, true],
                    ['lapEstimateSmoothingFactor', 'Lap estimate smoothing', 0.01, 1, false],
                    ['historicalRaceLimit', 'Race limit', 10, 1000, true]
                ];
                const values = {};
                for (const [id, label, min, max, integer] of numericFields) {
                    const input = content.querySelector(`#${id}`);
                    const raw = input.value.trim();
                    const value = Number(raw);
                    if (!raw || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
                        Utils.showNotification(`${label} must be ${integer ? 'a whole number' : 'a number'} between ${min} and ${max}.`, 'error');
                        input.focus();
                        return;
                    }
                    values[id] = value;
                }
                const apiKeyInput = content.querySelector('#apiKey');
                const apiKey = apiKeyInput.value.trim();
                if (apiKey && apiKey.length < 16 && apiKey !== '###PDA-APIKEY###') {
                    Utils.showNotification('API key seems too short. Settings were not saved.', 'error');
                    apiKeyInput.focus();
                    return;
                }
                const speedUnit = content.querySelector('#speedUnit').value;
                if (!['mph', 'kmh'].includes(speedUnit)) {
                    Utils.showNotification('Choose mph or km/h. Settings were not saved.', 'error');
                    content.querySelector('#speedUnit').focus();
                    return;
                }
                values.telemetryDisplayOptions = [
                    ['telemetryShowSpeed', 'speed'],
                    ['telemetryShowAcceleration', 'acceleration'],
                    ['telemetryShowProgress', 'progress']
                ].filter(([id]) => content.querySelector(`#${id}`).checked).map(([, option]) => option);
                for (const id of ['historyEnabled', 'statsPanelEnabled', 'colorCode', 'animateChanges', 'showLapEstimate', 'fetchApiStatsOnClick']) {
                    values[id] = content.querySelector(`#${id}`).checked;
                }
                values.speedUnit = speedUnit;
                values.apiKey = apiKey;
                for (const [key, value] of Object.entries(values)) Config.set(key, value);
                if (typeof TabWorkspace !== 'undefined') TabWorkspace.invalidateRaceBoundViews();
                Utils.showNotification('Settings saved!', 'success');
                closePopup();
                if (typeof TabWorkspace !== 'undefined') TabWorkspace.restoreAfterAction('settings');
                UI.updateControlButtonsVisibility();

                RaceManager.stableUpdateCustomList();
            });

            content.querySelector('#clearData').addEventListener('click', async () => {
                if (confirm('Are you sure you want to clear all script settings (except API key)? This cannot be undone.')) {
                    await Config.clearData();
                    Utils.showNotification('Script data cleared!', 'success');
                    closePopup();
                    if (typeof TabWorkspace !== 'undefined') TabWorkspace.restoreAfterAction('settings');
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
            const winRate = races.length ? (wins / races.length) * 100 : null;
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
                if (State.advancedStatsPanelInstance === popup) State.advancedStatsPanelInstance = null;
            };

            content.querySelector('.stats-close').addEventListener('click', closePanel);
            popup.addEventListener('click', e => { if (e.target === popup && !popup.classList.contains('rtt-inline-tab-content')) closePanel(); });
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
                finalFragment.appendChild(this.buildPanelSections([
                    { key: 'performance', title: 'Performance', content: historicalStatsContent || this.createPanelMessage('info-msg', 'No historical statistics available.') },
                    { key: 'track', title: 'Track & Car', content: trackAnalysisContent || this.createPanelMessage('info-msg', 'No track analysis available.') }
                ], 'performance'));
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
                if (Number.isInteger(currentUserCar.id)) carNameParagraph.append(` · Item #${currentUserCar.id}`);
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
                if (Number.isInteger(currentUserCar.id)) fallbackParagraph.append(` · Item #${currentUserCar.id}`);
                fallbackParagraph.append(' — ');
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
                const imgEl = carDiv.querySelector('.model .img img.torn-item, .model .img img, .model-wrap img');
                const name = nameEl ? nameEl.textContent.trim() : 'Unknown Car';
                let id = null;

                const fallbackImg = document.querySelector('#leaderBoard li.selected .car img')
                    || [...document.querySelectorAll('#leaderBoard li .car img')].find(img => img.title === name);
                for (const image of [imgEl, fallbackImg]) {
                    const src = image?.getAttribute('src') || image?.src || '';
                    const idMatch = src.match(/\/(?:items)\/(\d+)(?:\/|$)/);
                    if (idMatch) { id = Number(idMatch[1]); break; }
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

            const numberOrNull = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
            const endTimestampSec = numberOrNull(userResult.time_ended ?? race.schedule?.end ?? race.schedule?.start);
            const endTimestampMs = endTimestampSec !== null && endTimestampSec > 0 ? endTimestampSec * 1000 : null;
            const position = numberOrNull(userResult.position);
            const crashed = userResult.has_crashed === true;
            const raceTime = numberOrNull(userResult.race_time);
            const bestLap = numberOrNull(userResult.best_lap_time);
            const participants = race.participants?.current ?? race.results.length ?? null;
            const skillGain = numberOrNull(race.skill_gain);
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
                if (State.historyPanelInstance === popup) State.historyPanelInstance = null;
            };
            content.querySelector('.history-close').addEventListener('click', closePanel);
            popup.addEventListener('click', e => { if (e.target === popup && !popup.classList.contains('rtt-inline-tab-content')) closePanel(); });

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

            const historyOverview = document.createDocumentFragment();
            historyOverview.append(this.createHistoryDeltaCards(raceEntries), this.createHistoryRaceTimeline(raceEntries));
            const historyRaces = this.createSortableHistoryRacesTable(raceEntries);
            historyFragment.appendChild(this.buildPanelSections([
                { key: 'overview', title: 'Overview', content: historyOverview },
                { key: 'races', title: 'All races', content: historyRaces }
            ], 'overview'));

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
                    <details class="rtt-info-notes"><summary>Release notes &amp; technical details</summary><ul>${notesHTML}</ul></details>
                </div>`;

            const closePanel = () => {
                popup.remove();
                if (State.infoPanelInstance === popup) State.infoPanelInstance = null;
            };

            content.querySelector('.info-close').addEventListener('click', closePanel);
            popup.addEventListener('click', e => { if (e.target === popup && !popup.classList.contains('rtt-inline-tab-content')) closePanel(); });
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
                if (State.downloadPopupInstance === popup) State.downloadPopupInstance = null;
            };

            content.querySelector('.download-close').addEventListener('click', closePopup);
            popup.addEventListener('click', e => { if (e.target === popup && !popup.classList.contains('rtt-inline-tab-content')) closePopup(); });

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
                        await DataExporter.copyToClipboard(dataString);
                        Utils.showNotification('Copied to clipboard!', 'success');
                    }
                    closePopup();
                    if (typeof TabWorkspace !== 'undefined') TabWorkspace.restoreAfterAction('export');
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
            if (typeof RaceInfoIntegration !== 'undefined') RaceInfoIntegration.sync();
            if (typeof TabWorkspace !== 'undefined') TabWorkspace.refreshVisibility();
        },
        initializeControls() {
            if (!State.controlsContainer) return;
            State.controlsContainer.innerHTML = '';

            const carButton = document.createElement('button');
            carButton.className = 'telemetry-car-button';
            carButton.textContent = 'Car';
            carButton.title = 'View your current car and race actions';
            carButton.type = 'button';
            carButton.style.display = 'none';
            carButton.addEventListener('click', () => { TabWorkspace.activate('car'); });
            State.controlsContainer.appendChild(carButton);

            const infoButton = document.createElement('button');
            infoButton.className = 'telemetry-info-button';
            infoButton.textContent = 'Info';
            infoButton.title = 'View Script Information';
            infoButton.addEventListener('click', () => { TabWorkspace.activate('info'); });
            State.controlsContainer.appendChild(infoButton);

            const historyButton = document.createElement('button');
            historyButton.className = 'telemetry-history-button';
            historyButton.textContent = 'History';
            historyButton.title = 'View Your Racing Stats History';
            historyButton.style.display = 'none';
            historyButton.addEventListener('click', () => { TabWorkspace.activate('history'); });
            State.controlsContainer.appendChild(historyButton);

            const statsButton = document.createElement('button');
            statsButton.className = 'telemetry-stats-button';
            statsButton.textContent = 'Stats';
            statsButton.title = 'Open Advanced Race Statistics';
            statsButton.style.display = 'none';
            statsButton.addEventListener('click', () => { TabWorkspace.activate('stats'); });
            State.controlsContainer.appendChild(statsButton);

            const downloadButton = document.createElement('button');
            downloadButton.className = 'telemetry-download-button';
            downloadButton.textContent = 'Export';
            downloadButton.title = 'Export Race Results';
            downloadButton.style.display = 'none';
            downloadButton.addEventListener('click', () => { TabWorkspace.activate('export'); });
            State.controlsContainer.appendChild(downloadButton);

            const settingsButton = document.createElement('button');
            settingsButton.className = 'telemetry-settings-button';
            settingsButton.textContent = 'Settings';
            settingsButton.title = 'Open Telemetry & UI Settings';
            settingsButton.addEventListener('click', () => { TabWorkspace.activate('settings'); });
            State.controlsContainer.appendChild(settingsButton);

            this.updateControlButtonsVisibility();
            document.body.classList.toggle('telemetry-hidden', !Config.get('telemetryVisible'));
        }
    };

    const APIManager = {
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
            let data;
            try {
                data = await response.json();
            } catch (cause) {
                if (!response.ok) throw this.createApiError(response);
                throw new Error('Torn API returned invalid JSON.', { cause });
            }
            if (!response.ok) throw this.createApiError(response, data);
            if (data?.error) throw this.createApiError(response, data.error);
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('Torn API returned an invalid response: expected a JSON object.');
            }
            return data;
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
                const url = new URL(urlLike, base);
                // Never forward a user's API key to a host supplied in pagination metadata.
                if (url.protocol !== 'https:' || url.hostname !== 'api.torn.com' || url.port || !url.pathname.startsWith('/v2/')) return null;
                return url.toString();
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

                const knownRaceIds = new Set(allRaces.map(race => String(race.id)));
                for (const race of pageRaces) {
                    const id = String(race.id);
                    if (knownRaceIds.has(id)) continue;
                    allRaces.push(race);
                    knownRaceIds.add(id);
                }
                if (allRaces.length >= boundedLimit) break;

                // The previous-page link is not a forward-pagination fallback.
                nextUrl = this.normalizeApiUrl(data?._metadata?.links?.next);
                if (!nextUrl || pageRaces.every(race => !race?.id)) break;
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
        installRetryTimer: null,
        installAttempts: 0,

        install() {
            if (this.installed) return;
            const $ = window.jQuery || window.$;
            if (!$?.fn?.jquery) {
                if (!this.installRetryTimer && this.installAttempts < 40) {
                    this.installAttempts += 1;
                    this.installRetryTimer = setTimeout(() => {
                        this.installRetryTimer = null;
                        this.install();
                    }, 250);
                }
                return;
            }

            this.installed = true;
            this.installAttempts = 0;

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
                    const gain = race?.skill_gain == null ? NaN : Number(race.skill_gain);
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
                    position: Number.isFinite(Number(apiResult.position)) && apiResult.position != null ? Number(apiResult.position) : existing.position,
                    crashed,
                    raceTime: apiResult.race_time != null && Number.isFinite(raceTime) ? raceTime : existing.raceTime,
                    bestLap: !crashed && apiResult.best_lap_time != null && Number.isFinite(bestLap) ? bestLap : existing.bestLap ?? null,
                    displayTime: existing.displayTime || (apiResult.race_time != null && Number.isFinite(raceTime) ? Utils.formatTime(raceTime, true) : null)
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
            if (!intervalsPerLap) return new Map();
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
                let skill = null;
                try { skill = await this.fetchSkill(userId); }
                catch (error) { console.warn('Telemetry Script: racing skill unavailable for a driver:', error.message); }
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
            const url = `https://api.torn.com/v2/user?selections=personalstats&id=${encodeURIComponent(userId)}&cat=racing`;
            const data = await APIManager.fetchWithAuthHeader(url, apiKey);
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
                    const position = Number(userResult.position);
                    if (!Number.isInteger(position) || position < 1) return;
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
                // A crashed entry still counts as a race entered, including for win rate.
                stats.winRate = stats.races > 0 ? (stats.wins / stats.races) * 100 : 0;
                stats.podiumRate = stats.races > 0 ? (stats.podiums / stats.races) * 100 : 0;
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
            const esc = Utils.escapeHTML;
            let tableRows = data.results.map(r => `
                <tr>
                    <td>${r.position}</td>
                    <td><a href="https://www.torn.com/profiles.php?XID=${encodeURIComponent(r.userId)}" target="_blank" rel="noopener noreferrer">${esc(r.name)} [${esc(r.userId)}]</a></td>
                    <td>${esc(r.car)}</td>
                    <td>${esc(r.status === 'finished' ? r.finalTimeOrStatus : r.status.toUpperCase())}</td>
                </tr>`).join('');

            return `<!DOCTYPE html>
<html>
<head>
<title>Torn Race Results - ${esc(data.trackInfo.name || 'Unknown Track')}</title>
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
    <h2>Race ID: ${esc(data.raceId || 'N/A')}</h2>
    <h2>Track: ${esc(data.trackInfo.name || 'Unknown')} (${esc(data.trackInfo.laps)} Laps, ${esc(data.trackInfo.length)} Miles)</h2>
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
            const esc = Utils.escapeMarkdownCell;
            let md = `# Race Results\n\n`;
            md += `**Race ID:** ${data.raceId || 'N/A'}\n`;
            md += `**Track:** ${data.trackInfo.name || 'Unknown'} (${data.trackInfo.laps} Laps, ${data.trackInfo.length} Miles)\n\n`;
            md += `| Pos | Driver | Car | Time/Status |\n`;
            md += `|----:|--------|-----|-------------|\n`;
            data.results.forEach(r => {
                const driverLink = `[${esc(r.name)} [${esc(r.userId)}]](https://www.torn.com/profiles.php?XID=${encodeURIComponent(r.userId)})`;
                const status = r.status === 'finished' ? r.finalTimeOrStatus : r.status.toUpperCase();
                md += `| ${r.position} | ${driverLink} | ${esc(r.car)} | ${esc(status)} |\n`;
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
                const bestLapSeconds = result?.bestLap != null && Number.isFinite(result.bestLap) ? result.bestLap : inferredBestLap;
                const bestLap = crashed ? 'crashed' : (result?.bestLap != null && Number.isFinite(result.bestLap)
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
            // Revoking synchronously can abort downloads in WebKit/Torn PDA.
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        },
        async copyToClipboard(text) {
            if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(text);
                return;
            }
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return;
            }
            throw new Error('Clipboard copying is unavailable in this browser or userscript manager.');
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
                detailsButton: element.querySelector('.driver-details-toggle')
            };
            return element._uiRefs;
        },
        createDriverElement(driverData, position) {
            const item = document.createElement('div');
            item.className = 'custom-driver-item';
            item.dataset.originalId = driverData.originalId;
            item.dataset.userId = driverData.userId;
            item.tabIndex = 0;
            item.setAttribute('aria-label', `Select ${driverData.name} on the race map`);

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
                text: '↗',
                attrs: {
                    type: 'button',
                    'aria-label': 'Open driver inspector'
                }
            });

            this.setDriverName(nameDiv, driverData.name, isSelf);
            Telemetry.ensureDisplayRefs(telemetryDiv);

            infoRow.append(colorIndicator, carImg, nameDiv, telemetryDiv, detailsButton);
            item.append(infoRow, progressBars);
            item._uiRefs = { colorIndicator, carImg, nameDiv, telemetryDiv, progressBars, fullProgressBar, lapProgressBar, detailsButton };

            this.updateDriverElement(item, driverData, position);
            return item;
        },
        updateDriverElement(element, driverData, position) {
            const driverId = driverData.userId;
            const isSelf = driverId === State.userId;
            const now = Date.now();
            const driverState = State.previousMetrics[driverId];
            const refs = this.ensureElementRefs(element);

            const mapSelected = document.getElementById(driverData.originalId)?.classList.contains('selected');
            element.className = `custom-driver-item status-${driverData.statusClass} ${isSelf ? 'is-self' : ''} ${mapSelected ? 'map-selected' : ''}`.trim().replace(/\s+/g, ' ');

            if (refs.detailsButton) {
                refs.detailsButton.textContent = '↗';
                refs.detailsButton.setAttribute('aria-label', `Open details for ${driverData.name}`);
                refs.detailsButton.setAttribute('title', 'Open driver inspector');
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
                const speedUnitLabel = speedUnit === 'kmh' ? 'km/h' : speedUnit;

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
                        telemetryText = 'Waiting';
                    }

                    Telemetry.setTelemetryDisplay(telemetryDiv, telemetryText, telemetryColor);
                } else {
                    const metrics = Telemetry.calculateDriverMetrics(driverId, driverData.progress, now);
                    const targetSpeed = Utils.convertSpeed(metrics.speed, speedUnit);
                    const targetAcc = metrics.acceleration;

                    if (Config.get('showLapEstimate') && driverData.progress < 100 && State.trackInfo.length > 0 && State.previousMetrics[driverId]) {
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
                            speedUnitLabel
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
                            parts.push(`${Math.round(targetSpeed)} ${speedUnitLabel}`);
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
                const showLiveProgress = showProgressBars && !['finished', 'crashed'].includes(driverData.statusClass);
                const fullProgress = Math.max(0, Math.min(100, driverData.progress || 0));
                const laps = Math.max(1, Number(State.trackInfo.laps) || 1);
                const progressPerLap = 100 / laps;
                const lapProgress = fullProgress >= 100 ? 100 : ((fullProgress % progressPerLap) / progressPerLap) * 100;
                refs.progressBars.hidden = !showLiveProgress;
                refs.fullProgressBar.style.width = `${fullProgress.toFixed(2)}%`;
                refs.lapProgressBar.style.width = `${Math.max(0, Math.min(100, lapProgress)).toFixed(2)}%`;
                refs.progressBars.removeAttribute('title');
            }

            if (driverState) driverState.statusClass = driverData.statusClass;
        },
        stableUpdateCustomList() {
            if (!Config.get('hideOriginalList')) {
                if (DriverInspector.root) DriverInspector.close(false);
                if (State.isInitialized) {
                    State.resetRaceState();
                }
                return;
            }
            if (State.isUpdating || !State.customUIContainer || !State.originalLeaderboard || !document.body.contains(State.originalLeaderboard)) {
                return;
            }

            State.isUpdating = true;
            try {
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
                    if (typeof TabWorkspace !== 'undefined') TabWorkspace.invalidateRaceBoundViews();
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
                if (DriverInspector.root) DriverInspector.render();

                if (hadFocus && document.body.contains(State.customUIContainer)) {
                    State.customUIContainer.scrollTop = savedScrollTop;
                }
            } finally {
                State.isUpdating = false;
            }
        }
    };

    // One inspector, outside the leaderboard's scrolling area. The existing race rows
    // remain compact and still select a racer on Torn's track when tapped.
    const DriverInspector = {
        root: null,
        panel: null,
        content: null,
        selectedUserId: null,
        selectedOriginalId: null,
        selectedRaceId: null,
        tab: 'race',
        returnFocus: null,
        careerCache: new Map(),
        careerRequests: new Map(),
        resultRequests: new Set(),
        skillGainAttempted: new Set(),
        resultCache: new Map(),
        boundKeydown: null,

        element(tag, className, text) {
            return Utils.createElement(tag, { className, ...(text === undefined ? {} : { text }) });
        },
        open(userId, originalId, trigger = null) {
            if (!userId || !originalId) return;
            const raceId = String(State.currentRaceId || '');
            const newDriver = this.selectedUserId !== String(userId) || this.selectedRaceId !== raceId;
            if (newDriver) this.tab = 'race';
            if (!this.root) this.mount();
            this.returnFocus = trigger || document.activeElement;
            this.selectedUserId = String(userId);
            this.selectedOriginalId = originalId;
            this.selectedRaceId = raceId;
            this.root.hidden = false;
            document.body.classList.add('rtt-inspector-open');
            this.render();
            this.panel.querySelector('.rtt-inspector-close')?.focus();
        },
        close(restoreFocus = true) {
            if (!this.root) return;
            this.root.remove();
            this.root = null;
            this.panel = null;
            this.content = null;
            document.body.classList.remove('rtt-inspector-open');
            document.removeEventListener('keydown', this.boundKeydown);
            this.boundKeydown = null;
            this.selectedUserId = null;
            this.selectedOriginalId = null;
            this.selectedRaceId = null;
            if (restoreFocus && this.returnFocus?.isConnected) this.returnFocus.focus();
            this.returnFocus = null;
        },
        mount() {
            const backdrop = this.element('div', 'rtt-inspector-backdrop');
            const panel = this.element('section', 'rtt-inspector-panel');
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', 'true');
            panel.setAttribute('aria-label', 'Racing driver details');
            panel.setAttribute('tabindex', '-1');

            const grip = this.element('div', 'rtt-inspector-grip');
            grip.setAttribute('aria-hidden', 'true');
            const head = this.element('header', 'rtt-inspector-header');
            const identity = this.element('div', 'rtt-inspector-identity');
            identity.append(this.element('span', 'rtt-inspector-eyebrow', 'DRIVER INSPECTOR'));
            identity.append(this.element('div', 'rtt-inspector-name', 'Driver'));
            identity.append(this.element('p', 'rtt-inspector-subtitle', 'Race data'));
            const expand = this.element('button', 'rtt-inspector-expand', 'Expand');
            expand.type = 'button';
            expand.setAttribute('aria-label', 'Expand driver details');
            expand.setAttribute('aria-expanded', 'false');
            expand.addEventListener('click', () => {
                const isExpanded = panel.classList.toggle('is-expanded');
                expand.textContent = isExpanded ? 'Compact' : 'Expand';
                expand.setAttribute('aria-label', isExpanded ? 'Collapse driver details' : 'Expand driver details');
                expand.setAttribute('aria-expanded', String(isExpanded));
            });
            const close = this.element('button', 'rtt-inspector-close', '×');
            close.type = 'button';
            close.setAttribute('aria-label', 'Close driver details');
            close.addEventListener('click', () => this.close());
            const headerActions = this.element('div', 'rtt-inspector-actions');
            headerActions.append(expand, close);
            head.append(identity, headerActions);

            const tabs = this.element('div', 'rtt-inspector-tabs');
            tabs.setAttribute('role', 'tablist');
            tabs.setAttribute('aria-label', 'Driver details sections');
            for (const [key, title] of [['race', 'Race'], ['telemetry', 'Telemetry'], ['career', 'Career']]) {
                const button = this.element('button', 'rtt-inspector-tab', title);
                button.type = 'button';
                button.dataset.tab = key;
                button.setAttribute('role', 'tab');
                button.addEventListener('click', () => {
                    this.tab = key;
                    this.render();
                });
                tabs.append(button);
            }
            const content = this.element('div', 'rtt-inspector-content');
            content.setAttribute('role', 'tabpanel');
            content.setAttribute('aria-live', 'off');
            const footer = this.element('footer', 'rtt-inspector-footer', 'Calculated values are estimates based on Torn race progress.');
            panel.append(grip, head, tabs, content, footer);
            backdrop.append(panel);
            backdrop.addEventListener('click', event => { if (event.target === backdrop) this.close(); });
            this.boundKeydown = event => {
                if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
                if (event.key !== 'Tab') return;
                const focusable = [...this.panel.querySelectorAll('button:not([disabled]), a[href]')];
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            };
            document.addEventListener('keydown', this.boundKeydown);
            document.body.append(backdrop);
            this.root = backdrop;
            this.panel = panel;
            this.content = content;
        },
        driverData() {
            const row = document.getElementById(this.selectedOriginalId);
            if (!row || !State.originalLeaderboard?.contains(row)) return null;
            return RaceManager.parseDriverData(row);
        },
        metric(label, value, note = '', prominent = false) {
            const card = this.element('div', `rtt-inspector-metric${prominent ? ' is-prominent' : ''}`);
            card.append(this.element('span', 'rtt-inspector-metric-label', label));
            card.append(this.element('strong', 'rtt-inspector-metric-value', String(value)));
            if (note) card.append(this.element('span', 'rtt-inspector-metric-note', note));
            return card;
        },
        info(text) { return this.element('p', 'rtt-inspector-info', text); },
        grid(items) {
            const grid = this.element('div', 'rtt-inspector-grid');
            grid.append(...items);
            return grid;
        },
        progress(label, percent) {
            const wrapper = this.element('div', 'rtt-inspector-progress');
            const heading = this.element('div', 'rtt-inspector-progress-heading');
            const bounded = Math.max(0, Math.min(100, Number(percent) || 0));
            heading.append(this.element('span', '', label), this.element('strong', '', `${bounded.toFixed(1)}%`));
            const track = this.element('div', 'rtt-inspector-progress-track');
            const fill = this.element('div', 'rtt-inspector-progress-fill');
            fill.style.width = `${bounded}%`;
            track.setAttribute('role', 'progressbar');
            track.setAttribute('aria-label', label);
            track.setAttribute('aria-valuemin', '0');
            track.setAttribute('aria-valuemax', '100');
            track.setAttribute('aria-valuenow', String(Math.round(bounded)));
            track.append(fill);
            wrapper.append(heading, track);
            return wrapper;
        },
        render() {
            if (!this.root) return;
            const driver = this.driverData();
            if (!driver || String(driver.userId) !== this.selectedUserId || String(State.currentRaceId || '') !== this.selectedRaceId) {
                this.close(false);
                return;
            }
            this.panel.querySelector('.rtt-inspector-name').textContent = driver.name;
            this.panel.querySelector('.rtt-inspector-subtitle').textContent = `${driver.carTitle || 'Unknown car'} · ${driver.statusClass === 'ready' ? 'Waiting for start' : driver.statusClass === 'racing' ? 'Racing' : driver.statusClass === 'finished' ? 'Finished' : driver.statusClass === 'crashed' ? 'Crashed' : 'Status unknown'}`;
            this.panel.querySelector('.rtt-inspector-eyebrow').textContent = `RACE ${this.selectedRaceId || '—'}  /  DRIVER DETAILS`;
            this.panel.querySelectorAll('.rtt-inspector-tab').forEach(button => {
                const selected = button.dataset.tab === this.tab;
                button.setAttribute('aria-selected', String(selected));
                button.tabIndex = selected ? 0 : -1;
            });
            const scrollTop = this.content.scrollTop;
            this.content.replaceChildren(this.tab === 'race' ? this.raceContent(driver) : this.tab === 'telemetry' ? this.telemetryContent(driver) : this.careerContent(driver));
            this.content.scrollTop = scrollTop;
        },
        raceContent(driver) {
            const wrapper = this.element('div', 'rtt-inspector-section');
            const row = document.getElementById(this.selectedOriginalId);
            const position = row ? [...State.originalLeaderboard.children].indexOf(row) + 1 : 0;
            const raceResult = this.resultCache.get(`${this.selectedRaceId}:${this.selectedUserId}`);
            const raceTime = Number(raceResult?.race_time);
            const bestLap = Number(raceResult?.best_lap_time);
            const isFinished = driver.statusClass === 'finished';
            const isReady = driver.statusClass === 'ready';
            const metricTime = isFinished && Number.isFinite(raceTime) && raceTime > 0 && raceResult?.race_time != null
                ? Utils.formatTime(raceTime, true)
                : isFinished ? driver.originalStatusText : isReady ? 'Not started' : 'In progress';
            const laps = Math.max(1, Number(State.trackInfo.laps) || 1);
            const currentLap = isReady ? 0 : isFinished ? laps : Math.min(laps, Math.floor(driver.progress / (100 / laps)) + 1);
            const summary = this.element('div', 'rtt-inspector-summary');
            summary.append(this.element('div', 'rtt-inspector-summary-overline', 'CURRENT RACE'));
            summary.append(this.element('div', 'rtt-inspector-summary-title', State.trackInfo.name || 'Track not available'));
            summary.append(this.element('div', 'rtt-inspector-summary-sub', `${laps} laps · ${driver.statusClass === 'crashed' ? 'Crashed' : driver.statusClass === 'finished' ? 'Finished' : driver.statusClass === 'ready' ? 'Waiting to start' : 'On track'}`));
            wrapper.append(summary);
            if (isReady) {
                wrapper.append(this.grid([
                    this.metric('Starting grid', position > 0 ? `P${position}` : '—', 'Current line-up', true),
                    this.metric('Laps completed', `0 / ${laps}`)
                ]));
                wrapper.append(this.info('Waiting for Torn to start the race. Live positions, speed and lap timing are not available yet.'));
                return wrapper;
            }
            wrapper.append(this.grid([
                this.metric(isReady ? 'Starting grid' : 'Position', position > 0 ? `P${position}` : '—', isReady ? 'Line-up order, not a live position' : 'Live race order', true),
                this.metric('Race time', driver.statusClass === 'crashed' ? 'Crashed' : metricTime),
                this.metric('Current lap', `${currentLap} / ${laps}`),
                this.metric('Best lap', isFinished && raceResult?.best_lap_time != null && Number.isFinite(bestLap) ? Utils.formatTime(bestLap, true) : '—', 'Official race result')
            ]));
            if (driver.statusClass === 'racing') wrapper.append(this.progress('Race completed', driver.progress));
            if (isFinished && !raceResult && Utils.isApiKeyAvailable()) this.requestRaceResult();
            if (isFinished && driver.userId === State.userId) {
                const gain = APIManager.raceData.getSkillGainDisplay(this.selectedRaceId);
                wrapper.append(this.info(`Racing skill gained: ${gain}`));
                if (gain === 'N/A' && Utils.isApiKeyAvailable()) this.requestSkillGain();
            }
            return wrapper;
        },
        telemetryContent(driver) {
            const wrapper = this.element('div', 'rtt-inspector-section');
            const state = State.previousMetrics[driver.userId];
            const live = driver.statusClass === 'racing';
            const unit = Config.get('speedUnit') === 'kmh' ? 'km/h' : 'mph';
            const speed = live && state && Number.isFinite(state.reportedSpeed)
                ? `${Utils.convertSpeed(state.reportedSpeed, Config.get('speedUnit')).toFixed(1)} ${unit}` : '—';
            const acceleration = live && state && Number.isFinite(state.acceleration) ? `${state.acceleration.toFixed(2)} g` : '—';
            const currentLap = state?.currentLap || 1;
            const laps = Math.max(1, Number(State.trackInfo.laps) || 1);
            wrapper.append(this.element('h3', 'rtt-inspector-section-title', 'Live estimates'));
            if (!live) {
                wrapper.append(this.info(driver.statusClass === 'ready'
                    ? 'The race has not started. Live speed, acceleration and lap estimates will appear when progress begins.'
                    : 'Live telemetry is only available during racing.'));
                return wrapper;
            }
            wrapper.append(this.grid([
                this.metric('Speed · estimated', speed, 'From progress changes', true),
                this.metric('Acceleration · estimated', acceleration, 'Smoothed from speed'),
                this.metric('Lap', live ? `${currentLap} / ${laps}` : '—'),
                this.metric('To lap finish · est.', live && Number.isFinite(state?.smoothedLapEstimate) && state.smoothedLapEstimate > 0 ? Utils.formatTime(state.smoothedLapEstimate) : '—', 'Time remaining, not full lap')
            ]));
            if (live) {
                const lapProgress = live && state ? state.progressInLap : ((driver.progress % (100 / laps)) / (100 / laps)) * 100;
                wrapper.append(this.progress('Whole race', driver.progress), this.progress('Current lap', lapProgress));
            }
            if (state?.wasStale) wrapper.append(this.info('Progress updates paused. Current speed is an estimate and may be stale.'));
            else wrapper.append(this.info('Torn does not expose vehicle sensors here. Speed and acceleration are estimates from race progress; they may lag during network delays.'));
            return wrapper;
        },
        careerContent(driver) {
            const wrapper = this.element('div', 'rtt-inspector-section');
            wrapper.append(this.element('h3', 'rtt-inspector-section-title', 'Driver career'));
            if (!Utils.isApiKeyAvailable()) {
                wrapper.append(this.info('Add a Torn API key in Settings to view career statistics. Live race data does not require a key.'));
                return wrapper;
            }
            const cached = this.careerCache.get(driver.userId);
            if (!cached || Date.now() - cached.when > 2 * 60 * 1000) {
                wrapper.append(this.info('Loading driver statistics from the Torn API…'));
                this.requestCareer(driver.userId);
                return wrapper;
            }
            if (cached.error) {
                wrapper.append(this.info(`Career stats unavailable: ${cached.error}`));
                const retry = this.element('button', 'rtt-inspector-retry', 'Try again');
                retry.type = 'button';
                retry.addEventListener('click', () => { this.careerCache.delete(driver.userId); this.render(); });
                wrapper.append(retry);
                return wrapper;
            }
            const stats = cached.stats;
            const entered = Number(stats?.races?.entered);
            const won = Number(stats?.races?.won);
            const rate = Number.isFinite(entered) && entered > 0 && Number.isFinite(won) ? `${((won / entered) * 100).toFixed(1)}%` : '—';
            const value = number => number == null || !Number.isFinite(Number(number)) ? '—' : Number(number).toLocaleString();
            wrapper.append(this.grid([
                this.metric('Racing skill', value(stats?.skill), '', true),
                this.metric('Racing points', value(stats?.points)),
                this.metric('Races entered', value(stats?.races?.entered)),
                this.metric('Wins', value(stats?.races?.won)),
                this.metric('Career win rate', rate, 'Wins / races entered')
            ]));
            const link = this.element('a', 'rtt-inspector-profile', 'View Torn profile ↗');
            link.href = `https://www.torn.com/profiles.php?XID=${encodeURIComponent(driver.userId)}`;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            wrapper.append(link);
            return wrapper;
        },
        requestCareer(userId) {
            if (this.careerRequests.has(userId)) return;
            const request = APIManager.fetchWithAuthHeader(`https://api.torn.com/v2/user?selections=personalstats&id=${encodeURIComponent(userId)}&cat=racing`, Config.get('apiKey'))
                .then(data => {
                    const stats = data?.personalstats?.racing;
                    if (!stats || typeof stats !== 'object') throw new Error('The API returned no racing statistics.');
                    this.careerCache.set(userId, { stats, when: Date.now() });
                })
                .catch(error => { this.careerCache.set(userId, { error: error.message, when: Date.now() }); })
                .finally(() => { this.careerRequests.delete(userId); if (this.selectedUserId === userId && this.tab === 'career') this.render(); });
            this.careerRequests.set(userId, request);
        },
        requestRaceResult() {
            const raceId = this.selectedRaceId;
            const driverId = this.selectedUserId;
            const key = `${raceId}:${driverId}`;
            if (!raceId || this.resultRequests.has(key)) return;
            this.resultRequests.add(key);
            APIManager.raceData.loadApiRaceResults(raceId)
                .then(results => { this.resultCache.set(key, results.get(driverId) || {}); })
                .catch(() => { this.resultCache.set(key, {}); })
                .finally(() => {
                    this.resultRequests.delete(key);
                    if (this.selectedRaceId === raceId && this.selectedUserId === driverId && this.tab === 'race') this.render();
                });
        },
        requestSkillGain() {
            const raceId = this.selectedRaceId;
            if (!raceId || this.skillGainAttempted.has(raceId)) return;
            this.skillGainAttempted.add(raceId);
            this.resultRequests.add(`gain:${raceId}`);
            APIManager.raceData.loadSkillGain(raceId)
                .catch(() => null)
                .finally(() => {
                    this.resultRequests.delete(`gain:${raceId}`);
                    if (this.selectedRaceId === raceId && this.tab === 'race' && this.root) this.render();
                });
        }
    };

    // Consolidate Torn's post-race information and live Current car card into menu sheets.
    // Keep native content mounted for Torn handlers; hide it only after reliable capture.
    const RaceInfoIntegration = {
        observer: null,
        root: null,
        panel: null,
        closeKeyHandler: null,
        frame: null,
        restoreFocus: null,
        styleInstalled: false,
        actionUrls: {
            changeCar: 'https://www.torn.com/page.php?sid=racing&tab=cars&section=changeRacingCar',
            leaveRace: 'https://www.torn.com/page.php?sid=racing&tab=customrace&section=leaveCurrentRace&step=leaveCurrentRace'
        },
        resolveActionUrl(label, fallbackHref = '') {
            if (/leave/i.test(label)) return this.actionUrls.leaveRace;
            if (/change\s+car/i.test(label)) return this.actionUrls.changeCar;
            return fallbackHref || '';
        },
        labels: {
            'ID': 'Race ID', 'Name': 'Name', 'Type': 'Type', 'Time created': 'Created',
            'Time started': 'Started', 'Time ended': 'Finished', 'Track': 'Track',
            'Laps': 'Laps', 'Participants': 'Participants', 'Drivers required': 'Minimum drivers',
            'Maximum Drivers': 'Maximum drivers', 'Cars allowed': 'Cars allowed',
            'Upgrades allowed': 'Upgrades allowed', 'Bet amount': 'Bet amount'
        },
        readNative(root = document) {
            const wrap = root.querySelector('.car-selected-wrap');
            const card = wrap?.querySelector(':scope > .car-selected');
            if (!card || card.querySelector('.title-black')?.textContent?.trim().toLowerCase() !== 'race info') {
                return null;
            }
            const fields = [];
            for (const node of card.querySelectorAll('.properties-wrap > li .properties > .title')) {
                const match = node.textContent.trim().match(/^([^:]+):\s*(.*)$/s);
                if (!match) continue;
                const label = this.labels[match[1].trim()];
                const value = match[2].trim();
                if (label && value) fields.push({ label, value });
            }
            // Don't remove Torn's panel unless enough information was actually captured.
            if (fields.length < 3 || !fields.some(field => field.label === 'Race ID')) return null;
            return { wrap, fields };
        },
        isRaceFinished(root = document) {
            if (typeof State !== 'undefined' && State.raceFinished) return true;
            const status = root?.querySelector?.('#infoSpot')?.textContent?.trim() || '';
            if (/race\s+finished/i.test(status)) return true;
            const card = root?.querySelector?.('.car-selected-wrap > .car-selected');
            const title = card?.querySelector?.('.title-black')?.textContent?.trim().toLowerCase();
            if (title === 'race info') return true;
            // Torn hides these actions when the race ends, before replacing the car card.
            return title === 'current car' && card.querySelector?.('.model-wrap .link-wrap')?.style?.display === 'none';
        },
        readCar(root = document) {
            const wrap = root.querySelector('.car-selected-wrap');
            const card = wrap?.querySelector(':scope > .car-selected');
            if (!card || card.querySelector('.title-black')?.textContent?.trim().toLowerCase() !== 'current car') return null;
            // When a race finishes in-place via WebSocket, Torn keeps the old Current car DOM
            // node until a page refresh, but hides .link-wrap (display: none) and sets
            // #infoSpot to "Race finished". Hide the Car tab once the race has finished.
            if (this.isRaceFinished(root)) return null;
            const image = card.querySelector('.model-wrap .img img');
            const model = card.querySelector('.model-wrap .model');
            const lines = [...(model?.querySelectorAll?.('p') || [])].map(node => node.textContent.trim()).filter(Boolean);
            const stats = [];
            for (const row of card.querySelectorAll('.properties-wrap > li')) {
                const name = row.querySelector?.('.properties > .title')?.textContent?.trim();
                const bar = row.querySelector?.('.properties .bar-tpl-wrap');
                const track = row.querySelector?.('.progressbar-bg');
                const totalBar = track?.querySelector(':scope > .progressbar');
                const originalBar = totalBar?.querySelector(':scope > .progressbar');
                const tooltip = row.querySelector?.('.progressbar-wrap')?.getAttribute('title')?.trim() || '';
                if (!name || !totalBar) continue;
                const percent = Number.parseFloat(totalBar.style.width);
                const baseline = Number.parseFloat(originalBar?.style?.width);
                stats.push({
                    name, tooltip,
                    percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0,
                    baseline: Number.isFinite(baseline) ? Math.max(0, Math.min(100, baseline)) : 0,
                    negative: Boolean(bar?.classList.contains('negative'))
                });
            }
            // Do not hide actionable Torn content until a useful car view is available.
            if (!lines[0] || !image || stats.length < 3) return null;
            const linkWrap = card.querySelector?.('.model-wrap .link-wrap');
            const linksHidden = linkWrap?.style?.display === 'none';
            const links = linksHidden ? [] : [...card.querySelectorAll('.model-wrap .link-wrap a[href]')]
                .filter(anchor => /leave this race|change car/i.test(anchor.textContent.trim()))
                .map(anchor => ({ anchor, label: anchor.textContent.trim() }));
            return { wrap, name: lines[0], category: lines.slice(1).join(' · '), imageSrc: image.getAttribute('src'), imageAlt: image.getAttribute('alt') || lines[0], stats, links };
        },
        readLive(root = document) {
            const title = root.querySelector('.drivers-list > .title-black')?.textContent?.trim() || '';
            const trackName = title.split(/\s+-\s+\d+\s+laps\b/i)[0].trim();
            const laps = title.match(/\b(\d+)\s+laps\b/i)?.[1];
            const raceId = typeof RaceManager !== 'undefined' ? RaceManager.getRaceId() : null;
            const status = root.querySelector('#infoSpot')?.textContent?.trim();
            const entrants = root.querySelectorAll('#leaderBoard > li').length;
            const length = root.querySelector('.track-info')?.getAttribute('data-length');
            const fields = [];
            if (raceId) fields.push({ label: 'Race ID', value: String(raceId) });
            if (trackName) fields.push({ label: 'Track', value: trackName });
            if (laps) fields.push({ label: 'Laps', value: laps });
            if (entrants) fields.push({ label: 'Participants', value: String(entrants) });
            if (length) fields.push({ label: 'Track length', value: length });
            if (status) fields.push({ label: 'Status', value: status });
            return fields;
        },
        readTrack(root = document) {
            // Torn provides a track-specific description in the native map info icon,
            // even before the race starts. Read it live rather than caching a track.
            const node = root.querySelector('.drivers-list .track-info');
            if (!node) return null;
            const name = node.getAttribute('title')?.trim() || '';
            const length = node.getAttribute('data-length')?.trim() || '';
            const description = node.getAttribute('data-desc')?.trim() || '';
            return { name, length, description };
        },
        getFields(root = document) {
            const native = this.readNative(root);
            const fields = native ? [...native.fields] : this.readLive(root);
            const track = this.readTrack(root);
            if (track) {
                if (track.name && !fields.some(item => item.label === 'Track'))
                    fields.unshift({ label: 'Track', value: track.name });
                if (track.length && !fields.some(item => item.label === 'Track length'))
                    fields.push({ label: 'Track length', value: track.length });
                if (track.description)
                    fields.push({ label: 'Track description', value: track.description });
            }
            return fields;
        },
        sync() {
            if (!this.root || !this.root.isConnected) return;
            const native = this.readNative(this.root);
            const car = this.readCar(this.root);
            const wrap = this.root.querySelector('.car-selected-wrap');
            const canOpenRace = typeof LiveMapIntegration !== 'undefined' && LiveMapIntegration.hasInfoButton();
            const carButton = State.controlsContainer?.querySelector('.telemetry-car-button');
            if (carButton) {
                carButton.style.display = car ? 'inline-block' : 'none';
                carButton.setAttribute('aria-hidden', car ? 'false' : 'true');
            }
            // Suppress Torn's card when its replacement menu is available, or when a race has
            // finished in-place and Torn hasn't swapped the stale .car-selected card yet.
            const finishedStaleCar = !native && !car && this.isRaceFinished(this.root)
                && wrap?.querySelector?.(':scope > .car-selected .title-black')?.textContent?.trim().toLowerCase() === 'current car';
            if (wrap) wrap.classList.toggle('rtt-race-info-integrated', Boolean((native && canOpenRace) || (car && carButton) || (finishedStaleCar && canOpenRace)));
            if (typeof LiveMapIntegration !== 'undefined') LiveMapIntegration.sync();
            if (typeof TabWorkspace !== 'undefined') { TabWorkspace.refreshVisibility(); TabWorkspace.refreshCar(); }
        },
        install() {
            this.disconnect();
            this.root = document.getElementById('racingupdates');
            if (!this.root) return;
            if (!this.styleInstalled) {
                GM_addStyle(`
                    .rtt-race-info-integrated > .car-selected { display: none !important; }
                    .rtt-race-info-integrated > hr.delimiter-999 { display: none !important; }
                    .rtt-race-info-integrated > .drivers-list {
                        float: none !important; width: 100% !important; max-width: 100% !important;
                        margin: 0 !important; box-sizing: border-box;
                    }
                    #telemetryControlsContainer > .telemetry-car-button {
                        box-sizing: border-box; flex: 1 1 0 !important; min-width: 0 !important;
                        max-width: none !important; width: 0; min-height: 34px;
                        padding: 6px 2px; margin: 0; border: 1px solid transparent;
                        border-radius: 6px; background: transparent; box-shadow: none;
                        color: #9aafbd; text-align: center; white-space: nowrap;
                        font: 500 11px/1.25 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        -webkit-tap-highlight-color: transparent; transition: none;
                    }
                    #telemetryControlsContainer > .telemetry-car-button:focus-visible { outline: 2px solid #83b9dc; outline-offset: 1px; }
                    @media (hover: hover) and (pointer: fine) {
                        #telemetryControlsContainer > .telemetry-car-button:hover { color: #e2eff8; background: #293744; border-color: #405260; }
                    }
                    @media (hover: none), (pointer: coarse) {
                        #telemetryControlsContainer > .telemetry-car-button:hover,
                        #telemetryControlsContainer > .telemetry-car-button:active { color: #9aafbd; background: transparent; box-shadow: none; }
                    }
                    .rtt-race-info-content { width: min(100%, 580px); }
                    .rtt-car-heading { display: flex; align-items: center; gap: 12px; padding: 12px;
                        border: 1px solid #354958; border-radius: 11px; background: #202b36; margin-bottom: 12px; }
                    .rtt-car-image { display: block; width: 100px; height: 55px; object-fit: contain; flex: 0 0 100px; }
                    .rtt-car-name { font-size: 17px; font-weight: 700; color: #ecf4fa; line-height: 1.25; }
                    .rtt-car-category { margin-top: 4px; font-size: 12px; color: #9cb3c3; }
                    .rtt-car-stat { margin-bottom: 12px; }
                    .rtt-car-stat-top { display: flex; align-items: baseline; justify-content: space-between;
                        gap: 8px; margin-bottom: 5px; font-size: 12px; color: #dbe8f2; }
                    .rtt-car-stat-top strong { text-align: right; font-size: 11px; font-weight: 600; color: #bed4e2; }
                    .rtt-car-track { position: relative; height: 9px; border-radius: 6px; overflow: hidden;
                        background: #101923; border: 1px solid #3a4754; }
                    .rtt-car-track > .rtt-car-total { position: absolute; inset: 0 auto 0 0;
                        background: #6db579; border-radius: 5px; }
                    .rtt-car-track.negative > .rtt-car-total { background: #cf6863; }
                    .rtt-car-track > .rtt-car-baseline { position: absolute; top: 0; bottom: 0; left: 0;
                        background: rgba(226, 238, 247, .52); border-right: 1px solid #f0f7fa; }
                    .rtt-car-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
                    .rtt-car-actions > a.rtt-car-action { display: inline-flex; align-items: center; justify-content: center;
                        min-height: 42px; flex: 1 1 135px; box-sizing: border-box; padding: 9px 12px;
                        border: 1px solid #476074; border-radius: 9px; background: #283c4b;
                        text-decoration: none !important; color: #e6f4fd !important;
                        text-align: center; font: 600 12px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                    .rtt-car-actions > a.rtt-car-action.leave,
                    .rtt-car-actions > button.rtt-car-action.leave { border-color: #765254; background: #462c30; color: #ffe2df !important; }
                    .rtt-car-actions > button.rtt-car-action { display: inline-flex; align-items: center; justify-content: center;
                        min-height: 42px; flex: 1 1 135px; box-sizing: border-box; padding: 9px 12px;
                        border: 1px solid #476074; border-radius: 9px; background: #283c4b; cursor: pointer;
                        color: #e6f4fd !important; text-align: center;
                        font: 600 12px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                    .rtt-confirm-message { margin: 0 0 14px; font-size: 13px; line-height: 1.55; color: #dbe8f2; }
                    .rtt-car-action:focus-visible { outline: 2px solid #95caee; outline-offset: 2px; }
                    @media (hover: hover) and (pointer: fine) {
                        .rtt-car-action:hover { filter: brightness(1.14); }
                    }
                    @media (hover: none), (pointer: coarse) {
                        .rtt-car-action:hover, .rtt-car-action:active { filter: none; }
                    }
                    .rtt-race-info-intro { font-size: 12px; color: #a6bac9; margin: 0 0 13px; }
                    .rtt-race-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
                    .rtt-race-info-cell { min-width: 0; padding: 10px 12px; background: #202b36; border: 1px solid #354958; border-radius: 9px; }
                    .rtt-race-info-key { display: block; color: #9db2c2; font-size: 10px; line-height: 1.4; }
                    .rtt-race-info-value { display: block; color: #edf4fa; font-size: 13px; line-height: 1.4; font-weight: 650; overflow-wrap: anywhere; margin-top: 3px; }
                    .rtt-race-info-cell.wide { grid-column: 1 / -1; }
                    .rtt-race-info-cell.track-description { padding: 13px 14px; background: #1b303e; }
                    .rtt-race-info-cell.track-description .rtt-race-info-value {
                        font-size: 13px; line-height: 1.6; font-weight: 400;
                        color: #d8e6f0; overflow-wrap: break-word;
                    }
                    @media (max-width: 600px) {
                        .rtt-race-info-grid { gap: 6px; }
                        .rtt-race-info-cell { padding: 9px 10px; }
                        .rtt-race-info-value { font-size: 12px; }
                    }
                `);
                this.styleInstalled = true;
            }
            this.sync();
            // Torn swaps the entire race-details block when a race finishes.
            this.observer = new MutationObserver(() => {
                if (this.frame !== null) return;
                this.frame = requestAnimationFrame(() => { this.frame = null; this.sync(); });
            });
            this.observer.observe(this.root, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['style', 'class'] });
        },
        executeConfirmedAction(action) {
            if (!action) return;
            const label = action.label || '';
            const liveCar = this.readCar();
            const liveAnchor = liveCar?.links?.find(item => item.label.toLowerCase() === label.toLowerCase())?.anchor
                || (action.anchor?.isConnected ? action.anchor : null);

            if (liveAnchor) {
                // Temporarily remove 'need-confirmation' from Torn's native anchor inside
                // #racingMainContainer so Torn's delegated .btn-action-tab AJAX handler
                // executes the XHR action (with rfcv token) immediately instead of asking
                // for confirmation inside the hidden .car-selected card.
                const hadConfirmation = liveAnchor.classList?.contains?.('need-confirmation');
                if (hadConfirmation) liveAnchor.classList.remove('need-confirmation');
                try {
                    const $ = typeof window !== 'undefined' ? (window.jQuery || window.$) : null;
                    if ($?.fn?.jquery) {
                        $(liveAnchor).trigger('click');
                    } else {
                        liveAnchor.click();
                    }
                } finally {
                    if (hadConfirmation && liveAnchor.isConnected) {
                        setTimeout(() => liveAnchor.classList?.add?.('need-confirmation'), 0);
                    }
                }
                return;
            }

            // Fallback if native anchor is no longer in the DOM: inject a temporary
            // .btn-action-tab anchor inside #racingMainContainer and trigger it.
            const targetUrl = this.resolveActionUrl(label, action.anchor?.href);
            const relativeHref = targetUrl.replace(/^https?:\/\/[^/]+/i, '');
            const container = document.getElementById('racingMainContainer') || this.root || document.body;
            if (container && relativeHref) {
                const tempAnchor = document.createElement('a');
                tempAnchor.className = 'link btn-action-tab';
                tempAnchor.href = relativeHref;
                tempAnchor.style.display = 'none';
                container.append(tempAnchor);
                try {
                    const $ = typeof window !== 'undefined' ? (window.jQuery || window.$) : null;
                    if ($?.fn?.jquery) {
                        $(tempAnchor).trigger('click');
                    } else {
                        tempAnchor.click();
                    }
                } finally {
                    setTimeout(() => tempAnchor.remove(), 0);
                }
            }
        },
        confirmAction(action, trigger = null) {
            if (!action) return;
            const isLeave = /leave/i.test(action.label);
            const targetUrl = this.resolveActionUrl(action.label, action.anchor?.href);
            // In synthetic unit tests where document.body is not mounted, execute immediately.
            if (typeof document === 'undefined' || !document.body?.append) {
                this.executeConfirmedAction(action);
                return;
            }
            this.close();
            const popup = document.createElement('div');
            popup.className = 'info-panel rtt-race-info-panel rtt-confirm-panel';
            popup.setAttribute('role', 'presentation');
            const content = document.createElement('div');
            content.className = 'info-panel-content rtt-race-info-content';
            content.setAttribute('role', 'dialog');
            content.setAttribute('aria-modal', 'true');
            const title = document.createElement('div');
            title.className = 'info-title';
            title.textContent = isLeave ? 'Leave this race?' : 'Change car?';
            title.id = 'rtt-confirm-action-title';
            content.setAttribute('aria-labelledby', title.id);
            const close = document.createElement('button');
            close.className = 'info-close';
            close.type = 'button';
            close.textContent = '×';
            close.setAttribute('aria-label', 'Cancel');
            close.addEventListener('click', () => this.close());
            title.append(close);

            const body = document.createElement('div');
            body.className = 'info-content';
            const msg = document.createElement('p');
            msg.className = 'rtt-confirm-message';
            msg.textContent = isLeave
                ? 'Are you sure you want to leave your current race?'
                : 'Are you sure you want to leave the track view and change your racing car?';
            const actions = document.createElement('div');
            actions.className = 'rtt-car-actions';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'rtt-car-action';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', () => this.close());

            const confirmLink = document.createElement('a');
            confirmLink.className = 'rtt-car-action' + (isLeave ? ' leave' : '');
            confirmLink.textContent = isLeave ? 'Yes, Leave Race' : 'Yes, Change Car';
            confirmLink.href = targetUrl;
            confirmLink.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                this.close();
                this.executeConfirmedAction(action);
            });

            actions.append(cancelBtn, confirmLink);
            body.append(msg, actions);
            content.append(title, body);
            popup.append(content);
            popup.addEventListener('click', event => { if (event.target === popup) this.close(); });
            this.panel = popup;
            this.restoreFocus = trigger || document.activeElement;
            this.closeKeyHandler = event => {
                if (event.key === 'Escape') { event.preventDefault(); this.close(); }
            };
            document.addEventListener('keydown', this.closeKeyHandler);
            // Mount inside #racingMainContainer when available so Torn's delegated listeners remain in scope.
            const mountTarget = document.getElementById('racingMainContainer') || document.body;
            mountTarget.append(popup);
            confirmLink.focus?.();
        },
        open(trigger, mode = 'race') {
            this.close();
            const car = mode === 'car' ? this.readCar() : null;
            if (mode === 'car' && !car) return;
            const fields = mode === 'race' ? this.getFields() : [];
            const popup = document.createElement('div');
            popup.className = 'info-panel rtt-race-info-panel';
            popup.setAttribute('role', 'presentation');
            const content = document.createElement('div');
            content.className = 'info-panel-content rtt-race-info-content';
            content.setAttribute('role', 'dialog');
            content.setAttribute('aria-modal', 'true');
            const title = document.createElement('div');
            title.className = 'info-title';
            title.textContent = mode === 'car' ? 'Current car' : 'Race information';
            title.id = mode === 'car' ? 'rtt-car-info-title' : 'rtt-race-info-title';
            content.setAttribute('aria-labelledby', title.id);
            const close = document.createElement('button');
            close.className = 'info-close';
            close.type = 'button';
            close.textContent = '×';
            close.setAttribute('aria-label', mode === 'car' ? 'Close current car' : 'Close race information');
            close.addEventListener('click', () => this.close());
            title.append(close);
            const body = document.createElement('div');
            body.className = 'info-content';
            const intro = document.createElement('p');
            intro.className = 'rtt-race-info-intro';
            intro.textContent = this.readNative() ? 'Official race and track information from Torn.' : 'Track information and current race details from Torn. Full event details appear after the race finishes.';
            if (mode === 'car') {
                this.renderCar(body, car);
            } else {
                body.append(intro);
            }
            if (mode === 'race' && fields.length) {
                const grid = document.createElement('div');
                grid.className = 'rtt-race-info-grid';
                for (const field of fields) {
                    const cell = document.createElement('div');
                    cell.className = 'rtt-race-info-cell';
                    if (field.value.length > 34 || field.label === 'Track description') cell.classList.add('wide');
                    if (field.label === 'Track description') cell.classList.add('track-description');
                    const key = document.createElement('span');
                    key.className = 'rtt-race-info-key';
                    key.textContent = field.label;
                    const value = document.createElement('span');
                    value.className = 'rtt-race-info-value';
                    value.textContent = field.value;
                    cell.append(key, value);
                    grid.append(cell);
                }
                body.append(grid);
            } else if (mode === 'race') {
                const msg = document.createElement('p');
                msg.textContent = 'Race details are not available yet.';
                body.append(msg);
            }
            content.append(title, body);
            popup.append(content);
            popup.addEventListener('click', event => { if (event.target === popup) this.close(); });
            this.panel = popup;
            this.restoreFocus = trigger || document.activeElement;
            this.closeKeyHandler = event => {
                if (event.key === 'Escape') { event.preventDefault(); this.close(); }
            };
            document.addEventListener('keydown', this.closeKeyHandler);
            document.body.append(popup);
            close.focus();
        },
        renderCar(body, car) {
            const heading = document.createElement('div');
            heading.className = 'rtt-car-heading';
            const image = document.createElement('img');
            image.className = 'rtt-car-image';
            image.src = car.imageSrc;
            image.alt = car.imageAlt;
            const details = document.createElement('div');
            const name = document.createElement('div');
            name.className = 'rtt-car-name';
            name.textContent = car.name;
            details.append(name);
            if (car.category) {
                const category = document.createElement('div');
                category.className = 'rtt-car-category';
                category.textContent = car.category;
                details.append(category);
            }
            heading.append(image, details);
            body.append(heading);
            for (const stat of car.stats) {
                const row = document.createElement('div');
                row.className = 'rtt-car-stat';
                const top = document.createElement('div');
                top.className = 'rtt-car-stat-top';
                const label = document.createElement('span');
                label.textContent = stat.name;
                const value = document.createElement('strong');
                value.textContent = stat.tooltip || `${stat.percent.toFixed(1)}%`;
                top.append(label, value);
                const track = document.createElement('div');
                track.className = 'rtt-car-track';
                if (stat.negative) track.classList.add('negative');
                track.setAttribute('role', 'img');
                track.setAttribute('aria-label', `${stat.name}: ${value.textContent}`);
                const total = document.createElement('span');
                total.className = 'rtt-car-total';
                total.style.width = `${stat.percent}%`;
                const baseline = document.createElement('span');
                baseline.className = 'rtt-car-baseline';
                baseline.style.width = `${stat.percent * stat.baseline / 100}%`;
                track.append(total, baseline);
                row.append(top, track);
                body.append(row);
            }
            // Expose Change Car / Leave this race in the Car tab as well as the LiveMapIntegration.hasActionMenu() overflow.
            if (car.links.length) {
                const actions = document.createElement('div');
                actions.className = 'rtt-car-actions';
                for (const action of car.links) {
                    const link = document.createElement('a');
                    link.className = 'rtt-car-action' + (/leave/i.test(action.label) ? ' leave' : '');
                    link.textContent = action.label;
                    // Preserve Torn's current URL and link classes, or use the direct action URL when navigating.
                    link.href = action.anchor.href;
                    link.dataset && (link.dataset.targetUrl = this.resolveActionUrl(action.label, action.anchor.href));
                    for (const cls of action.anchor.classList) {
                        if (cls === 'need-confirmation' || cls === 'btn-action-tab') link.classList.add(cls);
                    }
                    actions.append(link);
                }
                actions.addEventListener?.('click', event => {
                    const clicked = event.target?.closest?.('a.rtt-car-action');
                    if (!clicked) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const matched = car.links.find(item => item.label === clicked.textContent.trim()) || {
                        label: clicked.textContent.trim(),
                        anchor: clicked
                    };
                    this.confirmAction(matched, clicked);
                });
                body.append(actions);
            }
        },
        close() {
            this.panel?.remove();
            this.panel = null;
            if (this.closeKeyHandler) document.removeEventListener('keydown', this.closeKeyHandler);
            this.closeKeyHandler = null;
            if (this.restoreFocus?.isConnected) this.restoreFocus.focus();
            this.restoreFocus = null;
        },
        disconnect() {
            this.observer?.disconnect();
            this.observer = null;
            if (this.frame !== null) cancelAnimationFrame(this.frame);
            this.frame = null;
            this.root?.querySelector('.rtt-race-info-integrated')?.classList.remove('rtt-race-info-integrated');
            this.root = null;
            this.close();
        }
    };

    // Beta 10: The native Torn track stays LIVE and INLINE above the leaderboard.
    // No canvas reparenting, duplication, hiding, redraw, or iframe is involved.
    const LiveMapIntegration = {
        root: null,
        title: null,
        map: null,
        menu: null,
        button: null,
        infoButton: null,
        list: null,
        actions: [],
        documentClick: null,
        keyHandler: null,
        stylesInstalled: false,
        findNodes() {
            const root = document.getElementById('racingupdates');
            const map = root?.querySelector('.drivers-list .track-wrap');
            const title = root?.querySelector('.drivers-list > .title-black');
            if (!root || !map?.querySelector('#raceCanvas') || !title || !root.querySelector('#leaderBoard')) return null;
            return { root, map, title };
        },
        readActions() {
            if (!this.root) return [];
            if (typeof State !== 'undefined' && State.raceFinished) return [];
            if (/race\s+finished/i.test(this.root.querySelector?.('#infoSpot')?.textContent?.trim() || '')) return [];
            const card = this.root.querySelector('.car-selected-wrap > .car-selected');
            if (card?.querySelector('.title-black')?.textContent?.trim().toLowerCase() !== 'current car') return [];
            const linkWrap = card.querySelector?.('.model-wrap .link-wrap');
            if (linkWrap?.style?.display === 'none') return [];
            return [...card.querySelectorAll('.model-wrap .link-wrap a[href]')]
                .filter(node => /^(change car|leave this race)$/i.test(node.textContent.trim()))
                .map(anchor => ({ label: anchor.textContent.trim(), anchor }));
        },
        install() {
            this.disconnect();
            this.installStyles();
            this.sync();
        },
        sync() {
            const found = this.findNodes();
            if (!found) { this.clearMount(); return; }
            if (this.root !== found.root || this.title !== found.title || this.map !== found.map || !this.menu?.isConnected) {
                this.clearMount();
                this.root = found.root;
                this.title = found.title;
                this.map = found.map;
                this.root.classList.add('rtt-map-integrated');
                this.createMenu();
            }
            const next = this.readActions();
            const changed = next.length !== this.actions.length || next.some((item, index) =>
                item.anchor !== this.actions[index]?.anchor || item.label !== this.actions[index]?.label);
            if (changed) this.renderActions(next);
        },
        createMenu() {
            const menu = document.createElement('div');
            menu.className = 'rtt-track-actions';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'rtt-track-more';
            button.hidden = true; // The info icon is always available; ⋯ only with Torn actions.
            button.textContent = '⋯';
            button.title = 'Race actions';
            button.setAttribute('aria-label', 'Race actions: change car or leave race');
            button.setAttribute('aria-haspopup', 'true');
            button.setAttribute('aria-expanded', 'false');
            const list = document.createElement('div');
            list.className = 'rtt-track-action-list';
            list.id = 'rtt-track-action-list';
            list.setAttribute('role', 'menu');
            list.hidden = true;
            button.setAttribute('aria-controls', list.id);
            button.addEventListener('click', event => {
                event.stopPropagation();
                this.toggle(!this.isOpen());
            });
            const info = document.createElement('button');
            info.type = 'button';
            info.className = 'rtt-track-info-button';
            info.textContent = 'i';
            info.title = 'Track and race information';
            info.setAttribute('aria-label', 'Track and race information');
            info.setAttribute('aria-haspopup', 'dialog');
            info.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                this.toggle(false);
                RaceInfoIntegration.open(info);
            });
            menu.append(info, button, list);
            this.title.append(menu);
            this.menu = menu;
            this.button = button;
            this.infoButton = info;
            this.list = list;
            this.documentClick = event => {
                if (this.isOpen() && !this.menu?.contains(event.target)) this.toggle(false);
            };
            this.keyHandler = event => {
                if (event.key === 'Escape' && this.isOpen()) {
                    event.preventDefault();
                    this.toggle(false);
                    this.button?.focus();
                }
            };
            document.addEventListener('click', this.documentClick);
            document.addEventListener('keydown', this.keyHandler);
        },
        renderActions(actions) {
            this.actions = actions;
            if (!this.list || !this.menu) return;
            this.toggle(false);
            this.list.replaceChildren();
            for (const action of actions) {
                const entry = document.createElement('button');
                entry.type = 'button';
                entry.className = 'rtt-track-action' + (/leave/i.test(action.label) ? ' rtt-track-action-danger' : '');
                entry.setAttribute('role', 'menuitem');
                entry.textContent = action.label;
                entry.addEventListener('click', event => {
                    event.stopPropagation();
                    this.toggle(false);
                    const live = this.readActions().find(item => item.label === action.label) || action;
                    if (typeof RaceInfoIntegration !== 'undefined' && typeof RaceInfoIntegration.confirmAction === 'function') {
                        RaceInfoIntegration.confirmAction(live, this.button);
                    } else if (live?.anchor?.isConnected) {
                        live.anchor.click();
                    }
                });
                this.list.append(entry);
            }
            // The race info icon stays usable even without car actions.
            this.button.hidden = actions.length === 0;
        },
        isOpen() { return Boolean(this.list && !this.list.hidden); },
        toggle(open) {
            if (!this.list || !this.button) return;
            const show = Boolean(open && this.actions.length);
            this.list.hidden = !show;
            this.button.setAttribute('aria-expanded', String(show));
            this.menu?.classList.toggle('is-open', show);
        },
        hasActionMenu() { return Boolean(this.menu?.isConnected && this.actions.length); },
        hasInfoButton() { return Boolean(this.infoButton?.isConnected); },
        installStyles() {
            if (this.stylesInstalled) return;
            GM_addStyle(`
                /* One continuous racing card: track heading, live map, navigation, drivers. */
                #racingupdates.rtt-map-integrated .drivers-list > .title-black {
                    position: relative !important; box-sizing: border-box !important;
                    min-height: 42px; padding: 11px 92px 11px 12px !important;
                    background: #263440 !important; border: 1px solid #3c5060 !important;
                    border-bottom: 0 !important; border-radius: 10px 10px 0 0 !important;
                    color: #edf5fa !important; font-size: 13px !important;
                    line-height: 20px !important; white-space: normal !important;
                    overflow: visible !important; text-overflow: clip !important;
                    z-index: 4;
                }
                #racingupdates.rtt-map-integrated .drivers-list > .cont-black {
                    box-sizing: border-box !important; min-width: 0 !important;
                    width: 100% !important; padding: 0 !important;
                    background: #17222c !important;
                    border: 1px solid #3c5060 !important;
                    border-top: 0 !important; border-radius: 0 0 10px 10px !important;
                    overflow: visible !important;
                }
                #racingupdates.rtt-map-integrated .drivers-list .track-wrap {
                    box-sizing: border-box !important; position: relative !important;
                    float: none !important; display: block !important;
                    visibility: visible !important; pointer-events: auto !important;
                    width: 100% !important; min-width: 0 !important;
                    height: auto !important; margin: 0 !important; padding: 9px 9px 8px !important;
                    background: #17222c !important;
                }
                #racingupdates.rtt-map-integrated .drivers-list .tracks {
                    position: relative !important; display: block !important;
                    box-sizing: border-box !important; width: 100% !important;
                    max-width: 680px !important; height: auto !important;
                    aspect-ratio: 520 / 243; margin: 0 auto !important;
                    overflow: hidden !important; border-radius: 6px !important;
                    background: #101922 !important;
                }
                #racingupdates.rtt-map-integrated .drivers-list .tracks > .img-track,
                #racingupdates.rtt-map-integrated .drivers-list .tracks > #raceCanvas {
                    box-sizing: border-box !important; position: absolute !important;
                    top: 0 !important; left: 0 !important;
                    width: 100% !important; height: 100% !important;
                    max-width: none !important; margin: 0 !important;
                }
                #racingupdates.rtt-map-integrated .drivers-list .tracks > #raceCanvas {
                    touch-action: manipulation;
                }
                #racingupdates.rtt-map-integrated .drivers-list #racingdetails {
                    max-width: 75%; box-sizing: border-box !important;
                }
                /* The old native tooltip is replaced by an accessible button in
                   the same header. Its element and data attributes remain intact. */
                #racingupdates.rtt-map-integrated .drivers-list .track-info-wrap {
                    display: none !important;
                }
                .rtt-track-actions {
                    position: absolute; top: 5px; right: 6px;
                    z-index: 20; display: flex; align-items: center; gap: 7px;
                    font: 500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                }
                .rtt-track-info-button {
                    display: flex; align-items: center; justify-content: center;
                    box-sizing: border-box; width: 32px; height: 32px; padding: 0;
                    cursor: pointer; border: 1px solid #4a6171; border-radius: 7px;
                    color: #d8e6ef; background: #334652;
                    font: italic bold 21px/1 Georgia,serif;
                    -webkit-tap-highlight-color: transparent;
                }
                .rtt-track-info-button:hover { color: #fff; border-color: #7999ac; background: #3d5363; }
                .rtt-track-info-button:focus-visible { outline: 2px solid #9cd2f5; outline-offset: 2px; }
                .rtt-track-actions[hidden], .rtt-track-more[hidden], .rtt-track-action-list[hidden] { display: none !important; }
                .rtt-track-more {
                    display: flex; align-items: center; justify-content: center;
                    width: 34px; height: 31px; padding: 0; cursor: pointer;
                    color: #d8e6ef; background: #334652; border: 1px solid #4a6171;
                    border-radius: 7px; font-size: 22px; line-height: 1;
                    -webkit-tap-highlight-color: transparent;
                }
                .rtt-track-more[aria-expanded="true"], .rtt-track-more:hover {
                    color: #fff; border-color: #7999ac; background: #3d5363;
                }
                .rtt-track-more:focus-visible, .rtt-track-action:focus-visible {
                    outline: 2px solid #9cd2f5; outline-offset: 2px;
                }
                .rtt-track-action-list {
                    position: absolute; top: calc(100% + 5px); right: 0;
                    z-index: 30; width: max-content; min-width: 172px;
                    max-width: min(280px, calc(100vw - 32px));
                    padding: 5px; border: 1px solid #4a6274; border-radius: 9px;
                    background: #233440; box-shadow: 0 10px 24px rgba(0,0,0,.45);
                }
                .rtt-track-action {
                    box-sizing: border-box; width: 100%; min-height: 40px;
                    display: flex; align-items: center; text-align: left;
                    cursor: pointer; border: 0; border-radius: 6px;
                    padding: 9px 11px; color: #e5f1f9; background: transparent;
                    font: 600 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                }
                .rtt-track-action:hover { background: #344c5e; }
                .rtt-track-action-danger { color: #ffc9c3; }
                .rtt-track-action-danger:hover { background: #553439; }
                @media (max-width: 600px) {
                    #racingupdates.rtt-map-integrated .drivers-list > .title-black {
                        font-size: 12px !important; padding: 10px 88px 10px 9px !important;
                    }
                    #racingupdates.rtt-map-integrated .drivers-list .track-wrap {
                        padding: 6px 6px 7px !important;
                    }
                    #racingupdates.rtt-map-integrated .drivers-list #racingdetails {
                        max-width: 80%; font-size: 10px;
                    }
                    .rtt-track-more, .rtt-track-info-button { min-width: 34px; min-height: 34px; }
                }
            `);
            this.stylesInstalled = true;
        },
        clearMount() {
            this.toggle(false);
            if (this.documentClick) document.removeEventListener('click', this.documentClick);
            if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler);
            this.documentClick = this.keyHandler = null;
            this.menu?.remove();
            this.root?.classList.remove('rtt-map-integrated');
            this.root = this.title = this.map = this.menu = this.button = this.infoButton = this.list = null;
            this.actions = [];
        },
        disconnect() { this.clearMount(); }
    };

    // All secondary controls are real tabs beneath the UNMOVED, continuously running
    // Torn race canvas. Keep the live leaderboard and the existing data views mounted
    // so switching tabs never recreates Torn's race or discards unsaved form inputs.
    const TabWorkspace = {
        host: null,
        controls: null,
        nativeLeaderboard: null,
        driverList: null,
        raceCard: null,
        panes: new Map(),
        buttons: new Map(),
        active: 'drivers',
        carSignature: '',
        dataSignatures: new Map(),
        stylesInstalled: false,
        labels: {
            drivers: 'Drivers', car: 'Car', info: 'Info', history: 'History',
            stats: 'Stats', export: 'Export', settings: 'Settings'
        },
        selectors: {
            car: '.telemetry-car-button', info: '.telemetry-info-button',
            history: '.telemetry-history-button', stats: '.telemetry-stats-button',
            export: '.telemetry-download-button', settings: '.telemetry-settings-button'
        },
        install() {
            this.disconnect();
            const controls = State.controlsContainer;
            const driverList = State.customUIContainer;
            const scrollbar = document.getElementById('drivers-scrollbar');
            const raceCard = controls?.closest('.drivers-list');
            if (!controls || !driverList || !scrollbar || !raceCard || !raceCard.contains(scrollbar)) return;
            this.installStyles();
            this.controls = controls;
            this.driverList = driverList;
            this.nativeLeaderboard = scrollbar;
            this.raceCard = raceCard;
            controls.setAttribute('role', 'tablist');
            controls.setAttribute('aria-label', 'Racing telemetry views');
            const driversButton = document.createElement('button');
            driversButton.type = 'button';
            driversButton.className = 'telemetry-drivers-button';
            driversButton.textContent = 'Drivers';
            driversButton.title = 'View live racing leaderboard';
            driversButton.addEventListener('click', () => this.activate('drivers'));
            controls.prepend(driversButton);

            const host = document.createElement('div');
            host.id = 'rtt-telemetry-workspace';
            host.className = 'rtt-telemetry-workspace';
            controls.after(host);
            this.host = host;
            for (const key of Object.keys(this.labels)) {
                const button = key === 'drivers' ? driversButton : controls.querySelector(this.selectors[key]);
                if (!button) continue;
                const pane = document.createElement('section');
                pane.className = 'rtt-telemetry-pane';
                pane.id = `rtt-telemetry-pane-${key}`;
                pane.dataset.view = key;
                pane.hidden = true;
                pane.setAttribute('role', 'tabpanel');
                pane.setAttribute('aria-labelledby', `rtt-telemetry-tab-${key}`);
                host.append(pane);
                button.id = `rtt-telemetry-tab-${key}`;
                button.type = 'button';
                button.setAttribute('role', 'tab');
                button.setAttribute('aria-controls', pane.id);
                button.setAttribute('aria-selected', 'false');
                button.tabIndex = -1;
                // UI owns the button click events; this module owns their layout and content.
                button.addEventListener('keydown', event => this.onTabKey(event, key));
                this.buttons.set(key, button);
                this.panes.set(key, pane);
            }
            // Keep the ORIGINAL Torn leaderboard DOM so race updates and click handlers
            // continue working. Both leaderboard alternatives belong to Drivers.
            this.panes.get('drivers').append(driverList, scrollbar);
            this.activate('drivers');
        },
        onTabKey(event, key) {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const keys = [...this.buttons.keys()].filter(name => this.isAvailable(name));
            const i = keys.indexOf(key);
            const next = event.key === 'Home' ? keys[0] : event.key === 'End' ? keys[keys.length - 1]
                : keys[(i + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length];
            if (next) {
                this.activate(next);
                this.buttons.get(next)?.focus();
            }
        },
        isAvailable(key) {
            if (key === 'drivers') return true;
            if (key === 'car' && RaceInfoIntegration.isRaceFinished()) return false;
            const button = this.buttons.get(key);
            return Boolean(button && !button.hidden && button.style.display !== 'none');
        },
        activate(key = 'drivers') {
            if (!this.host?.isConnected) return;
            if (!this.isAvailable(key)) key = 'drivers';
            this.active = key;
            for (const [name, pane] of this.panes) {
                const selected = name === key;
                pane.hidden = !selected;
                const button = this.buttons.get(name);
                if (button) {
                    button.setAttribute('aria-selected', String(selected));
                    button.tabIndex = selected ? 0 : -1;
                }
            }
            this.raceCard?.classList.toggle('rtt-tab-viewing-other', key !== 'drivers');
            this.renderView(key);
            this.buttons.get(key)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        },
        getDataSignature(key) {
            if (key === 'history') {
                return `${State.currentRaceId || ''}:${State.raceFinished ? 1 : 0}:${Config.get('historicalRaceLimit')}:${Boolean(Config.get('apiKey'))}`;
            }
            if (key === 'stats') {
                return `${State.currentRaceId || ''}:${State.trackInfo?.id || ''}:${State.currentRaceClass || ''}:${State.raceFinished ? 1 : 0}:${Config.get('historicalRaceLimit')}:${Boolean(Config.get('apiKey'))}`;
            }
            if (key === 'export') {
                return `${State.currentRaceId || ''}:${State.finalRaceData?.length || 0}`;
            }
            return 'static';
        },
        invalidateRaceBoundViews() {
            this.dataSignatures.delete('history');
            this.dataSignatures.delete('stats');
            this.dataSignatures.delete('export');
            for (const key of ['history', 'stats', 'export']) {
                const pane = this.panes.get(key);
                if (!pane) continue;
                if (this.active === key && this.isAvailable(key)) {
                    pane.replaceChildren();
                    this.renderView(key);
                } else {
                    pane.replaceChildren();
                }
            }
        },
        renderView(key) {
            const pane = this.panes.get(key);
            if (!pane || key === 'drivers') return;
            if (key === 'car') { this.renderCar(); return; }
            const sig = this.getDataSignature(key);
            if (pane.firstElementChild && !pane.querySelector?.('.rtt-tab-message')) {
                if (this.dataSignatures.get(key) === sig) return; // Preserve the mounted content across switches.
                pane.replaceChildren();
            }
            this.dataSignatures.set(key, sig);
            let task = null;
            let instance = null;
            try {
                switch (key) {
                    case 'info': UI.createInfoPanel(); instance = State.infoPanelInstance; break;
                    case 'history': task = UI.createHistoryPanel(); instance = State.historyPanelInstance; break;
                    case 'stats':
                        this.showMessage(pane, 'Loading advanced statistics…');
                        // Preserve the original ordering: resolve live track/class metadata
                        // before calculating track-specific historical statistics.
                        RaceManager.updateTrackAndClassInfo().then(() => {
                            if (!this.host?.contains(pane)) return;
                            const statsTask = UI.createAdvancedStatsPanel();
                            const statsPanel = State.advancedStatsPanelInstance;
                            this.dataSignatures.set('stats', this.getDataSignature('stats'));
                            if (statsPanel) {
                                statsPanel.classList.add('rtt-inline-tab-content');
                                statsPanel.removeAttribute('aria-modal');
                                pane.replaceChildren(statsPanel);
                            } else this.showMessage(pane, 'Advanced statistics are not available.');
                            if (statsTask?.catch) statsTask.catch(error => {
                                if (this.host?.contains(pane)) this.showMessage(pane, `Unable to load stats: ${error.message}`);
                            });
                        }).catch(error => {
                            if (this.host?.contains(pane)) this.showMessage(pane, `Unable to load stats: ${error.message}`);
                        });
                        return;
                    case 'settings': UI.createSettingsPopup(); instance = State.settingsPopupInstance; break;
                    case 'export': UI.createDownloadPopup(); instance = State.downloadPopupInstance; break;
                }
                if (instance) {
                    instance.classList.add('rtt-inline-tab-content');
                    instance.removeAttribute('aria-modal');
                    pane.append(instance);
                } else {
                    this.showMessage(pane, 'This view is not available.');
                }
                if (task?.catch) task.catch(error => {
                    if (this.host?.isConnected && pane.contains(instance)) {
                        this.showMessage(pane, `Unable to load ${this.labels[key].toLowerCase()}: ${error.message}`);
                    }
                });
            } catch (error) {
                this.showMessage(pane, `Unable to open ${this.labels[key].toLowerCase()}: ${error.message}`);
            }
        },
        renderCar() {
            const pane = this.panes.get('car');
            if (!pane || this.active !== 'car') return;
            const car = RaceInfoIntegration.readCar();
            if (!car) {
                this.carSignature = '';
                this.showMessage(pane, 'Your current car is not available for this race.');
                return;
            }
            const signature = JSON.stringify({name:car.name,category:car.category,image:car.imageSrc, stats:car.stats,
                links:car.links.map(link => [link.label, link.anchor.getAttribute('href')])});
            if (signature === this.carSignature && pane.querySelector('.rtt-tab-car-content')) return;
            this.carSignature = signature;
            const content = document.createElement('div');
            content.className = 'rtt-tab-car-content';
            const title = document.createElement('h3');
            title.className = 'rtt-tab-view-title';
            title.textContent = 'Current car';
            const body = document.createElement('div');
            body.className = 'rtt-tab-car-body';
            RaceInfoIntegration.renderCar(body, car);
            content.append(title, body);
            pane.replaceChildren(content);
        },
        refreshCar() {
            if (this.active === 'car') this.renderCar();
        },
        refreshVisibility() {
            if (!this.host?.isConnected) return;
            const carButton = this.buttons.get('car');
            if (carButton && RaceInfoIntegration.isRaceFinished()) {
                carButton.style.display = 'none';
                carButton.setAttribute('aria-hidden', 'true');
            }
            if (!this.isAvailable(this.active)) this.activate('drivers');
        },
        // The existing Save / Download controls close their former popup node after
        // acting. In inline mode, restore a fresh editable panel in the same tab.
        restoreAfterAction(key) {
            if (this.active !== key || !this.host?.isConnected) return;
            const pane = this.panes.get(key);
            if (!pane) return;
            this.dataSignatures.delete(key);
            pane.replaceChildren();
            this.renderView(key);
        },
        showMessage(pane, message) {
            const text = document.createElement('p');
            text.className = 'rtt-tab-message';
            text.textContent = message;
            pane.replaceChildren(text);
        },
        disconnect() {
            if (this.host && this.controls?.isConnected) {
                // Restore the original sibling order; no Torn element is discarded.
                if (this.driverList) this.host.before(this.driverList);
                if (this.nativeLeaderboard) this.host.before(this.nativeLeaderboard);
            }
            this.raceCard?.classList.remove('rtt-tab-viewing-other');
            this.controls?.removeAttribute('role');
            this.controls?.removeAttribute('aria-label');
            this.host?.remove();
            this.host = null;
            this.controls = null;
            this.driverList = null;
            this.nativeLeaderboard = null;
            this.raceCard = null;
            this.panes.clear();
            this.buttons.clear();
            this.dataSignatures.clear();
            this.active = 'drivers';
            this.carSignature = '';
        },
        installStyles() {
            if (this.stylesInstalled) return;
            GM_addStyle(`
                /* Integrated, scrollable tab bar directly under the always-live race map. */
                #racingupdates.rtt-map-integrated #telemetryControlsContainer[role="tablist"],
                #telemetryControlsContainer[role="tablist"] {
                    box-sizing: border-box !important; display: flex !important; flex-wrap: nowrap !important;
                    gap: 0 !important; width: 100% !important; max-width: 100% !important;
                    min-height: 43px; margin: 0 !important; padding: 0 5px !important;
                    background: #1c2b36 !important; border-top: 1px solid #384d5d !important;
                    border-bottom: 1px solid #384d5d !important;
                    overflow-x: auto !important; overflow-y: hidden !important;
                    scrollbar-width: none; -webkit-overflow-scrolling: touch;
                }
                #telemetryControlsContainer[role="tablist"]::-webkit-scrollbar { display: none; }
                #telemetryControlsContainer[role="tablist"] > button[role="tab"] {
                    box-sizing: border-box !important; flex: 0 0 auto !important;
                    min-width: 60px !important; width: auto !important; max-width: none !important;
                    min-height: 42px !important; margin: 0 !important; padding: 10px 12px 9px !important;
                    border: 0 !important; border-bottom: 2px solid transparent !important;
                    border-radius: 0 !important; background: transparent !important;
                    box-shadow: none !important; color: #9eafbd !important;
                    text-align: center !important; white-space: nowrap !important;
                    font: 600 12px/18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
                    cursor: pointer; -webkit-tap-highlight-color: transparent;
                }
                #telemetryControlsContainer[role="tablist"] > button[aria-selected="true"] {
                    color: #e8f5ff !important; border-bottom-color: #67bce9 !important;
                    background: #263947 !important;
                }
                #telemetryControlsContainer[role="tablist"] > button[role="tab"]:focus-visible {
                    outline: 2px solid #80d2ff !important; outline-offset: -3px;
                }
                #telemetryControlsContainer[role="tablist"] > button[role="tab"]:hover {
                    color: #ecf7fe !important; background: #263947 !important;
                }
                #telemetryControlsContainer[role="tablist"] > button[role="tab"][style*="display: none"] { display: none !important; }
                #rtt-telemetry-workspace {
                    box-sizing: border-box; width: 100%; margin: 0 !important; padding: 0 !important;
                    min-width: 0; background: #17222c; color: #e1edf4;
                    font: 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                #rtt-telemetry-workspace > .rtt-telemetry-pane { min-width: 0; width: 100%; box-sizing: border-box; padding: 0; }
                #rtt-telemetry-workspace > .rtt-telemetry-pane[hidden] { display: none !important; }
                #rtt-telemetry-pane-drivers > #custom-driver-list-container {
                    margin: 0 !important; border: 0 !important; border-radius: 0 !important;
                    background: #17222c !important; max-height: none !important;
                }
                #rtt-telemetry-pane-drivers > #drivers-scrollbar { margin: 0 !important; }
                #rtt-telemetry-workspace .rtt-tab-view-title { display: block !important; position: static !important;
                    height: auto !important; font-size: 15px !important; font-weight: 700 !important;
                    margin: 0 0 12px !important; padding: 0 !important; border: 0 !important;
                    background: none !important; color: #eaf5fd !important; line-height: 1.3 !important; }
                #rtt-telemetry-workspace .rtt-tab-car-content { padding: 14px; }
                #rtt-telemetry-workspace .rtt-tab-car-body { min-width: 0; }
                #rtt-telemetry-workspace .rtt-tab-message { margin: 0; padding: 18px 14px; color: #acc2d0; }
                /* The existing panel generators now mount as DOCUMENT FLOW content,
                   not darkening/full-screen popups. Their interactive contents survive. */
                #rtt-telemetry-workspace .rtt-inline-tab-content {
                    box-sizing: border-box !important; display: block !important;
                    position: static !important; inset: auto !important; width: 100% !important;
                    height: auto !important; min-height: 0 !important; max-height: none !important;
                    margin: 0 !important; padding: 0 !important; overflow: visible !important;
                    background: transparent !important; box-shadow: none !important;
                    border: 0 !important; border-radius: 0 !important;
                    backdrop-filter: none !important; z-index: auto !important;
                }
                #rtt-telemetry-workspace .rtt-inline-tab-content > :is(.settings-popup-content,
                    .stats-panel-content, .history-panel-content, .info-panel-content, .download-popup-content) {
                    box-sizing: border-box !important; display: block !important;
                    position: static !important; width: 100% !important; min-width: 0 !important;
                    max-width: none !important; height: auto !important; max-height: none !important;
                    margin: 0 !important; padding: 13px !important;
                    border: 0 !important; border-radius: 0 !important;
                    background: transparent !important; box-shadow: none !important;
                    overflow: visible !important; flex: auto !important;
                }
                #rtt-telemetry-workspace :is(.settings-close,.stats-close,.history-close,.info-close,.download-close) { display: none !important; }
                #rtt-telemetry-workspace :is(.stats-content,.history-content,.settings-content,.download-content,.info-content) {
                    max-width: 100% !important; min-width: 0 !important;
                }
                #rtt-telemetry-workspace :is(.stats-content,.history-content) { overflow-x: auto !important; }
                #rtt-telemetry-workspace :is(.stats-content,.history-content) table { width: 100%; }
                @media (max-width: 480px) {
                    #telemetryControlsContainer[role="tablist"] > button[role="tab"] {
                        min-width: 57px !important; padding: 9px 11px !important; font-size: 12px !important;
                    }
                    #rtt-telemetry-workspace .rtt-inline-tab-content > :is(.settings-popup-content,
                        .stats-panel-content,.history-panel-content,.info-panel-content,.download-popup-content) { padding: 12px !important; }
                }
            `);
            this.stylesInstalled = true;
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
                GM_addStyle(RTT_V4_STYLES);
                GM_addStyle(RTT_BETA2_STYLES);
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
                if (root.style.getPropertyValue(property) !== value) {
                    root.style.setProperty(property, value);
                }
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
        .driver-telemetry-display .telemetry-stat-value { color: var(--telemetry-default-color); font-weight: 700; font-variant-numeric: tabular-nums; }
        .driver-telemetry-display .telemetry-status { justify-content: center; color: var(--telemetry-default-color); font-weight: 700; font-variant-numeric: tabular-nums; }
        .driver-progress-bars { display: flex; flex-direction: column; gap: 0; margin: 4px -8px -6px; }
        .driver-progress-bars[hidden] { display: none !important; }
        .custom-driver-item.map-selected .driver-progress-bars { margin-left: -5px; }
        .driver-progress-track { height: 2px; overflow: hidden; background: rgba(255,255,255,0.12); border-radius: 2px; }
        .driver-progress-fill { height: 100%; border-radius: inherit; transition: width 0.35s ease-out; }
        .driver-progress-full .driver-progress-fill { background: rgba(116, 192, 252, 0.72); }
        .driver-progress-lap .driver-progress-fill { background: rgba(129, 199, 132, 0.9); }
        body.telemetry-hidden .driver-telemetry-display, body.telemetry-hidden .driver-progress-bars { display: none !important; }
        .driver-details-toggle { width: 26px; height: 26px; margin-left: 6px; padding: 0; border: 1px solid var(--border-color); border-radius: 4px; background: rgba(0, 0, 0, 0.2); color: var(--text-color); cursor: pointer; font-size: 18px; line-height: 20px; flex-shrink: 0; }
        .driver-details-toggle:hover, .driver-details-toggle:focus-visible { background: var(--background-light); border-color: var(--panel-link-color); outline: none; }
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
        @media (max-width: 768px) { .custom-driver-item { padding: 5px; } .driver-info-row { margin-bottom: 4px; } .driver-name { min-width: 80px; } .driver-telemetry-display { font-size: 0.8em; min-width: 60px; margin-left: 5px; } .driver-telemetry-display .telemetry-column { min-width: 70px; } .driver-progress-bars { margin: 3px -5px -5px; } .custom-driver-item.map-selected .driver-progress-bars { margin-left: -2px; } #custom-driver-list-container { max-height: 350px; } .telemetry-download-button, .telemetry-info-button, .telemetry-history-button, .telemetry-stats-button, .telemetry-settings-button { font-size: 12px; padding: 5px 10px; } .settings-popup-content, .stats-panel-content, .history-panel-content, .info-panel-content, .download-popup-content { width: 95%; padding: 15px; } .settings-title, .stats-title, .history-title, .info-title, .download-title { font-size: 18px; } .settings-btn { padding: 8px 12px; font-size: 14px; } .stats-content table { font-size: 0.9em; } .stats-content th, .stats-content td { padding: 4px 6px; } .history-content table { font-size: 0.9em; } .history-content th, .history-content td { padding: 4px 6px; } }
        @media (max-width: 480px) { .driver-name { min-width: 60px; } .driver-telemetry-display { min-width: 55px; font-size: 0.75em; } .stats-content table { font-size: 0.85em; } .stats-content th, .stats-content td { padding: 3px 4px; } .history-content table { font-size: 0.85em; } .history-content th, .history-content td { padding: 3px 4px; } .settings-buttons { flex-direction: column; } .settings-data-buttons { flex-direction: column; } }
    `;

    // v4 visual layer: scoped to the userscript so Torn's own UI is unaffected.
    const RTT_V4_STYLES = `
      #custom-driver-list-container {
        border: 1px solid #35414e; border-radius: 12px; background: #141b23;
        scrollbar-color: #526576 #141b23; box-shadow: 0 6px 18px rgba(0,0,0,.18);
      }
      #custom-driver-list-container .custom-driver-item {
        border-bottom-color: rgba(189,202,219,.13); padding: 9px 10px;
        transition: background-color .14s ease;
      }
      #custom-driver-list-container .custom-driver-item:focus-visible {
        outline: 2px solid #8ed8ff; outline-offset: -3px;
      }
      #custom-driver-list-container .custom-driver-item.map-selected {
        padding-left: 7px; background: rgba(93,165,210,.15); border-left-color: #6ab9ed;
      }
      #custom-driver-list-container .driver-details-toggle {
        width: 38px; height: 38px; border-radius: 10px; margin-left: 8px;
        border: 1px solid rgba(182,202,222,.32); color: #ddf0ff;
        background: rgba(162,203,234,.08); font-size: 17px; font-weight: 600;
      }
      #custom-driver-list-container .driver-details-toggle:focus-visible,
      #custom-driver-list-container .driver-details-toggle:hover {
        border-color: #7abfec; background: rgba(110,185,234,.18);
      }
      #custom-driver-list-container .driver-name { color: #f1f5f9; }
      #custom-driver-list-container .driver-name .self-tag { color: #86cfb4; }
      #custom-driver-list-container .driver-progress-track { height: 3px; }
      #telemetryControlsContainer {
        display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;
        max-width: 100%; overflow-x: auto; overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: touch; scrollbar-width: thin; padding: 4px 0 8px;
      }
      #telemetryControlsContainer > button {
        white-space: nowrap; flex: 0 0 auto; min-height: 38px;
        border-radius: 9px; font-weight: 600;
      }
      body.rtt-inspector-open { overflow: hidden !important; }
      .rtt-inspector-backdrop {
        position: fixed; inset: 0; z-index: 2147483000;
        display: flex; align-items: flex-end; justify-content: center;
        background: rgba(5, 9, 14, .74); color: #eef4f9;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      }
      .rtt-inspector-backdrop[hidden] { display: none !important; }
      .rtt-inspector-panel {
        display: flex; flex-direction: column; width: 100%; height: min(83dvh, 760px);
        max-height: calc(100dvh - 12px); background: #151d26;
        border: 1px solid #344453; border-bottom: 0;
        border-radius: 20px 20px 0 0; box-sizing: border-box;
        box-shadow: 0 -16px 60px rgba(0,0,0,.45); overflow: hidden;
      }
      .rtt-inspector-panel * { box-sizing: border-box; }
      .rtt-inspector-grip { width: 34px; height: 4px; flex: 0 0 auto; border-radius: 4px;
        background: #536473; margin: 9px auto 0; }
      .rtt-inspector-header { display: flex; justify-content: space-between; gap: 15px;
        align-items: flex-start; padding: 14px 20px 16px; border-bottom: 1px solid #2c3945; }
      .rtt-inspector-identity { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
      .rtt-inspector-eyebrow { display: block !important; position: static !important; height: auto !important;
        line-height: 1.35 !important; margin: 0 !important; padding: 0 !important;
        color: #83a8bd !important; font-size: 10px !important; letter-spacing: .13em; font-weight: 750; }
      .rtt-inspector-name { display: block !important; position: static !important; height: auto !important;
        min-height: 0 !important; font-weight: 760 !important; color: #f4f8fc !important;
        font-size: clamp(20px, 5vw, 26px) !important; line-height: 1.25 !important;
        margin: 0 !important; padding: 0 !important; border: 0 !important; background: none !important;
        overflow-wrap: anywhere; }
      .rtt-inspector-subtitle { display: block !important; position: static !important; height: auto !important;
        color: #9fb0be !important; font-size: 12px !important; margin: 0 !important; padding: 0 !important;
        line-height: 1.45 !important; }
      .rtt-inspector-close { color: #cbd9e4; font-size: 29px; line-height: 1; background: #273340;
        border: 1px solid #425464; border-radius: 12px; width: 42px; height: 42px;
        cursor: pointer; flex-shrink: 0; }
      .rtt-inspector-close:hover, .rtt-inspector-close:focus-visible { background: #374c5c; outline: 2px solid #8dd0f9; }
      .rtt-inspector-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
        padding: 9px 14px 0; border-bottom: 1px solid #32404c; }
      .rtt-inspector-tab { cursor: pointer; border: 0; border-bottom: 3px solid transparent;
        background: transparent; color: #9aaebf; padding: 12px 8px 11px; font: inherit;
        font-size: 13px; font-weight: 650; border-radius: 7px 7px 0 0; }
      .rtt-inspector-tab[aria-selected="true"] { color: #def3ff; border-color: #76c4f5; background: #21303d; }
      .rtt-inspector-tab:focus-visible { outline: 2px solid #8dd0f9; outline-offset: -2px; }
      .rtt-inspector-content { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 18px 22px;
        overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
      .rtt-inspector-section { display: flex; flex-direction: column; gap: 15px; }
      .rtt-inspector-section-title { display: block !important; position: static !important; height: auto !important;
        line-height: 1.3 !important; margin: 0 !important; padding: 0 !important; border: 0 !important;
        background: none !important; font-size: 15px !important; font-weight: 700 !important; color: #e8f2fa !important; }
      .rtt-inspector-summary { padding: 17px; border: 1px solid #355468; border-radius: 13px;
        background: linear-gradient(120deg, #223b4b, #1b2a35); }
      .rtt-inspector-summary-overline { color: #8fb9d1; font-size: 10px; letter-spacing: .14em; font-weight: 700; }
      .rtt-inspector-summary-title { margin-top: 6px; font-size: 21px; font-weight: 700; color: #eef7fd; }
      .rtt-inspector-summary-sub { color: #afc3d1; margin-top: 4px; font-size: 12px; }
      .rtt-inspector-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .rtt-inspector-metric { min-height: 94px; padding: 14px 13px; border: 1px solid #354451;
        border-radius: 12px; background: #1b2630; display: flex; flex-direction: column; gap: 7px; }
      .rtt-inspector-metric.is-prominent { background: #203443; border-color: #416379; }
      .rtt-inspector-metric-label { color: #a6b9c9; letter-spacing: .025em; font-size: 11px; line-height: 1.3; }
      .rtt-inspector-metric-value { color: #f5f9fc; font-variant-numeric: tabular-nums;
        font-size: clamp(18px, 4.7vw, 25px); font-weight: 750; line-height: 1.1; overflow-wrap: anywhere; }
      .rtt-inspector-metric-note { color: #8c9eac; font-size: 10px; }
      .rtt-inspector-progress { display: grid; gap: 7px; }
      .rtt-inspector-progress-heading { display: flex; justify-content: space-between;
        color: #abbac8; font-size: 12px; font-variant-numeric: tabular-nums; }
      .rtt-inspector-progress-heading strong { color: #e9f3fa; }
      .rtt-inspector-progress-track { height: 7px; border-radius: 12px; background: #303e4b; overflow: hidden; }
      .rtt-inspector-progress-fill { background: #72c4f0; border-radius: 12px; height: 100%; transition: width .3s ease; }
      .rtt-inspector-info { margin: 0; font-size: 12px; color: #a8bac7; line-height: 1.6; }
      .rtt-inspector-profile, .rtt-inspector-retry { align-self: flex-start;
        padding: 10px 14px; background: #223647; border: 1px solid #49758d; border-radius: 8px;
        color: #a6dfff; font-size: 13px; text-decoration: none; cursor: pointer; }
      .rtt-inspector-footer { flex: 0 0 auto; border-top: 1px solid #2f3e4c;
        color: #8597a6; font-size: 10px; line-height: 1.3;
        padding: 11px 18px max(11px, env(safe-area-inset-bottom, 0px)); }
      /* The other large panels reuse the same responsive surface, not a 95vw overflow box. */
      .settings-popup, .stats-panel, .history-panel, .info-panel, .download-popup {
        z-index: 2147482000; box-sizing: border-box; padding: 10px;
      }
      .settings-popup-content, .stats-panel-content, .history-panel-content,
      .info-panel-content, .download-popup-content {
        box-sizing: border-box; border-radius: 15px; width: min(100%, 860px);
        max-width: 860px; height: auto; max-height: min(90dvh, 940px); border-color: #374553;
        background: #161e27; box-shadow: 0 22px 70px rgba(0,0,0,.5);
      }
      .settings-popup-content { max-width: 600px; }
      .stats-panel-content, .history-panel-content { max-width: 930px; }
      .stats-content table, .history-content table { min-width: 560px; }
      .stats-content, .history-content { overflow-x: auto; }
      .stats-summary-card, .history-summary-card { border-radius: 11px; padding: 13px; }
      .settings-item input, .settings-item select { min-height: 40px; }
      .stats-close, .history-close, .settings-close, .download-close, .info-close { min-width: 38px; min-height: 38px; }
      @media (min-width: 850px) {
        .rtt-inspector-backdrop { align-items: stretch; justify-content: flex-end; }
        .rtt-inspector-panel { height: 100dvh; max-height: 100dvh; width: min(460px, 42vw);
          border-radius: 18px 0 0 18px; border: 0; border-left: 1px solid #3b5363; }
        .rtt-inspector-grip { display: none; }
        .rtt-inspector-header { padding-top: 24px; }
      }
      @media (max-width: 600px) {
        .rtt-inspector-panel { height: min(83dvh, 780px); }
        .rtt-inspector-header { padding: 12px 16px 14px; }
        .rtt-inspector-content { padding: 16px 14px; }
        .settings-popup, .stats-panel, .history-panel, .info-panel, .download-popup {
          padding: 0; align-items: flex-end;
        }
        .settings-popup-content, .stats-panel-content, .history-panel-content,
        .info-panel-content, .download-popup-content {
          width: 100%; height: auto; max-height: 94dvh;
          flex: 0 1 auto; min-height: 0;
          border-radius: 18px 18px 0 0; border-bottom: none; padding: 18px 14px;
        }
        .history-summary-cards, .stats-summary-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        #custom-driver-list-container { max-height: none; }
        #custom-driver-list-container .driver-name { min-width: 0; }
        #custom-driver-list-container .driver-details-toggle { width: 38px; height: 38px; }
      }
      /* Touch layout: six collapsed racers fit without scrolling the leaderboard. */
      @media (hover: none), (pointer: coarse) {
        #custom-driver-list-container {
          max-height: none !important;
          overflow-y: visible !important;
          -webkit-overflow-scrolling: auto;
        }
        #custom-driver-list-container .custom-driver-item {
          padding: 3px 8px 5px;
          min-height: 48px;
          transition: none;
        }
        #custom-driver-list-container .custom-driver-item.map-selected { padding-left: 5px; }
        #custom-driver-list-container .driver-info-row { min-height: 38px; }
        #custom-driver-list-container .driver-details-toggle { width: 34px; height: 34px; }
        #custom-driver-list-container .driver-progress-bars { margin-top: 2px; margin-bottom: -5px; }
        #custom-driver-list-container .custom-driver-item:hover,
        #custom-driver-list-container .custom-driver-item.map-selected:hover {
          filter: none;
          background-color: transparent;
        }
        #custom-driver-list-container .custom-driver-item.map-selected:hover {
          background-color: rgba(93,165,210,.15);
        }
      }
      /* iOS Safari can retain :hover after a tap or while scrolling. Only enable
         hover styling on devices with an actual hover-capable fine pointer. */
      @media (hover: none) {
        .telemetry-info-button:hover, .telemetry-history-button:hover,
        .telemetry-stats-button:hover, .telemetry-settings-button:hover,
        .telemetry-download-button:hover, .driver-details-toggle:hover,
        .rtt-inspector-close:hover, .settings-close:hover, .stats-close:hover,
        .history-close:hover, .info-close:hover, .download-close:hover,
        .history-clear-button:hover, .download-content button:hover,
        .download-content button.primary:hover, .history-sort-btn:hover,
        .stats-sort-btn:hover, .settings-btn:hover, .settings-btn.primary:hover,
        .settings-btn.danger:hover {
          filter: none;
          box-shadow: none;
          text-decoration: none;
          background-color: var(--background-light);
        }
        .settings-content a:hover, .stats-content a:hover,
        .history-content a:hover, .info-content a:hover,
        .download-content a:hover, .api-tos-container a:hover {
          text-decoration: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .rtt-inspector-panel *, #custom-driver-list-container * { transition-duration: .01ms !important; animation: none !important; }
      }
    `;

    // Beta 2: coherent responsive layout, with no selectors targeting Torn's global UI.
    const RTT_BETA2_STYLES = `
      .rtt-inspector-backdrop { background: rgba(6, 10, 15, .48); }
      .rtt-inspector-panel {
        height: min(67dvh, 640px); background: #171d24;
        border-color: #384553; border-radius: 18px 18px 0 0;
        transition: height 180ms ease;
      }
      .rtt-inspector-panel.is-expanded { height: min(95dvh, 900px); }
      .rtt-inspector-header { align-items: center; padding: 12px 16px 12px; gap: 10px; }
      .rtt-inspector-identity { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
      .rtt-inspector-eyebrow { display: block !important; position: static !important; height: auto !important;
        line-height: 1.35 !important; margin: 0 !important; font-size: 10px !important;
        letter-spacing: .1em; color: #91aab9 !important; }
      .rtt-inspector-name { display: block !important; position: static !important; height: auto !important;
        margin: 0 !important; padding: 0 !important; font-size: 20px !important;
        line-height: 1.25 !important; color: #f4f8fc !important; }
      .rtt-inspector-subtitle { display: block !important; position: static !important; height: auto !important;
        margin: 0 !important; font-size: 12px !important; line-height: 1.4 !important; color: #9fb0be !important; }
      .rtt-inspector-actions { display: flex; align-items: center; gap: 7px; flex: 0 0 auto; }
      .rtt-inspector-expand { background: #27323d; border: 1px solid #475664; border-radius: 8px;
        color: #dbe8f1; min-height: 36px; padding: 0 10px; font-size: 12px; cursor: pointer; }
      .rtt-inspector-close { width: 37px; height: 37px; border-radius: 9px; font-size: 25px; }
      .rtt-inspector-tabs { padding: 3px 12px 0; gap: 3px; }
      .rtt-inspector-tab { padding: 9px 5px; min-height: 40px; }
      .rtt-inspector-content { padding: 12px 14px 16px; }
      .rtt-inspector-section { gap: 10px; }
      .rtt-inspector-summary { padding: 12px 14px; border-radius: 10px; background: #1d303b; }
      .rtt-inspector-summary-overline { font-size: 9px; }
      .rtt-inspector-summary-title { font-size: 17px; margin-top: 4px; }
      .rtt-inspector-summary-sub { font-size: 11px; margin-top: 3px; }
      .rtt-inspector-grid { gap: 7px; }
      .rtt-inspector-metric { min-height: 68px; padding: 10px 12px; border-radius: 9px; gap: 5px; }
      .rtt-inspector-metric-label { font-size: 10px; }
      .rtt-inspector-metric-value { font-size: clamp(17px, 4.4vw, 23px); }
      .rtt-inspector-metric-note { font-size: 9px; }
      .rtt-inspector-footer { padding: 7px 14px max(9px, env(safe-area-inset-bottom, 0px)); font-size: 9px; }
      .rtt-panel-workspace { min-width: 0; }
      .rtt-panel-navigation { display: flex; align-items: stretch; position: sticky; top: 0; z-index: 3;
        gap: 4px; padding: 4px; background: #202933; border: 1px solid #364653;
        border-radius: 11px; margin-bottom: 14px; }
      .rtt-panel-nav-button { flex: 1; min-width: 0; min-height: 40px; border: 0; border-radius: 8px;
        padding: 8px 8px; background: transparent; color: #abbecb; cursor: pointer;
        font: 600 12px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; white-space: nowrap; }
      .rtt-panel-nav-button[aria-selected="true"] { background: #344c5d; color: #f0f8fd;
        box-shadow: inset 0 0 0 1px #4a728b; }
      .rtt-panel-nav-button:focus-visible { outline: 2px solid #8cd5ff; outline-offset: -2px; }
      .rtt-panel-section[hidden] { display: none !important; }
      .rtt-panel-section { min-width: 0; }
      .settings-popup-content, .stats-panel-content, .history-panel-content,
      .info-panel-content, .download-popup-content {
        background: #171e26; color: #e7eff6; overflow: hidden; display: flex; flex-direction: column;
        font: 13px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .settings-title, .stats-title, .history-title, .info-title, .download-title {
        position: relative; flex: 0 0 auto; padding: 2px 0 12px; margin: 0;
        font-size: 17px; color: #e5f1fb; letter-spacing: -.015em;
      }
      .settings-content, .stats-content, .history-content, .info-content, .download-content {
        min-height: 0; flex: 1 1 auto; overflow-y: auto; overflow-x: hidden;
        padding: 12px 1px 18px; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
      }
      .settings-item { background: #202a35; border: 1px solid #344453; border-radius: 10px;
        padding: 11px 12px; margin: 0 0 9px; }
      .settings-item label:not(.switch) { font-size: 12px; font-weight: 600; }
      .settings-item small { line-height: 1.45; }
      .settings-content .toggle-container { min-height: 30px; }
      .settings-content .telemetry-options-group { border: 0; background: transparent; padding: 0; }
      .settings-content .rtt-settings-group { display: grid; gap: 1px; }
      .rtt-panel-footer-actions { flex: 0 0 auto; display: flex; flex-wrap: wrap;
        gap: 8px; padding: 12px 0 0; border-top: 1px solid #344453; margin-top: 0; }
      .rtt-panel-footer-actions button { flex: 1; min-height: 41px; }
      .settings-data-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
      .settings-data-buttons button { flex: 1; min-height: 38px; }
      .stats-content h3, .history-content h3 { font-size: 15px; border-bottom: 0; color: #e5f0f8;
        margin: 17px 0 10px; }
      .stats-content h4 { font-size: 13px; }
      .stats-summary-cards, .stats-delta-cards, .history-summary-cards {
        grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .stats-summary-card, .history-summary-card { padding: 11px 12px; min-width: 0;
        background: #202b36; border: 1px solid #354958; border-radius: 10px; }
      .stats-summary-value, .history-summary-value { overflow-wrap: anywhere; font-size: 17px; }
      .stats-summary-label, .history-summary-label { font-size: 10px; letter-spacing: .025em; line-height: 1.35; }
      .stats-content table, .history-content table { width: 100%; min-width: 0; font-size: 12px; }
      .stats-content th, .stats-content td, .history-content th, .history-content td {
        padding: 8px 9px !important; border-color: #364654; vertical-align: middle; }
      .stats-content td { padding: 8px 9px !important; }
      .stats-content table th, .history-content table th { background: #283543; }
      .stats-content .rtt-panel-section table, .history-content .rtt-panel-section table {
        display: block; overflow-x: auto; -webkit-overflow-scrolling: touch;
        max-width: 100%; border-radius: 9px; }
      .stats-content .rtt-panel-section table tbody, .history-content .rtt-panel-section table tbody { white-space: nowrap; }
      .history-race-timeline { gap: 8px; }
      .history-race-item { border-radius: 10px; padding: 10px 11px; }
      .info-content h3 { font-size: 14px; }
      .rtt-info-notes { background: #202b36; border: 1px solid #354958;
        border-radius: 10px; padding: 12px; margin-top: 16px; }
      .rtt-info-notes summary { cursor: pointer; font-size: 13px; font-weight: 650; }
      .rtt-info-notes li { margin: 9px 0; font-size: 12px; }
      .api-tos-container table { display: block; overflow-x: auto; max-width: 100%; }
      #telemetryControlsContainer { gap: 5px; }
      #telemetryControlsContainer > button { min-height: 36px; border-radius: 8px; }
      @media (min-width: 850px) {
        .rtt-inspector-panel, .rtt-inspector-panel.is-expanded { height: 100dvh; }
        .rtt-inspector-expand { display: none; }
        .settings-popup-content, .stats-panel-content, .history-panel-content { padding: 20px 24px; }
        .rtt-panel-navigation { max-width: 550px; }
      }
      @media (max-width: 600px) {
        .rtt-inspector-panel { height: min(61dvh, 570px); }
        .rtt-inspector-panel.is-expanded { height: min(94dvh, 900px); }
        .rtt-inspector-grip { margin-top: 7px; }
        .settings-popup-content, .stats-panel-content, .history-panel-content,
        .info-panel-content, .download-popup-content {
          padding: 13px 14px max(14px, env(safe-area-inset-bottom, 0px));
          height: auto; max-height: 94dvh; border-radius: 17px 17px 0 0;
        }
        .rtt-panel-navigation { margin-bottom: 10px; }
        .stats-content, .history-content { font-size: 12px; }
        .history-race-main { gap: 4px; flex-wrap: wrap; }
      }
      @media (prefers-reduced-motion: reduce) {
        .rtt-inspector-panel { transition: none; }
      }
    `;

    // Keep secondary actions visually subordinate to the live leaderboard.
    GM_addStyle(`
      #telemetryControlsContainer {
        display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;
        gap: 0; margin: 0 0 2px; padding: 0; width: 100%; max-width: 100%; overflow: hidden;
        background: transparent; border: 0; box-shadow: none;
      }
      #telemetryControlsContainer > :is(.telemetry-info-button, .telemetry-history-button,
        .telemetry-stats-button, .telemetry-settings-button, .telemetry-download-button) {
        flex: 1 1 0; min-width: 0; min-height: 34px; padding: 6px 2px; margin: 0; text-align: center;
        border: 1px solid transparent; border-radius: 6px;
        background: transparent; box-shadow: none; color: #9aafbd;
        font: 500 11px/1.25 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0; text-shadow: none; transition: none;
        -webkit-tap-highlight-color: transparent;
      }
      #telemetryControlsContainer > .telemetry-settings-button {
        margin-left: 0; border-left-color: transparent; border-radius: 6px;
      }
      #telemetryControlsContainer > :is(.telemetry-info-button, .telemetry-history-button,
        .telemetry-stats-button, .telemetry-settings-button, .telemetry-download-button):focus-visible {
        outline: 2px solid #83b9dc; outline-offset: 1px;
      }
      @media (hover: hover) and (pointer: fine) {
        #telemetryControlsContainer > :is(.telemetry-info-button, .telemetry-history-button,
          .telemetry-stats-button, .telemetry-settings-button, .telemetry-download-button):hover {
          color: #e2eff8; background: #293744; border-color: #405260;
        }
      }
      @media (hover: none), (pointer: coarse) {
        #telemetryControlsContainer > :is(.telemetry-info-button, .telemetry-history-button,
          .telemetry-stats-button, .telemetry-settings-button, .telemetry-download-button),
        #telemetryControlsContainer > :is(.telemetry-info-button, .telemetry-history-button,
          .telemetry-stats-button, .telemetry-settings-button, .telemetry-download-button):hover,
        #telemetryControlsContainer > :is(.telemetry-info-button, .telemetry-history-button,
          .telemetry-stats-button, .telemetry-settings-button, .telemetry-download-button):active {
          color: #9aafbd; background: transparent; box-shadow: none;
        }
      }
      @media (max-width: 480px) {
        #telemetryControlsContainer { flex-wrap: nowrap; gap: 0; justify-content: stretch; }
        #telemetryControlsContainer > :is(.telemetry-info-button, .telemetry-history-button,
          .telemetry-stats-button, .telemetry-settings-button, .telemetry-download-button) {
          flex: 1 1 0; min-width: 0; min-height: 34px; padding: 6px 2px; font-size: 11px;
        }
      }
    `);

// Beta 5: equal-width secondary navigation and no empty band above the leaderboard.
    GM_addStyle(`
      #telemetryControlsContainer {
        box-sizing: border-box; width: 100%; margin-top: 0 !important;
        margin-bottom: 2px !important; padding: 0 !important;
        justify-content: stretch !important; align-items: stretch !important;
        flex-wrap: nowrap !important; overflow: hidden !important;
      }
      #telemetryControlsContainer > button {
        box-sizing: border-box; flex: 1 1 0 !important; min-width: 0 !important;
        max-width: none !important; width: 0; text-align: center !important;
      }
      #telemetryControlsContainer + #custom-driver-list-container { margin-top: 0 !important; }
      @media (hover: none), (pointer: coarse) {
        #telemetryControlsContainer > button:hover { background: transparent !important; box-shadow: none !important; }
      }
    `);

    function toggleDetails(event) {
        const driverItem = event.target.closest('.custom-driver-item');
        if (!driverItem || State.isUpdating) return;
        if (event.target.closest('.driver-details-toggle')) {
            event.preventDefault();
            event.stopPropagation();
            DriverInspector.open(driverItem.dataset.userId, driverItem.dataset.originalId, event.target.closest('button'));
            return;
        }
        if (!event.target.closest('a')) RaceManager.selectDriverOnMap(driverItem.dataset.originalId);
    }

    function cleanupScriptState(reason = "Unknown") {
        LiveMapIntegration.disconnect();
        RaceInfoIntegration.disconnect();
        DriverInspector.close(false);
        TabWorkspace.disconnect();
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
                State.customUIContainer.addEventListener('keydown', event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    if (event.target.closest('button, a')) return;
                    const item = event.target.closest('.custom-driver-item');
                    if (!item) return;
                    event.preventDefault();
                    RaceManager.selectDriverOnMap(item.dataset.originalId);
                });
            }

            UI.initializeControls();
            RaceInfoIntegration.install();
            LiveMapIntegration.install();
            TabWorkspace.install();
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
                                 State.resetRaceState();
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
