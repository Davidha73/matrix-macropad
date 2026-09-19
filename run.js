const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// On macOS, running Electron.app from an external exFAT/FAT drive fails due to macOS Gatekeeper,
// missing POSIX permissions, and broken symlinks on non-APFS volumes.
// We redirect Electron to a local APFS cache directory (~/.electron-dist).
if (process.platform === 'darwin') {
  const localDist = path.join(os.homedir(), '.electron-dist');
  const localElectron = path.join(localDist, 'Electron.app/Contents/MacOS/Electron');

  if (!fs.existsSync(localElectron)) {
    console.log('[Matrix] Preparing local macOS Electron runtime in ~/.electron-dist...');
    try {
      fs.mkdirSync(localDist, { recursive: true });
      const cacheDir = path.join(os.homedir(), 'Library/Caches/electron');
      const findZip = execSync(`find "${cacheDir}" -name "electron-v*-darwin-arm64.zip" -o -name "electron-v*-darwin-x64.zip" 2>/dev/null`)
        .toString().trim().split('\n').filter(Boolean)[0];

      if (findZip && fs.existsSync(findZip)) {
        execSync(`ditto -xk "${findZip}" "${localDist}"`);
      } else {
        process.env.ELECTRON_OVERRIDE_DIST_PATH = localDist;
        const installScript = path.join(__dirname, 'node_modules/electron/install.js');
        if (fs.existsSync(installScript)) {
          execSync(`node "${installScript}"`, { stdio: 'inherit' });
        }
      }
      try {
        execSync(`xattr -cr "${path.join(localDist, 'Electron.app')}" 2>/dev/null`);
      } catch (_) {}
    } catch (e) {
      console.warn('[Matrix] Note: Could not auto-extract local Electron runtime:', e.message);
    }
  }

  if (fs.existsSync(localElectron)) {
    process.env.ELECTRON_OVERRIDE_DIST_PATH = localDist;
  }
}

const electron = require('electron');
const projectDir = path.resolve(__dirname);

console.log('[Matrix] Launching Matrix Macropad...');

const child = spawn(electron, [projectDir], {
  stdio: 'inherit',
  shell: false
});

child.on('close', (code) => {
  process.exit(code);
});

