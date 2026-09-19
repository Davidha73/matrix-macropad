#!/bin/bash
cd "$(dirname "$0")"

echo "=== Matrix Macropad (macOS Launcher) ==="

# Check if current node_modules has Windows binaries
if [ -f "node_modules/electron/dist/electron.exe" ]; then
    echo "Switching active environment: Stashing Windows dependencies to node_modules_win..."
    rm -rf node_modules_win
    mv node_modules node_modules_win
fi

# If node_modules_mac exists and node_modules doesn't, restore mac modules
if [ -d "node_modules_mac" ] && [ ! -d "node_modules" ]; then
    echo "Activating Mac dependencies (node_modules_mac -> node_modules)..."
    mv node_modules_mac node_modules
fi

# If node_modules is missing or doesn't have Mac Electron installed, install dependencies
if [ ! -d "node_modules" ] || ([ ! -d "node_modules/electron/dist/Electron.app" ] && [ ! -d "$HOME/.electron-dist/Electron.app" ]); then
    echo "Installing/compiling macOS dependencies (first time setup)..."
    npm install
    if [ ! -d "node_modules/electron/dist/Electron.app" ] && [ ! -d "$HOME/.electron-dist/Electron.app" ] && [ -f "node_modules/electron/install.js" ]; then
        node node_modules/electron/install.js
    fi
fi

echo "Launching Matrix Macropad..."
npm start
