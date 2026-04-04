    const UI = {
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
            settingsContent.appendChild(createSettingsItem({ control: createToggleControl('historyEnabled', 'Enable History Panel & Logging') }));
            settingsContent.appendChild(createSettingsItem({ control: createToggleControl('statsPanelEnabled', 'Enable Stats Panel') }));
            settingsContent.appendChild(createDivider());

            const telemetryGroup = Utils.createElement('div', { className: 'telemetry-options-group' });
            telemetryGroup.appendChild(createToggleControl('telemetryShowSpeed', 'Show Speed'));
            telemetryGroup.appendChild(createToggleControl('telemetryShowAcceleration', 'Show Acceleration'));
            telemetryGroup.appendChild(createToggleControl('telemetryShowProgress', 'Show Progress %'));
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
                helpText: 'Animation only applies if just Speed, just Accel, or only Speed & Accel are shown. Uses capped duration.'
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
                labelText: 'Lap Est. Smoothing (0.01-1.0)',
                control: Utils.createElement('input', { attrs: { type: 'number', id: 'lapEstimateSmoothingFactor', min: '0.01', max: '1.0', step: '0.01' } })
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
            settingsContent.appendChild(createSettingsItem({
                labelText: 'History: Check Interval (ms)',
                control: Utils.createElement('input', { attrs: { type: 'number', id: 'historyCheckInterval', min: '5000', max: '60000', step: '1000' } })
            }));
            settingsContent.appendChild(createSettingsItem({
                labelText: 'History: Max Log Entries',
                control: Utils.createElement('input', { attrs: { type: 'number', id: 'historyLogLimit', min: '5', max: '50', step: '1' } })
            }));
            settingsContent.appendChild(createDivider());
            settingsContent.appendChild(createSettingsItem({ control: createToggleControl('hideOriginalList', "Hide Torn's Leaderboard") }));

            const settingsButtons = Utils.createElement('div', { className: 'settings-buttons' });
            settingsButtons.append(
                Utils.createElement('button', { className: 'settings-btn toggle-telemetry-btn', text: 'Toggle Telemetry' }),
                Utils.createElement('button', { className: 'settings-btn primary', attrs: { id: 'saveSettings' }, text: 'Save & Close' })
            );
            settingsContent.appendChild(settingsButtons);

            const dataButtons = Utils.createElement('div', { className: 'settings-data-buttons' });
            dataButtons.append(
                Utils.createElement('button', { className: 'settings-btn danger', attrs: { id: 'clearData' }, text: 'Clear Script Data' }),
                Utils.createElement('button', { className: 'settings-btn danger', attrs: { id: 'clearApiKey' }, text: 'Clear API Key' })
            );
            settingsContent.appendChild(dataButtons);

            content.append(titleRow, settingsContent);

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
            content.querySelector('#historyCheckInterval').value = Config.get('historyCheckInterval');
            content.querySelector('#historyLogLimit').value = Config.get('historyLogLimit');
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
                State.settingsPopupInstance = null;
            };

            content.querySelector('.settings-close').addEventListener('click', closePopup);
            popup.addEventListener('click', e => { if (e.target === popup) closePopup(); });
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
                const historyWasEnabled = Config.get('historyEnabled');
                const selectedOptions = [];

                if (content.querySelector('#telemetryShowSpeed').checked) selectedOptions.push('speed');
                if (content.querySelector('#telemetryShowAcceleration').checked) selectedOptions.push('acceleration');
                if (content.querySelector('#telemetryShowProgress').checked) selectedOptions.push('progress');
                Config.set('telemetryDisplayOptions', selectedOptions);

                Config.set('historyEnabled', content.querySelector('#historyEnabled').checked);
                Config.set('statsPanelEnabled', content.querySelector('#statsPanelEnabled').checked);
                Config.set('speedUnit', content.querySelector('#speedUnit').value);
                Config.set('colorCode', content.querySelector('#colorCode').checked);
                Config.set('animateChanges', content.querySelector('#animateChanges').checked);

                let speedSmooth = parseFloat(content.querySelector('#speedSmoothingFactor').value);
                if (isNaN(speedSmooth) || speedSmooth < 0.1 || speedSmooth > 0.9) {
                    speedSmooth = Config.defaults.speedSmoothingFactor;
                    content.querySelector('#speedSmoothingFactor').value = speedSmooth;
                    Utils.showNotification('Invalid Speed Smoothing Factor, reset to default.', 'error');
                }
                Config.set('speedSmoothingFactor', speedSmooth);

                let animDuration = parseInt(content.querySelector('#maxAnimationDurationMs').value, 10);
                if (isNaN(animDuration) || animDuration < 100 || animDuration > 3000) {
                    animDuration = Config.defaults.maxAnimationDurationMs;
                    content.querySelector('#maxAnimationDurationMs').value = animDuration;
                    Utils.showNotification('Invalid Max Animation Duration, reset to default.', 'error');
                }
                Config.set('maxAnimationDurationMs', animDuration);

                Config.set('showLapEstimate', content.querySelector('#showLapEstimate').checked);
                Config.set('fetchApiStatsOnClick', content.querySelector('#fetchApiStatsOnClick').checked);

                const apiKeyInputFromUser = content.querySelector('#apiKey').value.trim();
                if (apiKeyInputFromUser.length > 0 && apiKeyInputFromUser.length < 16 && apiKeyInputFromUser !== '###PDA-APIKEY###') {
                    Utils.showNotification('API Key seems too short.', 'error');
                } else {
                    Config.set('apiKey', apiKeyInputFromUser);
                }

                let lapSmoothFactor = parseFloat(content.querySelector('#lapEstimateSmoothingFactor').value);
                if (isNaN(lapSmoothFactor) || lapSmoothFactor < 0.01 || lapSmoothFactor > 1.0) {
                    lapSmoothFactor = Config.defaults.lapEstimateSmoothingFactor;
                    content.querySelector('#lapEstimateSmoothingFactor').value = lapSmoothFactor;
                    Utils.showNotification('Invalid Lap Est. Smoothing Factor, reset to default.', 'error');
                }
                Config.set('lapEstimateSmoothingFactor', lapSmoothFactor);

                let raceLimit = parseInt(content.querySelector('#historicalRaceLimit').value, 10);
                if (isNaN(raceLimit) || raceLimit < 10 || raceLimit > 1000) {
                    raceLimit = Config.defaults.historicalRaceLimit;
                    content.querySelector('#historicalRaceLimit').value = raceLimit;
                    Utils.showNotification('Invalid Race Limit, reset to default.', 'error');
                }
                Config.set('historicalRaceLimit', raceLimit);

                let histInterval = parseInt(content.querySelector('#historyCheckInterval').value, 10);
                if (isNaN(histInterval) || histInterval < 5000 || histInterval > 60000) {
                    histInterval = Config.defaults.historyCheckInterval;
                    content.querySelector('#historyCheckInterval').value = histInterval;
                    Utils.showNotification('Invalid History Interval, reset to default.', 'error');
                }
                Config.set('historyCheckInterval', histInterval);

                let histLimit = parseInt(content.querySelector('#historyLogLimit').value, 10);
                if (isNaN(histLimit) || histLimit < 5 || histLimit > 50) {
                    histLimit = Config.defaults.historyLogLimit;
                    content.querySelector('#historyLogLimit').value = histLimit;
                    Utils.showNotification('Invalid History Limit, reset to default.', 'error');
                }
                Config.set('historyLogLimit', histLimit);

                await HistoryManager.refreshLogCache();
                Utils.showNotification('Settings saved!', 'success');
                closePopup();
                UI.updateControlButtonsVisibility();

                if (Config.get('historyEnabled')) {
                    HistoryManager.restartCheckInterval();
                } else if (historyWasEnabled) {
                    if (State.historyCheckIntervalId) clearInterval(State.historyCheckIntervalId);
                    State.historyCheckIntervalId = null;
                }

                RaceManager.stableUpdateCustomList();
            });

            content.querySelector('#clearData').addEventListener('click', async () => {
                if (confirm('Are you sure you want to clear all script settings (except API key) and history data? This cannot be undone.')) {
                    await Config.clearData();
                    Utils.showNotification('Script data cleared!', 'success');
                    closePopup();
                    UI.updateControlButtonsVisibility();
                    RaceManager.stableUpdateCustomList();
                    HistoryManager.restartCheckInterval();
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
        createChartContainer(canvasId, className = 'stats-chart-container') {
            const container = Utils.createElement('div', { className });
            container.appendChild(Utils.createElement('canvas', { attrs: { id: canvasId } }));
            return container;
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
        createStatSummaryParagraph(items) {
            const paragraph = document.createElement('p');
            items.forEach((item, index) => {
                if (index > 0) paragraph.append(' | ');
                paragraph.appendChild(Utils.createElement('span', { className: 'stat-label', text: `${item.label}:` }));
                paragraph.append(' ');
                paragraph.appendChild(Utils.createElement('span', { className: 'stat-value', text: item.value }));
            });
            return paragraph;
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
            State.destroyActiveCharts();

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
                State.advancedStatsPanelInstance = null;
                State.destroyActiveCharts();
            };

            content.querySelector('.stats-close').addEventListener('click', closePanel);
            popup.addEventListener('click', e => { if (e.target === popup) closePanel(); });
            popup.appendChild(content);
            document.body.appendChild(popup);
            State.advancedStatsPanelInstance = popup;

            const errorMessages = [];
            let historicalStatsContent = null;
            let trackAnalysisContent = null;
            let processedData = null;
            let trackRecords = null;
            let topCarsData = null;
            let trackRecordCount = 0;

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

                const requests = [APIManager.fetchHistoricalRaceData(apiKey, State.userId, Config.get('historicalRaceLimit'))];
                if (currentTrackId && currentRaceClass) {
                    requests.push(APIManager.fetchTrackRecords(apiKey, currentTrackId, currentRaceClass));
                } else {
                    requests.push(Promise.resolve(null));
                    if (!currentTrackId) errorMessages.push('Could not identify the current track.');
                    if (!currentRaceClass) errorMessages.push('Could not identify the race class from page banner.');
                }

                const [histResult, recordResult] = await Promise.allSettled(requests);

                if (histResult.status === 'fulfilled') {
                    processedData = StatsCalculator.processRaceData(histResult.value, State.userId);
                    historicalStatsContent = this.buildHistoricalStatsHTML(processedData);
                } else {
                    errorMessages.push(`Could not fetch historical races: ${histResult.reason?.message || 'Unknown error.'}`);
                    historicalStatsContent = this.buildHistoricalStatsHTML(null);
                }

                if (recordResult.status === 'fulfilled' && recordResult.value !== null) {
                    trackRecords = recordResult.value;
                    trackRecordCount = trackRecords.length;
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
                if (historicalStatsContent) {
                    finalFragment.appendChild(historicalStatsContent);
                }
                if (trackAnalysisContent) {
                    finalFragment.appendChild(trackAnalysisContent);
                }
                statsContentDiv.replaceChildren(finalFragment);

                if (typeof Chart !== 'undefined') {
                    this.renderStatsCharts(processedData, topCarsData, trackRecordCount);
                } else {
                    statsContentDiv.querySelectorAll('.stats-chart-container').forEach(el => {
                        el.replaceChildren(this.createPanelMessage('info-msg', 'Charting library not loaded.'));
                    });
                }
            }
        },
        buildHistoricalStatsHTML(processedData) {
            const fragment = document.createDocumentFragment();
            fragment.appendChild(Utils.createElement('h3', { text: 'Your Recent Performance' }));

            if (!processedData || processedData.totalRaces === 0) {
                fragment.appendChild(this.createPanelMessage('info-msg', 'No recent official race data found to analyze.'));
                return fragment;
            }

            const overall = processedData.overall;
            const trackStats = Object.values(processedData.trackStats).sort((a, b) => b.races - a.races);
            const carStats = Object.values(processedData.carStats).sort((a, b) => b.races - a.races);

            const analyzedParagraph = document.createElement('p');
            analyzedParagraph.append('Analyzed ');
            analyzedParagraph.appendChild(Utils.createElement('strong', { text: String(overall.races) }));
            analyzedParagraph.append(` official races from ${Utils.formatDate(processedData.firstRaceTime)} to ${Utils.formatDate(processedData.lastRaceTime)}.`);
            fragment.appendChild(analyzedParagraph);

            fragment.appendChild(this.createStatSummaryParagraph([
                { label: 'Avg Position', value: overall.avgPosition.toFixed(2) },
                { label: 'Win Rate', value: `${overall.winRate.toFixed(1)}%` },
                { label: 'Podium Rate', value: `${overall.podiumRate.toFixed(1)}%` },
                { label: 'Crash Rate', value: `${overall.crashRate.toFixed(1)}%` }
            ]));

            fragment.appendChild(Utils.createElement('h4', { text: 'Performance by Track' }));
            if (trackStats.length > 0) {
                fragment.appendChild(this.createChartContainer('trackPerformanceChart'));
                fragment.appendChild(this.createStatsTable(
                    [
                        { text: 'Track' },
                        { text: 'Races', className: 'numeric' },
                        { text: 'Avg Pos', className: 'numeric' },
                        { text: 'Win %', className: 'numeric' },
                        { text: 'Podium %', className: 'numeric' },
                        { text: 'Crash %', className: 'numeric' },
                        { text: 'Best Lap', className: 'numeric' }
                    ],
                    trackStats.map(trackStat => ({
                        cells: [
                            { text: trackStat.name },
                            { text: String(trackStat.races), className: 'numeric' },
                            { text: trackStat.avgPosition.toFixed(2), className: 'numeric' },
                            { text: trackStat.winRate.toFixed(1), className: 'numeric' },
                            { text: trackStat.podiumRate.toFixed(1), className: 'numeric' },
                            { text: trackStat.crashRate.toFixed(1), className: 'numeric' },
                            { text: trackStat.bestLap === Infinity ? '-' : `${trackStat.bestLap.toFixed(2)}s`, className: 'numeric' }
                        ]
                    }))
                ));
            } else {
                fragment.appendChild(Utils.createElement('p', { text: 'No track-specific data.' }));
            }

            fragment.appendChild(Utils.createElement('h4', { text: 'Performance by Car' }));
            if (carStats.length > 0) {
                fragment.appendChild(this.createChartContainer('carPerformanceChart'));
                fragment.appendChild(this.createStatsTable(
                    [
                        { text: 'Car' },
                        { text: 'Races', className: 'numeric' },
                        { text: 'Avg Pos', className: 'numeric' },
                        { text: 'Win %', className: 'numeric' },
                        { text: 'Podium %', className: 'numeric' },
                        { text: 'Crash %', className: 'numeric' }
                    ],
                    carStats.map(carStat => ({
                        cells: [
                            { text: carStat.name },
                            { text: String(carStat.races), className: 'numeric' },
                            { text: carStat.avgPosition.toFixed(2), className: 'numeric' },
                            { text: carStat.winRate.toFixed(1), className: 'numeric' },
                            { text: carStat.podiumRate.toFixed(1), className: 'numeric' },
                            { text: carStat.crashRate.toFixed(1), className: 'numeric' }
                        ]
                    }))
                ));
            } else {
                fragment.appendChild(Utils.createElement('p', { text: 'No car-specific data.' }));
            }

            return fragment;
        },
        buildTrackAnalysisHTML(trackRecords, currentUserCar, trackName, raceClass, topCarsData) {
            const fragment = document.createDocumentFragment();
            fragment.appendChild(Utils.createElement('h3', { text: `Track Analysis: ${trackName} (Class ${raceClass || 'Unknown'})` }));
            fragment.appendChild(Utils.createElement('h4', { text: 'Your Current Car' }));

            if (currentUserCar && currentUserCar.stats) {
                const carNameParagraph = document.createElement('p');
                carNameParagraph.appendChild(Utils.createElement('strong', { text: currentUserCar.name }));
                carNameParagraph.append(` (ID: ${currentUserCar.id})`);
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
                fallbackParagraph.append(` (ID: ${currentUserCar.id}) - `);
                fallbackParagraph.appendChild(Utils.createElement('i', { text: 'Stats could not be parsed.' }));
                fragment.appendChild(fallbackParagraph);
            } else {
                fragment.appendChild(this.createPanelMessage('info-msg', 'Could not identify your currently selected car.'));
            }

            fragment.appendChild(Utils.createElement('h4', { text: 'Track Records (Top 5)' }));
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

                fragment.appendChild(Utils.createElement('h4', { text: 'Top Performing Cars Analysis' }));
                if (topCarsData && topCarsData.length > 0) {
                    fragment.appendChild(this.createChartContainer('topCarsChart'));
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
        renderStatsCharts(processedData, topCarsData, trackRecordCount = 0) {
            const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
            const gridColor = 'rgba(255, 255, 255, 0.1)';
            const chartOptionsBase = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: textColor } }, tooltip: { mode: 'index', intersect: false } }
            };
            const barColors = ['#64B5F6', '#81C784', '#FFB74D', '#E57373', '#BA68C8', '#FFF176', '#7986CB', '#4DD0E1', '#FF8A65', '#A1887F'];

            if (processedData?.trackStats && Object.keys(processedData.trackStats).length > 0) {
                const ctxTrack = document.getElementById('trackPerformanceChart')?.getContext('2d');
                if (ctxTrack) {
                    const trackStats = Object.values(processedData.trackStats).sort((a, b) => b.races - a.races).slice(0, 10);
                    Utils.createChart(ctxTrack, {
                        type: 'bar',
                        data: {
                            labels: trackStats.map(t => t.name.length > 15 ? `${t.name.substring(0, 12)}...` : t.name),
                            datasets: [
                                { label: 'Win %', data: trackStats.map(t => t.winRate), backgroundColor: barColors[0], yAxisID: 'yPercent' },
                                { label: 'Podium %', data: trackStats.map(t => t.podiumRate), backgroundColor: barColors[1], yAxisID: 'yPercent' },
                                { label: 'Crash %', data: trackStats.map(t => t.crashRate), backgroundColor: barColors[3], yAxisID: 'yPercent' },
                                { label: 'Races', data: trackStats.map(t => t.races), backgroundColor: barColors[4], yAxisID: 'yRaces' }
                            ]
                        },
                        options: {
                            ...chartOptionsBase,
                            scales: {
                                x: { ticks: { color: textColor, autoSkip: false, maxRotation: 90, minRotation: 45 }, grid: { color: gridColor }, title: { color: textColor } },
                                yPercent: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'Percentage (%)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                                yRaces: { type: 'linear', position: 'right', beginAtZero: true, title: { display: true, text: 'Races', color: textColor }, ticks: { color: textColor, precision: 0 }, grid: { drawOnChartArea: false } }
                            }
                        }
                    });
                }
            }

            if (processedData?.carStats && Object.keys(processedData.carStats).length > 0) {
                const ctxCar = document.getElementById('carPerformanceChart')?.getContext('2d');
                if (ctxCar) {
                    const carStats = Object.values(processedData.carStats).sort((a, b) => b.races - a.races).slice(0, 10);
                    Utils.createChart(ctxCar, {
                        type: 'bar',
                        data: {
                            labels: carStats.map(c => c.name.length > 15 ? `${c.name.substring(0, 12)}...` : c.name),
                            datasets: [
                                { label: 'Win %', data: carStats.map(c => c.winRate), backgroundColor: barColors[0], yAxisID: 'yPercent' },
                                { label: 'Podium %', data: carStats.map(c => c.podiumRate), backgroundColor: barColors[1], yAxisID: 'yPercent' },
                                { label: 'Crash %', data: carStats.map(c => c.crashRate), backgroundColor: barColors[3], yAxisID: 'yPercent' },
                                { label: 'Races', data: carStats.map(c => c.races), backgroundColor: barColors[4], yAxisID: 'yRaces' }
                            ]
                        },
                        options: {
                            ...chartOptionsBase,
                            scales: {
                                x: { ticks: { color: textColor, autoSkip: false, maxRotation: 90, minRotation: 45 }, grid: { color: gridColor }, title: { color: textColor } },
                                yPercent: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'Percentage (%)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                                yRaces: { type: 'linear', position: 'right', beginAtZero: true, title: { display: true, text: 'Races', color: textColor }, ticks: { color: textColor, precision: 0 }, grid: { drawOnChartArea: false } }
                            }
                        }
                    });
                }
            }

            if (topCarsData && topCarsData.length > 0) {
                const ctxTopCars = document.getElementById('topCarsChart')?.getContext('2d');
                if (ctxTopCars) {
                    const topCars = topCarsData.slice(0, 10);
                    Utils.createChart(ctxTopCars, {
                        type: 'bar',
                        data: {
                            labels: topCars.map(c => c.car_item_name.length > 15 ? `${c.car_item_name.substring(0, 12)}...` : c.car_item_name),
                            datasets: [{
                                label: `Times in Top ${trackRecordCount || '?'} Records`,
                                data: topCars.map(c => c.count),
                                backgroundColor: barColors.slice(0, topCars.length)
                            }]
                        },
                        options: {
                            ...chartOptionsBase,
                            indexAxis: 'y',
                            scales: {
                                x: { ticks: { color: textColor, precision: 0 }, grid: { color: gridColor }, title: { color: textColor } },
                                y: { ticks: { color: textColor }, grid: { color: gridColor }, title: { color: textColor } }
                            },
                            plugins: {
                                legend: { display: false },
                                tooltip: { mode: 'index', intersect: false }
                            }
                        }
                    });
                }
            }
        },
        parseCurrentUserCarStats() {
            const carDiv = document.querySelector('div.car-selected.left');
            if (!carDiv) return null;

            try {
                const nameEl = carDiv.querySelector('.model p:first-child');
                const imgEl = carDiv.querySelector('.model .img img.torn-item');
                const name = nameEl ? nameEl.textContent.trim() : 'Unknown Car';
                let id = null;

                if (imgEl && imgEl.src) {
                    const idMatch = imgEl.src.match(/\/items\/(\d+)\//);
                    if (idMatch) id = parseInt(idMatch[1], 10);
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
        createHistoryPanel() {
            if (!Config.get('historyEnabled')) return;
            if (State.historyPanelInstance) State.historyPanelInstance.remove();
            State.destroyActiveCharts();

            const popup = document.createElement('div');
            popup.className = 'history-panel';
            const content = document.createElement('div');
            content.className = 'history-panel-content';
            const historyContentDiv = document.createElement('div');
            historyContentDiv.className = 'history-content';

            const historyLog = HistoryManager.getLog();
            const panelContentFragment = document.createDocumentFragment();

            const formatHistoryChangeNode = (value, change, decimals = 2) => {
                if (value === null) {
                    return document.createTextNode('N/A');
                }
                const formattedValue = typeof value === 'number'
                    ? value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
                    : String(value);
                if (change === 0 || isNaN(change) || change === null) {
                    return document.createTextNode(formattedValue);
                }

                const isIncrease = change > 0;
                const sign = isIncrease ? '+' : '';
                const changeClass = isIncrease ? 'change-positive' : 'change-negative';
                const formattedChange = typeof change === 'number'
                    ? change.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
                    : String(change);
                const fragment = document.createDocumentFragment();
                fragment.append(formattedValue);
                fragment.append(' ');
                fragment.appendChild(Utils.createElement('span', {
                    className: `change-indicator ${changeClass}`,
                    text: `(${sign}${formattedChange})`
                }));
                return fragment;
            };
            const formatHistoryClassNode = (currentClass, previousClass) => {
                if (currentClass === null) {
                    return document.createTextNode('N/A');
                }
                if (!previousClass || currentClass === previousClass) {
                    return document.createTextNode(currentClass);
                }
                const fragment = document.createDocumentFragment();
                fragment.append(currentClass);
                fragment.append(' ');
                fragment.appendChild(Utils.createElement('span', {
                    className: 'change-indicator change-neutral',
                    text: `(was ${previousClass})`
                }));
                return fragment;
            };

            if (historyLog.length === 0) {
                panelContentFragment.appendChild(Utils.createElement('p', {
                    className: 'no-history-msg',
                    text: 'No historical changes recorded yet.'
                }));
            } else {
                if (historyLog.length > 1 && typeof Chart !== 'undefined') {
                    const historyChartContainer = Utils.createElement('div', { className: 'history-chart-container' });
                    historyChartContainer.appendChild(Utils.createElement('canvas', {
                        attrs: { id: 'historyProgressionChart', style: 'max-height: 250px;' }
                    }));
                    panelContentFragment.appendChild(historyChartContainer);
                } else if (historyLog.length <= 1) {
                    panelContentFragment.appendChild(Utils.createElement('p', {
                        className: 'no-history-msg',
                        text: 'Need at least two data points for a chart.'
                    }));
                } else {
                    panelContentFragment.appendChild(Utils.createElement('p', {
                        className: 'no-history-msg',
                        text: 'Charting library not loaded.'
                    }));
                }

                panelContentFragment.appendChild(Utils.createElement('h3', { text: `History Log (Last ${historyLog.length})` }));
                const table = document.createElement('table');
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                const tbody = document.createElement('tbody');
                [
                    { text: 'Date & Time', className: '' },
                    { text: 'Skill', className: 'numeric' },
                    { text: 'Class', className: 'numeric' },
                    { text: 'Points', className: 'numeric' }
                ].forEach(header => {
                    headerRow.appendChild(Utils.createElement('th', {
                        className: header.className,
                        text: header.text
                    }));
                });
                thead.appendChild(headerRow);

                for (let i = 0; i < historyLog.length; i += 1) {
                    const entry = historyLog[i];
                    const olderEntry = historyLog[i + 1] || null;
                    let skillChange = null;
                    let pointsChange = null;
                    let previousClass = null;

                    if (olderEntry) {
                        skillChange = (entry.skill !== null && olderEntry.skill !== null) ? (entry.skill - olderEntry.skill) : null;
                        pointsChange = (entry.points !== null && olderEntry.points !== null) ? (entry.points - olderEntry.points) : null;
                        previousClass = olderEntry.class;
                    }

                    const row = document.createElement('tr');
                    const dateCell = Utils.createElement('td', { text: Utils.formatDate(entry.timestamp, true) });
                    const skillCell = Utils.createElement('td', { className: 'numeric' });
                    skillCell.appendChild(formatHistoryChangeNode(entry.skill, skillChange, 2));
                    const classCell = Utils.createElement('td', { className: 'numeric' });
                    classCell.appendChild(formatHistoryClassNode(entry.class, previousClass));
                    const pointsCell = Utils.createElement('td', { className: 'numeric' });
                    pointsCell.appendChild(formatHistoryChangeNode(entry.points, pointsChange, 0));
                    row.append(dateCell, skillCell, classCell, pointsCell);
                    tbody.appendChild(row);
                }
                table.append(thead, tbody);
                panelContentFragment.appendChild(table);
            }
            historyContentDiv.replaceChildren(panelContentFragment);

            const historyTitle = Utils.createElement('div', { className: 'history-title' });
            historyTitle.append('Your Racing Stats History ');
            historyTitle.appendChild(Utils.createElement('button', { className: 'history-close', text: '\u00D7' }));
            content.appendChild(historyTitle);
            content.appendChild(historyContentDiv);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'panel-actions';

            const clearButton = document.createElement('button');
            clearButton.className = 'history-clear-button';
            clearButton.textContent = 'Clear History Log';
            clearButton.addEventListener('click', async () => {
                if (confirm('Are you sure you want to clear your entire racing stats history log? This cannot be undone.')) {
                    await HistoryManager.clearLog();
                    this.createHistoryPanel();
                    Utils.showNotification('History log cleared!', 'success');
                }
            });
            actionsDiv.appendChild(clearButton);

            const exportButton = document.createElement('button');
            exportButton.textContent = 'Export History';
            exportButton.addEventListener('click', async () => {
                const format = prompt('Export as (csv/json):') || 'csv';
                const fullHistoryLog = await HistoryManager.getFullLog();
                const dataStr = format === 'json'
                    ? JSON.stringify(fullHistoryLog, null, 2)
                    : 'Timestamp,Skill,Class,Points\n' + fullHistoryLog.map(e => `${Utils.formatDate(e.timestamp, true)},${e.skill},${e.class},${e.points}`).join('\n');
                DataExporter.downloadData(dataStr, format, `text/${format}`);
            });
            actionsDiv.appendChild(exportButton);
            content.appendChild(actionsDiv);

            const closePanel = () => {
                popup.remove();
                State.historyPanelInstance = null;
                State.destroyActiveCharts();
            };
            content.querySelector('.history-close').addEventListener('click', closePanel);
            popup.addEventListener('click', e => { if (e.target === popup) closePanel(); });

            popup.appendChild(content);
            document.body.appendChild(popup);
            State.historyPanelInstance = popup;

            if (historyLog.length > 1 && typeof Chart !== 'undefined') {
                this.renderHistoryChart(historyLog);
            }
        },
        renderHistoryChart(historyLog) {
            const ctx = document.getElementById('historyProgressionChart')?.getContext('2d');
            if (!ctx) return;

            const reversedLog = [...historyLog].reverse();
            const labels = reversedLog.map(entry => Utils.formatDate(entry.timestamp, true));
            const skillData = reversedLog.map(entry => entry.skill);
            const pointsData = reversedLog.map(entry => entry.points);
            const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
            const gridColor = 'rgba(255, 255, 255, 0.1)';

            Utils.createChart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Racing Skill',
                            data: skillData,
                            borderColor: 'var(--primary-color)',
                            backgroundColor: 'rgba(76, 175, 80, 0.1)',
                            tension: 0.1,
                            yAxisID: 'ySkill',
                            spanGaps: true,
                            pointRadius: 2,
                            pointHoverRadius: 4
                        },
                        {
                            label: 'Racing Points',
                            data: pointsData,
                            borderColor: 'var(--history-color)',
                            backgroundColor: 'rgba(255, 193, 7, 0.1)',
                            tension: 0.1,
                            yAxisID: 'yPoints',
                            spanGaps: true,
                            pointRadius: 2,
                            pointHoverRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: { ticks: { color: textColor, maxRotation: 70, minRotation: 45, autoSkip: true, maxTicksLimit: 15 }, grid: { color: gridColor }, title: { color: textColor } },
                        ySkill: { type: 'linear', position: 'left', beginAtZero: false, title: { display: true, text: 'Skill', color: textColor }, ticks: { color: textColor, precision: 2 }, grid: { color: gridColor } },
                        yPoints: { type: 'linear', position: 'right', beginAtZero: false, title: { display: true, text: 'Points', color: textColor }, ticks: { color: textColor, precision: 0 }, grid: { drawOnChartArea: false } }
                    },
                    plugins: { legend: { labels: { color: textColor } }, tooltip: { mode: 'index', intersect: false } }
                }
            });
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
                    <h3>Important Notes</h3>
                    <ul>${notesHTML}</ul>
                </div>`;

            const closePanel = () => {
                popup.remove();
                State.infoPanelInstance = null;
            };

            content.querySelector('.info-close').addEventListener('click', closePanel);
            popup.addEventListener('click', e => { if (e.target === popup) closePanel(); });
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
                                <option value="json">JSON Data</option>
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
                State.downloadPopupInstance = null;
            };

            content.querySelector('.download-close').addEventListener('click', closePopup);
            popup.addEventListener('click', e => { if (e.target === popup) closePopup(); });

            const formatSelect = content.querySelector('#downloadFormat');
            const downloadBtn = content.querySelector('#downloadFileBtn');
            const copyBtn = content.querySelector('#copyClipboardBtn');

            const performAction = actionType => {
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
                            dataString = DataExporter.formatAsJSON();
                            fileExt = 'json';
                            mimeType = 'application/json';
                            break;
                    }

                    if (actionType === 'download') {
                        DataExporter.downloadData(dataString, fileExt, mimeType);
                        Utils.showNotification('File download initiated.', 'success');
                    } else if (actionType === 'copy') {
                        DataExporter.copyToClipboard(dataString);
                        Utils.showNotification('Copied to clipboard!', 'success');
                    }
                    closePopup();
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
        },
        initializeControls() {
            if (!State.controlsContainer) return;
            State.controlsContainer.innerHTML = '';

            const infoButton = document.createElement('button');
            infoButton.className = 'telemetry-info-button';
            infoButton.textContent = '\u2139\uFE0F Info';
            infoButton.title = 'View Script Information';
            infoButton.addEventListener('click', () => { this.createInfoPanel(); });
            State.controlsContainer.appendChild(infoButton);

            const historyButton = document.createElement('button');
            historyButton.className = 'telemetry-history-button';
            historyButton.textContent = '\u{1F4DC} History';
            historyButton.title = 'View Your Racing Stats History';
            historyButton.style.display = 'none';
            historyButton.addEventListener('click', () => { this.createHistoryPanel(); });
            State.controlsContainer.appendChild(historyButton);

            const statsButton = document.createElement('button');
            statsButton.className = 'telemetry-stats-button';
            statsButton.textContent = '\u{1F4CA} Stats';
            statsButton.title = 'Open Advanced Race Statistics';
            statsButton.style.display = 'none';
            statsButton.addEventListener('click', () => {
                RaceManager.updateTrackAndClassInfo()
                    .then(() => { this.createAdvancedStatsPanel(); })
                    .catch(() => { Utils.showNotification('Error getting latest track/class info.', 'error'); });
            });
            State.controlsContainer.appendChild(statsButton);

            const downloadButton = document.createElement('button');
            downloadButton.className = 'telemetry-download-button';
            downloadButton.textContent = '\u{1F4BE} Export';
            downloadButton.title = 'Export Race Results';
            downloadButton.style.display = 'none';
            downloadButton.addEventListener('click', () => { this.createDownloadPopup(); });
            State.controlsContainer.appendChild(downloadButton);

            const settingsButton = document.createElement('button');
            settingsButton.className = 'telemetry-settings-button';
            settingsButton.textContent = '\u2699 Settings';
            settingsButton.title = 'Open Telemetry & UI Settings';
            settingsButton.addEventListener('click', () => { this.createSettingsPopup(); });
            State.controlsContainer.appendChild(settingsButton);

            this.updateControlButtonsVisibility();
            document.body.classList.toggle('telemetry-hidden', !Config.get('telemetryVisible'));
        }
    };
