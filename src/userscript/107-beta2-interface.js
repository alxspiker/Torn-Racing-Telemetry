    // Beta 2: coherent responsive layout, with no selectors targeting Torn's global UI.
    const RTT_BETA2_STYLES = `
      .rtt-inspector-backdrop { background: rgba(6, 10, 15, .48); }
      .rtt-inspector-panel {
        height: min(67dvh, 640px); background: #171d24;
        border-color: #384553; border-radius: 18px 18px 0 0;
        transition: height 180ms ease;
      }
      .rtt-inspector-panel.is-expanded { height: min(95dvh, 900px); }
      .rtt-inspector-header { align-items: center; padding: 12px 16px 12px; gap: 10px; }
      .rtt-inspector-identity { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
      .rtt-inspector-eyebrow { display: block !important; position: static !important; height: auto !important;
        line-height: 1.35 !important; margin: 0 !important; font-size: 10px !important;
        letter-spacing: .1em; color: #91aab9 !important; }
      .rtt-inspector-name { display: block !important; position: static !important; height: auto !important;
        margin: 0 !important; padding: 0 !important; font-size: 20px !important;
        line-height: 1.25 !important; color: #f4f8fc !important; }
      .rtt-inspector-subtitle { display: block !important; position: static !important; height: auto !important;
        margin: 0 !important; font-size: 12px !important; line-height: 1.4 !important; color: #9fb0be !important; }
      .rtt-inspector-actions { display: flex; align-items: center; gap: 7px; flex: 0 0 auto; }
      .rtt-inspector-expand { background: #27323d; border: 1px solid #475664; border-radius: 8px;
        color: #dbe8f1; min-height: 36px; padding: 0 10px; font-size: 12px; cursor: pointer; }
      .rtt-inspector-close { width: 37px; height: 37px; border-radius: 9px; font-size: 25px; }
      .rtt-inspector-tabs { padding: 3px 12px 0; gap: 3px; }
      .rtt-inspector-tab { padding: 9px 5px; min-height: 40px; }
      .rtt-inspector-content { padding: 12px 14px 16px; }
      .rtt-inspector-section { gap: 10px; }
      .rtt-inspector-summary { padding: 12px 14px; border-radius: 10px; background: #1d303b; }
      .rtt-inspector-summary-overline { font-size: 9px; }
      .rtt-inspector-summary-title { font-size: 17px; margin-top: 4px; }
      .rtt-inspector-summary-sub { font-size: 11px; margin-top: 3px; }
      .rtt-inspector-grid { gap: 7px; }
      .rtt-inspector-metric { min-height: 68px; padding: 10px 12px; border-radius: 9px; gap: 5px; }
      .rtt-inspector-metric-label { font-size: 10px; }
      .rtt-inspector-metric-value { font-size: clamp(17px, 4.4vw, 23px); }
      .rtt-inspector-metric-note { font-size: 9px; }
      .rtt-inspector-footer { padding: 7px 14px max(9px, env(safe-area-inset-bottom, 0px)); font-size: 9px; }
      .rtt-panel-workspace { min-width: 0; }
      .rtt-panel-navigation { display: flex; align-items: stretch; position: sticky; top: 0; z-index: 3;
        gap: 4px; padding: 4px; background: #202933; border: 1px solid #364653;
        border-radius: 11px; margin-bottom: 14px; }
      .rtt-panel-nav-button { flex: 1; min-width: 0; min-height: 40px; border: 0; border-radius: 8px;
        padding: 8px 8px; background: transparent; color: #abbecb; cursor: pointer;
        font: 600 12px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; white-space: nowrap; }
      .rtt-panel-nav-button[aria-selected="true"] { background: #344c5d; color: #f0f8fd;
        box-shadow: inset 0 0 0 1px #4a728b; }
      .rtt-panel-nav-button:focus-visible { outline: 2px solid #8cd5ff; outline-offset: -2px; }
      .rtt-panel-section[hidden] { display: none !important; }
      .rtt-panel-section { min-width: 0; }
      .settings-popup-content, .stats-panel-content, .history-panel-content,
      .info-panel-content, .download-popup-content {
        background: #171e26; color: #e7eff6; overflow: hidden; display: flex; flex-direction: column;
        font: 13px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .settings-title, .stats-title, .history-title, .info-title, .download-title {
        position: relative; flex: 0 0 auto; padding: 2px 0 12px; margin: 0;
        font-size: 17px; color: #e5f1fb; letter-spacing: -.015em;
      }
      .settings-content, .stats-content, .history-content, .info-content, .download-content {
        min-height: 0; flex: 1 1 auto; overflow-y: auto; overflow-x: hidden;
        padding: 12px 1px 18px; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
      }
      .settings-item { background: #202a35; border: 1px solid #344453; border-radius: 10px;
        padding: 11px 12px; margin: 0 0 9px; }
      .settings-item label:not(.switch) { font-size: 12px; font-weight: 600; }
      .settings-item small { line-height: 1.45; }
      .settings-content .toggle-container { min-height: 30px; }
      .settings-content .telemetry-options-group { border: 0; background: transparent; padding: 0; }
      .settings-content .rtt-settings-group { display: grid; gap: 1px; }
      .rtt-panel-footer-actions { flex: 0 0 auto; display: flex; flex-wrap: wrap;
        gap: 8px; padding: 12px 0 0; border-top: 1px solid #344453; margin-top: 0; }
      .rtt-panel-footer-actions button { flex: 1; min-height: 41px; }
      .settings-data-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
      .settings-data-buttons button { flex: 1; min-height: 38px; }
      .stats-content h3, .history-content h3 { font-size: 15px; border-bottom: 0; color: #e5f0f8;
        margin: 17px 0 10px; }
      .stats-content h4 { font-size: 13px; }
      .stats-summary-cards, .stats-delta-cards, .history-summary-cards {
        grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .stats-summary-card, .history-summary-card { padding: 11px 12px; min-width: 0;
        background: #202b36; border: 1px solid #354958; border-radius: 10px; }
      .stats-summary-value, .history-summary-value { overflow-wrap: anywhere; font-size: 17px; }
      .stats-summary-label, .history-summary-label { font-size: 10px; letter-spacing: .025em; line-height: 1.35; }
      .stats-content table, .history-content table { width: 100%; min-width: 0; font-size: 12px; }
      .stats-content th, .stats-content td, .history-content th, .history-content td {
        padding: 8px 9px !important; border-color: #364654; vertical-align: middle; }
      .stats-content td { padding: 8px 9px !important; }
      .stats-content table th, .history-content table th { background: #283543; }
      .stats-content .rtt-panel-section table, .history-content .rtt-panel-section table {
        display: block; overflow-x: auto; -webkit-overflow-scrolling: touch;
        max-width: 100%; border-radius: 9px; }
      .stats-content .rtt-panel-section table tbody, .history-content .rtt-panel-section table tbody { white-space: nowrap; }
      .history-race-timeline { gap: 8px; }
      .history-race-item { border-radius: 10px; padding: 10px 11px; }
      .info-content h3 { font-size: 14px; }
      .rtt-info-notes { background: #202b36; border: 1px solid #354958;
        border-radius: 10px; padding: 12px; margin-top: 16px; }
      .rtt-info-notes summary { cursor: pointer; font-size: 13px; font-weight: 650; }
      .rtt-info-notes li { margin: 9px 0; font-size: 12px; }
      .api-tos-container table { display: block; overflow-x: auto; max-width: 100%; }
      #telemetryControlsContainer { gap: 5px; }
      #telemetryControlsContainer > button { min-height: 36px; border-radius: 8px; }
      @media (min-width: 850px) {
        .rtt-inspector-panel, .rtt-inspector-panel.is-expanded { height: 100dvh; }
        .rtt-inspector-expand { display: none; }
        .settings-popup-content, .stats-panel-content, .history-panel-content { padding: 20px 24px; }
        .rtt-panel-navigation { max-width: 550px; }
      }
      @media (max-width: 600px) {
        .rtt-inspector-panel { height: min(61dvh, 570px); }
        .rtt-inspector-panel.is-expanded { height: min(94dvh, 900px); }
        .rtt-inspector-grip { margin-top: 7px; }
        .settings-popup-content, .stats-panel-content, .history-panel-content,
        .info-panel-content, .download-popup-content {
          padding: 13px 14px max(14px, env(safe-area-inset-bottom, 0px));
          height: auto; max-height: 94dvh; border-radius: 17px 17px 0 0;
        }
        .rtt-panel-navigation { margin-bottom: 10px; }
        .stats-content, .history-content { font-size: 12px; }
        .history-race-main { gap: 4px; flex-wrap: wrap; }
      }
      @media (prefers-reduced-motion: reduce) {
        .rtt-inspector-panel { transition: none; }
      }
    `;
