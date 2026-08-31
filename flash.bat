@echo off
chcp 65001 >nul
echo [1/2] Compiling firmware with PlatformIO...
"C:\Users\david\.platformio\penv\Scripts\pio.exe" run -d firmware
if errorlevel 1 (
    echo [ERROR] Firmware compilation failed!
    exit /b %errorlevel%
)
echo.
echo [2/2] Flashing binary to ESP32-S3 (COM5)...
"C:\Users\david\.platformio\penv\Scripts\esptool.exe" --chip esp32s3 --port COM5 --baud 460800 --before default-reset --after hard-reset write-flash -z --flash-mode dio --flash-freq 80m --flash-size 16MB 0x0000 "firmware\.pio\build\jc8048w550_esp32s3_5inch\bootloader.bin" 0x8000 "firmware\.pio\build\jc8048w550_esp32s3_5inch\partitions.bin" 0xe000 "C:\Users\david\.platformio\packages\framework-arduinoespressif32\tools\partitions\boot_app0.bin" 0x10000 "firmware\.pio\build\jc8048w550_esp32s3_5inch\firmware.bin"
