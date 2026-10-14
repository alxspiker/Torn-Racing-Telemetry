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
