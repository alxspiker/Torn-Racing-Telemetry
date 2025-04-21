# 🏎️ Torn Racing Telemetry

> Enhance your Torn racing experience with real-time telemetry, detailed stats, and race history tracking

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Telemetry in Action](#telemetry-in-action)
- [Interface Controls](#interface-controls)
- [Settings Panel](#settings-panel)
- [Stats History](#stats-history)
- [Recent Races](#recent-races)
- [Installation](#installation)
- [Usage Guide](#usage-guide)
- [FAQ](#faq)

---

## Overview

Torn Racing Telemetry is a userscript that enhances the racing feature in Torn with real-time telemetry data, racing statistics history, and detailed race information. It provides valuable insights into your racing performance and helps you track your progress over time.

The script seamlessly integrates with the Torn racing interface, providing valuable data without disrupting your racing experience. By displaying real-time speed and acceleration information, you can better understand your car's performance and make more informed racing decisions.

---

## Key Features

| 📊 **Real-time Telemetry** | 📈 **Stats History** | 🏁 **Race Logs** |
|:--------------------------|:---------------------|:-----------------|
| View real-time speed and acceleration data for all drivers in the race. See how your car performs against the competition. | Track changes in your racing skill, points, and race participation over time. Monitor your progress. | Keep detailed records of your recent races, including track information, positions, and performance. |

| 🔧 **Customizable Display** | 🎨 **Visual Enhancements** | 🏎️ **Car Information** |
|:---------------------------|:--------------------------|:------------------------|
| Configure telemetry display to show speed, acceleration, or both. Choose your preferred units. | Color-coded acceleration values and smooth animations provide intuitive visual feedback. | View detailed information about your current car, including stats and performance metrics. |

---

## Telemetry in Action

The telemetry display shows real-time information next to each driver's name during a race. Here's what it looks like:

| Pos | Driver | Time | Progress |
|:---:|:-------|-----:|--------:|
| 1 | JohnRacer <span style="color:#4CAF50">95 mph \| 0.5 g</span> | 1:45.32 | 84% |
| 2 | SpeedDemon <span style="color:#F44336">88 mph \| -0.8 g</span> | 1:46.18 | 82% |
| 3 | FastLane <span style="color:#888888">91 mph \| 0.2 g</span> | 1:46.75 | 81% |
| 4 | RacingKing 🏁 85 mph | 1:51.24 | 75% |

### Understanding the Telemetry Display

- **Speed:** Shows the current speed in your preferred unit (mph or km/h)
- **Acceleration:** Displayed in g-forces, with positive values (green) for acceleration and negative values (red) for braking
- **Finished Drivers:** Marked with a checkered flag 🏁 and their average speed for the race
- **Color Coding:** Green for acceleration, red for braking, and grey for neutral/steady speed

---

## Interface Controls

The script adds a control panel to the racing interface with three main buttons:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │   Settings  │ │ Stats History│ │ Recent Races │  │
│  └─────────────┘ └──────────────┘ └──────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Control Panel Functions

- **Settings:** Configure telemetry display options, units, and API integration
- **Stats History:** View your racing stats history and track changes over time
- **Recent Races:** See detailed information about your recent races, including track data and results

---

## Settings Panel

The Settings panel allows you to customize the telemetry display and other features:

<table>
<tr>
<th colspan="2" align="left">RACING TELEMETRY SETTINGS</th>
<th align="right"><kbd>Close</kbd></th>
</tr>
<tr><td colspan="3"><strong>Display Options</strong></td></tr>
<tr>
<td>Display Mode</td>
<td colspan="2">
<select>
<option selected>Speed</option>
<option>Acceleration</option>
<option>Both</option>
</select>
</td>
</tr>
<tr>
<td>Color Coding</td>
<td colspan="2">
<label>
[x] Enabled
</label>
</td>
</tr>
<tr>
<td>Animations</td>
<td colspan="2">
<label>
[x] Enabled
</label>
</td>
</tr>
<tr>
<td>Speed Unit</td>
<td colspan="2">
<select>
<option selected>mph</option>
<option>km/h</option>
</select>
</td>
</tr>
<tr><td colspan="3"><strong>API Integration</strong></td></tr>
<tr>
<td>API Key</td>
<td colspan="2">
<input type="password" value="•••••••••••••••••">
</td>
</tr>
<tr>
<td colspan="3"><small>Your Torn API key is used to fetch racing statistics and race history.</small></td>
</tr>
</table>

### Available Settings

- **Display Mode:** Choose to display speed, acceleration, or both
- **Color Coding:** Enable/disable color-coded acceleration values
- **Animations:** Enable/disable smooth animations for telemetry changes
- **Speed Unit:** Select your preferred speed unit (mph or km/h)
- **API Key:** Enter your Torn API key to enable stats history and race log functionality

---

## Stats History

The Stats History panel shows your current racing stats and tracks changes over time:

### Current Racing Stats

<table>
<tr>
<th colspan="4" align="center">Current Racing Stats</th>
</tr>
<tr align="center">
<td><strong>Racing Skill</strong><br>85.4</td>
<td><strong>Racing Points</strong><br>12,482</td>
<td><strong>Races Entered</strong><br>342</td>
<td><strong>Races Won</strong><br>167</td>
</tr>
</table>

### Stats History Entries

<table>
<tr>
<th colspan="4" align="left">Apr 9, 2025, 2:45 PM</th>
</tr>
<tr>
<td><strong>Racing Skill</strong><br><span style="color:#4CAF50">84.8 → 85.4 (+0.6)</span></td>
<td><strong>Racing Points</strong><br><span style="color:#4CAF50">12,427 → 12,482 (+55)</span></td>
<td><strong>Races Entered</strong><br><span style="color:#4CAF50">341 → 342 (+1)</span></td>
<td><strong>Races Won</strong><br><span style="color:#4CAF50">166 → 167 (+1)</span></td>
</tr>
</table>

<table>
<tr>
<th colspan="4" align="left">Apr 8, 2025, 8:12 PM</th>
</tr>
<tr>
<td><strong>Racing Skill</strong><br><span style="color:#4CAF50">84.2 → 84.8 (+0.6)</span></td>
<td><strong>Racing Points</strong><br><span style="color:#4CAF50">12,372 → 12,427 (+55)</span></td>
<td><strong>Races Entered</strong><br><span style="color:#4CAF50">339 → 341 (+2)</span></td>
<td><strong>Races Won</strong><br><span style="color:#4CAF50">165 → 166 (+1)</span></td>
</tr>
</table>

---

## Recent Races

The Recent Races panel shows detailed information about your last 10 races:

<table>
<tr>
<th align="left">Midtown Circuit - Off race by TornUser123</th>
<th align="right">ID: 12345678</th>
</tr>
<tr>
<td colspan="2">
<table>
<tr>
<td><strong>Track:</strong> Midtown Circuit (3.7mi)</td>
<td><strong>Status:</strong> <span style="background:#4CAF50;color:white;padding:2px 6px;border-radius:3px;">Finished</span></td>
</tr>
<tr>
<td><strong>Laps:</strong> 5</td>
<td><strong>Position:</strong> 2/8</td>
</tr>
<tr>
<td><strong>Participants:</strong> 8/10</td>
<td><strong>Start Time:</strong> Apr 9, 2025, 1:30 PM</td>
</tr>
<tr>
<td colspan="2"><strong>Description:</strong> <em>A challenging track with tight corners and short straights through the city.</em></td>
</tr>
</table>
</td>
</tr>
</table>

### Race Information

For each race, the panel displays:

- **Race Title and ID:** The name of the race and its unique identifier
- **Track Information:** Track name, length, and description
- **Race Status:** Current status of the race (Finished, Active, Scheduled)
- **Your Position:** Your finishing position in the race
- **Participants:** Number of drivers in the race
- **Start Time:** When the race began

---

## Installation

To install the Torn Racing Telemetry userscript, follow these steps:

### 1. Install a Userscript Manager

First, you need to install a userscript manager extension for your browser:

- For Chrome: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- For Firefox: [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- For Edge: [Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### 2. Install the Script

Click on this installation link to add the script to your userscript manager:

[Install Torn Racing Telemetry from Greasyfork](https://greasyfork.org/en/scripts/522245-torn-racing-telemetry)

Alternatively, you can copy the script code and manually create a new script in your userscript manager.

### 3. Configure the Script

After installation:

- Go to Torn's racing page
- Click on the "Settings" button in the script control panel
- Enter your Torn API key to enable stats history and race logs
- Customize other settings according to your preferences

---

## Usage Guide

Here's how to use the Torn Racing Telemetry script effectively:

### Basic Usage

- The telemetry information will automatically appear next to driver names during races
- Use the control panel buttons at the top of the racing page to access settings, stats history, and race logs
- The telemetry display can be temporarily hidden using the "Hide Telemetry" button in settings

### Racing Strategy

- Monitor your speed and acceleration to optimize your racing line
- Watch for negative acceleration values (red) when approaching corners to gauge braking points
- Use the estimated lap time feature to plan your racing strategy
- Compare your telemetry with other drivers to learn from top performers

### Tracking Progress

- Regularly check your Stats History to track improvements in your racing skill
- Review Recent Races to identify patterns in your performance on different tracks
- Use the detailed track information to better prepare for future races on the same tracks

---

## FAQ

### Does this script violate Torn's rules?

No, this script only enhances the user interface and uses the official Torn API for data retrieval. It doesn't automate gameplay or provide unfair advantages.

### Is my API key safe to use with this script?

Yes, your API key is stored locally in your browser and is only used to fetch data from Torn's official API. The script doesn't transmit your key to any third-party servers.

### Why do I need to provide an API key?

The API key is required to fetch your racing statistics and race history from Torn's API. Without it, the stats history and race logs features won't work, but the telemetry display will still function.

### How accurate is the telemetry data?

The telemetry data is calculated based on changes in progress percentage and timing information. While it provides a good approximation, it's not as precise as actual in-game physics calculations. It's most useful for relative comparisons and trend analysis.

### The script isn't working after an update. What should I do?

Try these troubleshooting steps:
1. Refresh the page
2. Clear your browser cache
3. Click the "Reset System" button in the Settings panel
4. Reinstall the script from Greasyfork

---

<div align="center">

### Torn Racing Telemetry

This userscript is provided under the MIT License. It is not affiliated with or endorsed by Torn.

For updates, bug reports, or feature requests, please visit the script's Greasyfork page.

[View on Greasyfork](https://greasyfork.org/en/scripts/522245-torn-racing-telemetry)

</div>
