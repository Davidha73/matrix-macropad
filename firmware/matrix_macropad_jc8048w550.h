/**
 * matrix_macropad_jc8048w550.h
 * 
 * Modular Hardware Abstraction Layer for Guition JC8048W550 (5" 800x480 RGB Display)
 * Provides verified RGB Panel timings, GT911 touch setup, Backlight PWM, and Hybrid LittleFS + MicroSD storage.
 */

#ifndef MATRIX_MACROPAD_JC8048W550_H
#define MATRIX_MACROPAD_JC8048W550_H

#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include <Arduino_GFX_Library.h>
#include <TAMC_GT911.h>
#include <LittleFS.h>
#include <FS.h>
#include <ArduinoJson.h>
#include <lvgl.h>

enum BorderType {
  BORDER_NONE = 0,
  BORDER_SOLID,
  BORDER_DASHED,
  BORDER_DOTTED,
  BORDER_BRACKETS,
  BORDER_DOUBLE,
  BORDER_GLOW
};

enum WidgetType {
  WIDGET_BUTTON = 0,
  WIDGET_STOPWATCH,
  WIDGET_COUNTDOWN,
  WIDGET_CLOCK,
  WIDGET_DATE
};

#define MAX_SUB_BUTTONS 6

struct SubButtonInfo {
  uint16_t id;
  char label[32];
  char type[16];
  char payload[64];
  char icon[32];
  lv_color_t bg_color;
  lv_color_t text_color;
  lv_color_t icon_color;
  lv_color_t border_color;
  uint8_t border_width;
  uint8_t border_radius;
};

// UI Button Widget definition
struct ButtonWidget {
  lv_obj_t *btn;
  lv_obj_t *icon;
  lv_obj_t *img;
  lv_obj_t *label;
  lv_obj_t *folder_badge;
  char img_path[64];
  int page;
  int index;
  BorderType border_style;
  lv_color_t border_color;
  uint8_t border_width;
  uint8_t border_radius;
  uint8_t dash_len;
  uint8_t dash_gap;
  uint8_t bracket_len;
  WidgetType widget_type;
  char widget_format[16];
  bool timer_running;
  bool timer_alerting;
  uint32_t timer_seconds;
  uint32_t timer_initial_duration;
  uint32_t last_click_time;
  uint32_t last_tick_ms;
  lv_color_t orig_bg_color;
  lv_color_t orig_text_color;
  bool alert_flash_state;
  bool has_sub_buttons;
  uint8_t sub_button_count;
  SubButtonInfo sub_buttons[MAX_SUB_BUTTONS];
};

// Theme Palette Color definition
struct PaletteColor {
  uint32_t bg;
  uint32_t bg2;
  uint32_t text;
};

// --- Screen Parameters ---
#define JC_SCREEN_WIDTH       800
#define JC_SCREEN_HEIGHT      480
#define JC_SCREEN_ROTATION    2

// --- Backlight PWM ---
#define JC_GFX_BL             2
#define JC_BL_PWM_CHANNEL     0
#define JC_BL_PWM_FREQ        1500
#define JC_BL_PWM_RESOLUTION  8

// --- GT911 Touch Pins ---
#define JC_TOUCH_SDA          19
#define JC_TOUCH_SCL          20
#define JC_TOUCH_INT          -1
#define JC_TOUCH_RST          38

// --- MicroSD (TF) Card SPI Pins ---
#define JC_SD_CS              10
#define JC_SD_SCK             12
#define JC_SD_MOSI            11
#define JC_SD_MISO            13

// --- Freenove / JC I2S Speaker Amplifier Pins ---
#define JC_I2S_BCLK           0
#define JC_I2S_LRCLK          18
#define JC_I2S_DOUT           17
#define JC_AUDIO_PIN          JC_I2S_DOUT

class JC8048W550_HAL {
public:
  Arduino_ESP32RGBPanel *rgbpanel;
  Arduino_RGB_Display *gfx;
  TAMC_GT911 *touch;
  SPIClass sdSPI;
  fs::FS *storage;
  bool sdMounted;
  bool littlefsMounted;

  JC8048W550_HAL()
    : rgbpanel(nullptr), gfx(nullptr), touch(nullptr), sdSPI(FSPI), storage(&LittleFS),
      sdMounted(false), littlefsMounted(false) {}

