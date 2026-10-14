// Beta 5: equal-width secondary navigation and no empty band above the leaderboard.
    GM_addStyle(`
      #telemetryControlsContainer {
        box-sizing: border-box; width: 100%; margin-top: 0 !important;
        margin-bottom: 2px !important; padding: 0 !important;
        justify-content: stretch !important; align-items: stretch !important;
        flex-wrap: nowrap !important; overflow: hidden !important;
      }
      #telemetryControlsContainer > button {
        box-sizing: border-box; flex: 1 1 0 !important; min-width: 0 !important;
        max-width: none !important; width: 0; text-align: center !important;
      }
      #telemetryControlsContainer + #custom-driver-list-container { margin-top: 0 !important; }
      @media (hover: none), (pointer: coarse) {
        #telemetryControlsContainer > button:hover { background: transparent !important; box-shadow: none !important; }
      }
    `);
