const { autoUpdater } = require('electron-updater');
process.env.PREBUILDS_ONLY = '1';
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { keyboard, Key } = require('@nut-tree-fork/nut-js');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

// Disable hardware acceleration to resolve external display rendering issues
app.disableHardwareAcceleration();

// Ensure reliable keystroke and modifier chord registration
keyboard.config.autoDelayMs = 10;

let tray = null;
let mainWindow = null;
let hardwareSerialPort = null;

function setupSerialSessionHandlers(ses) {
  if (!ses) return;
  ses.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();
    if (portList && portList.length > 0) {
      const espPort = portList.find(p => p.displayName && (p.displayName.includes('ESP') || p.displayName.includes('USB') || p.displayName.includes('Serial'))) || portList[0];
      callback(espPort.portId);
    } else {
      callback('');
    }
  });

  ses.setPermissionCheckHandler((webContents, permission) => {
    return permission === 'serial';
  });

  ses.setDevicePermissionHandler((details) => {
    return details.deviceType === 'serial';
  });
}

function openSettingsWindow() {
  const existing = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
  if (existing) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return;
  }

  const isMac = process.platform === 'darwin';
  const iconPath = isMac
    ? path.join(__dirname, 'assets', 'app-icon.png')
    : path.join(__dirname, 'assets', 'matrix-icon-256.ico');
  const icon = nativeImage.createFromPath(iconPath);
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;

  const targetWidth = Math.min(1360, workArea.width - 40);
  const targetHeight = Math.min(860, workArea.height - 40);

  const settingsWin = new BrowserWindow({
    width: targetWidth,
    height: targetHeight,
    minWidth: 1100,
    minHeight: 750,
    center: true,
    frame: false,
    resizable: true,
    autoHideMenuBar: true,
    backgroundColor: '#0c0d0f',
    icon: icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  setupSerialSessionHandlers(settingsWin.webContents.session);
  settingsWin.center();
  settingsWin.webContents.on('did-finish-load', () => {
    const isConnected = hardwareSerialPort && hardwareSerialPort.isOpen;
    settingsWin.webContents.send('hardware-status', {
      connected: !!isConnected,
      port: isConnected ? hardwareSerialPort.path : null
    });
  });
  settingsWin.loadFile('settings.html');
}


function setupAutoUpdater() {
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    console.log('[AutoUpdater] Skipped in development mode.');
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
    if (tray) tray.setToolTip(`Matrix Macropad (Downloading v${info.version}...)`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    if (tray) {
      tray.setToolTip(`Matrix Macropad (v${info.version} ready to install)`);
      updateTrayContextMenu();
    }
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `Matrix Macropad version ${info.version} has been downloaded. Restart now to apply update?`,
      buttons: ['Restart & Install', 'Later']
    }).then((res) => {
      if (res.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.warn('[AutoUpdater] Error:', err.message);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.warn('[AutoUpdater] Initial check failed:', err.message);
    });
  }, 5000);

  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, 4 * 60 * 60 * 1000);
}

function updateTrayContextMenu() {
  if (!tray) return;
  const loginSettings = app.getLoginItemSettings();
  const isAutoStart = loginSettings.openAtLogin;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Configure Macros & Settings ⚙️',
      click: () => openSettingsWindow()
    },
    {
      label: 'Sync Layout to Touchscreen 🔄',
      click: () => syncAllPagesToHardware()
    },
    { type: 'separator' },
    {
      label: 'Launch on Windows Startup',
      type: 'checkbox',
      checked: isAutoStart,
      click: (item) => {
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          openAsHidden: true,
          args: ['--hidden']
        });
        updateTrayContextMenu();
      }
    },
    { type: 'separator' },
    { label: 'Quit Macropad', click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
}

function createWindows () {
  const isMac = process.platform === 'darwin';
  const iconPath = isMac
    ? path.join(__dirname, 'assets', 'tray-icon.png')
    : path.join(__dirname, 'assets', 'matrix-icon-256.ico');
  let icon = nativeImage.createFromPath(iconPath);
  if (isMac && !icon.isEmpty()) {
    icon = icon.resize({ width: 18, height: 18 });
  }

  // Create System Tray icon in notification area (runs completely in background)
  tray = new Tray(icon);
  tray.setToolTip('Matrix Macropad (Connected to ESP32-S3)');
  updateTrayContextMenu();
  tray.on('double-click', () => openSettingsWindow());

  // Global shortcut to open settings window
  const { globalShortcut } = require('electron');
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    openSettingsWindow();
  });
}

function getDynamicTotalPages(cfg) {
  if (!cfg) return 3;
  let maxP = 1;
  for (let p = 1; p <= 8; p++) {
    if (cfg[`p${p}-name`] || cfg[`p${p}-b1`]) {
      maxP = p;
    }
  }
  return Math.min(6, Math.max(1, maxP));
}

const THEME_PALETTES = {
  default: {
    'c-edit': { bg: '#2980b9', bg2: '#2573a7', text: '#ffffff' },
    'c-danger': { bg: '#c0392b', bg2: '#a62c1f', text: '#ffffff' },
    'c-system': { bg: '#27ae60', bg2: '#219653', text: '#ffffff' },
    'c-util': { bg: '#8e44ad', bg2: '#7d3c98', text: '#ffffff' },
    'c-nav': { bg: '#f39c12', bg2: '#d35400', text: '#ffffff' },
    'c-gray': { bg: '#4b5563', bg2: '#374151', text: '#ffffff' },
    'c-black': { bg: '#181a1f', bg2: '#0d0f12', text: '#ffffff' },
    'c-white': { bg: '#ffffff', bg2: '#e2e8f0', text: '#0f172a' }
  },
  cyberpunk: {
    'c-edit': { bg: '#00f0ff', bg2: '#0077fe', text: '#000000' },
    'c-system': { bg: '#05ffa1', bg2: '#00b86b', text: '#000000' },
    'c-util': { bg: '#ff007f', bg2: '#9b00e8', text: '#ffffff' },
    'c-nav': { bg: '#ffe600', bg2: '#ff5e00', text: '#000000' },
    'c-danger': { bg: '#ff003c', bg2: '#990024', text: '#ffffff' },
    'c-gray': { bg: '#241c38', bg2: '#130e20', text: '#00f0ff' },
    'c-black': { bg: '#08050e', bg2: '', text: '#05ffa1' },
    'c-white': { bg: '#e0f7fa', bg2: '', text: '#0b0813' }
  },
  synthwave: {
    'c-edit': { bg: '#01cdfe', bg2: '#0575e6', text: '#ffffff' },
    'c-system': { bg: '#05ffa1', bg2: '#00b4d8', text: '#000000' },
    'c-util': { bg: '#ff71ce', bg2: '#b900b4', text: '#ffffff' },
    'c-nav': { bg: '#f9d423', bg2: '#ff4e50', text: '#000000' },
    'c-danger': { bg: '#ff2a6d', bg2: '#990024', text: '#ffffff' },
    'c-gray': { bg: '#241734', bg2: '#12071f', text: '#ff71ce' },
    'c-black': { bg: '#0f051d', bg2: '', text: '#01cdfe' },
    'c-white': { bg: '#f8f8f2', bg2: '', text: '#1a0826' }
  },
  simple: {
    'c-edit': { bg: '#000000', bg2: '', text: '#ffffff' },
    'c-system': { bg: '#000000', bg2: '', text: '#ffffff' },
    'c-util': { bg: '#000000', bg2: '', text: '#ffffff' },
    'c-nav': { bg: '#000000', bg2: '', text: '#ffffff' },
    'c-danger': { bg: '#000000', bg2: '', text: '#ffffff' },
    'c-gray': { bg: '#000000', bg2: '', text: '#ffffff' },
    'c-black': { bg: '#000000', bg2: '', text: '#ffffff' },
    'c-white': { bg: '#ffffff', bg2: '', text: '#000000' }
  },
  matrix: {
    'c-edit': { bg: '#00ff66', bg2: '#009944', text: '#000000' },
    'c-system': { bg: '#00cc55', bg2: '#003311', text: '#000000' },
    'c-util': { bg: '#009944', bg2: '#003311', text: '#ffffff' },
    'c-nav': { bg: '#aaff00', bg2: '#009944', text: '#000000' },
    'c-danger': { bg: '#ff3333', bg2: '#990000', text: '#ffffff' },
    'c-gray': { bg: '#003311', bg2: '#051105', text: '#00ff66' },
    'c-black': { bg: '#051105', bg2: '', text: '#00ff66' },
    'c-white': { bg: '#d4ffd4', bg2: '', text: '#051105' }
  },
  midnight: {
    'c-edit': { bg: '#2563eb', bg2: '#1d4ed8', text: '#ffffff' },
    'c-system': { bg: '#059669', bg2: '#047857', text: '#ffffff' },
    'c-util': { bg: '#7c3aed', bg2: '#6d28d9', text: '#ffffff' },
    'c-nav': { bg: '#d97706', bg2: '#b45309', text: '#ffffff' },
    'c-danger': { bg: '#dc2626', bg2: '#b91c1c', text: '#ffffff' },
    'c-gray': { bg: '#334155', bg2: '#1e293b', text: '#ffffff' },
    'c-black': { bg: '#0f172a', bg2: '', text: '#ffffff' },
    'c-white': { bg: '#f8fafc', bg2: '', text: '#0f172a' }
  },
  monochrome: {
    'c-edit': { bg: '#333333', bg2: '', text: '#ffffff' },
    'c-system': { bg: '#444444', bg2: '', text: '#ffffff' },
    'c-util': { bg: '#555555', bg2: '', text: '#ffffff' },
    'c-nav': { bg: '#777777', bg2: '', text: '#ffffff' },
    'c-danger': { bg: '#ff4444', bg2: '', text: '#ffffff' },
    'c-gray': { bg: '#222222', bg2: '', text: '#ffffff' },
    'c-black': { bg: '#000000', bg2: '', text: '#ffffff' },
    'c-white': { bg: '#ffffff', bg2: '', text: '#000000' }
  }
};


