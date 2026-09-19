#!/bin/bash
cd "$(dirname "$0")"

echo "=== Matrix Macropad ESP32-S3 Firmware Flasher (macOS) ==="

# Find serial port (e.g. /dev/cu.usbserial-1120 or /dev/cu.wchusbserial*)
PORT=$(ls /dev/cu.usbserial* /dev/cu.wchusbserial* /dev/cu.SLAB_USBtoUART* 2>/dev/null | head -n 1)

if [ -z "$PORT" ]; then
    PORT=$(ls /dev/tty.usbserial* /dev/tty.wchusbserial* 2>/dev/null | head -n 1)
fi

if [ -z "$PORT" ]; then
    echo "[!] No ESP32-S3 USB serial port found automatically."
    echo "    Please plug in the screen via USB-C and verify the connection."
    PORT="/dev/tty.usbserial-1120"
else
    echo "[+] Detected device on port: $PORT"
fi

# Check for PlatformIO in PATH or standard install locations
PIO_CMD="pio"
if ! command -v pio &> /dev/null; then
    if [ -f "$HOME/.platformio/penv/bin/pio" ]; then
        PIO_CMD="$HOME/.platformio/penv/bin/pio"
    elif [ -f "$HOME/.local/bin/pio" ]; then
        PIO_CMD="$HOME/.local/bin/pio"
    else
        echo "[!] PlatformIO CLI not found in standard paths."
        echo "    Install via: pip3 install platformio   or   brew install platformio"
        echo "    Alternatively, open the firmware folder in VS Code / PlatformIO / Arduino IDE to flash."
        exit 1
    fi
fi

export COPYFILE_DISABLE=1
export COPY_EXTENDED_ATTRIBUTES_DISABLE=1

# Clean macOS AppleDouble resource fork files that corrupt C++ compilation
find firmware -name '._*' -delete 2>/dev/null || true
find libraries -name '._*' -delete 2>/dev/null || true
dot_clean -m firmware libraries 2>/dev/null || true

# Clean cached incompatible libdeps or builds if present
if [ -d "firmware/.pio/build" ] || [ -d "firmware/.pio/libdeps/jc8048w550_esp32s3_5inch/GFX Library for Arduino/src/databus" ]; then
    rm -rf "firmware/.pio/build"
    if grep -q "esp32-hal-periman" "firmware/.pio/libdeps/jc8048w550_esp32s3_5inch/GFX Library for Arduino/src/databus/Arduino_ESP32SPI.h" 2>/dev/null; then
        echo "[*] Cleaning incompatible cached GFX library..."
        rm -rf "firmware/.pio/libdeps"
    fi
fi

echo "[1/2] Compiling and uploading firmware to $PORT..."
"$PIO_CMD" run -d firmware -t upload --upload-port "$PORT"

if [ $? -eq 0 ]; then
    echo "[+] Flashing completed successfully!"
else
    echo "[!] Flash failed. Ensure the screen is not in use by 'npm start' (stop running bridge processes first)."
fi
