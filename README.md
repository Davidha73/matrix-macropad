# Matrix Macropad 🎛️

Desktop bridge, layout configurator, and serial sync engine for the **ESP32-S3 (5-inch touch display)** Matrix Macropad.

---

## 📥 Download & Install (Ready-to-Use)

You don't need to build from source to use Matrix Macropad! Pre-built standalone installers are available on the **[Releases Page](https://github.com/Davidha73/matrix-macropad/releases)**.

### 🪟 Windows
1. Download **`Matrix Macropad Setup X.X.X.exe`** (or the portable `Matrix Macropad X.X.X.exe`).
2. Double-click the installer and follow the setup wizard.
3. The app will create Desktop and Start Menu shortcuts and run in your system tray.

### 🍏 macOS
1. Download **`Matrix Macropad-X.X.X.dmg`**.
2. Open the `.dmg` and drag **Matrix Macropad** into your **Applications** folder.
3. Launch the app from Applications or Spotlight.

---

## ✨ Features

- **Live Touchscreen Synchronization:** Seamlessly streams active page configurations, widget labels, icons, colors, and layouts to the ESP32-S3 over USB Serial.
- **Cross-Platform Bridge:** Native keyboard keystroke simulation, macro chords, application switching, and volume controls on Windows and macOS.
- **Custom Theme Engine:** Built-in theme designer with custom color palettes, borders, fonts, and dark mode styling.
- **Rich Icon Library:** Full integration with Google Material Symbols and custom bitmap icons.
- **Auto-Updates:** Integrated `electron-updater` with GitHub Releases support for automatic over-the-air updates.
- **Background Tray Mode:** Runs quietly in the system tray with auto-startup support on Windows and macOS.

---

## 🛠️ Developer Setup (Run from Source)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- Git

### Installation
```bash
# Clone the repository
git clone https://github.com/Davidha73/matrix-macropad.git
cd matrix-macropad

# Install dependencies
npm install
```

### Running Locally
```bash
npm start
```

---

## 📦 Building Standalone Releases

### Windows (.exe Installer & Portable)
```bash
npm run dist
```
Generates:
- `dist/Matrix Macropad Setup X.X.X.exe` (NSIS Setup Installer)
- `dist/Matrix Macropad X.X.X.exe` (Standalone Portable Exe)
- `dist/latest.yml` & `*.blockmap` (Auto-update metadata)

### macOS (.dmg & .zip)
```bash
npm run dist:mac
```
Generates:
- `dist/Matrix Macropad-X.X.X.dmg` (Installer Disk Image)
- `dist/Matrix Macropad-X.X.X-mac.zip` (Auto-update payload)
- `dist/latest-mac.yml` (Auto-update metadata)

---

## ⚡ Firmware Flashing (ESP32-S3)

The `firmware/` directory contains the PlatformIO / Arduino C++ firmware for the JC8048W550 5-inch touchscreen.

- **Windows:** Run `flash.bat` (or `npm run flash:win`)
- **macOS / Linux:** Run `./flash.sh` (or `npm run flash`)

---

## 🔄 Publishing Releases

1. Update the `"version"` field in `package.json` (e.g. `1.0.1`).
2. Run `npm run dist` on Windows and `npm run dist:mac` on macOS.
3. Create a new Release on [GitHub Releases](https://github.com/Davidha73/matrix-macropad/releases) with tag `vX.X.X`.
4. Attach the generated `.exe`, `.dmg`, `.zip`, `.blockmap`, and `.yml` files. Installed instances will automatically detect and download updates.

---

## 📄 License
MIT License.
