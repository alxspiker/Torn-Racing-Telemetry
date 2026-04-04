    const StatsCalculator = {
        processRaceData(races, userId) {
            if (!races || races.length === 0 || !userId) {
                return {
                    overall: { races: 0, wins: 0, podiums: 0, crashes: 0, positionSum: 0, winRate: 0, podiumRate: 0, crashRate: 0, avgPosition: 0 },
                    trackStats: {},
                    carStats: {},
                    totalRaces: 0,
                    firstRaceTime: null,
                    lastRaceTime: null
                };
            }
            const overall = { races: 0, wins: 0, podiums: 0, crashes: 0, positionSum: 0 };
            const trackStats = {};
            const carStats = {};
            let firstRaceTime = Infinity;
            let lastRaceTime = 0;
            races.forEach(race => {
                if (race.status !== 'finished' || !race.results) return;
                const userResult = race.results.find(r => r.driver_id == userId);
                if (!userResult) return;
                overall.races++;
                const raceTime = race.schedule?.end || 0;
                if (raceTime > 0) {
                    firstRaceTime = Math.min(firstRaceTime, raceTime * 1000);
                    lastRaceTime = Math.max(lastRaceTime, raceTime * 1000);
                }
                const trackId = race.track_id;
                const carName = userResult.car_item_name || 'Unknown Car';
                const trackName = State.trackNameMap?.[trackId] || `Track ${trackId}`;
                if (!trackStats[trackId]) trackStats[trackId] = { name: trackName, races: 0, wins: 0, podiums: 0, crashes: 0, positionSum: 0, bestLap: Infinity };
                if (!carStats[carName]) carStats[carName] = { name: carName, races: 0, wins: 0, podiums: 0, crashes: 0, positionSum: 0 };
                trackStats[trackId].races++;
                carStats[carName].races++;
                if (userResult.has_crashed) {
                    overall.crashes++;
                    trackStats[trackId].crashes++;
                    carStats[carName].crashes++;
                } else {
                    const position = userResult.position;
                    overall.positionSum += position;
                    trackStats[trackId].positionSum += position;
                    carStats[carName].positionSum += position;
                    if (position === 1) {
                        overall.wins++;
                        trackStats[trackId].wins++;
                        carStats[carName].wins++;
                    }
                    if (position <= 3) {
                        overall.podiums++;
                        trackStats[trackId].podiums++;
                        carStats[carName].podiums++;
                    }
                    if (userResult.best_lap_time && userResult.best_lap_time < trackStats[trackId].bestLap) {
                        trackStats[trackId].bestLap = userResult.best_lap_time;
                    }
                }
            });
            const calcRates = (stats) => {
                const finishedRaces = stats.races - stats.crashes;
                stats.winRate = finishedRaces > 0 ? (stats.wins / finishedRaces) * 100 : 0;
                stats.podiumRate = finishedRaces > 0 ? (stats.podiums / finishedRaces) * 100 : 0;
                stats.crashRate = stats.races > 0 ? (stats.crashes / stats.races) * 100 : 0;
                stats.avgPosition = finishedRaces > 0 ? (stats.positionSum / finishedRaces) : 0;
                return stats;
            };
            calcRates(overall);
            Object.values(trackStats).forEach(calcRates);
            Object.values(carStats).forEach(calcRates);
            return { overall, trackStats, carStats, totalRaces: overall.races, firstRaceTime: firstRaceTime === Infinity ? null : firstRaceTime, lastRaceTime: lastRaceTime === 0 ? null : lastRaceTime };
        },
        processTrackRecords(records) { if (!records || records.length === 0) return []; const carCounts = {}; records.forEach(rec => { if (!carCounts[rec.car_item_id]) { carCounts[rec.car_item_id] = { car_item_id: rec.car_item_id, car_item_name: rec.car_item_name, count: 0 }; } carCounts[rec.car_item_id].count++; }); return Object.values(carCounts).sort((a, b) => b.count - a.count); }
    };
