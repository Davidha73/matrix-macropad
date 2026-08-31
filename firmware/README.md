# Matrix Macropad — ESP32-S3 Firmware Guide

This firmware turns your **Guition JC8048W550 / Freenove ESP32-S3 5.0" RGB Touchscreen (800x480)** into an interactive physical macropad controller connected to your PC with **a single USB-C cable**.

---

## ⚡ Hardware Connections
- Plug your single **USB-C cable** into the board's native USB port and into your Windows PC.
- This single cable provides:
  1. 5V Operating Power
  2. Direct Firmware Flashing & Serial Monitor
  3. Bidirectional USB CDC Serial Communication with the desktop app

---

## 🛠 Hardware Abstraction (`matrix_macropad_jc8048w550.h`)
- **Display Driver:** ST7262 800x480 RGB 16-bit Panel (13MHz Pixel Clock).
- **Capacitive Touch:** GT911 (SDA: 19, SCL: 20, INT: 18, RST: 38).
- **Backlight Control:** Pin 2 via 1.5kHz 8-bit PWM LEDC channel.
- **Storage:** Integrated LittleFS Flash filesystem.

---

## 🛠 Option A: Flash with Arduino IDE (Recommended)

1. **Install ESP32 Board Support:**
   - In Arduino IDE, go to `File > Preferences`.
   - Add this URL to *Additional Board Manager URLs*:
     `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Go to `Tools > Board > Boards Manager...`, search for `esp32` and install version `2.0.14` or later.

2. **Install Required Libraries:**
   - Either place the included `libraries/GFX_Library_for_Arduino` and `libraries/TAMC_GT911` into your Arduino libraries directory, or install:
     - `GFX Library for Arduino` (by Moon On Our Nation)
     - `TAMC_GT911` (by TAMC)
     - `ArduinoJson` (by Benoît Blanchon, v6.x or v7.x)
     - `lvgl` (v8.3.11)

3. **Board Settings (`Tools` Menu):**
   - **Board:** `ESP32S3 Dev Module`
   - **USB CDC On Boot:** `Enabled`
   - **USB Mode:** `Hardware CDC and JTAG`
   - **Flash Size:** `16MB (128Mb)`
   - **Partition Scheme:** `16M Flash (3MB APP/9.9MB FATFS)`
   - **PSRAM:** `OPI PSRAM`
   - **Port:** Select your ESP32-S3 COM Port

4. **Upload:**
   - Open [`firmware/MatrixMacropad_Freenove5inch.ino`](./MatrixMacropad_Freenove5inch.ino).
   - Click **Upload** (Arrow icon).

---

## 🛠 Option B: Flash with PlatformIO (VS Code)

1. Open the `firmware/` folder in VS Code with the PlatformIO extension installed.
2. PlatformIO will automatically link local libraries via `lib_extra_dirs = ../libraries` and [`platformio.ini`](./platformio.ini).
3. Click the PlatformIO **Upload** checkmark icon in the bottom status bar.

---

## 🔄 Protocol Reference (USB CDC)

- **Touch Press (ESP32 → PC):**
  ```json
  {"type":"trigger","button":1,"page":1}
  ```
- **Heartbeat & Handshake (PC ↔ ESP32):**
  - PC sends: `{"cmd":"ping"}`
  - ESP32 replies: `{"type":"pong","board":"JC8048W550"}`
- **Sync Layout & Brightness (PC → ESP32):**
  ```json
  {"cmd":"sync_page","page":1,"buttons":[{"label":"Copy","shortcut":"Ctrl+C","bg":"#2980b9"}]}
  {"cmd":"set_brightness","brightness":100}
  ```