  bool begin() {
    // 1. Initialize Display Bus & Panel
    rgbpanel = new Arduino_ESP32RGBPanel(
        40 /* DE */, 41 /* VSYNC */, 39 /* HSYNC */, 42 /* PCLK */,
        45 /* R0 */, 48 /* R1 */, 47 /* R2 */, 21 /* R3 */, 14 /* R4 */,
        5 /* G0 */, 6 /* G1 */, 7 /* G2 */, 15 /* G3 */, 16 /* G4 */, 4 /* G5 */,
        8 /* B0 */, 3 /* B1 */, 46 /* B2 */, 9 /* B3 */, 1 /* B4 */,
        0 /* hsync_polarity */, 4 /* hsync_front_porch */, 4 /* hsync_pulse_width */, 8 /* hsync_back_porch */,
        0 /* vsync_polarity */, 4 /* vsync_front_porch */, 4 /* vsync_pulse_width */, 8 /* vsync_back_porch */,
        1 /* pclk_active_neg */, 12000000 /* prefer_speed (12MHz) */, false /* useBigEndian */,
        0 /* de_idle_high */, 0 /* pclk_idle_high */, (size_t)(JC_SCREEN_WIDTH * 10) /* bounce_buffer_size_px */
    );

    gfx = new Arduino_RGB_Display(JC_SCREEN_WIDTH, JC_SCREEN_HEIGHT, rgbpanel, JC_SCREEN_ROTATION, true);
    if (!gfx || !gfx->begin()) {
      Serial.println("[JC8048W550] Display Init Failed!");
      return false;
    }

    // 2. Initialize Backlight PWM
    pinMode(JC_GFX_BL, OUTPUT);
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
    ledcAttach(JC_GFX_BL, JC_BL_PWM_FREQ, JC_BL_PWM_RESOLUTION);
#else
    ledcSetup(JC_BL_PWM_CHANNEL, JC_BL_PWM_FREQ, JC_BL_PWM_RESOLUTION);
    ledcAttachPin(JC_GFX_BL, JC_BL_PWM_CHANNEL);
#endif
    setBrightness(50);

    // 3. Initialize Touch
    touch = new TAMC_GT911(JC_TOUCH_SDA, JC_TOUCH_SCL, JC_TOUCH_INT, JC_TOUCH_RST, JC_SCREEN_WIDTH, JC_SCREEN_HEIGHT);
    touch->begin();
    touch->setRotation(ROTATION_NORMAL);

    // 4. Initialize LittleFS Flash Storage
    if (LittleFS.begin(true)) {
      littlefsMounted = true;
      Serial.println("[JC8048W550] LittleFS Mounted Successfully!");
    } else {
      littlefsMounted = false;
      Serial.println("[JC8048W550] LittleFS Mount Failed!");
    }

    // 5. Initialize MicroSD Card (with automatic fallback to LittleFS)
    sdSPI.begin(JC_SD_SCK, JC_SD_MISO, JC_SD_MOSI, JC_SD_CS);
    pinMode(JC_SD_CS, OUTPUT);
    digitalWrite(JC_SD_CS, HIGH);

    if (SD.begin(JC_SD_CS, sdSPI, 20000000)) {
      sdMounted = true;
      uint64_t cardSize = SD.cardSize() / (1024 * 1024);
      Serial.printf("[JC8048W550] MicroSD Mounted (%llu MB)!\n", cardSize);
      storage = &SD;
    } else {
      sdMounted = false;
      Serial.println("[JC8048W550] MicroSD not detected, using LittleFS.");
      storage = &LittleFS;
    }

    // 6. Initialize Audio Pins (held LOW to hold amplifier in low-power shutdown during boot)
    pinMode(JC_I2S_BCLK, OUTPUT);
    digitalWrite(JC_I2S_BCLK, LOW);
    pinMode(JC_I2S_LRCLK, OUTPUT);
    digitalWrite(JC_I2S_LRCLK, LOW);
    pinMode(JC_I2S_DOUT, OUTPUT);
    digitalWrite(JC_I2S_DOUT, LOW);

    return true;
  }

  void setBrightness(uint8_t percent) {
    if (percent > 100) percent = 100;
    if (percent == 0) {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
      ledcWrite(JC_GFX_BL, 0);
#else
      ledcWrite(JC_BL_PWM_CHANNEL, 0);
#endif
      return;
    }
    // Perceptual gamma curve (~3.32) mapping 50% slider value directly to ~10% hardware PWM duty (25-26/255)
    float normalized = (float)percent / 100.0f;
    uint32_t duty = (uint32_t)(powf(normalized, 3.32f) * 254.0f + 1.0f);
    if (duty > 255) duty = 255;
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
    ledcWrite(JC_GFX_BL, duty);
#else
    ledcWrite(JC_BL_PWM_CHANNEL, duty);
#endif
  }
};

#endif // MATRIX_MACROPAD_JC8048W550_H
