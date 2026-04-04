    const Config = {
        defaults: {
            telemetryDisplayOptions: ['speed'],
            colorCode: true, animateChanges: true, speedUnit: 'mph',
            minUpdateInterval: 300, telemetryVisible: true, hideOriginalList: true, showLapEstimate: true,
            lapEstimateSmoothingFactor: 0.15, fetchApiStatsOnClick: true,
            historicalRaceLimit: 20,
            historyEnabled: true,
            statsPanelEnabled: true,
            speedSmoothingFactor: 0.7,
            maxAnimationDurationMs: 1000
        },
        data: {},
        storageKey: 'racingCustomUITelemetryConfig_v3.5.0', //never change or delete this comment unless absolutely game breaking update
        apiKeyStorageKey: 'racingCustomUITelemetryApiKey_persistent',

        load() {
            try {
                this.data = {...this.defaults, ...JSON.parse(GM_getValue(this.storageKey, '{}'))};
                this.data.apiKey = GM_getValue(this.apiKeyStorageKey, '');
            } catch (e) {
                this.data = {...this.defaults};
                this.data.apiKey = GM_getValue(this.apiKeyStorageKey, '');
            }
            for (const key in this.defaults) {
                if (!(key in this.data)) {
                    this.data[key] = this.defaults[key];
                }
            }
             if (!('speedSmoothingFactor' in this.data)) {
                this.data.speedSmoothingFactor = this.defaults.speedSmoothingFactor;
            }
             if (!('maxAnimationDurationMs' in this.data)) {
                this.data.maxAnimationDurationMs = this.defaults.maxAnimationDurationMs;
            }
            if ('animationLerpRate' in this.data) {
                delete this.data.animationLerpRate;
                this.save();
            }
            let hasDeprecatedHistoryKeys = false;
            ['historyCheckInterval', 'historyLogLimit'].forEach(key => {
                if (key in this.data) {
                    delete this.data[key];
                    hasDeprecatedHistoryKeys = true;
                }
            });
            if (hasDeprecatedHistoryKeys) {
                this.save();
            }
            return this.data;
        },
        save() {
            const dataToSave = { ...this.data };
            delete dataToSave.apiKey;
            GM_setValue(this.storageKey, JSON.stringify(dataToSave));
        },
        get(key) {
            return key in this.data ? this.data[key] : this.defaults[key];
        },
        set(key, value) {
            if (key === 'apiKey') {
                this.data.apiKey = value;
                GM_setValue(this.apiKeyStorageKey, value);
            } else {
                this.data[key] = value;
                this.save();
            }
        },
        async clearData() {
            const currentApiKey = GM_getValue(this.apiKeyStorageKey, '');
            this.data = { ...this.defaults };
            this.data.apiKey = currentApiKey;
            this.save();
        },
        clearApiKey() {
             this.data.apiKey = '';
             GM_deleteValue(this.apiKeyStorageKey);
        }
    };
    Config.load();
