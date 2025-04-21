// ==UserScript==
// @name         Torn Racing Telemetry
// @namespace    https://www.torn.com/profiles.php?XID=2782979
// @version      2.5.1
// @description  Enhances Torn Racing with real-time telemetry, race stats history, accurate race information, and detailed logs.
// @match        https://www.torn.com/page.php?sid=racing*
// @match        https://www.torn.com/loader.php?sid=racing*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_connect
// @connect      api.torn.com
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/522245/Torn%20Racing%20Telemetry.user.js
// @updateURL https://update.greasyfork.org/scripts/522245/Torn%20Racing%20Telemetry.meta.js
// ==/UserScript==

(function() {
    'use strict';

    if (window.racingTelemetryScriptHasRun) return;
    window.racingTelemetryScriptHasRun = true;

    // ===== CORE CONFIG & STATE MANAGEMENT =====
    const Config = {
        defaults: {
            displayMode: 'speed',
            colorCode: true,
            animateChanges: true,
            speedUnit: 'mph',
            periodicCheckInterval: 1000, // Hardcoded to 1 second (1000ms)
            minUpdateInterval: 500,
            language: 'en',
            apiKey: ''
        },
        
        data: {}, // Will hold current configuration
        
        // Load config with safe JSON parsing
        load() {
            this.data = Object.assign({}, this.defaults, (() => {
                const savedConfig = GM_getValue('racingTelemetryConfig', null);
                if (savedConfig) {
                    try {
                        return JSON.parse(savedConfig);
                    } catch (e) {
                        console.error("Error parsing saved config, using default:", e);
                        return {};
                    }
                }
                return {};
            })());
            return this.data;
        },
        
        // Save config
        save() {
            GM_setValue('racingTelemetryConfig', JSON.stringify(this.data));
        },
        
        // Get config value
        get(key) {
            return this.data[key];
        },
        
        // Set config value and save
        set(key, value) {
            this.data[key] = value;
            this.save();
        }
    };

    // Application state
    const State = {
        previousMetrics: {},
        trackInfo: { total: 0, laps: 0, length: 0 },
        racingStats: null,
        statsHistory: [],
        raceLog: [],
        currentCar: null,
        preciseSkill: null,
        carClass: null,
        currentRaceId: null,
        raceStarted: false,
        periodicCheckIntervalId: null,
        telemetryVisible: true,
        observers: [],
        lastUpdateTimes: {},
        
        // Initialize state from storage
        init() {
            // Load stats history
            let savedStatsHistory = GM_getValue('statsHistory', []);
            if (!Array.isArray(savedStatsHistory)) savedStatsHistory = [];
            this.statsHistory = savedStatsHistory.filter(entry => entry && entry.timestamp && entry.skill).slice(0, 50);
            
            // Load race log
            const savedRaces = GM_getValue('raceLog', []);
            this.raceLog = (Array.isArray(savedRaces) ? savedRaces.filter(r => r?.id).slice(0, 50) : []);
            
            return this;
        },
        
        // Reset race state
        resetRace() {
            this.previousMetrics = {};
            this.trackInfo = { total: 0, laps: 0, length: 0 };
            this.raceStarted = false;
            clearInterval(this.periodicCheckIntervalId);
            this.periodicCheckIntervalId = null;
            this.observers.forEach(obs => obs.disconnect());
            this.observers = [];
            this.lastUpdateTimes = {};
        },
        
        // Save state item to storage
        save(key) {
            if (key === 'statsHistory') {
                GM_setValue('statsHistory', this.statsHistory);
            } else if (key === 'raceLog') {
                GM_setValue('raceLog', this.raceLog);
            } else if (key === 'racingStats') {
                GM_setValue('racingStats', JSON.stringify(this.racingStats));
            }
        }
    };

    // ===== UTILITY FUNCTIONS =====
    const Utils = {
        convertSpeed(speed, unit) {
            return unit === 'kmh' ? speed * 1.60934 : speed;
        },
        
        formatTime(seconds) {
            const minutes = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
        },
        
        parseTime(timeString) {
            if (!timeString || !timeString.includes(':')) return 0;
            const parts = timeString.split(':');
            let minutes = 0;
            let seconds = 0;

            if (parts.length === 2) { // MM:SS.SS or MM:SS.HH format
                minutes = parseInt(parts[0], 10) || 0;
                seconds = parseFloat(parts[1]) || 0; // Parse seconds with decimal part
            } else if (parts.length === 3) { // Optional HH:MM:SS.SS format in future?
                // If we ever encounter HH:MM:SS.SS, handle it here. For now assume MM:SS.SS is standard.
                console.warn("Time string with 3 parts encountered, assuming HH:MM:SS.SS and taking last two parts as MM:SS.SS:", timeString);
                minutes = parseInt(parts[1], 10) || 0;
                seconds = parseFloat(parts[2]) || 0;
            } else {
                console.error("Unexpected time string format:", timeString);
                return 0; // Or handle error as needed
            }

            return (minutes * 60) + seconds; // Total seconds
        },
        
        parseProgress(text) {
            const match = text.match(/(\d+\.?\d*)%/);
            return match ? parseFloat(match[1]) : 0;
        },
        
        displayError(message) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position: fixed; bottom: 10px; right: 10px; background: #f44336; color: #fff; padding: 10px; border-radius: 5px;';
            errorDiv.textContent = message;
            document.body.appendChild(errorDiv);
            setTimeout(() => errorDiv.remove(), 5000);
        },
        
        async fetchWithRetry(url, retries = 3) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            } catch (e) {
                if (retries > 0) return this.fetchWithRetry(url, retries - 1);
                throw e;
            }
        },
        
        formatTimestamp(timestamp) {
            let date;
            
            // Handle different timestamp formats
            if (typeof timestamp === 'number') {
                // If timestamp is a small number (seconds instead of milliseconds)
                if (timestamp < 10000000000) {
                    date = new Date(timestamp * 1000);
                } else {
                    date = new Date(timestamp);
                }
            } else if (typeof timestamp === 'string') {
                // Try to parse string timestamp
                if (timestamp.match(/^\d+$/)) {
                    // If it's all digits, treat as a number
                    const num = parseInt(timestamp, 10);
                    if (num < 10000000000) {
                        date = new Date(num * 1000);
                    } else {
                        date = new Date(num);
                    }
                } else {
                    // Otherwise just parse as date string
                    date = new Date(timestamp);
                }
            } else {
                return 'N/A';
            }

            if (isNaN(date) || date.getFullYear() < 2000) {
                return 'Invalid Date';
            }

            // Format as a more readable date/time string
            const options = { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            };
            
            return date.toLocaleDateString(undefined, options);
        },
        
        formatChange(oldVal, newVal) {
            const change = newVal - oldVal;
            if (change > 0) {
                return `<span style="color: #4CAF50;">${oldVal} → ${newVal} (+${change})</span>`;
            } else if (change < 0) {
                return `<span style="color: #f44336;">${oldVal} → ${newVal} (${change})</span>`;
            } else {
                return `${oldVal} → ${newVal} (no change)`;
            }
        },
        
        // Get color for stat value
        getStatColor(value) {
            if (value >= 80) return '#4CAF50'; // Green for high values
            if (value >= 60) return '#8BC34A'; // Light green
            if (value >= 40) return '#FFC107'; // Yellow/amber
            if (value >= 20) return '#FF9800'; // Orange
            return '#F44336'; // Red for low values
        }
    };

    // ===== DATA MANAGEMENT =====
    const DataManager = {
        async fetchRacingStats() {
            if (!Config.get('apiKey')?.trim()) return;
            try {
                const data = await Utils.fetchWithRetry(
                    `https://api.torn.com/v2/user/personalstats?cat=racing&key=${Config.get('apiKey')}`
                );
                if (data.error) throw new Error(data.error.error);
                this.processStats(data.personalstats.racing);
            } catch (e) {
                console.error('Stats fetch failed:', e);
                Utils.displayError(`API Error: ${e.message}`);
            }
        },
        
        processStats(newStats) {
            const oldStats = State.racingStats?.racing;
            const changes = {
                timestamp: Date.now(),
                skill: { old: oldStats?.skill || 0, new: newStats.skill },
                points: { old: oldStats?.points || 0, new: newStats.points },
                racesEntered: { old: oldStats?.races?.entered || 0, new: newStats.races?.entered },
                racesWon: { old: oldStats?.races?.won || 0, new: newStats.races?.won }
            };

            if (!oldStats || JSON.stringify(changes) !== JSON.stringify(oldStats)) {
                State.statsHistory.unshift(changes);
                State.statsHistory = State.statsHistory.slice(0, 50);
                State.save('statsHistory');
            }
            State.racingStats = { racing: newStats };
            State.save('racingStats');
            
            // Update UI if needed
            const statsPanelContent = document.querySelector('.stats-history-popup .popup-content');
            if (statsPanelContent) {
                statsPanelContent.innerHTML = UI.generateStatsContent();
            }
        },
        
        async fetchRaces() {
            if (!Config.get('apiKey')?.trim()) return;
            try {
                const data = await Utils.fetchWithRetry(
                    `https://api.torn.com/v2/user/races?key=${Config.get('apiKey')}&limit=10&sort=DESC&cat=official`
                );
                // First process all races to store the basic information
                if (data.races) {
                    data.races.forEach(race => this.processRace(race));
                    State.save('raceLog');
                }
                
                // Update the panel if it's open
                const racesPanelContent = document.querySelector('.recent-races-popup .popup-content');
                if (racesPanelContent) {
                    racesPanelContent.innerHTML = UI.generateRacesContent();
                }
            } catch (e) {
                console.error('Race fetch failed:', e);
                Utils.displayError(`Race data error: ${e.message}`);
            }
        },
        
        processRace(race) {
            const existingRaceIndex = State.raceLog.findIndex(r => r.id === race.id);
            
            if (existingRaceIndex !== -1) {
                // Update existing race with any new information
                const existingRace = State.raceLog[existingRaceIndex];
                // Preserve track information if we already have it
                const trackName = existingRace.trackName || null;
                const trackLength = existingRace.trackLength || null;
                const trackDescription = existingRace.trackDescription || null;
                
                // Update the race with new data from API but keep our track info
                State.raceLog[existingRaceIndex] = { 
                    ...race, 
                    fetchedAt: Date.now(),
                    trackName, 
                    trackLength, 
                    trackDescription
                };
            } else if (race?.id) {
                // Add new race
                State.raceLog.unshift({ 
                    ...race, 
                    fetchedAt: Date.now(),
                    trackName: null,
                    trackLength: null,
                    trackDescription: null
                });
                State.raceLog = State.raceLog.slice(0, 50);
            }
        },
        
        updateRaceWithTrackInfo(raceId, trackInfo) {
            if (!raceId || !trackInfo) return;
            
            console.log('Updating race with track info:', raceId, trackInfo);
            
            const index = State.raceLog.findIndex(r => r.id === raceId);
            if (index !== -1) {
                State.raceLog[index].trackName = trackInfo.name || State.raceLog[index].trackName;
                State.raceLog[index].trackLength = trackInfo.length || State.raceLog[index].trackLength;
                State.raceLog[index].trackDescription = trackInfo.description || State.raceLog[index].trackDescription;
                
                // Update storage
                State.save('raceLog');
                
                // Update UI if panel is open
                const racesPanelContent = document.querySelector('.recent-races-popup .popup-content');
                if (racesPanelContent) {
                    racesPanelContent.innerHTML = UI.generateRacesContent();
                }
                
                return true;
            }
            
            return false;
        }
    };

    // ===== TELEMETRY CALCULATIONS =====
    const Telemetry = {
        // Easing function: easeInOutQuad ramps up then down.
        easeInOutQuad(t) {
            return t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
        },

        // Helper to interpolate between two colors.
        interpolateColor(color1, color2, factor) {
            const result = color1.map((c, i) => Math.round(c + factor * (color2[i] - c)));
            return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
        },

        // Returns a color based on acceleration (in g's). If color coding is disabled, always return grey.
        getTelemetryColor(acceleration) {
            const grey = [136, 136, 136];
            if (!Config.get('colorCode')) return `rgb(${grey[0]}, ${grey[1]}, ${grey[2]})`;
            const green = [76, 175, 80];
            const red = [244, 67, 54];
            const maxAcc = 1.0;
            let factor = Math.min(Math.abs(acceleration) / maxAcc, 1);
            if (acceleration > 0) {
                return this.interpolateColor(grey, green, factor);
            } else if (acceleration < 0) {
                return this.interpolateColor(grey, red, factor);
            } else {
                return `rgb(${grey[0]}, ${grey[1]}, ${grey[2]})`;
            }
        },

        // Animate telemetry text using an easeInOut function over a dynamic duration.
        animateTelemetry(element, fromSpeed, toSpeed, fromAcc, toAcc, duration, displayMode, speedUnit, extraText) {
            let startTime = null;
            const easeFunction = this.easeInOutQuad;
            const getColor = this.getTelemetryColor.bind(this);
            
            function step(timestamp) {
                if (!startTime) startTime = timestamp;
                let linearProgress = (timestamp - startTime) / duration;
                if (linearProgress > 1) linearProgress = 1;
                let progress = easeFunction(linearProgress);
                let currentSpeed = fromSpeed + (toSpeed - fromSpeed) * progress;
                let currentAcc = fromAcc + (toAcc - fromAcc) * progress;
                element._currentSpeed = currentSpeed;
                element._currentAcc = currentAcc;
                let color = Config.get('colorCode') ? getColor(currentAcc) : 'rgb(136, 136, 136)';
                let text;
                if (displayMode === 'speed') {
                    text = `${Math.round(currentSpeed)} ${speedUnit}`;
                } else if (displayMode === 'acceleration') {
                    text = `${currentAcc.toFixed(1)} g`;
                } else {
                    text = `${Math.round(currentSpeed)} ${speedUnit} | ${currentAcc.toFixed(1)} g`;
                }
                text += extraText;
                element.textContent = text;
                element.style.color = color;
                if (linearProgress < 1) {
                    element._telemetryAnimationFrame = requestAnimationFrame(step);
                } else {
                    element._telemetryAnimationFrame = null;
                }
            }
            
            if (element._telemetryAnimationFrame) {
                cancelAnimationFrame(element._telemetryAnimationFrame);
            }
            element._telemetryAnimationFrame = requestAnimationFrame(step);
        },

        calculateDriverMetrics(driverId, progressPercentage, timestamp) {
            const prev = State.previousMetrics[driverId] || {
                progress: progressPercentage,
                time: timestamp,
                instantaneousSpeed: 0,
                reportedSpeed: 0,
                acceleration: 0,
                lastDisplayedSpeed: 0,
                lastDisplayedAcceleration: 0,
                firstUpdate: true
            };
            
            let dt = (timestamp - prev.time) / 1000;
            const minDt = Config.get('minUpdateInterval') / 1000;
            const effectiveDt = dt < minDt ? minDt : dt;
            
            if (dt <= 0) {
                State.previousMetrics[driverId] = prev;
                return { speed: prev.reportedSpeed, acceleration: prev.acceleration, timeDelta: effectiveDt };
            }
            
            const distanceDelta = State.trackInfo.total * (progressPercentage - prev.progress) / 100;
            const currentInstantaneousSpeed = (distanceDelta / effectiveDt) * 3600;
            let averagedSpeed;
            
            if (prev.firstUpdate) {
                averagedSpeed = currentInstantaneousSpeed;
            } else {
                averagedSpeed = (prev.instantaneousSpeed + currentInstantaneousSpeed) / 2;
            }
            
            let acceleration;
            if (prev.firstUpdate) {
                acceleration = 0;
            } else {
                acceleration = ((averagedSpeed - prev.reportedSpeed) / effectiveDt) * 0.44704 / 9.81;
            }
            
            State.previousMetrics[driverId] = {
                progress: progressPercentage,
                time: timestamp,
                instantaneousSpeed: currentInstantaneousSpeed,
                reportedSpeed: averagedSpeed,
                acceleration: acceleration,
                lastDisplayedSpeed: prev.lastDisplayedSpeed || averagedSpeed,
                lastDisplayedAcceleration: prev.lastDisplayedAcceleration || acceleration,
                firstUpdate: false
            };
            
            return { speed: Math.abs(averagedSpeed), acceleration: acceleration, timeDelta: effectiveDt };
        },

        updateDriverDisplay(driverElement, percentageText, progressPercentage) {
            try {
                const driverId = driverElement?.id;
                if (!driverId) return;
                
                const now = Date.now();
                if (now - (State.lastUpdateTimes[driverId] || 0) < Config.get('minUpdateInterval')) return;
                State.lastUpdateTimes[driverId] = now;
                
                const nameEl = driverElement.querySelector('.name');
                const timeEl = driverElement.querySelector('.time');
                const statusEl = driverElement.querySelector('.status-wrap div');
                if (!nameEl || !timeEl || !statusEl) return;
                
                let statusText = nameEl.querySelector('.driver-status') || document.createElement('span');
                statusText.className = 'driver-status';
                if (!statusText.parentElement) nameEl.appendChild(statusText);

                const infoSpot = document.getElementById('infoSpot');
                if (infoSpot && infoSpot.textContent.trim().toLowerCase() === 'race starting') {
                    statusText.textContent = '🛑 NOT STARTED';
                    statusText.style.color = 'rgb(136, 136, 136)';
                    return;
                }

                // Check if ANY driver has started reporting time
                let raceHasBegun = false;
                const allDriverTimes = document.querySelectorAll('#leaderBoard li[id^="lbr-"] .time');
                for (const timeElement of allDriverTimes) {
                    if (timeElement.textContent.trim() && timeElement.textContent.trim() !== '0%') {
                        raceHasBegun = true;
                        break;
                    }
                }

                if (!raceHasBegun && !(infoSpot && infoSpot.textContent.trim().toLowerCase() === 'race finished')) {
                    statusText.textContent = '🛑 NOT STARTED';
                    statusText.style.color = 'rgb(136, 136, 136)';
                    return;
                }

                const isFinished = ['finished', 'gold', 'silver', 'bronze'].some(cls => statusEl.classList.contains(cls));
                if (isFinished) {
                    const finishTime = Utils.parseTime(timeEl.textContent);
                    const avgSpeed = finishTime > 0 ? (State.trackInfo.total / finishTime) * 3600 : 0;
                    const avgSpeedFormatted = Math.round(Utils.convertSpeed(avgSpeed, Config.get('speedUnit')));
                    statusText.textContent = `🏁 ${avgSpeedFormatted} ${Config.get('speedUnit')}`;
                    statusText.style.color = 'rgb(136, 136, 136)';
                } else {
                    const metrics = this.calculateDriverMetrics(driverId, progressPercentage, now);
                    const targetSpeed = Math.round(Utils.convertSpeed(metrics.speed, Config.get('speedUnit')));
                    const targetSpeedFormatted = targetSpeed.toLocaleString(undefined, { maximumFractionalDigits: 0 });
                    let extraText = "";
                    
                    if (driverElement.classList.contains('selected')) {
                        const pdLapEl = document.querySelector('#racingdetails .pd-lap');
                        if (pdLapEl) {
                            const [currentLap, totalLaps] = pdLapEl.textContent.split('/').map(Number);
                            const lapPercentage = 100 / totalLaps;
                            const progressInLap = (progressPercentage - (currentLap - 1) * lapPercentage) / lapPercentage * 100;
                            const remainingDistance = State.trackInfo.length * (1 - progressInLap / 100);
                            if (metrics.speed > 0) {
                                const estTime = (remainingDistance / metrics.speed) * 3600;
                                extraText = ` | Est. Lap: ${Utils.formatTime(estTime)}`;
                            }
                        }
                    }
                    
                    if (Config.get('animateChanges')) {
                        let fromSpeed = (statusText._currentSpeed !== undefined) ? 
                            statusText._currentSpeed : State.previousMetrics[driverId].lastDisplayedSpeed;
                        let fromAcc = (statusText._currentAcc !== undefined) ? 
                            statusText._currentAcc : State.previousMetrics[driverId].lastDisplayedAcceleration;
                        let toSpeed = targetSpeed;
                        let toAcc = metrics.acceleration;
                        let duration = metrics.timeDelta * 1000;
                        
                        this.animateTelemetry(
                            statusText, fromSpeed, toSpeed, fromAcc, toAcc, 
                            duration, Config.get('displayMode'), Config.get('speedUnit'), extraText
                        );
                        
                        State.previousMetrics[driverId].lastDisplayedSpeed = toSpeed;
                        State.previousMetrics[driverId].lastDisplayedAcceleration = toAcc;
                    } else {
                        let text;
                        if (Config.get('displayMode') === 'speed') {
                            text = `${targetSpeedFormatted} ${Config.get('speedUnit')}`;
                        } else if (Config.get('displayMode') === 'acceleration') {
                            text = `${metrics.acceleration.toFixed(1)} g`;
                        } else {
                            text = `${targetSpeedFormatted} ${Config.get('speedUnit')} | ${metrics.acceleration.toFixed(1)} g`;
                        }
                        text += extraText;
                        statusText.textContent = text;
                        statusText.style.color = Config.get('colorCode') ? 
                            this.getTelemetryColor(metrics.acceleration) : 'rgb(136, 136, 136)';
                    }
                }
            } catch (e) {
                console.error('Driver display update failed:', e);
            }
        }
    };

    // ===== UI MANAGEMENT =====
    const UI = {
        setupStyles() {
            GM_addStyle(`
                :root {
                    --primary-color: #4CAF50;
                    --background-dark: #1a1a1a;
                    --background-light: #2a2a2a;
                    --text-color: #e0e0e0;
                    --border-color: #404040;
                    --accent-color: #64B5F6;
                    --highlight-color: #FFD54F;
                    --positive-color: #4CAF50;
                    --negative-color: #f44336;
                }
                body.telemetry-hidden #telemetryButtonContainer {
                    margin-bottom: 0;
                }
                .telemetry-button-container {
                    display: flex;
                    width: 100%;
                    margin: 0 0px 0px;
                    border-radius: 6px;
                    overflow: hidden;
                    background: var(--background-dark);
                    border: 1px solid var(--border-color);
                }
                .telemetry-button {
                    flex-grow: 1;
                    background: transparent;
                    color: var(--text-color);
                    border: none;
                    padding: 12px 15px;
                    text-align: center;
                    cursor: pointer;
                    transition: background-color 0.2s ease, color 0.2s ease;
                    font-size: 15px;
                }
                .telemetry-button:hover {
                    background-color: var(--background-light);
                    color: var(--accent-color);
                }
                .telemetry-button:active {
                    background-color: var(--accent-color);
                    color: var(--background-dark);
                }
                .telemetry-popup-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.6);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    backdrop-filter: blur(5px);
                }
                .telemetry-popup {
                    background: var(--background-dark);
                    border-radius: 10px;
                    padding: 20px;
                    color: var(--text-color);
                    font-family: 'Arial', sans-serif;
                    box-shadow: 0 8px 16px rgba(0,0,0,0.6);
                    width: 90%;
                    max-width: 700px;
                    max-height: 95%;
                    overflow-y: auto;
                    position: relative;
                    border: 1px solid var(--border-color);
                }
                .popup-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--border-color);
                }
                .popup-title {
                    font-size: 1.4em;
                    font-weight: bold;
                    color: var(--primary-color);
                }
                .close-button {
                    background: var(--background-light);
                    border: none;
                    border-radius: 6px;
                    color: var(--text-color);
                    padding: 8px 16px;
                    cursor: pointer;
                    transition: background-color 0.2s ease, color 0.2s ease;
                    font-size: 14px;
                }
                .close-button:hover {
                    background-color: var(--accent-color);
                    color: var(--background-dark);
                }
                .popup-content {
                    padding: 15px 0;
                    border-radius: 8px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                #leaderBoard .driver-item .name {
                    display: flex !important;
                    align-items: center;
                    min-width: 0;
                    padding-right: 10px !important;
                }
                #leaderBoard .driver-item .name > span:first-child {
                    flex: 1 1 auto;
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    padding-right: 8px;
                }
                .driver-status {
                    flex: 0 0 auto;
                    margin-left: auto;
                    font-size: 11px;
                    background: rgba(0,0,0,0.3);
                    padding: 2px 6px;
                    border-radius: 3px;
                    white-space: nowrap;
                    transition: color ${Config.get('minUpdateInterval') / 1000}s ease, opacity 0.3s ease;
                }
                .telemetry-hidden .driver-status { display: none; }
                
                .settings-header, .history-header, .races-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: var(--background-light);
                    padding: 10px 15px;
                    border-radius: 8px 8px 0 0;
                }
                .settings-title, .history-title, .races-title {
                    font-size: 1.1em;
                    font-weight: bold;
                    color: var(--primary-color);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .toggle-btn, .reset-btn, .toggle-telemetry-btn, .copy-btn {
                    background: var(--background-light);
                    border: none;
                    border-radius: 6px;
                    color: var(--text-color);
                    padding: 8px 16px;
                    cursor: pointer;
                    transition: background-color 0.2s ease, color 0.2s ease;
                    font-size: 14px;
                    margin-top: 5px;
                }
                .toggle-btn:hover, .reset-btn:hover, .toggle-telemetry-btn:hover, .copy-btn:hover {
                    background-color: var(--accent-color);
                    color: var(--background-dark);
                }
                .reset-system-btn {
                    background: #f44336;
                    border: none;
                    border-radius: 6px;
                    color: #fff;
                    padding: 8px 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 14px;
                }
                .reset-system-btn:hover {
                     background-color: #d32f2f;
                 }
                .settings-content, .history-content, .races-content {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    padding: 15px;
                    background: var(--background-dark);
                    border-radius: 0 0 8px 8px;
                }
                .setting-group {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding: 10px 15px;
                    background: var(--background-light);
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                }
                .setting-item {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    justify-content: flex-start;
                    padding: 12px;
                    background: var(--background-dark);
                    border-radius: 6px;
                }
                .setting-item > span {
                    margin-bottom: 8px;
                    font-weight: normal;
                    color: var(--text-color);
                }
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 45px;
                    height: 24px;
                }
                .switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: #4d4d4d;
                    transition: .3s;
                    border-radius: 12px;
                }
                .slider:before {
                    position: absolute;
                    content: "";
                    height: 20px;
                    width: 20px;
                    left: 3px;
                    bottom: 2px;
                    background: #f4f4f4;
                    transition: .3s;
                    border-radius: 50%;
                }
                input:checked + .slider {
                    background: var(--primary-color);
                }
                input:checked + .slider:before {
                    transform: translateX(21px);
                }
                .radio-group {
                    display: flex;
                    gap: 10px;
                    padding: 8px;
                    background: #252525;
                    border-radius: 6px;
                }
                .radio-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: #333;
                    border-radius: 4px;
                    cursor: pointer;
                    margin: 5px 0;
                }
                .radio-item label {
                    text-align: left;
                    display: block;
                    width: 100%;
                }
                .radio-item:first-child {
                    margin-top: 0;
                }
                .api-key-input {
                    width: 100%;
                    padding: 10px;
                    border-radius: 6px;
                    border: 1px solid var(--border-color);
                    background: var(--background-light);
                    color: var(--text-color);
                    font-size: 14px;
                }
                .api-key-input:focus {
                    outline: none;
                    border-color: var(--accent-color);
                    box-shadow: 0 0 5px rgba(100, 181, 246, 0.5);
                }
                .history-entry, .race-entry {
                    padding: 15px;
                    background: var(--background-light);
                    border-radius: 6px;
                    margin-bottom: 8px;
                    font-size: 14px;
                    line-height: 1.5;
                    border: 1px solid var(--border-color);
                }
                .history-entry:last-child, .race-entry:last-child {
                    margin-bottom: 0;
                }
                .current-stats {
                    padding: 15px;
                    background: var(--background-light);
                    border-radius: 6px;
                    margin-bottom: 15px;
                    border: 1px solid var(--border-color);
                }
                .current-stats h3 {
                    color: var(--primary-color);
                    margin-top: 0;
                    margin-bottom: 10px;
                    font-size: 1.2em;
                }
                .current-stats p {
                    margin: 5px 0;
                }
                .setting-dropdown {
                    width: 100%;
                    padding: 10px;
                    border-radius: 6px;
                    border: 1px solid var(--border-color);
                    background: var(--background-light);
                    color: var(--text-color);
                    font-size: 14px;
                    appearance: none;
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    background-image: url('data:image/svg+xml;utf8,<svg fill="white" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>');
                    background-repeat: no-repeat;
                    background-position-x: 98%;
                    background-position-y: 12px;
                    padding-right: 30px;
                }
                .setting-dropdown::-ms-expand {
                    display: none;
                }
                .setting-dropdown:focus {
                    outline: none;
                    border-color: var(--accent-color);
                    box-shadow: 0 0 5px rgba(100, 181, 246, 0.5);
                }
                
                /* Enhanced styles for the racing panels */
                .race-entry {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                .race-entry .race-header {
                    grid-column: 1 / -1;
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 8px;
                    margin-bottom: 8px;
                }
                .race-entry .race-title {
                    font-weight: bold;
                    font-size: 1.1em;
                }
                .race-entry .race-title a {
                    color: var(--primary-color);
                    text-decoration: none;
                    transition: color 0.2s ease;
                }
                .race-entry .race-title a:hover {
                    text-decoration: underline;
                    color: var(--accent-color);
                }
                .race-entry .race-id {
                    color: #999;
                    font-size: 0.9em;
                }
                .race-entry .race-info {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .race-entry .race-detail {
                    display: flex;
                    align-items: center;
                }
                .race-entry .race-detail-label {
                    font-weight: bold;
                    width: 100px;
                    color: var(--text-color);
                }
                .race-entry .race-detail-value {
                    flex: 1;
                }
                .race-entry .race-status {
                    padding: 2px 8px;
                    border-radius: 3px;
                    display: inline-block;
                    text-transform: capitalize;
                }
                .race-entry .race-status.finished {
                    background-color: var(--primary-color);
                    color: white;
                }
                
                /* Stats history enhancements */
                .history-entry {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                .history-entry .history-time {
                    grid-column: 1 / -1;
                    font-weight: bold;
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 5px;
                    margin-bottom: 5px;
                    color: var(--accent-color);
                }
                .history-entry .stat-change {
                    display: flex;
                    flex-direction: column;
                    margin-bottom: 5px;
                }
                .history-entry .stat-label {
                    font-weight: bold;
                    color: var(--text-color);
                }
                .history-entry .stat-value {
                    font-family: monospace;
                }
                .history-entry .stat-value .increase {
                    color: var(--positive-color);
                }
                .history-entry .stat-value .decrease {
                    color: var(--negative-color);
                }
                
                /* Current stats section in stats history */
                .current-stats {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                }
                .current-stats h3 {
                    grid-column: 1 / -1;
                    text-align: center;
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 10px;
                }
                .current-stats .stat-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    background: var(--background-dark);
                    padding: 10px;
                    border-radius: 5px;
                }
                .current-stats .stat-label {
                    font-size: 0.9em;
                    color: var(--text-color);
                    margin-bottom: 5px;
                }
                .current-stats .stat-value {
                    font-size: 1.4em;
                    font-weight: bold;
                    color: var(--highlight-color);
                }
                
                /* Mobile styles */
                @media (max-width: 480px) {
                    .telemetry-button-container {
                        flex-direction: column;
                        margin: 0 5px 10px;
                        border-radius: 8px;
                    }
                    .telemetry-button {
                        border-radius: 0;
                    }
                    .telemetry-button:not(:last-child) {
                        border-bottom: 1px solid var(--border-color);
                    }
                    .telemetry-popup {
                        width: 95%;
                        margin: 10px;
                        border-radius: 8px;
                        padding: 15px;
                    }
                    .popup-content {
                        max-height: 80vh;
                        padding: 10px 0;
                    }
                    #leaderBoard .driver-item .name {
                        padding-right: 5px !important;
                    }
                    .driver-status {
                        font-size: 10px;
                        padding: 1px 4px;
                        margin-left: 4px;
                    }
                    .telemetry-settings, .stats-history, .recent-races {
                        margin: 8px;
                        padding: 12px;
                    }
                    .settings-title, .history-title, .races-title {
                        font-size: 14px;
                    }
                }
            `);
        },
        
        // Helper to create a popup container
        createPopupContainer(title, contentGenerator, popupClass) {
            const container = document.createElement('div');
            container.className = 'telemetry-popup-container ' + popupClass;
            container.innerHTML = `
                <div class="telemetry-popup">
                    <div class="popup-header">
                        <span class="popup-title">${title}</span>
                        <button class="close-button">Close</button>
                    </div>
                    <div class="popup-content">
                        ${contentGenerator ? contentGenerator() : ''}
                    </div>
                </div>
            `;
            container.querySelector('.close-button').addEventListener('click', () => {
                container.remove();
            });
            return container;
        },
        
        // Create Settings Popup
        createSettingsPopup() {
            const popupContainer = this.createPopupContainer("RACING TELEMETRY SETTINGS", this.generateSettingsContent, 'settings-popup');
            const popupContent = popupContainer.querySelector('.popup-content');
            this.updateSettingsUI(popupContent);

            const settingsInputs = popupContent.querySelectorAll('input, select');
            settingsInputs.forEach(el => {
                if (el) {
                    el.addEventListener('change', () => {
                        if (el.type === 'checkbox') Config.set(el.dataset.setting, el.checked);
                        else if (el.tagName === 'SELECT') Config.set(el.dataset.setting, el.value);
                        else if (el.type === 'radio') Config.set(el.name, el.value);
                        else if (el.type === 'number') Config.set(el.dataset.setting, parseInt(el.value, 10));
                        else if (el.classList.contains('api-key-input')) Config.set(el.dataset.setting, el.value);

                        if (el.dataset.setting === 'apiKey') {
                            DataManager.fetchRacingStats().then(DataManager.fetchRaces.bind(DataManager));
                        }
                    });
                }
            });

            const resetButton = popupContent.querySelector('.reset-system-btn');
            if (resetButton) {
                resetButton.addEventListener('click', () => {
                    const apiKey = Config.get('apiKey');
                    localStorage.clear();
                    localStorage.setItem('racingTelemetryConfig', JSON.stringify({ apiKey: apiKey }));
                    window.location.reload();
                });
            }

            const copyButton = popupContent.querySelector('.copy-btn');
            if (copyButton) {
                copyButton.addEventListener('click', () => {
                    const container = document.getElementById('racingMainContainer');
                    if (container) {
                        navigator.clipboard.writeText(container.outerHTML)
                            .then(() => alert('HTML copied to clipboard!'))
                            .catch(err => alert('Failed to copy HTML: ' + err));
                    } else {
                        alert('racingMainContainer not found.');
                    }
                });
            }

            const telemetryToggleButton = popupContent.querySelector('.toggle-telemetry-btn');
            if (telemetryToggleButton) {
                telemetryToggleButton.addEventListener('click', () => {
                    State.telemetryVisible = !State.telemetryVisible;
                    document.body.classList.toggle('telemetry-hidden', !State.telemetryVisible);
                    telemetryToggleButton.textContent = State.telemetryVisible ? 'Hide Telemetry' : 'Show Telemetry';
                });
            }

            return popupContainer;
        },
        
        // Create Stats Popup
        createStatsPopup() {
            const popupContainer = this.createPopupContainer("PERSONAL STATS HISTORY", this.generateStatsContent, 'stats-history-popup');
            const popupContent = popupContainer.querySelector('.popup-content');
            popupContent.innerHTML = this.generateStatsContent(); // Initial content
            return popupContainer;
        },
        
        // Create Races Popup
        createRacesPopup() {
             const popupContainer = this.createPopupContainer("RECENT RACES (LAST 10)", this.generateRacesContent, 'recent-races-popup');
             const popupContent = popupContainer.querySelector('.popup-content');
             popupContent.innerHTML = this.generateRacesContent(); // Initial content
             return popupContainer;
        },
        
        // Update the settings UI with the current config
        updateSettingsUI(popupContent) {
            popupContent.querySelectorAll('input, select').forEach(el => {
                if (el.type === 'checkbox') el.checked = Config.get(el.dataset.setting);
                else if (el.tagName === 'SELECT') el.value = Config.get(el.dataset.setting);
                else if (el.type === 'radio') el.checked = Config.get(el.name) === el.value;
                else if (el.type === 'number') el.value = Config.get(el.dataset.setting);
                else if (el.classList.contains('api-key-input')) el.value = Config.get(el.dataset.setting);
            });
        },
        
        // Generate Settings Content
        generateSettingsContent() {
            return `
                <div class="settings-content">
                    <div class="setting-group">
                        <div class="setting-item" title="Select data to display">
                            <span>Display Mode</span>
                            <select class="setting-dropdown" data-setting="displayMode">
                                <option value="speed" ${Config.get('displayMode') === 'speed' ? 'selected' : ''}>Speed</option>
                                <option value="acceleration" ${Config.get('displayMode') === 'acceleration' ? 'selected' : ''}>Acceleration</option>
                                <option value="both" ${Config.get('displayMode') === 'both' ? 'selected' : ''}>Both</option>
                            </select>
                        </div>
                        <div class="setting-item" title="Color-code acceleration status">
                            <span>Color Coding</span>
                            <label class="switch"><input type="checkbox" ${Config.get('colorCode') ? 'checked' : ''} data-setting="colorCode"><span class="slider"></span></label>
                        </div>
                        <div class="setting-item" title="Enable smooth animations">
                            <span>Animations</span>
                            <label class="switch"><input type="checkbox" ${Config.get('animateChanges') ? 'checked' : ''} data-setting="animateChanges"><span class="slider"></span></label>
                        </div>
                        <div class="setting-item" title="Speed unit preference">
                            <span>Speed Unit</span>
                            <select class="setting-dropdown" data-setting="speedUnit">
                                <option value="mph" ${Config.get('speedUnit') === 'mph' ? 'selected' : ''}>mph</option>
                                <option value="kmh" ${Config.get('speedUnit') === 'kmh' ? 'selected' : ''}>km/h</option>
                            </select>
                        </div>
                    </div>
                    <div class="setting-group">
                        <div class="setting-item" title="Your Torn API key for fetching race data">
                            <span>API Key</span>
                            <input type="password" class="api-key-input" value="${Config.get('apiKey')}" data-setting="apiKey" placeholder="Enter API Key">
                        </div>
                    </div>
                    <div class="setting-group">
                        <button class="reset-system-btn">Reset System</button>
                        <button class="copy-btn">Copy HTML</button>
                        <button class="toggle-telemetry-btn">${State.telemetryVisible ? 'Hide Telemetry' : 'Show Telemetry'}</button>
                    </div>
                </div>
            `;
        },
        
        // Generate Stats Content
        generateStatsContent() {
            let content = '';
            
            // Current racing stats section
            if (State.racingStats?.racing || State.preciseSkill !== null) {
                const currentRacingStats = State.racingStats?.racing || {};
                
                // Determine which skill value to show (prefer the more precise one from the HTML)
                const skillValue = State.preciseSkill !== null 
                    ? State.preciseSkill 
                    : (currentRacingStats.skill || '0');
                
                // Add class if available
                const classDisplay = State.carClass 
                    ? `<span style="background: #333; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">Class ${State.carClass}</span>` 
                    : '';
                
                content += `
                    <div class="current-stats">
                        <h3>Current Racing Stats</h3>
                        <div class="stat-item">
                            <div class="stat-label">Racing Skill</div>
                            <div class="stat-value">${skillValue}${classDisplay}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Racing Points</div>
                            <div class="stat-value">${currentRacingStats.points?.toLocaleString() || '0'}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Races Entered</div>
                            <div class="stat-value">${currentRacingStats.races?.entered?.toLocaleString() || '0'}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Races Won</div>
                            <div class="stat-value">${currentRacingStats.races?.won?.toLocaleString() || '0'}</div>
                        </div>
                    </div>
                `;
                
                // Add current car information if available
                if (State.currentCar) {
                    content += `
                        <div class="current-stats">
                            <h3>Current Car</h3>
                            <div class="stat-item" style="grid-column: 1 / -1;">
                                <div class="stat-label">Car</div>
                                <div class="stat-value">${State.currentCar.name || 'Unknown'} (${State.currentCar.type || 'Unknown'})</div>
                            </div>`;
                            
                    // Add car stats if available
                    if (State.currentCar.stats) {
                        const stats = State.currentCar.stats;
                        content += `
                            <div class="stat-item">
                                <div class="stat-label">Top Speed</div>
                                <div class="stat-value progress-container">
                                    <div class="progress-bar" style="width: ${stats['top speed'] || 0}%; background-color: ${Utils.getStatColor(stats['top speed'])}"></div>
                                    <span>${Math.round(stats['top speed'] || 0)}%</span>
                                </div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Acceleration</div>
                                <div class="stat-value progress-container">
                                    <div class="progress-bar" style="width: ${stats['acceleration'] || 0}%; background-color: ${Utils.getStatColor(stats['acceleration'])}"></div>
                                    <span>${Math.round(stats['acceleration'] || 0)}%</span>
                                </div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Handling</div>
                                <div class="stat-value progress-container">
                                    <div class="progress-bar" style="width: ${stats['handling'] || 0}%; background-color: ${Utils.getStatColor(stats['handling'])}"></div>
                                    <span>${Math.round(stats['handling'] || 0)}%</span>
                                </div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Braking</div>
                                <div class="stat-value progress-container">
                                    <div class="progress-bar" style="width: ${stats['braking'] || 0}%; background-color: ${Utils.getStatColor(stats['braking'])}"></div>
                                    <span>${Math.round(stats['braking'] || 0)}%</span>
                                </div>
                            </div>
                        `;
                    }
                    
                    content += `</div>`;
                }
            }

            // Stats history entries
            content += State.statsHistory.map(entry => {
                return `
                    <div class="history-entry">
                        <div class="history-time">
                            ${Utils.formatTimestamp(entry.timestamp)}
                        </div>
                        <div class="stat-change">
                            <div class="stat-label">Racing Skill</div>
                            <div class="stat-value">${Utils.formatChange(entry.skill.old, entry.skill.new)}</div>
                        </div>
                        <div class="stat-change">
                            <div class="stat-label">Racing Points</div>
                            <div class="stat-value">${Utils.formatChange(entry.points.old, entry.points.new)}</div>
                        </div>
                        <div class="stat-change">
                            <div class="stat-label">Races Entered</div>
                            <div class="stat-value">${Utils.formatChange(entry.racesEntered.old, entry.racesEntered.new)}</div>
                        </div>
                        <div class="stat-change">
                            <div class="stat-label">Races Won</div>
                            <div class="stat-value">${Utils.formatChange(entry.racesWon.old, entry.racesWon.new)}</div>
                        </div>
                    </div>
                `;
            }).join('');

            return content || '<div class="history-entry">No stats history available</div>';
        },
        
        // Generate Races Content
        generateRacesContent() {
            // Sort races by start time (newest first)
            State.raceLog.sort((a, b) => {
                const startTimeA = a.schedule?.start ? new Date(a.schedule.start).getTime() : 0;
                const startTimeB = b.schedule?.start ? new Date(b.schedule.start).getTime() : 0;
                return startTimeB - startTimeA;
            });

            // Check if we're in a race currently
            let currentRaceContent = '';
            if (State.currentRaceId && State.trackInfo.name) {
                const statusHTML = `<span class="race-status active">Active</span>`;
                
                currentRaceContent = `
                    <div class="race-entry current-race">
                        <div class="race-header">
                            <div class="race-title">
                                <a href="https://www.torn.com/loader.php?sid=racing&tab=log&raceID=${State.currentRaceId}" target="_self">
                                Current Race: ${State.trackInfo.name || 'Unknown Track'}</a>
                            </div>
                            <div class="race-id">ID: ${State.currentRaceId}</div>
                        </div>
                        
                        <div class="race-info">
                            <div class="race-detail">
                                <div class="race-detail-label">Track:</div>
                                <div class="race-detail-value">${State.trackInfo.name || 'Unknown'} (${State.trackInfo.length}mi)</div>
                            </div>
                            <div class="race-detail">
                                <div class="race-detail-label">Status:</div>
                                <div class="race-detail-value">${statusHTML}</div>
                            </div>
                            <div class="race-detail">
                                <div class="race-detail-label">Laps:</div>
                                <div class="race-detail-value">${State.trackInfo.laps || '0'}</div>
                            </div>
                        </div>
                        
                        <div class="race-info">
                            <div class="race-detail">
                                <div class="race-detail-label">Description:</div>
                                <div class="race-detail-value" style="font-style: italic; font-size: 0.9em;">${State.trackInfo.description || 'No description available'}</div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Store this track info for our current race in the raceLog as well
                const currentRaceIndex = State.raceLog.findIndex(r => r.id === State.currentRaceId);
                if (currentRaceIndex !== -1) {
                    State.raceLog[currentRaceIndex].trackName = State.trackInfo.name;
                    State.raceLog[currentRaceIndex].trackLength = State.trackInfo.length;
                    State.raceLog[currentRaceIndex].trackDescription = State.trackInfo.description;
                    State.raceLog[currentRaceIndex].trackInfoFetched = true;
                }
            }

            const pastRacesContent = State.raceLog.map(race => {
                // Skip the current race as we've already rendered it
                if (race.id === State.currentRaceId && State.trackInfo.name) {
                    return '';
                }
                
                // Format the race status with appropriate styling
                const statusClass = race.status ? race.status.toLowerCase() : '';
                const statusHTML = `<span class="race-status ${statusClass}">${race.status || 'Unknown'}</span>`;
                
                // Get your position if available
                let positionInfo = '';
                if (race.user_data?.position) {
                    const positionClass = race.user_data.position <= 3 ? 'highlight-position' : '';
                    positionInfo = `<span class="race-position ${positionClass}">Position: ${race.user_data.position}/${race.participants?.maximum || 0}</span>`;
                }
                
                // Prepare track information - use trackName if available, otherwise fall back to track_id
                const trackInfo = race.trackName 
                    ? `${race.trackName}${race.trackLength ? ` (${race.trackLength}mi)` : ''}`
                    : `ID ${race.track_id || 'Unknown'}`;
                
                // Title might be a generic "Off race by XYZ", try to improve it if we have track info
                let title = race.title || 'Untitled Race';
                if (race.trackName && title.startsWith('Off race by')) {
                    title = `${race.trackName} - ${title}`;
                }
                
                let descriptionHTML = '';
                if (race.trackDescription) {
                    descriptionHTML = `
                    <div class="race-info">
                        <div class="race-detail">
                            <div class="race-detail-label">Description:</div>
                            <div class="race-detail-value" style="font-style: italic; font-size: 0.9em;">${race.trackDescription}</div>
                        </div>
                    </div>`;
                }
                
                return `
                    <div class="race-entry${race.status === 'active' ? ' current-race' : ''}">
                        <div class="race-header">
                            <div class="race-title">
                                <a href="https://www.torn.com/loader.php?sid=racing&tab=log&raceID=${race.id}" target="_self">${title}</a>
                            </div>
                            <div class="race-id">ID: ${race.id || 'Unknown'} ${positionInfo}</div>
                        </div>
                        
                        <div class="race-info">
                            <div class="race-detail">
                                <div class="race-detail-label">Track:</div>
                                <div class="race-detail-value">${trackInfo}</div>
                            </div>
                            <div class="race-detail">
                                <div class="race-detail-label">Status:</div>
                                <div class="race-detail-value">${statusHTML}</div>
                            </div>
                            <div class="race-detail">
                                <div class="race-detail-label">Laps:</div>
                                <div class="race-detail-value">${race.laps || '0'}</div>
                            </div>
                        </div>
                        
                        <div class="race-info">
                            <div class="race-detail">
                                <div class="race-detail-label">Participants:</div>
                                <div class="race-detail-value">${race.participants?.current || '0'}/${race.participants?.maximum || '0'}</div>
                            </div>
                            <div class="race-detail">
                                <div class="race-detail-label">Start Time:</div>
                                <div class="race-detail-value">${race.schedule?.start ? Utils.formatTimestamp(race.schedule.start) : 'N/A'}</div>
                            </div>
                        </div>
                        ${descriptionHTML}
                    </div>
                `;
            }).join('');
            
            return currentRaceContent + pastRacesContent || '<div class="race-entry">No recent races found</div>';
        },
        
        // Initialize the user interface
        initializeUI(container) {
            const buttonContainer = document.createElement('div');
            buttonContainer.id = 'telemetryButtonContainer';
            buttonContainer.className = 'telemetry-button-container';

            const settingsButton = document.createElement('div');
            settingsButton.className = 'telemetry-button';
            settingsButton.textContent = 'Settings';
            settingsButton.addEventListener('click', () => {
                document.body.appendChild(UI.createSettingsPopup());
            });

            const statsButton = document.createElement('div');
            statsButton.className = 'telemetry-button';
            statsButton.textContent = 'Stats History';
            statsButton.addEventListener('click', () => {
                document.body.appendChild(UI.createStatsPopup());
                DataManager.fetchRacingStats(); // Refresh data when popup is opened
            });

            const racesButton = document.createElement('div');
            racesButton.className = 'telemetry-button';
            racesButton.textContent = 'Recent Races';
            racesButton.addEventListener('click', () => {
                document.body.appendChild(UI.createRacesPopup());
                DataManager.fetchRaces(); // Refresh data when popup is opened
            });

            buttonContainer.appendChild(settingsButton);
            buttonContainer.appendChild(statsButton);
            buttonContainer.appendChild(racesButton);

            container.prepend(buttonContainer);
        }
    };

    // ===== RACE MANAGER =====
    const RaceManager = {
        updateTrackInfo() {
            try {
                const trackHeader = document.querySelector('.drivers-list .title-black');
                if (!trackHeader) throw new Error('Track header missing');
                const parentElement = trackHeader.parentElement;
                if (!parentElement) throw new Error('Track header parent missing');
                const infoElement = parentElement.querySelector('.track-info');
                const lapsMatch = trackHeader.textContent.match(/(\d+)\s+laps?/i);
                const lengthMatch = infoElement?.dataset.length?.match(/(\d+\.?\d*)/);
                
                // Extract the track name
                let trackName = '';
                if (trackHeader.textContent) {
                    const headerText = trackHeader.textContent.trim();
                    // The track name is typically before the first dash
                    const dashIndex = headerText.indexOf('-');
                    if (dashIndex > 0) {
                        trackName = headerText.substring(0, dashIndex).trim();
                    }
                }
                
                State.trackInfo = {
                    name: trackName,
                    laps: lapsMatch ? parseInt(lapsMatch[1]) : 5,
                    length: lengthMatch ? parseFloat(lengthMatch[1]) : 3.4,
                    description: infoElement?.dataset.desc || '',
                    get total() { return this.laps * this.length; }
                };
                
                // Check if we're viewing a race log by examining the URL
                const raceLogMatch = window.location.href.match(/raceID=(\d+)/);
                if (raceLogMatch && raceLogMatch[1]) {
                    const raceLogId = raceLogMatch[1];
                    
                    // Look for track info in current page
                    const raceTitle = document.querySelector('h4')?.textContent || '';
                    const trackSection = document.querySelector('.track-section');
                    if (trackSection) {
                        const nameElement = trackSection.querySelector('b');
                        const descElement = trackSection.querySelector('i');
                        const tracklengthElement = trackSection.querySelectorAll('li')[1]?.querySelector('span');
                        const lapsElement = trackSection.querySelectorAll('li')[2]?.querySelector('span');
                        
                        if (nameElement) {
                            const trackInfo = {
                                id: raceLogId,
                                name: nameElement.textContent.trim(),
                                description: descElement ? descElement.textContent.trim() : '',
                                length: tracklengthElement ? parseFloat(tracklengthElement.textContent.match(/(\d+\.?\d*)/)?.[1] || '0') : 0,
                                laps: lapsElement ? parseInt(lapsElement.textContent.trim() || '0') : 0
                            };
                            
                            // Save this track info to our race log
                            DataManager.updateRaceWithTrackInfo(raceLogId, trackInfo);
                        }
                    }
                }
            } catch (e) {
                console.error('Error updating track info:', e);
                State.trackInfo = { name: '', laps: 5, length: 3.4, total: 17, description: '' };
            }
            
            // Also update player profile info while we're here
            this.extractPlayerInfo();
        },
        
        extractPlayerInfo() {
            try {
                // Extract precise racing skill
                const skillElement = document.querySelector('.banner .skill');
                if (skillElement && skillElement.textContent) {
                    State.preciseSkill = parseFloat(skillElement.textContent.trim());
                }
                
                // Extract car class
                const classElement = document.querySelector('.banner .class-letter');
                if (classElement && classElement.textContent) {
                    State.carClass = classElement.textContent.trim();
                }
                
                // Extract current car info
                const carModelElements = document.querySelectorAll('.model-wrap .model p');
                if (carModelElements.length >= 2) {
                    State.currentCar = {
                        name: carModelElements[0].textContent.trim(),
                        type: carModelElements[1].textContent.trim()
                    };
                }
                
                // Extract car stats
                const carStats = {};
                const statElements = document.querySelectorAll('.properties-wrap li');
                statElements.forEach(statElement => {
                    const titleElement = statElement.querySelector('.title');
                    if (titleElement) {
                        const statName = titleElement.textContent.trim();
                        const progressElement = statElement.querySelector('.progressbar');
                        if (progressElement) {
                            const style = progressElement.getAttribute('style');
                            if (style) {
                                const widthMatch = style.match(/width:\s*(\d+\.?\d*)%/);
                                if (widthMatch && widthMatch[1]) {
                                    carStats[statName.toLowerCase()] = parseFloat(widthMatch[1]);
                                }
                            }
                        }
                    }
                });
                
                if (Object.keys(carStats).length > 0) {
                    State.currentCar = State.currentCar || {};
                    State.currentCar.stats = carStats;
                }
                
                // Try to extract current race ID
                const driverElement = document.querySelector('#leaderBoard li[data-id]');
                if (driverElement) {
                    const dataId = driverElement.getAttribute('data-id');
                    if (dataId) {
                        const raceIdMatch = dataId.match(/^(\d+)-/);
                        if (raceIdMatch && raceIdMatch[1]) {
                            State.currentRaceId = raceIdMatch[1];
                        }
                    }
                }
            } catch (e) {
                console.error('Error extracting player info:', e);
            }
        },
        
        setupPeriodicCheck() {
            if (State.periodicCheckIntervalId) return;
            State.periodicCheckIntervalId = setInterval(() => {
                try {
                    document.querySelectorAll('#leaderBoard li[id^="lbr-"]').forEach(driverEl => {
                        const timeEl = driverEl.querySelector('.time');
                        if (!timeEl) return;
                        const text = timeEl.textContent.trim();
                        const progress = Utils.parseProgress(text);
                        Telemetry.updateDriverDisplay(driverEl, text, progress);
                    });
                } catch (e) {
                    console.error('Periodic check error:', e);
                }
            }, Config.get('periodicCheckInterval'));
        },
        
        observeDrivers() {
            State.observers.forEach(obs => obs.disconnect());
            State.observers = [];
            const drivers = document.querySelectorAll('#leaderBoard li[id^="lbr-"]');
            drivers.forEach(driverEl => {
                const timeEl = driverEl.querySelector('.time');
                if (!timeEl) return;
                Telemetry.updateDriverDisplay(driverEl, timeEl.textContent || '0%', Utils.parseProgress(timeEl.textContent || '0%'));
                const observer = new MutationObserver(() => {
                    try {
                        const text = timeEl.textContent || '0%';
                        const progress = Utils.parseProgress(text);
                        if (progress !== State.previousMetrics[driverEl.id]?.progress) {
                            Telemetry.updateDriverDisplay(driverEl, text, progress);
                        }
                    } catch (e) {
                        console.error('Mutation observer error:', e);
                    }
                });
                observer.observe(timeEl, { childList: true, subtree: true, characterData: true });
                State.observers.push(observer);
            });
        },
        
        initializeLeaderboard() {
            const leaderboard = document.getElementById('leaderBoard');
            if (!leaderboard) return;
            if (leaderboard.children.length) {
                this.observeDrivers();
                this.setupPeriodicCheck();
            } else {
                new MutationObserver((_, obs) => {
                    if (leaderboard.children.length) {
                        this.observeDrivers();
                        this.setupPeriodicCheck();
                        obs.disconnect();
                    }
                }).observe(leaderboard, { childList: true });
            }
        },
        
        detectRaceLogPage() {
            try {
                const raceLogMatch = window.location.href.match(/raceID=(\d+)/);
                if (!raceLogMatch || !raceLogMatch[1]) return;
                
                // We're on a race log page
                const raceId = raceLogMatch[1];
                console.log('Detected race log page for race ID:', raceId);
                
                // Extract race info from the page
                const raceTitle = document.querySelector('h4')?.textContent?.trim() || '';
                const trackSection = document.querySelector('.track-section');
                
                if (trackSection) {
                    const nameElement = trackSection.querySelector('b');
                    const descElement = trackSection.querySelector('i');
                    const tracklengthElement = trackSection.querySelectorAll('li')[1]?.querySelector('span');
                    const lapsElement = trackSection.querySelectorAll('li')[2]?.querySelector('span');
                    
                    if (nameElement) {
                        const trackInfo = {
                            name: nameElement.textContent.trim(),
                            description: descElement ? descElement.textContent.trim() : '',
                            length: tracklengthElement ? parseFloat(tracklengthElement.textContent.match(/(\d+\.?\d*)/)?.[1] || '0') : 0,
                            laps: lapsElement ? parseInt(lapsElement.textContent.trim() || '0') : 0
                        };
                        
                        // First check if we already have this race in our log
                        const existingRace = State.raceLog.find(r => r.id === raceId);
                        if (!existingRace) {
                            // We don't have this race yet, add it with the track info
                            const newRace = {
                                id: raceId,
                                title: raceTitle,
                                trackName: trackInfo.name,
                                trackLength: trackInfo.length,
                                trackDescription: trackInfo.description,
                                laps: trackInfo.laps,
                                fetchedAt: Date.now()
                            };
                            
                            State.raceLog.unshift(newRace);
                            State.raceLog = State.raceLog.slice(0, 50);
                            State.save('raceLog');
                        } else {
                            // Update the existing race with track info
                            DataManager.updateRaceWithTrackInfo(raceId, trackInfo);
                        }
                    }
                }
            } catch (e) {
                console.error('Error detecting race log page:', e);
            }
        }
    };

    // ===== MAIN APPLICATION =====
    const App = {
        initialize() {
            try {
                // Initialize configs and state
                Config.load();
                State.init();
                UI.setupStyles();
                
                const container = document.querySelector('.cont-black');
                if (!container) throw new Error('Container not found');
                
                const urlRaceId = window.location.href.match(/sid=racing.*?(?=&|$)/)?.[0] || 'default';
                if (State.currentRaceId !== urlRaceId) {
                    State.resetRace();
                    State.currentRaceId = urlRaceId;
                }
                
                if (container.querySelector('#telemetryButtonContainer')) {
                    RaceManager.updateTrackInfo();
                    RaceManager.initializeLeaderboard();
                    return;
                }

                UI.initializeUI(container);
                RaceManager.updateTrackInfo();
                RaceManager.initializeLeaderboard();
                
                // Don't fetch API data right away - defer it slightly to allow the page to render first
                setTimeout(() => {
                    DataManager.fetchRacingStats().then(() => {
                        DataManager.fetchRaces();
                    });
                }, 1000);
                
                // Check if we're on a race log page
                RaceManager.detectRaceLogPage();
            } catch (e) {
                console.error('Initialization failed:', e);
            }
        },
    };

    // Setup observers for page changes
    const racingUpdatesObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 && node.id === 'racingupdates') {
                    App.initialize();
                }
            });
            mutation.removedNodes.forEach(node => {
                if (node.nodeType === 1 && node.id === 'racingupdates') {
                    State.resetRace();
                }
            });
        });
    });

    // Start observing and initializing
    racingUpdatesObserver.observe(document.body, { childList: true, subtree: true });
    document.readyState === 'complete' ? App.initialize() : window.addEventListener('load', App.initialize);
    window.addEventListener('popstate', App.initialize);
})();
