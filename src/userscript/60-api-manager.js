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
            try {
                const data = await this.fetchJson(apiUrl, { headers: { 'Accept': 'application/json' } });
                const racingStats = data?.personalstats?.racing;

                if (racingStats && typeof racingStats === 'object') {
                    statsContainer.querySelector('.stat-skill').textContent = racingStats.skill?.toLocaleString() ?? 'N/A';
                    statsContainer.querySelector('.stat-points').textContent = racingStats.points?.toLocaleString() ?? 'N/A';
                    const racesEntered = racingStats.races?.entered;
                    const racesWon = racingStats.races?.won;
                    statsContainer.querySelector('.stat-races-entered').textContent = racesEntered?.toLocaleString() ?? 'N/A';
                    statsContainer.querySelector('.stat-races-won').textContent = racesWon?.toLocaleString() ?? 'N/A';
                    const winRate = (racesEntered && racesWon > 0) ? ((racesWon / racesEntered) * 100).toFixed(1) + '%' : (racesEntered > 0 ? '0.0%' : 'N/A');
                    statsContainer.querySelector('.stat-win-rate').textContent = winRate;
                    statsContainer.classList.add('loaded');
                    driverItem.dataset.statsLoaded = 'true';
                } else {
                    statsContainer.classList.add('error');
                    statsContainer.querySelector('.api-stat-error-msg').textContent = 'No racing stats found (or permission denied).';
                    statsContainer.querySelectorAll('.api-stat').forEach(span => span.textContent = 'N/A');
                    driverItem.dataset.statsLoaded = 'true';
                }
            } catch (error) {
                statsContainer.classList.add('error');
                statsContainer.querySelector('.api-stat-error-msg').textContent = `Error: ${error.message}`;
                statsContainer.querySelectorAll('.api-stat').forEach(span => span.textContent = '-');
                delete driverItem.dataset.statsLoaded;
                Utils.showNotification(error.message, 'error');
            } finally {
                statsContainer.classList.remove('loading');
                this.isFetching.delete(userId);
            }
        },
        async fetchUserRacingPoints(apiKey, userId) {
            if (!apiKey || !userId) return null;
            if (this.isFetching.has(`points-${userId}`)) return null;

            this.isFetching.add(`points-${userId}`);
            const apiUrl = `https://api.torn.com/v2/user?selections=personalstats&id=${userId}&cat=racing&key=${apiKey}`;
            try {
                const data = await this.fetchJson(apiUrl, { headers: { 'Accept': 'application/json' } });
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
        async fetchTrackRecords(apiKey, trackId, raceClass) { if (!trackId) throw new Error("Track ID required."); if (!raceClass) throw new Error("Race Class required."); const url = `https://api.torn.com/v2/racing/${trackId}/records?cat=${raceClass}`; const data = await this.fetchWithAuthHeader(url, apiKey); return data.records || []; }
    };
