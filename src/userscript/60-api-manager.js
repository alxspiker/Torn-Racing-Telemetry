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