function resolveButtonFullStyle(item, activeTheme = 'default') {
  if (!item) return { bg: '#4b5563', bg2: '', textColor: '#ffffff', borderColor: '#ffffff', borderWidth: 0, radius: 20 };

  const colorKey = item.color || 'c-gray';
  let bg = '#4b5563';
  let bg2 = '';
  let textColor = '#ffffff';

  if (colorKey === 'transparent' || colorKey === 'c-transparent') {
    bg = 'transparent';
    bg2 = '';
    textColor = (item.customTextColor && item.customTextColor.startsWith('#')) ? item.customTextColor : (item.textColor && item.textColor.startsWith('#') ? item.textColor : '#ffffff');
  } else if (colorKey === 'c-custom' || colorKey === 'custom' || (typeof colorKey === 'string' && colorKey.startsWith('#'))) {
    bg = (item.customColor1 && item.customColor1.startsWith('#')) ? item.customColor1 : (colorKey.startsWith('#') ? colorKey : '#4b5563');
    bg2 = (item.customColor2 && item.customColor2.startsWith('#')) ? item.customColor2 : '';
    textColor = (item.customTextColor && item.customTextColor.startsWith('#')) ? item.customTextColor : (item.textColor && item.textColor.startsWith('#') ? item.textColor : '#ffffff');
  } else {
    const themeKey = (activeTheme || 'default').toLowerCase();
    const palette = THEME_PALETTES[themeKey] || THEME_PALETTES['default'];
    const cEntry = palette[colorKey] || THEME_PALETTES['default'][colorKey] || { bg: '#4b5563', bg2: '', text: '#ffffff' };
    bg = cEntry.bg;
    bg2 = cEntry.bg2;
    textColor = (item.customTextColor && item.customTextColor.startsWith('#')) ? item.customTextColor : (item.textColor && item.textColor.startsWith('#') ? item.textColor : cEntry.text);
  }

  let borderWidth = 0;
  let borderColor = '#ffffff';
  if (item.borderStyle && item.borderStyle !== 'none') {
    borderWidth = parseInt(item.borderWidth || 2, 10);
    borderColor = (item.borderColor && item.borderColor.startsWith('#')) ? item.borderColor : '#ffffff';
  }

  const radius = (item.borderRadius !== undefined && item.borderRadius !== 'default') ? parseInt(item.borderRadius, 10) : 24;
  const fontSize = (item.fontSize !== undefined && item.fontSize !== 'default' && !isNaN(parseInt(item.fontSize, 10))) ? parseInt(item.fontSize, 10) : 68;
  const iconColor = (item.customIconColor && item.customIconColor !== 'same_as_text' && item.customIconColor.startsWith('#')) ? item.customIconColor : textColor;

  return { bg, bg2, textColor, iconColor, borderColor, borderWidth, radius, fontSize };
}

function formatHardwareTime(d, fmt) {
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 || 12;
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  const h24Str = String(hours24).padStart(2, '0');

  if (fmt === '12h-sec') return `${hours12}:${mins}:${secs} ${ampm}`;
  if (fmt === '12h') return `${hours12}:${mins} ${ampm}`;
  if (fmt === '24h-sec') return `${h24Str}:${mins}:${secs}`;
  if (fmt === '24h') return `${h24Str}:${mins}`;
  if (fmt === 'utc') {
    const uh = String(d.getUTCHours()).padStart(2, '0');
    const um = String(d.getUTCMinutes()).padStart(2, '0');
    const us = String(d.getUTCSeconds()).padStart(2, '0');
    return `${uh}:${um}:${us} UTC`;
  }
  return `${hours12}:${mins}:${secs} ${ampm}`;
}

function formatHardwareDate(d, fmt) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayName = days[d.getDay()];
  const fullDayName = fullDays[d.getDay()];
  const monthName = months[d.getMonth()];
  const fullMonthName = fullMonths[d.getMonth()];
  const dateNum = d.getDate();
  const dd = String(dateNum).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();

  if (fmt === 'iso') return `${yyyy}-${mm}-${dd}`;
  if (fmt === 'full') return `${fullDayName}, ${dateNum} ${fullMonthName} ${yyyy}`;
  if (fmt === 'uk') return `${dd}/${mm}/${yyyy}`;
  if (fmt === 'us') return `${mm}/${dd}/${yyyy}`;
  if (fmt === 'short') return `${monthName} ${dateNum}`;
  if (fmt === 'day-only') return fullDayName;
  return `${dayName}, ${monthName} ${dateNum}`;
}

const syncedHardwareFiles = new Set();
const userAssetsDir = path.join(app.getPath('userData'), 'user_assets');
if (!fs.existsSync(userAssetsDir)) {
  try { fs.mkdirSync(userAssetsDir, { recursive: true }); } catch (e) {}
}

const PRESET_COLOR_MAP = {
  'c-nav': '#f39c12',
  'c-edit': '#2980b9',
  'c-media': '#27ae60',
  'c-danger': '#e74c3c',
  'c-gray': '#4b5563',
  'c-accent': '#8e44ad'
};

function getButtonIconHardwareName(item, page, btnNum, subIndex = null) {
  if (!item || !item.icon || typeof item.icon !== 'string') return '';
  if (item.icon.startsWith('data:')) {
    const rawName = item.iconOriginalName ? path.basename(item.iconOriginalName) : (subIndex !== null ? `btn_icon_p${page}_b${btnNum}_sub${subIndex}.png` : `btn_icon_p${page}_b${btnNum}.png`);
    return rawName.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.[a-zA-Z0-9]+$/, '') + '.png';
  }
  const base = path.basename(item.icon).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const ext = path.extname(base).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.bmp', '.webp', '.svg'].includes(ext)) {
    return base.replace(/\.[a-zA-Z0-9]+$/, '') + '.png';
  }
  return base;
}

function optimizeBufferForHardware(inputBuf, maxW = 242, maxH = 186) {
  try {
    const img = nativeImage.createFromBuffer(inputBuf);
    if (!img.isEmpty()) {
      const size = img.getSize();
      let resized = img;
      if (size.width > maxW || size.height > maxH) {
        const aspect = size.width / size.height;
        let targetW = size.width;
        let targetH = size.height;
        if (targetW > maxW) {
          targetW = maxW;
          targetH = Math.round(targetW / aspect);
        }
        if (targetH > maxH) {
          targetH = maxH;
          targetW = Math.round(targetH * aspect);
        }
        resized = img.resize({ width: targetW, height: targetH, quality: 'better' });
      }
      return resized.toPNG();
    }
  } catch (e) {
    console.error('Buffer asset optimization error:', e);
  }
  return inputBuf;
}

function getIconBuffer(item) {
  if (!item || !item.icon || typeof item.icon !== 'string') return null;
  if (item.icon.startsWith('data:')) {
    const commaIdx = item.icon.indexOf(',');
    if (commaIdx !== -1) {
      const b64Data = item.icon.substring(commaIdx + 1);
      return Buffer.from(b64Data, 'base64');
    }
    return null;
  }
  // Check direct file path
  if (fs.existsSync(item.icon)) {
    try { return fs.readFileSync(item.icon); } catch (e) {}
  }
  const baseName = path.basename(item.icon);
  // Check userAssetsDir
  const userPath = path.join(userAssetsDir, baseName);
  if (fs.existsSync(userPath)) {
    try { return fs.readFileSync(userPath); } catch (e) {}
  }
  // Check project assets
  const projectAssetPath = path.join(__dirname, 'assets', baseName);
  if (fs.existsSync(projectAssetPath)) {
    try { return fs.readFileSync(projectAssetPath); } catch (e) {}
  }
  // Check alternate extensions
  const baseWithoutExt = baseName.replace(/\.[a-zA-Z0-9]+$/, '');
  for (const dir of [userAssetsDir, path.join(__dirname, 'assets')]) {
    for (const altExt of ['.png', '.jpg', '.jpeg', '.bmp', '.webp', '.svg']) {
      const altPath = path.join(dir, baseWithoutExt + altExt);
      if (fs.existsSync(altPath)) {
        try { return fs.readFileSync(altPath); } catch (e) {}
      }
    }
  }
  return null;
}

