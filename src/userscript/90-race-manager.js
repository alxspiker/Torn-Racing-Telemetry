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
                // Torn's live leaderboard uses "crash"; retain "crashed" for
                // any alternate/legacy markup.
                if (classList.contains('crash') || classList.contains('crashed')) {
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
        selectDriverOnMap(originalId) {
            const originalRow = document.getElementById(originalId);
            if (!originalRow) return;
            if (!originalRow.classList.contains('selected')) originalRow.click();
            this.syncMapSelection();
        },
        syncMapSelection() {
            const selectedOriginalId = document.querySelector('#leaderBoard > li.selected')?.id;
            State.customUIContainer?.querySelectorAll('.custom-driver-item[data-original-id]').forEach(item => {
                item.classList.toggle('map-selected', item.dataset.originalId === selectedOriginalId);
            });
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
                progressBars: element.querySelector('.driver-progress-bars'),
                fullProgressBar: element.querySelector('.driver-progress-full .driver-progress-fill'),
                lapProgressBar: element.querySelector('.driver-progress-lap .driver-progress-fill'),
                detailsButton: element.querySelector('.driver-details-toggle')
            };
            return element._uiRefs;
        },
        createDriverElement(driverData, position) {
            const item = document.createElement('div');
            item.className = 'custom-driver-item';
            item.dataset.originalId = driverData.originalId;
            item.dataset.userId = driverData.userId;
            item.tabIndex = 0;
            item.setAttribute('aria-label', `Select ${driverData.name} on the race map`);

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
            const progressBars = Utils.createElement('div', { className: 'driver-progress-bars' });
            const fullProgressTrack = Utils.createElement('div', { className: 'driver-progress-track driver-progress-full' });
            const fullProgressBar = Utils.createElement('div', { className: 'driver-progress-fill' });
            const lapProgressTrack = Utils.createElement('div', { className: 'driver-progress-track driver-progress-lap' });
            const lapProgressBar = Utils.createElement('div', { className: 'driver-progress-fill' });
            fullProgressTrack.append(fullProgressBar);
            lapProgressTrack.append(lapProgressBar);
            progressBars.append(fullProgressTrack, lapProgressTrack);
            const detailsButton = Utils.createElement('button', {
                className: 'driver-details-toggle',
                text: '↗',
                attrs: {
                    type: 'button',
                    'aria-label': 'Open driver inspector'
                }
            });

            this.setDriverName(nameDiv, driverData.name, isSelf);
            Telemetry.ensureDisplayRefs(telemetryDiv);

            infoRow.append(colorIndicator, carImg, nameDiv, telemetryDiv, detailsButton);
            item.append(infoRow, progressBars);
            item._uiRefs = { colorIndicator, carImg, nameDiv, telemetryDiv, progressBars, fullProgressBar, lapProgressBar, detailsButton };

            this.updateDriverElement(item, driverData, position);
            return item;
        },
        updateDriverElement(element, driverData, position) {
            const driverId = driverData.userId;
            const isSelf = driverId === State.userId;
            const now = Date.now();
            const driverState = State.previousMetrics[driverId];
            const refs = this.ensureElementRefs(element);

            const mapSelected = document.getElementById(driverData.originalId)?.classList.contains('selected');
            element.className = `custom-driver-item status-${driverData.statusClass} ${isSelf ? 'is-self' : ''} ${mapSelected ? 'map-selected' : ''}`.trim().replace(/\s+/g, ' ');

            if (refs.detailsButton) {
                refs.detailsButton.textContent = '↗';
                refs.detailsButton.setAttribute('aria-label', `Open details for ${driverData.name}`);
                refs.detailsButton.setAttribute('title', 'Open driver inspector');
            }

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
            if (carImg) {
                if (carImg.getAttribute('src') !== newCarSrc) {
                    carImg.src = newCarSrc;
                }
                if (carImg.alt !== driverData.carTitle || carImg.title !== driverData.carTitle) {
                    carImg.alt = driverData.carTitle;
                    carImg.title = driverData.carTitle;
                }
            }

            this.setDriverName(refs.nameDiv, driverData.name, isSelf);

            const telemetryDiv = refs.telemetryDiv;
            if (telemetryDiv) {
                const displayOptions = Config.get('telemetryDisplayOptions') || [];
                const speedUnit = Config.get('speedUnit');
                const speedUnitLabel = speedUnit === 'kmh' ? 'km/h' : speedUnit;

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
                        telemetryText = 'Crashed';
                        telemetryColor = 'var(--telemetry-decel-color)';
                    } else if (driverData.statusClass === 'finished') {
                        const finishTimeText = driverData.originalStatusText || '--:--';
                        telemetryText = `\u{1F3C1} ${finishTimeText}`;
                    } else {
                        const displayParts = [];
                        telemetryText = 'Waiting';
                    }

                    Telemetry.setTelemetryDisplay(telemetryDiv, telemetryText, telemetryColor);
                } else {
                    const metrics = Telemetry.calculateDriverMetrics(driverId, driverData.progress, now);
                    const targetSpeed = Utils.convertSpeed(metrics.speed, speedUnit);
                    const targetAcc = metrics.acceleration;

                    if (Config.get('showLapEstimate') && driverData.progress < 100 && State.trackInfo.length > 0 && State.previousMetrics[driverId]) {
                        Telemetry.calculateSmoothedLapEstimate(driverId, metrics);
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
                            speedUnitLabel
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
                            parts.push(`${Math.round(targetSpeed)} ${speedUnitLabel}`);
                        }
                        if (displayOptions.includes('acceleration')) {
                            parts.push(`${targetAcc.toFixed(1)} g`);
                            if (Config.get('colorCode')) {
                                staticColor = Telemetry.getTelemetryColor(targetAcc);
                            }
                        }
                        const staticText = parts.join(' | ') || '-';
                        Telemetry.setTelemetryDisplay(telemetryDiv, staticText, staticColor);
                    }

                    if (driverState) {
                        driverState.lastDisplayedSpeed = metrics.speed;
                        driverState.lastDisplayedAcceleration = metrics.acceleration;
                    }
                }
            }

            if (refs.progressBars) {
                const showProgressBars = (Config.get('telemetryDisplayOptions') || []).includes('progress');
                const showLiveProgress = showProgressBars && !['finished', 'crashed'].includes(driverData.statusClass);
                const fullProgress = Math.max(0, Math.min(100, driverData.progress || 0));
                const laps = Math.max(1, Number(State.trackInfo.laps) || 1);
                const progressPerLap = 100 / laps;
                const lapProgress = fullProgress >= 100 ? 100 : ((fullProgress % progressPerLap) / progressPerLap) * 100;
                refs.progressBars.hidden = !showLiveProgress;
                refs.fullProgressBar.style.width = `${fullProgress.toFixed(2)}%`;
                refs.lapProgressBar.style.width = `${Math.max(0, Math.min(100, lapProgress)).toFixed(2)}%`;
                refs.progressBars.removeAttribute('title');
            }

            if (driverState) driverState.statusClass = driverData.statusClass;
        },
        stableUpdateCustomList() {
            if (!Config.get('hideOriginalList')) {
                if (DriverInspector.root) DriverInspector.close(false);
                if (State.isInitialized) {
                    State.resetRaceState();
                }
                return;
            }
            if (State.isUpdating || !State.customUIContainer || !State.originalLeaderboard || !document.body.contains(State.originalLeaderboard)) {
                return;
            }

            State.isUpdating = true;
            try {
                // Track metadata changes reset race state. Reacquire the ID here so finished
                // race adapters still have it on first render and when viewing historic logs.
                if (!State.currentRaceId) {
                    State.currentRaceId = this.getRaceId();
                }
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

                const mapSelectionRaceKey = State.currentRaceId || newDriversData.map(driver => driver.originalId).join(',');
                if (State.mapSelectionInitializedForRace !== mapSelectionRaceKey) {
                    const selfDriver = newDriversData.find(driver => driver.userId === State.userId);
                    if (selfDriver) this.selectDriverOnMap(selfDriver.originalId);
                    State.mapSelectionInitializedForRace = mapSelectionRaceKey;
                }

                const finishedOrCrashed = ['finished', 'crashed'];
                const allDriversFinished = newDriversData.length > 0 && newDriversData.every(d => finishedOrCrashed.includes(d.statusClass));

                if (allDriversFinished && !State.raceFinished) {
                    State.raceFinished = true;
                    State.finalRaceData = newDriversData;
                    if (typeof TabWorkspace !== 'undefined') TabWorkspace.invalidateRaceBoundViews();
                    UI.updateControlButtonsVisibility();
                } else if (allDriversFinished) {
                    // Torn can populate image titles after the result rows first render.
                    // Keep the export snapshot aligned with the latest original markup.
                    State.finalRaceData = newDriversData;
                } else if (!allDriversFinished && State.raceFinished) {
                    State.raceFinished = false;
                    State.finalRaceData = [];
                    UI.updateControlButtonsVisibility();
                }

                this.syncMapSelection();
                if (DriverInspector.root) DriverInspector.render();

                if (hadFocus && document.body.contains(State.customUIContainer)) {
                    State.customUIContainer.scrollTop = savedScrollTop;
                }
            } finally {
                State.isUpdating = false;
            }
        }
    };
