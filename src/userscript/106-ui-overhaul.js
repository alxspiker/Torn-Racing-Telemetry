    // v4 visual layer: scoped to the userscript so Torn's own UI is unaffected.
    const RTT_V4_STYLES = `
      #custom-driver-list-container {
        border: 1px solid #35414e; border-radius: 12px; background: #141b23;
        scrollbar-color: #526576 #141b23; box-shadow: 0 6px 18px rgba(0,0,0,.18);
      }
      #custom-driver-list-container .custom-driver-item {
        border-bottom-color: rgba(189,202,219,.13); padding: 9px 10px;
        transition: background-color .14s ease;
      }
      #custom-driver-list-container .custom-driver-item:focus-visible {
        outline: 2px solid #8ed8ff; outline-offset: -3px;
      }
      #custom-driver-list-container .custom-driver-item.map-selected {
        padding-left: 7px; background: rgba(93,165,210,.15); border-left-color: #6ab9ed;
      }
      #custom-driver-list-container .driver-details-toggle {
        width: 38px; height: 38px; border-radius: 10px; margin-left: 8px;
        border: 1px solid rgba(182,202,222,.32); color: #ddf0ff;
        background: rgba(162,203,234,.08); font-size: 17px; font-weight: 600;
      }
      #custom-driver-list-container .driver-details-toggle:focus-visible,
      #custom-driver-list-container .driver-details-toggle:hover {
        border-color: #7abfec; background: rgba(110,185,234,.18);
      }
      #custom-driver-list-container .driver-name { color: #f1f5f9; }
      #custom-driver-list-container .driver-name .self-tag { color: #86cfb4; }
      #custom-driver-list-container .driver-progress-track { height: 3px; }
      #telemetryControlsContainer {
        display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;
        max-width: 100%; overflow-x: auto; overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: touch; scrollbar-width: thin; padding: 4px 0 8px;
      }
      #telemetryControlsContainer > button {
        white-space: nowrap; flex: 0 0 auto; min-height: 38px;
        border-radius: 9px; font-weight: 600;
      }
      body.rtt-inspector-open { overflow: hidden !important; }
      .rtt-inspector-backdrop {
        position: fixed; inset: 0; z-index: 2147483000;
        display: flex; align-items: flex-end; justify-content: center;
        background: rgba(5, 9, 14, .74); color: #eef4f9;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      }
      .rtt-inspector-backdrop[hidden] { display: none !important; }
      .rtt-inspector-panel {
        display: flex; flex-direction: column; width: 100%; height: min(83dvh, 760px);
        max-height: calc(100dvh - 12px); background: #151d26;
        border: 1px solid #344453; border-bottom: 0;
        border-radius: 20px 20px 0 0; box-sizing: border-box;
        box-shadow: 0 -16px 60px rgba(0,0,0,.45); overflow: hidden;
      }
      .rtt-inspector-panel * { box-sizing: border-box; }
      .rtt-inspector-grip { width: 34px; height: 4px; flex: 0 0 auto; border-radius: 4px;
        background: #536473; margin: 9px auto 0; }
      .rtt-inspector-header { display: flex; justify-content: space-between; gap: 15px;
        align-items: flex-start; padding: 14px 20px 16px; border-bottom: 1px solid #2c3945; }
      .rtt-inspector-identity { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
      .rtt-inspector-eyebrow { display: block !important; position: static !important; height: auto !important;
        line-height: 1.35 !important; margin: 0 !important; padding: 0 !important;
        color: #83a8bd !important; font-size: 10px !important; letter-spacing: .13em; font-weight: 750; }
      .rtt-inspector-name { display: block !important; position: static !important; height: auto !important;
        min-height: 0 !important; font-weight: 760 !important; color: #f4f8fc !important;
        font-size: clamp(20px, 5vw, 26px) !important; line-height: 1.25 !important;
        margin: 0 !important; padding: 0 !important; border: 0 !important; background: none !important;
        overflow-wrap: anywhere; }
      .rtt-inspector-subtitle { display: block !important; position: static !important; height: auto !important;
        color: #9fb0be !important; font-size: 12px !important; margin: 0 !important; padding: 0 !important;
        line-height: 1.45 !important; }
      .rtt-inspector-close { color: #cbd9e4; font-size: 29px; line-height: 1; background: #273340;
        border: 1px solid #425464; border-radius: 12px; width: 42px; height: 42px;
        cursor: pointer; flex-shrink: 0; }
      .rtt-inspector-close:hover, .rtt-inspector-close:focus-visible { background: #374c5c; outline: 2px solid #8dd0f9; }
      .rtt-inspector-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
        padding: 9px 14px 0; border-bottom: 1px solid #32404c; }
      .rtt-inspector-tab { cursor: pointer; border: 0; border-bottom: 3px solid transparent;
        background: transparent; color: #9aaebf; padding: 12px 8px 11px; font: inherit;
        font-size: 13px; font-weight: 650; border-radius: 7px 7px 0 0; }
      .rtt-inspector-tab[aria-selected="true"] { color: #def3ff; border-color: #76c4f5; background: #21303d; }
      .rtt-inspector-tab:focus-visible { outline: 2px solid #8dd0f9; outline-offset: -2px; }
      .rtt-inspector-content { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 18px 22px;
        overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
      .rtt-inspector-section { display: flex; flex-direction: column; gap: 15px; }
      .rtt-inspector-section-title { display: block !important; position: static !important; height: auto !important;
        line-height: 1.3 !important; margin: 0 !important; padding: 0 !important; border: 0 !important;
        background: none !important; font-size: 15px !important; font-weight: 700 !important; color: #e8f2fa !important; }
      .rtt-inspector-summary { padding: 17px; border: 1px solid #355468; border-radius: 13px;
        background: linear-gradient(120deg, #223b4b, #1b2a35); }
      .rtt-inspector-summary-overline { color: #8fb9d1; font-size: 10px; letter-spacing: .14em; font-weight: 700; }
      .rtt-inspector-summary-title { margin-top: 6px; font-size: 21px; font-weight: 700; color: #eef7fd; }
      .rtt-inspector-summary-sub { color: #afc3d1; margin-top: 4px; font-size: 12px; }
      .rtt-inspector-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .rtt-inspector-metric { min-height: 94px; padding: 14px 13px; border: 1px solid #354451;
        border-radius: 12px; background: #1b2630; display: flex; flex-direction: column; gap: 7px; }
      .rtt-inspector-metric.is-prominent { background: #203443; border-color: #416379; }
      .rtt-inspector-metric-label { color: #a6b9c9; letter-spacing: .025em; font-size: 11px; line-height: 1.3; }
      .rtt-inspector-metric-value { color: #f5f9fc; font-variant-numeric: tabular-nums;
        font-size: clamp(18px, 4.7vw, 25px); font-weight: 750; line-height: 1.1; overflow-wrap: anywhere; }
      .rtt-inspector-metric-note { color: #8c9eac; font-size: 10px; }
      .rtt-inspector-progress { display: grid; gap: 7px; }
      .rtt-inspector-progress-heading { display: flex; justify-content: space-between;
        color: #abbac8; font-size: 12px; font-variant-numeric: tabular-nums; }
      .rtt-inspector-progress-heading strong { color: #e9f3fa; }
      .rtt-inspector-progress-track { height: 7px; border-radius: 12px; background: #303e4b; overflow: hidden; }
      .rtt-inspector-progress-fill { background: #72c4f0; border-radius: 12px; height: 100%; transition: width .3s ease; }
      .rtt-inspector-info { margin: 0; font-size: 12px; color: #a8bac7; line-height: 1.6; }
      .rtt-inspector-profile, .rtt-inspector-retry { align-self: flex-start;
        padding: 10px 14px; background: #223647; border: 1px solid #49758d; border-radius: 8px;
        color: #a6dfff; font-size: 13px; text-decoration: none; cursor: pointer; }
      .rtt-inspector-footer { flex: 0 0 auto; border-top: 1px solid #2f3e4c;
        color: #8597a6; font-size: 10px; line-height: 1.3;
        padding: 11px 18px max(11px, env(safe-area-inset-bottom, 0px)); }
      /* The other large panels reuse the same responsive surface, not a 95vw overflow box. */
      .settings-popup, .stats-panel, .history-panel, .info-panel, .download-popup {
        z-index: 2147482000; box-sizing: border-box; padding: 10px;
      }
      .settings-popup-content, .stats-panel-content, .history-panel-content,
      .info-panel-content, .download-popup-content {
        box-sizing: border-box; border-radius: 15px; width: min(100%, 860px);
        max-width: 860px; height: auto; max-height: min(90dvh, 940px); border-color: #374553;
        background: #161e27; box-shadow: 0 22px 70px rgba(0,0,0,.5);
      }
      .settings-popup-content { max-width: 600px; }
      .stats-panel-content, .history-panel-content { max-width: 930px; }
      .stats-content table, .history-content table { min-width: 560px; }
      .stats-content, .history-content { overflow-x: auto; }
      .stats-summary-card, .history-summary-card { border-radius: 11px; padding: 13px; }
      .settings-item input, .settings-item select { min-height: 40px; }
      .stats-close, .history-close, .settings-close, .download-close, .info-close { min-width: 38px; min-height: 38px; }
      @media (min-width: 850px) {
        .rtt-inspector-backdrop { align-items: stretch; justify-content: flex-end; }
        .rtt-inspector-panel { height: 100dvh; max-height: 100dvh; width: min(460px, 42vw);
          border-radius: 18px 0 0 18px; border: 0; border-left: 1px solid #3b5363; }
        .rtt-inspector-grip { display: none; }
        .rtt-inspector-header { padding-top: 24px; }
      }
      @media (max-width: 600px) {
        .rtt-inspector-panel { height: min(83dvh, 780px); }
        .rtt-inspector-header { padding: 12px 16px 14px; }
        .rtt-inspector-content { padding: 16px 14px; }
        .settings-popup, .stats-panel, .history-panel, .info-panel, .download-popup {
          padding: 0; align-items: flex-end;
        }
        .settings-popup-content, .stats-panel-content, .history-panel-content,
        .info-panel-content, .download-popup-content {
          width: 100%; height: auto; max-height: 94dvh;
          flex: 0 1 auto; min-height: 0;
          border-radius: 18px 18px 0 0; border-bottom: none; padding: 18px 14px;
        }
        .history-summary-cards, .stats-summary-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        #custom-driver-list-container { max-height: none; }
        #custom-driver-list-container .driver-name { min-width: 0; }
        #custom-driver-list-container .driver-details-toggle { width: 38px; height: 38px; }
      }
      /* Touch layout: six collapsed racers fit without scrolling the leaderboard. */
      @media (hover: none), (pointer: coarse) {
        #custom-driver-list-container {
          max-height: none !important;
          overflow-y: visible !important;
          -webkit-overflow-scrolling: auto;
        }
        #custom-driver-list-container .custom-driver-item {
          padding: 3px 8px 5px;
          min-height: 48px;
          transition: none;
        }
        #custom-driver-list-container .custom-driver-item.map-selected { padding-left: 5px; }
        #custom-driver-list-container .driver-info-row { min-height: 38px; }
        #custom-driver-list-container .driver-details-toggle { width: 34px; height: 34px; }
        #custom-driver-list-container .driver-progress-bars { margin-top: 2px; margin-bottom: -5px; }
        #custom-driver-list-container .custom-driver-item:hover,
        #custom-driver-list-container .custom-driver-item.map-selected:hover {
          filter: none;
          background-color: transparent;
        }
        #custom-driver-list-container .custom-driver-item.map-selected:hover {
          background-color: rgba(93,165,210,.15);
        }
      }
      /* iOS Safari can retain :hover after a tap or while scrolling. Only enable
         hover styling on devices with an actual hover-capable fine pointer. */
      @media (hover: none) {
        .telemetry-info-button:hover, .telemetry-history-button:hover,
        .telemetry-stats-button:hover, .telemetry-settings-button:hover,
        .telemetry-download-button:hover, .driver-details-toggle:hover,
        .rtt-inspector-close:hover, .settings-close:hover, .stats-close:hover,
        .history-close:hover, .info-close:hover, .download-close:hover,
        .history-clear-button:hover, .download-content button:hover,
        .download-content button.primary:hover, .history-sort-btn:hover,
        .stats-sort-btn:hover, .settings-btn:hover, .settings-btn.primary:hover,
        .settings-btn.danger:hover {
          filter: none;
          box-shadow: none;
          text-decoration: none;
          background-color: var(--background-light);
        }
        .settings-content a:hover, .stats-content a:hover,
        .history-content a:hover, .info-content a:hover,
        .download-content a:hover, .api-tos-container a:hover {
          text-decoration: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .rtt-inspector-panel *, #custom-driver-list-container * { transition-duration: .01ms !important; animation: none !important; }
      }
    `;
