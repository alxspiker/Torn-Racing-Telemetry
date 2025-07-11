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
        code { font-family: monospace; background: #eee; padding: 2px 4px; border-radius: 3px; }
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
    <li><a href="#api-tos">API Usage & Data Privacy (ToS)</a></li>
    <li><a href="#installation">Installation</a></li>
    <li><a href="#faq">FAQ</a></li>
</ul>
<hr>

<h2 id="overview">Overview</h2>
<p>
    <strong>Torn Racing Telemetry</strong> is a comprehensive userscript designed to significantly enhance the racing feature in Torn. It replaces the standard leaderboard with a dynamic, feature-rich interface, providing real-time telemetry data, detailed driver statistics (including API-fetched stats), advanced race performance analysis with charts, and personal racing skill/points history tracking. It integrates seamlessly into the Torn racing page, offering valuable insights without disrupting your experience.
</p>
<p>
    <strong>Version:</strong> See GreasyFork for the latest version.<br>
    <strong>Author:</strong> TheProgrammer [<a href="https://www.torn.com/profiles.php?XID=2782979" target="_blank" rel="noopener noreferrer">2782979</a>]
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
                    <li><strong>Customizable Display:</strong> Choose units (mph/kmh), data points, color-coding, and animations.</li>
                    <li><strong>Enhanced Driver List:</strong> Optional replacement for Torn's list, sorted by position.</li>
                    <li><strong>Click-to-View Details:</strong> Expand driver entries for detailed status, lap progress, and calculated metrics.</li>
                    <li><strong>Color Indicators:</strong> Quickly see driver position, status (racing, finished, crashed), and podium finishes.</li>
                </ul>
            </td>
            <td>
                <ul>
                    <li><strong>Driver API Stats:</strong> View Racing Skill, Points, Win Rate etc. on click <span class="api-required">(Requires API Key)</span>.</li>
                    <li><strong>Advanced Stats Panel:</strong> In-depth analysis of your historical race performance <span class="api-required">(Requires API Key)</span>.</li>
                    <li><strong>Historical Analysis:</strong> Overall win/podium/crash rates, performance breakdown by track and car.</li>
                    <li><strong>Track Analysis:</strong> View records for the current track/class and analyze top-performing cars <span class="api-required">(Requires API Key)</span>.</li>
                    <li><strong>Interactive Charts:</strong> Visualize performance trends using Chart.js.</li>
                </ul>
            </td>
             <td>
                <ul>
                    <li><strong>History Panel:</strong> Automatically logs changes in your Racing Skill, Class, and Points over time <span class="api-required">(API Key recommended for Points)</span>.</li>
                    <li><strong>Progression Chart:</strong> Visualize your skill and points progression.</li>
                    <li><strong>Configurable Settings:</strong> Fine-tune display, API key, history logging, and UI preferences.</li>
                    <li><strong>Info Panel:</strong> Access script version, author contact, and important usage notes.</li>
                    <li><strong>Race Results Export:</strong> Download or copy final race results in various formats (HTML, CSV, JSON, etc.).</li>
                </ul>
            </td>
        </tr>
    </tbody>
</table>

<h2 id="telemetry-display">Telemetry Display Explained</h2>
<p>The script adds a telemetry display next to each driver in the enhanced list during a race. Here's an example:</p>
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
            <td>RacerKing [44556]</td>
            <td>🏁 1:51.24 (~85 mph)</td>
            <td>Finished</td>
        </tr>
         <tr>
            <td>4</td>
            <td>CrashTest [77889]</td>
            <td>💥 CRASHED</td>
            <td>Crashed</td>
        </tr>
    </tbody>
</table>

<p><strong>Understanding the Display:</strong></p>
<ul>
    <li><strong>Speed:</strong> Current calculated speed in your chosen unit (mph or km/h).</li>
    <li><strong>Acceleration:</strong> Calculated g-forces. Positive (<span class="success-text">green</span>) for acceleration, negative (<span class="danger-text">red</span>) for braking/deceleration, <span class="neutral-text">grey</span> for neutral speed.</li>
    <li><strong>Est. Lap Time:</strong> (Optional) An estimated time remaining for the current lap, shown in parentheses <span class="neutral-text">(~X:XX)</span>.</li>
    <li><strong>Finished/Crashed Drivers:</strong> Clearly marked with status icons and text.</li>
</ul>

<h2 id="enhanced-driver-list">Enhanced Driver List</h2>
<p>When enabled (default), the script hides Torn's default leaderboard and presents its own dynamic list.</p>
<ul>
    <li>Displays driver position, color indicator, car image, name, and real-time telemetry.</li>
    <li>Highlights your own driver entry.</li>
    <li>Clicking on any driver entry expands it to show detailed information, including API-fetched stats if configured.</li>
</ul>

<h2 id="advanced-stats-panel">Advanced Stats Panel</h2>
<p>Accessible via the '📊 Stats' button <span class="api-required">(Requires API Key)</span>, this panel provides deep insights into your racing performance based on your recent official race history.</p>
<ul>
    <li><strong>Overall Performance Summary:</strong> Win rate, podium rate, crash rate, and more.</li>
    <li><strong>Performance by Track & Car:</strong> Tables and charts showing your stats for each track and car you've raced.</li>
    <li><strong>Current Track Analysis:</strong> View track records, analyze top-performing cars, and see stats for your currently selected car.</li>
</ul>

<h2 id="history-panel">History Panel</h2>
<p>Accessed via the '📜 History' button, this panel tracks your long-term racing progression.</p>
<ul>
    <li>Logs entries whenever a change in your Racing Skill or Class is detected.</li>
    <li>If an API key is provided, it also periodically checks and logs your Racing Points.</li>
    <li>Includes an interactive line chart visualizing your Skill and Points progression over time.</li>
</ul>

<h2 id="interface-controls">Interface Controls</h2>
<p>The script adds a control bar above the driver list:</p>
<pre><code>┌─────────┐   ┌───────────┐   ┌─────────┐   ┌──────────┐   ┌──────────┐
│ ℹ️ Info  │   │ 📜 History│   │ 📊 Stats│   │ 💾 Export│   │ ⚙ Settings│
└─────────┘   └───────────┘   └─────────┘   └──────────┘   └──────────┘</code></pre>
<ul>
    <li><strong>ℹ️ Info:</strong> Opens a panel with script details, version, and notes.</li>
    <li><strong>📜 History:</strong> (Visible if enabled) Opens the History Panel.</li>
    <li><strong>📊 Stats:</strong> (Visible if enabled) Opens the Advanced Stats Panel <span class="api-required">(Requires API Key)</span>.</li>
    <li><strong>💾 Export:</strong> (Visible after race finish) Opens a dialog to export race results.</li>
    <li><strong>⚙ Settings:</strong> Opens the Settings Panel to configure the script and your API key.</li>
</ul>

<h2 id="settings-panel">Settings Panel</h2>
<p>The settings panel allows full customization of the script's features, including:</p>
<ul>
    <li>Toggling the History and Stats panels on or off.</li>
    <li>Customizing the telemetry display (speed, acceleration, units, animations).</li>
    <li>Managing your Torn API Key for advanced features.</li>
    <li>Configuring data limits and check intervals for history logging and stats analysis.</li>
    <li>Toggling the enhanced driver list.</li>
</ul>

<h2 id="api-tos">API Usage & Data Privacy (Terms of Service)</h2>
<p>This script is designed with your privacy and security as a top priority. In compliance with Torn's API usage policies, here is a transparent breakdown of how your API key and data are handled:</p>
<table>
    <thead>
        <tr>
            <th>Data Storage</th>
            <th>Data Sharing</th>
            <th>Purpose of Use</th>
            <th>Key Storage & Sharing</th>
            <th>Key Access Level</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Only locally</strong></td>
            <td><strong>Nobody</strong></td>
            <td><strong>Non-malicious statistical analysis</strong></td>
            <td><strong>Stored locally / Not shared</strong></td>
            <td><strong>Custom Selections.</strong> A 'Limited Access' key is sufficient. Required selections are: <code>user (personalstats, races)</code> and <code>racing (tracks, cars, records)</code>.</td>
        </tr>
    </tbody>
</table>
<p><strong>In simple terms:</strong> Your API key and any data fetched with it are stored <strong>only on your own computer</strong> within your browser's secure storage. The data is never sent to, shared with, or stored by the script author or any third party.</p>


<h2 id="installation">Installation</h2>
<ol>
    <li>
        <strong>Install a Userscript Manager:</strong> If you don't have one, install a browser extension like Tampermonkey or Violentmonkey.
    </li>
    <li>
        <strong>Install the Script:</strong> Click the link below and your userscript manager should prompt you to install:
        <p class="center" style="margin: 15px 0;">
            <a href="https://greasyfork.org/en/scripts/522245-torn-racing-telemetry" target="_blank" rel="noopener noreferrer" style="font-size: 1.1em; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Install Torn Racing Telemetry from GreasyFork</a>
        </p>
    </li>
    <li>
        <strong>Configure (Optional but Recommended):</strong>
        <ul>
            <li>Navigate to the Torn racing page.</li>
            <li>Click the '⚙ Settings' button added by the script.</li>
            <li>Enter your Torn API Key (Limited Access recommended) to enable the Advanced Stats and History features.</li>
            <li><strong>For Torn PDA Users:</strong> The script will automatically detect the app and configure the API key for you. No manual entry is needed!</li>
        </ul>
    </li>
</ol>


<h2 id="faq">FAQ</h2>
<dl>
    <dt><strong>Does this script violate Torn's rules?</strong></dt>
    <dd>No. The script enhances the user interface and uses the official Torn API for data retrieval as intended. It fully complies with Torn's policies on scripting and API usage.</dd>

    <dt><strong>Is my API key safe?</strong></dt>
    <dd><strong>Yes.</strong> Your API key is stored locally in your browser's secure userscript storage. It is ONLY sent directly to the official Torn API (<code>api.torn.com</code>). For full details, please see the <a href="#api-tos">API Usage & Data Privacy</a> section above.</dd>
    
    <dt><strong>How does this work with the Torn PDA mobile app?</strong></dt>
    <dd>The script is fully compatible with Torn PDA. It automatically detects when it's running in the app and will configure itself to use the app's managed API key (<code>###PDA-APIKEY###</code>). This provides a seamless, zero-configuration experience for API-related features on mobile.</dd>

    <dt><strong>Why do I need an API key?</strong></dt>
    <dd>An API key is needed to fetch data specific to your account or detailed game information not available directly on the race page. The core telemetry display works without a key, but for the best experience (Advanced Stats, History Tracking), a key is required.</dd>

    <dt><strong>How accurate is the telemetry data?</strong></dt>
    <dd>The telemetry is calculated based on the progress percentage updates provided by the game. It's a sophisticated estimation and provides a good relative comparison between drivers. However, it's not based on the game's internal physics engine, so it should be used as a guideline.</dd>
    
    <dt><strong>The script isn't working after an update. What should I do?</strong></dt>
    <dd>First, try a hard refresh of the page (Ctrl+Shift+R or Cmd+Shift+R). If that doesn't work, go to the script's Settings panel and use the "Clear Script Data" button (this keeps your API key). If problems persist, contact the author.</dd>
</dl>
<hr>

<div class="center">
    <h3>Torn Racing Telemetry</h3>
    <p>Provided under the MIT License. This script is not affiliated with or endorsed by Torn Ltd.</p>
    <p>For updates, bug reports, or feature requests, please visit the script's page on <a href="https://greasyfork.org/en/scripts/522245-torn-racing-telemetry" target="_blank" rel="noopener noreferrer">Greasy Fork</a> or contact the author.</p>
</div>

</body>
</html>