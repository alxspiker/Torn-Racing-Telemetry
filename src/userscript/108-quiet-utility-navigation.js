    // Keep secondary actions visually subordinate to the live leaderboard.
    GM_addStyle(`
      #telemetryControlsContainer {
        display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;
        gap: 0; margin: 0 0 2px; padding: 0; width: 100%; max-width: 100%; overflow: hidden;
        background: transparent; border: 0; box-shadow: none;
      }
      #telemetryControlsContainer > :is(.telemetry-info-button, .telemetry-history-button,
        .telemetry-stats-button, .telemetry-settings-button, .telemetry-download-button) {
        flex: 1 1 0; min-width: 0; min-height: 34px; padding: 6px 2px; margin: 0; text-align: center;
        border: 1px solid transparent; border-radius: 6px;
        background: transparent; box-shadow: none; color: #9aafbd;
        font: 500 11px/1.25 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0; text-shadow: none; transition: none;
        -webkit-tap-highlight-color: transparent;
      }
      #telemetryControlsContainer > .telemetry-settings-button {
        margin-left: 0; border-left-color: transparent; border-radius: 6px;
      }
      #telemetryControlsContainer > :is(.telemetry-info-button, .telemetry-history-button,
        .telemetry-stats-button, .telemetry-settings-button, .telemetry-download-button):focus-visible {
        outline: 2px solid #83b9dc; outline-offset: 1px;
      }
      @media (hover: hover) and (pointer: fine) {
        #telemetryControlsContainer > :is(.telemetry-info-button, .telemetry-history-button,
          .telemetry-stats-button, .telemetry-settings-button, .telemetry-download-button):hover {
          color: #e2eff8; background: #293744; border-color: #405260;
        }
      }
      @media (hover: none), (pointer: coarse) {
        #telemetryControlsContainer > :is(.telemetry-info-button, .telemetry-history-button,
          .telemetry-stats-button, .telemetry-settings-button, .telemetry-download-button),
        #telemetryControlsContainer > :is(.telemetry-info-button, .telemetry-history-button,
          .telemetry-stats-button, .telemetry-settings-button, .telemetry-download-button):hover,
        #telemetryControlsContainer > :is(.telemetry-info-button, .telemetry-history-button,
          .telemetry-stats-button, .telemetry-settings-button, .telemetry-download-button):active {
          color: #9aafbd; background: transparent; box-shadow: none;
        }
      }
      @media (max-width: 480px) {
        #telemetryControlsContainer { flex-wrap: nowrap; gap: 0; justify-content: stretch; }
        #telemetryControlsContainer > :is(.telemetry-info-button, .telemetry-history-button,
          .telemetry-stats-button, .telemetry-settings-button, .telemetry-download-button) {
          flex: 1 1 0; min-width: 0; min-height: 34px; padding: 6px 2px; font-size: 11px;
        }
      }
    `);
