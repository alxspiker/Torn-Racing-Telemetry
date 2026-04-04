    const Utils = {
        convertSpeed(speed, unit) { return unit === 'kmh' ? speed * 1.60934 : speed; },
        formatTime(seconds, showMs = false) { if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '--:--' + (showMs ? '.---' : ''); const min = Math.floor(seconds / 60); const sec = Math.floor(seconds % 60); const ms = showMs ? '.' + (seconds % 1).toFixed(3).substring(2) : ''; return `${min}:${sec < 10 ? '0' : ''}${sec}${ms}`; },
        sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); },
        formatDate(timestamp, includeTime = false) {
            if (!timestamp || timestamp <= 0) return 'N/A';
            try {
                const date = new Date(timestamp);
                const dateString = date.toISOString().split('T')[0];
                if (includeTime) {
                    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                    return `${dateString} ${timeString}`;
                }
                return dateString;
            } catch (e) {
                return 'N/A';
            }
        },
        isApiKeyAvailable() {
            const apiKey = Config.get('apiKey');
            if (!apiKey) return false;
            if (apiKey.trim() !== '###PDA-APIKEY###') return true;
            return isPDA;
        },
        parseTime(timeString) { if (!timeString?.includes(':')) return 0; const parts = timeString.split(':'); if (parts.length === 2) { return (parseInt(parts[0], 10) || 0) * 60 + (parseFloat(parts[1]) || 0); } return 0; },
        parseProgress(text) { const match = text?.match(/(\d+\.?\d*)%/); return match ? parseFloat(match[1]) : 0; },
        makeAbsoluteUrl(url) { if (!url || url.startsWith('http') || url.startsWith('data:')) return url; if (url.startsWith('//')) return `${window.location.protocol}${url}`; if (url.startsWith('/')) return `${window.location.protocol}//${window.location.host}${url}`; const base = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')); return `${window.location.protocol}//${window.location.host}${base}/${url}`; },
        showNotification(message, type = 'info') { const notif = document.createElement('div'); notif.style.cssText = `position: fixed; bottom: 20px; right: 20px; background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'}; color: white; padding: 12px 20px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 9999; font-size: 14px; opacity: 0; transition: opacity 0.3s ease-in-out;`; notif.textContent = message; document.body.appendChild(notif); setTimeout(() => notif.style.opacity = '1', 10); setTimeout(() => { notif.style.opacity = '0'; setTimeout(() => notif.remove(), 300); }, 3000); },
        createElement(tagName, options = {}) {
            const element = document.createElement(tagName);
            const { className, text, html, attrs, dataset, children } = options;

            if (className) {
                element.className = className;
            }
            if (typeof text !== 'undefined') {
                element.textContent = text;
            } else if (typeof html !== 'undefined') {
                element.innerHTML = html;
            }
            if (attrs && typeof attrs === 'object') {
                Object.entries(attrs).forEach(([key, value]) => {
                    if (value !== null && typeof value !== 'undefined') {
                        element.setAttribute(key, String(value));
                    }
                });
            }
            if (dataset && typeof dataset === 'object') {
                Object.entries(dataset).forEach(([key, value]) => {
                    if (value !== null && typeof value !== 'undefined') {
                        element.dataset[key] = String(value);
                    }
                });
            }
            if (Array.isArray(children)) {
                children.filter(Boolean).forEach(child => element.appendChild(child));
            }

            return element;
        },
        createChart(ctx, config) {
             if (!ctx || typeof Chart === 'undefined') return null;
             try {
                 Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
                 const chart = new Chart(ctx, config);
                 State.activeCharts.push(chart);
                 return chart;
             } catch(e) {
                return null;
             }
         },
         escapeCSVField(field) {
            if (field === null || field === undefined) {
                return '';
            }
            const stringField = String(field);
            if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                return `"${stringField.replace(/"/g, '""')}"`;
            }
            return stringField;
        }
    };
