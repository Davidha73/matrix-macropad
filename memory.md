## [2026-09-12 v1.8.66]
- **Status:** Resolved clock skipping/jumping issue by implementing native `WIDGET_CLOCK` and `WIDGET_DATE` handling in the firmware's local 250ms timer subsystem, eliminating the 1-second serial packet flood and reducing PC time synchronization to once every 60 seconds without RTC resets. Added a 1-second live preview ticker in the desktop app.
- **Files Changed:**
  - [firmware/matrix_macropad_jc8048w550.h](file:///c:/Users/david/Documents/Projects/matrix-macropad-git/firmware/matrix_macropad_jc8048w550.h)
  - [firmware/MatrixMacropad_Freenove5inch.ino](file:///c:/Users/david/Documents/Projects/matrix-macropad-git/firmware/MatrixMacropad_Freenove5inch.ino)
  - [main.js](file:///c:/Users/david/Documents/Projects/matrix-macropad-git/main.js)
  - [settings-preview.js](file:///c:/Users/david/Documents/Projects/matrix-macropad-git/settings-preview.js)
  - [ui/settings-preview.js](file:///c:/Users/david/Documents/Projects/matrix-macropad-git/ui/settings-preview.js)
- **Next Objectives:**
  - Verify smooth, 1-second incremental clock progression on hardware touchscreen and preview grid.
