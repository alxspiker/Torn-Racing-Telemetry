    // Consolidate Torn's post-race information and live Current car card into menu sheets.
    // Keep native content mounted for Torn handlers; hide it only after reliable capture.
    const RaceInfoIntegration = {
        observer: null,
        root: null,
        panel: null,
        closeKeyHandler: null,
        frame: null,
        restoreFocus: null,
        styleInstalled: false,
        actionUrls: {
            changeCar: 'https://www.torn.com/page.php?sid=racing&tab=cars&section=changeRacingCar',
            leaveRace: 'https://www.torn.com/page.php?sid=racing&tab=customrace&section=leaveCurrentRace&step=leaveCurrentRace'
        },
        resolveActionUrl(label, fallbackHref = '') {
            if (/leave/i.test(label)) return this.actionUrls.leaveRace;
            if (/change\s+car/i.test(label)) return this.actionUrls.changeCar;
            return fallbackHref || '';
        },
        labels: {
            'ID': 'Race ID', 'Name': 'Name', 'Type': 'Type', 'Time created': 'Created',
            'Time started': 'Started', 'Time ended': 'Finished', 'Track': 'Track',
            'Laps': 'Laps', 'Participants': 'Participants', 'Drivers required': 'Minimum drivers',
            'Maximum Drivers': 'Maximum drivers', 'Cars allowed': 'Cars allowed',
            'Upgrades allowed': 'Upgrades allowed', 'Bet amount': 'Bet amount'
        },
        readNative(root = document) {
            const wrap = root.querySelector('.car-selected-wrap');
            const card = wrap?.querySelector(':scope > .car-selected');
            if (!card || card.querySelector('.title-black')?.textContent?.trim().toLowerCase() !== 'race info') {
                return null;
            }
            const fields = [];
            for (const node of card.querySelectorAll('.properties-wrap > li .properties > .title')) {
                const match = node.textContent.trim().match(/^([^:]+):\s*(.*)$/s);
                if (!match) continue;
                const label = this.labels[match[1].trim()];
                const value = match[2].trim();
                if (label && value) fields.push({ label, value });
            }
            // Don't remove Torn's panel unless enough information was actually captured.
            if (fields.length < 3 || !fields.some(field => field.label === 'Race ID')) return null;
            return { wrap, fields };
        },
        isRaceFinished(root = document) {
            if (typeof State !== 'undefined' && State.raceFinished) return true;
            const status = root?.querySelector?.('#infoSpot')?.textContent?.trim() || '';
            if (/race\s+finished/i.test(status)) return true;
            const card = root?.querySelector?.('.car-selected-wrap > .car-selected');
            const title = card?.querySelector?.('.title-black')?.textContent?.trim().toLowerCase();
            if (title === 'race info') return true;
            // Torn hides these actions when the race ends, before replacing the car card.
            return title === 'current car' && card.querySelector?.('.model-wrap .link-wrap')?.style?.display === 'none';
        },
        readCar(root = document) {
            const wrap = root.querySelector('.car-selected-wrap');
            const card = wrap?.querySelector(':scope > .car-selected');
            if (!card || card.querySelector('.title-black')?.textContent?.trim().toLowerCase() !== 'current car') return null;
            // When a race finishes in-place via WebSocket, Torn keeps the old Current car DOM
            // node until a page refresh, but hides .link-wrap (display: none) and sets
            // #infoSpot to "Race finished". Hide the Car tab once the race has finished.
            if (this.isRaceFinished(root)) return null;
            const image = card.querySelector('.model-wrap .img img');
            const model = card.querySelector('.model-wrap .model');
            const lines = [...(model?.querySelectorAll?.('p') || [])].map(node => node.textContent.trim()).filter(Boolean);
            const stats = [];
            for (const row of card.querySelectorAll('.properties-wrap > li')) {
                const name = row.querySelector?.('.properties > .title')?.textContent?.trim();
                const bar = row.querySelector?.('.properties .bar-tpl-wrap');
                const track = row.querySelector?.('.progressbar-bg');
                const totalBar = track?.querySelector(':scope > .progressbar');
                const originalBar = totalBar?.querySelector(':scope > .progressbar');
                const tooltip = row.querySelector?.('.progressbar-wrap')?.getAttribute('title')?.trim() || '';
                if (!name || !totalBar) continue;
                const percent = Number.parseFloat(totalBar.style.width);
                const baseline = Number.parseFloat(originalBar?.style?.width);
                stats.push({
                    name, tooltip,
                    percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0,
                    baseline: Number.isFinite(baseline) ? Math.max(0, Math.min(100, baseline)) : 0,
                    negative: Boolean(bar?.classList.contains('negative'))
                });
            }
            // Do not hide actionable Torn content until a useful car view is available.
            if (!lines[0] || !image || stats.length < 3) return null;
            const linkWrap = card.querySelector?.('.model-wrap .link-wrap');
            const linksHidden = linkWrap?.style?.display === 'none';
            const links = linksHidden ? [] : [...card.querySelectorAll('.model-wrap .link-wrap a[href]')]
                .filter(anchor => /leave this race|change car/i.test(anchor.textContent.trim()))
                .map(anchor => ({ anchor, label: anchor.textContent.trim() }));
            return { wrap, name: lines[0], category: lines.slice(1).join(' · '), imageSrc: image.getAttribute('src'), imageAlt: image.getAttribute('alt') || lines[0], stats, links };
        },
        readLive(root = document) {
            const title = root.querySelector('.drivers-list > .title-black')?.textContent?.trim() || '';
            const trackName = title.split(/\s+-\s+\d+\s+laps\b/i)[0].trim();
            const laps = title.match(/\b(\d+)\s+laps\b/i)?.[1];
            const raceId = typeof RaceManager !== 'undefined' ? RaceManager.getRaceId() : null;
            const status = root.querySelector('#infoSpot')?.textContent?.trim();
            const entrants = root.querySelectorAll('#leaderBoard > li').length;
            const length = root.querySelector('.track-info')?.getAttribute('data-length');
            const fields = [];
            if (raceId) fields.push({ label: 'Race ID', value: String(raceId) });
            if (trackName) fields.push({ label: 'Track', value: trackName });
            if (laps) fields.push({ label: 'Laps', value: laps });
            if (entrants) fields.push({ label: 'Participants', value: String(entrants) });
            if (length) fields.push({ label: 'Track length', value: length });
            if (status) fields.push({ label: 'Status', value: status });
            return fields;
        },
        readTrack(root = document) {
            // Torn provides a track-specific description in the native map info icon,
            // even before the race starts. Read it live rather than caching a track.
            const node = root.querySelector('.drivers-list .track-info');
            if (!node) return null;
            const name = node.getAttribute('title')?.trim() || '';
            const length = node.getAttribute('data-length')?.trim() || '';
            const description = node.getAttribute('data-desc')?.trim() || '';
            return { name, length, description };
        },
        getFields(root = document) {
            const native = this.readNative(root);
            const fields = native ? [...native.fields] : this.readLive(root);
            const track = this.readTrack(root);
            if (track) {
                if (track.name && !fields.some(item => item.label === 'Track'))
                    fields.unshift({ label: 'Track', value: track.name });
                if (track.length && !fields.some(item => item.label === 'Track length'))
                    fields.push({ label: 'Track length', value: track.length });
                if (track.description)
                    fields.push({ label: 'Track description', value: track.description });
            }
            return fields;
        },
        sync() {
            if (!this.root || !this.root.isConnected) return;
            const native = this.readNative(this.root);
            const car = this.readCar(this.root);
            const wrap = this.root.querySelector('.car-selected-wrap');
            const canOpenRace = typeof LiveMapIntegration !== 'undefined' && LiveMapIntegration.hasInfoButton();
            const carButton = State.controlsContainer?.querySelector('.telemetry-car-button');
            if (carButton) {
                carButton.style.display = car ? 'inline-block' : 'none';
                carButton.setAttribute('aria-hidden', car ? 'false' : 'true');
            }
            // Suppress Torn's card when its replacement menu is available, or when a race has
            // finished in-place and Torn hasn't swapped the stale .car-selected card yet.
            const finishedStaleCar = !native && !car && this.isRaceFinished(this.root)
                && wrap?.querySelector?.(':scope > .car-selected .title-black')?.textContent?.trim().toLowerCase() === 'current car';
            if (wrap) wrap.classList.toggle('rtt-race-info-integrated', Boolean((native && canOpenRace) || (car && carButton) || (finishedStaleCar && canOpenRace)));
            if (typeof LiveMapIntegration !== 'undefined') LiveMapIntegration.sync();
            if (typeof TabWorkspace !== 'undefined') { TabWorkspace.refreshVisibility(); TabWorkspace.refreshCar(); }
        },
        install() {
            this.disconnect();
            this.root = document.getElementById('racingupdates');
            if (!this.root) return;
            if (!this.styleInstalled) {
                GM_addStyle(`
                    .rtt-race-info-integrated > .car-selected { display: none !important; }
                    .rtt-race-info-integrated > hr.delimiter-999 { display: none !important; }
                    .rtt-race-info-integrated > .drivers-list {
                        float: none !important; width: 100% !important; max-width: 100% !important;
                        margin: 0 !important; box-sizing: border-box;
                    }
                    #telemetryControlsContainer > .telemetry-car-button {
                        box-sizing: border-box; flex: 1 1 0 !important; min-width: 0 !important;
                        max-width: none !important; width: 0; min-height: 34px;
                        padding: 6px 2px; margin: 0; border: 1px solid transparent;
                        border-radius: 6px; background: transparent; box-shadow: none;
                        color: #9aafbd; text-align: center; white-space: nowrap;
                        font: 500 11px/1.25 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        -webkit-tap-highlight-color: transparent; transition: none;
                    }
                    #telemetryControlsContainer > .telemetry-car-button:focus-visible { outline: 2px solid #83b9dc; outline-offset: 1px; }
                    @media (hover: hover) and (pointer: fine) {
                        #telemetryControlsContainer > .telemetry-car-button:hover { color: #e2eff8; background: #293744; border-color: #405260; }
                    }
                    @media (hover: none), (pointer: coarse) {
                        #telemetryControlsContainer > .telemetry-car-button:hover,
                        #telemetryControlsContainer > .telemetry-car-button:active { color: #9aafbd; background: transparent; box-shadow: none; }
                    }
                    .rtt-race-info-content { width: min(100%, 580px); }
                    .rtt-car-heading { display: flex; align-items: center; gap: 12px; padding: 12px;
                        border: 1px solid #354958; border-radius: 11px; background: #202b36; margin-bottom: 12px; }
                    .rtt-car-image { display: block; width: 100px; height: 55px; object-fit: contain; flex: 0 0 100px; }
                    .rtt-car-name { font-size: 17px; font-weight: 700; color: #ecf4fa; line-height: 1.25; }
                    .rtt-car-category { margin-top: 4px; font-size: 12px; color: #9cb3c3; }
                    .rtt-car-stat { margin-bottom: 12px; }
                    .rtt-car-stat-top { display: flex; align-items: baseline; justify-content: space-between;
                        gap: 8px; margin-bottom: 5px; font-size: 12px; color: #dbe8f2; }
                    .rtt-car-stat-top strong { text-align: right; font-size: 11px; font-weight: 600; color: #bed4e2; }
                    .rtt-car-track { position: relative; height: 9px; border-radius: 6px; overflow: hidden;
                        background: #101923; border: 1px solid #3a4754; }
                    .rtt-car-track > .rtt-car-total { position: absolute; inset: 0 auto 0 0;
                        background: #6db579; border-radius: 5px; }
                    .rtt-car-track.negative > .rtt-car-total { background: #cf6863; }
                    .rtt-car-track > .rtt-car-baseline { position: absolute; top: 0; bottom: 0; left: 0;
                        background: rgba(226, 238, 247, .52); border-right: 1px solid #f0f7fa; }
                    .rtt-car-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
                    .rtt-car-actions > a.rtt-car-action { display: inline-flex; align-items: center; justify-content: center;
                        min-height: 42px; flex: 1 1 135px; box-sizing: border-box; padding: 9px 12px;
                        border: 1px solid #476074; border-radius: 9px; background: #283c4b;
                        text-decoration: none !important; color: #e6f4fd !important;
                        text-align: center; font: 600 12px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                    .rtt-car-actions > a.rtt-car-action.leave,
                    .rtt-car-actions > button.rtt-car-action.leave { border-color: #765254; background: #462c30; color: #ffe2df !important; }
                    .rtt-car-actions > button.rtt-car-action { display: inline-flex; align-items: center; justify-content: center;
                        min-height: 42px; flex: 1 1 135px; box-sizing: border-box; padding: 9px 12px;
                        border: 1px solid #476074; border-radius: 9px; background: #283c4b; cursor: pointer;
                        color: #e6f4fd !important; text-align: center;
                        font: 600 12px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                    .rtt-confirm-message { margin: 0 0 14px; font-size: 13px; line-height: 1.55; color: #dbe8f2; }
                    .rtt-car-action:focus-visible { outline: 2px solid #95caee; outline-offset: 2px; }
                    @media (hover: hover) and (pointer: fine) {
                        .rtt-car-action:hover { filter: brightness(1.14); }
                    }
                    @media (hover: none), (pointer: coarse) {
                        .rtt-car-action:hover, .rtt-car-action:active { filter: none; }
                    }
                    .rtt-race-info-intro { font-size: 12px; color: #a6bac9; margin: 0 0 13px; }
                    .rtt-race-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
                    .rtt-race-info-cell { min-width: 0; padding: 10px 12px; background: #202b36; border: 1px solid #354958; border-radius: 9px; }
                    .rtt-race-info-key { display: block; color: #9db2c2; font-size: 10px; line-height: 1.4; }
                    .rtt-race-info-value { display: block; color: #edf4fa; font-size: 13px; line-height: 1.4; font-weight: 650; overflow-wrap: anywhere; margin-top: 3px; }
                    .rtt-race-info-cell.wide { grid-column: 1 / -1; }
                    .rtt-race-info-cell.track-description { padding: 13px 14px; background: #1b303e; }
                    .rtt-race-info-cell.track-description .rtt-race-info-value {
                        font-size: 13px; line-height: 1.6; font-weight: 400;
                        color: #d8e6f0; overflow-wrap: break-word;
                    }
                    @media (max-width: 600px) {
                        .rtt-race-info-grid { gap: 6px; }
                        .rtt-race-info-cell { padding: 9px 10px; }
                        .rtt-race-info-value { font-size: 12px; }
                    }
                `);
                this.styleInstalled = true;
            }
            this.sync();
            // Torn swaps the entire race-details block when a race finishes.
            this.observer = new MutationObserver(() => {
                if (this.frame !== null) return;
                this.frame = requestAnimationFrame(() => { this.frame = null; this.sync(); });
            });
            this.observer.observe(this.root, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['style', 'class'] });
        },
        executeConfirmedAction(action) {
            if (!action) return;
            const label = action.label || '';
            const liveCar = this.readCar();
            const liveAnchor = liveCar?.links?.find(item => item.label.toLowerCase() === label.toLowerCase())?.anchor
                || (action.anchor?.isConnected ? action.anchor : null);

            if (liveAnchor) {
                // Temporarily remove 'need-confirmation' from Torn's native anchor inside
                // #racingMainContainer so Torn's delegated .btn-action-tab AJAX handler
                // executes the XHR action (with rfcv token) immediately instead of asking
                // for confirmation inside the hidden .car-selected card.
                const hadConfirmation = liveAnchor.classList?.contains?.('need-confirmation');
                if (hadConfirmation) liveAnchor.classList.remove('need-confirmation');
                try {
                    const $ = typeof window !== 'undefined' ? (window.jQuery || window.$) : null;
                    if ($?.fn?.jquery) {
                        $(liveAnchor).trigger('click');
                    } else {
                        liveAnchor.click();
                    }
                } finally {
                    if (hadConfirmation && liveAnchor.isConnected) {
                        setTimeout(() => liveAnchor.classList?.add?.('need-confirmation'), 0);
                    }
                }
                return;
            }

            // Fallback if native anchor is no longer in the DOM: inject a temporary
            // .btn-action-tab anchor inside #racingMainContainer and trigger it.
            const targetUrl = this.resolveActionUrl(label, action.anchor?.href);
            const relativeHref = targetUrl.replace(/^https?:\/\/[^/]+/i, '');
            const container = document.getElementById('racingMainContainer') || this.root || document.body;
            if (container && relativeHref) {
                const tempAnchor = document.createElement('a');
                tempAnchor.className = 'link btn-action-tab';
                tempAnchor.href = relativeHref;
                tempAnchor.style.display = 'none';
                container.append(tempAnchor);
                try {
                    const $ = typeof window !== 'undefined' ? (window.jQuery || window.$) : null;
                    if ($?.fn?.jquery) {
                        $(tempAnchor).trigger('click');
                    } else {
                        tempAnchor.click();
                    }
                } finally {
                    setTimeout(() => tempAnchor.remove(), 0);
                }
            }
        },
        confirmAction(action, trigger = null) {
            if (!action) return;
            const isLeave = /leave/i.test(action.label);
            const targetUrl = this.resolveActionUrl(action.label, action.anchor?.href);
            // In synthetic unit tests where document.body is not mounted, execute immediately.
            if (typeof document === 'undefined' || !document.body?.append) {
                this.executeConfirmedAction(action);
                return;
            }
            this.close();
            const popup = document.createElement('div');
            popup.className = 'info-panel rtt-race-info-panel rtt-confirm-panel';
            popup.setAttribute('role', 'presentation');
            const content = document.createElement('div');
            content.className = 'info-panel-content rtt-race-info-content';
            content.setAttribute('role', 'dialog');
            content.setAttribute('aria-modal', 'true');
            const title = document.createElement('div');
            title.className = 'info-title';
            title.textContent = isLeave ? 'Leave this race?' : 'Change car?';
            title.id = 'rtt-confirm-action-title';
            content.setAttribute('aria-labelledby', title.id);
            const close = document.createElement('button');
            close.className = 'info-close';
            close.type = 'button';
            close.textContent = '×';
            close.setAttribute('aria-label', 'Cancel');
            close.addEventListener('click', () => this.close());
            title.append(close);

            const body = document.createElement('div');
            body.className = 'info-content';
            const msg = document.createElement('p');
            msg.className = 'rtt-confirm-message';
            msg.textContent = isLeave
                ? 'Are you sure you want to leave your current race?'
                : 'Are you sure you want to leave the track view and change your racing car?';
            const actions = document.createElement('div');
            actions.className = 'rtt-car-actions';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'rtt-car-action';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', () => this.close());

            const confirmLink = document.createElement('a');
            confirmLink.className = 'rtt-car-action' + (isLeave ? ' leave' : '');
            confirmLink.textContent = isLeave ? 'Yes, Leave Race' : 'Yes, Change Car';
            confirmLink.href = targetUrl;
            confirmLink.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                this.close();
                this.executeConfirmedAction(action);
            });

            actions.append(cancelBtn, confirmLink);
            body.append(msg, actions);
            content.append(title, body);
            popup.append(content);
            popup.addEventListener('click', event => { if (event.target === popup) this.close(); });
            this.panel = popup;
            this.restoreFocus = trigger || document.activeElement;
            this.closeKeyHandler = event => {
                if (event.key === 'Escape') { event.preventDefault(); this.close(); }
            };
            document.addEventListener('keydown', this.closeKeyHandler);
            // Mount inside #racingMainContainer when available so Torn's delegated listeners remain in scope.
            const mountTarget = document.getElementById('racingMainContainer') || document.body;
            mountTarget.append(popup);
            confirmLink.focus?.();
        },
        open(trigger, mode = 'race') {
            this.close();
            const car = mode === 'car' ? this.readCar() : null;
            if (mode === 'car' && !car) return;
            const fields = mode === 'race' ? this.getFields() : [];
            const popup = document.createElement('div');
            popup.className = 'info-panel rtt-race-info-panel';
            popup.setAttribute('role', 'presentation');
            const content = document.createElement('div');
            content.className = 'info-panel-content rtt-race-info-content';
            content.setAttribute('role', 'dialog');
            content.setAttribute('aria-modal', 'true');
            const title = document.createElement('div');
            title.className = 'info-title';
            title.textContent = mode === 'car' ? 'Current car' : 'Race information';
            title.id = mode === 'car' ? 'rtt-car-info-title' : 'rtt-race-info-title';
            content.setAttribute('aria-labelledby', title.id);
            const close = document.createElement('button');
            close.className = 'info-close';
            close.type = 'button';
            close.textContent = '×';
            close.setAttribute('aria-label', mode === 'car' ? 'Close current car' : 'Close race information');
            close.addEventListener('click', () => this.close());
            title.append(close);
            const body = document.createElement('div');
            body.className = 'info-content';
            const intro = document.createElement('p');
            intro.className = 'rtt-race-info-intro';
            intro.textContent = this.readNative() ? 'Official race and track information from Torn.' : 'Track information and current race details from Torn. Full event details appear after the race finishes.';
            if (mode === 'car') {
                this.renderCar(body, car);
            } else {
                body.append(intro);
            }
            if (mode === 'race' && fields.length) {
                const grid = document.createElement('div');
                grid.className = 'rtt-race-info-grid';
                for (const field of fields) {
                    const cell = document.createElement('div');
                    cell.className = 'rtt-race-info-cell';
                    if (field.value.length > 34 || field.label === 'Track description') cell.classList.add('wide');
                    if (field.label === 'Track description') cell.classList.add('track-description');
                    const key = document.createElement('span');
                    key.className = 'rtt-race-info-key';
                    key.textContent = field.label;
                    const value = document.createElement('span');
                    value.className = 'rtt-race-info-value';
                    value.textContent = field.value;
                    cell.append(key, value);
                    grid.append(cell);
                }
                body.append(grid);
            } else if (mode === 'race') {
                const msg = document.createElement('p');
                msg.textContent = 'Race details are not available yet.';
                body.append(msg);
            }
            content.append(title, body);
            popup.append(content);
            popup.addEventListener('click', event => { if (event.target === popup) this.close(); });
            this.panel = popup;
            this.restoreFocus = trigger || document.activeElement;
            this.closeKeyHandler = event => {
                if (event.key === 'Escape') { event.preventDefault(); this.close(); }
            };
            document.addEventListener('keydown', this.closeKeyHandler);
            document.body.append(popup);
            close.focus();
        },
        renderCar(body, car) {
            const heading = document.createElement('div');
            heading.className = 'rtt-car-heading';
            const image = document.createElement('img');
            image.className = 'rtt-car-image';
            image.src = car.imageSrc;
            image.alt = car.imageAlt;
            const details = document.createElement('div');
            const name = document.createElement('div');
            name.className = 'rtt-car-name';
            name.textContent = car.name;
            details.append(name);
            if (car.category) {
                const category = document.createElement('div');
                category.className = 'rtt-car-category';
                category.textContent = car.category;
                details.append(category);
            }
            heading.append(image, details);
            body.append(heading);
            for (const stat of car.stats) {
                const row = document.createElement('div');
                row.className = 'rtt-car-stat';
                const top = document.createElement('div');
                top.className = 'rtt-car-stat-top';
                const label = document.createElement('span');
                label.textContent = stat.name;
                const value = document.createElement('strong');
                value.textContent = stat.tooltip || `${stat.percent.toFixed(1)}%`;
                top.append(label, value);
                const track = document.createElement('div');
                track.className = 'rtt-car-track';
                if (stat.negative) track.classList.add('negative');
                track.setAttribute('role', 'img');
                track.setAttribute('aria-label', `${stat.name}: ${value.textContent}`);
                const total = document.createElement('span');
                total.className = 'rtt-car-total';
                total.style.width = `${stat.percent}%`;
                const baseline = document.createElement('span');
                baseline.className = 'rtt-car-baseline';
                baseline.style.width = `${stat.percent * stat.baseline / 100}%`;
                track.append(total, baseline);
                row.append(top, track);
                body.append(row);
            }
            // Expose Change Car / Leave this race in the Car tab as well as the LiveMapIntegration.hasActionMenu() overflow.
            if (car.links.length) {
                const actions = document.createElement('div');
                actions.className = 'rtt-car-actions';
                for (const action of car.links) {
                    const link = document.createElement('a');
                    link.className = 'rtt-car-action' + (/leave/i.test(action.label) ? ' leave' : '');
                    link.textContent = action.label;
                    // Preserve Torn's current URL and link classes, or use the direct action URL when navigating.
                    link.href = action.anchor.href;
                    link.dataset && (link.dataset.targetUrl = this.resolveActionUrl(action.label, action.anchor.href));
                    for (const cls of action.anchor.classList) {
                        if (cls === 'need-confirmation' || cls === 'btn-action-tab') link.classList.add(cls);
                    }
                    actions.append(link);
                }
                actions.addEventListener?.('click', event => {
                    const clicked = event.target?.closest?.('a.rtt-car-action');
                    if (!clicked) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const matched = car.links.find(item => item.label === clicked.textContent.trim()) || {
                        label: clicked.textContent.trim(),
                        anchor: clicked
                    };
                    this.confirmAction(matched, clicked);
                });
                body.append(actions);
            }
        },
        close() {
            this.panel?.remove();
            this.panel = null;
            if (this.closeKeyHandler) document.removeEventListener('keydown', this.closeKeyHandler);
            this.closeKeyHandler = null;
            if (this.restoreFocus?.isConnected) this.restoreFocus.focus();
            this.restoreFocus = null;
        },
        disconnect() {
            this.observer?.disconnect();
            this.observer = null;
            if (this.frame !== null) cancelAnimationFrame(this.frame);
            this.frame = null;
            this.root?.querySelector('.rtt-race-info-integrated')?.classList.remove('rtt-race-info-integrated');
            this.root = null;
            this.close();
        }
    };
