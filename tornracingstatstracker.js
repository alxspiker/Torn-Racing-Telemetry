// ==UserScript==
// @name         Torn Racing Stats Tracker
// @namespace    https://www.torn.com/profiles.php?XID=2782979
// @version      1.0.0
// @description  Tracks and displays racing stats history and changes
// @match        https://www.torn.com/page.php?sid=racing*
// @match        https://www.torn.com/loader.php?sid=racing*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      api.torn.com
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    if (window.racingStatsTrackerHasRun) return;
    window.racingStatsTrackerHasRun = true;

    // Add styles
    GM_addStyle(`
        :root {
            --text-color: #e0e0e0;
            --background-dark: #1a1a1a;
            --background-light: #2a2a2a;
            --border-color: #404040;
            --accent-color: #64B5F6;
            --primary-color: #4CAF50;
            --negative-color: #f44336;
            --highlight-color: #FFD54F;
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
        
        .stats-popup-overlay {
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
        
        .stats-popup {
            background: var(--background-dark);
            border-radius: 10px;
            border: 1px solid var(--border-color);
            width: 90%;
            max-width: 800px;
            max-height: 90vh;
            overflow-y: auto;
            padding: 20px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        }
        
        .stats-popup-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
        }
        
        .stats-popup-title {
            font-size: 20px;
            font-weight: bold;
            color: var(--primary-color);
        }
        
        .stats-popup-close {
            background: var(--background-light);
            color: var(--text-color);
            border: none;
            border-radius: 4px;
            padding: 8px 15px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .stats-popup-close:hover {
            background: var(--accent-color);
            color: var(--background-dark);
        }
        
        .stats-content {
            padding: 0 10px;
        }
        
        .current-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 15px;
            background: var(--background-light);
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid var(--border-color);
        }
        
        .car-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 15px;
            background: var(--background-light);
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid var(--border-color);
        }
        
        .section-title {
            grid-column: 1 / -1;
            color: var(--primary-color);
            font-size: 18px;
            font-weight: bold;
            margin: 0 0 10px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
        }
        
        .stat-card {
            background: var(--background-dark);
            padding: 12px;
            border-radius: 6px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .stat-label {
            color: var(--text-color);
            font-size: 14px;
            margin-bottom: 8px;
        }
        
        .stat-value {
            color: var(--highlight-color);
            font-size: 20px;
            font-weight: bold;
        }
        
        .car-title {
            grid-column: 1 / -1;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .car-name {
            font-size: 16px;
            color: var(--accent-color);
            font-weight: bold;
        }
        
        .car-class {
            background: var(--background-dark);
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 14px;
            color: var(--highlight-color);
        }
        
        .stat-bar-container {
            width: 100%;
            height: 12px;
            background: var(--background-dark);
            border-radius: 6px;
            overflow: hidden;
            margin-top: 8px;
        }
        
        .stat-bar {
            height: 100%;
            background: var(--primary-color);
            border-radius: 6px;
        }
        
        .history-entry {
            background: var(--background-light);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            border: 1px solid var(--border-color);
        }
        
        .history-time {
            color: var(--accent-color);
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
        }
        
        .history-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
        }
        
        .history-stat {
            background: var(--background-dark);
            padding: 10px;
            border-radius: 6px;
        }
        
        .history-stat-label {
            color: var(--text-color);
            font-size: 14px;
            margin-bottom: 5px;
            font-weight: bold;
        }
        
        .history-stat-value {
            font-family: monospace;
            font-size: 14px;
        }
        
        .increase {
            color: var(--primary-color);
        }
        
        .decrease {
            color: var(--negative-color);
        }
        
        .settings-section {
            background: var(--background-light);
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            border: 1px solid var(--border-color);
        }
        
        .settings-title {
            color: var(--primary-color);
            font-size: 18px;
            font-weight: bold;
            margin: 0 0 15px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
        }
        
        .settings-group {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .settings-item {
            display: flex;
            flex-direction: column;
            margin-bottom: 10px;
        }
        
        .settings-item label {
            margin-bottom: 5px;
            color: var(--text-color);
        }
        
        .api-key-input {
            background: var(--background-dark);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            padding: 8px 12px;
            border-radius: 4px;
            width: 100%;
        }
        
        .api-key-input:focus {
            outline: none;
            border-color: var(--accent-color);
        }
        
        .settings-buttons {
            display: flex;
            justify-content: flex-end;
            margin-top: 15px;
            gap: 10px;
        }
        
        .settings-btn {
            background: var(--background-light);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 8px 15px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .settings-btn:hover {
            background: var(--accent-color);
            color: var(--background-dark);
        }
        
        .refresh-btn {
            background: var(--primary-color);
            color: white;
            border: none;
        }
        
        .refresh-btn:hover {
            background: #388E3C;
            color: white;
        }
        
        .progress-bar-container {
            position: relative;
            width: 100%;
            height: 25px;
            background: var(--background-dark);
            border-radius: 4px;
            margin-top: 5px;
            overflow: hidden;
        }
        
        .progress-bar {
            height: 100%;
            background: var(--primary-color);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
            font-weight: bold;
            transition: width 0.3s ease;
        }
        
        .notification {
            position: fixed;
            bottom: 20px;
            left: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            z-index: 9999;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .notification.success {
            background-color: var(--primary-color);
        }
        
        .notification.error {
            background-color: var(--negative-color);
        }
        
        .notification.info {
            background-color: var(--accent-color);
        }
        
        @media (max-width: 600px) {
            .stats-popup {
                width: 95%;
                padding: 15px;
            }
            
            .current-stats,
            .car-stats,
            .history-stats {
                grid-template-columns: 1fr;
            }
            
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
        }
    `);

    // Configuration management
    const Config = {
        defaults: {
            apiKey: '',
            autoFetch: true,
            fetchInterval: 30, // minutes
            maxHistoryEntries: 50
        },
        
        data: {},
        
        load() {
            try {
                this.data = {...this.defaults, ...JSON.parse(GM_getValue('racingStatsTrackerConfig', '{}'))};
            } catch (e) {
                console.error("Error loading config:", e);
                this.data = {...this.defaults};
            }
            return this.data;
        },
        
        save() { 
            GM_setValue('racingStatsTrackerConfig', JSON.stringify(this.data)); 
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
        racingStats: null,
        currentCar: null,
        preciseSkill: null,
        carClass: null,
        statsHistory: [],
        lastFetchTime: 0,
        isFetching: false,
        
        init() {
            try {
                this.statsHistory = JSON.parse(GM_getValue('statsHistory', '[]')).filter(e => e?.timestamp);
                this.statsHistory = this.statsHistory.slice(0, Config.get('maxHistoryEntries'));
                this.racingStats = JSON.parse(GM_getValue('racingStats', 'null'));
                this.lastFetchTime = parseInt(GM_getValue('lastFetchTime', '0'));
            } catch (e) {
                console.error("Error initializing state:", e);
                this.statsHistory = [];
                this.racingStats = null;
                this.lastFetchTime = 0;
            }
            return this;
        },
        
        save() {
            GM_setValue('statsHistory', JSON.stringify(this.statsHistory));
            GM_setValue('racingStats', JSON.stringify(this.racingStats));
            GM_setValue('lastFetchTime', this.lastFetchTime.toString());
        },
        
        extractPlayerInfo() {
            try {
                // Extract precise racing skill
                const skillElement = document.querySelector('.banner .skill');
                if (skillElement?.textContent) {
                    this.preciseSkill = parseFloat(skillElement.textContent.trim());
                }
                
                // Extract car class
                const classElement = document.querySelector('.banner .class-letter');
                if (classElement?.textContent) {
                    this.carClass = classElement.textContent.trim();
                }
                
                // Extract current car info
                const carModelElements = document.querySelectorAll('.model-wrap .model p');
                if (carModelElements.length >= 2) {
                    this.currentCar = {
                        name: carModelElements[0].textContent.trim(),
                        type: carModelElements[1].textContent.trim()
                    };
                }
                
                // Extract car stats
                const carStats = {};
                document.querySelectorAll('.properties-wrap li').forEach(statElement => {
                    const titleElement = statElement.querySelector('.title');
                    if (titleElement) {
                        const statName = titleElement.textContent.trim().toLowerCase();
                        const progressElement = statElement.querySelector('.progressbar');
                        if (progressElement) {
                            const style = progressElement.getAttribute('style');
                            if (style) {
                                const widthMatch = style.match(/width:\s*(\d+\.?\d*)%/);
                                if (widthMatch && widthMatch[1]) {
                                    carStats[statName] = parseFloat(widthMatch[1]);
                                }
                            }
                        }
                    }
                });
                
                if (Object.keys(carStats).length > 0) {
                    this.currentCar = this.currentCar || {};
                    this.currentCar.stats = carStats;
                }
            } catch (e) {
                console.error('Error extracting player info:', e);
            }
        }
    };

    // Utility functions
    const Utils = {
        async fetchWithTimeout(url, options = {}, timeout = 10000) {
            return Promise.race([
                fetch(url, options),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Request timed out')), timeout)
                )
            ]);
        },
        
        formatTimestamp(timestamp) {
            if (!timestamp) return 'N/A';
            const date = new Date(typeof timestamp === 'number' && timestamp < 10000000000 ? timestamp * 1000 : timestamp);
            if (isNaN(date) || date.getFullYear() < 2000) return 'Invalid Date';
            return date.toLocaleDateString(undefined, { 
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        },
        
        formatTimeAgo(timestamp) {
            const now = Date.now();
            const diffMs = now - timestamp;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);
            
            if (diffDay > 0) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
            if (diffHour > 0) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
            if (diffMin > 0) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
            return 'Just now';
        },
        
        formatChange(oldVal, newVal) {
            const change = newVal - oldVal;
            if (change > 0) {
                return `<span class="increase">${oldVal.toLocaleString()} → ${newVal.toLocaleString()} (+${change.toLocaleString()})</span>`;
            } else if (change < 0) {
                return `<span class="decrease">${oldVal.toLocaleString()} → ${newVal.toLocaleString()} (${change.toLocaleString()})</span>`;
            } else {
                return `${oldVal.toLocaleString()} → ${newVal.toLocaleString()} (no change)`;
            }
        },
        
        getStatColor(value) {
            if (value >= 80) return '#4CAF50'; // Green for high values
            if (value >= 60) return '#8BC34A'; // Light green
            if (value >= 40) return '#FFC107'; // Yellow/amber
            if (value >= 20) return '#FF9800'; // Orange
            return '#F44336'; // Red for low values
        },
        
        showNotification(message, type = 'info') {
            const notif = document.createElement('div');
            notif.className = `notification ${type}`;
            notif.textContent = message;
            document.body.appendChild(notif);
            
            // Fade in
            setTimeout(() => {
                notif.style.opacity = '1';
            }, 10);
            
            // Fade out and remove
            setTimeout(() => {
                notif.style.opacity = '0';
                setTimeout(() => {
                    document.body.removeChild(notif);
                }, 300);
            }, 3000);
        }
    };

    // API Data Manager
    const DataManager = {
        async fetchRacingStats() {
            const apiKey = Config.get('apiKey');
            if (!apiKey) {
                Utils.showNotification('API key is required to fetch stats', 'error');
                return false;
            }
            
            if (State.isFetching) {
                Utils.showNotification('A request is already in progress', 'info');
                return false;
            }
            
            State.isFetching = true;
            
            try {
                // Show loading notification
                Utils.showNotification('Fetching racing stats...', 'info');
                
                // Make API request using GM_xmlhttpRequest for cross-origin support
                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: `https://api.torn.com/v2/user/personalstats?cat=racing&key=${apiKey}`,
                        timeout: 10000,
                        onload: (res) => {
                            if (res.status === 200) {
                                resolve(JSON.parse(res.responseText));
                            } else {
                                reject(new Error(`HTTP Error ${res.status}: ${res.statusText}`));
                            }
                        },
                        onerror: (e) => reject(new Error('Network Error')),
                        ontimeout: () => reject(new Error('Request timed out'))
                    });
                });
                
                if (response.error) {
                    throw new Error(response.error.error);
                }
                
                // Process the stats
                this.processStats(response.personalstats.racing);
                
                // Update last fetch time
                State.lastFetchTime = Date.now();
                State.save();
                
                // Show success notification
                Utils.showNotification('Racing stats updated successfully', 'success');
                
                return true;
            } catch (error) {
                console.error('Error fetching racing stats:', error);
                Utils.showNotification(`Error: ${error.message}`, 'error');
                return false;
            } finally {
                State.isFetching = false;
            }
        },
        
        processStats(newStats) {
            const oldStats = State.racingStats?.racing;
            
            // Create the changes object
            const changes = {
                timestamp: Date.now(),
                skill: { old: oldStats?.skill || 0, new: newStats.skill || 0 },
                points: { old: oldStats?.points || 0, new: newStats.points || 0 },
                racesEntered: { old: oldStats?.races?.entered || 0, new: newStats.races?.entered || 0 },
                racesWon: { old: oldStats?.races?.won || 0, new: newStats.races?.won || 0 }
            };
            
            // Only add to history if this is initial data or something changed
            if (!oldStats || 
                changes.skill.old !== changes.skill.new ||
                changes.points.old !== changes.points.new ||
                changes.racesEntered.old !== changes.racesEntered.new ||
                changes.racesWon.old !== changes.racesWon.new) {
                
                // Add to history
                State.statsHistory.unshift(changes);
                
                // Limit history size
                State.statsHistory = State.statsHistory.slice(0, Config.get('maxHistoryEntries'));
            }
            
            // Update current stats
            State.racingStats = { racing: newStats };
            
            // Save state
            State.save();
            
            return changes;
        },
        
        setupAutoFetch() {
            // Check for auto-fetch on load
            if (Config.get('autoFetch')) {
                const lastFetch = State.lastFetchTime;
                const currentTime = Date.now();
                const fetchInterval = Config.get('fetchInterval') * 60 * 1000; // convert minutes to ms
                
                if (currentTime - lastFetch > fetchInterval) {
                    // It's time to fetch new data
                    this.fetchRacingStats();
                }
                
                // Set up interval for future fetches
                setInterval(() => {
                    if (Config.get('autoFetch')) {
                        this.fetchRacingStats();
                    }
                }, fetchInterval);
            }
        }
    };

    // User Interface
    const UI = {
        createPopup() {
            // Remove any existing popup
            const existingPopup = document.querySelector('.stats-popup-overlay');
            if (existingPopup) existingPopup.remove();
            
            // Create popup container
            const overlay = document.createElement('div');
            overlay.className = 'stats-popup-overlay';
            
            // Create popup content
            const popup = document.createElement('div');
            popup.className = 'stats-popup';
            
            // Add header
            popup.innerHTML = `
                <div class="stats-popup-header">
                    <div class="stats-popup-title">Racing Stats Tracker</div>
                    <button class="stats-popup-close">Close</button>
                </div>
                <div class="stats-content">
                    ${this.generateCurrentStatsHTML()}
                    ${this.generateCarStatsHTML()}
                    ${this.generateHistoryHTML()}
                    ${this.generateSettingsHTML()}
                </div>
            `;
            
            // Add event listeners
            popup.querySelector('.stats-popup-close').addEventListener('click', () => {
                overlay.remove();
            });
            
            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                }
            });
            
            // Add popup to overlay and overlay to document
            overlay.appendChild(popup);
            document.body.appendChild(overlay);
            
            // Set up settings functionality
            this.setupSettingsHandlers(popup);
            
            return overlay;
        },
        
        generateCurrentStatsHTML() {
            // If we don't have stats yet
            if (!State.racingStats?.racing && !State.preciseSkill) {
                return `
                    <div class="current-stats">
                        <div class="section-title">Current Racing Stats</div>
                        <div class="stat-card" style="grid-column: 1 / -1;">
                            <div class="stat-label">No data available</div>
                            <button class="settings-btn refresh-btn fetch-stats-btn">Fetch Stats</button>
                        </div>
                    </div>
                `;
            }
            
            const racingStats = State.racingStats?.racing || {};
            const skillValue = State.preciseSkill !== null ? State.preciseSkill : (racingStats.skill || 0);
            const classDisplay = State.carClass ? 
                `<span class="car-class">Class ${State.carClass}</span>` : '';
            
            return `
                <div class="current-stats">
                    <div class="section-title">
                        Current Racing Stats
                        <span style="float: right; font-size: 12px; font-weight: normal; color: #999;">
                            Last updated: ${Utils.formatTimeAgo(State.lastFetchTime)}
                        </span>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-label">Racing Skill</div>
                        <div class="stat-value">${skillValue.toLocaleString()} ${classDisplay}</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-label">Racing Points</div>
                        <div class="stat-value">${(racingStats.points || 0).toLocaleString()}</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-label">Races Entered</div>
                        <div class="stat-value">${(racingStats.races?.entered || 0).toLocaleString()}</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-label">Races Won</div>
                        <div class="stat-value">${(racingStats.races?.won || 0).toLocaleString()}</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-label">Win Rate</div>
                        <div class="stat-value">
                            ${racingStats.races?.entered ? 
                                ((racingStats.races.won / racingStats.races.entered) * 100).toFixed(1) + '%' : 
                                '0%'
                            }
                        </div>
                    </div>
                    
                    <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end; margin-top: 10px;">
                        <button class="settings-btn refresh-btn fetch-stats-btn">Refresh Stats</button>
                    </div>
                </div>
            `;
        },
        
        generateCarStatsHTML() {
            if (!State.currentCar) {
                return '';
            }
            
            const car = State.currentCar;
            const stats = car.stats || {};
            
            return `
                <div class="car-stats">
                    <div class="section-title">Current Car</div>
                    
                    <div class="car-title">
                        <div class="car-name">${car.name || 'Unknown'}</div>
                        <div class="car-type">${car.type || 'Unknown'}</div>
                    </div>
                    
                    ${stats['top speed'] !== undefined ? `
                        <div class="stat-card">
                            <div class="stat-label">Top Speed</div>
                            <div class="stat-value">${Math.round(stats['top speed'])}%</div>
                            <div class="stat-bar-container">
                                <div class="stat-bar" style="width: ${stats['top speed']}%; background-color: ${Utils.getStatColor(stats['top speed'])}"></div>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${stats['acceleration'] !== undefined ? `
                        <div class="stat-card">
                            <div class="stat-label">Acceleration</div>
                            <div class="stat-value">${Math.round(stats['acceleration'])}%</div>
                            <div class="stat-bar-container">
                                <div class="stat-bar" style="width: ${stats['acceleration']}%; background-color: ${Utils.getStatColor(stats['acceleration'])}"></div>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${stats['handling'] !== undefined ? `
                        <div class="stat-card">
                            <div class="stat-label">Handling</div>
                            <div class="stat-value">${Math.round(stats['handling'])}%</div>
                            <div class="stat-bar-container">
                                <div class="stat-bar" style="width: ${stats['handling']}%; background-color: ${Utils.getStatColor(stats['handling'])}"></div>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${stats['braking'] !== undefined ? `
                        <div class="stat-card">
                            <div class="stat-label">Braking</div>
                            <div class="stat-value">${Math.round(stats['braking'])}%</div>
                            <div class="stat-bar-container">
                                <div class="stat-bar" style="width: ${stats['braking']}%; background-color: ${Utils.getStatColor(stats['braking'])}"></div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        },
        
        generateHistoryHTML() {
            if (State.statsHistory.length === 0) {
                return `
                    <div class="section-title" style="margin-top: 20px;">Stats History</div>
                    <div class="history-entry">
                        <div style="text-align: center; padding: 20px;">
                            No history available yet. Fetch stats to start tracking changes.
                        </div>
                    </div>
                `;
            }
            
            let historyHTML = `<div class="section-title" style="margin-top: 20px;">Stats History</div>`;
            
            // Generate entries
            historyHTML += State.statsHistory.map(entry => `
                <div class="history-entry">
                    <div class="history-time">${Utils.formatTimestamp(entry.timestamp)}</div>
                    <div class="history-stats">
                        <div class="history-stat">
                            <div class="history-stat-label">Racing Skill</div>
                            <div class="history-stat-value">${Utils.formatChange(entry.skill.old, entry.skill.new)}</div>
                        </div>
                        <div class="history-stat">
                            <div class="history-stat-label">Racing Points</div>
                            <div class="history-stat-value">${Utils.formatChange(entry.points.old, entry.points.new)}</div>
                        </div>
                        <div class="history-stat">
                            <div class="history-stat-label">Races Entered</div>
                            <div class="history-stat-value">${Utils.formatChange(entry.racesEntered.old, entry.racesEntered.new)}</div>
                        </div>
                        <div class="history-stat">
                            <div class="history-stat-label">Races Won</div>
                            <div class="history-stat-value">${Utils.formatChange(entry.racesWon.old, entry.racesWon.new)}</div>
                        </div>
                    </div>
                </div>
            `).join('');
            
            return historyHTML;
        },
        
        generateSettingsHTML() {
            return `
                <div class="settings-section">
                    <div class="settings-title">Settings</div>
                    <div class="settings-group">
                        <div class="settings-item">
                            <label for="apiKey">Torn API Key</label>
                            <input type="password" id="apiKey" class="api-key-input" 
                                value="${Config.get('apiKey')}" placeholder="Enter your Torn API key">
                        </div>
                        
                        <div class="settings-item" style="flex-direction: row; align-items: center; gap: 10px;">
                            <input type="checkbox" id="autoFetch" ${Config.get('autoFetch') ? 'checked' : ''}>
                            <label for="autoFetch">Auto-fetch stats</label>
                        </div>
                        
                        <div class="settings-item">
                            <label for="fetchInterval">Fetch interval (minutes)</label>
                            <input type="number" id="fetchInterval" class="api-key-input" 
                                value="${Config.get('fetchInterval')}" min="5" max="1440">
                        </div>
                        
                        <div class="settings-item">
                            <label for="maxHistoryEntries">Maximum history entries</label>
                            <input type="number" id="maxHistoryEntries" class="api-key-input" 
                                value="${Config.get('maxHistoryEntries')}" min="10" max="500">
                        </div>
                        
                        <div class="settings-buttons">
                            <button class="settings-btn" id="clearHistory">Clear History</button>
                            <button class="settings-btn refresh-btn" id="saveSettings">Save Settings</button>
                        </div>
                    </div>
                </div>
            `;
        },
        
        setupSettingsHandlers(popup) {
            // Fetch stats button
            const fetchBtns = popup.querySelectorAll('.fetch-stats-btn');
            fetchBtns.forEach(btn => {
                btn.addEventListener('click', async () => {
                    btn.disabled = true;
                    btn.textContent = 'Fetching...';
                    
                    const success = await DataManager.fetchRacingStats();
                    
                    if (success) {
                        // Refresh the popup content
                        const statsContent = popup.querySelector('.stats-content');
                        statsContent.innerHTML = `
                            ${this.generateCurrentStatsHTML()}
                            ${this.generateCarStatsHTML()}
                            ${this.generateHistoryHTML()}
                            ${this.generateSettingsHTML()}
                        `;
                        
                        // Re-setup handlers
                        this.setupSettingsHandlers(popup);
                    }
                    
                    btn.disabled = false;
                    btn.textContent = 'Refresh Stats';
                });
            });
            
            // Save settings button
            const saveBtn = popup.querySelector('#saveSettings');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    const apiKey = popup.querySelector('#apiKey').value;
                    const autoFetch = popup.querySelector('#autoFetch').checked;
                    const fetchInterval = parseInt(popup.querySelector('#fetchInterval').value, 10);
                    const maxHistoryEntries = parseInt(popup.querySelector('#maxHistoryEntries').value, 10);
                    
                    // Validate inputs
                    if (fetchInterval < 5) {
                        Utils.showNotification('Fetch interval must be at least 5 minutes', 'error');
                        return;
                    }
                    
                    if (maxHistoryEntries < 10) {
                        Utils.showNotification('Must keep at least 10 history entries', 'error');
                        return;
                    }
                    
                    // Save settings
                    Config.set('apiKey', apiKey);
                    Config.set('autoFetch', autoFetch);
                    Config.set('fetchInterval', fetchInterval);
                    Config.set('maxHistoryEntries', maxHistoryEntries);
                    
                    // Trim history if needed
                    if (State.statsHistory.length > maxHistoryEntries) {
                        State.statsHistory = State.statsHistory.slice(0, maxHistoryEntries);
                        State.save();
                    }
                    
                    Utils.showNotification('Settings saved successfully', 'success');
                });
            }
            
            // Clear history button
            const clearBtn = popup.querySelector('#clearHistory');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    if (confirm('Are you sure you want to clear all stats history?')) {
                        State.statsHistory = [];
                        State.save();
                        
                        // Refresh the history section
                        const historySection = popup.querySelector('.section-title + .history-entry');
                        if (historySection) {
                            const parent = historySection.parentElement;
                            const title = popup.querySelector('.section-title');
                            
                            // Replace with empty history message
                            parent.innerHTML = `
                                <div class="section-title" style="margin-top: 20px;">Stats History</div>
                                <div class="history-entry">
                                    <div style="text-align: center; padding: 20px;">
                                        No history available yet. Fetch stats to start tracking changes.
                                    </div>
                                </div>
                            `;
                        }
                        
                        Utils.showNotification('History cleared successfully', 'success');
                    }
                });
            }
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
            if (!buttonContainer.querySelector('.stats-history-button')) {
                const statsButton = document.createElement('div');
                statsButton.className = 'telemetry-button stats-history-button';
                statsButton.textContent = 'Stats History';
                statsButton.addEventListener('click', () => {
                    this.createPopup();
                });
                
                buttonContainer.appendChild(statsButton);
            }
        }
    };

    // Main application
    const App = {
        initialize() {
            try {
                // Initialize configuration and state
                Config.load();
                State.init();
                
                // Find container
                const container = document.querySelector('.cont-black');
                if (!container) {
                    console.error('Racing container not found');
                    return;
                }
                
                // Initialize UI
                UI.initializeUI(container);
                
                // Extract player info from page
                State.extractPlayerInfo();
                
                // Setup auto-fetch if enabled
                DataManager.setupAutoFetch();
            } catch (e) {
                console.error('Initialization failed:', e);
            }
        }
    };

    // Initialize the application
    if (document.readyState === 'complete') {
        App.initialize();
    } else {
        window.addEventListener('load', App.initialize);
    }
    
    // Setup observer for page changes
    const racingUpdatesObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 && node.id === 'racingupdates') {
                    App.initialize();
                }
            });
        });
    });
    
    racingUpdatesObserver.observe(document.body, { childList: true, subtree: true });
})();