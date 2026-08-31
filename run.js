const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

const projectDir = path.resolve(__dirname);

console.log('[Matrix] Launching Matrix Macropad...');

const child = spawn(electron, [projectDir], {
  stdio: 'inherit',
  shell: false
});

child.on('close', (code) => {
  process.exit(code);
});
