const fs = require('fs');
const path = require('path');

const uiDir = path.join(__dirname, 'ui');
if (!fs.existsSync(uiDir)) {
  fs.mkdirSync(uiDir, { recursive: true });
}

const filesToCopy = [
  'settings.html',
  'settings.js',
  'settings.css',
  'settings-icons.js',
  'settings-io.js',
  'settings-preview.js',
  'settings-shortcuts.js',
  'theme-builder.js',
  'theme-builder.css',
  'theme.css',
  'hardware-serial.js',
  'screensaver.css',
  'tauri-bridge.js',
  'index.html',
  'index.js',
  'style.css'
];

filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(uiDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
});

// Ensure settings.html is also available as the root index.html
fs.copyFileSync(path.join(__dirname, 'settings.html'), path.join(uiDir, 'index.html'));

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

['assets', 'css'].forEach(dir => {
  const srcDir = path.join(__dirname, dir);
  const destDir = path.join(uiDir, dir);
  if (fs.existsSync(srcDir)) {
    copyDir(srcDir, destDir);
  }
});

console.log('[Tauri Sync] Synchronized frontend assets to ui/ folder.');
