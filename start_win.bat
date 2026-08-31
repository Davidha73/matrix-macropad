@echo off
cd /d "%~dp0"

echo === Matrix Macropad (Windows Launcher) ===

rem Check if current node_modules has Mac binaries
if exist "node_modules\electron\dist\Electron.app" (
    echo Switching active environment: Stashing Mac dependencies to node_modules_mac...
    if exist node_modules_mac rd /s /q node_modules_mac
    move node_modules node_modules_mac
)

rem If node_modules_win exists and node_modules doesn't, restore windows modules
if exist "node_modules_win" (
    if not exist "node_modules" (
        echo Activating Windows dependencies (node_modules_win -^> node_modules)...
        move node_modules_win node_modules
    )
)

rem If node_modules is missing or doesn't have Windows Electron, install dependencies
if not exist "node_modules" (
    echo Installing Windows dependencies (first time setup)...
    call npm install
)

echo Launching Matrix Macropad...
call npm start
