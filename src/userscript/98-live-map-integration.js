    // Beta 10: The native Torn track stays LIVE and INLINE above the leaderboard.
    // No canvas reparenting, duplication, hiding, redraw, or iframe is involved.
    const LiveMapIntegration = {
        root: null,
        title: null,
        map: null,
        menu: null,
        button: null,
        infoButton: null,
        list: null,
        actions: [],
        documentClick: null,
        keyHandler: null,
        stylesInstalled: false,
        findNodes() {
            const root = document.getElementById('racingupdates');
            const map = root?.querySelector('.drivers-list .track-wrap');
            const title = root?.querySelector('.drivers-list > .title-black');
            if (!root || !map?.querySelector('#raceCanvas') || !title || !root.querySelector('#leaderBoard')) return null;
            return { root, map, title };
        },
        readActions() {
            if (!this.root) return [];
            if (typeof State !== 'undefined' && State.raceFinished) return [];
            if (/race\s+finished/i.test(this.root.querySelector?.('#infoSpot')?.textContent?.trim() || '')) return [];
            const card = this.root.querySelector('.car-selected-wrap > .car-selected');
            if (card?.querySelector('.title-black')?.textContent?.trim().toLowerCase() !== 'current car') return [];
            const linkWrap = card.querySelector?.('.model-wrap .link-wrap');
            if (linkWrap?.style?.display === 'none') return [];
            return [...card.querySelectorAll('.model-wrap .link-wrap a[href]')]
                .filter(node => /^(change car|leave this race)$/i.test(node.textContent.trim()))
                .map(anchor => ({ label: anchor.textContent.trim(), anchor }));
        },
        install() {
            this.disconnect();
            this.installStyles();
            this.sync();
        },
        sync() {
            const found = this.findNodes();
            if (!found) { this.clearMount(); return; }
            if (this.root !== found.root || this.title !== found.title || this.map !== found.map || !this.menu?.isConnected) {
                this.clearMount();
                this.root = found.root;
                this.title = found.title;
                this.map = found.map;
                this.root.classList.add('rtt-map-integrated');
                this.createMenu();
            }
            const next = this.readActions();
            const changed = next.length !== this.actions.length || next.some((item, index) =>
                item.anchor !== this.actions[index]?.anchor || item.label !== this.actions[index]?.label);
            if (changed) this.renderActions(next);
        },
        createMenu() {
            const menu = document.createElement('div');
            menu.className = 'rtt-track-actions';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'rtt-track-more';
            button.hidden = true; // The info icon is always available; ⋯ only with Torn actions.
            button.textContent = '⋯';
            button.title = 'Race actions';
            button.setAttribute('aria-label', 'Race actions: change car or leave race');
            button.setAttribute('aria-haspopup', 'true');
            button.setAttribute('aria-expanded', 'false');
            const list = document.createElement('div');
            list.className = 'rtt-track-action-list';
            list.id = 'rtt-track-action-list';
            list.setAttribute('role', 'menu');
            list.hidden = true;
            button.setAttribute('aria-controls', list.id);
            button.addEventListener('click', event => {
                event.stopPropagation();
                this.toggle(!this.isOpen());
            });
            const info = document.createElement('button');
            info.type = 'button';
            info.className = 'rtt-track-info-button';
            info.textContent = 'i';
            info.title = 'Track and race information';
            info.setAttribute('aria-label', 'Track and race information');
            info.setAttribute('aria-haspopup', 'dialog');
            info.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                this.toggle(false);
                RaceInfoIntegration.open(info);
            });
            menu.append(info, button, list);
            this.title.append(menu);
            this.menu = menu;
            this.button = button;
            this.infoButton = info;
            this.list = list;
            this.documentClick = event => {
                if (this.isOpen() && !this.menu?.contains(event.target)) this.toggle(false);
            };
            this.keyHandler = event => {
                if (event.key === 'Escape' && this.isOpen()) {
                    event.preventDefault();
                    this.toggle(false);
                    this.button?.focus();
                }
            };
            document.addEventListener('click', this.documentClick);
            document.addEventListener('keydown', this.keyHandler);
        },
        renderActions(actions) {
            this.actions = actions;
            if (!this.list || !this.menu) return;
            this.toggle(false);
            this.list.replaceChildren();
            for (const action of actions) {
                const entry = document.createElement('button');
                entry.type = 'button';
                entry.className = 'rtt-track-action' + (/leave/i.test(action.label) ? ' rtt-track-action-danger' : '');
                entry.setAttribute('role', 'menuitem');
                entry.textContent = action.label;
                entry.addEventListener('click', event => {
                    event.stopPropagation();
                    this.toggle(false);
                    const live = this.readActions().find(item => item.label === action.label) || action;
                    if (typeof RaceInfoIntegration !== 'undefined' && typeof RaceInfoIntegration.confirmAction === 'function') {
                        RaceInfoIntegration.confirmAction(live, this.button);
                    } else if (live?.anchor?.isConnected) {
                        live.anchor.click();
                    }
                });
                this.list.append(entry);
            }
            // The race info icon stays usable even without car actions.
            this.button.hidden = actions.length === 0;
        },
        isOpen() { return Boolean(this.list && !this.list.hidden); },
        toggle(open) {
            if (!this.list || !this.button) return;
            const show = Boolean(open && this.actions.length);
            this.list.hidden = !show;
            this.button.setAttribute('aria-expanded', String(show));
            this.menu?.classList.toggle('is-open', show);
        },
        hasActionMenu() { return Boolean(this.menu?.isConnected && this.actions.length); },
        hasInfoButton() { return Boolean(this.infoButton?.isConnected); },
        installStyles() {
            if (this.stylesInstalled) return;
            GM_addStyle(`
                /* One continuous racing card: track heading, live map, navigation, drivers. */
                #racingupdates.rtt-map-integrated .drivers-list > .title-black {
                    position: relative !important; box-sizing: border-box !important;
                    min-height: 42px; padding: 11px 92px 11px 12px !important;
                    background: #263440 !important; border: 1px solid #3c5060 !important;
                    border-bottom: 0 !important; border-radius: 10px 10px 0 0 !important;
                    color: #edf5fa !important; font-size: 13px !important;
                    line-height: 20px !important; white-space: normal !important;
                    overflow: visible !important; text-overflow: clip !important;
                    z-index: 4;
                }
                #racingupdates.rtt-map-integrated .drivers-list > .cont-black {
                    box-sizing: border-box !important; min-width: 0 !important;
                    width: 100% !important; padding: 0 !important;
                    background: #17222c !important;
                    border: 1px solid #3c5060 !important;
                    border-top: 0 !important; border-radius: 0 0 10px 10px !important;
                    overflow: visible !important;
                }
                #racingupdates.rtt-map-integrated .drivers-list .track-wrap {
                    box-sizing: border-box !important; position: relative !important;
                    float: none !important; display: block !important;
                    visibility: visible !important; pointer-events: auto !important;
                    width: 100% !important; min-width: 0 !important;
                    height: auto !important; margin: 0 !important; padding: 9px 9px 8px !important;
                    background: #17222c !important;
                }
                #racingupdates.rtt-map-integrated .drivers-list .tracks {
                    position: relative !important; display: block !important;
                    box-sizing: border-box !important; width: 100% !important;
                    max-width: 680px !important; height: auto !important;
                    aspect-ratio: 520 / 243; margin: 0 auto !important;
                    overflow: hidden !important; border-radius: 6px !important;
                    background: #101922 !important;
                }
                #racingupdates.rtt-map-integrated .drivers-list .tracks > .img-track,
                #racingupdates.rtt-map-integrated .drivers-list .tracks > #raceCanvas {
                    box-sizing: border-box !important; position: absolute !important;
                    top: 0 !important; left: 0 !important;
                    width: 100% !important; height: 100% !important;
                    max-width: none !important; margin: 0 !important;
                }
                #racingupdates.rtt-map-integrated .drivers-list .tracks > #raceCanvas {
                    touch-action: manipulation;
                }
                #racingupdates.rtt-map-integrated .drivers-list #racingdetails {
                    max-width: 75%; box-sizing: border-box !important;
                }
                /* The old native tooltip is replaced by an accessible button in
                   the same header. Its element and data attributes remain intact. */
                #racingupdates.rtt-map-integrated .drivers-list .track-info-wrap {
                    display: none !important;
                }
                .rtt-track-actions {
                    position: absolute; top: 5px; right: 6px;
                    z-index: 20; display: flex; align-items: center; gap: 7px;
                    font: 500 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                }
                .rtt-track-info-button {
                    display: flex; align-items: center; justify-content: center;
                    box-sizing: border-box; width: 32px; height: 32px; padding: 0;
                    cursor: pointer; border: 1px solid #4a6171; border-radius: 7px;
                    color: #d8e6ef; background: #334652;
                    font: italic bold 21px/1 Georgia,serif;
                    -webkit-tap-highlight-color: transparent;
                }
                .rtt-track-info-button:hover { color: #fff; border-color: #7999ac; background: #3d5363; }
                .rtt-track-info-button:focus-visible { outline: 2px solid #9cd2f5; outline-offset: 2px; }
                .rtt-track-actions[hidden], .rtt-track-more[hidden], .rtt-track-action-list[hidden] { display: none !important; }
                .rtt-track-more {
                    display: flex; align-items: center; justify-content: center;
                    width: 34px; height: 31px; padding: 0; cursor: pointer;
                    color: #d8e6ef; background: #334652; border: 1px solid #4a6171;
                    border-radius: 7px; font-size: 22px; line-height: 1;
                    -webkit-tap-highlight-color: transparent;
                }
                .rtt-track-more[aria-expanded="true"], .rtt-track-more:hover {
                    color: #fff; border-color: #7999ac; background: #3d5363;
                }
                .rtt-track-more:focus-visible, .rtt-track-action:focus-visible {
                    outline: 2px solid #9cd2f5; outline-offset: 2px;
                }
                .rtt-track-action-list {
                    position: absolute; top: calc(100% + 5px); right: 0;
                    z-index: 30; width: max-content; min-width: 172px;
                    max-width: min(280px, calc(100vw - 32px));
                    padding: 5px; border: 1px solid #4a6274; border-radius: 9px;
                    background: #233440; box-shadow: 0 10px 24px rgba(0,0,0,.45);
                }
                .rtt-track-action {
                    box-sizing: border-box; width: 100%; min-height: 40px;
                    display: flex; align-items: center; text-align: left;
                    cursor: pointer; border: 0; border-radius: 6px;
                    padding: 9px 11px; color: #e5f1f9; background: transparent;
                    font: 600 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                }
                .rtt-track-action:hover { background: #344c5e; }
                .rtt-track-action-danger { color: #ffc9c3; }
                .rtt-track-action-danger:hover { background: #553439; }
                @media (max-width: 600px) {
                    #racingupdates.rtt-map-integrated .drivers-list > .title-black {
                        font-size: 12px !important; padding: 10px 88px 10px 9px !important;
                    }
                    #racingupdates.rtt-map-integrated .drivers-list .track-wrap {
                        padding: 6px 6px 7px !important;
                    }
                    #racingupdates.rtt-map-integrated .drivers-list #racingdetails {
                        max-width: 80%; font-size: 10px;
                    }
                    .rtt-track-more, .rtt-track-info-button { min-width: 34px; min-height: 34px; }
                }
            `);
            this.stylesInstalled = true;
        },
        clearMount() {
            this.toggle(false);
            if (this.documentClick) document.removeEventListener('click', this.documentClick);
            if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler);
            this.documentClick = this.keyHandler = null;
            this.menu?.remove();
            this.root?.classList.remove('rtt-map-integrated');
            this.root = this.title = this.map = this.menu = this.button = this.infoButton = this.list = null;
            this.actions = [];
        },
        disconnect() { this.clearMount(); }
    };
