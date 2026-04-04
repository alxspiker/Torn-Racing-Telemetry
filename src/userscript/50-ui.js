    const UI = {
        createSettingsPopup() {
            if (State.settingsPopupInstance) State.settingsPopupInstance.remove();
            const popup = document.createElement('div');
            popup.className = 'settings-popup';
            const content = document.createElement('div');
            content.className = 'settings-popup-content';

            const displayOptions = Config.get('telemetryDisplayOptions');

            content.innerHTML = `
                <div class="settings-title">Telemetry & UI Settings <button class="settings-close">×</button></div>
                <div class="settings-content">
                    <div class="settings-item"> <div class="toggle-container"> <label for="historyEnabled">Enable History Panel & Logging</label> <label class="switch"> <input type="checkbox" id="historyEnabled"> <span class="slider"></span> </label> </div> </div>
                    <div class="settings-item"> <div class="toggle-container"> <label for="statsPanelEnabled">Enable Stats Panel</label> <label class="switch"> <input type="checkbox" id="statsPanelEnabled"> <span class="slider"></span> </label> </div> </div>
                    <hr style="border: none; border-top: 1px solid var(--border-color); margin: 20px 0;">
                    <div class="settings-item">
                         <label>Telemetry Display Options:</label>
                         <div class="telemetry-options-group">
                            <div class="toggle-container"> <label for="telemetryShowSpeed">Show Speed</label> <label class="switch"> <input type="checkbox" id="telemetryShowSpeed"> <span class="slider"></span> </label> </div>
                            <div class="toggle-container"> <label for="telemetryShowAcceleration">Show Acceleration</label> <label class="switch"> <input type="checkbox" id="telemetryShowAcceleration"> <span class="slider"></span> </label> </div>
                            <div class="toggle-container"> <label for="telemetryShowProgress">Show Progress %</label> <label class="switch"> <input type="checkbox" id="telemetryShowProgress"> <span class="slider"></span> </label> </div>
                         </div>
                    </div>
                    <div class="settings-item"> <label for="speedUnit">Speed Unit</label> <select id="speedUnit"> <option value="mph">mph</option> <option value="kmh">km/h</option> </select> </div>
                    <div class="settings-item"> <div class="toggle-container"> <label for="colorCode">Color Code Telemetry (by Accel)</label> <label class="switch"> <input type="checkbox" id="colorCode"> <span class="slider"></span> </label> </div> </div>
                    <div class="settings-item"> <div class="toggle-container"> <label for="animateChanges">Animate Changes (Simple Cases)</label> <label class="switch"> <input type="checkbox" id="animateChanges"> <span class="slider"></span> </label> </div> <small style="color: #aaa; margin-top: 5px;">Animation only applies if just Speed, just Accel, or only Speed & Accel are shown. Uses capped duration.</small></div>
                    <div class="settings-item"> <label for="speedSmoothingFactor">Speed Smoothing Factor (0.1-0.9)</label> <input type="number" id="speedSmoothingFactor" min="0.1" max="0.9" step="0.1"> <small style="color: #aaa; margin-top: 5px;">Weight of *previous* speed vs. new calculation (higher = smoother). Default: ${Config.defaults.speedSmoothingFactor}</small></div>
                    <div class="settings-item"> <label for="maxAnimationDurationMs">Max Animation Duration (ms)</label> <input type="number" id="maxAnimationDurationMs" min="100" max="3000" step="100"> <small style="color: #aaa; margin-top: 5px;">Caps animation time for large update gaps. Default: ${Config.defaults.maxAnimationDurationMs}</small></div>
                    <div class="settings-item"> <div class="toggle-container"> <label for="showLapEstimate">Show Est. Lap Time</label> <label class="switch"> <input type="checkbox" id="showLapEstimate"> <span class="slider"></span> </label> </div> </div>
                    <div class="settings-item"> <label for="lapEstimateSmoothingFactor">Lap Est. Smoothing (0.01-1.0)</label> <input type="number" id="lapEstimateSmoothingFactor" min="0.01" max="1.0" step="0.01"> </div>
                    <hr style="border: none; border-top: 1px solid var(--border-color); margin: 20px 0;">
                    <div class="settings-item"> <div class="toggle-container"> <label for="fetchApiStatsOnClick">Load Driver API Stats on Click</label> <label class="switch"> <input type="checkbox" id="fetchApiStatsOnClick"> <span class="slider"></span> </label> </div> <small style="color: #aaa; margin-top: 5px;">(Requires API key)</small> </div>
                    <div class="api-tos-container">
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
                        </details>
                    </div>
                    <div class="settings-item"> <label for="apiKey">Torn API Key (Limited Access Recommended)</label> <input type="password" id="apiKey" placeholder="Enter API Key or use '###PDA-APIKEY###' in Torn PDA"> </div>
                    <div class="settings-item"> <label for="historicalRaceLimit">Advanced Stats: Races to Analyze</label> <input type="number" id="historicalRaceLimit" min="10" max="1000" step="10"> </div>
                    <hr style="border: none; border-top: 1px solid var(--border-color); margin: 20px 0;">
                    <div class="settings-item"> <label for="historyCheckInterval">History: Check Interval (ms)</label> <input type="number" id="historyCheckInterval" min="5000" max="60000" step="1000"> </div>
                    <div class="settings-item"> <label for="historyLogLimit">History: Max Log Entries</label> <input type="number" id="historyLogLimit" min="5" max="50" step="1"> </div>
                    <hr style="border: none; border-top: 1px solid var(--border-color); margin: 20px 0;">
                    <div class="settings-item"> <div class="toggle-container"> <label for="hideOriginalList">Hide Torn's Leaderboard</label> <label class="switch"> <input type="checkbox" id="hideOriginalList"> <span class="slider"></span> </label> </div> </div>
                    <div class="settings-buttons">
                         <button class="settings-btn toggle-telemetry-btn">Toggle Telemetry</button>
                         <button class="settings-btn primary" id="saveSettings">Save & Close</button>
                    </div>
                    <div class="settings-data-buttons">
                         <button class="settings-btn danger" id="clearData">Clear Script Data</button>
                         <button class="settings-btn danger" id="clearApiKey">Clear API Key</button>
                    </div>
                </div>`;

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


            const closePopup = () => { popup.remove(); State.settingsPopupInstance = null; };
            content.querySelector('.settings-close').addEventListener('click', closePopup);
            popup.addEventListener('click', (e) => { if (e.target === popup) closePopup(); });
            content.querySelector('.toggle-telemetry-btn').addEventListener('click', (e) => { const newState = !Config.get('telemetryVisible'); Config.set('telemetryVisible', newState); document.body.classList.toggle('telemetry-hidden', !newState); e.target.textContent = newState ? 'Hide Telemetry' : 'Show Telemetry'; Utils.showNotification(`Telemetry display ${newState ? 'shown' : 'hidden'}.`); });
            content.querySelector('#hideOriginalList').addEventListener('change', (e) => { const hide = e.target.checked; Config.set('hideOriginalList', hide); document.body.classList.toggle('hide-original-leaderboard', hide); if (!hide) { RaceManager.stableUpdateCustomList(); }});

            content.querySelector('#saveSettings').addEventListener('click', () => {
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
                if (isNaN(speedSmooth) || speedSmooth < 0.1 || speedSmooth > 0.9) { speedSmooth = Config.defaults.speedSmoothingFactor; content.querySelector('#speedSmoothingFactor').value = speedSmooth; Utils.showNotification('Invalid Speed Smoothing Factor, reset to default.', 'error'); }
                Config.set('speedSmoothingFactor', speedSmooth);
                let animDuration = parseInt(content.querySelector('#maxAnimationDurationMs').value, 10);
                if (isNaN(animDuration) || animDuration < 100 || animDuration > 3000) { animDuration = Config.defaults.maxAnimationDurationMs; content.querySelector('#maxAnimationDurationMs').value = animDuration; Utils.showNotification('Invalid Max Animation Duration, reset to default.', 'error'); }
                Config.set('maxAnimationDurationMs', animDuration);
                Config.set('showLapEstimate', content.querySelector('#showLapEstimate').checked);
                Config.set('fetchApiStatsOnClick', content.querySelector('#fetchApiStatsOnClick').checked);
                const apiKeyInputFromUser = content.querySelector('#apiKey').value.trim();
                if (apiKeyInputFromUser.length > 0 && apiKeyInputFromUser.length < 16 && apiKeyInputFromUser !== '###PDA-APIKEY###') { Utils.showNotification('API Key seems too short.', 'error'); } else { Config.set('apiKey', apiKeyInputFromUser); }
                let lapSmoothFactor = parseFloat(content.querySelector('#lapEstimateSmoothingFactor').value);
                if (isNaN(lapSmoothFactor) || lapSmoothFactor < 0.01 || lapSmoothFactor > 1.0) { lapSmoothFactor = Config.defaults.lapEstimateSmoothingFactor; content.querySelector('#lapEstimateSmoothingFactor').value = lapSmoothFactor; Utils.showNotification('Invalid Lap Est. Smoothing Factor, reset to default.', 'error'); }
                Config.set('lapEstimateSmoothingFactor', lapSmoothFactor);
                let raceLimit = parseInt(content.querySelector('#historicalRaceLimit').value, 10);
                if (isNaN(raceLimit) || raceLimit < 10 || raceLimit > 1000) { raceLimit = Config.defaults.historicalRaceLimit; content.querySelector('#historicalRaceLimit').value = raceLimit; Utils.showNotification('Invalid Race Limit, reset to default.', 'error'); }
                Config.set('historicalRaceLimit', raceLimit);
                let histInterval = parseInt(content.querySelector('#historyCheckInterval').value, 10);
                if (isNaN(histInterval) || histInterval < 5000 || histInterval > 60000) { histInterval = Config.defaults.historyCheckInterval; content.querySelector('#historyCheckInterval').value = histInterval; Utils.showNotification('Invalid History Interval, reset to default.', 'error'); }
                Config.set('historyCheckInterval', histInterval);
                let histLimit = parseInt(content.querySelector('#historyLogLimit').value, 10);
                if (isNaN(histLimit) || histLimit < 5 || histLimit > 50) { histLimit = Config.defaults.historyLogLimit; content.querySelector('#historyLogLimit').value = histLimit; Utils.showNotification('Invalid History Limit, reset to default.', 'error'); }
                Config.set('historyLogLimit', histLimit);
                Utils.showNotification('Settings saved!', 'success');
                closePopup();
                UI.updateControlButtonsVisibility();
                if (Config.get('historyEnabled')) {
                    HistoryManager.restartCheckInterval();
                } else if (historyWasEnabled) {
                    if(State.historyCheckIntervalId) clearInterval(State.historyCheckIntervalId);
                    State.historyCheckIntervalId = null;
                }
                RaceManager.stableUpdateCustomList();
            });

            content.querySelector('#clearData').addEventListener('click', () => {
                 if (confirm('Are you sure you want to clear all script settings (except API key) and history data? This cannot be undone.')) {
                     Config.clearData();
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
            statsContentDiv.innerHTML = `<div class="loading-msg">Loading advanced stats...</div>`;
            content.innerHTML = `<div class="stats-title">Advanced Race Statistics <button class="stats-close">×</button></div>`;
            content.appendChild(statsContentDiv);
            const closePanel = () => { popup.remove(); State.advancedStatsPanelInstance = null; State.destroyActiveCharts(); };
            content.querySelector('.stats-close').addEventListener('click', closePanel);
            popup.addEventListener('click', (e) => { if (e.target === popup) closePanel(); });
            popup.appendChild(content);
            document.body.appendChild(popup);
            State.advancedStatsPanelInstance = popup;

            let errorMessages = [];
            let historicalStatsHTML = '';
            let trackAnalysisHTML = '';
            let processedData = null;
            let trackRecords = null;
            let topCarsData = null;

            try {
                if (!Utils.isApiKeyAvailable()) throw new Error("API Key not configured in Settings.");
                const apiKey = Config.get('apiKey');
                if (!State.userId) throw new Error("User ID not found.");

                if (!State.trackNameMap) {
                    try { State.trackNameMap = await APIManager.fetchTrackData(apiKey); }
                    catch (e) { errorMessages.push(`Could not fetch track names: ${e.message}`); State.trackNameMap = {}; }
                }
                if (!State.carBaseStatsMap) {
                     try { State.carBaseStatsMap = await APIManager.fetchCarBaseStats(apiKey); }
                     catch (e) { errorMessages.push(`Could not fetch car base stats: ${e.message}`); State.carBaseStatsMap = {}; }
                 }

                await RaceManager.updateTrackAndClassInfo();
                const currentTrackId = State.trackInfo.id;
                const currentTrackName = State.trackInfo.name || `Track ${currentTrackId || 'Unknown'}`;
                const currentRaceClass = State.currentRaceClass;
                let currentUserCar = null;
                try { currentUserCar = this.parseCurrentUserCarStats(); } catch (e) {}

                let historicalRaces = null;
                const promises = [APIManager.fetchHistoricalRaceData(apiKey, State.userId, Config.get('historicalRaceLimit'))];
                if (currentTrackId && currentRaceClass) {
                    promises.push(APIManager.fetchTrackRecords(apiKey, currentTrackId, currentRaceClass));
                } else {
                    promises.push(Promise.resolve(null));
                    if (!currentTrackId) errorMessages.push("Could not identify the current track.");
                    if (!currentRaceClass) errorMessages.push("Could not identify the race class from page banner.");
                }

                const [histResult, recordResult] = await Promise.allSettled(promises);

                if (histResult.status === 'fulfilled') {
                    historicalRaces = histResult.value;
                    processedData = StatsCalculator.processRaceData(historicalRaces, State.userId);
                    historicalStatsHTML = this.buildHistoricalStatsHTML(processedData);
                } else {
                    errorMessages.push(`Could not fetch historical races: ${histResult.reason.message}`);
                    historicalStatsHTML = `<p class="info-msg">Historical race data could not be loaded.</p>`;
                }

                if (recordResult.status === 'fulfilled' && recordResult.value !== null) {
                    trackRecords = recordResult.value;
                    topCarsData = StatsCalculator.processTrackRecords(trackRecords);
                } else if (recordResult.status === 'rejected') {
                    if (!recordResult.reason.message?.includes('404')) {
                         errorMessages.push(`Could not fetch track records: ${recordResult.reason.message}`);
                    } else {
                        trackRecords = [];
                        topCarsData = [];
                    }
                }

                if (currentTrackId && currentRaceClass) {
                    trackAnalysisHTML = this.buildTrackAnalysisHTML(trackRecords, currentUserCar, currentTrackName, currentRaceClass, topCarsData);
                } else {
                    trackAnalysisHTML = `<p class="info-msg">Track analysis requires knowing the track and race class.</p>`;
                }

            } catch (error) {
                errorMessages.push(`An unexpected error occurred: ${error.message}`);
                if (!historicalStatsHTML) historicalStatsHTML = `<p class="error-msg">Failed to load historical data.</p>`;
                if (!trackAnalysisHTML) trackAnalysisHTML = `<p class="error-msg">Failed to load track analysis data.</p>`;
            } finally {
                let finalHTML = '';
                if (errorMessages.length > 0) {
                    finalHTML += `<div class="error-msg"><strong>Encountered issues:</strong><br>${errorMessages.join('<br>')}</div>`;
                }
                finalHTML += historicalStatsHTML;
                finalHTML += trackAnalysisHTML;
                statsContentDiv.innerHTML = finalHTML;

                if (typeof Chart !== 'undefined') {
                    this.renderStatsCharts(processedData, topCarsData);
                } else {
                     statsContentDiv.querySelectorAll('.stats-chart-container').forEach(el => el.innerHTML = '<p class="info-msg">Charting library not loaded.</p>');
                }
            }
        },
        buildHistoricalStatsHTML(processedData) {
            if (!processedData || processedData.totalRaces === 0) {
                return `<h3>Your Recent Performance</h3><p class="info-msg">No recent official race data found to analyze.</p>`;
            }
            const overall = processedData.overall;
            const trackStats = Object.values(processedData.trackStats).sort((a, b) => b.races - a.races);
            const carStats = Object.values(processedData.carStats).sort((a, b) => b.races - a.races);

            let html = `<h3>Your Recent Performance</h3>`;
            html += `<p>Analyzed <strong>${overall.races}</strong> official races from ${Utils.formatDate(processedData.firstRaceTime)} to ${Utils.formatDate(processedData.lastRaceTime)}.</p>`;
            html += `<p><span class="stat-label">Avg Position:</span> <span class="stat-value">${overall.avgPosition.toFixed(2)}</span> | <span class="stat-label">Win Rate:</span> <span class="stat-value">${overall.winRate.toFixed(1)}%</span> | <span class="stat-label">Podium Rate:</span> <span class="stat-value">${overall.podiumRate.toFixed(1)}%</span> | <span class="stat-label">Crash Rate:</span> <span class="stat-value">${overall.crashRate.toFixed(1)}%</span></p>`;

            html += `<h4>Performance by Track</h4>`;
            if (trackStats.length > 0) {
                 html += `<div class="stats-chart-container"><canvas id="trackPerformanceChart"></canvas></div>`;
                 html += `<table><thead><tr><th>Track</th><th class="numeric">Races</th><th class="numeric">Avg Pos</th><th class="numeric">Win %</th><th class="numeric">Podium %</th><th class="numeric">Crash %</th><th class="numeric">Best Lap</th></tr></thead><tbody>`;
                 trackStats.forEach(t => {
                     html += `<tr><td>${t.name}</td><td class="numeric">${t.races}</td><td class="numeric">${t.avgPosition.toFixed(2)}</td><td class="numeric">${t.winRate.toFixed(1)}</td><td class="numeric">${t.podiumRate.toFixed(1)}</td><td class="numeric">${t.crashRate.toFixed(1)}</td><td class="numeric">${t.bestLap === Infinity ? '-' : t.bestLap.toFixed(2)}s</td></tr>`;
                 });
                 html += `</tbody></table>`;
            } else { html += `<p>No track-specific data.</p>`; }

            html += `<h4>Performance by Car</h4>`;
            if (carStats.length > 0) {
                 html += `<div class="stats-chart-container"><canvas id="carPerformanceChart"></canvas></div>`;
                 html += `<table><thead><tr><th>Car</th><th class="numeric">Races</th><th class="numeric">Avg Pos</th><th class="numeric">Win %</th><th class="numeric">Podium %</th><th class="numeric">Crash %</th></tr></thead><tbody>`;
                 carStats.forEach(c => {
                     html += `<tr><td>${c.name}</td><td class="numeric">${c.races}</td><td class="numeric">${c.avgPosition.toFixed(2)}</td><td class="numeric">${c.winRate.toFixed(1)}</td><td class="numeric">${c.podiumRate.toFixed(1)}</td><td class="numeric">${c.crashRate.toFixed(1)}</td></tr>`;
                 });
                 html += `</tbody></table>`;
            } else { html += `<p>No car-specific data.</p>`; }

            return html;
        },
        buildTrackAnalysisHTML(trackRecords, currentUserCar, trackName, raceClass, topCarsData) {
            let html = `<h3>Track Analysis: ${trackName} (Class ${raceClass || 'Unknown'})</h3>`;
            html += `<h4>Your Current Car</h4>`;
            if (currentUserCar && currentUserCar.stats) {
                 html += `<p><strong>${currentUserCar.name}</strong> (ID: ${currentUserCar.id})</p><p class="car-stats-inline">`;
                 const statOrder = ["Top Speed", "Acceleration", "Handling", "Braking", "Dirt", "Tarmac", "Safety"];
                 html += statOrder.map(statName => { const value = currentUserCar.stats[statName]; return value !== undefined ? `<strong>${statName}:</strong> ${value}` : null; }).filter(s => s !== null).join(' | ');
                 html += `</p>`;
            } else if (currentUserCar) { html += `<p><strong>${currentUserCar.name}</strong> (ID: ${currentUserCar.id}) - <i>Stats could not be parsed.</i></p>`; }
            else { html += `<p class="info-msg">Could not identify your currently selected car.</p>`; }

            html += `<h4>Track Records (Top 5)</h4>`;
            if (trackRecords && trackRecords.length > 0) {
                 html += `<table><thead><tr><th class="numeric">#</th><th class="numeric">Lap Time</th><th>Car</th><th>Driver</th></tr></thead><tbody>`;
                 trackRecords.slice(0, 5).forEach((rec, index) => {
                     const isUserCar = currentUserCar && rec.car_item_id === currentUserCar.id;
                     html += `<tr ${isUserCar ? 'class="user-car-highlight"' : ''}><td class="numeric">${index + 1}</td><td class="numeric">${rec.lap_time.toFixed(2)}s</td><td>${rec.car_item_name} ${isUserCar ? '(Your Car)' : ''}</td><td><a href="/profiles.php?XID=${rec.driver_id}" target="_blank" rel="noopener noreferrer">${rec.driver_name} [${rec.driver_id}]</a></td></tr>`;
                 });
                 html += `</tbody></table>`;
                 html += `<h4>Top Performing Cars Analysis</h4>`;
                 if (topCarsData && topCarsData.length > 0) {
                    html += `<div class="stats-chart-container"><canvas id="topCarsChart"></canvas></div>`;
                    html += `<table><thead><tr><th>Car</th><th class="numeric">Times in Top ${trackRecords.length}</th><th>Key Stats</th></tr></thead><tbody>`;
                    topCarsData.slice(0, 5).forEach(carData => {
                        const baseStats = State.carBaseStatsMap?.[carData.car_item_id];
                        let statsString = '<i>Base stats unavailable</i>';
                        if (baseStats) { statsString = `<strong>Spd:</strong> ${baseStats.top_speed}, <strong>Acc:</strong> ${baseStats.acceleration}, <strong>Hnd:</strong> ${baseStats.handling}, <strong>Brk:</strong> ${baseStats.braking}, <strong>Drt:</strong> ${baseStats.dirt}`; }
                        const isUserCar = currentUserCar && carData.car_item_id === currentUserCar.id;
                        html += `<tr ${isUserCar ? 'class="user-car-highlight"' : ''}><td>${carData.car_item_name} ${isUserCar ? '(Your Car)' : ''}</td><td class="numeric">${carData.count}</td><td><span class="car-stats-inline">${statsString}</span></td></tr>`;
                    });
                    html += `</tbody></table>`;
                 } else { html += `<p>Could not analyze top performing cars.</p>`; }
            } else if (trackRecords) { html += `<p class="info-msg">No records found for this track/class.</p>`; }
            else { html += `<p class="error-msg">Track records could not be loaded.</p>`; }
            return html;
        },
        renderStatsCharts(processedData, topCarsData) {
            const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
            const gridColor = 'rgba(255, 255, 255, 0.1)';
            const chartOptionsBase = {
                 responsive: true, maintainAspectRatio: false,
                 plugins: { legend: { labels: { color: textColor } }, tooltip: { mode: 'index', intersect: false } }
             };
            const barColors = ['#64B5F6', '#81C784', '#FFB74D', '#E57373', '#BA68C8', '#FFF176', '#7986CB', '#4DD0E1', '#FF8A65', '#A1887F'];

            if (processedData?.trackStats && Object.keys(processedData.trackStats).length > 0) {
                 const ctxTrack = document.getElementById('trackPerformanceChart')?.getContext('2d');
                 if(ctxTrack) {
                    const trackStats = Object.values(processedData.trackStats).sort((a, b) => b.races - a.races).slice(0, 10);
                    Utils.createChart(ctxTrack, {
                        type: 'bar',
                        data: {
                            labels: trackStats.map(t => t.name.length > 15 ? t.name.substring(0, 12) + '...' : t.name),
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
                  if(ctxCar) {
                    const carStats = Object.values(processedData.carStats).sort((a, b) => b.races - a.races).slice(0, 10);
                    Utils.createChart(ctxCar, {
                        type: 'bar',
                        data: {
                            labels: carStats.map(c => c.name.length > 15 ? c.name.substring(0, 12) + '...' : c.name),
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
                 if(ctxTopCars && typeof trackRecords !== 'undefined') {
                     const topCars = topCarsData.slice(0, 10);
                     Utils.createChart(ctxTopCars, {
                         type: 'bar',
                         data: {
                             labels: topCars.map(c => c.car_item_name.length > 15 ? c.car_item_name.substring(0, 12) + '...' : c.car_item_name),
                             datasets: [{
                                 label: `Times in Top ${trackRecords?.length || '?'} Records`,
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
        parseCurrentUserCarStats() { const carDiv = document.querySelector('div.car-selected.left'); if (!carDiv) return null; try { const nameEl = carDiv.querySelector('.model p:first-child'); const imgEl = carDiv.querySelector('.model .img img.torn-item'); const name = nameEl ? nameEl.textContent.trim() : 'Unknown Car'; let id = null; if (imgEl && imgEl.src) { const idMatch = imgEl.src.match(/\/items\/(\d+)\//); if (idMatch) id = parseInt(idMatch[1], 10); } const stats = {}; const statItems = carDiv.querySelectorAll('ul.properties-wrap li'); statItems.forEach(li => { const titleEl = li.querySelector('.title'); const progressBarEl = li.querySelector('.progressbar-wrap'); if (titleEl && progressBarEl && progressBarEl.title) { const statName = titleEl.textContent.trim(); const titleAttr = progressBarEl.title; const valueMatch = titleAttr.match(/^(\d+)\s*\(/); if (valueMatch) { stats[statName] = parseInt(valueMatch[1], 10); } } }); if (Object.keys(stats).length === 0) { return { name, id, stats: null }; } return { name, id, stats }; } catch (e) { return null; } },
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
            let chartHTML = '';
            let tableHTML = '';

            if (historyLog.length === 0) {
                historyContentDiv.innerHTML = `<p class="no-history-msg">No historical changes recorded yet.</p>`;
            } else {
                 if (historyLog.length > 1 && typeof Chart !== 'undefined') {
                     chartHTML = `<div class="history-chart-container"><canvas id="historyProgressionChart" style="max-height: 250px;"></canvas></div>`;
                 } else if (historyLog.length <=1) {
                    chartHTML = `<p class="no-history-msg">Need at least two data points for a chart.</p>`;
                 } else {
                    chartHTML = `<p class="no-history-msg">Charting library not loaded.</p>`;
                 }

                const formatChange = (value, change, decimals = 2) => {
                    if (value === null) return 'N/A';
                    const formattedValue = typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : value;
                    if (change === 0 || isNaN(change) || change === null) return formattedValue;
                    const isIncrease = change > 0;
                    const sign = isIncrease ? '+' : '';
                    const changeClass = isIncrease ? 'change-positive' : 'change-negative';
                    const formattedChange = typeof change === 'number' ? change.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : change;
                    return `${formattedValue} <span class="change-indicator ${changeClass}">(${sign}${formattedChange})</span>`;
                };
                const formatClassChange = (currentClass, previousClass) => {
                    if (currentClass === null) return 'N/A';
                    if (!previousClass || currentClass === previousClass || previousClass === null) return currentClass;
                    return `${currentClass} <span class="change-indicator change-neutral">(was ${previousClass})</span>`;
                };

                tableHTML = `<h3>History Log (Last ${historyLog.length})</h3><table><thead><tr><th>Date & Time</th><th class="numeric">Skill</th><th class="numeric">Class</th><th class="numeric">Points</th></tr></thead><tbody>`;

                for (let i = 0; i < historyLog.length; i++) {
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
                    tableHTML += `<tr>
                        <td>${Utils.formatDate(entry.timestamp, true)}</td>
                        <td class="numeric">${formatChange(entry.skill, skillChange, 2)}</td>
                        <td class="numeric">${formatClassChange(entry.class, previousClass)}</td>
                        <td class="numeric">${formatChange(entry.points, pointsChange, 0)}</td>
                    </tr>`;
                }
                tableHTML += `</tbody></table>`;
                 historyContentDiv.innerHTML = chartHTML + tableHTML;
            }

            content.innerHTML = `<div class="history-title">Your Racing Stats History <button class="history-close">×</button></div>`;
            content.appendChild(historyContentDiv);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'panel-actions';
            const clearButton = document.createElement('button');
            clearButton.className = 'history-clear-button';
            clearButton.textContent = 'Clear History Log';
            clearButton.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear your entire racing stats history log? This cannot be undone.')) {
                    HistoryManager.clearLog();
                    this.createHistoryPanel();
                    Utils.showNotification('History log cleared!', 'success');
                }
            });
            actionsDiv.appendChild(clearButton);
            const exportButton = document.createElement('button');
            exportButton.textContent = 'Export History';
            exportButton.addEventListener('click', () => {
                const format = prompt('Export as (csv/json):') || 'csv';
                let dataStr = format === 'json' ? JSON.stringify(HistoryManager.getLog(), null, 2) :
                              'Timestamp,Skill,Class,Points\n' + HistoryManager.getLog().map(e => `${Utils.formatDate(e.timestamp, true)},${e.skill},${e.class},${e.points}`).join('\n');
                DataExporter.downloadData(dataStr, format, `text/${format}`);
            });
            actionsDiv.appendChild(exportButton);
            content.appendChild(actionsDiv);

            const closePanel = () => { popup.remove(); State.historyPanelInstance = null; State.destroyActiveCharts(); };
            content.querySelector('.history-close').addEventListener('click', closePanel);
            popup.addEventListener('click', (e) => { if (e.target === popup) closePanel(); });

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
                    labels: labels,
                    datasets: [
                        {
                            label: 'Racing Skill', data: skillData, borderColor: 'var(--primary-color)', backgroundColor: 'rgba(76, 175, 80, 0.1)',
                            tension: 0.1, yAxisID: 'ySkill', spanGaps: true, pointRadius: 2, pointHoverRadius: 4
                        },
                        {
                            label: 'Racing Points', data: pointsData, borderColor: 'var(--history-color)', backgroundColor: 'rgba(255, 193, 7, 0.1)',
                            tension: 0.1, yAxisID: 'yPoints', spanGaps: true, pointRadius: 2, pointHoverRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
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
            let notesHTML = ScriptInfo.notes.map(note => `<li>${note}</li>`).join('');

            content.innerHTML = `
                <div class="info-title">Script Information <button class="info-close">×</button></div>
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

            const closePanel = () => { popup.remove(); State.infoPanelInstance = null; };
            content.querySelector('.info-close').addEventListener('click', closePanel);
            popup.addEventListener('click', (e) => { if (e.target === popup) closePanel(); });

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
                <div class="download-title">Export Race Results <button class="download-close">×</button></div>
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
                            <button id="downloadFileBtn" class="primary">💾 Download File</button>
                            <button id="copyClipboardBtn">📋 Copy to Clipboard</button>
                         </div>
                    </div>
                </div>`;

            const closePopup = () => { popup.remove(); State.downloadPopupInstance = null; };
            content.querySelector('.download-close').addEventListener('click', closePopup);
            popup.addEventListener('click', (e) => { if (e.target === popup) closePopup(); });

            const formatSelect = content.querySelector('#downloadFormat');
            const downloadBtn = content.querySelector('#downloadFileBtn');
            const copyBtn = content.querySelector('#copyClipboardBtn');

            const performAction = (actionType) => {
                const format = formatSelect.value;
                let dataString;
                let fileExt;
                let mimeType;

                try {
                    switch(format) {
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
                    Utils.showNotification('Error preparing data: ' + e.message, 'error');
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
             infoButton.textContent = 'ℹ️ Info';
             infoButton.title = 'View Script Information';
             infoButton.addEventListener('click', () => { this.createInfoPanel(); });
             State.controlsContainer.appendChild(infoButton);

             const historyButton = document.createElement('button');
             historyButton.className = 'telemetry-history-button';
             historyButton.textContent = '📜 History';
             historyButton.title = 'View Your Racing Stats History';
             historyButton.style.display = 'none';
             historyButton.addEventListener('click', () => { this.createHistoryPanel(); });
             State.controlsContainer.appendChild(historyButton);

            const statsButton = document.createElement('button');
            statsButton.className = 'telemetry-stats-button';
            statsButton.textContent = '📊 Stats';
            statsButton.title = 'Open Advanced Race Statistics';
            statsButton.style.display = 'none';
            statsButton.addEventListener('click', () => {
                RaceManager.updateTrackAndClassInfo().then(() => { this.createAdvancedStatsPanel(); })
                .catch(e => { Utils.showNotification("Error getting latest track/class info.", "error"); });
            });
            State.controlsContainer.appendChild(statsButton);

             const downloadButton = document.createElement('button');
             downloadButton.className = 'telemetry-download-button';
             downloadButton.textContent = '💾 Export';
             downloadButton.title = 'Export Race Results';
             downloadButton.style.display = 'none';
             downloadButton.addEventListener('click', () => { this.createDownloadPopup(); });
             State.controlsContainer.appendChild(downloadButton);

            const settingsButton = document.createElement('button');
            settingsButton.className = 'telemetry-settings-button';
            settingsButton.textContent = '⚙ Settings';
            settingsButton.title = 'Open Telemetry & UI Settings';
            settingsButton.addEventListener('click', () => { this.createSettingsPopup(); });
            State.controlsContainer.appendChild(settingsButton);

            this.updateControlButtonsVisibility();
            document.body.classList.toggle('telemetry-hidden', !Config.get('telemetryVisible'));
        }
    };
