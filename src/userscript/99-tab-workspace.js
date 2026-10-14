    // All secondary controls are real tabs beneath the UNMOVED, continuously running
    // Torn race canvas. Keep the live leaderboard and the existing data views mounted
    // so switching tabs never recreates Torn's race or discards unsaved form inputs.
    const TabWorkspace = {
        host: null,
        controls: null,
        nativeLeaderboard: null,
        driverList: null,
        raceCard: null,
        panes: new Map(),
        buttons: new Map(),
        active: 'drivers',
        carSignature: '',
        dataSignatures: new Map(),
        stylesInstalled: false,
        labels: {
            drivers: 'Drivers', car: 'Car', info: 'Info', history: 'History',
            stats: 'Stats', export: 'Export', settings: 'Settings'
        },
        selectors: {
            car: '.telemetry-car-button', info: '.telemetry-info-button',
            history: '.telemetry-history-button', stats: '.telemetry-stats-button',
            export: '.telemetry-download-button', settings: '.telemetry-settings-button'
        },
        install() {
            this.disconnect();
            const controls = State.controlsContainer;
            const driverList = State.customUIContainer;
            const scrollbar = document.getElementById('drivers-scrollbar');
            const raceCard = controls?.closest('.drivers-list');
            if (!controls || !driverList || !scrollbar || !raceCard || !raceCard.contains(scrollbar)) return;
            this.installStyles();
            this.controls = controls;
            this.driverList = driverList;
            this.nativeLeaderboard = scrollbar;
            this.raceCard = raceCard;
            controls.setAttribute('role', 'tablist');
            controls.setAttribute('aria-label', 'Racing telemetry views');
            const driversButton = document.createElement('button');
            driversButton.type = 'button';
            driversButton.className = 'telemetry-drivers-button';
            driversButton.textContent = 'Drivers';
            driversButton.title = 'View live racing leaderboard';
            driversButton.addEventListener('click', () => this.activate('drivers'));
            controls.prepend(driversButton);

            const host = document.createElement('div');
            host.id = 'rtt-telemetry-workspace';
            host.className = 'rtt-telemetry-workspace';
            controls.after(host);
            this.host = host;
            for (const key of Object.keys(this.labels)) {
                const button = key === 'drivers' ? driversButton : controls.querySelector(this.selectors[key]);
                if (!button) continue;
                const pane = document.createElement('section');
                pane.className = 'rtt-telemetry-pane';
                pane.id = `rtt-telemetry-pane-${key}`;
                pane.dataset.view = key;
                pane.hidden = true;
                pane.setAttribute('role', 'tabpanel');
                pane.setAttribute('aria-labelledby', `rtt-telemetry-tab-${key}`);
                host.append(pane);
                button.id = `rtt-telemetry-tab-${key}`;
                button.type = 'button';
                button.setAttribute('role', 'tab');
                button.setAttribute('aria-controls', pane.id);
                button.setAttribute('aria-selected', 'false');
                button.tabIndex = -1;
                // UI owns the button click events; this module owns their layout and content.
                button.addEventListener('keydown', event => this.onTabKey(event, key));
                this.buttons.set(key, button);
                this.panes.set(key, pane);
            }
            // Keep the ORIGINAL Torn leaderboard DOM so race updates and click handlers
            // continue working. Both leaderboard alternatives belong to Drivers.
            this.panes.get('drivers').append(driverList, scrollbar);
            this.activate('drivers');
        },
        onTabKey(event, key) {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const keys = [...this.buttons.keys()].filter(name => this.isAvailable(name));
            const i = keys.indexOf(key);
            const next = event.key === 'Home' ? keys[0] : event.key === 'End' ? keys[keys.length - 1]
                : keys[(i + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length];
            if (next) {
                this.activate(next);
                this.buttons.get(next)?.focus();
            }
        },
        isAvailable(key) {
            if (key === 'drivers') return true;
            if (key === 'car' && RaceInfoIntegration.isRaceFinished()) return false;
            const button = this.buttons.get(key);
            return Boolean(button && !button.hidden && button.style.display !== 'none');
        },
        activate(key = 'drivers') {
            if (!this.host?.isConnected) return;
            if (!this.isAvailable(key)) key = 'drivers';
            this.active = key;
            for (const [name, pane] of this.panes) {
                const selected = name === key;
                pane.hidden = !selected;
                const button = this.buttons.get(name);
                if (button) {
                    button.setAttribute('aria-selected', String(selected));
                    button.tabIndex = selected ? 0 : -1;
                }
            }
            this.raceCard?.classList.toggle('rtt-tab-viewing-other', key !== 'drivers');
            this.renderView(key);
            this.buttons.get(key)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        },
        getDataSignature(key) {
            if (key === 'history') {
                return `${State.currentRaceId || ''}:${State.raceFinished ? 1 : 0}:${Config.get('historicalRaceLimit')}:${Boolean(Config.get('apiKey'))}`;
            }
            if (key === 'stats') {
                return `${State.currentRaceId || ''}:${State.trackInfo?.id || ''}:${State.currentRaceClass || ''}:${State.raceFinished ? 1 : 0}:${Config.get('historicalRaceLimit')}:${Boolean(Config.get('apiKey'))}`;
            }
            if (key === 'export') {
                return `${State.currentRaceId || ''}:${State.finalRaceData?.length || 0}`;
            }
            return 'static';
        },
        invalidateRaceBoundViews() {
            this.dataSignatures.delete('history');
            this.dataSignatures.delete('stats');
            this.dataSignatures.delete('export');
            for (const key of ['history', 'stats', 'export']) {
                const pane = this.panes.get(key);
                if (!pane) continue;
                if (this.active === key && this.isAvailable(key)) {
                    pane.replaceChildren();
                    this.renderView(key);
                } else {
                    pane.replaceChildren();
                }
            }
        },
        renderView(key) {
            const pane = this.panes.get(key);
            if (!pane || key === 'drivers') return;
            if (key === 'car') { this.renderCar(); return; }
            const sig = this.getDataSignature(key);
            if (pane.firstElementChild && !pane.querySelector?.('.rtt-tab-message')) {
                if (this.dataSignatures.get(key) === sig) return; // Preserve the mounted content across switches.
                pane.replaceChildren();
            }
            this.dataSignatures.set(key, sig);
            let task = null;
            let instance = null;
            try {
                switch (key) {
                    case 'info': UI.createInfoPanel(); instance = State.infoPanelInstance; break;
                    case 'history': task = UI.createHistoryPanel(); instance = State.historyPanelInstance; break;
                    case 'stats':
                        this.showMessage(pane, 'Loading advanced statistics…');
                        // Preserve the original ordering: resolve live track/class metadata
                        // before calculating track-specific historical statistics.
                        RaceManager.updateTrackAndClassInfo().then(() => {
                            if (!this.host?.contains(pane)) return;
                            const statsTask = UI.createAdvancedStatsPanel();
                            const statsPanel = State.advancedStatsPanelInstance;
                            this.dataSignatures.set('stats', this.getDataSignature('stats'));
                            if (statsPanel) {
                                statsPanel.classList.add('rtt-inline-tab-content');
                                statsPanel.removeAttribute('aria-modal');
                                pane.replaceChildren(statsPanel);
                            } else this.showMessage(pane, 'Advanced statistics are not available.');
                            if (statsTask?.catch) statsTask.catch(error => {
                                if (this.host?.contains(pane)) this.showMessage(pane, `Unable to load stats: ${error.message}`);
                            });
                        }).catch(error => {
                            if (this.host?.contains(pane)) this.showMessage(pane, `Unable to load stats: ${error.message}`);
                        });
                        return;
                    case 'settings': UI.createSettingsPopup(); instance = State.settingsPopupInstance; break;
                    case 'export': UI.createDownloadPopup(); instance = State.downloadPopupInstance; break;
                }
                if (instance) {
                    instance.classList.add('rtt-inline-tab-content');
                    instance.removeAttribute('aria-modal');
                    pane.append(instance);
                } else {
                    this.showMessage(pane, 'This view is not available.');
                }
                if (task?.catch) task.catch(error => {
                    if (this.host?.isConnected && pane.contains(instance)) {
                        this.showMessage(pane, `Unable to load ${this.labels[key].toLowerCase()}: ${error.message}`);
                    }
                });
            } catch (error) {
                this.showMessage(pane, `Unable to open ${this.labels[key].toLowerCase()}: ${error.message}`);
            }
        },
        renderCar() {
            const pane = this.panes.get('car');
            if (!pane || this.active !== 'car') return;
            const car = RaceInfoIntegration.readCar();
            if (!car) {
                this.carSignature = '';
                this.showMessage(pane, 'Your current car is not available for this race.');
                return;
            }
            const signature = JSON.stringify({name:car.name,category:car.category,image:car.imageSrc, stats:car.stats,
                links:car.links.map(link => [link.label, link.anchor.getAttribute('href')])});
            if (signature === this.carSignature && pane.querySelector('.rtt-tab-car-content')) return;
            this.carSignature = signature;
            const content = document.createElement('div');
            content.className = 'rtt-tab-car-content';
            const title = document.createElement('h3');
            title.className = 'rtt-tab-view-title';
            title.textContent = 'Current car';
            const body = document.createElement('div');
            body.className = 'rtt-tab-car-body';
            RaceInfoIntegration.renderCar(body, car);
            content.append(title, body);
            pane.replaceChildren(content);
        },
        refreshCar() {
            if (this.active === 'car') this.renderCar();
        },
        refreshVisibility() {
            if (!this.host?.isConnected) return;
            const carButton = this.buttons.get('car');
            if (carButton && RaceInfoIntegration.isRaceFinished()) {
                carButton.style.display = 'none';
                carButton.setAttribute('aria-hidden', 'true');
            }
            if (!this.isAvailable(this.active)) this.activate('drivers');
        },
        // The existing Save / Download controls close their former popup node after
        // acting. In inline mode, restore a fresh editable panel in the same tab.
        restoreAfterAction(key) {
            if (this.active !== key || !this.host?.isConnected) return;
            const pane = this.panes.get(key);
            if (!pane) return;
            this.dataSignatures.delete(key);
            pane.replaceChildren();
            this.renderView(key);
        },
        showMessage(pane, message) {
            const text = document.createElement('p');
            text.className = 'rtt-tab-message';
            text.textContent = message;
            pane.replaceChildren(text);
        },
        disconnect() {
            if (this.host && this.controls?.isConnected) {
                // Restore the original sibling order; no Torn element is discarded.
                if (this.driverList) this.host.before(this.driverList);
                if (this.nativeLeaderboard) this.host.before(this.nativeLeaderboard);
            }
            this.raceCard?.classList.remove('rtt-tab-viewing-other');
            this.controls?.removeAttribute('role');
            this.controls?.removeAttribute('aria-label');
            this.host?.remove();
            this.host = null;
            this.controls = null;
            this.driverList = null;
            this.nativeLeaderboard = null;
            this.raceCard = null;
            this.panes.clear();
            this.buttons.clear();
            this.dataSignatures.clear();
            this.active = 'drivers';
            this.carSignature = '';
        },
        installStyles() {
            if (this.stylesInstalled) return;
            GM_addStyle(`
                /* Integrated, scrollable tab bar directly under the always-live race map. */
                #racingupdates.rtt-map-integrated #telemetryControlsContainer[role="tablist"],
                #telemetryControlsContainer[role="tablist"] {
                    box-sizing: border-box !important; display: flex !important; flex-wrap: nowrap !important;
                    gap: 0 !important; width: 100% !important; max-width: 100% !important;
                    min-height: 43px; margin: 0 !important; padding: 0 5px !important;
                    background: #1c2b36 !important; border-top: 1px solid #384d5d !important;
                    border-bottom: 1px solid #384d5d !important;
                    overflow-x: auto !important; overflow-y: hidden !important;
                    scrollbar-width: none; -webkit-overflow-scrolling: touch;
                }
                #telemetryControlsContainer[role="tablist"]::-webkit-scrollbar { display: none; }
                #telemetryControlsContainer[role="tablist"] > button[role="tab"] {
                    box-sizing: border-box !important; flex: 0 0 auto !important;
                    min-width: 60px !important; width: auto !important; max-width: none !important;
                    min-height: 42px !important; margin: 0 !important; padding: 10px 12px 9px !important;
                    border: 0 !important; border-bottom: 2px solid transparent !important;
                    border-radius: 0 !important; background: transparent !important;
                    box-shadow: none !important; color: #9eafbd !important;
                    text-align: center !important; white-space: nowrap !important;
                    font: 600 12px/18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
                    cursor: pointer; -webkit-tap-highlight-color: transparent;
                }
                #telemetryControlsContainer[role="tablist"] > button[aria-selected="true"] {
                    color: #e8f5ff !important; border-bottom-color: #67bce9 !important;
                    background: #263947 !important;
                }
                #telemetryControlsContainer[role="tablist"] > button[role="tab"]:focus-visible {
                    outline: 2px solid #80d2ff !important; outline-offset: -3px;
                }
                #telemetryControlsContainer[role="tablist"] > button[role="tab"]:hover {
                    color: #ecf7fe !important; background: #263947 !important;
                }
                #telemetryControlsContainer[role="tablist"] > button[role="tab"][style*="display: none"] { display: none !important; }
                #rtt-telemetry-workspace {
                    box-sizing: border-box; width: 100%; margin: 0 !important; padding: 0 !important;
                    min-width: 0; background: #17222c; color: #e1edf4;
                    font: 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                #rtt-telemetry-workspace > .rtt-telemetry-pane { min-width: 0; width: 100%; box-sizing: border-box; padding: 0; }
                #rtt-telemetry-workspace > .rtt-telemetry-pane[hidden] { display: none !important; }
                #rtt-telemetry-pane-drivers > #custom-driver-list-container {
                    margin: 0 !important; border: 0 !important; border-radius: 0 !important;
                    background: #17222c !important; max-height: none !important;
                }
                #rtt-telemetry-pane-drivers > #drivers-scrollbar { margin: 0 !important; }
                #rtt-telemetry-workspace .rtt-tab-view-title { display: block !important; position: static !important;
                    height: auto !important; font-size: 15px !important; font-weight: 700 !important;
                    margin: 0 0 12px !important; padding: 0 !important; border: 0 !important;
                    background: none !important; color: #eaf5fd !important; line-height: 1.3 !important; }
                #rtt-telemetry-workspace .rtt-tab-car-content { padding: 14px; }
                #rtt-telemetry-workspace .rtt-tab-car-body { min-width: 0; }
                #rtt-telemetry-workspace .rtt-tab-message { margin: 0; padding: 18px 14px; color: #acc2d0; }
                /* The existing panel generators now mount as DOCUMENT FLOW content,
                   not darkening/full-screen popups. Their interactive contents survive. */
                #rtt-telemetry-workspace .rtt-inline-tab-content {
                    box-sizing: border-box !important; display: block !important;
                    position: static !important; inset: auto !important; width: 100% !important;
                    height: auto !important; min-height: 0 !important; max-height: none !important;
                    margin: 0 !important; padding: 0 !important; overflow: visible !important;
                    background: transparent !important; box-shadow: none !important;
                    border: 0 !important; border-radius: 0 !important;
                    backdrop-filter: none !important; z-index: auto !important;
                }
                #rtt-telemetry-workspace .rtt-inline-tab-content > :is(.settings-popup-content,
                    .stats-panel-content, .history-panel-content, .info-panel-content, .download-popup-content) {
                    box-sizing: border-box !important; display: block !important;
                    position: static !important; width: 100% !important; min-width: 0 !important;
                    max-width: none !important; height: auto !important; max-height: none !important;
                    margin: 0 !important; padding: 13px !important;
                    border: 0 !important; border-radius: 0 !important;
                    background: transparent !important; box-shadow: none !important;
                    overflow: visible !important; flex: auto !important;
                }
                #rtt-telemetry-workspace :is(.settings-close,.stats-close,.history-close,.info-close,.download-close) { display: none !important; }
                #rtt-telemetry-workspace :is(.stats-content,.history-content,.settings-content,.download-content,.info-content) {
                    max-width: 100% !important; min-width: 0 !important;
                }
                #rtt-telemetry-workspace :is(.stats-content,.history-content) { overflow-x: auto !important; }
                #rtt-telemetry-workspace :is(.stats-content,.history-content) table { width: 100%; }
                @media (max-width: 480px) {
                    #telemetryControlsContainer[role="tablist"] > button[role="tab"] {
                        min-width: 57px !important; padding: 9px 11px !important; font-size: 12px !important;
                    }
                    #rtt-telemetry-workspace .rtt-inline-tab-content > :is(.settings-popup-content,
                        .stats-panel-content,.history-panel-content,.info-panel-content,.download-popup-content) { padding: 12px !important; }
                }
            `);
            this.stylesInstalled = true;
        }
    };