function optimizeAssetForHardware(filePath, maxW = 242, maxH = 186) {
  try {
    const img = nativeImage.createFromPath(filePath);
    if (!img.isEmpty()) {
      const size = img.getSize();
      let resized = img;
      if (size.width > maxW || size.height > maxH) {
        const aspect = size.width / size.height;
        let targetW = size.width;
        let targetH = size.height;
        if (targetW > maxW) {
          targetW = maxW;
          targetH = Math.round(targetW / aspect);
        }
        if (targetH > maxH) {
          targetH = maxH;
          targetW = Math.round(targetH * aspect);
        }
        resized = img.resize({ width: targetW, height: targetH, quality: 'better' });
      }
      const outBuf = resized.toPNG();
      fs.writeFileSync(filePath, outBuf);
      const pngPath = filePath.replace(/\.[a-zA-Z0-9]+$/, '.png');
      if (pngPath !== filePath) {
        fs.writeFileSync(pngPath, outBuf);
      }
    }
  } catch (e) {
    console.error('Asset optimization error:', e);
  }
}

let fileDoneResolver = null;

async function syncAssetsToHardware(config, force = false) {
  if (!hardwareSerialPort || !hardwareSerialPort.isOpen) return;
  if (force) syncedHardwareFiles.clear();
  const totalPages = getDynamicTotalPages(config);
  const assetsToSync = new Map();

  for (let p = 1; p <= totalPages; p++) {
    for (let b = 1; b <= 6; b++) {
      const item = config[`p${p}-b${b}`] || {};
      const targetName = getButtonIconHardwareName(item, p, b);
      if (targetName) {
        const buf = getIconBuffer(item);
        if (buf && buf.length > 0) {
          assetsToSync.set(targetName, buf);
        }
      }
      const rawSub = item.sub_buttons || item.children;
      if (Array.isArray(rawSub)) {
        rawSub.forEach((sub, sIdx) => {
          const subTargetName = getButtonIconHardwareName(sub, p, b, sIdx + 1);
          if (subTargetName) {
            const subBuf = getIconBuffer(sub);
            if (subBuf && subBuf.length > 0) {
              assetsToSync.set(subTargetName, subBuf);
            }
          }
        });
      }
    }
  }

  for (const [sendName, rawBuf] of assetsToSync.entries()) {
    if (!force && syncedHardwareFiles.has(sendName)) continue;
    try {
      const optimizedBuf = optimizeBufferForHardware(rawBuf);
      const cachePath = path.join(userAssetsDir, sendName);
      try { fs.writeFileSync(cachePath, optimizedBuf); } catch (e) {}

      console.log(`[ESP32-S3] Syncing asset ${sendName} (${optimizedBuf.length} bytes) to storage...`);

      hardwareSerialPort.write(JSON.stringify({ cmd: 'file_start', name: sendName, size: optimizedBuf.length }) + '\n');
      await new Promise(r => setTimeout(r, 120));

      const chunkSize = 256;
      for (let i = 0; i < optimizedBuf.length; i += chunkSize) {
        const slice = optimizedBuf.slice(i, i + chunkSize);
        const b64 = slice.toString('base64');
        hardwareSerialPort.write(JSON.stringify({ cmd: 'file_chunk', name: sendName, data: b64 }) + '\n');
        await new Promise(r => setTimeout(r, 30));
      }

      const waitDone = new Promise((resolve) => {
        fileDoneResolver = resolve;
        setTimeout(() => resolve(null), 3000);
      });

      hardwareSerialPort.write(JSON.stringify({ cmd: 'file_end', name: sendName }) + '\n');
      await waitDone;
      fileDoneResolver = null;
      await new Promise(r => setTimeout(r, 100));

      syncedHardwareFiles.add(sendName);
    } catch (err) {
      console.error(`Failed to sync asset ${sendName}:`, err);
    }
  }
}

function createHardwareProfileData(config) {
  const totalPages = getDynamicTotalPages(config);
  const cleanDoc = {
    _theme: config._theme || 'default',
    _brightness: config._brightness !== undefined ? config._brightness : 50,
    _volume: config._volume !== undefined ? config._volume : 80,
    _screensaverTimeout: config._screensaverTimeout !== undefined ? config._screensaverTimeout : 300,
    _screensaverAnim: config._screensaverAnim || 'bouncing_clock'
  };

  for (let p = 1; p <= totalPages; p++) {
    cleanDoc[`p${p}-name`] = config[`p${p}-name`] || `Page ${p}`;
    for (let b = 1; b <= 6; b++) {
      const key = `p${p}-b${b}`;
      const item = config[key];
      if (item && typeof item === 'object') {
        const itemCopy = { ...item };
        const hwIcon = getButtonIconHardwareName(item, p, b);
        if (hwIcon) {
          itemCopy.icon = hwIcon;
        } else if (item.materialIcon) {
          itemCopy.icon = item.materialIcon;
        } else if (typeof itemCopy.icon === 'string' && itemCopy.icon.startsWith('data:')) {
          delete itemCopy.icon;
        }
        delete itemCopy.iconOriginalName;
        const rawSub = item.sub_buttons || item.children;
        if (Array.isArray(rawSub) && rawSub.length > 0) {
          itemCopy.sub_buttons = rawSub.slice(0, 6).map((sub, sIdx) => {
            const subCopy = { ...sub };
            const subHwIcon = getButtonIconHardwareName(sub, p, b, sIdx + 1);
            if (subHwIcon) {
              subCopy.icon = subHwIcon;
            } else if (sub.materialIcon) {
              subCopy.icon = sub.materialIcon;
            } else if (typeof subCopy.icon === 'string' && subCopy.icon.startsWith('data:')) {
              delete subCopy.icon;
            }
            delete subCopy.iconOriginalName;
            return subCopy;
          });
        }
        cleanDoc[key] = itemCopy;
      }
    }
  }
  return cleanDoc;
}

let isSyncingHardware = false;
let pendingSyncConfig = null;

