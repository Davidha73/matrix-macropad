@echo off
chcp 65001 >nul
set "TARGET_PORT=%1"
if "%TARGET_PORT%"=="" (
    for /f "tokens=*" %%P in ('powershell -NoProfile -Command "$dev = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Caption -match 'CH340|CP210|FTDI|ESP|USB-SERIAL|USB Serial' -and $_.Caption -match '\((COM\d+)\)' } | Select-Object -First 1; if (-not $dev) { $dev = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Caption -match '\((COM\d+)\)' -and $_.Caption -notmatch 'Bluetooth' } | Select-Object -First 1 }; if ($dev -and $dev.Caption -match '\((COM\d+)\)') { Write-Output $Matches[1] }"' ) do (
        set "TARGET_PORT=%%P"
    )
)
if "%TARGET_PORT%"=="" set "TARGET_PORT=COM5"
echo Opening Serial Monitor on %TARGET_PORT% (115200 baud)...
"C:\Users\david\.platformio\penv\Scripts\pio.exe" device monitor -p %TARGET_PORT% -b 115200
