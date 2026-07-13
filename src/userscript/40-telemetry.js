    const Telemetry = {
        lapEstimateSpeedWindowMs: 8000,
        easeInOutQuad(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; },
        interpolateColor(color1, color2, factor) { const result = color1.map((c, i) => Math.round(c + factor * (color2[i] - c))); return `rgb(${result[0]}, ${result[1]}, ${result[2]})`; },
        getTelemetryColor(acceleration) { const grey = [136, 136, 136]; const green = [76, 175, 80]; const red = [244, 67, 54]; const defaultColor = getComputedStyle(document.documentElement).getPropertyValue('--telemetry-default-color').match(/\d+/g)?.map(Number) || grey; const accelColor = getComputedStyle(document.documentElement).getPropertyValue('--telemetry-accel-color').match(/\d+/g)?.map(Number) || green; const decelColor = getComputedStyle(document.documentElement).getPropertyValue('--telemetry-decel-color').match(/\d+/g)?.map(Number) || red; if (!Config.get('colorCode')) return `rgb(${defaultColor.join(', ')})`; const maxAcc = 1.0; let factor = Math.min(Math.abs(acceleration) / maxAcc, 1); factor = isNaN(factor) ? 0 : factor; if (acceleration > 0.05) return this.interpolateColor(defaultColor, accelColor, factor); if (acceleration < -0.05) return this.interpolateColor(defaultColor, decelColor, factor); return `rgb(${defaultColor.join(', ')})`; },
        ensureDisplayRefs(container) {
            if (!container) return null;
            if (container._displayRefs?.speedValue && container._displayRefs?.status) {
                return container._displayRefs;
            }

            const createStat = (className, label) => {
                const stat = document.createElement('span');
                stat.className = `telemetry-stat ${className}`;
                const labelSpan = document.createElement('span');
                labelSpan.className = 'telemetry-label';
                labelSpan.textContent = label;
                const valueSpan = document.createElement('span');
                valueSpan.className = 'telemetry-stat-value';
                stat.append(labelSpan, valueSpan);
                return { stat, value: valueSpan };
            };

            const statsWrap = document.createElement('span');
            statsWrap.className = 'telemetry-value telemetry-stats';
            const performanceColumn = document.createElement('span');
            performanceColumn.className = 'telemetry-column telemetry-performance';
            const raceColumn = document.createElement('span');
            raceColumn.className = 'telemetry-column telemetry-race';
            const speed = createStat('telemetry-speed', 'Speed');
            const acceleration = createStat('telemetry-acceleration', 'Accel');
            const statusSpan = document.createElement('span');
            statusSpan.className = 'telemetry-status telemetry-stat';

            performanceColumn.append(speed.stat, acceleration.stat);
            raceColumn.append(statusSpan);
            statsWrap.append(performanceColumn, raceColumn);

            container.replaceChildren(statsWrap);

            container._displayRefs = {
                statsWrap,
                performanceColumn,
                raceColumn,
                status: statusSpan,
                speedStat: speed.stat,
                speedValue: speed.value,
                accelerationStat: acceleration.stat,
                accelerationValue: acceleration.value,
            };
            return container._displayRefs;
        },
        setTelemetryDisplay(container, text, color) {
            const refs = this.ensureDisplayRefs(container);
            if (!refs) return;

            const parts = text.split('|').map(part => part.trim()).filter(Boolean);
            const speed = parts.find(part => /\s(?:mph|km\/h)$/i.test(part));
            const acceleration = parts.find(part => /\sg$/i.test(part));
            const status = parts.find(part => part !== speed && part !== acceleration && !/%$/.test(part));
            const hasTelemetryContent = Boolean(speed || acceleration || status);

            refs.statsWrap.hidden = !hasTelemetryContent;
            if (!hasTelemetryContent) {
                refs.speedStat.hidden = true;
                refs.accelerationStat.hidden = true;
                refs.status.hidden = true;
            } else if (speed || acceleration) {
                refs.speedStat.hidden = !speed;
                refs.accelerationStat.hidden = !acceleration;
                refs.status.hidden = !status;
                refs.speedValue.textContent = speed || '';
                refs.accelerationValue.textContent = acceleration || '';
                refs.status.textContent = status || '';
                refs.speedValue.style.color = color;
                refs.accelerationValue.style.color = color;
                refs.status.style.color = color;
            } else {
                refs.speedStat.hidden = true;
                refs.accelerationStat.hidden = true;
                refs.status.textContent = text;
                refs.status.style.color = color;
                refs.status.hidden = false;
            }
            const updateColumnState = (column, children) => {
                const visibleCount = children.filter(child => !child.hidden).length;
                column.hidden = visibleCount === 0;
                column.dataset.itemCount = String(visibleCount);
            };
            updateColumnState(refs.performanceColumn, [refs.speedStat, refs.accelerationStat]);
            updateColumnState(refs.raceColumn, [refs.status]);
        },
        ema(current, prev, alpha) {
            if (prev === null || typeof prev === 'undefined' || !isFinite(prev)) return current;
            return alpha * current + (1 - alpha) * prev;
        },
        calculateDriverMetrics(driverId, progressPercentage, timestamp) {
            const prev = State.previousMetrics[driverId] || {
                progress: 0, time: timestamp - Config.get('minUpdateInterval'),
                lastProgressValueAtChange: 0, lastProgressChangeTimestamp: timestamp - Config.get('minUpdateInterval'),
                reportedSpeed: 0, acceleration: 0, lastDisplayedSpeed: 0, lastDisplayedAcceleration: 0,
                firstUpdate: true, currentLap: 1, progressInLap: 0,
                rawLapEstimate: null, smoothedLapEstimate: null, statusClass: 'ready',
                raceStartTime: timestamp, totalTimeElapsed: 0, totalDistanceTraveled: 0, wasStale: false
            };

            const minDt = Config.get('minUpdateInterval') / 1000;
            const dtSinceLastUpdate = (timestamp - prev.time) / 1000;
            const staleThresholdMs = 1500;

            if (prev.firstUpdate) {
                const totalLaps = State.trackInfo.laps || 1;
                const percentPerLap = 100 / totalLaps;
                const currentLap = Math.min(totalLaps, Math.floor(progressPercentage / percentPerLap) + 1);
                const startPercentOfLap = (currentLap - 1) * percentPerLap;
                const progressInLap = percentPerLap > 0 ? Math.max(0, Math.min(100, ((progressPercentage - startPercentOfLap) / percentPerLap) * 100)) : 0;

                State.previousMetrics[driverId] = {
                    ...prev, progress: progressPercentage, time: timestamp,
                    lastProgressValueAtChange: progressPercentage, lastProgressChangeTimestamp: timestamp,
                    reportedSpeed: 0, acceleration: 0, lastDisplayedSpeed: 0, lastDisplayedAcceleration: 0,
                    firstUpdate: false, currentLap: currentLap, progressInLap: progressInLap,
                    raceStartTime: timestamp, wasStale: false
                };
                return { speed: 0, acceleration: 0, timeDelta: dtSinceLastUpdate * 1000, noUpdate: true };
            }

            // REVISED: Stale data handling. If no update for a while, decay speed.
            if (dtSinceLastUpdate * 1000 > staleThresholdMs) {
                const decayFactor = 0.85;
                const decayedSpeed = prev.reportedSpeed * decayFactor;
                const gentleDeceleration = -0.5;
                prev.time = timestamp;
                prev.reportedSpeed = decayedSpeed;
                prev.acceleration = this.ema(gentleDeceleration, prev.acceleration, 0.1);
                prev.wasStale = true;
                return { speed: prev.reportedSpeed, acceleration: prev.acceleration, timeDelta: dtSinceLastUpdate * 1000, noUpdate: false };
            }

            if (dtSinceLastUpdate < minDt) {
                 return { speed: prev.reportedSpeed, acceleration: prev.acceleration, timeDelta: dtSinceLastUpdate * 1000, noUpdate: true };
            }

            let currentSpeed = prev.reportedSpeed;
            let calculatedSpeedThisTick = false;
            const epsilon = 0.001;
            const progressChanged = Math.abs(progressPercentage - prev.lastProgressValueAtChange) > epsilon;
            let distanceDelta = 0;

            if (progressChanged) {
                 const dtSinceChange = (timestamp - prev.lastProgressChangeTimestamp) / 1000;
                 const progressDeltaSinceChange = progressPercentage - prev.lastProgressValueAtChange;

                 if (dtSinceChange > 0 && progressDeltaSinceChange > 0) {
                    distanceDelta = State.trackInfo.total * (progressDeltaSinceChange / 100);
                    const rawSpeedMph = (distanceDelta / dtSinceChange) * 3600;

                    // REVISED: Use explicit EMA with faster catch-up after stale period
                    let speedAlpha = 1.0 - Config.get('speedSmoothingFactor');
                    if (prev.wasStale) speedAlpha = Math.min(0.9, speedAlpha * 2);
                    currentSpeed = this.ema(rawSpeedMph, prev.reportedSpeed, speedAlpha);

                    calculatedSpeedThisTick = true;
                    prev.lastProgressValueAtChange = progressPercentage;
                    prev.lastProgressChangeTimestamp = timestamp;
                 } else {
                    currentSpeed = prev.reportedSpeed * Math.max(0.1, 1.0 - (dtSinceChange * 0.5));
                 }
            }

            currentSpeed = Math.max(0, currentSpeed);
            const speedDeltaMps = (currentSpeed - prev.reportedSpeed) * 0.44704;
            const rawAcceleration = (dtSinceLastUpdate <= 0) ? 0 : (speedDeltaMps / dtSinceLastUpdate) / 9.81;

            // REVISED: Dual-stage smoothing. Apply a separate, gentle EMA to acceleration.
            const accelAlpha = 0.25; // More smoothing for acceleration
            let smoothedAcceleration = this.ema(rawAcceleration, prev.acceleration, accelAlpha);
            smoothedAcceleration = Math.max(-3.0, Math.min(3.0, smoothedAcceleration)); // Clamp to realistic values

            const totalLaps = State.trackInfo.laps || 1;
            const percentPerLap = 100 / totalLaps;
            const currentLap = Math.min(totalLaps, Math.floor(progressPercentage / percentPerLap) + 1);
            const startPercentOfLap = (currentLap - 1) * percentPerLap;
            const progressInLap = percentPerLap > 0 ? Math.max(0, Math.min(100, ((progressPercentage - startPercentOfLap) / percentPerLap) * 100)) : 0;

            const totalTimeElapsed = (timestamp - prev.raceStartTime) / 1000;
            const totalDistanceTraveled = (prev.totalDistanceTraveled || 0) + distanceDelta;

            State.previousMetrics[driverId] = {
                 ...prev,
                 progress: progressPercentage, time: timestamp,
                 reportedSpeed: currentSpeed, acceleration: smoothedAcceleration,
                 lastDisplayedSpeed: currentSpeed, lastDisplayedAcceleration: smoothedAcceleration,
                 currentLap, progressInLap,
                 totalTimeElapsed, totalDistanceTraveled,
                 wasStale: false
            };

            return {
                speed: currentSpeed, acceleration: smoothedAcceleration,
                timeDelta: dtSinceLastUpdate * 1000, noUpdate: !calculatedSpeedThisTick
            };
        },
        calculateSmoothedLapEstimate(driverId, metrics) {
            const driverState = State.previousMetrics[driverId];
            if (!driverState) return null;

            const now = Date.now();
            const samples = driverState.lapEstimateSpeedSamples ||= [];
            samples.push({ time: now, speed: Math.max(0, Number(metrics.speed) || 0) });

            const windowStart = now - this.lapEstimateSpeedWindowMs;
            while (samples.length > 1 && samples[1].time <= windowStart) {
                samples.shift();
            }
            if (samples.length && samples[0].time < windowStart) {
                samples[0] = { ...samples[0], time: windowStart };
            }
            if ((driverState.totalTimeElapsed || 0) < 5) return null;

            let speedDistance = 0;
            let sampledDuration = 0;
            for (let index = 1; index < samples.length; index++) {
                const duration = samples[index].time - samples[index - 1].time;
                if (duration > 0) {
                    speedDistance += samples[index - 1].speed * duration;
                    sampledDuration += duration;
                }
            }
            const baseSpeed = sampledDuration > 0 ? speedDistance / sampledDuration : metrics.speed;
            if (baseSpeed <= 1) return null;

            const lapLength = State.trackInfo.length || 0;
            if (lapLength <= 0) return null;

            const remainingProgressInLap = 100 - driverState.progressInLap;
            const remainingDistance = lapLength * (remainingProgressInLap / 100);
            const rawEstimate = (remainingDistance / baseSpeed) * 3600;
            driverState.rawLapEstimate = rawEstimate;

            const alpha = Config.get('lapEstimateSmoothingFactor');
            let smoothedEstimate = this.ema(rawEstimate, driverState.smoothedLapEstimate, alpha);

            if (smoothedEstimate > 3600 || smoothedEstimate < 0 || !isFinite(smoothedEstimate)) {
                smoothedEstimate = driverState.smoothedLapEstimate ?? rawEstimate;
            }

            driverState.smoothedLapEstimate = smoothedEstimate;
            return smoothedEstimate;
        },
        animateTelemetry(element, fromSpeed, toSpeed, fromAcc, toAcc, duration, displayMode, speedUnit) {
            let startTime = null;
            const easeFunction = this.easeInOutQuad;
            const getColor = this.getTelemetryColor.bind(this);

            fromSpeed = Number(fromSpeed) || 0;
            toSpeed = Number(toSpeed) || 0;
            fromAcc = Number(fromAcc) || 0;
            toAcc = Number(toAcc) || 0;
            duration = Math.max(Config.get('minUpdateInterval'), Math.min(Number(duration) || Config.get('minUpdateInterval'), Config.get('maxAnimationDurationMs')));

            function step(timestamp) {
                if (!startTime) startTime = timestamp;
                let linearProgress = Math.min((timestamp - startTime) / duration, 1);
                if (isNaN(linearProgress) || duration <= 0) linearProgress = 1;

                let progress = easeFunction(linearProgress);
                let currentSpeed = fromSpeed + (toSpeed - fromSpeed) * progress;
                let currentAcc = fromAcc + (toAcc - fromAcc) * progress;
                element._currentAnimSpeed = currentSpeed;
                element._currentAnimAcc = currentAcc;

                let color = Config.get('colorCode') ? getColor(currentAcc) : 'var(--telemetry-default-color)';
                let text = '';

                if (displayMode === 'speed') { text = `${Math.round(currentSpeed)} ${speedUnit}`; }
                else if (displayMode === 'acceleration') { text = `${currentAcc.toFixed(1)} g`; }
                else if (displayMode === 'both') { text = `${Math.round(currentSpeed)} ${speedUnit} | ${currentAcc.toFixed(1)} g`; }

                Telemetry.setTelemetryDisplay(element, text, color);

                if (linearProgress < 1) {
                    element._animationRAF = requestAnimationFrame(step);
                } else {
                    element._animationRAF = null;
                    let finalSpeedText = `${Math.round(toSpeed)} ${speedUnit}`;
                    let finalAccelText = `${toAcc.toFixed(1)} g`;
                    let finalText = '';
                    if (displayMode === 'speed') { finalText = finalSpeedText; }
                    else if (displayMode === 'acceleration') { finalText = finalAccelText; }
                    else if (displayMode === 'both') { finalText = `${finalSpeedText} | ${finalAccelText}`; }
                    Telemetry.setTelemetryDisplay(element, finalText, Config.get('colorCode') ? getColor(toAcc) : 'var(--telemetry-default-color)');
                    element._currentAnimSpeed = undefined;
                    element._currentAnimAcc = undefined;
                }
            }

            if (element._animationRAF) {
                cancelAnimationFrame(element._animationRAF);
            }
            element._animationRAF = requestAnimationFrame(step);
        },
    };
