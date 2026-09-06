@echo off
chcp 65001 >nul
echo [1/3] Detecting ESP32 serial port...
set "TARGET_PORT="
for /f "tokens=*" %%P in ('powershell -NoProfile -Command "$dev = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Caption -match 'CH340|CP210|FTDI|ESP|USB-SERIAL|USB Serial' -and $_.Caption -match '\((COM\d+)\)' } | Select-Object -First 1; if (-not $dev) { $dev = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Caption -match '\((COM\d+)\)' -and $_.Caption -notmatch 'Bluetooth' } | Select-Object -First 1 }; if ($dev -and $dev.Caption -match '\((COM\d+)\)') { Write-Output $Matches[1] }"' ) do (
    set "TARGET_PORT=%%P"
)

if "%TARGET_PORT%"=="" (
    echo [ERROR] No ESP32 or USB-Serial device found!
    echo Please check USB cable connection.
    exit /b 1
)
echo Found device on %TARGET_PORT%

echo.
echo [2/3] Compiling firmware with PlatformIO...
"C:\Users\david\.platformio\penv\Scripts\pio.exe" run -d firmware
if errorlevel 1 (
    echo [ERROR] Firmware compilation failed!
    exit /b %errorlevel%
)

echo.
echo [3/3] Flashing binary to ESP32-S3 (%TARGET_PORT%)...
"C:\Users\david\.platformio\penv\Scripts\esptool.exe" --chip esp32s3 --port %TARGET_PORT% --baud 460800 --before default-reset --after hard-reset write-flash -z --flash-mode dio --flash-freq 80m --flash-size 16MB 0x0000 "firmware\.pio\build\jc8048w550_esp32s3_5inch\bootloader.bin" 0x8000 "firmware\.pio\build\jc8048w550_esp32s3_5inch\partitions.bin" 0xe000 "C:\Users\david\.platformio\packages\framework-arduinoespressif32\tools\partitions\boot_app0.bin" 0x10000 "firmware\.pio\build\jc8048w550_esp32s3_5inch\firmware.bin"
