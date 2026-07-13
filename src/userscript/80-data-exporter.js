    const DataExporter = {
        getFinalData() {
            const raceData = {
                 raceId: State.currentRaceId,
                 trackInfo: { ...State.trackInfo },
                 results: State.finalRaceData.map((driver, index) => ({
                     position: index + 1,
                     name: driver.name,
                     userId: driver.userId,
                     car: driver.carTitle,
                     status: driver.statusClass,
                     finalTimeOrStatus: driver.originalStatusText
                 }))
            };
            return raceData;
        },
        formatAsHTML() {
            const data = this.getFinalData();
            let tableRows = data.results.map(r => `
                <tr>
                    <td>${r.position}</td>
                    <td><a href="https://www.torn.com/profiles.php?XID=${r.userId}" target="_blank">${r.name} [${r.userId}]</a></td>
                    <td>${r.car}</td>
                    <td>${r.status === 'finished' ? r.finalTimeOrStatus : r.status.toUpperCase()}</td>
                </tr>`).join('');

            return `<!DOCTYPE html>
<html>
<head>
<title>Torn Race Results - ${data.trackInfo.name || 'Unknown Track'}</title>
<meta charset="UTF-8">
<style>
    body { font-family: sans-serif; line-height: 1.4; background-color: #f0f0f0; color: #333; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin-top: 15px; background-color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background-color: #e9e9e9; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    a { color: #007bff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    h1, h2 { color: #555; }
</style>
</head>
<body>
    <h1>Race Results</h1>
    <h2>Race ID: ${data.raceId || 'N/A'}</h2>
    <h2>Track: ${data.trackInfo.name || 'Unknown'} (${data.trackInfo.laps} Laps, ${data.trackInfo.length} Miles)</h2>
    <table>
        <thead>
            <tr><th>Pos</th><th>Driver</th><th>Car</th><th>Time/Status</th></tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>
    <p><small>Exported by Torn Racing Telemetry Script v${ScriptInfo.version}</small></p>
</body>
</html>`;
        },
        formatAsMarkdown() {
            const data = this.getFinalData();
            let md = `# Race Results\n\n`;
            md += `**Race ID:** ${data.raceId || 'N/A'}\n`;
            md += `**Track:** ${data.trackInfo.name || 'Unknown'} (${data.trackInfo.laps} Laps, ${data.trackInfo.length} Miles)\n\n`;
            md += `| Pos | Driver | Car | Time/Status |\n`;
            md += `|----:|--------|-----|-------------|\n`;
            data.results.forEach(r => {
                const driverLink = `[${r.name} [${r.userId}]](https://www.torn.com/profiles.php?XID=${r.userId})`;
                const status = r.status === 'finished' ? r.finalTimeOrStatus : r.status.toUpperCase();
                md += `| ${r.position} | ${driverLink} | ${r.car} | ${status} |\n`;
            });
            md += `\n*Exported by Torn Racing Telemetry Script v${ScriptInfo.version}*`;
            return md;
        },
         formatAsCSV() {
            const data = this.getFinalData();
            const esc = Utils.escapeCSVField;
            const header = ["Position", "Driver Name", "Driver ID", "Car Name", "Status", "Final Time/Status"];
            const rows = data.results.map(r => [
                r.position,
                r.name,
                r.userId,
                r.car,
                r.status,
                r.status === 'finished' ? r.finalTimeOrStatus : r.status.toUpperCase()
            ].map(esc).join(','));

            let csvString = `# Torn Race Results\n`;
            csvString += `# Race ID: ${esc(data.raceId || 'N/A')}\n`;
            csvString += `# Track: ${esc(data.trackInfo.name || 'Unknown')} (${data.trackInfo.laps} Laps, ${data.trackInfo.length} Miles)\n`;
            csvString += `# Exported: ${new Date().toISOString()}\n`;
            csvString += `# Script Version: ${ScriptInfo.version}\n`;
            csvString += header.map(esc).join(',') + '\n';
            csvString += rows.join('\n');
            return csvString;
        },
        formatAsPlainText() {
            const data = this.getFinalData();
            let txt = `Torn Race Results\n`;
            txt += `Race ID: ${data.raceId || 'N/A'}\n`;
            txt += `Track: ${data.trackInfo.name || 'Unknown'} (${data.trackInfo.laps} Laps, ${data.trackInfo.length} Miles)\n`;
            txt += `--------------------------------------------------\n`;
            data.results.forEach(r => {
                const status = r.status === 'finished' ? r.finalTimeOrStatus : r.status.toUpperCase();
                txt += `${String(r.position).padStart(3)}. ${r.name} [${r.userId}] (${r.car}) - ${status}\n`;
            });
            txt += `--------------------------------------------------\n`;
            txt += `Exported by Torn Racing Telemetry Script v${ScriptInfo.version}\n`;
            return txt;
        },
        getDetailedRaceFields() {
            const values = {};
            document.querySelectorAll('.car-selected.left .properties-wrap li, .car-selected.left div.cont-black.bottom-round > ul > li').forEach(item => {
                const title = item.querySelector('.properties > .title')?.textContent.trim();
                const separator = title?.indexOf(':');
                if (separator > 0) values[title.slice(0, separator).trim()] = title.slice(separator + 1).trim();
            });

            return {
                raceID: Number.parseInt(values.ID || State.currentRaceId, 10) || State.currentRaceId || null,
                raceName: values.Name || '', eventType: values.Type || '',
                timeCreated: values['Time created'] || '', timeStarted: values['Time started'] || '', timeEnded: values['Time ended'] || '',
                trackName: values.Track || State.trackInfo.name || '', lapsAmount: values.Laps || String(State.trackInfo.laps || ''),
                participantsAmount: values.Participants || String(State.finalRaceData.length), driversRequired: values['Drivers required'] || '',
                maximumDrivers: values['Maximum Drivers'] || '', carsAllowed: values['Cars allowed'] || '',
                upgradesAllowed: values['Upgrades allowed'] || '', betAmount: values['Bet amount'] || ''
            };
        },
        async formatAsJSON() {
            const liveDrivers = [...document.querySelectorAll('#leaderBoard > li[id^="lbr-"]')]
                .map(row => RaceManager.parseDriverData(row))
                .filter(Boolean);
            const drivers = liveDrivers.length ? liveDrivers : State.finalRaceData;
            if (!State.raceFinished || !drivers.length) throw new Error('JSON export is available after a race has finished.');

            Utils.showNotification('Preparing detailed JSON export…');
            const { results, skills } = await APIManager.raceData.getCompletedRaceData(drivers);
            const raceFields = this.getDetailedRaceFields();
            const skillGain = await APIManager.raceData.loadSkillGain(State.currentRaceId);
            const exportedAt = new Date().toISOString();

            // Core race-tracking fields stay at top level; telemetry adds
            // richer native details without complicating simple imports.
            const records = drivers.map((driver, index) => {
                const result = results.get(String(driver.userId));
                const crashed = Boolean(result?.crashed || driver.statusClass === 'crashed');
                const finishTime = crashed ? 'crashed' : (result?.displayTime || driver.originalStatusText || '');
                const inferredBestLap = !crashed && Number(raceFields.lapsAmount) === 1 ? Utils.parseTime(finishTime) : null;
                const bestLapSeconds = Number.isFinite(result?.bestLap) ? result.bestLap : inferredBestLap;
                const bestLap = crashed ? 'crashed' : (Number.isFinite(result?.bestLap)
                    ? Utils.formatTime(result.bestLap, true)
                    : (Number.isFinite(inferredBestLap) ? finishTime : 'N/A'));
                const racingSkill = skills.get(driver.userId);
                const driverSkillGain = String(driver.userId) === String(State.userId) && Number.isFinite(skillGain) ? skillGain : null;

                return {
                    userName: driver.name, position: result?.position || index + 1, finishTime, lapTime: bestLap,
                    racingSkill: Number.isFinite(racingSkill) ? String(racingSkill) : '', userID: String(driver.userId), carUsed: driver.carTitle,
                    ...raceFields,
                    telemetry: {
                        schemaVersion: ScriptInfo.version, exportedAt, status: driver.statusClass,
                        progressPercent: driver.statusClass === 'finished' ? 100 : driver.progress,
                        trackId: State.trackInfo.id ?? null, trackLength: State.trackInfo.length ?? null,
                        bestLapSeconds: Number.isFinite(bestLapSeconds) ? bestLapSeconds : null,
                        racingSkill: Number.isFinite(racingSkill) ? racingSkill : null,
                        skillGain: driverSkillGain,
                        // Preserve the information previously available in the
                        // native nested JSON export as well.
                        trackInfo: { ...State.trackInfo },
                        nativeResult: {
                            position: result?.position || index + 1,
                            name: driver.name,
                            userId: driver.userId,
                            car: driver.carTitle,
                            status: driver.statusClass,
                            finalTimeOrStatus: driver.originalStatusText
                        }
                    }
                };
            });
            return JSON.stringify(records, null, 2);
        },
        downloadData(dataString, fileExt, mimeType) {
            const blob = new Blob([dataString], { type: mimeType + ';charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const trackNameSafe = (State.trackInfo.name || 'UnknownTrack').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `torn_race_${State.currentRaceId || trackNameSafe}_${timestamp}.${fileExt}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
        copyToClipboard(text) {
             if (typeof GM_setClipboard !== 'undefined') {
                 GM_setClipboard(text);
             } else if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).catch(err => {
                     Utils.showNotification('Failed to copy to clipboard.', 'error');
                 });
             } else {
                Utils.showNotification('Clipboard copy not supported by browser/script manager.', 'error');
             }
        }
    };