function generatePageButtonList(config, p) {
  const activeTheme = config._theme || 'default';
  const now = new Date();
  const rawTitle = config[`p${p}-name`] || `Page ${p}`;
  const pageTitle = rawTitle.replace(/[^\x20-\x7E]/g, '').trim() || rawTitle;

  const buttonList = [];
  for (let b = 1; b <= 6; b++) {
    const item = config[`p${p}-b${b}`] || {};
    const hasExplicitLabel = item.label !== undefined || config[`p${p}-b${b}-label`] !== undefined;
    let rawLabel = item.label !== undefined ? item.label : (config[`p${p}-b${b}-label`] !== undefined ? config[`p${p}-b${b}-label`] : `Button ${b}`);
    let rawShortcut = item.value || item.shortcut || config[`p${p}-b${b}-value`] || '';

    const action = item.type || 'shortcut';
    let btnType = action;
    let btnDuration = 0;
    if (action === 'clock') {
      rawLabel = formatHardwareTime(now, item.format || '12h-sec');
      rawShortcut = 'Live Clock';
    } else if (action === 'date') {
      rawLabel = formatHardwareDate(now, item.format || 'standard');
      rawShortcut = 'Date';
    } else if (action === 'timer' || action === 'stopwatch' || action === 'countdown') {
      if (item.timerMode === 'stopwatch' || action === 'stopwatch') {
        btnType = 'stopwatch';
        btnDuration = 0;
        rawLabel = '00:00';
      } else {
        btnType = 'countdown';
        btnDuration = item.duration !== undefined ? parseInt(item.duration, 10) : (item.timerMode === 'custom' ? parseInt(item.timerDuration || 300, 10) : parseInt(item.timerMode || 300, 10));
        if (isNaN(btnDuration) || btnDuration <= 0) btnDuration = 300;
        const m = Math.floor(btnDuration / 60);
        const s = btnDuration % 60;
        rawLabel = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
      rawShortcut = item.duration ? `${item.duration}s` : (item.timerMode === 'custom' ? `${item.timerDuration || 300}s` : (item.timerMode || '300s'));
    }

    let cleanLabel = rawLabel.replace(/\[[a-zA-Z0-9_]+\]/g, '').replace(/[^\x20-\x7E]/g, '').trim();
    if (!hasExplicitLabel && !cleanLabel) {
      cleanLabel = `Button ${b}`;
    }
    let cleanShortcut = rawShortcut.replace(/[^\x20-\x7E]/g, '').trim() || rawShortcut.trim();

    const style = resolveButtonFullStyle(item, activeTheme);

    let iconVal = getButtonIconHardwareName(item, p, b);
    if (!iconVal && item.materialIcon) {
      iconVal = item.materialIcon;
    }
    if (!iconVal && rawLabel) {
      const match = rawLabel.match(/\[([a-zA-Z0-9_]+)\]/);
      if (match) {
        iconVal = match[1];
      }
    }

    let subButtonsList = undefined;
    const rawSubButtons = item.sub_buttons || item.children;
    if (Array.isArray(rawSubButtons) && rawSubButtons.length > 0) {
      subButtonsList = rawSubButtons.slice(0, 6).map((sub, sIdx) => {
        const subStyle = resolveButtonFullStyle(sub, activeTheme);
        let subIconVal = getButtonIconHardwareName(sub, p, b, sIdx + 1);
        if (!subIconVal && sub.materialIcon) {
          subIconVal = sub.materialIcon;
        }
        if (!subIconVal && sub.label) {
          const match = sub.label.match(/\[([a-zA-Z0-9_]+)\]/);
          if (match) {
            subIconVal = match[1];
          }
        }
        return {
          id: sub.id !== undefined ? sub.id : (sIdx + 1),
          label: (sub.label || `Button ${sIdx + 1}`).replace(/[^\x20-\x7E]/g, '').trim(),
          type: sub.type || 'shortcut',
          payload: sub.payload || sub.value || '',
          bg_color: sub.bg_color || sub.bgColor || subStyle.bg || '#2E3440',
          text_color: sub.text_color || sub.textColor || subStyle.textColor || '#FFFFFF',
          icon_color: sub.customIconColor && sub.customIconColor !== 'same_as_text' && sub.customIconColor.startsWith('#') ? sub.customIconColor : (sub.text_color || sub.textColor || subStyle.textColor || '#FFFFFF'),
          border_color: sub.border_color || sub.borderColor || subStyle.borderColor || '#34495e',
          border_width: sub.border_width !== undefined ? sub.border_width : (sub.borderWidth !== undefined ? sub.borderWidth : 1),
          border_radius: sub.border_radius !== undefined ? sub.border_radius : (sub.borderRadius !== undefined ? sub.borderRadius : 24),
          icon: subIconVal
        };
      });
    }

    buttonList.push({
      label: cleanLabel,
      shortcut: cleanShortcut,
      action,
      type: btnType,
      duration: btnDuration,
      bg: style.bg,
      bg2: style.bg2,
      customAngle: item.customAngle !== undefined ? parseInt(item.customAngle, 10) : (item.customGradientDir === 'horizontal' ? 90 : 180),
      textColor: style.textColor,
      iconColor: style.iconColor,
      borderColor: style.borderColor,
      borderWidth: style.borderWidth,
      borderStyle: item.borderStyle || (style.borderWidth > 0 ? 'solid' : 'none'),
      borderDashGap: item.borderDashGap !== undefined ? parseInt(item.borderDashGap, 10) : 8,
      borderDashLength: item.borderDashLength !== undefined ? parseInt(item.borderDashLength, 10) : 12,
      borderBracketLength: item.borderBracketLength !== undefined ? parseInt(item.borderBracketLength, 10) : 35,
      radius: style.radius,
      fontSize: style.fontSize || 68,
      icon: iconVal,
      iconFit: item.iconFit || 'contain',
      sub_buttons: subButtonsList
    });
  }
  return { pageTitle, buttonList };
}

function syncSinglePageToHardware(p, config, silent = true) {
  if (!hardwareSerialPort || !hardwareSerialPort.isOpen) return;
  const totalPages = getDynamicTotalPages(config);
  const { pageTitle, buttonList } = generatePageButtonList(config, p);
  hardwareSerialPort.write(JSON.stringify({ cmd: 'sync_page', page: p, totalPages: totalPages, title: pageTitle, buttons: buttonList, silent: !!silent }) + '\n');
}

async function syncAllPagesToHardware(passedConfig, forceAssets = true) {
  if (!hardwareSerialPort || !hardwareSerialPort.isOpen) return;
  if (isSyncingHardware) {
    pendingSyncConfig = passedConfig || loadConfig();
    return;
  }
  isSyncingHardware = true;
  BrowserWindow.getAllWindows().forEach(w => {
    if (w.webContents) w.webContents.send('hardware-sync-status', { syncing: true, message: 'Syncing Layout to Touchscreen...' });
  });

  try {
    const config = passedConfig || loadConfig();
    await syncAssetsToHardware(config, forceAssets);
    const totalPages = getDynamicTotalPages(config);
    const activeTheme = config._theme || 'default';
    const now = new Date();

    for (let p = 1; p <= totalPages; p++) {
      const { pageTitle, buttonList } = generatePageButtonList(config, p);
      hardwareSerialPort.write(JSON.stringify({ cmd: 'sync_page', page: p, totalPages: totalPages, title: pageTitle, buttons: buttonList }) + '\n');
      await new Promise(r => setTimeout(r, 60));
    }
    const brightnessVal = (config._brightness !== undefined && !isNaN(config._brightness)) ? parseInt(config._brightness, 10) : 50;
    hardwareSerialPort.write(JSON.stringify({ cmd: 'set_brightness', brightness: brightnessVal }) + '\n');
    await new Promise(r => setTimeout(r, 60));

    const volumeVal = (config._volume !== undefined && !isNaN(config._volume)) ? parseInt(config._volume, 10) : 80;
    hardwareSerialPort.write(JSON.stringify({ cmd: 'set_volume', volume: volumeVal }) + '\n');
    await new Promise(r => setTimeout(r, 60));

    const screensaverTimeout = (config._screensaverTimeout !== undefined && !isNaN(config._screensaverTimeout)) ? parseInt(config._screensaverTimeout, 10) : 300;
    const screensaverAnim = config._screensaverAnim || 'bouncing_clock';
    hardwareSerialPort.write(JSON.stringify({ cmd: 'set_screensaver', timeout: screensaverTimeout, anim: screensaverAnim }) + '\n');
    await new Promise(r => setTimeout(r, 60));

    const localEpoch = Math.floor(Date.now() / 1000) - (new Date().getTimezoneOffset() * 60);
    hardwareSerialPort.write(JSON.stringify({ cmd: 'sync_time', epoch: localEpoch }) + '\n');
    await new Promise(r => setTimeout(r, 60));

    const layoutFileName = config._layoutName || (config._activeFilePath ? path.basename(config._activeFilePath) : 'Layout 1.json');
    const hwProfileData = createHardwareProfileData(config);
    hardwareSerialPort.write(JSON.stringify({ cmd: 'save_profile', name: layoutFileName, data: hwProfileData }) + '\n');

    console.log(`[ESP32-S3] Synchronized ${totalPages} pages, saved ${layoutFileName} to SD, brightness (${brightnessVal}%), volume (${volumeVal}%), screensaver (${screensaverTimeout}s, ${screensaverAnim}).`);
  } catch (e) {
    console.error(e);
  } finally {
    isSyncingHardware = false;
    BrowserWindow.getAllWindows().forEach(w => {
      if (w.webContents) w.webContents.send('hardware-sync-status', { syncing: false });
    });
    if (pendingSyncConfig) {
      const nextConfig = pendingSyncConfig;
      pendingSyncConfig = null;
      await syncAllPagesToHardware(nextConfig, forceAssets);
    }
  }
}

// 1-second live widget tick & real-time clock broadcast to hardware
setInterval(() => {
  try {
    if (!hardwareSerialPort || !hardwareSerialPort.isOpen) return;
    const config = loadConfig();
    const totalPages = getDynamicTotalPages(config);
    const now = new Date();
    const localEpoch = Math.floor(now.getTime() / 1000) - (now.getTimezoneOffset() * 60);
    hardwareSerialPort.write(JSON.stringify({ cmd: 'sync_time', epoch: localEpoch }) + '\n');

    for (let p = 1; p <= totalPages; p++) {
      for (let b = 1; b <= 6; b++) {
        const item = config[`p${p}-b${b}`] || {};
        if (item.type === 'clock' || item.type === 'date') {
          let text = '';
          let sub = '';
          if (item.type === 'clock') {
            text = formatHardwareTime(now, item.format || '12h-sec');
            sub = 'Live Clock';
          } else if (item.type === 'date') {
            text = formatHardwareDate(now, item.format || 'standard');
            sub = 'Date';
          }
          hardwareSerialPort.write(JSON.stringify({ cmd: 'widget_update', page: p, button: b, label: text, shortcut: sub }) + '\n');
        }
      }
    }
  } catch (e) {}
}, 1000);

async function startHardwareDisplayBridge() {
  try {
    const { SerialPort } = require('serialport');
    const { ReadlineParser } = require('@serialport/parser-readline');

    const ports = await SerialPort.list();
    console.log('[ESP32-S3 Bridge] Available serial ports:', ports.map(p => ({ path: p.path, manufacturer: p.manufacturer, vendorId: p.vendorId })));

    const espPortInfo = ports.find(p => 
      (p.vendorId && (p.vendorId.toLowerCase().includes('303a') || p.vendorId.toLowerCase().includes('1a86') || p.vendorId.toLowerCase().includes('10c4'))) ||
      (p.path && (p.path.toUpperCase() === 'COM5' || p.path.includes('usbmodem') || p.path.includes('usbserial')))
    ) || (ports.length > 0 ? ports[0] : null);

    if (!espPortInfo) {
      console.log('[ESP32-S3 Bridge] No compatible ESP32 serial port found. Retrying in 3s...');
      setTimeout(startHardwareDisplayBridge, 3000);
      return;
    }

    console.log(`[ESP32-S3 Bridge] Attempting connection to ${espPortInfo.path}...`);

    hardwareSerialPort = new SerialPort({
      path: espPortInfo.path,
      baudRate: 115200,
      autoOpen: true
    });

    const parser = hardwareSerialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
    parser.on('data', async (line) => {
      try {
        console.log('[ESP32-S3 RX]', line.trim());
        const msg = JSON.parse(line.trim());
        if (msg.type === 'file_done' || msg.type === 'file_start_ack') {
          if (fileDoneResolver && (msg.type === 'file_done' || msg.ready === false)) {
            fileDoneResolver(msg);
          }
        }
        if (msg.type === 'ready' || msg.type === 'pong') {
          console.log('[ESP32-S3] Board announced ready. Pushing layout...');
          syncAllPagesToHardware();
        } else if (msg.type === 'trigger') {
          const targetAction = `p${msg.page}-b${msg.button}`;
          const config = loadConfig();
          const parentCfg = config[targetAction];
          let cfg = parentCfg;
          if (msg.sub_button !== undefined && parentCfg) {
            const subArr = parentCfg.sub_buttons || parentCfg.children || [];
            let sub = subArr[msg.sub_button];
            if (!sub && msg.sub_id !== undefined) {
              sub = subArr.find(s => s.id == msg.sub_id);
            }
            if (sub) {
              const rawType = (sub.type || 'shortcut').toLowerCase();
              let mappedType = rawType;
              if (rawType === 'keystroke') mappedType = 'shortcut';
              cfg = {
                type: mappedType,
                value: sub.payload || sub.value || ''
              };
            }
          }
          if (cfg) {
            if (cfg.type === 'toggle') {
              await executeToggleAction(targetAction, cfg, config);
            } else if (cfg.type === 'url' && cfg.value) {
              await shell.openExternal(cfg.value);
            } else if (cfg.type === 'text' && cfg.value) {
              await keyboard.type(cfg.value);
            } else if (cfg.type === 'shortcut' && cfg.value) {
              await executeShortcutString(cfg.value);
            } else if (cfg.type === 'macro' && cfg.value) {
              await executeMacroSequence(cfg.value);
            }
          }
        }
      } catch (e) {}
    });

    hardwareSerialPort.on('open', () => {
      console.log(`[ESP32-S3 Bridge] Connected to ${espPortInfo.path}. Synchronizing LVGL layout...`);
      BrowserWindow.getAllWindows().forEach(w => {
        if (w.webContents) w.webContents.send('hardware-status', { connected: true, port: espPortInfo.path });
      });
      setTimeout(syncAllPagesToHardware, 1200);
    });

    hardwareSerialPort.on('close', () => {
      console.log('[ESP32-S3 Bridge] Port closed.');
      BrowserWindow.getAllWindows().forEach(w => {
        if (w.webContents) w.webContents.send('hardware-status', { connected: false });
      });
      hardwareSerialPort = null;
      setTimeout(startHardwareDisplayBridge, 3000);
    });

    hardwareSerialPort.on('error', (err) => {
      console.error(`[ESP32-S3 Bridge Error] on ${espPortInfo.path}:`, err.message);
      BrowserWindow.getAllWindows().forEach(w => {
        if (w.webContents) w.webContents.send('hardware-status', { connected: false, error: err.message });
      });
      hardwareSerialPort = null;
      setTimeout(startHardwareDisplayBridge, 3000);
    });

  } catch (err) {
    console.error('[ESP32-S3 Bridge Init Error]:', err);
    setTimeout(startHardwareDisplayBridge, 3000);
  }
}

app.whenReady().then(() => {
  protocol.handle('app-asset', (request) => {
    try {
      const rawUri = request.url.replace(/^app-asset:\/\//i, '');
      const assetName = decodeURIComponent(rawUri);
      if (fs.existsSync(assetName) && fs.statSync(assetName).isFile()) {
        return net.fetch(pathToFileURL(assetName).toString());
      }
      const baseName = path.basename(assetName);
      const userPath = path.join(userAssetsDir, baseName);
      if (fs.existsSync(userPath)) {
        return net.fetch(pathToFileURL(userPath).toString());
      }
      const projPath = path.join(__dirname, 'assets', baseName);
      if (fs.existsSync(projPath)) {
        return net.fetch(pathToFileURL(projPath).toString());
      }
      const baseWithoutExt = baseName.replace(/\.[a-zA-Z0-9]+$/, '');
      for (const dir of [userAssetsDir, path.join(__dirname, 'assets')]) {
        for (const altExt of ['.png', '.jpg', '.jpeg', '.bmp', '.webp', '.svg']) {
          const altPath = path.join(dir, baseWithoutExt + altExt);
          if (fs.existsSync(altPath)) {
            return net.fetch(pathToFileURL(altPath).toString());
          }
        }
      }
    } catch (err) {
      console.error('Asset protocol error:', err);
    }
    return new Response('Asset not found', { status: 404 });
  });

  createWindows();
  startHardwareDisplayBridge();

  const isHidden = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAsHidden;
  if (!isHidden) {
    openSettingsWindow();
  }

  screen.on('display-added', (event, newDisplay) => {
    console.log('Display connected:', newDisplay);
  });

  screen.on('display-metrics-changed', (event, display, changedMetrics) => {
    console.log('Display metrics changed:', display, changedMetrics);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openSettingsWindow();
  });
});

app.on('window-all-closed', (e) => {
  // Keep background serial bridge alive in the system tray
  e.preventDefault();
});

// --- Multi-OS Keyboard Modifier Detection ---
const isMac = process.platform === 'darwin';

// Helper: Map string tokens to @nut-tree-fork/nut-js Key codes
function mapKeyNameToCode(k) {
  const norm = k.trim().toLowerCase();
  switch (norm) {
    case 'ctrl':
    case 'control':
      return Key.LeftControl;
    case 'cmd':
    case 'command':
      return Key.LeftCmd;
    case 'shift':
      return Key.LeftShift;
    case 'alt':
    case 'opt':
    case 'option':
      return Key.LeftAlt;
    case 'win':
    case 'super':
    case 'windows':
      return Key.LeftSuper;
    case 'enter':
    case 'return':
      return Key.Enter;
    case 'esc':
    case 'escape':
      return Key.Escape;
    case 'tab':
      return Key.Tab;
    case 'space':
      return Key.Space;
    case 'backspace':
      return Key.Backspace;
    case 'delete':
    case 'del':
      return Key.Delete;
    case 'up':
      return Key.Up;
    case 'down':
      return Key.Down;
    case 'left':
      return Key.Left;
    case 'right':
      return Key.Right;
    case 'period':
    case '.':
      return Key.Period;
    case 'comma':
    case ',':
      return Key.Comma;
    case 'plus':
    case '+':
    case '=':
      return Key.Add;
    case 'minus':
    case '-':
      return Key.Subtract;
    // Single alpha keys
    default:
      if (norm.length === 1 && norm >= 'a' && norm <= 'z') {
        return Key[norm.toUpperCase()];
      }
      if (norm.length === 1 && norm >= '0' && norm <= '9') {
        return Key[`Num${norm}`] || Key[norm];
      }
      if (/^(?:f|fn)(\d{1,2})$/.test(norm)) {
        const num = norm.match(/^(?:f|fn)(\d{1,2})$/)[1];
        return Key[`F${num}`] || null;
      }
      return null;
  }
}

async function executeShortcutString(shortcutStr) {
  const norm = shortcutStr.trim().toLowerCase();

  // Handle media & built-in named shortcuts
  switch (norm) {
    case 'select-all':
      await keyboard.pressKey(isMac ? Key.LeftCmd : Key.LeftControl, Key.A);
      await keyboard.releaseKey(Key.A, isMac ? Key.LeftCmd : Key.LeftControl);
      return;
    case 'copy':
      await keyboard.pressKey(isMac ? Key.LeftCmd : Key.LeftControl, Key.C);
      await keyboard.releaseKey(Key.C, isMac ? Key.LeftCmd : Key.LeftControl);
      return;
    case 'cut':
      await keyboard.pressKey(isMac ? Key.LeftCmd : Key.LeftControl, Key.X);
      await keyboard.releaseKey(Key.X, isMac ? Key.LeftCmd : Key.LeftControl);
      return;
    case 'paste':
      await keyboard.pressKey(isMac ? Key.LeftCmd : Key.LeftControl, Key.V);
      await keyboard.releaseKey(Key.V, isMac ? Key.LeftCmd : Key.LeftControl);
      return;
    case 'undo':
      await keyboard.pressKey(isMac ? Key.LeftCmd : Key.LeftControl, Key.Z);
      await keyboard.releaseKey(Key.Z, isMac ? Key.LeftCmd : Key.LeftControl);
      return;
    case 'redo':
      if (isMac) {
        await keyboard.pressKey(Key.LeftCmd, Key.LeftShift, Key.Z);
        await keyboard.releaseKey(Key.Z, Key.LeftShift, Key.LeftCmd);
      } else {
        await keyboard.pressKey(Key.LeftControl, Key.Y);
        await keyboard.releaseKey(Key.Y, Key.LeftControl);
      }
      return;
    case 'delete':
      await keyboard.type(isMac ? Key.Backspace : Key.Delete);
      return;
    case 'media-prev':
      await keyboard.type(Key.AudioPrev);
      return;
    case 'media-play':
      await keyboard.type(Key.AudioPlay);
      return;
    case 'media-next':
      await keyboard.type(Key.AudioNext);
      return;
    case 'vol-down':
      await keyboard.type(Key.AudioVolDown);
      return;
    case 'vol-mute':
      await keyboard.type(Key.AudioMute);
      return;
    case 'vol-up':
      await keyboard.type(Key.AudioVolUp);
      return;
    case 'alt+tab':
      await keyboard.pressKey(isMac ? Key.LeftCmd : Key.LeftAlt, Key.Tab);
      await new Promise(r => setTimeout(r, 40));
      await keyboard.releaseKey(Key.Tab, isMac ? Key.LeftCmd : Key.LeftAlt);
      return;
    case 'alt+escape':
    case 'alt+esc':
      await keyboard.pressKey(Key.LeftAlt, Key.Escape);
      await new Promise(r => setTimeout(r, 40));
      await keyboard.releaseKey(Key.Escape, Key.LeftAlt);
      return;
    case 'macropad-settings':
    case 'open-settings':
    case 'settings-window':
      openSettingsWindow();
      return;
  }

  // Parse arbitrary combo strings e.g. "Ctrl+X", "Ctrl + Shift + T"
  const tokens = shortcutStr.split('+').map(t => t.trim()).filter(Boolean);
  const keys = tokens.map(t => mapKeyNameToCode(t)).filter(Boolean);

  if (keys.length > 0) {
    for (const k of keys) await keyboard.pressKey(k);
    for (const k of [...keys].reverse()) await keyboard.releaseKey(k);
  }
}

async function executeMacroSequence(script) {
  if (!script || typeof script !== 'string') return;
  const lines = script.split(/[\r\n;]+/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const delayMatch = line.match(/^(?:delay|wait|sleep)\s+(\d+)$/i);
    const typeMatch = line.match(/^(?:type|text|write)\s+(.+)$/i);
    const keyMatch = line.match(/^(?:key|press|shortcut)\s+(.+)$/i);
    const runMatch = line.match(/^(?:run|exec|launch|open)\s+(.+)$/i);

    if (delayMatch) {
      const ms = parseInt(delayMatch[1], 10);
      if (!isNaN(ms) && ms > 0) {
        await new Promise(r => setTimeout(r, ms));
      }
    } else if (typeMatch) {
      let str = typeMatch[1].trim();
      if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
        str = str.slice(1, -1);
      }
      await keyboard.type(str);
    } else if (runMatch) {
      let target = runMatch[1].trim();
      if ((target.startsWith("'") && target.endsWith("'")) || (target.startsWith('"') && target.endsWith('"'))) {
        target = target.slice(1, -1);
      }
      if (process.platform === 'darwin') {
        if (!target.startsWith('open ') && !target.startsWith('/') && !target.includes(';') && !target.includes('|') && !target.includes('&')) {
          const macAliasMap = {
            notepad: 'TextEdit',
            calc: 'Calculator',
            taskmgr: 'Activity Monitor',
            explorer: 'Finder',
            cmd: 'Terminal',
            powershell: 'Terminal',
            wt: 'Terminal',
            terminal: 'Terminal',
            mspaint: 'Preview',
            control: 'System Settings',
            'ms-settings:': 'System Settings',
            snippingtool: 'Screenshot'
          };
          const resolved = macAliasMap[target.toLowerCase()] || target;
          target = `open -a "${resolved}"`;
        }
      }
      require('child_process').exec(target, (err) => {
        if (err) console.error('Macro run error:', err);
      });
    } else if (keyMatch) {
      await executeShortcutString(keyMatch[1]);
    } else {
      // Direct shortcut chord or single key (e.g. Win+R, Ctrl+C, Enter)
      await executeShortcutString(line);
    }
    await new Promise(r => setTimeout(r, 20));
  }
}

ipcMain.on('trigger-macro', async (event, action) => {
  try {
    if (typeof action === 'object' && action !== null) {
      if (action.type === 'text' && action.value) {
        await keyboard.type(action.value);
      } else if (action.type === 'shortcut' && action.value) {
        await executeShortcutString(action.value);
      } else if (action.type === 'macro' && action.value) {
        await executeMacroSequence(action.value);
      }
      return;
    }

    const config = loadConfig();
    const cfg = config[action];

    if (cfg) {
      if (cfg.type === 'toggle') {
        await executeToggleAction(action, cfg, config);
        return;
      } else if (cfg.type === 'url' && cfg.value) {
        await shell.openExternal(cfg.value);
      } else if (cfg.type === 'text' && cfg.value) {
        await keyboard.type(cfg.value);
      } else if (cfg.type === 'shortcut' && cfg.value) {
        await executeShortcutString(cfg.value);
      } else if (cfg.type === 'macro' && cfg.value) {
        await executeMacroSequence(cfg.value);
      }
    } else {
      // Fallback for direct named shortcuts
      await executeShortcutString(action);
    }
  } catch (err) {
    console.error("Macro pipeline exception:", err);
  }
});

async function executeToggleAction(key, cfg, config) {
  if (!cfg || cfg.type !== 'toggle') return false;
  const curState = (cfg.toggleState === 1) ? 1 : 0;
  const activeDef = (curState === 0) ? (cfg.stateA || {}) : (cfg.stateB || {});
  const nextState = (curState === 0) ? 1 : 0;
  const nextDef = (nextState === 0) ? (cfg.stateA || {}) : (cfg.stateB || {});

  const actType = activeDef.actionType || activeDef.type || 'shortcut';
  const actVal = activeDef.value || '';

  if (actType === 'url' && actVal) await shell.openExternal(actVal);
  else if (actType === 'text' && actVal) await keyboard.type(actVal);
  else if (actType === 'shortcut' && actVal) await executeShortcutString(actVal);
  else if (actType === 'macro' && actVal) await executeMacroSequence(actVal);

  cfg.toggleState = nextState;
  cfg.label = nextDef.label || cfg.label;
  cfg.color = nextDef.color || cfg.color;
  cfg.customColor1 = nextDef.color || cfg.color;
  cfg.textColor = nextDef.textColor || cfg.textColor;
  cfg.customTextColor = nextDef.textColor || cfg.textColor;
  cfg.value = nextDef.value || cfg.value;

  config[key] = cfg;
  const formatted = saveConfigData(config);

  BrowserWindow.getAllWindows().forEach(w => {
    if (w.webContents) {
      w.webContents.send('button-toggled', { key, state: nextState, config: cfg });
      w.webContents.send('config-updated', formatted);
    }
  });

  const pageMatch = key.match(/^p(\d+)-b(\d+)/);
  const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;
  syncSinglePageToHardware(pageNum, formatted, true);
  return true;
}

function saveConfigData(newConfig) {
  const layout1Path = path.join(__dirname, 'Layout 1.json');
  const targetFilePath = (newConfig && newConfig._activeFilePath) ? newConfig._activeFilePath : layout1Path;
  if (newConfig) {
    newConfig._activeFilePath = targetFilePath;
    newConfig._layoutName = path.basename(targetFilePath);
  }
  const formatted = formatLayoutTemplate(newConfig);
  fs.writeFileSync(configPath, JSON.stringify(formatted, null, 2));
  try {
    fs.writeFileSync(targetFilePath, JSON.stringify(formatted, null, 2));
  } catch (e) {
    console.error('Failed to write to active layout file:', e);
  }
  return formatted;
}

ipcMain.handle('toggle-button-state', async (event, key) => {
  const config = loadConfig();
  const cfg = config[key];
  if (!cfg || cfg.type !== 'toggle') return null;
  await executeToggleAction(key, cfg, config);
  return { state: cfg.toggleState, config: cfg };
});

const configPath = path.join(app.getPath('userData'), 'macropad-config.json');

const defaultConfig = {
  // Page Names
  'p1-name': 'Editing Tools',
  'p2-name': 'System Controls',
  'p3-name': 'Custom Macros',

  // Page 1: Editing Tools
  'p1-b1': { label: 'Select All', type: 'shortcut', value: 'select-all', color: '#2980b9' },
  'p1-b2': { label: 'Copy', type: 'shortcut', value: 'copy', color: '#2980b9' },
  'p1-b3': { label: 'Paste', type: 'shortcut', value: 'paste', color: '#2980b9' },
  'p1-b4': { label: 'Undo', type: 'shortcut', value: 'undo', color: '#4b5563' },
  'p1-b5': { label: 'Redo', type: 'shortcut', value: 'redo', color: '#4b5563' },
  'p1-b6': { label: 'Delete', type: 'shortcut', value: 'delete', color: '#c0392b' },

  // Page 2: System Controls
  'p2-b1': { label: '⏮ Prev', type: 'shortcut', value: 'media-prev', color: '#27ae60' },
  'p2-b2': { label: '⏯ Play/Pause', type: 'shortcut', value: 'media-play', color: '#27ae60' },
  'p2-b3': { label: '⏭ Next', type: 'shortcut', value: 'media-next', color: '#27ae60' },
  'p2-b4': { label: '🔉 Vol Down', type: 'shortcut', value: 'vol-down', color: '#8e44ad' },
  'p2-b5': { label: '🔇 Mute Audio', type: 'shortcut', value: 'vol-mute', color: '#8e44ad' },
  'p2-b6': { label: '🔊 Vol Up', type: 'shortcut', value: 'vol-up', color: '#8e44ad' },

  // Page 3: Custom Macros
  'p3-b1': { label: 'Custom 1', type: 'text', value: 'Hello World!', color: '#f39c12' },
  'p3-b2': { label: 'Custom 2', type: 'text', value: 'Snippet 2', color: '#f39c12' },
  'p3-b3': { label: 'Google', type: 'url', value: 'https://www.google.com', color: '#f39c12', icon: 'google-logo.jpg' },
  'p3-b4': { label: 'Custom 4', type: 'text', value: '', color: '#4b5563' },
  'p3-b5': { label: 'Custom 5', type: 'text', value: '', color: '#4b5563' },
  'p3-b6': { label: 'Custom 6', type: 'text', value: '', color: '#4b5563' }
};

function extractAndSaveBase64Images(cfg) {
  if (!cfg || typeof cfg !== 'object') return cfg;
  if (!fs.existsSync(userAssetsDir)) {
    try { fs.mkdirSync(userAssetsDir, { recursive: true }); } catch (e) {}
  }

  for (const key of Object.keys(cfg)) {
    if (/^p\d+-b\d+$/.test(key) && cfg[key] && typeof cfg[key] === 'object') {
      const item = cfg[key];
      if (typeof item.icon === 'string' && item.icon.startsWith('data:image/')) {
        try {
          const match = item.icon.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
          if (match) {
            const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
            const base64Data = match[2];
            let fileName = '';
            if (item.iconOriginalName) {
              const cleanBase = path.basename(item.iconOriginalName).replace(/[^a-zA-Z0-9._-]/g, '_');
              fileName = cleanBase;
            } else {
              fileName = `${key.replace('-', '_')}_icon.${ext}`;
            }
            const targetPath = path.join(userAssetsDir, fileName);
            fs.writeFileSync(targetPath, Buffer.from(base64Data, 'base64'));
            optimizeAssetForHardware(targetPath);
            item.icon = fileName;
            delete item.iconOriginalName;
          }
        } catch (err) {
          console.error(`Failed to extract base64 icon for ${key}:`, err);
        }
      }

      const rawSub = item.sub_buttons || item.children;
      if (Array.isArray(rawSub)) {
        rawSub.forEach((sub, sIdx) => {
          if (sub && typeof sub.icon === 'string' && sub.icon.startsWith('data:image/')) {
            try {
              const match = sub.icon.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
              if (match) {
                const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
                const base64Data = match[2];
                let fileName = '';
                if (sub.iconOriginalName) {
                  const cleanBase = path.basename(sub.iconOriginalName).replace(/[^a-zA-Z0-9._-]/g, '_');
                  fileName = cleanBase;
                } else {
                  fileName = `${key.replace('-', '_')}_sub${sIdx + 1}_icon.${ext}`;
                }
                const targetPath = path.join(userAssetsDir, fileName);
                fs.writeFileSync(targetPath, Buffer.from(base64Data, 'base64'));
                optimizeAssetForHardware(targetPath);
                sub.icon = fileName;
                delete sub.iconOriginalName;
              }
            } catch (err) {
              console.error(`Failed to extract base64 icon for ${key} sub ${sIdx + 1}:`, err);
            }
          }
        });
      }
    }
  }
  return cfg;
}

function formatLayoutTemplate(cfg) {
  if (!cfg || typeof cfg !== 'object') return cfg;
  extractAndSaveBase64Images(cfg);
  const formatted = {};

  // 1. Core Global Settings (matching canonical Layout template)
  formatted._theme = cfg._theme || 'default';
  formatted._screensaverTimeout = cfg._screensaverTimeout !== undefined ? cfg._screensaverTimeout : 300;
  formatted._screensaverAnim = cfg._screensaverAnim || 'bouncing_clock';
  formatted._screensaverImage = cfg._screensaverImage || 'icon.png';
  formatted._brightness = cfg._brightness !== undefined ? cfg._brightness : 50;
  formatted._volume = cfg._volume !== undefined ? cfg._volume : 33;
  if (cfg._bgColor !== undefined) formatted._bgColor = cfg._bgColor;

  // 2. Page Names (p1-name, p2-name, etc.)
  const totalPages = getDynamicTotalPages(cfg);
  for (let p = 1; p <= totalPages; p++) {
    formatted[`p${p}-name`] = cfg[`p${p}-name`] || `Page ${p}`;
  }

  // 3. Page Button Grid objects in sequential order with strict hex codes
  for (let p = 1; p <= totalPages; p++) {
    for (let b = 1; b <= 6; b++) {
      const key = `p${p}-b${b}`;
      const src = cfg[key] || {};
      const itemCopy = { ...src };
      if (itemCopy.color && PRESET_COLOR_MAP[itemCopy.color]) {
        itemCopy.color = PRESET_COLOR_MAP[itemCopy.color];
      } else if (!itemCopy.color || itemCopy.color === 'c-gray') {
        itemCopy.color = '#4b5563';
      }
      if (Array.isArray(itemCopy.sub_buttons)) {
        itemCopy.sub_buttons = itemCopy.sub_buttons.map((sub) => {
          const subCopy = { ...sub };
          if (subCopy.color && PRESET_COLOR_MAP[subCopy.color]) {
            subCopy.color = PRESET_COLOR_MAP[subCopy.color];
          } else if (!subCopy.color || subCopy.color === 'c-gray') {
            subCopy.color = '#4b5563';
          }
          return subCopy;
        });
      }
      formatted[key] = itemCopy;
    }
  }

  // 4. Safe Layout metadata (avoiding legacy nested data/fileName wrappers)
  if (cfg._layoutName) {
    formatted._layoutName = cfg._layoutName;
  }
  if (cfg._activeFilePath) {
    formatted._activeFilePath = cfg._activeFilePath;
  }

  return formatted;
}

function loadConfig() {
  const layout1Path = path.join(__dirname, 'Layout 1.json');
  if (fs.existsSync(configPath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (cached && cached._activeFilePath && fs.existsSync(cached._activeFilePath)) {
        const activeData = JSON.parse(fs.readFileSync(cached._activeFilePath, 'utf-8'));
        activeData._activeFilePath = cached._activeFilePath;
        activeData._layoutName = cached._layoutName || path.basename(cached._activeFilePath);
        return formatLayoutTemplate(activeData);
      }
    } catch (e) {}
  }
  if (fs.existsSync(layout1Path)) {
    try {
      const data = JSON.parse(fs.readFileSync(layout1Path, 'utf-8'));
      data._activeFilePath = layout1Path;
      data._layoutName = 'Layout 1.json';
      const formatted = formatLayoutTemplate(data);
      fs.writeFileSync(configPath, JSON.stringify(formatted, null, 2));
      return formatted;
    } catch (e) {}
  }
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (data && Object.keys(data).length > 0) {
        return formatLayoutTemplate(data);
      }
    } catch (e) {}
  }
  return formatLayoutTemplate({ ...defaultConfig, _activeFilePath: layout1Path, _layoutName: 'Layout 1.json' });
}

