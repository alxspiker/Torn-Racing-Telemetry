    const ThemeManager = {
        observer: null,
        mediaQueryList: null,
        mediaQueryHandler: null,
        applyRafId: null,
        stylesInjected: false,
        defaults: {
            text: [224, 224, 224],
            background: [26, 26, 26],
            accent: [100, 181, 246]
        },

        initialize() {
            if (!this.stylesInjected) {
                GM_addStyle(TELEMETRY_STYLE_TEXT);
                this.stylesInjected = true;
            }

            this.applyTheme();
            this.observeThemeChanges();
        },
        disconnect() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            if (this.mediaQueryList && this.mediaQueryHandler) {
                this.mediaQueryList.removeEventListener('change', this.mediaQueryHandler);
            }
            this.mediaQueryList = null;
            this.mediaQueryHandler = null;
            if (this.applyRafId) {
                cancelAnimationFrame(this.applyRafId);
                this.applyRafId = null;
            }
        },
        observeThemeChanges() {
            if (!document.body || this.observer) {
                return;
            }

            this.observer = new MutationObserver(() => this.scheduleApplyTheme());
            const observerConfig = { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] };
            this.observer.observe(document.documentElement, observerConfig);
            this.observer.observe(document.body, observerConfig);

            if (!this.mediaQueryList && typeof window.matchMedia === 'function') {
                this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
                this.mediaQueryHandler = () => this.scheduleApplyTheme();
                this.mediaQueryList.addEventListener('change', this.mediaQueryHandler);
            }
        },
        scheduleApplyTheme() {
            if (this.applyRafId) {
                cancelAnimationFrame(this.applyRafId);
            }
            this.applyRafId = requestAnimationFrame(() => {
                this.applyRafId = null;
                this.applyTheme();
            });
        },
        parseColor(value, fallback = null) {
            if (!value) return fallback;

            const trimmed = value.trim();
            const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
            if (rgbMatch) {
                const parts = rgbMatch[1].split(',').map(part => parseFloat(part.trim()));
                if (parts.length >= 3 && parts.every(part => Number.isFinite(part))) {
                    if (parts[3] === 0) return fallback;
                    return parts.slice(0, 3).map(part => Math.max(0, Math.min(255, Math.round(part))));
                }
            }

            const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
            if (hexMatch) {
                const hex = hexMatch[1];
                const normalized = hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex;
                return [
                    parseInt(normalized.slice(0, 2), 16),
                    parseInt(normalized.slice(2, 4), 16),
                    parseInt(normalized.slice(4, 6), 16)
                ];
            }

            return fallback;
        },
        mixColors(baseColor, targetColor, ratio) {
            return baseColor.map((channel, index) => {
                const targetChannel = targetColor[index] ?? channel;
                return Math.round(channel + (targetChannel - channel) * ratio);
            });
        },
        toCssColor(color) {
            return `rgb(${color.join(', ')})`;
        },
        getLuminance(color) {
            const [r, g, b] = color.map(channel => {
                const normalized = channel / 255;
                return normalized <= 0.03928
                    ? normalized / 12.92
                    : ((normalized + 0.055) / 1.055) ** 2.4;
            });

            return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
        },
        getAccentColor() {
            const linkTarget = document.querySelector('a[href]') || document.body || document.documentElement;
            const computed = linkTarget ? getComputedStyle(linkTarget).color : '';
            return this.parseColor(computed, this.defaults.accent);
        },
        getThemePalette() {
            const bodyStyle = document.body ? getComputedStyle(document.body) : null;
            const rootStyle = getComputedStyle(document.documentElement);
            const background = this.parseColor(bodyStyle?.backgroundColor, this.parseColor(rootStyle.backgroundColor, this.defaults.background));
            const text = this.parseColor(bodyStyle?.color, this.parseColor(rootStyle.color, this.defaults.text));
            const accent = this.getAccentColor();
            const isDark = this.getLuminance(background) < 0.35;
            const contrastTarget = isDark ? [255, 255, 255] : [0, 0, 0];

            const panelBase = this.mixColors(background, contrastTarget, isDark ? 0.08 : 0.03);
            const panelRaised = this.mixColors(panelBase, contrastTarget, isDark ? 0.08 : 0.05);
            const border = this.mixColors(text, panelBase, 0.75);
            const detailsBg = this.mixColors(panelBase, contrastTarget, isDark ? 0.04 : 0.02);
            const tableHeaderBg = this.mixColors(panelBase, contrastTarget, isDark ? 0.1 : 0.05);
            const tableRowAltBg = this.mixColors(panelBase, contrastTarget, isDark ? 0.04 : 0.02);

            return {
                '--text-color': this.toCssColor(text),
                '--background-dark': this.toCssColor(panelBase),
                '--background-light': this.toCssColor(panelRaised),
                '--border-color': this.toCssColor(border),
                '--accent-color': this.toCssColor(accent),
                '--primary-color': 'rgb(76, 175, 80)',
                '--telemetry-default-color': this.toCssColor(this.mixColors(text, panelBase, 0.45)),
                '--telemetry-accel-color': 'rgb(76, 175, 80)',
                '--telemetry-decel-color': 'rgb(244, 67, 54)',
                '--details-bg': this.toCssColor(detailsBg),
                '--self-highlight-bg': this.toCssColor(this.mixColors(panelBase, [76, 175, 80], isDark ? 0.16 : 0.10)),
                '--self-highlight-border': 'rgb(76, 175, 80)',
                '--api-loading-color': this.toCssColor(this.mixColors(text, panelBase, 0.35)),
                '--api-error-color': 'rgb(255, 138, 128)',
                '--api-info-color': this.toCssColor(accent),
                '--table-header-bg': this.toCssColor(tableHeaderBg),
                '--table-row-alt-bg': this.toCssColor(tableRowAltBg),
                '--history-color': 'rgb(255, 193, 7)',
                '--danger-color': 'rgb(244, 67, 54)',
                '--danger-hover-color': 'rgb(211, 47, 47)',
                '--info-color': 'rgb(33, 150, 243)',
                '--download-color': 'rgb(156, 39, 176)'
            };
        },
        applyTheme() {
            const palette = this.getThemePalette();
            const root = document.documentElement;
            Object.entries(palette).forEach(([property, value]) => {
                root.style.setProperty(property, value);
            });
        }
    };

    const TELEMETRY_STYLE_TEXT = `
        :root {
            --text-color: #e0e0e0;
            --background-dark: #1a1a1a;
            --background-light: #2a2a2a;
            --border-color: #404040;
            --accent-color: #64B5F6;
            --primary-color: #4CAF50;
            --telemetry-default-color: rgb(136, 136, 136);
            --telemetry-accel-color: rgb(76, 175, 80);
            --telemetry-decel-color: rgb(244, 67, 54);
            --details-bg: #2f2f2f;
            --self-highlight-bg: #2a3a2a;
            --self-highlight-border: #4CAF50;
            --api-loading-color: #aaa;
            --api-error-color: #ff8a80;
            --api-info-color: #64B5F6;
            --table-header-bg: #333;
            --table-row-alt-bg: #222;
            --history-color: #FFC107;
            --danger-color: #f44336;
            --danger-hover-color: #d32f2f;
            --info-color: #2196F3;
            --download-color: #9C27B0;
        }
        #custom-driver-list-container { display: none; }
        #drivers-scrollbar { display: block !important; }
        #telemetryControlsContainer { display: flex; }
        body.hide-original-leaderboard #drivers-scrollbar { display: none !important; }
        body.hide-original-leaderboard #custom-driver-list-container { display: block; }
        #custom-driver-list-container { margin-top: 10px; border: 1px solid var(--border-color); border-radius: 5px; background-color: var(--background-dark); color: var(--text-color); padding: 0; max-height: 450px; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; scrollbar-color: #555 var(--background-dark); position: relative; }
        #custom-driver-list-container::-webkit-scrollbar { width: 8px; }
        #custom-driver-list-container::-webkit-scrollbar-track { background: var(--background-dark); border-radius: 4px; }
        #custom-driver-list-container::-webkit-scrollbar-thumb { background-color: #555; border-radius: 4px; border: 2px solid var(--background-dark); }
        .custom-driver-item { display: flex; padding: 6px 8px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background-color 0.2s ease; position: relative; flex-direction: column; align-items: stretch; }
        .driver-info-row { display: flex; align-items: center; width: 100%; }
        .custom-driver-item:last-child { border-bottom: none; }
        .custom-driver-item:hover { background-color: var(--background-light); }
        .custom-driver-item.is-self { background-color: var(--self-highlight-bg); border-left: 3px solid var(--self-highlight-border); padding-left: 5px; }
        .custom-driver-item.is-self:hover { filter: brightness(1.05); }
        .driver-color-indicator { width: 10px; height: 20px; margin-right: 8px; border-radius: 3px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; font-weight: bold; line-height: 1; overflow: hidden; text-shadow: 0 0 2px rgba(0,0,0,0.7); }
        .driver-car-img { width: 38px; height: 19px; margin-right: 8px; object-fit: contain; flex-shrink: 0; }
        .driver-name { flex-grow: 1; font-weight: bold; margin-right: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 100px; }
        .driver-name .self-tag { color: #90EE90; font-weight: normal; margin-left: 4px; }
        .driver-telemetry-display { font-size: 0.85em; color: var(--telemetry-default-color); margin-left: auto; flex-shrink: 0; padding: 2px 6px; background: rgba(0,0,0,0.2); border-radius: 3px; white-space: nowrap; min-width: 70px; text-align: right; transition: color 0.3s ease, background-color 0.3s ease, opacity 0.3s ease; opacity: 1; }
        .driver-telemetry-display .telemetry-value { display: inline; }
        .driver-telemetry-display .lap-estimate { font-size: 0.9em; opacity: 0.7; margin-left: 4px; }
        .driver-telemetry-display .lap-estimate:empty { display: none; }
        body.telemetry-hidden .driver-telemetry-display { opacity: 0; pointer-events: none; min-width: 0; padding: 0; }
        .driver-details { width: 100%; background-color: var(--details-bg); margin-top: 6px; padding: 0 10px; box-sizing: border-box; max-height: 0; opacity: 0; overflow: hidden; border-radius: 4px; color: #bbb; font-size: 0.9em; transition: max-height 0.4s ease-out, opacity 0.3s ease-in, padding-top 0.4s ease-out, padding-bottom 0.4s ease-out, margin-top 0.4s ease-out; }
        .driver-details p { margin: 5px 0; line-height: 1.4; }
        .driver-details strong { color: #ddd; }
        .driver-details a { color: var(--accent-color); text-decoration: none; }
        .driver-details a:hover { text-decoration: underline; }
        .custom-driver-item.details-visible .driver-details { max-height: 350px; opacity: 1; padding-top: 8px; padding-bottom: 8px; margin-top: 6px; }
        .api-stats-container { border-top: 1px dashed var(--border-color); margin-top: 8px; padding-top: 8px; }
        .api-stats-container.loading .api-stat { color: var(--api-loading-color); font-style: italic; }
        .api-stats-container.error .api-stat-error-msg, .api-stats-container.no-key .api-stat-error-msg { color: var(--api-error-color); display: block; font-style: italic; }
        .api-stats-container.no-key .api-stat-error-msg { color: var(--api-info-color); }
        .api-stat-error-msg { display: none; }
        .api-stats-container p { margin: 3px 0; }
        .api-stat { font-weight: bold; color: var(--text-color); }
        #telemetryControlsContainer { margin: 10px 0 5px 0; justify-content: flex-end; gap: 5px; }
        .telemetry-download-button, .telemetry-info-button, .telemetry-history-button, .telemetry-stats-button, .telemetry-settings-button { background: var(--background-light); color: var(--text-color); border: 1px solid var(--border-color); padding: 6px 12px; text-align: center; cursor: pointer; transition: all 0.2s ease; font-size: 13px; border-radius: 4px; display: inline-block; }
        .telemetry-info-button:hover, .telemetry-history-button:hover, .telemetry-stats-button:hover, .telemetry-settings-button:hover, .telemetry-download-button:hover { background-color: var(--accent-color); color: var(--background-dark); }
        .telemetry-history-button:hover { background-color: var(--history-color); color: var(--background-dark); }
        .telemetry-info-button:hover { background-color: var(--info-color); color: var(--background-dark); }
        .telemetry-download-button:hover { background-color: var(--download-color); color: white; }
        .telemetry-download-button { display: none; }
        .settings-popup, .stats-panel, .history-panel, .info-panel, .download-popup { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(3px); }
        .stats-panel, .history-panel, .info-panel, .download-popup { z-index: 1010; scrollbar-width: thin; scrollbar-color: #555 var(--background-dark); }
        .settings-popup-content, .stats-panel-content, .history-panel-content, .info-panel-content, .download-popup-content { background: var(--background-dark); border-radius: 10px; border: 1px solid var(--border-color); width: 90%; max-height: 90vh; overflow-y: auto; padding: 20px; box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3); }
        .settings-popup-content { max-width: 500px; }
        .stats-panel-content { max-width: 800px; }
        .history-panel-content { max-width: 750px; }
        .info-panel-content { max-width: 600px; }
        .download-popup-content { max-width: 450px; }
        .settings-title, .stats-title, .history-title, .info-title, .download-title { font-size: 20px; font-weight: bold; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
        .settings-title { color: var(--primary-color); }
        .stats-title { color: var(--accent-color); }
        .history-title { color: var(--history-color); }
        .info-title { color: var(--info-color); }
        .download-title { color: var(--download-color); }
        .settings-close, .stats-close, .history-close, .info-close, .download-close { background: var(--background-light); color: var(--text-color); border: none; border-radius: 4px; padding: 8px 15px; cursor: pointer; transition: all 0.2s ease; }
        .settings-close:hover, .stats-close:hover, .history-close:hover, .info-close:hover, .download-close:hover { background: var(--accent-color); color: var(--background-dark); }
        .history-panel .panel-actions { display: flex; justify-content: flex-end; margin-top: 15px; padding-top: 10px; border-top: 1px solid var(--border-color); }
        .history-clear-button { background: var(--danger-color); color: white; border: none; border-radius: 4px; padding: 8px 15px; cursor: pointer; transition: background-color 0.2s ease; font-size: 0.9em; }
        .history-clear-button:hover { background: var(--danger-hover-color); }
        .settings-content, .stats-content, .history-content, .info-content, .download-content { padding-top: 10px; }
        .stats-content, .history-content, .info-content, .download-content { font-size: 0.9em; }
        .download-content .download-options { display: flex; flex-direction: column; gap: 15px; }
        .download-content .format-group, .download-content .action-group { display: flex; align-items: center; gap: 10px; }
        .download-content label { font-weight: bold; min-width: 60px; }
        .download-content select { padding: 8px; background: var(--background-light); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-color); flex-grow: 1; }
        .download-content button { background: var(--background-light); color: var(--text-color); border: 1px solid var(--border-color); padding: 8px 15px; border-radius: 4px; cursor: pointer; transition: all 0.2s ease; }
        .download-content button:hover { background: var(--accent-color); color: var(--background-dark); }
        .download-content button.primary { background: var(--download-color); color: white; }
        .download-content button.primary:hover { background: #7B1FA2; }
        .info-content h3 { color: var(--primary-color); margin-top: 20px; margin-bottom: 10px; font-size: 1.1em; }
        .info-content p, .info-content ul { margin-bottom: 10px; line-height: 1.5; color: var(--text-color); }
        .info-content ul { list-style: disc; padding-left: 25px; }
        .info-content li { margin-bottom: 5px; }
        .info-content a { color: var(--accent-color); }
        .info-content a:hover { text-decoration: underline; }
        .stats-content h3, .history-content h3 { color: var(--primary-color); margin-top: 20px; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px dashed var(--border-color); font-size: 1.2em; }
        .stats-content h3:first-child, .history-content h3:first-child { margin-top: 0; }
        .stats-content h4 { color: var(--accent-color); margin-top: 15px; margin-bottom: 8px; font-size: 1.1em; }
        .stats-content p { margin: 5px 0 10px 0; line-height: 1.5; color: #ccc; }
        .stats-content strong { color: var(--text-color); }
        .stats-content .loading-msg, .stats-content .error-msg, .stats-content .info-msg { padding: 10px; border-radius: 4px; margin: 15px 0; text-align: center; }
        .history-content .loading-msg, .history-content .error-msg, .history-content .info-msg { padding: 10px; border-radius: 4px; margin: 15px 0; text-align: center; }
        .stats-content .loading-msg { background-color: rgba(170, 170, 170, 0.2); color: var(--api-loading-color); }
        .stats-content .error-msg { background-color: rgba(255, 138, 128, 0.2); color: var(--api-error-color); }
        .stats-content .info-msg { background-color: rgba(100, 181, 246, 0.2); color: var(--api-info-color); }
        .history-content .loading-msg { background-color: rgba(170, 170, 170, 0.2); color: var(--api-loading-color); }
        .history-content .error-msg { background-color: rgba(255, 138, 128, 0.2); color: var(--api-error-color); }
        .history-content .info-msg { background-color: rgba(100, 181, 246, 0.2); color: var(--api-info-color); }
        .stats-content table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; font-size: 0.95em; }
        .stats-content th, .stats-content td { border: 1px solid var(--border-color); padding: 6px 8px; text-align: left; }
        .stats-content th { background-color: var(--table-header-bg); font-weight: bold; color: var(--text-color); }
        .stats-content tr:nth-child(even) { background-color: var(--table-row-alt-bg); }
        .stats-content td.numeric, .stats-content th.numeric { text-align: right; }
        .stats-content .stat-label { color: #bbb; }
        .stats-content .stat-value { font-weight: bold; color: var(--text-color); }
        .stats-content .car-stats-inline { font-size: 0.8em; color: #aaa; }
        .stats-content .car-stats-inline strong { color: #bbb; }
        .stats-content .user-car-highlight { background-color: rgba(76, 175, 80, 0.15); }
        .stats-content a { color: var(--accent-color); text-decoration: none; }
        .stats-content a:hover { text-decoration: underline; }
        .stats-content td { color: var(--text-color); padding: 2px !important; }
        .stats-summary-cards, .stats-delta-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
        .stats-summary-card { border: 1px solid var(--border-color); border-radius: 6px; background: var(--background-light); padding: 10px; }
        .stats-summary-label { font-size: 0.78em; color: #aaa; text-transform: uppercase; letter-spacing: 0.04em; }
        .stats-summary-value { margin-top: 4px; font-size: 1.05em; font-weight: 700; color: var(--text-color); }
        .stats-summary-value.positive { color: #81C784; }
        .stats-summary-value.negative { color: #E57373; }
        .history-content table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.95em; }
        .history-content th, .history-content td { border: 1px solid var(--border-color); padding: 5px 8px; text-align: left; color: var(--text-color); }
        .history-content th { background-color: var(--table-header-bg); font-weight: bold; }
        .history-content tr:nth-child(even) { background-color: var(--table-row-alt-bg); }
        .history-content td.numeric, .history-content th.numeric { text-align: right; }
        .history-content .no-history-msg { padding: 15px; text-align: center; color: #aaa; font-style: italic; }
        .history-content .change-indicator { margin-left: 5px; font-weight: bold; font-size: 0.9em; }
        .history-content .change-positive { color: #81C784; }
        .history-content .change-negative { color: #E57373; }
        .history-content .change-neutral { color: #90A4AE; }
        .history-summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
        .history-summary-card { border: 1px solid var(--border-color); border-radius: 6px; background: var(--background-light); padding: 10px; }
        .history-summary-label { font-size: 0.8em; color: #aaa; text-transform: uppercase; letter-spacing: 0.04em; }
        .history-summary-value { margin-top: 4px; font-size: 1.1em; font-weight: 700; color: var(--text-color); }
        .history-summary-value.positive { color: #81C784; }
        .history-summary-value.negative { color: #E57373; }
        .history-race-timeline { list-style: none; padding: 0; margin: 10px 0 18px 0; display: flex; flex-direction: column; gap: 8px; }
        .history-race-item { border: 1px solid var(--border-color); border-radius: 6px; background: var(--background-light); padding: 8px 10px; }
        .history-race-item.win { border-left: 4px solid #81C784; }
        .history-race-item.crash { border-left: 4px solid #E57373; }
        .history-race-main { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 4px; }
        .history-race-track { font-weight: 600; color: var(--text-color); }
        .history-race-result { font-weight: 600; color: #ccc; }
        .history-race-skill { margin-left: auto; font-weight: 700; color: #bbb; }
        .history-race-skill.positive { color: #81C784; }
        .history-race-skill.negative { color: #E57373; }
        .history-race-meta { font-size: 0.85em; color: #9ca4ad; }
        .history-sort-btn, .stats-sort-btn { background: transparent; border: none; color: inherit; font: inherit; cursor: pointer; padding: 0; text-decoration: none; }
        .history-sort-btn:hover, .stats-sort-btn:hover { text-decoration: underline; }
        .settings-item { margin-bottom: 15px; display: flex; flex-direction: column; }
        .settings-item label:not(.switch) { margin-bottom: 8px; color: var(--text-color); font-weight: bold; display: block; }
        .settings-item .telemetry-options-group { display: flex; flex-direction: column; gap: 10px; margin-top: 5px; border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; background: var(--background-light); }
        .settings-item .telemetry-options-group .toggle-container { margin-bottom: 0; }
        .settings-item select, .settings-item input[type=number], .settings-item input[type=text], .settings-item input[type=password] { padding: 8px; background: var(--background-light); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-color); width: 100%; box-sizing: border-box; }
        .settings-item input[type=password] { font-family: monospace; }
        .toggle-container { padding: 0; display: flex; align-items: center; justify-content: space-between; background: none; border: none; }
        .toggle-container label:first-child { margin-bottom: 0; }
        .settings-buttons { display: flex; justify-content: space-between; margin-top: 25px; padding-top: 15px; border-top: 1px solid var(--border-color); gap: 10px; flex-wrap: wrap; }
        .settings-btn { padding: 10px 15px; border-radius: 4px; border: none; cursor: pointer; background: var(--background-light); color: var(--text-color); transition: all 0.2s ease; flex-grow: 1; }
        .settings-btn:hover { background: var(--accent-color); color: var(--background-dark); }
        .settings-btn.primary { background: var(--primary-color); color: white; }
        .settings-btn.primary:hover { background: #388E3C; }
        .settings-btn.danger { background-color: var(--danger-color); color: white; }
        .settings-btn.danger:hover { background-color: var(--danger-hover-color); }
        .settings-data-buttons { display: flex; gap: 10px; width: 100%; margin-top: 10px; }
        .switch { position: relative; display: inline-block; width: 45px; height: 24px; flex-shrink: 0; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; inset: 0; background-color: #4d4d4d; transition: .3s; border-radius: 12px; }
        .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 2px; background-color: #f4f4f4; transition: .3s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--primary-color); }
        input:checked + .slider:before { transform: translateX(21px); }
        .api-tos-container { margin-top: 10px; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 0.85em; color: #ccc; line-height: 1.4; border: 1px solid var(--border-color); }
        .api-tos-container p { margin: 0 0 8px 0; }
        .api-tos-container details { margin-top: 10px; }
        .api-tos-container summary { cursor: pointer; font-weight: bold; color: var(--text-color); }
        .api-tos-container table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.95em; }
        .api-tos-container th, .api-tos-container td { border: 1px solid var(--border-color); padding: 5px; text-align: left; vertical-align: top; }
        .api-tos-container th { background-color: var(--table-header-bg); }
        .api-tos-container td { color: var(--text-color); }
        .api-tos-container code { background: var(--background-light); padding: 2px 4px; border-radius: 3px; font-family: monospace; }
        .color-1 { background-color: #DC143C; } .color-2 { background-color: #4682B4; } .color-3 { background-color: #32CD32; } .color-4 { background-color: #FFD700; } .color-5 { background-color: #FF8C00; } .color-6 { background-color: #9932CC; } .color-7 { background-color: #00CED1; } .color-8 { background-color: #FF1493; } .color-9 { background-color: #8B4513; } .color-10 { background-color: #7FFF00; } .color-11 { background-color: #00FA9A; } .color-12 { background-color: #D2691E; } .color-13 { background-color: #6495ED; } .color-14 { background-color: #F08080; } .color-15 { background-color: #20B2AA; } .color-16 { background-color: #B0C4DE; } .color-17 { background-color: #DA70D6; } .color-18 { background-color: #FF6347; } .color-19 { background-color: #40E0D0; } .color-20 { background-color: #C71585; } .color-21 { background-color: #6A5ACD; } .color-22 { background-color: #FA8072; } .color-default { background-color: #666; }
        @media (max-width: 768px) { .custom-driver-item { padding: 5px; } .driver-info-row { margin-bottom: 4px; } .driver-name { min-width: 80px; } .driver-telemetry-display { font-size: 0.8em; min-width: 60px; margin-left: 5px; padding: 1px 4px; } .driver-details { font-size: 0.85em; } #custom-driver-list-container { max-height: 350px; } .telemetry-download-button, .telemetry-info-button, .telemetry-history-button, .telemetry-stats-button, .telemetry-settings-button { font-size: 12px; padding: 5px 10px; } .settings-popup-content, .stats-panel-content, .history-panel-content, .info-panel-content, .download-popup-content { width: 95%; padding: 15px; } .settings-title, .stats-title, .history-title, .info-title, .download-title { font-size: 18px; } .settings-btn { padding: 8px 12px; font-size: 14px; } .custom-driver-item.details-visible .driver-details { max-height: 320px; } .stats-content table { font-size: 0.9em; } .stats-content th, .stats-content td { padding: 4px 6px; } .history-content table { font-size: 0.9em; } .history-content th, .history-content td { padding: 4px 6px; } }
        @media (max-width: 480px) { .driver-name { min-width: 60px; } .driver-telemetry-display { min-width: 55px; font-size: 0.75em; } .stats-content table { font-size: 0.85em; } .stats-content th, .stats-content td { padding: 3px 4px; } .history-content table { font-size: 0.85em; } .history-content th, .history-content td { padding: 3px 4px; } .settings-buttons { flex-direction: column; } .settings-data-buttons { flex-direction: column; } }
    `;
