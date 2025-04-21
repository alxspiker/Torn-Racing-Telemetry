// ==UserScript==
// @name         Torn Racing Log Enhancer (API Version)
// @namespace    https://www.torn.com/profiles.php?XID=2782979
// @version      2.0.0
// @description  Enhanced Torn racing logs with detailed race history and track information using the Torn API
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

    if (window.racingLogEnhancerAPIHasRun) return;
    window.racingLogEnhancerAPIHasRun = true;

    // Add styles (reusing most styles from original with some enhancements)
    GM_addStyle(`
        :root {
            --text-color: #e0e0e0;
            --background-dark: #1a1a1a;
            --background-light: #2a2a2a;
            --border-color: #404040;
            --accent-color: #64B5F6;
            --primary-color: #4CAF50;
            --negative-color: #f44336;
            --warning-color: #FFC107;
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

        .racelog-overlay {
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

        .racelog-popup {
            background: var(--background-dark);
            border-radius: 10px;
            border: 1px solid var(--border-color);
            width: 90%;
            max-width: 900px;
            max-height: 90vh;
            overflow-y: auto;
            padding: 20px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        }

        .racelog-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
        }

        .racelog-title {
            font-size: 20px;
            font-weight: bold;
            color: var(--primary-color);
        }

        .racelog-close {
            background: var(--background-light);
            color: var(--text-color);
            border: none;
            border-radius: 4px;
            padding: 8px 15px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .racelog-close:hover {
            background: var(--accent-color);
            color: var(--background-dark);
        }

        .racelog-tabs {
            display: flex;
            border-bottom: 1px solid var(--border-color);
            margin-bottom: 20px;
        }

        .racelog-tab {
            padding: 10px 20px;
            cursor: pointer;
            color: var(--text-color);
            background: var(--background-dark);
            transition: all 0.2s ease;
        }

        .racelog-tab:hover {
            background: var(--background-light);
        }

        .racelog-tab.active {
            background: var(--background-light);
            color: var(--primary-color);
            border-bottom: 2px solid var(--primary-color);
        }

        .racelog-content {
            padding: 10px 0;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .race-card {
            background: var(--background-light);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            border: 1px solid var(--border-color);
        }

        .race-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
        }

        .race-title {
            font-size: 18px;
            font-weight: bold;
            color: var(--accent-color);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .race-title a {
            color: inherit;
            text-decoration: none;
        }

        .race-title a:hover {
            text-decoration: underline;
        }

        .race-id {
            color: #888;
            font-size: 14px;
        }

        .race-meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 15px;
        }

        .race-info-item {
            display: flex;
            flex-direction: column;
        }

        .info-label {
            color: #888;
            font-size: 14px;
            margin-bottom: 5px;
        }

        .info-value {
            font-size: 16px;
            color: var(--text-color);
        }

        .race-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            color: white;
        }

        .race-status.active {
            background-color: var(--primary-color);
        }

        .race-status.finished {
            background-color: var(--accent-color);
        }

        .race-status.waiting {
            background-color: var(--warning-color);
            color: #333;
        }

        .race-details {
            background: var(--background-dark);
            border-radius: 6px;
            padding: 15px;
        }

        .race-description {
            color: #aaa;
            font-style: italic;
            margin-bottom: 15px;
            line-height: 1.4;
        }

        .track-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
        }

        .track-name {
            grid-column: 1 / -1;
            font-size: 16px;
            font-weight: bold;
            color: var(--highlight-color);
            margin-bottom: 5px;
        }

        .track-item {
            display: flex;
            flex-direction: column;
        }

        .track-label {
            color: #888;
            font-size: 14px;
            margin-bottom: 5px;
        }

        .track-value {
            color: var(--text-color);
            font-size: 16px;
        }

        .race-participants {
            margin-top: 15px;
        }

        .participants-title {
            font-size: 16px;
            font-weight: bold;
            color: var(--primary-color);
            margin-bottom: 10px;
        }

        .position-you {
            font-weight: bold;
            color: var(--primary-color);
        }

        .position-1 {
            font-weight: bold;
            color: gold;
        }

        .position-2 {
            font-weight: bold;
            color: silver;
        }

        .position-3 {
            font-weight: bold;
            color: #CD7F32; /* bronze */
        }

        .positions-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }

        .positions-table th {
            background: rgba(0, 0, 0, 0.3);
            color: #aaa;
            text-align: left;
            padding: 8px 12px;
        }

        .positions-table td {
            padding: 8px 12px;
            border-bottom: 1px solid var(--border-color);
        }

        .positions-table tr:nth-child(even) {
            background: rgba(0, 0, 0, 0.15);
        }

        .positions-table tr:hover {
            background: rgba(255, 255, 255, 0.05);
        }

        .track-stats {
            background: var(--background-light);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            border: 1px solid var(--border-color);
        }

        .track-stats-header {
            font-size: 18px;
            font-weight: bold;
            color: var(--primary-color);
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .track-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 15px;
        }

        .track-card {
            background: var(--background-dark);
            border-radius: 6px;
            padding: 15px;
            border: 1px solid var(--border-color);
            transition: all 0.2s ease;
        }

        .track-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }

        .track-card-name {
            font-size: 16px;
            font-weight: bold;
            color: var(--accent-color);
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
        }

        .track-card-stats {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .track-card-stat {
            background: rgba(0, 0, 0, 0.2);
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 14px;
            min-width: 120px;
        }

        .stat-name {
            color: #888;
            margin-bottom: 3px;
        }

        .stat-value {
            color: var(--text-color);
            font-weight: bold;
        }

        .track-card-description {
            margin-top: 10px;
            color: #aaa;
            font-style: italic;
            font-size: 14px;
            line-height: 1.4;
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

        .primary-btn {
            background: var(--primary-color);
            color: white;
            border: none;
        }

        .primary-btn:hover {
            background: #388E3C;
            color: white;
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

        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 30px;
            color: var(--text-color);
        }

        .loading-spinner {
            border: 4px solid rgba(0, 0, 0, 0.3);
            border-top: 4px solid var(--primary-color);
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin-right: 15px;
        }

        .api-info-badge {
            display: inline-block;
            padding: 3px 6px;
            background-color: var(--accent-color);
            color: #fff;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            margin-left: 8px;
            vertical-align: middle;
        }

        .track-record {
            background: rgba(0, 0, 0, 0.15);
            border-radius: 4px;
            padding: 8px 12px;
            margin-top: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .track-record-class {
            background: var(--accent-color);
            color: #000;
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: bold;
            margin-right: 10px;
        }

        .car-badge {
            background: rgba(0, 0, 0, 0.3);
            color: var(--text-color);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
            margin-left: 5px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        @media (max-width: 600px) {
            .racelog-popup {
                width: 95%;
                padding: 15px;
            }

            .racelog-tabs {
                flex-wrap: wrap;
            }

            .racelog-tab {
                padding: 8px 12px;
                font-size: 14px;
            }

            .race-meta {
                grid-template-columns: 1fr;
            }

            .track-list {
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
            maxRaces: 30,
            maxRecordsPerTrack: 5,
            apiRequestInterval: 60, // seconds between API requests
            preferredView: 'recent' // 'recent' or 'tracks'
        },

        data: {},

        load() {
            try {
                this.data = {...this.defaults, ...JSON.parse(GM_getValue('racingLogEnhancerAPIConfig', '{}'))};
            } catch (e) {
                console.error("Error loading config:", e);
                this.data = {...this.defaults};
            }
            return this.data;
        },

        save() {
            GM_setValue('racingLogEnhancerAPIConfig', JSON.stringify(this.data));
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
        races: [],
        tracks: {},
        trackRecords: {},
        cars: {},
        currentRaceId: null,
        currentTrackId: null,
        isFetching: false,
        lastFetchTime: 0,
        apiThrottleQueue: [],
        apiThrottleTimer: null,

        init() {
            try {
                this.races = JSON.parse(GM_getValue('races', '[]')).filter(r => r?.id);
                this.races = this.races.slice(0, Config.get('maxRaces'));

                this.tracks = JSON.parse(GM_getValue('trackInfo', '{}'));
                this.trackRecords = JSON.parse(GM_getValue('trackRecords', '{}'));
                this.cars = JSON.parse(GM_getValue('cars', '{}'));
                this.lastFetchTime = parseInt(GM_getValue('lastFetchTime', '0'));
            } catch (e) {
                console.error("Error initializing state:", e);
                this.races = [];
                this.tracks = {};
                this.trackRecords = {};
                this.cars = {};
                this.lastFetchTime = 0;
            }
            return this;
        },

        save() {
            GM_setValue('races', JSON.stringify(this.races));
            GM_setValue('trackInfo', JSON.stringify(this.tracks));
            GM_setValue('trackRecords', JSON.stringify(this.trackRecords));
            GM_setValue('cars', JSON.stringify(this.cars));
            GM_setValue('lastFetchTime', this.lastFetchTime.toString());
        },

        updateCurrentRaceInfo() {
            try {
                // Try to extract race ID from URL
                const raceIdMatch = window.location.href.match(/raceID=(\d+)/);
                if (raceIdMatch && raceIdMatch[1]) {
                    this.currentRaceId = raceIdMatch[1];
                } else {
                    // Or try to extract from leaderboard
                    const driverElement = document.querySelector('#leaderBoard li[data-id]');
                    if (driverElement) {
                        const dataId = driverElement.getAttribute('data-id');
                        if (dataId) {
                            const idMatch = dataId.match(/^(\d+)-/);
                            if (idMatch && idMatch[1]) {
                                this.currentRaceId = idMatch[1];
                            }
                        }
                    }
                }

                // Try to extract current track info from the page
                this.extractTrackInfo();
            } catch (e) {
                console.error('Error extracting race info:', e);
            }
        },

        extractTrackInfo() {
            try {
                const trackHeader = document.querySelector('.drivers-list .title-black');
                if (!trackHeader) return;

                const parentElement = trackHeader.parentElement;
                if (!parentElement) return;

                const infoElement = parentElement.querySelector('.track-info');
                if (!infoElement) return;

                const trackId = infoElement.dataset.track;
                if (!trackId) return;

                this.currentTrackId = trackId;
            } catch (e) {
                console.error('Error extracting track info:', e);
            }
        },

        // Add race to the state (if it doesn't exist or needs updating)
        addOrUpdateRace(race) {
            const existingIndex = this.races.findIndex(r => r.id === race.id);

            if (existingIndex !== -1) {
                // Update existing race
                this.races[existingIndex] = race;
            } else {
                // Add new race
                this.races.unshift(race);
                // Keep races within limit
                if (this.races.length > Config.get('maxRaces')) {
                    this.races = this.races.slice(0, Config.get('maxRaces'));
                }
            }

            this.save();
        },

        // Add track to the state
        addOrUpdateTrack(track) {
            if (!track || !track.id) return;

            // Update or add track
            this.tracks[track.id] = {
                ...this.tracks[track.id] || {},
                ...track
            };

            this.save();
        },

        // Add track records to the state
        addTrackRecords(trackId, carClass, records) {
            if (!trackId || !carClass || !records) return;

            if (!this.trackRecords[trackId]) {
                this.trackRecords[trackId] = {};
            }

            this.trackRecords[trackId][carClass] = records.slice(0, Config.get('maxRecordsPerTrack'));
            this.save();
        },

        // Add car info to the state
        addOrUpdateCar(car) {
            if (!car || !car.car_item_id) return;

            this.cars[car.car_item_id] = car;
            this.save();
        },

        // Add multiple cars
        addCars(cars) {
            if (!cars || !Array.isArray(cars)) return;

            cars.forEach(car => {
                this.addOrUpdateCar(car);
            });
        },

        // API throttling management
        queueApiRequest(apiFunction, ...args) {
            return new Promise((resolve, reject) => {
                this.apiThrottleQueue.push({
                    func: apiFunction,
                    args: args,
                    resolve: resolve,
                    reject: reject
                });

                this.processApiQueue();
            });
        },

        processApiQueue() {
            if (this.apiThrottleTimer) return;

            if (this.apiThrottleQueue.length === 0) return;

            const now = Date.now();
            const timeElapsed = now - this.lastFetchTime;
            const interval = Config.get('apiRequestInterval') * 1000;

            if (timeElapsed >= interval) {
                // Execute the next request
                const request = this.apiThrottleQueue.shift();

                this.lastFetchTime = now;

                request.func(...request.args)
                    .then(request.resolve)
                    .catch(request.reject)
                    .finally(() => {
                        // Set timer for next request
                        this.apiThrottleTimer = setTimeout(() => {
                            this.apiThrottleTimer = null;
                            this.processApiQueue();
                        }, interval);
                    });
            } else {
                // Wait for the remaining time
                const waitTime = interval - timeElapsed;

                this.apiThrottleTimer = setTimeout(() => {
                    this.apiThrottleTimer = null;
                    this.processApiQueue();
                }, waitTime);
            }
        }
    };

    // Utility functions
    const Utils = {
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

        getStatusClass(status) {
            if (!status) return '';
            const statusLower = status.toLowerCase();
            if (statusLower.includes('progress')) return 'active';
            if (statusLower.includes('finish')) return 'finished';
            return 'waiting';
        },

        getPositionClass(position) {
            if (position === 1) return 'position-1';
            if (position === 2) return 'position-2';
            if (position === 3) return 'position-3';
            return '';
        },

        formatLapTime(seconds) {
            if (!seconds && seconds !== 0) return 'N/A';

            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = (seconds % 60).toFixed(3);

            return `${minutes}:${remainingSeconds.padStart(6, '0')}`;
        },

        formatRaceTime(time) {
            if (!time) return 'DNF';

            // API returns race time as MM:SS.ms
            return time;
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
    const API = {
        async makeRequest(endpoint, params = {}) {
            const apiKey = Config.get('apiKey');
            if (!apiKey) {
                throw new Error('API key is required');
            }

            // Build query string
            const queryParams = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                queryParams.append(key, value);
            }

            const url = `https://api.torn.com/v2/${endpoint}?key=${apiKey}&${queryParams.toString()}`;

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    timeout: 10000,
                    onload: (response) => {
                        try {
                            const result = JSON.parse(response.responseText);

                            if (result.error) {
                                reject(new Error(result.error.error));
                                return;
                            }

                            resolve(result);
                        } catch (e) {
                            reject(new Error('Failed to parse API response'));
                        }
                    },
                    onerror: (error) => {
                        reject(new Error('Network error'));
                    },
                    ontimeout: () => {
                        reject(new Error('Request timeout'));
                    }
                });
            });
        },

        // Fetch races with rate limiting
        async fetchRaces(params = {}) {
            // Default parameters
            const defaultParams = {
                limit: Config.get('maxRaces'),
                sort: 'DESC'
            };

            const mergedParams = {...defaultParams, ...params};

            try {
                return await State.queueApiRequest(this.makeRequest.bind(this), 'racing/races', mergedParams);
            } catch (error) {
                console.error('Error fetching races:', error);
                throw error;
            }
        },

        // Fetch a specific race by ID
        async fetchRace(raceId) {
            try {
                return await State.queueApiRequest(this.makeRequest.bind(this), `racing/${raceId}/race`);
            } catch (error) {
                console.error(`Error fetching race ${raceId}:`, error);
                throw error;
            }
        },

        // Fetch all tracks
        async fetchTracks() {
            try {
                return await State.queueApiRequest(this.makeRequest.bind(this), 'racing/tracks');
            } catch (error) {
                console.error('Error fetching tracks:', error);
                throw error;
            }
        },

        // Fetch track records for a specific track and car class
        async fetchTrackRecords(trackId, carClass) {
            try {
                return await State.queueApiRequest(
                    this.makeRequest.bind(this),
                    `racing/${trackId}/records`,
                    { cat: carClass }
                );
            } catch (error) {
                console.error(`Error fetching track records for track ${trackId}, class ${carClass}:`, error);
                throw error;
            }
        },

        // Fetch all cars
        async fetchCars() {
            try {
                return await State.queueApiRequest(this.makeRequest.bind(this), 'racing/cars');
            } catch (error) {
                console.error('Error fetching cars:', error);
                throw error;
            }
        },

        // Fetch user races
        async fetchUserRaces(params = {}) {
            try {
                return await State.queueApiRequest(
                    this.makeRequest.bind(this),
                    'user/races',
                    {
                        limit: Config.get('maxRaces'),
                        sort: 'DESC',
                        ...params
                    }
                );
            } catch (error) {
                console.error('Error fetching user races:', error);
                throw error;
            }
        }
    };

    // Data Manager
    const DataManager = {
        async initialize() {
            // Check if we need to do an initial fetch
            const needsInitialFetch =
                Object.keys(State.tracks).length === 0 ||
                Object.keys(State.cars).length === 0;

            if (needsInitialFetch && Config.get('apiKey')) {
                try {
                    if (Object.keys(State.tracks).length === 0) {
                        await this.fetchAndStoreTracks();
                    }

                    if (Object.keys(State.cars).length === 0) {
                        await this.fetchAndStoreCars();
                    }
                } catch (error) {
                    console.error('Error during initial fetch:', error);
                }
            }
        },

        async fetchAndStoreRaces() {
            if (State.isFetching) {
                Utils.showNotification('A request is already in progress', 'info');
                return false;
            }

            if (!Config.get('apiKey')) {
                Utils.showNotification('API key is required to fetch races', 'error');
                return false;
            }

            State.isFetching = true;

            try {
                Utils.showNotification('Fetching race data...', 'info');

                // First fetch official races
                const officialRacesResponse = await API.fetchRaces({ cat: 'official' });
                if (officialRacesResponse.races) {
                    officialRacesResponse.races.forEach(race => {
                        race.fetchedAt = Date.now();
                        race.isOfficial = true;
                        State.addOrUpdateRace(race);
                    });
                }

                // Then fetch custom races
                const customRacesResponse = await API.fetchRaces({ cat: 'custom' });
                if (customRacesResponse.races) {
                    customRacesResponse.races.forEach(race => {
                        race.fetchedAt = Date.now();
                        race.isOfficial = false;
                        State.addOrUpdateRace(race);
                    });
                }

                // Also fetch user's races to get participation data
                const userRacesResponse = await API.fetchUserRaces();
                if (userRacesResponse.races) {
                    userRacesResponse.races.forEach(race => {
                        // These already contain user participation data
                        race.fetchedAt = Date.now();
                        State.addOrUpdateRace(race);
                    });
                }

                // If we have a current race ID, fetch the specific race details
                if (State.currentRaceId) {
                    try {
                        const raceDetails = await API.fetchRace(State.currentRaceId);
                        if (raceDetails) {
                            raceDetails.fetchedAt = Date.now();
                            State.addOrUpdateRace(raceDetails);
                        }
                    } catch (error) {
                        console.error(`Error fetching current race ${State.currentRaceId}:`, error);
                    }
                }

                State.lastFetchTime = Date.now();
                State.save();

                Utils.showNotification('Race data updated successfully', 'success');
                return true;
            } catch (error) {
                console.error('Error fetching races:', error);
                Utils.showNotification(`Error: ${error.message}`, 'error');
                return false;
            } finally {
                State.isFetching = false;
            }
        },

        async fetchAndStoreTracks() {
            if (!Config.get('apiKey')) {
                Utils.showNotification('API key is required to fetch tracks', 'error');
                return false;
            }

            try {
                Utils.showNotification('Fetching track data...', 'info');

                const response = await API.fetchTracks();
                if (response.tracks) {
                    response.tracks.forEach(track => {
                        State.addOrUpdateTrack(track);
                    });
                }

                State.save();

                Utils.showNotification('Track data updated successfully', 'success');
                return true;
            } catch (error) {
                console.error('Error fetching tracks:', error);
                Utils.showNotification(`Error: ${error.message}`, 'error');
                return false;
            }
        },

        async fetchAndStoreTrackRecords(trackId, carClass) {
            if (!Config.get('apiKey')) {
                Utils.showNotification('API key is required to fetch track records', 'error');
                return false;
            }

            if (!trackId || !carClass) {
                return false;
            }

            try {
                const response = await API.fetchTrackRecords(trackId, carClass);
                if (response.records) {
                    State.addTrackRecords(trackId, carClass, response.records);
                    return true;
                }
                return false;
            } catch (error) {
                console.error(`Error fetching track records for track ${trackId}, class ${carClass}:`, error);
                return false;
            }
        },

        async fetchAndStoreCars() {
            if (!Config.get('apiKey')) {
                Utils.showNotification('API key is required to fetch cars', 'error');
                return false;
            }

            try {
                Utils.showNotification('Fetching car data...', 'info');

                const response = await API.fetchCars();
                if (response.cars) {
                    State.addCars(response.cars);
                }

                State.save();

                Utils.showNotification('Car data updated successfully', 'success');
                return true;
            } catch (error) {
                console.error('Error fetching cars:', error);
                Utils.showNotification(`Error: ${error.message}`, 'error');
                return false;
            }
        },

        async fetchAndUpdateAll() {
            if (State.isFetching) {
                Utils.showNotification('A request is already in progress', 'info');
                return false;
            }

            State.isFetching = true;

            try {
                let success = true;

                // Fetch all data types
                const tracksSuccess = await this.fetchAndStoreTracks();
                const carsSuccess = await this.fetchAndStoreCars();
                const racesSuccess = await this.fetchAndStoreRaces();

                success = tracksSuccess && carsSuccess && racesSuccess;

                // Fetch records for all tracks and classes
                if (success && Object.keys(State.tracks).length > 0) {
                    const classes = ['A', 'B', 'C', 'D', 'E'];

                    // Limit to 5 tracks to avoid too many API calls
                    const trackKeys = Object.keys(State.tracks).slice(0, 5);

                    for (const trackId of trackKeys) {
                        for (const carClass of classes) {
                            await this.fetchAndStoreTrackRecords(trackId, carClass);
                        }
                    }
                }

                Utils.showNotification('All data updated successfully', 'success');
                return success;
            } catch (error) {
                console.error('Error updating all data:', error);
                Utils.showNotification(`Error: ${error.message}`, 'error');
                return false;
            } finally {
                State.isFetching = false;
            }
        }
    };

    // User Interface
    const UI = {
        createPopup() {
            // Remove any existing popup
            const existingPopup = document.querySelector('.racelog-overlay');
            if (existingPopup) existingPopup.remove();

            // Create popup container
            const overlay = document.createElement('div');
            overlay.className = 'racelog-overlay';

            // Create popup content
            const popup = document.createElement('div');
            popup.className = 'racelog-popup';

            // Add header
            popup.innerHTML = `
                <div class="racelog-header">
                    <div class="racelog-title">Torn Racing Logs <span class="api-info-badge">API</span></div>
                    <button class="racelog-close">Close</button>
                </div>

                <div class="racelog-tabs">
                    <div class="racelog-tab ${Config.get('preferredView') === 'recent' ? 'active' : ''}" data-tab="recent-races">Recent Races</div>
                    <div class="racelog-tab ${Config.get('preferredView') === 'tracks' ? 'active' : ''}" data-tab="track-stats">Track Statistics</div>
                    <div class="racelog-tab" data-tab="settings">Settings</div>
                </div>

                <div class="racelog-content">
                    <div id="recent-races" class="tab-content ${Config.get('preferredView') === 'recent' ? 'active' : ''}">
                        <div class="loading">
                            <div class="loading-spinner"></div>
                            <div>Loading races...</div>
                        </div>
                    </div>

                    <div id="track-stats" class="tab-content ${Config.get('preferredView') === 'tracks' ? 'active' : ''}">
                        <div class="loading">
                            <div class="loading-spinner"></div>
                            <div>Loading track statistics...</div>
                        </div>
                    </div>

                    <div id="settings" class="tab-content">
                        ${this.generateSettingsHTML()}
                    </div>
                </div>
            `;

            // Add event listeners
            popup.querySelector('.racelog-close').addEventListener('click', () => {
                overlay.remove();
            });

            // Tab switching
            popup.querySelectorAll('.racelog-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    // Update active tab
                    popup.querySelectorAll('.racelog-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');

                    // Show active content
                    const tabId = tab.dataset.tab;
                    popup.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    popup.querySelector(`#${tabId}`).classList.add('active');

                    // Save preference if it's one of the main views
                    if (tabId === 'recent-races' || tabId === 'track-stats') {
                        Config.set('preferredView', tabId === 'recent-races' ? 'recent' : 'tracks');
                    }
                });
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

            // Load content for tabs
            this.loadRecentRaces(popup);
            this.loadTrackStats(popup);

            // Set up settings functionality
            this.setupSettingsHandlers(popup);

            return overlay;
        },

        // Load and display recent races
        async loadRecentRaces(popup) {
            const container = popup.querySelector('#recent-races');

            // If we have no races, show message and fetch button
            if (State.races.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 30px;">
                        <p>No race logs available yet.</p>
                        <button class="settings-btn primary-btn fetch-races-btn">Fetch Race Logs</button>
                    </div>
                `;

                // Add event listener to fetch button
                container.querySelector('.fetch-races-btn').addEventListener('click', async () => {
                    const success = await DataManager.fetchAndStoreRaces();
                    if (success) {
                        this.loadRecentRaces(popup);
                    }
                });

                return;
            }

            // Sort races by start time (newest first)
            const sortedRaces = [...State.races].sort((a, b) => {
                const timeA = a.schedule?.start ? new Date(a.schedule.start).getTime() : 0;
                const timeB = b.schedule?.start ? new Date(b.schedule.start).getTime() : 0;
                return timeB - timeA;
            });

            // Generate race cards
            let racesHTML = `
                <div style="display: flex; justify-content: flex-end; margin-bottom: 15px;">
                    <button class="settings-btn primary-btn fetch-races-btn">Refresh Races</button>
                </div>
            `;

            // Check if we have a current race
            if (State.currentRaceId) {
                const currentRace = sortedRaces.find(r => r.id === State.currentRaceId);
                if (currentRace) {
                    racesHTML += this.generateRaceCard(currentRace, true);
                }
            }

            // Add all other races
            racesHTML += sortedRaces
                .filter(race => race.id !== State.currentRaceId)
                .map(race => this.generateRaceCard(race))
                .join('');

            container.innerHTML = racesHTML;

            // Add event listener to fetch button
            popup.querySelector('.fetch-races-btn').addEventListener('click', async () => {
                const button = popup.querySelector('.fetch-races-btn');
                button.disabled = true;
                button.textContent = 'Fetching...';

                const success = await DataManager.fetchAndStoreRaces();

                if (success) {
                    this.loadRecentRaces(popup);
                }

                button.disabled = false;
                button.textContent = 'Refresh Races';
            });
        },

        // Generate HTML for a race card
        generateRaceCard(race, isCurrent = false) {
            // Get track information
            const track = State.tracks[race.track_id] || { title: 'Unknown Track', description: '', id: race.track_id };

            // Format title
            let title = race.title || 'Untitled Race';
            if (track && track.title && title.includes('race by')) {
                title = `${track.title} - ${title}`;
            }

            // Determine race status
            let status = race.status || 'Unknown';
            if (race.schedule?.end) {
                status = 'Finished';
            } else if (race.schedule?.start && new Date(race.schedule.start) < new Date()) {
                status = 'In Progress';
            } else {
                status = 'Waiting';
            }

            const statusClass = Utils.getStatusClass(status);
            const statusHTML = `<span class="race-status ${statusClass}">${status}</span>`;

            // User's position information
            let positionInfo = '';
            if (race.user_data?.position) {
                positionInfo = `<span class="position-you">Position: ${race.user_data.position}/${race.participants?.maximum || 0}</span>`;
            }

            // Generate participants table
            let participantsHTML = '';
            if (race.results && race.results.length > 0) {
                participantsHTML = `
                    <div class="race-participants">
                        <div class="participants-title">Participants</div>
                        <table class="positions-table">
                            <thead>
                                <tr>
                                    <th>Position</th>
                                    <th>Driver</th>
                                    <th>Car</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${race.results.map((result, index) => {
                                    const posClass = Utils.getPositionClass(index + 1);
                                    const isUser = result.driver_id === race.user_data?.driver_id;
                                    const car = State.cars[result.car_item_id] || { car_item_name: 'Unknown Car' };
                                    const carClass = car.class ? `<span class="car-badge class-${car.class}">${car.class}</span>` : '';

                                    return `
                                        <tr class="${isUser ? 'position-you' : ''}">
                                            <td class="${posClass}">${result.position || index + 1}</td>
                                            <td>${(isUser ? '👤 ' : '') + result.driver_name || `Driver #${result.driver_id}`}</td>
                                            <td>${car.car_item_name}${carClass}</td>
                                            <td>${Utils.formatRaceTime(result.race_time)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }

            return `
                <div class="race-card ${isCurrent ? 'current-race' : ''}">
                    <div class="race-header">
                        <div class="race-title">
                            <a href="https://www.torn.com/loader.php?sid=racing&tab=log&raceID=${race.id}" target="_self">
                                ${isCurrent ? '🏎️ Current Race: ' : ''}${title}
                            </a>
                        </div>
                        <div class="race-id">ID: ${race.id} ${positionInfo}</div>
                    </div>

                    <div class="race-meta">
                        <div class="race-info-item">
                            <div class="info-label">Track</div>
                            <div class="info-value">${track.title} (ID: ${race.track_id})</div>
                        </div>

                        <div class="race-info-item">
                            <div class="info-label">Status</div>
                            <div class="info-value">${statusHTML}</div>
                        </div>

                        <div class="race-info-item">
                            <div class="info-label">Type</div>
                            <div class="info-value">${race.isOfficial ? 'Official' : 'Custom'}</div>
                        </div>

                        <div class="race-info-item">
                            <div class="info-label">Laps</div>
                            <div class="info-value">${race.laps || '0'}</div>
                        </div>

                        <div class="race-info-item">
                            <div class="info-label">Participants</div>
                            <div class="info-value">${race.participants?.current || '0'}/${race.participants?.maximum || '0'}</div>
                        </div>

                        <div class="race-info-item">
                            <div class="info-label">Start Time</div>
                            <div class="info-value">${race.schedule?.start ? Utils.formatTimestamp(race.schedule.start) : 'N/A'}</div>
                        </div>
                    </div>

                    ${track.description ? `
                        <div class="race-details">
                            <div class="race-description">${track.description}</div>
                        </div>
                    ` : ''}

                    ${participantsHTML}
                </div>
            `;
        },

        // Load and display track statistics
        loadTrackStats(popup) {
            const container = popup.querySelector('#track-stats');

            // If no tracks, show message
            if (Object.keys(State.tracks).length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 30px;">
                        <p>No track data available yet.</p>
                        <button class="settings-btn primary-btn fetch-tracks-btn">Fetch Track Data</button>
                    </div>
                `;

                // Add event listener to fetch button
                container.querySelector('.fetch-tracks-btn').addEventListener('click', async () => {
                    const success = await DataManager.fetchAndStoreTracks();
                    if (success) {
                        this.loadTrackStats(popup);
                    }
                });

                return;
            }

            // Get all tracks
            const tracks = Object.values(State.tracks);

            // Find tracks that have races
            const tracksWithRaceCount = tracks.map(track => {
                const races = State.races.filter(race => race.track_id === track.id);
                return {
                    ...track,
                    raceCount: races.length,
                    races: races
                };
            }).sort((a, b) => b.raceCount - a.raceCount);

            // Generate track cards
            let tracksHTML = `
                <div class="track-stats-header">
                    Track Statistics
                    <button class="settings-btn primary-btn fetch-tracks-btn">Refresh Data</button>
                </div>

                <div class="track-list">
                    ${tracksWithRaceCount.map(track => this.generateTrackCard(track)).join('')}
                </div>
            `;

            container.innerHTML = tracksHTML;

            // Add event listener to fetch button
            container.querySelector('.fetch-tracks-btn').addEventListener('click', async () => {
                const button = container.querySelector('.fetch-tracks-btn');
                button.disabled = true;
                button.textContent = 'Fetching...';

                const success = await DataManager.fetchAndUpdateAll();

                if (success) {
                    this.loadTrackStats(popup);
                }

                button.disabled = false;
                button.textContent = 'Refresh Data';
            });
        },

        // Generate HTML for a track card
        generateTrackCard(track) {
            // Calculate statistics for this track
            const raceCount = track.raceCount || 0;

            // Find user races on this track
            const userRaces = track.races ? track.races.filter(race => race.user_data?.position) : [];

            // Calculate best position and win rate
            let bestPosition = 'N/A';
            let winRate = 'N/A';

            if (userRaces.length > 0) {
                const positions = userRaces.map(race => race.user_data.position).filter(pos => pos !== undefined);
                if (positions.length > 0) {
                    bestPosition = Math.min(...positions);
                }

                const wins = userRaces.filter(race => race.user_data.position === 1).length;
                if (userRaces.length > 0) {
                    winRate = `${((wins / userRaces.length) * 100).toFixed(1)}%`;
                }
            }

            // Get track records for this track
            let recordsHTML = '';
            const recordsByClass = State.trackRecords[track.id] || {};
            const classes = Object.keys(recordsByClass).sort();

            if (classes.length > 0) {
                recordsHTML = `
                    <div style="margin-top: 15px;">
                        <div style="font-weight: bold; margin-bottom: 5px;">Track Records:</div>
                        ${classes.map(carClass => {
                            const records = recordsByClass[carClass];
                            if (!records || records.length === 0) return '';

                            const bestRecord = records[0];
                            const car = State.cars[bestRecord.car_item_id] || { car_item_name: 'Unknown Car' };

                            return `
                                <div class="track-record">
                                    <span><span class="track-record-class">${carClass}</span> ${Utils.formatLapTime(bestRecord.lap_time)}</span>
                                    <span>${bestRecord.driver_name} (${car.car_item_name})</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            } else if (track.id) {
                // Show button to fetch records if we have track ID
                recordsHTML = `
                    <div style="margin-top: 15px;">
                        <button class="settings-btn fetch-records-btn" data-track-id="${track.id}">
                            Fetch Track Records
                        </button>
                    </div>
                `;
            }

            return `
                <div class="track-card">
                    <div class="track-card-name">${track.title} (ID: ${track.id})</div>

                    <div class="track-card-stats">
                        <div class="track-card-stat">
                            <div class="stat-name">Your Races</div>
                            <div class="stat-value">${raceCount}</div>
                        </div>

                        <div class="track-card-stat">
                            <div class="stat-name">Best Position</div>
                            <div class="stat-value">${bestPosition}</div>
                        </div>

                        <div class="track-card-stat">
                            <div class="stat-name">Win Rate</div>
                            <div class="stat-value">${winRate}</div>
                        </div>
                    </div>

                    ${track.description ? `
                        <div class="track-card-description">${track.description}</div>
                    ` : ''}

                    ${recordsHTML}
                </div>
            `;
        },

        // Generate HTML for settings tab
        generateSettingsHTML() {
            return `
                <div class="settings-section">
                    <div class="settings-title">Settings</div>
                    <div class="settings-group">
                        <div class="settings-item">
                            <label for="apiKey">Torn API Key</label>
                            <input type="password" id="apiKey" class="api-key-input"
                                value="${Config.get('apiKey')}" placeholder="Enter your Torn API key">
                            <small style="color: #888; margin-top: 5px;">
                                A public access key is sufficient for most features.
                                <br>A minimal key will allow access to your race history.
                            </small>
                        </div>

                        <div class="settings-item" style="flex-direction: row; align-items: center; gap: 10px;">
                            <input type="checkbox" id="autoFetch" ${Config.get('autoFetch') ? 'checked' : ''}>
                            <label for="autoFetch">Auto-fetch data for current race</label>
                        </div>

                        <div class="settings-item">
                            <label for="maxRaces">Maximum races to store</label>
                            <input type="number" id="maxRaces" class="api-key-input"
                                value="${Config.get('maxRaces')}" min="10" max="100">
                        </div>

                        <div class="settings-item">
                            <label for="apiRequestInterval">API Request Interval (seconds)</label>
                            <input type="number" id="apiRequestInterval" class="api-key-input"
                                value="${Config.get('apiRequestInterval')}" min="30" max="3600">
                            <small style="color: #888; margin-top: 5px;">
                                Minimum time between API requests. Recommended: 60+ seconds to avoid rate limits.
                            </small>
                        </div>

                        <div class="settings-buttons">
                            <button class="settings-btn" id="clearData">Clear All Data</button>
                            <button class="settings-btn primary-btn" id="saveSettings">Save Settings</button>
                        </div>

                        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border-color);">
                            <h3 style="margin-bottom: 10px; color: var(--primary-color);">API Information</h3>
                            <p style="margin-bottom: 10px;">
                                This script uses the Torn API to fetch racing information directly,
                                providing more accurate and detailed data than the previous version.
                            </p>
                            <p style="margin-bottom: 10px;">
                                Key API endpoints used:
                            </p>
                            <ul style="list-style: disc; margin-left: 20px; color: #aaa;">
                                <li>/racing/races - Get a list of races</li>
                                <li>/racing/{raceId}/race - Get specific race details</li>
                                <li>/racing/tracks - Get track information</li>
                                <li>/racing/{trackId}/records - Get track records</li>
                                <li>/racing/cars - Get car information</li>
                                <li>/user/races - Get your race history</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        },

        // Setup event handlers for settings
        setupSettingsHandlers(popup) {
            // Fetch records buttons
            popup.querySelectorAll('.fetch-records-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const trackId = e.target.dataset.trackId;
                    if (!trackId) return;

                    e.target.disabled = true;
                    e.target.textContent = 'Fetching...';

                    // Fetch records for all classes
                    const classes = ['A', 'B', 'C', 'D', 'E'];
                    let success = false;

                    for (const carClass of classes) {
                        const result = await DataManager.fetchAndStoreTrackRecords(trackId, carClass);
                        if (result) success = true;
                    }

                    if (success) {
                        this.loadTrackStats(popup);
                    } else {
                        e.target.disabled = false;
                        e.target.textContent = 'Fetch Track Records';
                        Utils.showNotification('Failed to fetch track records', 'error');
                    }
                });
            });

            // Save settings button
            const saveBtn = popup.querySelector('#saveSettings');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    const apiKey = popup.querySelector('#apiKey').value;
                    const autoFetch = popup.querySelector('#autoFetch').checked;
                    const maxRaces = parseInt(popup.querySelector('#maxRaces').value, 10);
                    const apiRequestInterval = parseInt(popup.querySelector('#apiRequestInterval').value, 10);

                    // Validate inputs
                    if (maxRaces < 10 || maxRaces > 100) {
                        Utils.showNotification('Maximum races must be between 10 and 100', 'error');
                        return;
                    }

                    if (apiRequestInterval < 30 || apiRequestInterval > 3600) {
                        Utils.showNotification('API request interval must be between 30 and 3600 seconds', 'error');
                        return;
                    }

                    // Save settings
                    Config.set('apiKey', apiKey);
                    Config.set('autoFetch', autoFetch);
                    Config.set('maxRaces', maxRaces);
                    Config.set('apiRequestInterval', apiRequestInterval);

                    // Trim race log if needed
                    if (State.races.length > maxRaces) {
                        State.races = State.races.slice(0, maxRaces);
                        State.save();
                    }

                    Utils.showNotification('Settings saved successfully', 'success');

                    // If API key changed, trigger an initial data fetch
                    if (apiKey && Object.keys(State.tracks).length === 0) {
                        DataManager.fetchAndStoreTracks();
                    }

                    if (apiKey && Object.keys(State.cars).length === 0) {
                        DataManager.fetchAndStoreCars();
                    }
                });
            }

            // Clear data button
            const clearBtn = popup.querySelector('#clearData');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    if (confirm('Are you sure you want to clear all race logs and track data?')) {
                        State.races = [];
                        State.tracks = {};
                        State.trackRecords = {};
                        State.cars = {};
                        State.save();

                        // Refresh the popup content
                        this.loadRecentRaces(popup);
                        this.loadTrackStats(popup);

                        Utils.showNotification('All data cleared successfully', 'success');
                    }
                });
            }

            // Fetch races button (in settings tab)
            const fetchBtn = popup.querySelector('.fetch-races-btn, .fetch-tracks-btn');
            if (fetchBtn) {
                fetchBtn.addEventListener('click', async () => {
                    const success = await DataManager.fetchAndUpdateAll();
                    if (success) {
                        // If we're in the tracks tab, reload it
                        const tracksTab = popup.querySelector('#track-stats');
                        if (tracksTab.classList.contains('active')) {
                            this.loadTrackStats(popup);
                        } else {
                            // Otherwise reload races tab
                            this.loadRecentRaces(popup);
                        }
                    }
                });
            }
        },

        // Initialize UI
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
            if (!buttonContainer.querySelector('.race-logs-api-button')) {
                const logsButton = document.createElement('div');
                logsButton.className = 'telemetry-button race-logs-api-button';
                logsButton.textContent = 'Race Logs API';
                logsButton.addEventListener('click', () => {
                    this.createPopup();
                });

                buttonContainer.appendChild(logsButton);
            }
        }
    };

    // Main application
    const App = {
        async initialize() {
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

                // Check if we're on a race page and update info
                State.updateCurrentRaceInfo();

                // Initialize data
                await DataManager.initialize();

                // If auto-fetch is enabled and we have an API key, fetch race data
                if (Config.get('autoFetch') && Config.get('apiKey') && State.currentRaceId) {
                    // Only fetch if we don't already have this race or it's been a while
                    const existingRace = State.races.find(r => r.id === State.currentRaceId);
                    const shouldFetch = !existingRace ||
                        (Date.now() - (existingRace.fetchedAt || 0) > 30 * 60 * 1000); // 30 minutes

                    if (shouldFetch) {
                        try {
                            const raceDetails = await API.fetchRace(State.currentRaceId);
                            if (raceDetails) {
                                raceDetails.fetchedAt = Date.now();
                                State.addOrUpdateRace(raceDetails);
                            }
                        } catch (error) {
                            console.error('Error auto-fetching current race:', error);
                        }
                    }
                }
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
