// ==UserScript==
// @name         Torn Racing Telemetry
// @namespace    https://www.torn.com/profiles.php?XID=2782979
// @version      4.0.0
// @description  Enhanced Torn Racing UI: Telemetry, driver stats, advanced stats panel, history tracking, and race results export.
// @match        https://www.torn.com/page.php?sid=racing*
// @match        https://www.torn.com/loader.php?sid=racing*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_info
// @grant        GM_setClipboard
// @connect      api.torn.com
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/522245/Torn%20Racing%20Telemetry.user.js
// @updateURL https://update.greasyfork.org/scripts/522245/Torn%20Racing%20Telemetry.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const ScriptInfo = {
        version: '4.0.0',
        author: "TheProgrammer",
        contactId: "2782979",
        contactUrl: function() { return `https://www.torn.com/profiles.php?XID=${this.contactId}`; },
        description: "Provides enhanced telemetry, stats analysis, historical tracking, and race results export for Torn Racing.",
        notes: [
            "v4.0.0: Redesigned racing tabs and driver details, integrated live map and car controls, and improved telemetry, exports, settings validation and API errors.",
            "v3.5.5: Removed tap/hover tooltips from the + / − driver-details control and progress bars. Fixed stale telemetry carrying into new races, improved reliability when Torn loads race data late, hid live progress bars for finished drivers, kept API keys out of request URLs, and enabled Speed, Accel, and progress bars by default for new installs.",
            "v3.5.4: Refined the driver list with compact stacked Speed/Accel values, thin full-race and current-lap progress bars, and a compact finish-time display. The Show Progress setting now controls the bars. Estimated lap time moved to expanded driver details and now uses an 8-second rolling speed average. Speed and Accel share live green/red acceleration colors.",
            "v3.5.3: Thanks to The_GoodGuy [4012936] for the suggestion. Click a racer to select them on the track; use the new arrow to view their details.",
            "v3.5.2: Detailed JSON exports now include finish times, best laps, racing skill, skill gain, and car details. Finished-driver cards now show Race Time, Best Lap, and Skill Gained. Crashes are labeled correctly.",
            "v3.5.1: Thanks to @CharmRiver[2334174] for reporting the issue. Fixed theme consistency by defaulting telemetry UI panels/cards to the dark palette so layout readability stays stable even when Torn is in light mode.",
            "v3.5.0: Major architecture and panel overhaul. Migrated to modular source + build pipeline, replaced chart-based history/stats views with API-first timeline/cards/tables, added true paginated /user/races sync, redesigned driver dropdown telemetry UI, improved animation behavior (including progress mode), updated panel styling/colors, and removed deprecated dead code paths.",
            "v3.4.2: Thanks to @MikeyJDoug[2137820] for noticing. Fixed a critical error in the stats panel for new users or users with no official race history. The panel will now display a proper message instead of crashing.",
            "v3.4.1: Implemented Race ID capture for unique race identification in logs and exports. Improved User ID detection for better script initialization.",
            "v3.4.0: Major telemetry engine overhaul. Implemented advanced EMA smoothing for speed & acceleration, robust handling for data gaps to prevent artifacts, and a more predictive lap time estimation model for significantly improved accuracy and stability.",
            "Your API key and all other script data (settings, history log) are stored **locally** in your browser's userscript storage. They are **never** transmitted anywhere except to the official Torn API when fetching data.",
        ]
    };

    if (window.racingCustomUITelemetryHasRun) return;
    window.racingCustomUITelemetryHasRun = true;

    // Check if we're running in Torn PDA
    const isPDA = typeof window.flutter_inappwebview !== 'undefined' &&
                typeof window.flutter_inappwebview.callHandler === 'function';
