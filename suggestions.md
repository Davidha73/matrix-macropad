# Matrix Macropad — Feature Suggestions & Roadmap Ideas

This document collects architectural and feature enhancement ideas for both the **Pad** (macropad touchscreen & bridge) and **Config** (settings window).

---

## 1. Pad (Macropad & Bridge Features)

### 🔹 Auto-Profile Switching (Active App Detection)

- **Concept:** Automatically switch macropad layout profiles based on the currently focused desktop application (Windows & macOS).
- **Examples:**
  - Launching `Photoshop` or `SolidWorks` auto-activates the "Design / CAD" profile.
  - Launching `VS Code` or `Terminal` auto-activates the "Developer Shortcuts" profile.
  - Launching `Spotify` auto-activates the "Media Player" profile.

### ~~🔹 Multi-State Toggle Buttons~~ _(✅ Completed)_

- **Concept:** Buttons that toggle between two distinct visual and functional states on tap.
- **Implemented:** Added `Multi-State Toggle` action type with dual-state (State A / State B) actions, custom colors, labels, quick presets (Mic, Media, OBS, Theme, Volume), real-time preview toggle flipping, and hardware serial trigger synchronization.

### 🔹 Live System Telemetry Widgets

- **Concept:** Dedicated dynamic widget tiles that periodically poll hardware statistics via lightweight desktop backend APIs and stream updates to the hardware screen.
- **Candidate Widgets:**
  - **CPU Utilization:** Real-time percentage & mini progress bar / sparkline.
  - **RAM Usage:** Memory percentage & available capacity.
  - **Network Monitor:** Live upload/download throughput.
  - **GPU & Temperature:** Core load and thermal readings.

### 🔹 Webhooks & Smart Home Triggers (HTTP Requests)

- **Concept:** Allow button actions to fire local or cloud HTTP requests (GET/POST).
- **Examples:**
  - Control smart desk lights (Home Assistant, Philips Hue, Elgato Key Light).
  - Trigger local webhook automations or web server actions.

### 🔹 Touch & Click Feedback (Audio & Visual)

- **Concept:** Enhanced tactile confirmation tailored for touchscreens and desktop use.
- **Features:**
  - **Audio Click:** Subtle, low-latency mechanical switch click sound on tap with volume control.
  - **Visual Ripple / Glow:** Radial pulse ripple on button tap.

### 🔹 Nested Sub-Folder Buttons

- **Concept:** Buttons that act as directory folders.
- **Workflow:** Tapping a "Photoshop Tools" or "Dev Tools" button swaps the grid into a nested 6-button submenu with a dedicated "Back" return button.

### 🔹 Long-Press Secondary Triggers

- **Concept:** Differentiate between short tap (primary macro) and long hold (secondary action or submenu trigger).

### 🔹 Interactive Screensavers

- **Concept:** Additional screensaver animation modes:
  - **Matrix Digital Rain:** Falling green glyphs.
  - **Retro Synthwave Grid:** 3D perspective wireframe horizon with floating sun.
  - **Floating HUD Clock:** Smooth bouncing clock with customizable background wallpaper.

---

## 2. Config (Settings Window)

### ~~🔹 Drag-and-Drop Button Reordering~~ _(✅ Completed)_

- **Concept:** Drag preview button tiles directly in the 6-button preview grid to swap, move, or duplicate buttons across pages.

### 🔹 Macro Sandbox Test Runner

- **Concept:** A "Test Trigger" button directly inside Config to verify shortcuts and text insertion without leaving the window.

### ~~🔹 Multi-Key Sequence Builder (Delayed Macros)~~ _(✅ Completed)_

- **Concept:** Visual macro timeline builder allowing delays between keys (e.g., `Ctrl+C` → wait `150ms` → `Alt+Tab` → wait `100ms` → `Ctrl+V`).
- **Implemented:** Chained multi-key sequences with configurable delays and keypress actions.

### ~~🔹 Custom Hex / RGB Color Wheel Picker & Gradients~~ _(✅ Completed)_

- **Implemented:** Added Solid, Linear, and Radial gradient generator, color pickers, angle slider, text color picker, and dynamic style presets.

### ~~🔹 Custom Border Style, Dashed Spacing & Corner Brackets~~ _(✅ Completed)_

- **Implemented:** Added Solid, Dashed (2px-120px gap control & presets), Dotted, Double, Neon Glow, and Corner Brackets (Reticle) with customizable arm length & corner radii.

### ~~🔹 Copy & Paste Button Styles / Batch Style Application~~ _(✅ Completed)_

- **Implemented:** Added `Apply to Page` and `Apply to All Pages` batch actions in Config.

### ~~🔹 Profile Import / Export & Sharing~~ _(✅ Completed)_

- **Implemented:** Profile manager with active profile switching, profile creation, custom profile deletion, direct profile JSON file export, and layout file import.

### ~~🔹 Collapsible Configuration Sections & Fixed Split Viewport~~ _(✅ Completed)_

- **Implemented:** 4 organized collapsible accordions (Action & Trigger, Label & Iconography, Appearance & Colors, Border & Corner Framing) with fixed preview column, independent scrolling, and zero layout shift (`scrollbar-gutter: stable`).

---

## 3. General & Infrastructure

### ~~🔹 Standalone macOS Application & Verified DMG Packaging~~ _(✅ Completed)_

- **Implemented:** Universal/Apple Silicon macOS `.app` and `.dmg` installer with deep ad-hoc codesigning hook (`after-pack.js`), custom `.icns` artwork, and top Menu Bar status tray bridge.

### ~~🔹 Custom Theme Builder, Editor & Library Suite~~ _(✅ Completed)_

- **Implemented:** Dedicated `theme-builder.js` and `theme-builder.css` modular suite with custom palette editor, one-click layout capture, in-place custom theme editing, active theme library, and JSON theme import/export.

### ~~🔹 Clean Script & Stylesheet Architecture Separation~~ _(✅ Completed)_

- **Implemented:** All client code cleanly extracted into dedicated `index.js`, `settings.js`, `theme-builder.js`, `style.css`, `settings.css`, `theme-builder.css`, and `theme.css` without inline JS or styling attributes.

### ~~🔹 Google Material Symbols Upgraded for Widgets~~ _(✅ Completed)_

- **Implemented:** Clean Material Symbols iconography integrated for stopwatch, timers, shortcuts, and navigation elements.

- **Global Hotkeys:** Ability to summon / minimize Pad or switch pages using global keyboard shortcuts.
- **Multi-Monitor / Display Pinning:** Option to pin Pad to a dedicated secondary mini-screen or touchscreen display on startup.