const profilesDir = path.join(app.getPath('userData'), 'profiles');
if (!fs.existsSync(profilesDir)) {
  try { fs.mkdirSync(profilesDir, { recursive: true }); } catch (e) {}
}

ipcMain.handle('get-config', () => loadConfig());

ipcMain.handle('list-profiles', () => {
  try {
    const files = fs.readdirSync(profilesDir);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  } catch (e) {
    return ['Default'];
  }
});

ipcMain.handle('save-profile', async (event, profileName, configData) => {
  try {
    const layoutFileName = `${profileName}.json`;
    configData._layoutName = layoutFileName;
    const filePath = path.join(profilesDir, `${profileName}.json`);
    configData._activeFilePath = filePath;
    const formatted = formatLayoutTemplate(configData);
    fs.writeFileSync(filePath, JSON.stringify(formatted, null, 2));
    // Also save as active config
    fs.writeFileSync(configPath, JSON.stringify(formatted, null, 2));
    BrowserWindow.getAllWindows().forEach(win => {
      if (win.webContents) win.webContents.send('config-updated', formatted);
    });
    syncAllPagesToHardware(formatted);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
});

ipcMain.handle('load-profile', async (event, profileName) => {
  try {
    const filePath = path.join(profilesDir, `${profileName}.json`);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      data._layoutName = profileName === 'Default' ? 'Default (Active)' : `${profileName}.json`;
      data._activeFilePath = filePath;
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
      BrowserWindow.getAllWindows().forEach(win => {
        if (win.webContents) win.webContents.send('config-updated', data);
      });
      syncAllPagesToHardware(data);
      return data;
    }
  } catch (e) {
    console.error(e);
  }
  return loadConfig();
});

