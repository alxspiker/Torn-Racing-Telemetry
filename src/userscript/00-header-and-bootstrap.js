// ==UserScript==
// @name         Torn Racing Telemetry
// @namespace    https://www.torn.com/profiles.php?XID=2782979
// @version      3.4.2
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
        version: '3.4.2',
        author: "TheProgrammer",
        contactId: "2782979",
        contactUrl: function() { return `https://www.torn.com/profiles.php?XID=${this.contactId}`; },
        description: "Provides enhanced telemetry, stats analysis, historical tracking, and race results export for Torn Racing.",
        notes: [
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
