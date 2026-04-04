    const RaceManager = {
        getRaceId() {
            const firstDriverLi = document.querySelector('#leaderBoard > li[data-id]');
            if (firstDriverLi && firstDriverLi.dataset.id) {
                const parts = firstDriverLi.dataset.id.split('-');
                if (parts.length === 2 && /^\d+$/.test(parts[0])) {
                    return parts[0];
                }
            }
            return null;
        },
        parseDriverData(originalLi) {
            if (!originalLi || !originalLi.matches('li[id^="lbr-"]')) return null;

            const nameEl = originalLi.querySelector('.name span');
            const carEl = originalLi.querySelector('.car img');
            const colorEl = originalLi.querySelector('.color');
            const timeEl = originalLi.querySelector('.time');
            const statusDiv = originalLi.querySelector('.status-wrap > div');
            const dataId = originalLi.dataset.id;
            const userId = dataId ? dataId.split('-')[1] : null;

            if (!userId) {
                return null;
            }

            const progressText = timeEl ? timeEl.textContent.trim() : '0%';
            const progressPercentage = Utils.parseProgress(progressText);
            let statusClass = 'unknown';
            let isFinished = false;
            let isCrashed = false;

            if (statusDiv) {
                const classList = statusDiv.classList;
                if (classList.contains('crashed')) {
                    isCrashed = true;
                    statusClass = 'crashed';
                } else if (classList.contains('gold') || classList.contains('silver') || classList.contains('bronze') || classList.contains('finished')) {
                    isFinished = true;
                    statusClass = 'finished';
                }
            }

            if (!isFinished && !isCrashed && timeEl && timeEl.textContent.includes(':')) {
                isFinished = true;
                statusClass = 'finished';
            }

            if (!isCrashed && !isFinished) {
                if (progressPercentage > 0) {
                    statusClass = 'racing';
                } else {
                    let raceStarted = false;
                    const anyTimeEl = document.querySelector('#leaderBoard li .time:not(:empty)');
                    if (anyTimeEl) {
                        raceStarted = true;
                    }
                    statusClass = raceStarted ? 'racing' : 'ready';
                }
            }

            if (State.previousMetrics[userId]?.statusClass === 'finished' && statusClass !== 'crashed') {
                statusClass = 'finished';
            }

            return {
                userId,
                originalId: originalLi.id,
                name: nameEl ? nameEl.textContent.trim() : 'N/A',
                carImgRaw: carEl ? carEl.getAttribute('src') : '',
                carTitle: carEl ? carEl.title : 'Unknown Car',
                colorClass: colorEl ? colorEl.className.replace('color', '').trim() : 'color-default',
                statusClass,
                originalStatusText: progressText,
                progress: progressPercentage
            };
        },
        async updateTrackAndClassInfo() {
            let trackInfoUpdated = false;
            let classInfoUpdated = false;

            try {
                const infoElement = document.querySelector('div.track-info');
                const trackHeader = document.querySelector('.drivers-list .title-black');

                if (infoElement && infoElement.title) {
                    const trackNameFromTitle = infoElement.title.trim();
                    const lengthMatch = infoElement.dataset.length?.match(/(\d+\.?\d*)/);
                    const lapsMatch = trackHeader?.textContent.match(/(\d+)\s+laps?/i);
                    const laps = lapsMatch ? parseInt(lapsMatch[1], 10) : (State.trackInfo.laps || 5);
                    const length = lengthMatch ? parseFloat(lengthMatch[1]) : (State.trackInfo.length || 3.4);
                    let trackId = State.trackInfo.id;
                    let trackName = State.trackInfo.name;

                    if (!trackId || trackNameFromTitle !== trackName) {
                        if (!State.trackNameMap && Utils.isApiKeyAvailable()) {
                            try {
                                const apiKey = Config.get('apiKey');
                                if (apiKey) {
                                    State.trackNameMap = await APIManager.fetchTrackData(apiKey);
                                }
                            } catch (e) {
                                State.trackNameMap = {};
                            }
                        }

                        if (State.trackNameMap) {
                            const foundEntry = Object.entries(State.trackNameMap).find(([id, name]) => name.toLowerCase() === trackNameFromTitle.toLowerCase());
                            if (foundEntry) {
                                trackId = parseInt(foundEntry[0], 10);
                                trackName = foundEntry[1];
                            } else {
                                trackName = trackNameFromTitle;
                                trackId = null;
                            }
                        } else {
                            trackName = trackNameFromTitle;
                            trackId = null;
                        }
                    }

                    const raceGeometryChanged =
                        trackId !== State.trackInfo.id ||
                        laps !== State.trackInfo.laps ||
                        Math.abs(length - State.trackInfo.length) > 0.01;
                    const trackIdentityChanged = raceGeometryChanged || trackName !== State.trackInfo.name;

                    if (trackIdentityChanged) {
                        if (raceGeometryChanged) {
                            State.resetRaceState();
                        }
                        State.trackInfo = { id: trackId, name: trackName, laps, length, get total() { return this.laps * this.length; } };
                        trackInfoUpdated = true;
                    }
                }

                const classElement = document.querySelector('div.banner div.class-letter');
                const detectedClass = classElement ? classElement.textContent.trim().toUpperCase() : null;
                if (detectedClass && detectedClass !== State.currentRaceClass) {
                    State.currentRaceClass = detectedClass;
                    classInfoUpdated = true;
                }
            } catch (e) {
                console.error('Telemetry Script: Error in updateTrackAndClassInfo:', e);
            }

            return trackInfoUpdated || classInfoUpdated;
        },
        getPositionIndicator(position, statusClass) {
            if (statusClass === 'finished') {
                if (position === 1) return '\u{1F947}';
                if (position === 2) return '\u{1F948}';
                if (position === 3) return '\u{1F949}';
                return String(position);
            }
            if (statusClass === 'crashed') return '\u{1F4A5}';
            if (statusClass === 'ready') return '-';
            return String(position);
        },
        setDriverName(nameDiv, name, isSelf) {
            if (!nameDiv) return;
            if (nameDiv._displayName === name && nameDiv._displayIsSelf === isSelf) {
                return;
            }

            nameDiv.textContent = name;
            if (isSelf) {
                nameDiv.appendChild(Utils.createElement('span', { className: 'self-tag', text: '(You)' }));
            }
            nameDiv._displayName = name;
            nameDiv._displayIsSelf = isSelf;
        },
        ensureElementRefs(element) {
            if (element?._uiRefs?.colorIndicator && element?._uiRefs?.telemetryDiv) {
                return element._uiRefs;
            }

            element._uiRefs = {
                colorIndicator: element.querySelector('.driver-color-indicator'),
                carImg: element.querySelector('.driver-car-img'),
                nameDiv: element.querySelector('.driver-name'),
                telemetryDiv: element.querySelector('.driver-telemetry-display'),
                detailsDiv: element.querySelector('.driver-details')
            };
            return element._uiRefs;
        },
        createDriverElement(driverData, position) {
            const item = document.createElement('div');
            item.className = 'custom-driver-item';
            item.dataset.originalId = driverData.originalId;
            item.dataset.userId = driverData.userId;

            const isSelf = driverData.userId === State.userId;
            if (isSelf) item.classList.add('is-self');
            item.classList.add(`status-${driverData.statusClass}`);

            const infoRow = Utils.createElement('div', { className: 'driver-info-row' });
            const colorIndicator = Utils.createElement('div', { className: `driver-color-indicator ${driverData.colorClass}` });
            const carImg = Utils.createElement('img', {
                className: 'driver-car-img',
                attrs: {
                    src: Utils.makeAbsoluteUrl(driverData.carImgRaw),
                    alt: driverData.carTitle,
                    title: driverData.carTitle
                }
            });
            const nameDiv = Utils.createElement('div', { className: 'driver-name' });
            const telemetryDiv = Utils.createElement('div', { className: 'driver-telemetry-display' });
            const detailsDiv = Utils.createElement('div', { className: 'driver-details' });

            this.setDriverName(nameDiv, driverData.name, isSelf);
            Telemetry.ensureDisplayRefs(telemetryDiv);

            infoRow.append(colorIndicator, carImg, nameDiv, telemetryDiv);
            item.append(infoRow, detailsDiv);
            item._uiRefs = { colorIndicator, carImg, nameDiv, telemetryDiv, detailsDiv };

            this.updateDriverElement(item, driverData, position);
            return item;
        },
        updateDriverElement(element, driverData, position) {
            const driverId = driverData.userId;
            const isSelf = driverId === State.userId;
            const now = Date.now();
            const detailsVisible = element.classList.contains('details-visible');
            const driverState = State.previousMetrics[driverId];
            const refs = this.ensureElementRefs(element);

            element.className = `custom-driver-item status-${driverData.statusClass} ${isSelf ? 'is-self' : ''} ${detailsVisible ? 'details-visible' : ''}`.trim().replace(/\s+/g, ' ');

            const colorIndicator = refs.colorIndicator;
            if (colorIndicator) {
                const nextClassName = `driver-color-indicator ${driverData.colorClass}`;
                if (colorIndicator.className !== nextClassName) {
                    colorIndicator.className = nextClassName;
                }
                colorIndicator.textContent = this.getPositionIndicator(position, driverData.statusClass);
            }

            const carImg = refs.carImg;
            const newCarSrc = Utils.makeAbsoluteUrl(driverData.carImgRaw);
            if (carImg && carImg.getAttribute('src') !== newCarSrc) {
                carImg.src = newCarSrc;
                carImg.alt = driverData.carTitle;
                carImg.title = driverData.carTitle;
            }

            this.setDriverName(refs.nameDiv, driverData.name, isSelf);

            const telemetryDiv = refs.telemetryDiv;
            if (telemetryDiv) {
                const displayOptions = Config.get('telemetryDisplayOptions') || [];
                const speedUnit = Config.get('speedUnit');
                let lapEstimateText = '';

                if (driverData.statusClass === 'crashed' || driverData.statusClass === 'finished' || driverData.statusClass === 'ready') {
                    if (telemetryDiv._animationRAF) {
                        cancelAnimationFrame(telemetryDiv._animationRAF);
                        telemetryDiv._animationRAF = null;
                        telemetryDiv._currentAnimSpeed = undefined;
                        telemetryDiv._currentAnimAcc = undefined;
                    }

                    let telemetryText = '';
                    let telemetryColor = 'var(--telemetry-default-color)';

                    if (driverData.statusClass === 'crashed') {
                        telemetryText = '\u{1F4A5} CRASHED';
                        telemetryColor = 'var(--telemetry-decel-color)';
                    } else if (driverData.statusClass === 'finished') {
                        const finishTime = Utils.parseTime(driverData.originalStatusText);
                        let avgSpeedFormatted = '---';
                        const finishTimeText = driverData.originalStatusText || '--:--';

                        if (finishTime > 0 && State.trackInfo.total > 0) {
                            const avgSpeed = (State.trackInfo.total / finishTime) * 3600;
                            avgSpeedFormatted = `~${Math.round(Utils.convertSpeed(avgSpeed, speedUnit))} ${speedUnit}`;
                        }

                        telemetryText = `\u{1F3C1} ${finishTimeText} (${avgSpeedFormatted})`;
                    } else {
                        const displayParts = [];
                        if (displayOptions.includes('speed')) displayParts.push(`0 ${speedUnit}`);
                        if (displayOptions.includes('acceleration')) displayParts.push('0.0 g');
                        if (displayOptions.includes('progress')) displayParts.push(`${driverData.progress.toFixed(1)}%`);
                        telemetryText = displayParts.length > 0 ? displayParts.join(' | ') : '-';
                    }

                    Telemetry.setTelemetryDisplay(telemetryDiv, telemetryText, telemetryColor);
                } else {
                    const metrics = Telemetry.calculateDriverMetrics(driverId, driverData.progress, now);
                    const targetSpeed = Utils.convertSpeed(metrics.speed, speedUnit);
                    const targetAcc = metrics.acceleration;

                    if (Config.get('showLapEstimate') && driverData.progress < 100 && State.trackInfo.id && driverState) {
                        const lapEstimateSeconds = Telemetry.calculateSmoothedLapEstimate(driverId, metrics);
                        if (lapEstimateSeconds !== null && isFinite(lapEstimateSeconds) && lapEstimateSeconds > 0) {
                            lapEstimateText = `~${Utils.formatTime(lapEstimateSeconds)}`;
                        }
                    }

                    const canAnimate =
                        Config.get('animateChanges') &&
                        driverState &&
                        !driverState.firstUpdate &&
                        (displayOptions.includes('speed') || displayOptions.includes('acceleration'));

                    if (canAnimate) {
                        const fromSpeed = telemetryDiv._currentAnimSpeed !== undefined
                            ? telemetryDiv._currentAnimSpeed
                            : Math.round(Utils.convertSpeed(driverState.lastDisplayedSpeed || 0, speedUnit));
                        const fromAcc = telemetryDiv._currentAnimAcc !== undefined
                            ? telemetryDiv._currentAnimAcc
                            : driverState.lastDisplayedAcceleration || 0;
                        const animationDuration = Math.min(metrics.timeDelta || Config.get('minUpdateInterval'), Config.get('maxAnimationDurationMs'));

                        const animationMode = displayOptions.includes('speed')
                            ? (displayOptions.includes('acceleration') ? 'both' : 'speed')
                            : 'acceleration';

                        Telemetry.animateTelemetry(
                            telemetryDiv,
                            fromSpeed,
                            Math.round(targetSpeed),
                            fromAcc,
                            targetAcc,
                            animationDuration,
                            animationMode,
                            speedUnit,
                            lapEstimateText,
                            displayOptions.includes('progress') ? `${driverData.progress.toFixed(1)}%` : ''
                        );
                    } else {
                        if (telemetryDiv._animationRAF) {
                            cancelAnimationFrame(telemetryDiv._animationRAF);
                            telemetryDiv._animationRAF = null;
                            telemetryDiv._currentAnimSpeed = undefined;
                            telemetryDiv._currentAnimAcc = undefined;
                        }

                        let staticColor = 'var(--telemetry-default-color)';
                        const parts = [];

                        if (displayOptions.includes('speed')) {
                            parts.push(`${Math.round(targetSpeed)} ${speedUnit}`);
                        }
                        if (displayOptions.includes('acceleration')) {
                            parts.push(`${targetAcc.toFixed(1)} g`);
                            if (Config.get('colorCode')) {
                                staticColor = Telemetry.getTelemetryColor(targetAcc);
                            }
                        }
                        if (displayOptions.includes('progress')) {
                            parts.push(`${driverData.progress.toFixed(1)}%`);
                            if (!displayOptions.includes('acceleration') || !Config.get('colorCode')) {
                                staticColor = 'var(--telemetry-default-color)';
                            }
                        }

                        const staticText = parts.join(' | ') || '-';
                        Telemetry.setTelemetryDisplay(telemetryDiv, staticText, staticColor, lapEstimateText);
                    }

                    if (driverState) {
                        driverState.lastDisplayedSpeed = metrics.speed;
                        driverState.lastDisplayedAcceleration = metrics.acceleration;
                    }
                }
            }

            const detailsDiv = refs.detailsDiv;
            if (detailsDiv) {
                const needsHTMLStructure = detailsVisible && !detailsDiv.hasChildNodes();
                if (needsHTMLStructure) {
                    const apiStatsHTML = Config.get('fetchApiStatsOnClick')
                        ? `
                            <div class="api-stats-container">
                                <div class="driver-section-title">API Racing Stats</div>
                                <div class="driver-api-grid">
                                    <div class="driver-api-item">
                                        <span class="driver-api-label">Skill</span>
                                        <span class="driver-api-value"><span class="api-stat stat-skill">...</span></span>
                                    </div>
                                    <div class="driver-api-item">
                                        <span class="driver-api-label">Points</span>
                                        <span class="driver-api-value"><span class="api-stat stat-points">...</span></span>
                                    </div>
                                    <div class="driver-api-item">
                                        <span class="driver-api-label">Races</span>
                                        <span class="driver-api-value"><span class="api-stat stat-races-entered">...</span> (<span class="api-stat stat-races-won">...</span> wins)</span>
                                    </div>
                                    <div class="driver-api-item">
                                        <span class="driver-api-label">Win Rate</span>
                                        <span class="driver-api-value"><span class="api-stat stat-win-rate">...</span></span>
                                    </div>
                                </div>
                                <span class="api-stat-error-msg"></span>
                            </div>`
                        : '';

                    detailsDiv.innerHTML = `
                        <div class="driver-details-shell">
                            <div class="driver-details-topline">
                                <div class="driver-identity">
                                    <span class="driver-identity-label">User</span>
                                    <span class="driver-identity-value">${driverData.name} [<a href="/profiles.php?XID=${driverId}" target="_blank" rel="noopener noreferrer" title="View Profile">${driverId}</a>] ${isSelf ? '<strong>(You)</strong>' : ''}</span>
                                </div>
                                <div class="driver-status-wrap">
                                    <span class="driver-identity-label">Status</span>
                                    <span class="driver-status-chip detail-status">${driverData.statusClass}</span>
                                    <span class="detail-original-status"></span>
                                </div>
                            </div>
                            <div class="driver-meta-row">
                                <span class="driver-identity-label">Car</span>
                                <span class="driver-identity-value">${driverData.carTitle}</span>
                            </div>
                            <div class="driver-metrics-grid">
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Position</span>
                                    <span class="driver-metric-value detail-stat detail-position">${driverData.statusClass === 'crashed' ? 'Crashed' : position}</span>
                                </div>
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Progress</span>
                                    <span class="driver-metric-value detail-stat detail-progress">${driverData.progress.toFixed(2)}%</span>
                                </div>
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Lap</span>
                                    <span class="driver-metric-value detail-stat detail-lap">-/-</span>
                                </div>
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Lap Progress</span>
                                    <span class="driver-metric-value detail-stat detail-lap-progress">-%</span>
                                </div>
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Calc Speed</span>
                                    <span class="driver-metric-value"><span class="detail-stat detail-calc-speed">-</span><span class="metric-unit"> mph</span></span>
                                </div>
                                <div class="driver-metric-item">
                                    <span class="driver-metric-label">Calc Accel</span>
                                    <span class="driver-metric-value"><span class="detail-stat detail-calc-accel">-</span><span class="metric-unit"> g</span></span>
                                </div>
                                <div class="driver-metric-item metric-est-lap p-est-lap-time" style="display: none;">
                                    <span class="driver-metric-label">Est. Lap Time</span>
                                    <span class="driver-metric-value detail-stat detail-est-lap-time">N/A</span>
                                </div>
                            </div>
                            ${apiStatsHTML}
                            <div class="driver-details-footer">Source ID: ${driverData.originalId}</div>
                        </div>`;

                    if (Config.get('fetchApiStatsOnClick') && driverId && !element.hasAttribute('data-stats-loaded') && !APIManager.isFetching.has(driverId)) {
                        setTimeout(() => APIManager.fetchAndDisplayRacingStats(element, driverId), 50);
                    }
                }

                if (detailsVisible) {
                    const updateDetailStat = (selector, value, placeholder = '-', isLiveData = true) => {
                        const detailEl = detailsDiv.querySelector(selector);
                        const usePlaceholder = isLiveData && driverData.statusClass !== 'racing';
                        if (detailEl) {
                            detailEl.textContent = usePlaceholder ? placeholder : value;
                        }
                    };

                    updateDetailStat('.detail-position', driverData.statusClass === 'crashed' ? 'Crashed' : position, '-', false);
                    updateDetailStat('.detail-progress', `${driverData.progress.toFixed(2)}%`, '0.00%', false);

                    const statusEl = detailsDiv.querySelector('.detail-status');
                    if (statusEl) statusEl.textContent = driverData.statusClass;

                    const statusSpan = detailsDiv.querySelector('.detail-original-status');
                    if (statusSpan) {
                        statusSpan.textContent = (driverData.originalStatusText && !['finished', 'crashed'].includes(driverData.statusClass))
                            ? `(${driverData.originalStatusText})`
                            : '';
                    }

                    if (driverState || driverData.statusClass !== 'racing') {
                        updateDetailStat('.detail-lap', `${driverState?.currentLap || '-'}/${State.trackInfo.laps || '-'}`, '-/-');
                        updateDetailStat('.detail-lap-progress', `${driverState?.progressInLap !== undefined ? driverState.progressInLap.toFixed(1) : '-'}%`, '-%');
                        updateDetailStat('.detail-calc-speed', `${driverState?.lastDisplayedSpeed !== undefined ? driverState.lastDisplayedSpeed.toFixed(1) : '-'}`, '-');
                        updateDetailStat('.detail-calc-accel', `${driverState?.lastDisplayedAcceleration !== undefined ? driverState.lastDisplayedAcceleration.toFixed(3) : '-'}`, '-');

                        const estLapTimeEl = detailsDiv.querySelector('.detail-est-lap-time');
                        const estLapParaEl = detailsDiv.querySelector('.p-est-lap-time');
                        if (estLapTimeEl && estLapParaEl) {
                            const isRacing = driverData.statusClass === 'racing';
                            const estLapVisible =
                                isRacing &&
                                Config.get('showLapEstimate') &&
                                driverState?.smoothedLapEstimate !== null &&
                                isFinite(driverState?.smoothedLapEstimate) &&
                                State.trackInfo.id &&
                                driverState?.smoothedLapEstimate > 0;

                            if (estLapVisible) {
                                estLapTimeEl.textContent = `${Utils.formatTime(driverState.smoothedLapEstimate)} (Raw: ${driverState.rawLapEstimate !== null && isFinite(driverState.rawLapEstimate) ? Utils.formatTime(driverState.rawLapEstimate) : '--:--'})`;
                                estLapParaEl.style.display = '';
                            } else {
                                estLapTimeEl.textContent = 'N/A';
                                estLapParaEl.style.display = 'none';
                            }
                        }
                    }

                    if (Config.get('fetchApiStatsOnClick') && driverId && !element.hasAttribute('data-stats-loaded') && !APIManager.isFetching.has(driverId)) {
                        const statsContainer = detailsDiv.querySelector('.api-stats-container');
                        if (statsContainer && !statsContainer.matches('.loading, .loaded, .error, .no-key')) {
                            setTimeout(() => APIManager.fetchAndDisplayRacingStats(element, driverId), 50);
                        }
                    }
                }
            }

            if (driverState) driverState.statusClass = driverData.statusClass;
        },
        stableUpdateCustomList() {
            if (!Config.get('hideOriginalList')) {
                if (State.isInitialized) {
                    State.resetRaceState();
                }
                return;
            }
            if (State.isUpdating || !State.customUIContainer || !State.originalLeaderboard || !document.body.contains(State.originalLeaderboard)) {
                return;
            }

            State.isUpdating = true;
            const savedScrollTop = State.customUIContainer.scrollTop;
            const hadFocus = document.activeElement === State.customUIContainer || State.customUIContainer.contains(document.activeElement);
            const originalListItems = Array.from(State.originalLeaderboard.querySelectorAll(':scope > li[id^="lbr-"]'));
            const newDriversData = originalListItems.map(this.parseDriverData).filter(data => data !== null);
            const currentElementsMap = new Map();

            State.customUIContainer.querySelectorAll(':scope > .custom-driver-item[data-user-id]').forEach(el => {
                currentElementsMap.set(el.dataset.userId, el);
            });

            const newElementsToProcess = new Map();
            newDriversData.forEach((driverData, index) => {
                const position = index + 1;
                let element = currentElementsMap.get(driverData.userId);

                if (element) {
                    this.updateDriverElement(element, driverData, position);
                    newElementsToProcess.set(driverData.userId, { data: driverData, element, position });
                    currentElementsMap.delete(driverData.userId);
                } else {
                    element = this.createDriverElement(driverData, position);
                    newElementsToProcess.set(driverData.userId, { data: driverData, element, position });
                }
            });

            currentElementsMap.forEach((elementToRemove, removedUserId) => {
                const telemetryDiv = this.ensureElementRefs(elementToRemove).telemetryDiv;
                if (telemetryDiv?._animationRAF) {
                    cancelAnimationFrame(telemetryDiv._animationRAF);
                }
                if (State.previousMetrics[removedUserId]) {
                    delete State.previousMetrics[removedUserId];
                }
                elementToRemove.remove();
            });

            let previousElement = null;
            newDriversData.forEach(driverData => {
                const { element } = newElementsToProcess.get(driverData.userId);
                const insertBeforeNode = previousElement ? previousElement.nextSibling : State.customUIContainer.firstChild;
                if (element !== insertBeforeNode) {
                    State.customUIContainer.insertBefore(element, insertBeforeNode);
                }
                previousElement = element;
            });

            const finishedOrCrashed = ['finished', 'crashed'];
            const allDriversFinished = newDriversData.length > 0 && newDriversData.every(d => finishedOrCrashed.includes(d.statusClass));

            if (allDriversFinished && !State.raceFinished) {
                State.raceFinished = true;
                State.finalRaceData = newDriversData;
                UI.updateControlButtonsVisibility();
            } else if (!allDriversFinished && State.raceFinished) {
                State.raceFinished = false;
                State.finalRaceData = [];
                UI.updateControlButtonsVisibility();
            }

            if (hadFocus && document.body.contains(State.customUIContainer)) {
                State.customUIContainer.scrollTop = savedScrollTop;
            }
            State.isUpdating = false;
        }
    };
