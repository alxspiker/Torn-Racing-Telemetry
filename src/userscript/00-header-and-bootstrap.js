// ==UserScript==
// @name         Torn Racing Telemetry
// @namespace    https://www.torn.com/profiles.php?XID=2782979
// @version      3.4.2
// @description  Enhanced Torn Racing UI: Telemetry, driver stats, advanced stats panel, history tracking, and race results export.
// @match        https://www.torn.com/page.php?sid=racing*
// @match        https://www.torn.com/loader.php?sid=racing*
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js
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

    // Function to load Chart.js in PDA environment
    async function loadChartJsInPDA() {
        try {
            if (typeof __PDA_platformReadyPromise !== 'undefined') {
                await __PDA_platformReadyPromise;
            }
            const chartJsUrl = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js';
            const response = await window.flutter_inappwebview.callHandler("PDA_httpGet", chartJsUrl, {});

            if (response && response.status === 200 && response.responseText) {
                await window.flutter_inappwebview.callHandler("PDA_evaluateJavascript", response.responseText);
                console.log("Torn Racing Telemetry: Successfully loaded Chart.js in PDA environment");
                return true;
            } else {
                console.error("Torn Racing Telemetry: Failed to fetch Chart.js in PDA environment", response);
                return false;
            }
        } catch (error) {
            console.error("Torn Racing Telemetry: Error loading Chart.js in PDA environment", error);
            return false;
        }
    }

    // Load Chart.js if needed
    if (isPDA) {
        console.log("Torn Racing Telemetry: Running in Torn PDA environment");
        loadChartJsInPDA().then(success => {
            if (!success) {
                console.error("Torn Racing Telemetry: Charts will not be available in PDA");
            }
        });
    }
