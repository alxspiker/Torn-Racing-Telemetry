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
            settingsContent.appendChild(createSettingsItem({ control: createToggleControl('historyEnabled', 'Enable History Panel') }));
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
                Utils.showNotification('Settings saved!', 'success');
                closePopup();
                UI.updateControlButtonsVisibility();

                RaceManager.stableUpdateCustomList();
            });

            content.querySelector('#clearData').addEventListener('click', async () => {
                if (confirm('Are you sure you want to clear all script settings (except API key)? This cannot be undone.')) {
                    await Config.clearData();
                    Utils.showNotification('Script data cleared!', 'success');
                    closePopup();
                    UI.updateControlButtonsVisibility();
                    RaceManager.stableUpdateCustomList();
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
        createStatsCards(items, wrapperClass = 'stats-summary-cards') {
            const wrapper = Utils.createElement('div', { className: wrapperClass });
            items.forEach(item => {
                const card = Utils.createElement('div', { className: 'stats-summary-card' });
                const label = Utils.createElement('div', { className: 'stats-summary-label', text: item.label });
                const value = Utils.createElement('div', {
                    className: `stats-summary-value${item.trendClass ? ` ${item.trendClass}` : ''}`,
                    text: item.value
                });
                card.append(label, value);
                wrapper.appendChild(card);
            });
            return wrapper;
        },
        aggregateRaceWindow(entries) {
            const races = Array.isArray(entries) ? entries : [];
            const finished = races.filter(entry => !entry.crashed && Number.isFinite(entry.position));
            const crashes = races.filter(entry => entry.crashed).length;
            const wins = finished.filter(entry => entry.position === 1).length;
            const avgPosition = finished.length ? (finished.reduce((sum, entry) => sum + entry.position, 0) / finished.length) : null;
            const winRate = finished.length ? (wins / finished.length) * 100 : null;
            const crashRate = races.length ? (crashes / races.length) * 100 : null;
            const bestLapValues = races.map(entry => entry.bestLap).filter(value => Number.isFinite(value));
            const avgBestLap = bestLapValues.length
                ? (bestLapValues.reduce((sum, value) => sum + value, 0) / bestLapValues.length)
                : null;
            const skillGainTotal = races.reduce((sum, entry) => sum + (Number.isFinite(entry.skillGain) ? entry.skillGain : 0), 0);
            return { races: races.length, avgPosition, winRate, crashRate, avgBestLap, skillGainTotal };
        },
        createSortableStatsTableSection({ title, columns, rows, defaultSortKey, defaultSortDir = 'desc', emptyMessage = 'No data available.' }) {
            const section = document.createDocumentFragment();
            section.appendChild(Utils.createElement('h3', { text: title }));

            if (!Array.isArray(rows) || rows.length === 0) {
                section.appendChild(this.createPanelMessage('info-msg', emptyMessage));
                return section;
            }

            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const tbody = document.createElement('tbody');
            const sortState = {
                key: defaultSortKey || columns[0]?.key,
                dir: defaultSortDir
            };

            const getColumn = key => columns.find(column => column.key === key) || columns[0];
            const getSortValue = (row, column) => {
                if (typeof column.sortValue === 'function') return column.sortValue(row);
                return row[column.key];
            };
            const compareRows = (left, right) => {
                const column = getColumn(sortState.key);
                const leftValue = getSortValue(left, column);
                const rightValue = getSortValue(right, column);
                const leftMissing = leftValue === null || typeof leftValue === 'undefined';
                const rightMissing = rightValue === null || typeof rightValue === 'undefined';

                let result = 0;
                if (leftMissing && rightMissing) result = 0;
                else if (leftMissing) result = 1;
                else if (rightMissing) result = -1;
                else if (typeof leftValue === 'number' && typeof rightValue === 'number') result = leftValue - rightValue;
                else result = String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: 'base', numeric: true });

                return sortState.dir === 'asc' ? result : -result;
            };
            const renderRows = () => {
                const sortedRows = [...rows].sort(compareRows);
                const nodes = sortedRows.map(row => {
                    const tr = Utils.createElement('tr', { className: row.className || '' });
                    columns.forEach(column => {
                        const td = Utils.createElement('td', { className: column.className || '' });
                        const value = typeof column.render === 'function'
                            ? column.render(row)
                            : row[column.key];
                        if (value instanceof Node) {
                            td.appendChild(value);
                        } else {
                            td.textContent = value ?? '';
                        }
                        tr.appendChild(td);
                    });
                    return tr;
                });
                tbody.replaceChildren(...nodes);
            };

            columns.forEach(column => {
                const th = Utils.createElement('th', { className: column.className || '' });
                const button = Utils.createElement('button', {
                    className: 'stats-sort-btn',
                    text: column.label,
                    attrs: { type: 'button' }
                });
                button.addEventListener('click', () => {
                    if (sortState.key === column.key) {
                        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortState.key = column.key;
                        sortState.dir = column.defaultDir || (column.className?.includes('numeric') ? 'desc' : 'asc');
                    }
                    renderRows();
                });
                th.appendChild(button);
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.append(thead, tbody);
            renderRows();
            section.appendChild(table);
            return section;
        },
        formatCentisecondsAsLapTime(lapTimeCs) {
            if (!Number.isFinite(lapTimeCs)) return '-';
            return Utils.formatTime(lapTimeCs / 100, true);
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
            let raceEntries = [];
            let userRacingRecords = [];

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

                if (!currentTrackId) errorMessages.push('Could not identify the current track.');
                if (!currentRaceClass) errorMessages.push('Could not identify the race class from page banner.');

                const historicalPromise = APIManager.fetchHistoricalRaceData(apiKey, State.userId, Config.get('historicalRaceLimit'));
                const personalRecordsPromise = APIManager.fetchUserRacingRecords(apiKey);
                const trackRecordsPromise = (currentTrackId && currentRaceClass)
                    ? APIManager.fetchTrackRecords(apiKey, currentTrackId, currentRaceClass)
                    : Promise.resolve(null);

                const [histResult, personalRecordsResult, recordResult] = await Promise.allSettled([
                    historicalPromise,
                    personalRecordsPromise,
                    trackRecordsPromise
                ]);

                if (personalRecordsResult.status === 'fulfilled') {
                    userRacingRecords = personalRecordsResult.value;
                } else {
                    errorMessages.push(`Could not fetch personal racing records: ${personalRecordsResult.reason?.message || 'Unknown error.'}`);
                }

                if (histResult.status === 'fulfilled') {
                    processedData = StatsCalculator.processRaceData(histResult.value, State.userId);
                    raceEntries = histResult.value
                        .map(race => this.normalizeHistoryRaceEntry(race, State.userId))
                        .filter(Boolean);
                    historicalStatsContent = this.buildHistoricalStatsHTML(processedData, raceEntries, userRacingRecords);
                } else {
                    errorMessages.push(`Could not fetch historical races: ${histResult.reason?.message || 'Unknown error.'}`);
                    historicalStatsContent = this.buildHistoricalStatsHTML(null, [], userRacingRecords);
                }

                if (recordResult.status === 'fulfilled' && recordResult.value !== null) {
                    trackRecords = recordResult.value;
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
                if (State.advancedStatsPanelInstance !== popup || !document.body.contains(popup)) {
                    return;
                }
                statsContentDiv.replaceChildren(finalFragment);
            }
        },
        buildHistoricalStatsHTML(processedData, raceEntries = [], userRacingRecords = []) {
            const fragment = document.createDocumentFragment();
            fragment.appendChild(Utils.createElement('h3', { text: 'Performance Snapshot' }));

            if (!processedData || processedData.totalRaces === 0) {
                fragment.appendChild(this.createPanelMessage('info-msg', 'No recent official race data found to analyze.'));
            } else {
                const overall = processedData.overall;
                const trackStats = Object.values(processedData.trackStats);
                const carStats = Object.values(processedData.carStats);
                const bestLap = raceEntries
                    .map(entry => entry.bestLap)
                    .filter(value => Number.isFinite(value))
                    .sort((left, right) => left - right)[0];

                const analyzedParagraph = document.createElement('p');
                analyzedParagraph.append('Analyzed ');
                analyzedParagraph.appendChild(Utils.createElement('strong', { text: String(overall.races) }));
                analyzedParagraph.append(` official races from ${Utils.formatDate(processedData.firstRaceTime)} to ${Utils.formatDate(processedData.lastRaceTime)}.`);
                fragment.appendChild(analyzedParagraph);

                fragment.appendChild(this.createStatsCards([
                    { label: 'Races', value: String(overall.races) },
                    { label: 'Wins / Podiums', value: `${overall.wins} / ${overall.podiums}` },
                    { label: 'Avg Position', value: overall.avgPosition.toFixed(2) },
                    { label: 'Win Rate', value: `${overall.winRate.toFixed(1)}%` },
                    { label: 'Crash Rate', value: `${overall.crashRate.toFixed(1)}%` },
                    { label: 'Best Lap', value: Number.isFinite(bestLap) ? Utils.formatTime(bestLap, true) : 'N/A' }
                ]));

                const recentWindow = raceEntries.slice(0, 20);
                const previousWindow = raceEntries.slice(20, 40);
                const recentAgg = this.aggregateRaceWindow(recentWindow);
                const previousAgg = this.aggregateRaceWindow(previousWindow);
                const hasPrevious = previousWindow.length > 0;
                const avgPosDelta = hasPrevious && Number.isFinite(recentAgg.avgPosition) && Number.isFinite(previousAgg.avgPosition)
                    ? recentAgg.avgPosition - previousAgg.avgPosition
                    : null;
                const winRateDelta = hasPrevious && Number.isFinite(recentAgg.winRate) && Number.isFinite(previousAgg.winRate)
                    ? recentAgg.winRate - previousAgg.winRate
                    : null;
                const crashRateDelta = hasPrevious && Number.isFinite(recentAgg.crashRate) && Number.isFinite(previousAgg.crashRate)
                    ? recentAgg.crashRate - previousAgg.crashRate
                    : null;
                const lapDelta = hasPrevious && Number.isFinite(recentAgg.avgBestLap) && Number.isFinite(previousAgg.avgBestLap)
                    ? recentAgg.avgBestLap - previousAgg.avgBestLap
                    : null;
                const skillDelta = hasPrevious
                    ? recentAgg.skillGainTotal - previousAgg.skillGainTotal
                    : null;

                fragment.appendChild(this.createStatsCards([
                    { label: 'Window', value: `Last ${recentWindow.length} vs Prev ${previousWindow.length}` },
                    {
                        label: 'Avg Pos Δ',
                        value: this.formatSignedNumber(avgPosDelta, 2),
                        trendClass: avgPosDelta < 0 ? 'positive' : (avgPosDelta > 0 ? 'negative' : '')
                    },
                    {
                        label: 'Win Rate Δ',
                        value: Number.isFinite(winRateDelta) ? `${this.formatSignedNumber(winRateDelta, 1)} pp` : 'N/A',
                        trendClass: winRateDelta > 0 ? 'positive' : (winRateDelta < 0 ? 'negative' : '')
                    },
                    {
                        label: 'Crash Rate Δ',
                        value: Number.isFinite(crashRateDelta) ? `${this.formatSignedNumber(crashRateDelta, 1)} pp` : 'N/A',
                        trendClass: crashRateDelta < 0 ? 'positive' : (crashRateDelta > 0 ? 'negative' : '')
                    },
                    {
                        label: 'Avg Lap Δ',
                        value: Number.isFinite(lapDelta) ? `${this.formatSignedNumber(lapDelta, 3)}s` : 'N/A',
                        trendClass: lapDelta < 0 ? 'positive' : (lapDelta > 0 ? 'negative' : '')
                    },
                    {
                        label: 'Skill Gain Δ',
                        value: this.formatSignedNumber(skillDelta, 4),
                        trendClass: skillDelta > 0 ? 'positive' : (skillDelta < 0 ? 'negative' : '')
                    }
                ], 'stats-delta-cards'));

                fragment.appendChild(this.createSortableStatsTableSection({
                    title: 'Track Breakdown',
                    columns: [
                        { key: 'name', label: 'Track' },
                        { key: 'races', label: 'Races', className: 'numeric', defaultDir: 'desc' },
                        { key: 'avgPosition', label: 'Avg Pos', className: 'numeric', defaultDir: 'asc', render: row => row.avgPosition.toFixed(2) },
                        { key: 'winRate', label: 'Win %', className: 'numeric', defaultDir: 'desc', render: row => row.winRate.toFixed(1) },
                        { key: 'podiumRate', label: 'Podium %', className: 'numeric', defaultDir: 'desc', render: row => row.podiumRate.toFixed(1) },
                        { key: 'crashRate', label: 'Crash %', className: 'numeric', defaultDir: 'asc', render: row => row.crashRate.toFixed(1) },
                        {
                            key: 'bestLap',
                            label: 'Best Lap',
                            className: 'numeric',
                            defaultDir: 'asc',
                            sortValue: row => Number.isFinite(row.bestLap) ? row.bestLap : null,
                            render: row => Number.isFinite(row.bestLap) ? Utils.formatTime(row.bestLap, true) : '-'
                        }
                    ],
                    rows: trackStats,
                    defaultSortKey: 'races',
                    defaultSortDir: 'desc',
                    emptyMessage: 'No track-specific data.'
                }));

                fragment.appendChild(this.createSortableStatsTableSection({
                    title: 'Car Breakdown',
                    columns: [
                        { key: 'name', label: 'Car' },
                        { key: 'races', label: 'Races', className: 'numeric', defaultDir: 'desc' },
                        { key: 'avgPosition', label: 'Avg Pos', className: 'numeric', defaultDir: 'asc', render: row => row.avgPosition.toFixed(2) },
                        { key: 'winRate', label: 'Win %', className: 'numeric', defaultDir: 'desc', render: row => row.winRate.toFixed(1) },
                        { key: 'podiumRate', label: 'Podium %', className: 'numeric', defaultDir: 'desc', render: row => row.podiumRate.toFixed(1) },
                        { key: 'crashRate', label: 'Crash %', className: 'numeric', defaultDir: 'asc', render: row => row.crashRate.toFixed(1) }
                    ],
                    rows: carStats,
                    defaultSortKey: 'races',
                    defaultSortDir: 'desc',
                    emptyMessage: 'No car-specific data.'
                }));

                fragment.appendChild(this.createSortableStatsTableSection({
                    title: `Recent Official Races (${raceEntries.length})`,
                    columns: [
                        { key: 'timestamp', label: 'Date', defaultDir: 'desc', render: row => Utils.formatDate(row.timestamp, true) },
                        { key: 'trackName', label: 'Track' },
                        {
                            key: 'position',
                            label: 'Pos',
                            className: 'numeric',
                            defaultDir: 'asc',
                            sortValue: row => row.crashed ? Number.POSITIVE_INFINITY : (Number.isFinite(row.position) ? row.position : Number.POSITIVE_INFINITY),
                            render: row => row.crashed ? 'CR' : (Number.isFinite(row.position) ? String(row.position) : '-')
                        },
                        {
                            key: 'skillGain',
                            label: 'Skill Δ',
                            className: 'numeric',
                            defaultDir: 'desc',
                            sortValue: row => Number.isFinite(row.skillGain) ? row.skillGain : null,
                            render: row => this.formatSignedNumber(row.skillGain, 4)
                        },
                        {
                            key: 'bestLap',
                            label: 'Best Lap',
                            className: 'numeric',
                            defaultDir: 'asc',
                            sortValue: row => Number.isFinite(row.bestLap) ? row.bestLap : null,
                            render: row => Number.isFinite(row.bestLap) ? Utils.formatTime(row.bestLap, true) : '-'
                        },
                        {
                            key: 'raceTime',
                            label: 'Race Time',
                            className: 'numeric',
                            defaultDir: 'asc',
                            sortValue: row => Number.isFinite(row.raceTime) ? row.raceTime : null,
                            render: row => Number.isFinite(row.raceTime) ? Utils.formatTime(row.raceTime, true) : '-'
                        },
                        { key: 'carName', label: 'Car' },
                        { key: 'carClass', label: 'Class', render: row => row.carClass || '-' }
                    ],
                    rows: raceEntries,
                    defaultSortKey: 'timestamp',
                    defaultSortDir: 'desc',
                    emptyMessage: 'No recent races available.'
                }));
            }

            const records = Array.isArray(userRacingRecords) ? userRacingRecords : [];
            if (records.length === 0) {
                fragment.appendChild(this.createPanelMessage('info-msg', 'No personal racing records returned by the API.'));
                return fragment;
            }

            const trackRecordRows = records.map(record => {
                const laps = (record.records || []).map(entry => Number(entry?.lap_time)).filter(value => Number.isFinite(value));
                if (laps.length === 0) return null;
                const bestLapCs = Math.min(...laps);
                const worstLapCs = Math.max(...laps);
                const bestRecord = (record.records || []).find(entry => Number(entry?.lap_time) === bestLapCs) || {};
                return {
                    trackName: record.track?.name || `Track ${record.track?.id ?? '?'}`,
                    bestLapCs,
                    bestCar: bestRecord.car_name || 'Unknown Car',
                    entries: laps.length,
                    spreadCs: worstLapCs - bestLapCs
                };
            }).filter(Boolean);

            fragment.appendChild(this.createSortableStatsTableSection({
                title: 'Personal Record Tracks',
                columns: [
                    { key: 'trackName', label: 'Track' },
                    { key: 'bestLapCs', label: 'Best Lap', className: 'numeric', defaultDir: 'asc', render: row => this.formatCentisecondsAsLapTime(row.bestLapCs) },
                    { key: 'bestCar', label: 'Best Car' },
                    { key: 'entries', label: 'Record Entries', className: 'numeric', defaultDir: 'desc' },
                    { key: 'spreadCs', label: 'Spread', className: 'numeric', defaultDir: 'asc', render: row => this.formatCentisecondsAsLapTime(row.spreadCs) }
                ],
                rows: trackRecordRows,
                defaultSortKey: 'bestLapCs',
                defaultSortDir: 'asc',
                emptyMessage: 'No personal track records available.'
            }));

            const carMap = {};
            records.forEach(record => {
                (record.records || []).forEach(entry => {
                    const carName = entry?.car_name || 'Unknown Car';
                    const lapTime = Number(entry?.lap_time);
                    if (!carMap[carName]) {
                        carMap[carName] = { carName, entries: 0, bestLapCs: Number.POSITIVE_INFINITY, totalLapCs: 0, lapCount: 0 };
                    }
                    carMap[carName].entries++;
                    if (Number.isFinite(lapTime)) {
                        carMap[carName].bestLapCs = Math.min(carMap[carName].bestLapCs, lapTime);
                        carMap[carName].totalLapCs += lapTime;
                        carMap[carName].lapCount++;
                    }
                });
            });
            const carRecordRows = Object.values(carMap).map(row => ({
                ...row,
                avgLapCs: row.lapCount > 0 ? row.totalLapCs / row.lapCount : null
            }));

            fragment.appendChild(this.createSortableStatsTableSection({
                title: 'Cars In Personal Records',
                columns: [
                    { key: 'carName', label: 'Car' },
                    { key: 'entries', label: 'Entries', className: 'numeric', defaultDir: 'desc' },
                    {
                        key: 'bestLapCs',
                        label: 'Best Lap',
                        className: 'numeric',
                        defaultDir: 'asc',
                        sortValue: row => Number.isFinite(row.bestLapCs) ? row.bestLapCs : null,
                        render: row => Number.isFinite(row.bestLapCs) ? this.formatCentisecondsAsLapTime(row.bestLapCs) : '-'
                    },
                    {
                        key: 'avgLapCs',
                        label: 'Avg Lap',
                        className: 'numeric',
                        defaultDir: 'asc',
                        sortValue: row => Number.isFinite(row.avgLapCs) ? row.avgLapCs : null,
                        render: row => Number.isFinite(row.avgLapCs) ? this.formatCentisecondsAsLapTime(row.avgLapCs) : '-'
                    }
                ],
                rows: carRecordRows,
                defaultSortKey: 'entries',
                defaultSortDir: 'desc',
                emptyMessage: 'No car record data available.'
            }));

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
        formatSignedNumber(value, decimals = 2) {
            if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return 'N/A';
            const sign = value > 0 ? '+' : '';
            return `${sign}${value.toFixed(decimals)}`;
        },
        normalizeHistoryRaceEntry(race, userId) {
            if (!race || !Array.isArray(race.results)) return null;
            const userResult = race.results.find(result => String(result.driver_id) === String(userId));
            if (!userResult) return null;

            const endTimestampSec = userResult.time_ended ?? race.schedule?.end ?? race.schedule?.start ?? null;
            const endTimestampMs = Number.isFinite(endTimestampSec) ? endTimestampSec * 1000 : Date.now();
            const position = Number.isFinite(userResult.position) ? userResult.position : null;
            const crashed = userResult.has_crashed === true;
            const raceTime = Number.isFinite(userResult.race_time) ? userResult.race_time : null;
            const bestLap = Number.isFinite(userResult.best_lap_time) ? userResult.best_lap_time : null;
            const participants = race.participants?.current ?? race.results.length ?? null;
            const skillGain = Number.isFinite(race.skill_gain) ? race.skill_gain : null;
            const trackName = State.trackNameMap?.[race.track_id] || `Track ${race.track_id ?? '?'}`;

            let resultLabel = 'Unknown';
            if (crashed) resultLabel = 'Crashed';
            else if (position !== null) resultLabel = `#${position}`;
            else if (race.status) resultLabel = race.status;

            return {
                raceId: race.id ?? null,
                trackId: race.track_id ?? null,
                trackName,
                title: race.title || '',
                status: race.status || '',
                timestamp: endTimestampMs,
                position,
                crashed,
                resultLabel,
                participants,
                skillGain,
                bestLap,
                raceTime,
                carName: userResult.car_item_name || 'Unknown Car',
                carClass: userResult.car_class || null
            };
        },
        createHistoryDeltaCards(raceEntries) {
            const cardsWrapper = Utils.createElement('div', { className: 'history-summary-cards' });
            const finishedEntries = raceEntries.filter(entry => !entry.crashed && Number.isFinite(entry.position));
            const wins = finishedEntries.filter(entry => entry.position === 1).length;
            const podiums = finishedEntries.filter(entry => entry.position <= 3).length;
            const crashCount = raceEntries.filter(entry => entry.crashed).length;
            const avgPosition = finishedEntries.length
                ? (finishedEntries.reduce((sum, entry) => sum + entry.position, 0) / finishedEntries.length)
                : null;
            const recentWindow = raceEntries.slice(0, 20);
            const previousWindow = raceEntries.slice(20, 40);
            const recentAgg = this.aggregateRaceWindow(recentWindow);
            const previousAgg = this.aggregateRaceWindow(previousWindow);
            const hasPrevious = previousWindow.length > 0;
            const avgPosDelta = hasPrevious && Number.isFinite(recentAgg.avgPosition) && Number.isFinite(previousAgg.avgPosition)
                ? recentAgg.avgPosition - previousAgg.avgPosition
                : null;
            const skillGainDelta = hasPrevious
                ? recentAgg.skillGainTotal - previousAgg.skillGainTotal
                : null;

            const summaryItems = [
                {
                    label: 'Window',
                    value: `Last ${recentWindow.length} vs Prev ${previousWindow.length}`,
                    trendClass: ''
                },
                {
                    label: 'Recent Races',
                    value: String(raceEntries.length),
                    trendClass: ''
                },
                {
                    label: 'Wins / Podiums',
                    value: `${wins} / ${podiums}`,
                    trendClass: ''
                },
                {
                    label: 'Avg Pos / Crashes',
                    value: `${avgPosition !== null ? avgPosition.toFixed(2) : 'N/A'} / ${crashCount}`,
                    trendClass: ''
                },
                {
                    label: 'Avg Pos \u0394',
                    value: this.formatSignedNumber(avgPosDelta, 2),
                    trendClass: avgPosDelta < 0 ? 'positive' : (avgPosDelta > 0 ? 'negative' : '')
                },
                {
                    label: 'Skill Gain \u0394',
                    value: this.formatSignedNumber(skillGainDelta, 4),
                    trendClass: skillGainDelta > 0 ? 'positive' : (skillGainDelta < 0 ? 'negative' : '')
                }
            ];

            summaryItems.forEach(item => {
                const card = Utils.createElement('div', { className: 'history-summary-card' });
                const label = Utils.createElement('div', { className: 'history-summary-label', text: item.label });
                const value = Utils.createElement('div', {
                    className: `history-summary-value${item.trendClass ? ` ${item.trendClass}` : ''}`,
                    text: item.value
                });
                card.append(label, value);
                cardsWrapper.appendChild(card);
            });

            return cardsWrapper;
        },
        createHistoryRaceTimeline(raceEntries) {
            const section = document.createDocumentFragment();
            section.appendChild(Utils.createElement('h3', { text: 'Race Timeline' }));

            if (raceEntries.length === 0) {
                section.appendChild(this.createPanelMessage('no-history-msg', 'No race events loaded yet.'));
                return section;
            }

            const timeline = Utils.createElement('ul', { className: 'history-race-timeline' });
            raceEntries.slice(0, 15).forEach(entry => {
                const liClass = `history-race-item ${entry.crashed ? 'crash' : (entry.position === 1 ? 'win' : 'normal')}`;
                const item = Utils.createElement('li', { className: liClass });
                const mainLine = Utils.createElement('div', { className: 'history-race-main' });
                mainLine.append(
                    Utils.createElement('span', { className: 'history-race-track', text: entry.trackName }),
                    Utils.createElement('span', { className: 'history-race-result', text: entry.resultLabel }),
                    Utils.createElement('span', {
                        className: `history-race-skill ${entry.skillGain > 0 ? 'positive' : (entry.skillGain < 0 ? 'negative' : '')}`,
                        text: `Skill ${this.formatSignedNumber(entry.skillGain, 4)}`
                    })
                );
                const detailLine = Utils.createElement('div', {
                    className: 'history-race-meta',
                    text: `${Utils.formatDate(entry.timestamp, true)} • ${entry.carName} • Time ${entry.raceTime !== null ? Utils.formatTime(entry.raceTime, true) : 'N/A'}`
                });
                item.append(mainLine, detailLine);
                timeline.appendChild(item);
            });

            section.appendChild(timeline);
            return section;
        },
        createSortableHistoryRacesTable(raceEntries) {
            const section = document.createDocumentFragment();
            section.appendChild(Utils.createElement('h3', { text: `Recent Races (${raceEntries.length})` }));

            if (raceEntries.length === 0) {
                section.appendChild(this.createPanelMessage('no-history-msg', 'No races available for table view.'));
                return section;
            }

            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const tbody = document.createElement('tbody');

            const sortState = { key: 'timestamp', dir: 'desc' };
            const columns = [
                { key: 'timestamp', label: 'Date', className: '' },
                { key: 'trackName', label: 'Track', className: '' },
                { key: 'position', label: 'Pos', className: 'numeric' },
                { key: 'skillGain', label: 'Skill \u0394', className: 'numeric' },
                { key: 'bestLap', label: 'Best Lap', className: 'numeric' },
                { key: 'raceTime', label: 'Race Time', className: 'numeric' },
                { key: 'carName', label: 'Car', className: '' }
            ];

            const getSortValue = (entry, key) => {
                if (key === 'position') return entry.position ?? Number.POSITIVE_INFINITY;
                if (key === 'timestamp') return entry.timestamp ?? 0;
                if (key === 'skillGain') return entry.skillGain ?? Number.NEGATIVE_INFINITY;
                if (key === 'bestLap') return entry.bestLap ?? Number.POSITIVE_INFINITY;
                if (key === 'raceTime') return entry.raceTime ?? Number.POSITIVE_INFINITY;
                return entry[key] ?? '';
            };
            const compare = (left, right) => {
                const leftValue = getSortValue(left, sortState.key);
                const rightValue = getSortValue(right, sortState.key);
                let result = 0;
                if (typeof leftValue === 'number' && typeof rightValue === 'number') result = leftValue - rightValue;
                else result = String(leftValue).localeCompare(String(rightValue));
                return sortState.dir === 'asc' ? result : -result;
            };
            const formatPosition = (entry) => {
                if (entry.crashed) return 'CR';
                if (Number.isFinite(entry.position)) return String(entry.position);
                return '-';
            };

            const renderRows = () => {
                const sorted = [...raceEntries].sort(compare);
                const rowNodes = sorted.map(entry => {
                    const row = document.createElement('tr');
                    const skillClass = entry.skillGain > 0 ? 'change-positive' : (entry.skillGain < 0 ? 'change-negative' : '');

                    row.append(
                        Utils.createElement('td', { text: Utils.formatDate(entry.timestamp, true) }),
                        Utils.createElement('td', { text: entry.trackName }),
                        Utils.createElement('td', { className: 'numeric', text: formatPosition(entry) }),
                        Utils.createElement('td', { className: `numeric ${skillClass}`.trim(), text: this.formatSignedNumber(entry.skillGain, 4) }),
                        Utils.createElement('td', { className: 'numeric', text: entry.bestLap !== null ? Utils.formatTime(entry.bestLap, true) : '-' }),
                        Utils.createElement('td', { className: 'numeric', text: entry.raceTime !== null ? Utils.formatTime(entry.raceTime, true) : '-' }),
                        Utils.createElement('td', { text: entry.carName })
                    );
                    return row;
                });
                tbody.replaceChildren(...rowNodes);
            };

            columns.forEach(column => {
                const th = Utils.createElement('th', { className: column.className });
                const button = Utils.createElement('button', {
                    className: 'history-sort-btn',
                    text: column.label,
                    attrs: { type: 'button' }
                });
                button.addEventListener('click', () => {
                    if (sortState.key === column.key) {
                        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortState.key = column.key;
                        sortState.dir = column.key === 'timestamp' ? 'desc' : 'asc';
                    }
                    renderRows();
                });
                th.appendChild(button);
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.append(thead, tbody);

            renderRows();
            section.appendChild(table);
            return section;
        },
        async createHistoryPanel() {
            if (!Config.get('historyEnabled')) return;
            if (State.historyPanelInstance) State.historyPanelInstance.remove();

            const popup = document.createElement('div');
            popup.className = 'history-panel';
            const content = document.createElement('div');
            content.className = 'history-panel-content';
            const historyContentDiv = document.createElement('div');
            historyContentDiv.className = 'history-content';
            historyContentDiv.replaceChildren(this.createPanelMessage('loading-msg', 'Loading history panel...', 'div'));

            const historyTitle = Utils.createElement('div', { className: 'history-title' });
            historyTitle.append('Your Racing Stats History ');
            historyTitle.appendChild(Utils.createElement('button', { className: 'history-close', text: '\u00D7' }));
            content.append(historyTitle, historyContentDiv);

            const closePanel = () => {
                popup.remove();
                State.historyPanelInstance = null;
            };
            content.querySelector('.history-close').addEventListener('click', closePanel);
            popup.addEventListener('click', e => { if (e.target === popup) closePanel(); });

            popup.appendChild(content);
            document.body.appendChild(popup);
            State.historyPanelInstance = popup;

            const historyFragment = document.createDocumentFragment();
            let raceEntries = [];

            if (Utils.isApiKeyAvailable() && State.userId) {
                const apiKey = Config.get('apiKey');
                try {
                    if (!State.trackNameMap) {
                        State.trackNameMap = await APIManager.fetchTrackData(apiKey);
                    }
                } catch (e) {
                    historyFragment.appendChild(this.createPanelMessage('info-msg', `Track names unavailable: ${e.message}`));
                }

                try {
                    const raceLimit = Math.max(20, Math.min(500, Number(Config.get('historicalRaceLimit')) || 100));
                    const races = await APIManager.fetchHistoricalRaceData(apiKey, State.userId, raceLimit);
                    raceEntries = races
                        .map(race => this.normalizeHistoryRaceEntry(race, State.userId))
                        .filter(Boolean);
                } catch (e) {
                    historyFragment.appendChild(this.createPanelMessage('error-msg', `Could not load race history: ${e.message}`));
                }
            } else {
                historyFragment.appendChild(this.createPanelMessage('info-msg', 'Configure an API key to load race timeline and recent-races table.'));
            }

            historyFragment.appendChild(this.createHistoryDeltaCards(raceEntries));
            historyFragment.appendChild(this.createHistoryRaceTimeline(raceEntries));
            historyFragment.appendChild(this.createSortableHistoryRacesTable(raceEntries));

            if (State.historyPanelInstance !== popup || !document.body.contains(popup)) {
                return;
            }
            historyContentDiv.replaceChildren(historyFragment);
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
