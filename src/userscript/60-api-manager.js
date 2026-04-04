    const APIManager = {
        isFetching: new Set(),
        async fetchWithAuthHeader(url, apiKey, options = {}, retries = 3, baseDelay = 1000) {
            let delay = baseDelay;
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    const response = await fetch(url, { ...options, headers: { 'Accept': 'application/json', 'Authorization': 'ApiKey ' + apiKey, ...(options.headers || {}) } });
                    if (!response.ok) {
                        let errorMsg = `API Error (${response.status}): ${response.statusText}`;
                        try {
                            const errorData = await response.json();
                            if (errorData.error?.error) {
                                errorMsg = `API Error: ${errorData.error.error} (Code ${errorData.error.code})`;
                            }
                        } catch (e) {}
                        const error = new Error(errorMsg);
                        error.statusCode = response.status;
                        throw error;
                    }
                    const data = await response.json();
                    if (data.error) {
                        if (data.error.code === 2 && attempt < retries - 1) {
                            await new Promise(res => setTimeout(res, delay));
                            delay *= 2;
                            continue;
                        }
                        throw new Error(`API Error: ${data.error.error} (Code ${data.error.code})`);
                    }
                    return data;
                } catch (error) {
                    if (attempt < retries - 1 && (error.message.includes('Too many requests') || error.message.includes('Code 2') || error.statusCode === 429)) {
                        await new Promise(res => setTimeout(res, delay));
                        delay *= 2;
                        continue;
                    }
                    throw error;
                }
            }
            throw new Error('Max retries reached');
        },
        async fetchAndDisplayRacingStats(driverItem, userId) {
            const detailsDiv = driverItem.querySelector('.driver-details');
            const statsContainer = detailsDiv?.querySelector('.api-stats-container');
            if (!statsContainer || !userId || this.isFetching.has(userId)) return;

            if (!Utils.isApiKeyAvailable()) {
                statsContainer.classList.add('no-key');
                statsContainer.querySelector('.api-stat-error-msg').textContent = 'API key not configured in settings.';
                statsContainer.querySelectorAll('.api-stat').forEach(span => span.textContent = 'N/A');
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
            try { const response = await fetch(apiUrl); if (!response.ok) { let errorMsg = `HTTP error ${response.status}`; try { const errorData = await response.json(); if (errorData.error?.error) errorMsg = `API Error: ${errorData.error.error} (Code ${errorData.error.code})`; } catch (e) {} throw new Error(errorMsg); } const data = await response.json(); if (data.error) throw new Error(`API Error: ${data.error.error} (Code ${data.error.code})`); const racingStats = data?.personalstats?.racing; if (racingStats && typeof racingStats === 'object') { statsContainer.querySelector('.stat-skill').textContent = racingStats.skill?.toLocaleString() ?? 'N/A'; statsContainer.querySelector('.stat-points').textContent = racingStats.points?.toLocaleString() ?? 'N/A'; const racesEntered = racingStats.races?.entered; const racesWon = racingStats.races?.won; statsContainer.querySelector('.stat-races-entered').textContent = racesEntered?.toLocaleString() ?? 'N/A'; statsContainer.querySelector('.stat-races-won').textContent = racesWon?.toLocaleString() ?? 'N/A'; const winRate = (racesEntered && racesWon > 0) ? ((racesWon / racesEntered) * 100).toFixed(1) + '%' : (racesEntered > 0 ? '0.0%' : 'N/A'); statsContainer.querySelector('.stat-win-rate').textContent = winRate; statsContainer.classList.add('loaded'); driverItem.dataset.statsLoaded = 'true'; } else { statsContainer.classList.add('error'); statsContainer.querySelector('.api-stat-error-msg').textContent = 'No racing stats found (or permission denied).'; statsContainer.querySelectorAll('.api-stat').forEach(span => span.textContent = 'N/A'); driverItem.dataset.statsLoaded = 'true'; } } catch (error) { statsContainer.classList.add('error'); statsContainer.querySelector('.api-stat-error-msg').textContent = `Error: ${error.message}`; statsContainer.querySelectorAll('.api-stat').forEach(span => span.textContent = '-'); delete driverItem.dataset.statsLoaded; Utils.showNotification(error.message, 'error'); } finally { statsContainer.classList.remove('loading'); this.isFetching.delete(userId); }
        },
        async fetchUserRacingPoints(apiKey, userId) {
            if (!apiKey || !userId) return null;
            if (this.isFetching.has(`points-${userId}`)) return null;

            this.isFetching.add(`points-${userId}`);
            const apiUrl = `https://api.torn.com/v2/user?selections=personalstats&id=${userId}&cat=racing&key=${apiKey}`;
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    let errorMsg = `HTTP error ${response.status}`;
                    let errorData = null;
                    try { errorData = await response.json(); } catch (e) { }
                    if (errorData && errorData.error?.error) { errorMsg = `API Error: ${errorData.error.error} (Code ${errorData.error.code})`; }
                    throw new Error(errorMsg);
                }
                const data = await response.json();
                if (data.error) { throw new Error(`API Error: ${data.error.error} (Code ${data.error.code})`); }
                const points = data?.personalstats?.racing?.points;
                return typeof points === 'number' ? points : null;
            } catch (error) {
                Utils.showNotification(error.message, 'error');
                return null;
            } finally {
                this.isFetching.delete(`points-${userId}`);
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
        async fetchHistoricalRaceData(apiKey, userId, limit) { if (!apiKey) throw new Error("API Key required."); if (!userId) throw new Error("User ID required."); limit = Math.max(10, Math.min(1000, limit || 100)); const url = `https://api.torn.com/v2/user/races?key=${apiKey}&id=${userId}&cat=official&sort=DESC&limit=${limit}`; const response = await fetch(url); if (!response.ok) { let errorMsg = `API Error (${response.status}): ${response.statusText}`; try { const errorData = await response.json(); if (errorData.error?.error) errorMsg = `API Error: ${errorData.error.error} (Code ${errorData.error.code})`; } catch (e) {} throw new Error(errorMsg); } const data = await response.json(); if (data.error) { throw new Error(`API Error: ${data.error.error} (Code ${data.error.code})`); } return data.races || []; },
        async fetchTrackRecords(apiKey, trackId, raceClass) { if (!trackId) throw new Error("Track ID required."); if (!raceClass) throw new Error("Race Class required."); const url = `https://api.torn.com/v2/racing/${trackId}/records?cat=${raceClass}`; const data = await this.fetchWithAuthHeader(url, apiKey); return data.records || []; }
    };