ipcMain.handle('export-profile', async (event, configData) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
  const defaultFileName = configData._layoutName && configData._layoutName.endsWith('.json') ? configData._layoutName : 'Layout 1.json';
  const result = await dialog.showSaveDialog(targetWin, {
    title: 'Save Layout Profile As',
    defaultPath: defaultFileName,
    filters: [{ name: 'JSON Layout Files', extensions: ['json'] }]
  });
  if (!result.canceled && result.filePath) {
    const fileName = path.basename(result.filePath);
    configData._layoutName = fileName;
    configData._activeFilePath = result.filePath;
    const formatted = formatLayoutTemplate(configData);
    fs.writeFileSync(result.filePath, JSON.stringify(formatted, null, 2));
    fs.writeFileSync(configPath, JSON.stringify(formatted, null, 2));
    BrowserWindow.getAllWindows().forEach(win => {
      if (win.webContents) win.webContents.send('config-updated', formatted);
    });
    return { success: true, fileName, filePath: result.filePath };
  }
  return { success: false };
});

ipcMain.handle('import-profile', async (event) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(targetWin, {
    title: 'Open Layout Profile File',
    properties: ['openFile'],
    filters: [{ name: 'JSON Layout Files', extensions: ['json'] }]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const selectedPath = result.filePaths[0];
      const data = JSON.parse(fs.readFileSync(selectedPath, 'utf-8'));
      const profileName = path.basename(selectedPath, '.json');
      const fileName = path.basename(selectedPath);
      data._layoutName = fileName;
      data._activeFilePath = selectedPath;
      // Save into active startup cache
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
      BrowserWindow.getAllWindows().forEach(win => {
        if (win.webContents) win.webContents.send('config-updated', data);
      });
      syncAllPagesToHardware(data);
      return { profileName, fileName, filePath: selectedPath, data };
    } catch (err) {
      console.error('Failed to import profile:', err);
    }
  }
  return null;
});

