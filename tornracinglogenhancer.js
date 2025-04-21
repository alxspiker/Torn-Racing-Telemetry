// ==UserScript==
// @name         Torn Racing Log Enhancer
// @namespace    https://www.torn.com/profiles.php?XID=2782979
// @version      1.0.0
// @description  Enhances Torn racing logs with detailed race history and track information
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

    if (window.racingLogEnhancerHasRun) return;
    window.racingLogEnhancerHasRun = true;

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
            preferredView: 'recent' // 'recent' or 'tracks'
        },
        
        data: {},
        
        load() {
            try {
                this.data = {...this.defaults, ...JSON.parse(GM_getValue('racingLogEnhancerConfig', '{}'))};
            } catch (e) {
                console.error("Error loading config:", e);
                this.data = {...this.defaults};
            }
            return this.data;
        },
        
        save() { 
            GM_setValue('racingLogEnhancerConfig', JSON.stringify(this.data)); 
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
        raceLog: [],
        tracks: {},
        currentRaceId: null,
        currentTrackId: null,
        isFetching: false,
        
        init() {
            try {
                this.raceLog = JSON.parse(GM_getValue('raceLog', '[]')).filter(r => r?.id);
                this.raceLog = this.raceLog.slice(0, Config.get('maxRaces'));
                
                this.tracks = JSON.parse(GM_getValue('trackInfo', '{}'));
            } catch (e) {
                console.error("Error initializing state:", e);
                this.raceLog = [];
                this.tracks = {};
            }
            return this;
        },
        
        save() {
            GM_setValue('raceLog', JSON.stringify(this.raceLog));
            GM_setValue('trackInfo', JSON.stringify(this.tracks));
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
                
                // If we have a race ID and we're looking at a race log page
                if (this.currentRaceId && window.location.href.includes('raceID=')) {
                    this.extractRaceLogInfo();
                }
                
                // Try to extract current race info from the page
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
                
                // Extract track details
                const trackName = infoElement.dataset.name || '';
                const trackDesc = infoElement.dataset.desc || '';
                const trackLength = infoElement.dataset.length || '';
                
                // Store track info
                if (!this.tracks[trackId]) {
                    this.tracks[trackId] = {
                        id: trackId,
                        name: trackName,
                        description: trackDesc,
                        length: parseFloat(trackLength.match(/(\d+\.?\d*)/)?.[1] || '0'),
                        races: []
                    };
                    this.save();
                }
            } catch (e) {
                console.error('Error extracting track info:', e);
            }
        },
        
        extractRaceLogInfo() {
            try {
                const raceId = this.currentRaceId;
                
                // Check for track info on the race log page
                const trackSection = document.querySelector('.track-section');
                if (!trackSection) return;
                
                const nameElement = trackSection.querySelector('b');
                if (!nameElement) return;
                
                const descElement = trackSection.querySelector('i');
                const tracklengthElement = trackSection.querySelectorAll('li')[1]?.querySelector('span');
                const lapsElement = trackSection.querySelectorAll('li')[2]?.querySelector('span');
                
                const trackName = nameElement.textContent.trim();
                const trackDesc = descElement ? descElement.textContent.trim() : '';
                const trackLength = tracklengthElement ? 
                    parseFloat(tracklengthElement.textContent.match(/(\d+\.?\d*)/)?.[1] || '0') : 0;
                const laps = lapsElement ? parseInt(lapsElement.textContent.trim() || '0') : 0;
                
                // Find existing race or add new one
                let race = this.raceLog.find(r => r.id === raceId);
                
                if (!race) {
                    // Create new race entry
                    race = {
                        id: raceId,
                        trackName: trackName,
                        trackLength: trackLength,
                        trackDescription: trackDesc,
                        laps: laps,
                        fetchedAt: Date.now()
                    };
                    
                    // Add to race log
                    this.raceLog.unshift(race);
                    this.raceLog = this.raceLog.slice(0, Config.get('maxRaces'));
                } else {
                    // Update existing race
                    race.trackName = trackName;
                    race.trackLength = trackLength;
                    race.trackDescription = trackDesc;
                    race.laps = laps;
                }
                
                // Save changes
                this.save();
                
                // Update track information as well
                const trackId = document.querySelector('.track-section')?.dataset?.track;
                if (trackId) {
                    if (!this.tracks[trackId]) {
                        this.tracks[trackId] = {
                            id: trackId,
                            name: trackName,
                            description: trackDesc,
                            length: trackLength,
                            races: []
                        };
                    }
                    
                    // Add this race to the track's race list if not already there
                    if (!this.tracks[trackId].races.includes(raceId)) {
                        this.tracks[trackId].races.push(raceId);
                    }
                    
                    this.save();
                }
            } catch (e) {
                console.error('Error extracting race log info:', e);
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
        
        getStatusClass(status) {
            if (!status) return '';
            const statusLower = status.toLowerCase();
            if (statusLower === 'active') return 'active';
            if (statusLower === 'finished') return 'finished';
            return 'waiting';
        },
        
        getPositionClass(position) {
            if (position === 1) return 'position-1';
            if (position === 2) return 'position-2';
            if (position === 3) return 'position-3';
            return '';
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
        async fetchRaces() {
            const apiKey = Config.get('apiKey');
            if (!apiKey) {
                Utils.showNotification('API key is required to fetch races', 'error');
                return false;
            }
            
            if (State.isFetching) {
                Utils.showNotification('A request is already in progress', 'info');
                return false;
            }
            
            State.isFetching = true;
            
            try {
                // Show loading notification
                Utils.showNotification('Fetching race logs...', 'info');
                
                // Make API request using GM_xmlhttpRequest for cross-origin support
                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: `https://api.torn.com/v2/user/races?key=${apiKey}&limit=${Config.get('maxRaces')}&sort=DESC&cat=official`,
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
                
                // Process the races
                if (response.races) {
                    await this.processRaces(response.races);
                }
                
                // Show success notification
                Utils.showNotification('Race logs updated successfully', 'success');
                
                return true;
            } catch (error) {
                console.error('Error fetching races:', error);
                Utils.showNotification(`Error: ${error.message}`, 'error');
                return false;
            } finally {
                State.isFetching = false;
            }
        },
        
        async processRaces(races) {
            // First update the races we have
            for (const race of races) {
                const existingIndex = State.raceLog.findIndex(r => r.id === race.id);
                
                if (existingIndex !== -1) {
                    // Update existing race but preserve track info
                    const existing = State.raceLog[existingIndex];
                    
                    State.raceLog[existingIndex] = { 
                        ...race, 
                        fetchedAt: Date.now(),
                        trackName: existing.trackName || null, 
                        trackLength: existing.trackLength || null, 
                        trackDescription: existing.trackDescription || null,
                        laps: existing.laps || null
                    };
                } else {
                    // Add new race
                    State.raceLog.unshift({
                        ...race,
                        fetchedAt: Date.now(),
                        trackName: null,
                        trackLength: null,
                        trackDescription: null,
                        laps: null
                    });
                }
            }
            
            // Limit race log size
            State.raceLog = State.raceLog.slice(0, Config.get('maxRaces'));
            
            // Now update track information where missing
            for (const race of State.raceLog) {
                // Skip races that already have track info
                if (race.trackName) continue;
                
                // If the race has a track_id, use that to find track info
                if (race.track_id && State.tracks[race.track_id]) {
                    const trackInfo = State.tracks[race.track_id];
                    race.trackName = trackInfo.name;
                    race.trackLength = trackInfo.length;
                    race.trackDescription = trackInfo.description;
                    
                    // Add this race to the track's race list if not already there
                    if (!trackInfo.races.includes(race.id)) {
                        trackInfo.races.push(race.id);
                    }
                }
            }
            
            // Save updated state
            State.save();
        },
        
        // Try to find track info for a race
        updateRaceWithTrackInfo(raceId, trackInfo) {
            if (!raceId || !trackInfo) return false;
            
            const index = State.raceLog.findIndex(r => r.id === raceId);
            if (index === -1) return false;
            
            State.raceLog[index].trackName = trackInfo.name || State.raceLog[index].trackName;
            State.raceLog[index].trackLength = trackInfo.length || State.raceLog[index].trackLength;
            State.raceLog[index].trackDescription = trackInfo.description || State.raceLog[index].trackDescription;
            State.raceLog[index].laps = trackInfo.laps || State.raceLog[index].laps;
            
            // Update track information too
            if (trackInfo.id) {
                if (!State.tracks[trackInfo.id]) {
                    State.tracks[trackInfo.id] = {
                        id: trackInfo.id,
                        name: trackInfo.name,
                        description: trackInfo.description,
                        length: trackInfo.length,
                        races: []
                    };
                }
                
                // Add this race to the track's race list if not already there
                if (!State.tracks[trackInfo.id].races.includes(raceId)) {
                    State.tracks[trackInfo.id].races.push(raceId);
                }
            }
            
            // Save changes
            State.save();
            return true;
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
                    <div class="racelog-title">Torn Racing Logs</div>
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
            if (State.raceLog.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 30px;">
                        <p>No race logs available yet.</p>
                        <button class="settings-btn primary-btn fetch-races-btn">Fetch Race Logs</button>
                    </div>
                `;
                
                // Add event listener to fetch button
                container.querySelector('.fetch-races-btn').addEventListener('click', async () => {
                    const success = await DataManager.fetchRaces();
                    if (success) {
                        this.loadRecentRaces(popup);
                    }
                });
                
                return;
            }
            
            // Sort races by start time (newest first)
            const sortedRaces = [...State.raceLog].sort((a, b) => {
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
                
                const success = await DataManager.fetchRaces();
                
                if (success) {
                    this.loadRecentRaces(popup);
                }
                
                button.disabled = false;
                button.textContent = 'Refresh Races';
            });
        },
        
        // Generate HTML for a race card
        generateRaceCard(race, isCurrent = false) {
            const trackInfo = race.trackName ? 
                `${race.trackName}${race.trackLength ? ` (${race.trackLength} mi)` : ''}` : 
                `Track ID: ${race.track_id || 'Unknown'}`;
            
            const statusClass = Utils.getStatusClass(race.status);
            const statusHTML = `<span class="race-status ${statusClass}">${race.status || 'Unknown'}</span>`;
            
            // Calculate position info
            let positionInfo = '';
            if (race.user_data?.position) {
                positionInfo = `<span class="position-you">Position: ${race.user_data.position}/${race.participants?.maximum || 0}</span>`;
            }
            
            // Format title
            let title = race.title || 'Untitled Race';
            if (race.trackName && title.startsWith('Off race by')) {
                title = `${race.trackName} - ${title}`;
            }
            
            // Generate participants table if available
            let participantsHTML = '';
            if (race.scores && race.scores.length > 0) {
                participantsHTML = `
                    <div class="race-participants">
                        <div class="participants-title">Participants</div>
                        <table class="positions-table">
                            <thead>
                                <tr>
                                    <th>Position</th>
                                    <th>Name</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${race.scores.map((score, index) => {
                                    const posClass = Utils.getPositionClass(index + 1);
                                    const isUser = score.user_id === race.user_data?.user_id;
                                    return `
                                        <tr class="${isUser ? 'position-you' : ''}">
                                            <td class="${posClass}">${index + 1}</td>
                                            <td>${score.user_name} [${score.user_id}]</td>
                                            <td>${score.time || 'DNF'}</td>
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
                                ${isCurrent ? 'Current Race: ' : ''}${title}
                            </a>
                        </div>
                        <div class="race-id">ID: ${race.id} ${positionInfo}</div>
                    </div>
                    
                    <div class="race-meta">
                        <div class="race-info-item">
                            <div class="info-label">Track</div>
                            <div class="info-value">${trackInfo}</div>
                        </div>
                        
                        <div class="race-info-item">
                            <div class="info-label">Status</div>
                            <div class="info-value">${statusHTML}</div>
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
                    
                    ${race.trackDescription ? `
                        <div class="race-details">
                            <div class="race-description">${race.trackDescription}</div>
                        </div>
                    ` : ''}
                    
                    ${participantsHTML}
                </div>
            `;
        },
        
        // Load and display track statistics
        loadTrackStats(popup) {
            const container = popup.querySelector('#track-stats');
            
            // Get all tracks with at least one race
            const tracksWithRaces = Object.values(State.tracks).filter(track => track.races && track.races.length > 0);
            
            // If no tracks with races, show message
            if (tracksWithRaces.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 30px;">
                        <p>No track statistics available yet.</p>
                        <p>Race logs need to be fetched first to collect track information.</p>
                        <button class="settings-btn primary-btn fetch-races-btn">Fetch Race Logs</button>
                    </div>
                `;
                
                // Add event listener to fetch button
                container.querySelector('.fetch-races-btn').addEventListener('click', async () => {
                    const success = await DataManager.fetchRaces();
                    if (success) {
                        this.loadTrackStats(popup);
                    }
                });
                
                return;
            }
            
            // Sort tracks by number of races (most raced first)
            tracksWithRaces.sort((a, b) => b.races.length - a.races.length);
            
            // Generate track cards
            let tracksHTML = `
                <div class="track-stats-header">
                    Track Statistics
                    <button class="settings-btn primary-btn fetch-races-btn">Refresh Data</button>
                </div>
                
                <div class="track-list">
                    ${tracksWithRaces.map(track => this.generateTrackCard(track)).join('')}
                </div>
            `;
            
            container.innerHTML = tracksHTML;
            
            // Add event listener to fetch button
            container.querySelector('.fetch-races-btn').addEventListener('click', async () => {
                const button = container.querySelector('.fetch-races-btn');
                button.disabled = true;
                button.textContent = 'Fetching...';
                
                const success = await DataManager.fetchRaces();
                
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
            const raceCount = track.races.length;
            
            // Find races with this track ID
            const trackRaces = State.raceLog.filter(race => 
                race.track_id === track.id || 
                (race.trackName === track.name && race.trackLength === track.length)
            );
            
            // Filter for finished races with timing data
            const finishedRaces = trackRaces.filter(race => 
                race.user_data?.position && 
                race.user_data?.time
            );
            
            // Calculate best time
            let bestTime = 'N/A';
            let bestRace = null;
            
            if (finishedRaces.length > 0) {
                bestRace = finishedRaces.reduce((best, race) => {
                    const timeA = race.user_data?.time;
                    const timeB = best.user_data?.time;
                    
                    if (!timeA) return best;
                    if (!timeB) return race;
                    
                    // Compare times (format: MM:SS.ms)
                    const [minA, secA] = timeA.split(':');
                    const [minB, secB] = timeB.split(':');
                    
                    const totalSecondsA = parseInt(minA) * 60 + parseFloat(secA);
                    const totalSecondsB = parseInt(minB) * 60 + parseFloat(secB);
                    
                    return totalSecondsA < totalSecondsB ? race : best;
                }, finishedRaces[0]);
                
                bestTime = bestRace.user_data.time;
            }
            
            // Calculate best position
            let bestPosition = 'N/A';
            if (finishedRaces.length > 0) {
                const positions = finishedRaces.map(race => race.user_data.position);
                bestPosition = Math.min(...positions);
            }
            
            // Calculate win rate
            let winRate = 'N/A';
            if (finishedRaces.length > 0) {
                const wins = finishedRaces.filter(race => race.user_data.position === 1).length;
                winRate = `${((wins / finishedRaces.length) * 100).toFixed(1)}%`;
            }
            
            return `
                <div class="track-card">
                    <div class="track-card-name">${track.name}</div>
                    
                    <div class="track-card-stats">
                        <div class="track-card-stat">
                            <div class="stat-name">Length</div>
                            <div class="stat-value">${track.length} mi</div>
                        </div>
                        
                        <div class="track-card-stat">
                            <div class="stat-name">Races</div>
                            <div class="stat-value">${raceCount}</div>
                        </div>
                        
                        <div class="track-card-stat">
                            <div class="stat-name">Best Time</div>
                            <div class="stat-value">${bestTime}</div>
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
                        </div>
                        
                        <div class="settings-item" style="flex-direction: row; align-items: center; gap: 10px;">
                            <input type="checkbox" id="autoFetch" ${Config.get('autoFetch') ? 'checked' : ''}>
                            <label for="autoFetch">Auto-fetch race information for current race</label>
                        </div>
                        
                        <div class="settings-item">
                            <label for="maxRaces">Maximum races to store</label>
                            <input type="number" id="maxRaces" class="api-key-input" 
                                value="${Config.get('maxRaces')}" min="10" max="100">
                        </div>
                        
                        <div class="settings-buttons">
                            <button class="settings-btn" id="clearData">Clear All Data</button>
                            <button class="settings-btn primary-btn" id="saveSettings">Save Settings</button>
                        </div>
                    </div>
                </div>
            `;
        },
        
        // Setup event handlers for settings
        setupSettingsHandlers(popup) {
            // Save settings button
            const saveBtn = popup.querySelector('#saveSettings');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    const apiKey = popup.querySelector('#apiKey').value;
                    const autoFetch = popup.querySelector('#autoFetch').checked;
                    const maxRaces = parseInt(popup.querySelector('#maxRaces').value, 10);
                    
                    // Validate inputs
                    if (maxRaces < 10 || maxRaces > 100) {
                        Utils.showNotification('Maximum races must be between 10 and 100', 'error');
                        return;
                    }
                    
                    // Save settings
                    Config.set('apiKey', apiKey);
                    Config.set('autoFetch', autoFetch);
                    Config.set('maxRaces', maxRaces);
                    
                    // Trim race log if needed
                    if (State.raceLog.length > maxRaces) {
                        State.raceLog = State.raceLog.slice(0, maxRaces);
                        State.save();
                    }
                    
                    Utils.showNotification('Settings saved successfully', 'success');
                });
            }
            
            // Clear data button
            const clearBtn = popup.querySelector('#clearData');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    if (confirm('Are you sure you want to clear all race logs and track data?')) {
                        State.raceLog = [];
                        State.tracks = {};
                        State.save();
                        
                        // Refresh the popup content
                        this.loadRecentRaces(popup);
                        this.loadTrackStats(popup);
                        
                        Utils.showNotification('All data cleared successfully', 'success');
                    }
                });
            }
            
            // Fetch races button (in settings tab)
            const fetchBtn = popup.querySelector('.fetch-races-btn');
            if (fetchBtn) {
                fetchBtn.addEventListener('click', async () => {
                    const success = await DataManager.fetchRaces();
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
            if (!buttonContainer.querySelector('.race-logs-button')) {
                const logsButton = document.createElement('div');
                logsButton.className = 'telemetry-button race-logs-button';
                logsButton.textContent = 'Race Logs';
                logsButton.addEventListener('click', () => {
                    this.createPopup();
                });
                
                buttonContainer.appendChild(logsButton);
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
                
                // Check if we're on a race page and update info
                State.updateCurrentRaceInfo();
                
                // If auto-fetch is enabled and we have an API key, fetch race data
                if (Config.get('autoFetch') && Config.get('apiKey') && State.currentRaceId) {
                    // Only fetch if we don't already have this race or it's been a while
                    const existingRace = State.raceLog.find(r => r.id === State.currentRaceId);
                    const shouldFetch = !existingRace || 
                        (Date.now() - (existingRace.fetchedAt || 0) > 30 * 60 * 1000); // 30 minutes
                    
                    if (shouldFetch) {
                        DataManager.fetchRaces();
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