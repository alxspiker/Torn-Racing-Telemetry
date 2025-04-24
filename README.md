<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Torn Racing Telemetry README</title>
    <!-- Basic styling for better readability -->
    <style>
        body { font-family: sans-serif; line-height: 1.6; padding: 20px; max-width: 900px; margin: auto; }
        h1, h2, h3 { color: #333; }
        h1 { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        h2 { border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 30px; }
        blockquote { border-left: 4px solid #ddd; padding-left: 15px; color: #555; font-style: italic; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        pre { background-color: #f9f9f9; border: 1px solid #ddd; padding: 10px; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; }
        code { font-family: monospace; }
        .center { text-align: center; }
        .feature-table td { vertical-align: top; }
        .success-text { color: #4CAF50; font-weight: bold; }
        .danger-text { color: #F44336; font-weight: bold; }
        .neutral-text { color: #888888; }
        .api-required { font-size: 0.8em; color: #e67e22; font-style: italic; }
    </style>
</head>
<body>

<h1>🏎️ Torn Racing Telemetry</h1>
<blockquote>
    Enhance your Torn racing experience with real-time telemetry, an advanced UI, detailed stats analysis with charts, and personal history tracking.
</blockquote>
<hr>

<h2>📋 Table of Contents</h2>
<ul>
    <li><a href="#overview">Overview</a></li>
    <li><a href="#key-features">Key Features</a></li>
    <li><a href="#telemetry-display">Telemetry Display Explained</a></li>
    <li><a href="#enhanced-driver-list">Enhanced Driver List</a></li>
    <li><a href="#advanced-stats-panel">Advanced Stats Panel</a></li>
    <li><a href="#history-panel">History Panel</a></li>
    <li><a href="#interface-controls">Interface Controls</a></li>
    <li><a href="#settings-panel">Settings Panel</a></li>
    <li><a href="#installation">Installation</a></li>
    <li><a href="#usage-guide">Usage Guide</a></li>
    <li><a href="#faq">FAQ</a></li>
</ul>
<hr>

<h2 id="overview">Overview</h2>
<p>
    <strong>Torn Racing Telemetry</strong> is a comprehensive userscript designed to significantly enhance the racing feature in Torn. It replaces the standard leaderboard with a dynamic, feature-rich interface, providing real-time telemetry data, detailed driver statistics (including API-fetched stats), advanced race performance analysis with charts, and personal racing skill/points history tracking, also with charts. It integrates seamlessly into the Torn racing page, offering valuable insights without disrupting your experience.
</p>
<p>
    Version: <strong>3.1.0</strong><br>
    Author: <strong>TheProgrammer</strong> [<a href="https://www.torn.com/profiles.php?XID=2782979" target="_blank" rel="noopener noreferrer">2782979</a>]
</p>

<h2 id="key-features">Key Features</h2>
<table class="feature-table">
    <thead>
        <tr>
            <th>📊 Enhanced UI & Telemetry</th>
            <th>📈 Data & Analysis</th>
            <th>⚙️ Tracking & Configuration</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>
                <ul>
                    <li><strong>Real-time Telemetry:</strong> Speed, Acceleration, Est. Lap Times.</li>
                    <li><strong>Customizable Display:</strong> Choose units (mph/kmh), data points (Speed, Accel, Both), color-coding, animations.</li>
                    <li><strong>Enhanced Driver List:</strong> Optional replacement for Torn's list, sorted by position.</li>
                    <li><strong>Click-to-View Details:</strong> Expand driver entries for detailed status, lap progress, calculated metrics, and API stats.</li>
                    <li><strong>Color Indicators:</strong> Quickly see driver position, status (racing, finished, crashed), and podium finishes.</li>
                </ul>
            </td>
            <td>
                <ul>
                    <li><strong>Driver API Stats:</strong> View Racing Skill, Points, Win Rate etc. on click <span class="api-required">(Requires API Key)</span>.</li>
                    <li><strong>Advanced Stats Panel:</strong> In-depth analysis of your historical race performance <span class="api-required">(Requires API Key)</span>.</li>
                    <li><strong>Historical Analysis:</strong> Overall win/podium/crash rates, performance breakdown by track and car.</li>
                    <li><strong>Track Analysis:</strong> View records for the current track/class, analyze top-performing cars and their stats <span class="api-required">(Requires API Key)</span>.</li>
                    <li><strong>Interactive Charts:</strong> Visualize performance trends using Chart.js.</li>
                </ul>
            </td>
             <td>
                <ul>
                    <li><strong>History Panel:</strong> Automatically logs changes in your Racing Skill, Class, and Points over time <span class="api-required">(API Key recommended for Points)</span>.</li>
                    <li><strong>Progression Chart:</strong> Visualize your skill and points progression in the History Panel.</li>
                    <li><strong>Configurable Settings:</strong> Fine-tune display, API key, history logging, data limits, and UI preferences.</li>
                    <li><strong>Info Panel:</strong> Access script version, author contact, and important usage notes.</li>
                    <li><strong>Data Management:</strong> Securely manage your API key and clear script data if needed.</li>
                </ul>
            </td>
        </tr>
    </tbody>
</table>

<h2 id="telemetry-display">Telemetry Display Explained</h2>
<p>The script adds a telemetry display next to each driver in the enhanced list during a race. Here's an example:</p>
<!-- Image Placeholder: Use the table image from the old readme -->
<table>
    <thead>
        <tr><th>Pos</th><th>Driver</th><th>Telemetry</th><th>Progress</th></tr>
    </thead>
    <tbody>
        <tr>
            <td>1</td>
            <td>JohnRacer [12345]</td>
            <td><span class="success-text">95 mph | 0.5 g</span> <span class="neutral-text">(~1:15)</span></td>
            <td>84%</td>
        </tr>
        <tr>
            <td>2</td>
            <td>SpeedDemon [67890] (You)</td>
            <td><span class="danger-text">88 mph | -0.8 g</span> <span class="neutral-text">(~1:18)</span></td>
            <td>82%</td>
        </tr>
        <tr>
            <td>3</td>
            <td>FastLane [11223]</td>
            <td><span class="neutral-text">91 mph | 0.2 g</span> <span class="neutral-text">(~1:17)</span></td>
            <td>81%</td>
        </tr>
         <tr>
            <td>4</td>
            <td>RacerKing [44556]</td>
            <td>🏁 1:51.24 (~85 mph)</td>
            <td>Finished</td>
        </tr>
         <tr>
            <td>5</td>
            <td>CrashTest [77889]</td>
            <td>💥 CRASHED</td>
            <td>Crashed</td>
        </tr>
    </tbody>
</table>

<p><strong>Understanding the Display:</strong></p>
<ul>
    <li><strong>Speed:</strong> Current calculated speed in your chosen unit (mph or km/h).</li>
    <li><strong>Acceleration:</strong> Calculated g-forces. Positive (<span class="success-text">green</span>) for acceleration, negative (<span class="danger-text">red</span>) for braking/deceleration, <span class="neutral-text">grey</span> for neutral/steady speed (optional color-coding).</li>
    <li><strong>Est. Lap Time:</strong> (Optional) An estimated time remaining for the current lap, shown in parentheses <span class="neutral-text">(~X:XX)</span>. Based on current speed and track length, smoothed over time.</li>
    <li><strong>Finished Drivers:</strong> Marked with 🏁, showing final time and calculated average speed.</li>
    <li><strong>Crashed Drivers:</strong> Marked with 💥.</li>
</ul>

<h2 id="enhanced-driver-list">Enhanced Driver List</h2>
<p>
    When enabled (default setting), the script hides Torn's default leaderboard and presents its own dynamic list.
</p>
<ul>
    <li>Displays driver position, color indicator, car image, name, and real-time telemetry.</li>
    <li>Highlights your own driver entry.</li>
    <li>Clicking on any driver entry expands it to show detailed information:
        <ul>
            <li>User profile link.</li>
            <li>Car name.</li>
            <li>Current status (Racing, Finished, Crashed, Ready).</li>
            <li>Precise progress percentage, current lap, progress within the lap.</li>
            <li>Calculated metrics (speed, acceleration).</li>
            <li>Smoothed and raw estimated lap times (if applicable).</li>
            <li>API-fetched stats (Skill, Points, Races, Win Rate) if API key is configured and 'Load on Click' is enabled.</li>
        </ul>
    </li>
    <li>The list updates dynamically as the race progresses.</li>
</ul>

<h2 id="advanced-stats-panel">Advanced Stats Panel</h2>
<p>Accessible via the '📊 Stats' button <span class="api-required">(Requires API Key)</span>, this panel provides deep insights into your racing performance based on your recent official race history (up to the configured limit).</p>
<ul>
    <li><strong>Overall Performance Summary:</strong> Total races analyzed, date range, average position, win rate, podium rate, crash rate.</li>
    <li><strong>Performance by Track:</strong> Table and chart showing your stats (races, avg pos, win/podium/crash rates, best lap) for each track you've raced on recently.</li>
    <li><strong>Performance by Car:</strong> Table and chart breaking down your performance based on the cars you've used.</li>
    <li><strong>Current Track Analysis:</strong>
        <ul>
            <li>Details of your currently selected car.</li>
            <li>Top 5 track records for the current track and class.</li>
            <li>Analysis of the most successful cars on the track (based on record holders), including their base stats and a chart comparing their frequency in the top records.</li>
        </ul>
    </li>
    <li>Uses interactive charts (powered by Chart.js) for better visualization.</li>
</ul>

<h2 id="history-panel">History Panel</h2>
<p>Accessed via the '📜 History' button (if enabled in settings), this panel tracks your long-term racing progression.</p>
<ul>
    <li>Logs entries whenever a change in your Racing Skill or Class is detected on the page.</li>
    <li>If an API key is provided, it also periodically checks and logs your Racing Points.</li>
    <li>Displays a table of historical entries, showing the date, skill, class, and points at the time of the log entry.</li>
    <li>Highlights changes (<span class="success-text">gains</span> or <span class="danger-text">losses</span>) compared to the previous entry.</li>
    <li>Includes an interactive line chart visualizing your Skill and Points progression over time.</li>
    <li>Allows clearing the history log.</li>
</ul>
<!-- Image Placeholder: Use the table image from the old Stats History section, adapted -->
<p><strong>Example History Entry:</strong></p>
<table>
    <thead><tr><th colspan="4">History Log</th></tr></thead>
    <tbody>
        <tr><th>Date & Time</th><th class="numeric">Skill</th><th class="numeric">Class</th><th class="numeric">Points</th></tr>
        <tr>
            <td>2024-03-10 14:30:15</td>
            <td class="numeric">85.42 <span class="success-text">(+0.61)</span></td>
            <td class="numeric">A</td>
            <td class="numeric">12,482 <span class="success-text">(+55)</span></td>
        </tr>
        <tr>
            <td>2024-03-09 20:15:05</td>
            <td class="numeric">84.81</td>
            <td class="numeric">A</td>
            <td class="numeric">12,427</td>
        </tr>
    </tbody>
</table>

<h2 id="interface-controls">Interface Controls</h2>
<p>The script adds a control bar above the driver list:</p>
<!-- Image Placeholder: Use the control panel image from the old readme, adapt button names -->
<pre><code>┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─────────┐   ┌───────────┐   ┌─────────┐   ┌──────────┐                  │
│  │ ℹ️ Info  │   │ 📜 History│   │ 📊 Stats│   │ ⚙ Settings│                  │
│  └─────────┘   └───────────┘   └─────────┘   └──────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘</code></pre>
<ul>
    <li><strong>ℹ️ Info:</strong> Opens a panel with script details, version, author contact, and important notes.</li>
    <li><strong>📜 History:</strong> (Visible if enabled) Opens the History Panel to view your skill/class/points progression.</li>
    <li><strong>📊 Stats:</strong> (Visible if enabled) Opens the Advanced Stats Panel for detailed performance analysis <span class="api-required">(Requires API Key)</span>.</li>
    <li><strong>⚙ Settings:</strong> Opens the Settings Panel to configure the script's features and API key.</li>
</ul>

<h2 id="settings-panel">Settings Panel</h2>
<p>Configure the script's behavior and features:</p>
<!-- Image Placeholder: Use the settings panel image from the old readme, adapt options -->
<table>
    <thead>
        <tr><th colspan="2">Telemetry & UI Settings <button style="float: right;">×</button></th></tr>
    </thead>
    <tbody>
        <tr><td colspan="2"><strong>Panel Toggles</strong></td></tr>
        <tr><td>Enable History Panel & Logging</td><td>[Toggle Switch]</td></tr>
        <tr><td>Enable Stats Panel</td><td>[Toggle Switch]</td></tr>

        <tr><td colspan="2"><strong>Telemetry Display</strong></td></tr>
        <tr><td>Telemetry Display</td><td>[Select: Speed Only / Accel Only / Both]</td></tr>
        <tr><td>Speed Unit</td><td>[Select: mph / km/h]</td></tr>
        <tr><td>Color Code Telemetry</td><td>[Toggle Switch]</td></tr>
        <tr><td>Animate Telemetry Changes</td><td>[Toggle Switch]</td></tr>
        <tr><td>Show Est. Lap Time</td><td>[Toggle Switch]</td></tr>
        <tr><td>Lap Est. Smoothing (0.01-1.0)</td><td>[Number Input: 0.15]</td></tr>

        <tr><td colspan="2"><strong>API & Data Features</strong></td></tr>
        <tr><td>Load Driver API Stats on Click</td><td>[Toggle Switch] <small class="api-required">(Requires API key)</small></td></tr>
        <tr><td>Torn API Key (Limited Access Recommended)</td><td>[Text Input: Enter API Key]</td></tr>
        <tr><td>Advanced Stats: Races to Analyze</td><td>[Number Input: 100]</td></tr>

        <tr><td colspan="2"><strong>History Tracking</strong></td></tr>
        <tr><td>History: Check Interval (ms)</td><td>[Number Input: 15000]</td></tr>
        <tr><td>History: Max Log Entries</td><td>[Number Input: 50]</td></tr>

         <tr><td colspan="2"><strong>UI Options</strong></td></tr>
        <tr><td>Hide Torn's Leaderboard (Use Enhanced List)</td><td>[Toggle Switch]</td></tr>

        <tr><td colspan="2" style="padding-top: 15px;">
            <button>Toggle Telemetry</button>
            <button style="background-color: #4CAF50; color: white;">Save & Close</button>
        </td></tr>
         <tr><td colspan="2" style="padding-top: 5px;">
            <button style="background-color: #f44336; color: white;">Clear Script Data</button>
            <button style="background-color: #f44336; color: white;">Clear API Key</button>
        </td></tr>
    </tbody>
</table>
<p><em>Note: Your API key and all script data are stored **locally** in your browser's userscript storage. The API key is stored separately and is not removed when clearing general script data.</em></p>

<h2 id="installation">Installation</h2>
<ol>
    <li>
        <strong>Install a Userscript Manager:</strong> If you don't have one, install a browser extension like:
        <ul>
            <li><a href="https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo" target="_blank" rel="noopener noreferrer">Tampermonkey</a> (Chrome, Firefox, Edge, Opera)</li>
            <li><a href="https://violentmonkey.github.io/" target="_blank" rel="noopener noreferrer">Violentmonkey</a> (Chrome, Firefox, Edge, Opera)</li>
            <li>Greasemonkey (Firefox - older versions might have compatibility issues)</li>
        </ul>
    </li>
    <li>
        <strong>Install the Script:</strong> Click the link below and your userscript manager should prompt you to install:
        <p style="text-align: center; margin: 15px 0;">
            <a href="https://greasyfork.org/en/scripts/522245-torn-racing-telemetry" target="_blank" rel="noopener noreferrer" style="font-size: 1.1em; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Install Torn Racing Telemetry</a>
        </p>
         <p>(Direct Link: <code>https://greasyfork.org/en/scripts/522245-torn-racing-telemetry</code>)</p>
    </li>
    <li>
        <strong>Configure (Optional but Recommended):</strong>
        <ul>
            <li>Navigate to the Torn racing page (<a href="https://www.torn.com/page.php?sid=racing" target="_blank" rel="noopener noreferrer">https://www.torn.com/page.php?sid=racing</a>).</li>
            <li>Click the '⚙ Settings' button added by the script.</li>
            <li>Enter your Torn API Key (Limited Access recommended) to enable the Advanced Stats and History points tracking features.</li>
            <li>Adjust other settings to your preference and click 'Save & Close'.</li>
        </ul>
    </li>
</ol>

<h2 id="usage-guide">Usage Guide</h2>
<ul>
    <li><strong>During a Race:</strong> Observe the real-time telemetry on the enhanced driver list. Click any driver to expand their details and see more granular data or API stats (if configured). Use the telemetry (speed, acceleration, est. lap times) to inform your driving.</li>
    <li><strong>Analyzing Performance:</strong> Click '📊 Stats' to open the Advanced Stats Panel. Review your overall performance, track/car specific stats, and analyze the current track records/top cars <span class="api-required">(Requires API Key)</span>.</li>
    <li><strong>Tracking Progress:</strong> Click '📜 History' to see how your Skill, Class, and Points have changed over time. Use the chart to visualize trends.</li>
    <li><strong>Customization:</strong> Click '⚙ Settings' to adjust telemetry display, enable/disable panels, manage your API key, and control data logging.</li>
    <li><strong>Information:</strong> Click 'ℹ️ Info' for script version, contact details, and important notes about data privacy and usage.</li>
</ul>

<h2 id="faq">FAQ</h2>
<dl>
    <dt><strong>Does this script violate Torn's rules?</strong></dt>
    <dd>No. The script enhances the user interface and uses the official Torn API for data retrieval as intended. It does not automate gameplay, interfere with game mechanics, or provide unfair advantages prohibited by the rules.</dd>

    <dt><strong>Is my API key safe?</strong></dt>
    <dd>Yes. Your API key is stored locally in your browser's secure userscript storage. It is ONLY sent directly to the official Torn API (<code>api.torn.com</code>) when fetching data for the Stats/History panels or driver details. It is never transmitted to any other server or third party.</dd>

    <dt><strong>Why do I need an API key? Which features require it?</strong></dt>
    <dd>An API key is needed to fetch data specific to your account or detailed game information not available directly on the race page. Features requiring an API key include:
        <ul>
            <li>The <strong>Advanced Stats Panel</strong> (fetching historical races, track records, car stats).</li>
            <li>Fetching <strong>Racing Points</strong> for the History Panel.</li>
            <li>Displaying specific user stats (Skill, Points, Races, Win Rate) when clicking a driver in the list (if 'Load on Click' is enabled).</li>
        </ul>
        The core telemetry display and basic driver list enhancements work without an API key. A Limited Access key is sufficient and recommended.
    </dd>

    <dt><strong>How accurate is the telemetry data (speed, acceleration, lap estimate)?</strong></dt>
    <dd>The telemetry is calculated based on the progress percentage updates provided by the game interface over time. It's a sophisticated estimation and generally provides a good relative comparison between drivers and indication of changes. However, it's not based on the game's internal physics engine, so minor discrepancies with actual game values might exist. Lap estimates are further smoothed and depend heavily on maintaining current speed.</dd>

    <dt><strong>Why did my API key disappear after clearing data?</strong></dt>
    <dd>Since version 3.1.0, the API key is stored separately. Use the "Clear Script Data" button to reset settings and history *without* removing the key. Use the dedicated "Clear API Key" button if you specifically want to remove the key.</dd>

    <dt><strong>The script isn't working or looks broken after an update. What should I do?</strong></dt>
    <dd>Try these steps:
        <ol>
            <li>Hard refresh the racing page (Ctrl+Shift+R or Cmd+Shift+R).</li>
            <li>Check the script manager (e.g., Tampermonkey dashboard) to ensure the script is enabled and updated.</li>
            <li>Try clearing script data via the Settings panel (this keeps your API key).</li>
            <li>Check GreasyFork for any known issues or newer versions.</li>
            <li>If problems persist, contact the author (<a href="https://www.torn.com/profiles.php?XID=2782979" target="_blank" rel="noopener noreferrer">TheProgrammer [2782979]</a>) via Torn mail with details about the issue and your browser/userscript manager.</li>
        </ol>
    </dd>
</dl>
<hr>

<div class="center">
    <h3>Torn Racing Telemetry</h3>
    <p>Provided under the MIT License. This script is not affiliated with or endorsed by Torn Ltd.</p>
    <p>For updates, bug reports, or feature requests, please visit the script's page on <a href="https://greasyfork.org/en/scripts/522245-torn-racing-telemetry" target="_blank" rel="noopener noreferrer">Greasy Fork</a> or contact the author.</p>
</div>

</body>
</html>
