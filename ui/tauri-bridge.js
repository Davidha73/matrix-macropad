// Tauri <-> Electron Compatibility Bridge
// Synchronously exposes window.api matching Electron's preload.js interface

(function() {
  if (window.api && !window.__TAURI_INTERNALS__ && !window.__TAURI__) {
    return;
  }

  const invoke = (cmd, args = {}) => {
    if (typeof window !== 'undefined') {
      if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
        return window.__TAURI__.core.invoke(cmd, args);
      }
      if (window.__TAURI__ && typeof window.__TAURI__.invoke === 'function') {
        return window.__TAURI__.invoke(cmd, args);
      }
      if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
        return window.__TAURI_INTERNALS__.invoke(cmd, args);
      }
    }
    console.warn(`[Tauri Bridge] invoke called before Tauri core ready: ${cmd}`);
    return Promise.resolve(null);
  };

  const listeners = {};

  const setupListeners = () => {
    const event = (window.__TAURI__ && window.__TAURI__.event) || (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.event);
    if (event && event.listen) {
      event.listen('config-updated', (e) => {
        if (listeners['config-updated']) listeners['config-updated'].forEach(cb => cb(e.payload));
      });
      event.listen('hardware-status', (e) => {
        if (listeners['hardware-status']) listeners['hardware-status'].forEach(cb => cb(e.payload));
      });
      event.listen('button-toggled', (e) => {
        if (listeners['button-toggled']) listeners['button-toggled'].forEach(cb => cb(e.payload));
      });
      event.listen('open-settings', (e) => {
        if (listeners['open-settings']) listeners['open-settings'].forEach(cb => cb(e.payload));
      });
    }
  };

  const onReady = () => {
    setupListeners();
    setTimeout(() => {
      invoke('show_window');
    }, 50);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  const isMac = typeof navigator !== 'undefined' && (navigator.platform?.toUpperCase().includes('MAC') || navigator.userAgent?.includes('Mac'));
  const isWin = typeof navigator !== 'undefined' && (navigator.platform?.toUpperCase().includes('WIN') || navigator.userAgent?.includes('Win'));

  window.api = {
    platform: isMac ? 'darwin' : (isWin ? 'win32' : 'linux'),
    sendAction: (action) => invoke('trigger_macro', { action }),
    onOpenSettings: (callback) => {
      listeners['open-settings'] = listeners['open-settings'] || [];
      listeners['open-settings'].push(callback);
    },
    onConfigUpdated: (callback) => {
      listeners['config-updated'] = listeners['config-updated'] || [];
      listeners['config-updated'].push(callback);
    },
    getConfig: () => invoke('get_config').then(res => res || {}),
    saveConfig: (config) => invoke('save_config', { config }),
    selectImage: () => invoke('select_image'),
    listProfiles: () => invoke('list_profiles').then(res => res || ['Default']),
    saveProfile: (name, config) => invoke('save_profile', { name, config }),
    loadProfile: (name) => invoke('load_profile', { name }),
    exportProfile: (config) => invoke('export_profile', { config }),
    importProfile: () => invoke('import_profile'),
    exportTheme: (themeData) => invoke('export_theme_file', { themeData }),
    importTheme: () => invoke('import_theme_file'),
    captureFrame: () => Promise.resolve(null),
    injectTouch: () => {},
    onHardwareStatus: (callback) => {
      listeners['hardware-status'] = listeners['hardware-status'] || [];
      listeners['hardware-status'].push(callback);
    },
    getHardwareStatus: () => invoke('get_hardware_status').then(res => res || { connected: false, port: null }),
    syncHardware: (config) => invoke('sync_hardware', { config }),
    minimizeWindow: () => invoke('window_minimize'),
    maximizeWindow: () => invoke('window_maximize'),
    closeWindow: () => {
      try {
        if (window.__TAURI__ && window.__TAURI__.window && window.__TAURI__.window.getCurrentWindow) {
          window.__TAURI__.window.getCurrentWindow().hide();
        }
      } catch (e) {}
      return invoke('window_close');
    },
    isWindowMaximized: () => invoke('window_is_maximized'),
    toggleButtonState: (key) => invoke('toggle_button_state', { key }),
    onButtonToggled: (callback) => {
      listeners['button-toggled'] = listeners['button-toggled'] || [];
      listeners['button-toggled'].push(callback);
    },
    getAppVersion: () => invoke('get_app_version').then(res => res || '1.0.1'),
    checkForUpdates: () => invoke('check_for_updates').catch(() => ({ status: 'up-to-date', currentVersion: '1.0.1' })),
    showWindow: () => invoke('show_window')
  };
})();