ipcMain.handle('select-image', async (event) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(targetWin, {
    title: 'Select Button Image',
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'ico'] }
    ]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const selectedPath = result.filePaths[0];
      const fileName = path.basename(selectedPath);
      const ext = path.extname(selectedPath).toLowerCase().replace('.', '');
      const mimeType = ext === 'jpg' ? 'image/jpeg' : (ext === 'svg' ? 'image/svg+xml' : `image/${ext}`);
      const fileBuf = fs.readFileSync(selectedPath);
      const dataUrl = `data:${mimeType};base64,${fileBuf.toString('base64')}`;

      // Persist in userData/user_assets for standalone app resilience
      if (!fs.existsSync(userAssetsDir)) fs.mkdirSync(userAssetsDir, { recursive: true });
      const userTargetPath = path.join(userAssetsDir, fileName);
      try { fs.writeFileSync(userTargetPath, fileBuf); } catch (e) {}

      return { fileName, dataUrl, filePath: userTargetPath };
    } catch (err) {
      console.error('Error reading selected image:', err);
    }
  }
  return null;
});

ipcMain.handle('export-theme-file', async (event, themeData) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
  const safeName = (themeData && themeData.name) ? themeData.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'custom-theme';
  const defaultName = `${safeName}.matrix-theme.json`;
  const result = await dialog.showSaveDialog(targetWin, {
    title: 'Export Matrix Theme File',
    defaultPath: defaultName,
    filters: [{ name: 'Matrix Theme Files', extensions: ['json'] }]
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, JSON.stringify(themeData, null, 2));
    return { success: true, filePath: result.filePath, fileName: path.basename(result.filePath) };
  }
  return { success: false };
});

