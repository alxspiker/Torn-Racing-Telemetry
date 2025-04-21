// ==UserScript==
// @name         Torn Racing Telemetry
// @namespace    https://www.torn.com/profiles.php?XID=2782979
// @version      2.5.2
// @description  Enhances Torn Racing with real-time speed and acceleration telemetry
// @match        https://www.torn.com/page.php?sid=racing*
// @match        https://www.torn.com/loader.php?sid=racing*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    if (window.racingTelemetryCoreHasRun) return;
    window.racingTelemetryCoreHasRun = true;

    // Add styles
    GM_addStyle(`
        :root {
            --text-color: #e0e0e0;
            --background-dark: #1a1a1a;
            --background-light: #2a2a2a;
            --border-color: #404040;
            --accent-color: #64B5F6;
            --primary-color: #4CAF50;
        }
        
        .telemetry-button-container {
            display: flex;
            width: 100%;
            margin: 0 0 10px;
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
        
        .telemetry-hidden .driver-status {
            display: none;
        }
        
        .driver-status {
            flex: 0 0 auto;
            margin-left: auto;
            font-size: 11px;
            background: rgba(0,0,0,0.3);
            padding: 2px 6px;
            border-radius: 3px;
            white-space: nowrap;
            transition: color 0.5s ease, opacity 0.3s ease;
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
        
        .settings-popup {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 999;
            backdrop-filter: blur(3px);
        }
        
        .settings-popup-content {
            background: var(--background-dark);
            border-radius: 10px;
            border: 1px solid var(--border-color);
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
            padding: 20px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        }
        
        .settings-title {
            color: var(--primary-color);
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .settings-close {
            background: var(--background-light);
            color: var(--text-color);
            border: none;
            border-radius: 4px;
            padding: 8px 15px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .settings-close:hover {
            background: var(--accent-color);
            color: var(--background-dark);
        }
        
        .settings-item {
            margin-bottom: 20px;
            display: flex;
            flex-direction: column;
        }
        
        .settings-item label {
            margin-bottom: 8px;
            color: var(--text-color);
            font-weight: bold;
        }
        
        .settings-item select, .toggle-wrapper {
            padding: 8px;
            background: var(--background-light);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            color: var(--text-color);
        }
        
        .settings-buttons {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
        }
        
        .settings-btn {
            padding: 10px 15px;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            background: var(--background-light);
            color: var(--text-color);
            transition: all 0.2s ease;
        }
        
        .settings-btn:hover {
            background: var(--accent-color);
            color: var(--background-dark);
        }
        
        .settings-btn.primary {
            background: var(--primary-color);
            color: white;
        }
        
        .settings-btn.primary:hover {
            background: #388E3C;
        }
        
        /* Toggle switch */
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
            background-color: #4d4d4d;
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
            background-color: #f4f4f4;
            transition: .3s;
            border-radius: 50%;
        }
        
        input:checked + .slider {
            background-color: var(--primary-color);
        }
        
        input:checked + .slider:before {
            transform: translateX(21px);
        }
        
        .notification {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: var(--primary-color);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s;
        }
        
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
            
            #leaderBoard .driver-item .name {
                padding-right: 5px !important;
            }
            
            .driver-status {
                font-size: 10px;
                padding: 1px 4px;
                margin-left: 4px;
            }
        }
    `);

    // Configuration management
    const Config = {
        defaults: {
            displayMode: 'speed',    // 'speed', 'acceleration', or 'both'
            colorCode: true,         // Whether to color-code the telemetry
            animateChanges: true,    // Whether to animate changes in telemetry
            speedUnit: 'mph',        // 'mph' or 'kmh'
            minUpdateInterval: 500,  // Minimum update interval in ms
            telemetryVisible: true   // Whether telemetry is visible
        },
        
        data: {},
        
        load() {
            try {
                this.data = {...this.defaults, ...JSON.parse(GM_getValue('racingTelemetryCoreConfig', '{}'))};
            } catch (e) {
                console.error("Error loading config:", e);
                this.data = {...this.defaults};
            }
            return this.data;
        },
        
        save() { 
            GM_setValue('racingTelemetryCoreConfig', JSON.stringify(this.data)); 
        },
        
        get(key) { 
            return this.data[key]; 
        },
        
        set(key, value) { 
            this.data[key] = value; 
            this.save(); 
        }
    };

    // Application state
    const State = {
        previousMetrics: {},
        trackInfo: { laps: 5, length: 3.4, get total() { return this.laps * this.length; } },
        observers: [],
        lastUpdateTimes: {},
        periodicCheckIntervalId: null,
        
        resetRace() {
            this.previousMetrics = {};
            this.trackInfo = { laps: 5, length: 3.4, get total() { return this.laps * this.length; } };
            clearInterval(this.periodicCheckIntervalId);
            this.periodicCheckIntervalId = null;
            this.observers.forEach(obs => obs.disconnect());
            this.observers = [];
            this.lastUpdateTimes = {};
        }
    };

    // Utility functions
    const Utils = {
        convertSpeed(speed, unit) { 
            return unit === 'kmh' ? speed * 1.60934 : speed; 
        },
        
        formatTime(seconds) {
            const min = Math.floor(seconds / 60);
            const sec = Math.floor(seconds % 60);
            return `${min}:${sec < 10 ? '0' : ''}${sec}`;
        },
        
        parseTime(timeString) {
            if (!timeString?.includes(':')) return 0;
            const parts = timeString.split(':');
            if (parts.length === 2) {
                return (parseInt(parts[0], 10) || 0) * 60 + (parseFloat(parts[1]) || 0);
            }
            return 0;
        },
        
        parseProgress(text) {
            const match = text?.match(/(\d+\.?\d*)%/);
            return match ? parseFloat(match[1]) : 0;
        },
        
        showNotification(message, type = 'info') {
            const notif = document.createElement('div');
            notif.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
                color: white;
                padding: 12px 20px;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                z-index: 9999;
                font-size: 14px;
                opacity: 0;
                transition: opacity 0.3s;
            `;
            notif.textContent = message;
            document.body.appendChild(notif);
            
            // Fade in
            setTimeout(() => notif.style.opacity = '1', 10);
            
            // Fade out and remove
            setTimeout(() => {
                notif.style.opacity = '0';
                setTimeout(() => notif.remove(), 300);
            }, 3000);
        }
    };

    // Telemetry calculations
    const Telemetry = {
        easeInOutQuad(t) { 
            return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; 
        },

        interpolateColor(color1, color2, factor) {
            const result = color1.map((c, i) => Math.round(c + factor * (color2[i] - c)));
            return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
        },

        getTelemetryColor(acceleration) {
            const grey = [136, 136, 136];
            if (!Config.get('colorCode')) return `rgb(${grey[0]}, ${grey[1]}, ${grey[2]})`;
            
            const green = [76, 175, 80];
            const red = [244, 67, 54];
            const maxAcc = 1.0;
            let factor = Math.min(Math.abs(acceleration) / maxAcc, 1);
            
            if (acceleration > 0) return this.interpolateColor(grey, green, factor);
            if (acceleration < 0) return this.interpolateColor(grey, red, factor);
            return `rgb(${grey[0]}, ${grey[1]}, ${grey[2]})`;
        },

        animateTelemetry(element, fromSpeed, toSpeed, fromAcc, toAcc, duration, displayMode, speedUnit, extraText) {
            let startTime = null;
            const easeFunction = this.easeInOutQuad;
            const getColor = this.getTelemetryColor.bind(this);
            
            function step(timestamp) {
                if (!startTime) startTime = timestamp;
                let linearProgress = Math.min((timestamp - startTime) / duration, 1);
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
            const currentSpeed = (distanceDelta / effectiveDt) * 3600;
            const averagedSpeed = prev.firstUpdate ? currentSpeed : (prev.instantaneousSpeed + currentSpeed) / 2;
            const acceleration = prev.firstUpdate ? 0 : ((averagedSpeed - prev.reportedSpeed) / effectiveDt) * 0.44704 / 9.81;
            
            State.previousMetrics[driverId] = {
                progress: progressPercentage,
                time: timestamp,
                instantaneousSpeed: currentSpeed,
                reportedSpeed: averagedSpeed,
                acceleration: acceleration,
                lastDisplayedSpeed: prev.lastDisplayedSpeed || averagedSpeed,
                lastDisplayedAcceleration: prev.lastDisplayedAcceleration || acceleration,
                firstUpdate: false
            };
            
            return { speed: Math.abs(averagedSpeed), acceleration, timeDelta: effectiveDt };
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
                const notStartedText = '🛑 NOT STARTED';
                
                // Check if race hasn't started yet
                if (infoSpot && infoSpot.textContent.trim().toLowerCase() === 'race starting') {
                    statusText.textContent = notStartedText;
                    statusText.style.color = 'rgb(136, 136, 136)';
                    return;
                }

                // Check if any driver has started
                let raceHasBegun = false;
                const allDriverTimes = document.querySelectorAll('#leaderBoard li[id^="lbr-"] .time');
                for (const timeElement of allDriverTimes) {
                    if (timeElement.textContent.trim() && timeElement.textContent.trim() !== '0%') {
                        raceHasBegun = true;
                        break;
                    }
                }

                if (!raceHasBegun && !(infoSpot && infoSpot.textContent.trim().toLowerCase() === 'race finished')) {
                    statusText.textContent = notStartedText;
                    statusText.style.color = 'rgb(136, 136, 136)';
                    return;
                }

                // Check if driver has finished
                const isFinished = ['finished', 'gold', 'silver', 'bronze'].some(cls => statusEl.classList.contains(cls));
                if (isFinished) {
                    const finishTime = Utils.parseTime(timeEl.textContent);
                    const avgSpeed = finishTime > 0 ? (State.trackInfo.total / finishTime) * 3600 : 0;
                    const avgSpeedFormatted = Math.round(Utils.convertSpeed(avgSpeed, Config.get('speedUnit')));
                    statusText.textContent = `🏁 ${avgSpeedFormatted} ${Config.get('speedUnit')}`;
                    statusText.style.color = 'rgb(136, 136, 136)';
                } else {
                    // Show active telemetry
                    const metrics = this.calculateDriverMetrics(driverId, progressPercentage, now);
                    const targetSpeed = Math.round(Utils.convertSpeed(metrics.speed, Config.get('speedUnit')));
                    let extraText = "";
                    
                    // Add estimated lap time for selected driver
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
                        const fromSpeed = (statusText._currentSpeed !== undefined) ? 
                            statusText._currentSpeed : State.previousMetrics[driverId].lastDisplayedSpeed;
                        const fromAcc = (statusText._currentAcc !== undefined) ? 
                            statusText._currentAcc : State.previousMetrics[driverId].lastDisplayedAcceleration;
                        const duration = metrics.timeDelta * 1000;
                        
                        this.animateTelemetry(
                            statusText, fromSpeed, targetSpeed, fromAcc, metrics.acceleration, 
                            duration, Config.get('displayMode'), Config.get('speedUnit'), extraText
                        );
                        
                        State.previousMetrics[driverId].lastDisplayedSpeed = targetSpeed;
                        State.previousMetrics[driverId].lastDisplayedAcceleration = metrics.acceleration;
                    } else {
                        let text;
                        const displayMode = Config.get('displayMode');
                        if (displayMode === 'speed') {
                            text = `${targetSpeed} ${Config.get('speedUnit')}`;
                        } else if (displayMode === 'acceleration') {
                            text = `${metrics.acceleration.toFixed(1)} g`;
                        } else {
                            text = `${targetSpeed} ${Config.get('speedUnit')} | ${metrics.acceleration.toFixed(1)} g`;
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

    // User Interface
    const UI = {
        createSettingsPopup() {
            // Remove any existing popup
            const existingPopup = document.querySelector('.settings-popup');
            if (existingPopup) existingPopup.remove();
            
            // Create popup container
            const popup = document.createElement('div');
            popup.className = 'settings-popup';
            
            // Create popup content
            const content = document.createElement('div');
            content.className = 'settings-popup-content';
            
            // Add header and content
            content.innerHTML = `
                <div class="settings-title">
                    Telemetry Settings
                    <button class="settings-close">Close</button>
                </div>
                
                <div class="settings-content">
                    <div class="settings-item">
                        <label>Display Mode</label>
                        <select id="displayMode">
                            <option value="speed" ${Config.get('displayMode') === 'speed' ? 'selected' : ''}>Speed</option>
                            <option value="acceleration" ${Config.get('displayMode') === 'acceleration' ? 'selected' : ''}>Acceleration</option>
                            <option value="both" ${Config.get('displayMode') === 'both' ? 'selected' : ''}>Both</option>
                        </select>
                    </div>
                    
                    <div class="settings-item">
                        <label>Speed Unit</label>
                        <select id="speedUnit">
                            <option value="mph" ${Config.get('speedUnit') === 'mph' ? 'selected' : ''}>mph</option>
                            <option value="kmh" ${Config.get('speedUnit') === 'kmh' ? 'selected' : ''}>km/h</option>
                        </select>
                    </div>
                    
                    <div class="settings-item">
                        <label>Color Coding</label>
                        <div class="toggle-wrapper">
                            <label class="switch">
                                <input type="checkbox" id="colorCode" ${Config.get('colorCode') ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="settings-item">
                        <label>Animate Changes</label>
                        <div class="toggle-wrapper">
                            <label class="switch">
                                <input type="checkbox" id="animateChanges" ${Config.get('animateChanges') ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="settings-buttons">
                        <button class="settings-btn toggle-telemetry-btn">
                            ${Config.get('telemetryVisible') ? 'Hide Telemetry' : 'Show Telemetry'}
                        </button>
                        <button class="settings-btn primary" id="saveSettings">Save Settings</button>
                    </div>
                </div>
            `;
            
            // Add event listeners
            content.querySelector('.settings-close').addEventListener('click', () => {
                popup.remove();
            });
            
            // Toggle telemetry visibility
            const toggleBtn = content.querySelector('.toggle-telemetry-btn');
            toggleBtn.addEventListener('click', () => {
                const newState = !Config.get('telemetryVisible');
                Config.set('telemetryVisible', newState);
                document.body.classList.toggle('telemetry-hidden', !newState);
                toggleBtn.textContent = newState ? 'Hide Telemetry' : 'Show Telemetry';
                Utils.showNotification(`Telemetry ${newState ? 'shown' : 'hidden'}`, 'success');
            });
            
            // Save settings
            content.querySelector('#saveSettings').addEventListener('click', () => {
                // Save settings
                Config.set('displayMode', content.querySelector('#displayMode').value);
                Config.set('speedUnit', content.querySelector('#speedUnit').value);
                Config.set('colorCode', content.querySelector('#colorCode').checked);
                Config.set('animateChanges', content.querySelector('#animateChanges').checked);
                
                // Show success notification
                Utils.showNotification('Settings saved successfully', 'success');
                
                // Close popup
                popup.remove();
            });
            
            // Close on outside click
            popup.addEventListener('click', (e) => {
                if (e.target === popup) {
                    popup.remove();
                }
            });
            
            // Add popup to page
            popup.appendChild(content);
            document.body.appendChild(popup);
            
            return popup;
        },
        
        initializeUI(container) {
            // Try to find existing button container
            let buttonContainer = document.getElementById('telemetryButtonContainer');
            
            // If no container exists, create one
            if (!buttonContainer) {
                buttonContainer = document.createElement('div');
                buttonContainer.id = 'telemetryButtonContainer';
                buttonContainer.className = 'telemetry-button-container';
                container.prepend(buttonContainer);
            }
            
            // Add our button if it doesn't exist
            if (!buttonContainer.querySelector('.telemetry-settings-button')) {
                const settingsButton = document.createElement('div');
                settingsButton.className = 'telemetry-button telemetry-settings-button';
                settingsButton.textContent = 'Telemetry Settings';
                settingsButton.addEventListener('click', () => {
                    this.createSettingsPopup();
                });
                
                buttonContainer.appendChild(settingsButton);
            }
            
            // Check if telemetry should be hidden
            if (!Config.get('telemetryVisible')) {
                document.body.classList.add('telemetry-hidden');
            }
        }
    };

    // Race Manager
    const RaceManager = {
        updateTrackInfo() {
            try {
                const trackHeader = document.querySelector('.drivers-list .title-black');
                if (!trackHeader) return;
                
                const parentElement = trackHeader.parentElement;
                if (!parentElement) return;
                
                const infoElement = parentElement.querySelector('.track-info');
                const lapsMatch = trackHeader.textContent.match(/(\d+)\s+laps?/i);
                const lengthMatch = infoElement?.dataset.length?.match(/(\d+\.?\d*)/);
                
                State.trackInfo = {
                    laps: lapsMatch ? parseInt(lapsMatch[1]) : 5,
                    length: lengthMatch ? parseFloat(lengthMatch[1]) : 3.4,
                    get total() { return this.laps * this.length; }
                };
            } catch (e) {
                console.error('Error updating track info:', e);
                State.trackInfo = { laps: 5, length: 3.4, get total() { return this.laps * this.length; } };
            }
        },
        
        setupPeriodicCheck() {
            if (State.periodicCheckIntervalId) clearInterval(State.periodicCheckIntervalId);
            
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
            }, 1000); // Check every second
        },
        
        observeDrivers() {
            State.observers.forEach(obs => obs.disconnect());
            State.observers = [];
            
            const drivers = document.querySelectorAll('#leaderBoard li[id^="lbr-"]');
            drivers.forEach(driverEl => {
                const timeEl = driverEl.querySelector('.time');
                if (!timeEl) return;
                
                // Initial update
                Telemetry.updateDriverDisplay(driverEl, timeEl.textContent || '0%', Utils.parseProgress(timeEl.textContent || '0%'));
                
                // Setup observer for changes
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
        }
    };

    // Main application
    const App = {
        initialize() {
            try {
                // Initialize configuration
                Config.load();
                
                // Find the racing container
                const container = document.querySelector('.cont-black');
                if (!container) {
                    console.error('Racing container not found');
                    return;
                }
                
                // Initialize UI
                UI.initializeUI(container);
                
                // Update track information
                RaceManager.updateTrackInfo();
                
                // Initialize telemetry on the leaderboard
                RaceManager.initializeLeaderboard();
            } catch (e) {
                console.error('Initialization failed:', e);
            }
        }
    };

    // Setup observers for page changes
    const racingUpdatesObserver = new MutationObserver(mutations => {
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
    
    // Initialize on page load
    if (document.readyState === 'complete') {
        App.initialize();
    } else {
        window.addEventListener('load', App.initialize);
    }
    
    // Handle page navigation
    window.addEventListener('popstate', App.initialize);
})();