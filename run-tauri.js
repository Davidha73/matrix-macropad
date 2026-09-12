const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const nodeDir = path.dirname(process.execPath);
const cargoBin = path.join(os.homedir(), '.cargo', 'bin');
const delimiter = process.platform === 'win32' ? ';' : ':';

const existingPath = process.env.Path || process.env.PATH || '';
const newPath = `${nodeDir}${delimiter}${cargoBin}${delimiter}${existingPath}`;

const env = {
  ...process.env,
  PATH: newPath,
  Path: newPath,
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--disable-gpu --disable-gpu-compositing'
};

console.log('[Matrix] Launching Tauri development mode...');

const tauriJs = path.join(__dirname, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');

const child = spawn(process.execPath, [tauriJs, 'dev'], {
  stdio: 'inherit',
  shell: false,
  env
});

child.on('close', (code) => {
  process.exit(code || 0);
});