ipcMain.handle('import-theme-file', async (event) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(targetWin, {
    title: 'Import Matrix Theme File',
    properties: ['openFile'],
    filters: [{ name: 'Matrix Theme Files', extensions: ['json'] }]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
      return { success: true, theme: data, fileName: path.basename(result.filePaths[0]) };
    } catch (err) {
      console.error('Failed to import theme file:', err);
    }
  }
  return null;
});

ipcMain.handle('save-config', (event, newConfig) => {
  const formatted = saveConfigData(newConfig);
  BrowserWindow.getAllWindows().forEach(win => {
    if (win.webContents) win.webContents.send('config-updated', formatted);
  });
  syncAllPagesToHardware(formatted);
  return true;
});


ipcMain.handle('get-hardware-status', () => {
  const isConnected = hardwareSerialPort && hardwareSerialPort.isOpen;
  return {
    connected: !!isConnected,
    port: isConnected ? hardwareSerialPort.path : null
  };
});

ipcMain.handle('sync-hardware', () => {
  syncAllPagesToHardware();
  return true;
});

// --- Custom Frameless Window Controls ---
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

ipcMain.handle('window-is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
  return win ? win.isMaximized() : false;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});


// --- High-Speed Frame Capture & Hardware Touch Injection ---
ipcMain.handle('capture-macropad-frame', async () => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    const img = await mainWindow.webContents.capturePage();
    if (!img || img.isEmpty()) return null;
    // Resize to exact 800x480 resolution for ESP32-S3 panel
    const resized = img.resize({ width: 800, height: 480, quality: 'good' });
    const jpegBuffer = resized.toJPEG(70);
    return jpegBuffer;
  } catch (err) {
    return null;
  }
});

ipcMain.on('inject-hardware-touch', (event, touchData) => {
  if (!mainWindow || mainWindow.isDestroyed() || !touchData) return;
  const bounds = mainWindow.getBounds();
  const scaleX = bounds.width / 800.0;
  const scaleY = bounds.height / 480.0;
  const targetX = Math.round((touchData.x || 0) * scaleX);
  const targetY = Math.round((touchData.y || 0) * scaleY);

  if (touchData.t === 'd') {
    mainWindow.webContents.sendInputEvent({ type: 'mouseDown', x: targetX, y: targetY, button: 'left', clickCount: 1 });
  } else if (touchData.t === 'm') {
    mainWindow.webContents.sendInputEvent({ type: 'mouseMove', x: targetX, y: targetY });
  } else if (touchData.t === 'u') {
    mainWindow.webContents.sendInputEvent({ type: 'mouseUp', x: targetX, y: targetY, button: 'left', clickCount: 1 });
  }
});
