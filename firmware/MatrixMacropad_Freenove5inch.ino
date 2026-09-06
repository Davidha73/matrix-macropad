/*
 * Matrix Macropad — High-Fidelity Hybrid Navigation & Macro Engine
 * Combines Custom HTML/CSS Top Navigation with Native LVGL Tabview Engine:
 * - Top Header: [<] Left Arrow, Dynamic Profile Tab Buttons, [>] Right Arrow
 * - Active Tab glowing indicator (#3498db border, #34495e fill)
 * - Zero-Height Native Tabview for instant 0ms page switching & rock-solid sync
 * - 3x2 Grid: 20px Rounded Macro Buttons with Vertical Gradient Lighting
 */

#include <Arduino.h>
#include <Wire.h>
#include <ArduinoJson.h>
#include <lvgl.h>
#include <driver/i2s.h>
#include <time.h>
#include <sys/time.h>
#include "matrix_macropad_jc8048w550.h"
#include "src/material_symbols_map.h"

// Hardware Abstraction Layer for JC8048W550 (RGB Panel, GT911 Touch, Backlight PWM, LittleFS)
static JC8048W550_HAL hal;

// LVGL Full Frame Buffer in PSRAM (800x480)
#define DISP_BUF_SIZE (JC_SCREEN_WIDTH * JC_SCREEN_HEIGHT)
static lv_disp_draw_buf_t draw_buf;
static lv_color_t *buf1;

// Display Flush Callback
void my_disp_flush(lv_disp_drv_t *disp, const lv_area_t *area, lv_color_t *color_p) {
  uint32_t w = (area->x2 - area->x1 + 1);
  uint32_t h = (area->y2 - area->y1 + 1);

  if (hal.gfx) {
    hal.gfx->draw16bitRGBBitmap(area->x1, area->y1, (uint16_t *)color_p, w, h);
    hal.gfx->flush();
  }
  lv_disp_flush_ready(disp);
}

// Touchpad Read Callback
void my_touchpad_read(lv_indev_drv_t *indev_driver, lv_indev_data_t *data) {
  if (hal.touch) {
    hal.touch->read();
    if (hal.touch->isTouched && hal.touch->touches > 0) {
      data->state = LV_INDEV_STATE_PR;
      data->point.x = hal.touch->points[0].x;
      data->point.y = hal.touch->points[0].y;
      return;
    }
  }
  data->state = LV_INDEV_STATE_REL;
}

// UI State
#define MAX_PAGES 6
#define BUTTONS_PER_PAGE 6

static lv_obj_t *tabview;
static lv_obj_t *tab_track;
static lv_obj_t *btn_prev;
static lv_obj_t *btn_next;
static lv_obj_t *tab_pages[MAX_PAGES];
static lv_obj_t *tab_btns[MAX_PAGES];
static lv_obj_t *tab_btn_labels[MAX_PAGES];
static uint32_t current_bg_color = 0x111317;

static inline bool isLightColor(uint32_t hex) {
  uint8_t r = (hex >> 16) & 0xFF;
  uint8_t g = (hex >> 8) & 0xFF;
  uint8_t b = hex & 0xFF;
  uint32_t lum = (uint32_t)(0.299f * r + 0.587f * g + 0.114f * b);
  return lum > 140;
}
static ButtonWidget grid_buttons[MAX_PAGES][BUTTONS_PER_PAGE];
static int total_pages = 3;
static int active_page = 0;

static lv_obj_t *edge_flash_overlay = NULL;
static bool edge_flash_active = false;
static bool edge_flash_state = false;
static bool page_has_alarm[MAX_PAGES] = {false};

static lv_obj_t *sync_popup = NULL;
static lv_obj_t *sync_popup_lbl = NULL;
static uint32_t sync_popup_hide_time = 0;

void showSyncPopup(const char* text = "Syncing Layout...") {
  if (sync_popup) {
    if (sync_popup_lbl) lv_label_set_text(sync_popup_lbl, text ? text : "Syncing Layout...");
    lv_obj_clear_flag(sync_popup, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(sync_popup);
    sync_popup_hide_time = millis() + 2000;
    lv_refr_now(NULL);
  }
}

void hideSyncPopup() {
  if (sync_popup) {
    lv_obj_add_flag(sync_popup, LV_OBJ_FLAG_HIDDEN);
    sync_popup_hide_time = 0;
    lv_obj_invalidate(lv_scr_act());
    lv_refr_now(NULL);
  }
}

// --- Screensaver System (Idle Inactivity Detection & Bouncing Animated HUD) ---
static uint32_t screensaver_timeout_sec = 300;
static bool screensaver_active = false;
static uint32_t screensaver_start_ms = 0;
static bool screen_sleep_active = false;
static lv_obj_t *screensaver_layer = NULL;
static lv_obj_t *screensaver_widget = NULL;
static lv_obj_t *screensaver_time_lbl = NULL;
static lv_obj_t *screensaver_sub_lbl = NULL;
static lv_timer_t *screensaver_timer = NULL;

static int16_t ss_x = 200, ss_y = 150;
static int16_t ss_vx = 3, ss_vy = 2;
static const int16_t SS_WIDTH = 340, SS_HEIGHT = 160;
static uint32_t ss_color_hue = 0;
static String screensaver_anim_mode = "bouncing_clock";
static int16_t ss_pulse_step = 0;
static uint8_t active_backlight_val = 50;

#define MATRIX_RAIN_COLS 22
#define MATRIX_RAIN_ROWS 14

struct MatrixRainCol {
  lv_obj_t *label;
  int16_t y_pos;
  int8_t speed;
  char text[MATRIX_RAIN_ROWS * 2 + 1];
};

static MatrixRainCol matrix_cols[MATRIX_RAIN_COLS];
static const char matrix_glyphs[] = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ<>[]{}+=*&%$#@!/?";

#define STARFIELD_COUNT 36

struct StarParticle {
  lv_obj_t *obj;
  float x;
  float y;
  float z;
};

static StarParticle star_particles[STARFIELD_COUNT];

void hideScreensaver();
void showScreensaver();
void updateScreensaverTheme();
void openFolderModal(ButtonWidget *w);
void closeFolderModal();
void openTimerPresetModal(ButtonWidget *w);
void closeTimerModals();

static void screensaver_touch_cb(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_PRESSED || code == LV_EVENT_CLICKED) {
    hideScreensaver();
  }
}

void updateScreensaverTheme() {
  if (!screensaver_widget) return;

  if (screensaver_anim_mode == "screen_off") {
    lv_obj_add_flag(screensaver_widget, LV_OBJ_FLAG_HIDDEN);
  } else {
    lv_obj_clear_flag(screensaver_widget, LV_OBJ_FLAG_HIDDEN);
  }

  // Toggle Matrix Rain Background Columns
  for (int i = 0; i < MATRIX_RAIN_COLS; i++) {
    if (matrix_cols[i].label) {
      if (screensaver_anim_mode == "matrix_rain") {
        lv_obj_clear_flag(matrix_cols[i].label, LV_OBJ_FLAG_HIDDEN);
      } else {
        lv_obj_add_flag(matrix_cols[i].label, LV_OBJ_FLAG_HIDDEN);
      }
    }
  }

  // Toggle 3D Starfield Warp Particles
  for (int i = 0; i < STARFIELD_COUNT; i++) {
    if (star_particles[i].obj) {
      if (screensaver_anim_mode == "starfield") {
        lv_obj_clear_flag(star_particles[i].obj, LV_OBJ_FLAG_HIDDEN);
      } else {
        lv_obj_add_flag(star_particles[i].obj, LV_OBJ_FLAG_HIDDEN);
      }
    }
  }

  if (screensaver_anim_mode == "matrix_rain") {
    // Cyberpunk Matrix Terminal (Semi-transparent overlay over rain)
    lv_obj_set_size(screensaver_widget, 420, 180);
    lv_obj_set_style_radius(screensaver_widget, 10, LV_PART_MAIN);
    lv_obj_set_style_bg_color(screensaver_widget, colorHex(0x020f08), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(screensaver_widget, LV_OPA_90, LV_PART_MAIN);
    lv_obj_set_style_border_color(screensaver_widget, colorHex(0x00ff66), LV_PART_MAIN);
    lv_obj_set_style_border_width(screensaver_widget, 2, LV_PART_MAIN);
    lv_obj_set_style_shadow_color(screensaver_widget, colorHex(0x00ff66), LV_PART_MAIN);
    lv_obj_set_style_shadow_width(screensaver_widget, 25, LV_PART_MAIN);
    lv_obj_set_style_shadow_opa(screensaver_widget, LV_OPA_70, LV_PART_MAIN);
    if (screensaver_time_lbl) {
      lv_obj_set_style_text_color(screensaver_time_lbl, colorHex(0x00ff66), LV_PART_MAIN);
    }
    if (screensaver_sub_lbl) {
      lv_obj_set_style_text_color(screensaver_sub_lbl, colorHex(0x00cc55), LV_PART_MAIN);
    }
  } else if (screensaver_anim_mode == "pulsing_glow") {
    // Clean Minimalist Centered Hero Clock
    lv_obj_set_size(screensaver_widget, 440, 200);
    lv_obj_set_style_radius(screensaver_widget, 28, LV_PART_MAIN);
    lv_obj_set_style_bg_color(screensaver_widget, colorHex(0x060913), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(screensaver_widget, LV_OPA_90, LV_PART_MAIN);
    lv_obj_set_style_border_color(screensaver_widget, colorHex(0x00f0ff), LV_PART_MAIN);
    lv_obj_set_style_border_width(screensaver_widget, 3, LV_PART_MAIN);
    lv_obj_set_style_shadow_color(screensaver_widget, colorHex(0x00f0ff), LV_PART_MAIN);
    lv_obj_set_style_shadow_width(screensaver_widget, 30, LV_PART_MAIN);
    lv_obj_set_style_shadow_opa(screensaver_widget, LV_OPA_80, LV_PART_MAIN);
    if (screensaver_time_lbl) {
      lv_obj_set_style_text_color(screensaver_time_lbl, colorHex(0xffffff), LV_PART_MAIN);
    }
    if (screensaver_sub_lbl) {
      lv_obj_set_style_text_color(screensaver_sub_lbl, colorHex(0x38bdf8), LV_PART_MAIN);
    }
  } else if (screensaver_anim_mode == "starfield") {
    // Retro Synthwave Warp (Translucent floating over 3D warp space)
    lv_obj_set_size(screensaver_widget, 380, 170);
    lv_obj_set_style_radius(screensaver_widget, 16, LV_PART_MAIN);
    lv_obj_set_style_bg_color(screensaver_widget, colorHex(0x13091e), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(screensaver_widget, LV_OPA_90, LV_PART_MAIN);
    lv_obj_set_style_border_color(screensaver_widget, colorHex(0xff71ce), LV_PART_MAIN);
    lv_obj_set_style_border_width(screensaver_widget, 2, LV_PART_MAIN);
    lv_obj_set_style_shadow_color(screensaver_widget, colorHex(0x01cdfe), LV_PART_MAIN);
    lv_obj_set_style_shadow_width(screensaver_widget, 25, LV_PART_MAIN);
    lv_obj_set_style_shadow_opa(screensaver_widget, LV_OPA_70, LV_PART_MAIN);
    if (screensaver_time_lbl) {
      lv_obj_set_style_text_color(screensaver_time_lbl, colorHex(0x01cdfe), LV_PART_MAIN);
    }
    if (screensaver_sub_lbl) {
      lv_obj_set_style_text_color(screensaver_sub_lbl, colorHex(0xf9d423), LV_PART_MAIN);
    }
  } else {
    // Default Bouncing Glass HUD
    lv_obj_set_size(screensaver_widget, 360, 160);
    lv_obj_set_style_radius(screensaver_widget, 22, LV_PART_MAIN);
    lv_obj_set_style_bg_color(screensaver_widget, colorHex(0x111827), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(screensaver_widget, LV_OPA_90, LV_PART_MAIN);
    lv_obj_set_style_border_color(screensaver_widget, colorHex(0x00f0ff), LV_PART_MAIN);
    lv_obj_set_style_border_width(screensaver_widget, 2, LV_PART_MAIN);
    lv_obj_set_style_shadow_color(screensaver_widget, colorHex(0x00f0ff), LV_PART_MAIN);
    lv_obj_set_style_shadow_width(screensaver_widget, 25, LV_PART_MAIN);
    lv_obj_set_style_shadow_opa(screensaver_widget, LV_OPA_70, LV_PART_MAIN);
    if (screensaver_time_lbl) {
      lv_obj_set_style_text_color(screensaver_time_lbl, colorHex(0xffffff), LV_PART_MAIN);
    }
    if (screensaver_sub_lbl) {
      lv_obj_set_style_text_color(screensaver_sub_lbl, colorHex(0x9ca3af), LV_PART_MAIN);
    }
  }
}

static void screensaver_anim_cb(lv_timer_t *t) {
  if (!screensaver_active || !screensaver_widget || screensaver_anim_mode == "screen_off") return;

  int16_t curW = lv_obj_get_width(screensaver_widget);
  int16_t curH = lv_obj_get_height(screensaver_widget);
  if (curW <= 0) curW = SS_WIDTH;
  if (curH <= 0) curH = SS_HEIGHT;

  if (screensaver_anim_mode == "pulsing_glow") {
    // Centered with breathing neon pulse
    int16_t cx = (JC_SCREEN_WIDTH - curW) / 2;
    int16_t cy = (JC_SCREEN_HEIGHT - curH) / 2;
    lv_obj_set_pos(screensaver_widget, cx, cy);

    ss_pulse_step = (ss_pulse_step + 4) % 360;
    float rad = ss_pulse_step * 0.01745329f;
    uint8_t glowWidth = (uint8_t)(15 + (sin(rad) * 15.0f));
    lv_color_t pulseColor = colorHex(0x00f0ff);
    lv_obj_set_style_border_color(screensaver_widget, pulseColor, LV_PART_MAIN);
    lv_obj_set_style_shadow_color(screensaver_widget, pulseColor, LV_PART_MAIN);
    lv_obj_set_style_shadow_width(screensaver_widget, glowWidth, LV_PART_MAIN);
  } else if (screensaver_anim_mode == "matrix_rain") {
    // 1. Cascading Matrix Stream Rain
    for (int i = 0; i < MATRIX_RAIN_COLS; i++) {
      if (matrix_cols[i].label) {
        matrix_cols[i].y_pos += matrix_cols[i].speed;
        if (matrix_cols[i].y_pos > (JC_SCREEN_HEIGHT + 20)) {
          matrix_cols[i].y_pos = -random(60, 240);
          matrix_cols[i].speed = random(5, 14);
          for (int r = 0; r < MATRIX_RAIN_ROWS; r++) {
            matrix_cols[i].text[r * 2] = matrix_glyphs[random(0, sizeof(matrix_glyphs) - 1)];
            matrix_cols[i].text[r * 2 + 1] = '\n';
          }
          matrix_cols[i].text[MATRIX_RAIN_ROWS * 2] = '\0';
          lv_label_set_text(matrix_cols[i].label, matrix_cols[i].text);
        }
        lv_obj_set_y(matrix_cols[i].label, matrix_cols[i].y_pos);
      }
    }

    // 2. Centered Floating Terminal HUD
    int16_t cx = (JC_SCREEN_WIDTH - curW) / 2;
    int16_t cy = (JC_SCREEN_HEIGHT - curH) / 2;
    lv_obj_set_pos(screensaver_widget, cx, cy);

    ss_pulse_step = (ss_pulse_step + 6) % 360;
    float rad = ss_pulse_step * 0.01745329f;
    uint8_t glowWidth = (uint8_t)(10 + (sin(rad) * 10.0f));
    lv_color_t matColor = colorHex(0x00ff66);
    lv_obj_set_style_border_color(screensaver_widget, matColor, LV_PART_MAIN);
    lv_obj_set_style_shadow_color(screensaver_widget, matColor, LV_PART_MAIN);
    lv_obj_set_style_shadow_width(screensaver_widget, glowWidth, LV_PART_MAIN);
  } else if (screensaver_anim_mode == "starfield") {
    // 1. 3D Warp Starfield Particles (Accelerating outwards from center)
    for (int i = 0; i < STARFIELD_COUNT; i++) {
      if (star_particles[i].obj) {
        star_particles[i].z -= 7.0f; // Warp speed
        if (star_particles[i].z <= 6.0f) {
          star_particles[i].x = (float)random(-380, 380);
          star_particles[i].y = (float)random(-230, 230);
          star_particles[i].z = 400.0f;
        }

        float k = 220.0f / star_particles[i].z;
        int16_t px = (int16_t)(400 + star_particles[i].x * k);
        int16_t py = (int16_t)(240 + star_particles[i].y * k);

        if (px < 0 || px >= JC_SCREEN_WIDTH || py < 0 || py >= JC_SCREEN_HEIGHT) {
          star_particles[i].x = (float)random(-380, 380);
          star_particles[i].y = (float)random(-230, 230);
          star_particles[i].z = 400.0f;
        } else {
          int16_t starSize = constrain((int)(3.0f * k), 2, 7);
          lv_obj_set_size(star_particles[i].obj, starSize, starSize);
          lv_obj_set_pos(star_particles[i].obj, px, py);
        }
      }
    }

    // 2. Centered Floating Retro Synthwave Card
    int16_t cx = (JC_SCREEN_WIDTH - curW) / 2;
    int16_t cy = (JC_SCREEN_HEIGHT - curH) / 2;
    lv_obj_set_pos(screensaver_widget, cx, cy);

    ss_pulse_step = (ss_pulse_step + 5) % 360;
    float rad = ss_pulse_step * 0.01745329f;
    uint8_t glowWidth = (uint8_t)(15 + (sin(rad) * 10.0f));
    lv_obj_set_style_shadow_width(screensaver_widget, glowWidth, LV_PART_MAIN);
  } else {
    // Default bouncing clock with RGB hue cycling
    ss_x += ss_vx;
    ss_y += ss_vy;

    if (ss_x <= 10) { ss_x = 10; ss_vx = -ss_vx; }
    else if (ss_x + curW >= (JC_SCREEN_WIDTH - 10)) { ss_x = JC_SCREEN_WIDTH - 10 - curW; ss_vx = -ss_vx; }

    if (ss_y <= 10) { ss_y = 10; ss_vy = -ss_vy; }
    else if (ss_y + curH >= (JC_SCREEN_HEIGHT - 10)) { ss_y = JC_SCREEN_HEIGHT - 10 - curH; ss_vy = -ss_vy; }

    lv_obj_set_pos(screensaver_widget, ss_x, ss_y);

    ss_color_hue = (ss_color_hue + 2) % 360;
    lv_color_t neonColor = lv_color_hsv_to_rgb(ss_color_hue, 90, 100);
    lv_obj_set_style_border_color(screensaver_widget, neonColor, LV_PART_MAIN);
    lv_obj_set_style_shadow_color(screensaver_widget, neonColor, LV_PART_MAIN);
  }

  // Update Real-Time Clock & Date (Synced from Host PC or Local RTC)
  time_t now = time(NULL);
  struct tm timeinfo;
  localtime_r(&now, &timeinfo);
  char timeBuf[16];
  strftime(timeBuf, sizeof(timeBuf), "%H:%M:%S", &timeinfo);
  if (screensaver_time_lbl) {
    lv_label_set_text(screensaver_time_lbl, timeBuf);
  }

  char dateBuf[64];
  strftime(dateBuf, sizeof(dateBuf), "%a, %b %d • Touch to Wake", &timeinfo);
  if (screensaver_sub_lbl) {
    lv_label_set_text(screensaver_sub_lbl, dateBuf);
  }
}

void showScreensaver() {
  if (screensaver_active) return;
  screensaver_active = true;
  screensaver_start_ms = millis();
  screen_sleep_active = false;

  if (!screensaver_layer) {
    screensaver_layer = lv_obj_create(lv_layer_top());
    lv_obj_set_size(screensaver_layer, JC_SCREEN_WIDTH, JC_SCREEN_HEIGHT);
    lv_obj_set_pos(screensaver_layer, 0, 0);
    lv_obj_set_style_bg_color(screensaver_layer, colorHex(0x000000), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(screensaver_layer, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_border_width(screensaver_layer, 0, LV_PART_MAIN);
    lv_obj_set_style_radius(screensaver_layer, 0, LV_PART_MAIN);
    lv_obj_clear_flag(screensaver_layer, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(screensaver_layer, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(screensaver_layer, screensaver_touch_cb, LV_EVENT_ALL, NULL);

    // Initialize Matrix Rain Background Stream Columns
    for (int i = 0; i < MATRIX_RAIN_COLS; i++) {
      matrix_cols[i].label = lv_label_create(screensaver_layer);
      int16_t colX = i * (JC_SCREEN_WIDTH / MATRIX_RAIN_COLS) + 6;
      matrix_cols[i].y_pos = -random(20, 300);
      matrix_cols[i].speed = random(5, 14);
      lv_obj_set_pos(matrix_cols[i].label, colX, matrix_cols[i].y_pos);
      lv_obj_set_style_text_font(matrix_cols[i].label, &lv_font_montserrat_18, LV_PART_MAIN);
      lv_obj_set_style_text_color(matrix_cols[i].label, (i % 3 == 0) ? colorHex(0x00ff66) : colorHex(0x00aa44), LV_PART_MAIN);
      lv_obj_set_style_text_opa(matrix_cols[i].label, (i % 2 == 0) ? LV_OPA_80 : LV_OPA_50, LV_PART_MAIN);
      for (int r = 0; r < MATRIX_RAIN_ROWS; r++) {
        matrix_cols[i].text[r * 2] = matrix_glyphs[random(0, sizeof(matrix_glyphs) - 1)];
        matrix_cols[i].text[r * 2 + 1] = '\n';
      }
      matrix_cols[i].text[MATRIX_RAIN_ROWS * 2] = '\0';
      lv_label_set_text(matrix_cols[i].label, matrix_cols[i].text);
      lv_obj_clear_flag(matrix_cols[i].label, LV_OBJ_FLAG_SCROLLABLE);
      lv_obj_add_flag(matrix_cols[i].label, LV_OBJ_FLAG_EVENT_BUBBLE);
    }

    // Initialize 3D Starfield Warp Particles
    for (int i = 0; i < STARFIELD_COUNT; i++) {
      star_particles[i].obj = lv_obj_create(screensaver_layer);
      lv_obj_set_size(star_particles[i].obj, 4, 4);
      lv_obj_set_style_radius(star_particles[i].obj, 2, LV_PART_MAIN);
      lv_obj_set_style_bg_color(star_particles[i].obj, (i % 2 == 0) ? colorHex(0x01cdfe) : colorHex(0xff71ce), LV_PART_MAIN);
      lv_obj_set_style_bg_opa(star_particles[i].obj, LV_OPA_COVER, LV_PART_MAIN);
      lv_obj_set_style_border_width(star_particles[i].obj, 0, LV_PART_MAIN);
      lv_obj_clear_flag(star_particles[i].obj, LV_OBJ_FLAG_SCROLLABLE);
      lv_obj_add_flag(star_particles[i].obj, LV_OBJ_FLAG_EVENT_BUBBLE);
      star_particles[i].x = (float)random(-380, 380);
      star_particles[i].y = (float)random(-230, 230);
      star_particles[i].z = (float)random(10, 400);
    }

    screensaver_widget = lv_obj_create(screensaver_layer);
    lv_obj_clear_flag(screensaver_widget, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(screensaver_widget, LV_OBJ_FLAG_EVENT_BUBBLE);

    screensaver_time_lbl = lv_label_create(screensaver_widget);
    lv_label_set_text(screensaver_time_lbl, "00:00:00");
    lv_obj_set_width(screensaver_time_lbl, 320);
    lv_obj_set_style_text_align(screensaver_time_lbl, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN);
    lv_obj_set_style_text_font(screensaver_time_lbl, &lv_font_montserrat_48, LV_PART_MAIN);
    lv_obj_align(screensaver_time_lbl, LV_ALIGN_CENTER, 0, -18);

    screensaver_sub_lbl = lv_label_create(screensaver_widget);
    lv_label_set_text(screensaver_sub_lbl, "MATRIX MACROPAD • TOUCH TO WAKE");
    lv_obj_set_style_text_font(screensaver_sub_lbl, &lv_font_montserrat_18, LV_PART_MAIN);
    lv_obj_align(screensaver_sub_lbl, LV_ALIGN_CENTER, 0, 32);

    updateScreensaverTheme();
    screensaver_timer = lv_timer_create(screensaver_anim_cb, 33, NULL);
  } else {
    updateScreensaverTheme();
    lv_obj_clear_flag(screensaver_layer, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(screensaver_layer);
    if (screensaver_timer) lv_timer_resume(screensaver_timer);
  }

  if (screensaver_anim_mode == "screen_off") {
    hal.setBrightness(0);
  }

  Serial.println("{\"type\":\"screensaver\",\"state\":\"active\"}");
  lv_obj_invalidate(screensaver_layer);
  lv_refr_now(NULL);
}

void hideScreensaver() {
  if (!screensaver_active) return;
  screensaver_active = false;
  screen_sleep_active = false;
  hal.setBrightness(active_backlight_val);
  if (screensaver_layer) {
    lv_obj_add_flag(screensaver_layer, LV_OBJ_FLAG_HIDDEN);
  }
  if (screensaver_widget) {
    lv_obj_clear_flag(screensaver_widget, LV_OBJ_FLAG_HIDDEN);
  }
  if (screensaver_timer) {
    lv_timer_pause(screensaver_timer);
  }
  lv_disp_trig_activity(NULL);
  Serial.println("{\"type\":\"screensaver\",\"state\":\"idle\"}");
  lv_obj_invalidate(lv_scr_act());
  lv_refr_now(NULL);
}

// Color Helper
lv_color_t colorHex(uint32_t c) {
  return lv_color_hex(c);
}

// Parse Hex Color (#RRGGBB or RRGGBB) to lv_color_t
lv_color_t parseHexColor(const char* hex) {
  if (!hex || strlen(hex) == 0) return colorHex(0x000000);
  if (hex[0] == '#') {
    if (strlen(hex) < 4) return colorHex(0x000000);
    uint32_t val = (uint32_t)strtol(&hex[1], NULL, 16);
    return lv_color_hex(val);
  }
  uint32_t val = (uint32_t)strtol(hex, NULL, 16);
  return lv_color_hex(val);
}

// --- LVGL Custom File System Callbacks ---
static void * fs_open_cb(lv_fs_drv_t * drv, const char * path, lv_fs_mode_t mode) {
  const char * flags = (mode == LV_FS_MODE_WR) ? "w" : "r";
  String fullPath = path;
  while (fullPath.startsWith("/")) {
    fullPath = fullPath.substring(1);
  }
  fullPath = String("/") + fullPath;

  File f;
  if (drv->letter == 'S' && hal.sdMounted) {
    f = SD.open(fullPath, flags);
  } else if (drv->letter == 'L' && hal.littlefsMounted) {
    f = LittleFS.open(fullPath, flags);
  } else {
    // Auto-detect drive ('A'): check SD card first, then LittleFS
    if (hal.sdMounted) {
      f = SD.open(fullPath, flags);
    }
    if (!f && hal.littlefsMounted) {
      f = LittleFS.open(fullPath, flags);
    }
    if (!f && hal.storage) {
      f = hal.storage->open(fullPath, flags);
    }
    // Case-insensitive fallback for FAT32 / SD filename differences
    if (!f && hal.storage) {
      File root = hal.storage->open("/");
      if (root && root.isDirectory()) {
        String targetLower = fullPath;
        targetLower.toLowerCase();
        File child = root.openNextFile();
        while (child) {
          String cName = String(child.name());
          while (cName.startsWith("/")) cName = cName.substring(1);
          String cFullPath = String("/") + cName;
          String cLower = cFullPath;
          cLower.toLowerCase();
          if (cLower == targetLower) {
            f = hal.storage->open(cFullPath, flags);
            break;
          }
          child = root.openNextFile();
        }
      }
    }
  }
  if (!f) return NULL;
  File * fp = new File(f);
  return (void *)fp;
}

static lv_fs_res_t fs_close_cb(lv_fs_drv_t * drv, void * file_p) {
  File * fp = (File *)file_p;
  if (fp) {
    fp->close();
    delete fp;
  }
  return LV_FS_RES_OK;
}

static lv_fs_res_t fs_read_cb(lv_fs_drv_t * drv, void * file_p, void * buf, uint32_t btr, uint32_t * br) {
  File * fp = (File *)file_p;
  if (!fp || !(*fp)) {
    *br = 0;
    return LV_FS_RES_UNKNOWN;
  }
  size_t bytesRead = fp->read((uint8_t *)buf, btr);
  *br = (uint32_t)bytesRead;
  return LV_FS_RES_OK;
}

static lv_fs_res_t fs_seek_cb(lv_fs_drv_t * drv, void * file_p, uint32_t pos, lv_fs_whence_t whence) {
  File * fp = (File *)file_p;
  if (!fp || !(*fp)) return LV_FS_RES_UNKNOWN;
  if (whence == LV_FS_SEEK_SET) {
    fp->seek(pos, SeekSet);
  } else if (whence == LV_FS_SEEK_CUR) {
    int32_t cur = (int32_t)fp->position();
    int32_t target = cur + (int32_t)pos;
    if (target < 0) target = 0;
    fp->seek(target, SeekSet);
  } else if (whence == LV_FS_SEEK_END) {
    int32_t size = (int32_t)fp->size();
    int32_t target = size + (int32_t)pos;
    if (target < 0) target = 0;
    fp->seek(target, SeekSet);
  }
  return LV_FS_RES_OK;
}

static lv_fs_res_t fs_tell_cb(lv_fs_drv_t * drv, void * file_p, uint32_t * pos_p) {
  File * fp = (File *)file_p;
  if (!fp || !(*fp)) return LV_FS_RES_UNKNOWN;
  *pos_p = fp->position();
  return LV_FS_RES_OK;
}

// Parse CSS color name or direct Hex
lv_color_t parseCssColor(String cName, String customHex = "") {
  if (customHex.startsWith("#")) return parseHexColor(customHex.c_str());
  if (cName.startsWith("#")) return parseHexColor(cName.c_str());

  cName.toLowerCase();
  if (cName == "c-edit" || cName == "blue") return colorHex(0x2980b9);
  if (cName == "c-danger" || cName == "red") return colorHex(0xc0392b);
  if (cName == "c-system" || cName == "green") return colorHex(0x27ae60);
  if (cName == "c-util" || cName == "purple") return colorHex(0x8e44ad);
  if (cName == "c-nav" || cName == "orange") return colorHex(0xf39c12);
  if (cName == "c-gray" || cName == "gray") return colorHex(0x4b5563);
  if (cName == "c-black" || cName == "black" || cName == "dark") return colorHex(0x181a1f);
  if (cName == "c-white" || cName == "white") return colorHex(0xffffff);

  return colorHex(0x4b5563);
}



// Switch Active Tab and Page View
void switch_page(int p) {
  if (p < 0 || p >= total_pages) return;
  active_page = p;

  lv_tabview_set_act(tabview, active_page, LV_ANIM_OFF);

  // Center active page in slot 2 of 3 in sliding track (Screen center 400px, btn width 216px -> left=292px)
  if (tab_track) {
    lv_obj_set_x(tab_track, 292 - active_page * 228);
  }

  bool lightBg = isLightColor(current_bg_color);
  lv_color_t inactiveBorder = lightBg ? colorHex(0x334155) : colorHex(0x3e4451);
  lv_color_t activeBorder = lightBg ? colorHex(0x0284c7) : colorHex(0x38bdf8);
  lv_color_t inactiveText = lightBg ? colorHex(0x475569) : colorHex(0x94a3b8);
  lv_color_t activeText = lightBg ? colorHex(0x0f172a) : colorHex(0xffffff);

  // Hide off-screen tabs (> 1 slot away) and style visible tabs
  for (int i = 0; i < MAX_PAGES; i++) {
    if (i < total_pages && abs(i - active_page) <= 1) {
      lv_obj_clear_flag(tab_btns[i], LV_OBJ_FLAG_HIDDEN);
      lv_obj_set_style_bg_opa(tab_btns[i], LV_OPA_TRANSP, LV_PART_MAIN);
      if (i == active_page) {
        lv_obj_set_style_border_color(tab_btns[i], activeBorder, LV_PART_MAIN);
        lv_obj_set_style_text_color(tab_btn_labels[i], activeText, LV_PART_MAIN);
      } else {
        lv_obj_set_style_border_color(tab_btns[i], inactiveBorder, LV_PART_MAIN);
        lv_obj_set_style_text_color(tab_btn_labels[i], inactiveText, LV_PART_MAIN);
      }
    } else {
      lv_obj_add_flag(tab_btns[i], LV_OBJ_FLAG_HIDDEN);
    }
    lv_obj_invalidate(tab_btns[i]);
  }

  // Hide chevron if no more pages in that direction
  if (btn_prev) {
    lv_obj_set_style_bg_opa(btn_prev, LV_OPA_TRANSP, LV_PART_MAIN);
    lv_obj_set_style_border_color(btn_prev, inactiveBorder, LV_PART_MAIN);
    if (active_page > 0) {
      lv_obj_clear_flag(btn_prev, LV_OBJ_FLAG_HIDDEN);
    } else {
      lv_obj_add_flag(btn_prev, LV_OBJ_FLAG_HIDDEN);
    }
    lv_obj_invalidate(btn_prev);
  }
  if (btn_next) {
    lv_obj_set_style_bg_opa(btn_next, LV_OPA_TRANSP, LV_PART_MAIN);
    lv_obj_set_style_border_color(btn_next, inactiveBorder, LV_PART_MAIN);
    if (active_page < total_pages - 1) {
      lv_obj_clear_flag(btn_next, LV_OBJ_FLAG_HIDDEN);
    } else {
      lv_obj_add_flag(btn_next, LV_OBJ_FLAG_HIDDEN);
    }
    lv_obj_invalidate(btn_next);
  }

  lv_refr_now(NULL);
}

// --- I2S Audio Click Generator (Freenove FNK0115: BCLK=0, LRC=18, DOUT=17) ---
#define I2S_SPEAKER_PORT   I2S_NUM_0

static bool i2s_audio_ready = false;
static int audio_volume = 33;

void initI2SAudio() {
  // Pull audio data line low before driver initialization to eliminate floating voltage surge
  pinMode(JC_I2S_DOUT, OUTPUT);
  digitalWrite(JC_I2S_DOUT, LOW);

  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = 44100,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 3,
    .dma_buf_len = 256,
    .use_apll = false,
    .tx_desc_auto_clear = true
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = JC_I2S_BCLK,   // GPIO 0
    .ws_io_num = JC_I2S_LRCLK,   // GPIO 18
    .data_out_num = JC_I2S_DOUT, // GPIO 17
    .data_in_num = I2S_PIN_NO_CHANGE
  };

  if (i2s_driver_install(I2S_SPEAKER_PORT, &i2s_config, 0, NULL) == ESP_OK) {
    i2s_set_pin(I2S_SPEAKER_PORT, &pin_config);
    i2s_zero_dma_buffer(I2S_SPEAKER_PORT);

    // Write a muted zero-sample buffer to cleanly settle DAC output without audible pops
    int16_t silence[256] = {0};
    size_t written = 0;
    i2s_write(I2S_SPEAKER_PORT, silence, sizeof(silence), &written, 50);

    i2s_audio_ready = true;
    Serial.println("[I2S] Audio Initialized (BCLK:0, LRC:18, DOUT:17)");
  }
}

void playClickSound() {
  if (!i2s_audio_ready || audio_volume <= 0) return;

  // 1. Increased buffer size to 4,410 to allow a 50ms duration (2,205 stereo samples)
  static int16_t click_buf[4410]; 
  static int last_vol = -1;

  if (last_vol != audio_volume) {
    // 2. Boosted peak slightly (7272.0f -> 15000.0f) because lower frequencies need more power to feel punchy
    float peak = 15000.0f * (audio_volume / 100.0f); 
    
    for (int i = 0; i < 4410; i += 2) {
      // 3. Updated the fade-out math to match the new 4,410 buffer limit
      int16_t amp = (int16_t)(peak * (1.0f - ((float)i / 4410.0f)));
      
      // 4. Changed % 400 < 200 to drop the frequency to 110.25 Hz
      int16_t s = ((i / 2) % 400 < 200) ? amp : -amp;
      
      click_buf[i] = s;
      click_buf[i + 1] = s;
    }
    last_vol = audio_volume; // Ensure last_vol updates so this only runs when volume changes
  }

  size_t written = 0;
  i2s_write(I2S_SPEAKER_PORT, click_buf, sizeof(click_buf), &written, 0);
}

void playConfirmSound() {
  if (!i2s_audio_ready || audio_volume <= 0) return;

  // 50ms dual-chirp confirmation sound (ascending tones)
  static int16_t confirm_buf[2200];
  float peak = 8000.0f * (audio_volume / 100.0f);
  for (int i = 0; i < 2200; i += 2) {
    int sample = i / 2;
    int16_t amp = (int16_t)(peak * (1.0f - ((float)(sample % 1100) / 1100.0f)));
    int period = (sample < 1100) ? 28 : 20;
    int16_t s = ((sample % period) < (period / 2)) ? amp : -amp;
    confirm_buf[i] = s;
    confirm_buf[i + 1] = s;
  }

  size_t written = 0;
  i2s_write(I2S_SPEAKER_PORT, confirm_buf, sizeof(confirm_buf), &written, 0);
}

void playAlarmBeep() {
  if (!i2s_audio_ready || audio_volume <= 0) return;

  // 3-pulse audible alarm burst pattern (~1.8kHz)
  static int16_t alarm_buf[4410];
  float peak = 9000.0f * (audio_volume / 100.0f);
  for (int i = 0; i < 4410; i += 2) {
    int sample = i / 2;
    int burst = sample % 1470;
    int16_t amp = (burst < 950) ? (int16_t)peak : 0;
    int16_t s = ((sample % 24) < 12) ? amp : -amp;
    alarm_buf[i] = s;
    alarm_buf[i + 1] = s;
  }

  size_t written = 0;
  i2s_write(I2S_SPEAKER_PORT, alarm_buf, sizeof(alarm_buf), &written, 0);
}

// Format seconds into MM:SS or HH:MM:SS string
void formatTimeString(uint32_t totalSec, char *buf, size_t bufSize) {
  uint32_t hrs = totalSec / 3600;
  uint32_t mins = (totalSec % 3600) / 60;
  uint32_t secs = totalSec % 60;
  if (hrs > 0) {
    snprintf(buf, bufSize, "%02u:%02u:%02u", hrs, mins, secs);
  } else {
    snprintf(buf, bufSize, "%02u:%02u", mins, secs);
  }
}

void updateTimerLabel(ButtonWidget &w) {
  if (!w.label) return;
  char timeBuf[16];
  formatTimeString(w.timer_seconds, timeBuf, sizeof(timeBuf));
  lv_label_set_text(w.label, timeBuf);
  lv_obj_clear_flag(w.label, LV_OBJ_FLAG_HIDDEN);
  lv_obj_invalidate(w.label);
  lv_obj_invalidate(w.btn);
}

void resetTimerWidget(ButtonWidget &w) {
  w.timer_running = false;
  w.timer_alerting = false;
  w.alert_flash_state = false;
  if (w.widget_type == WIDGET_STOPWATCH) {
    w.timer_seconds = 0;
  } else if (w.widget_type == WIDGET_COUNTDOWN) {
    w.timer_seconds = (w.timer_initial_duration > 0) ? w.timer_initial_duration : 300;
  }
  lv_obj_set_style_bg_color(w.btn, w.orig_bg_color, LV_PART_MAIN);
  lv_obj_set_style_text_color(w.label, w.orig_text_color, LV_PART_MAIN);
  if (w.icon) {
    lv_obj_set_style_text_color(w.icon, w.orig_text_color, LV_PART_MAIN);
    const char* sym = (w.widget_type == WIDGET_COUNTDOWN) ? getMaterialSymbolUtf8("hourglass_top") : getMaterialSymbolUtf8("timer");
    if (sym && strlen(sym) > 0) {
      lv_label_set_text(w.icon, sym);
      lv_obj_clear_flag(w.icon, LV_OBJ_FLAG_HIDDEN);
    }
  }
  updateTimerLabel(w);
}

// --- Timer Preset & Custom Duration Modal System on lv_layer_top() ---
static lv_obj_t *timer_modal_layer = NULL;
static ButtonWidget *modal_target_timer = NULL;
static uint32_t custom_duration_edit_sec = 300;
static lv_obj_t *custom_duration_display_lbl = NULL;

void closeTimerModals() {
  if (timer_modal_layer) {
    lv_obj_del(timer_modal_layer);
    timer_modal_layer = NULL;
    modal_target_timer = NULL;
    custom_duration_display_lbl = NULL;
    lv_refr_now(NULL);
  }
}

static void modal_close_cb(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_CLICKED) {
    playClickSound();
    closeTimerModals();
  }
}

static void preset_btn_cb(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_CLICKED) {
    uint32_t presetSec = (uint32_t)(uintptr_t)lv_event_get_user_data(e);
    if (modal_target_timer) {
      if (presetSec == 0) {
        modal_target_timer->widget_type = WIDGET_STOPWATCH;
        modal_target_timer->timer_seconds = 0;
      } else {
        modal_target_timer->widget_type = WIDGET_COUNTDOWN;
        modal_target_timer->timer_initial_duration = presetSec;
        modal_target_timer->timer_seconds = presetSec;
      }
      resetTimerWidget(*modal_target_timer);
      playConfirmSound();
    }
    closeTimerModals();
  }
}

void openCustomDurationModal();

static void open_custom_modal_cb(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_CLICKED) {
    playClickSound();
    openCustomDurationModal();
  }
}

void openTimerPresetModal(ButtonWidget *w) {
  closeTimerModals();
  modal_target_timer = w;

  // Dimmed overlay covering full screen
  timer_modal_layer = lv_obj_create(lv_layer_top());
  lv_obj_set_size(timer_modal_layer, JC_SCREEN_WIDTH, JC_SCREEN_HEIGHT);
  lv_obj_set_pos(timer_modal_layer, 0, 0);
  lv_obj_set_style_bg_color(timer_modal_layer, colorHex(0x000000), LV_PART_MAIN);
  lv_obj_set_style_bg_opa(timer_modal_layer, LV_OPA_70, LV_PART_MAIN);
  lv_obj_set_style_border_width(timer_modal_layer, 0, LV_PART_MAIN);
  lv_obj_set_style_pad_all(timer_modal_layer, 0, LV_PART_MAIN);
  lv_obj_clear_flag(timer_modal_layer, LV_OBJ_FLAG_SCROLLABLE);

  // Dialog Card
  lv_obj_t *card = lv_obj_create(timer_modal_layer);
  lv_obj_set_size(card, 580, 420);
  lv_obj_center(card);
  lv_obj_set_style_radius(card, 24, LV_PART_MAIN);
  lv_obj_set_style_bg_color(card, colorHex(0x181a20), LV_PART_MAIN);
  lv_obj_set_style_bg_opa(card, LV_OPA_COVER, LV_PART_MAIN);
  lv_obj_set_style_border_color(card, colorHex(0x3498db), LV_PART_MAIN);
  lv_obj_set_style_border_width(card, 2, LV_PART_MAIN);
  lv_obj_set_style_shadow_color(card, colorHex(0x3498db), LV_PART_MAIN);
  lv_obj_set_style_shadow_width(card, 25, LV_PART_MAIN);
  lv_obj_set_style_shadow_opa(card, LV_OPA_50, LV_PART_MAIN);
  lv_obj_clear_flag(card, LV_OBJ_FLAG_SCROLLABLE);

  // Title
  lv_obj_t *title = lv_label_create(card);
  lv_label_set_text(title, "Timer / Stopwatch Mode");
  lv_obj_set_style_text_font(title, &lv_font_montserrat_24, LV_PART_MAIN);
  lv_obj_set_style_text_color(title, colorHex(0xffffff), LV_PART_MAIN);
  lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 8);

  // Preset Buttons Grid (3x3)
  struct PresetInfo {
    const char *label;
    uint32_t seconds;
  };
  const PresetInfo presets[9] = {
    {"Stopwatch", 0},
    {"1 min", 60},
    {"3 min", 180},
    {"5 min", 300},
    {"10 min", 600},
    {"15 min", 900},
    {"25 min", 1500},
    {"30 min", 1800},
    {"60 min", 3600}
  };

  lv_obj_t *grid = lv_obj_create(card);
  lv_obj_set_size(grid, 540, 240);
  lv_obj_align(grid, LV_ALIGN_TOP_MID, 0, 52);
  lv_obj_set_style_bg_opa(grid, LV_OPA_TRANSP, LV_PART_MAIN);
  lv_obj_set_style_border_width(grid, 0, LV_PART_MAIN);
  lv_obj_set_style_pad_all(grid, 0, LV_PART_MAIN);
  lv_obj_clear_flag(grid, LV_OBJ_FLAG_SCROLLABLE);

  static lv_coord_t p_cols[] = {170, 170, 170, LV_GRID_TEMPLATE_LAST};
  static lv_coord_t p_rows[] = {70, 70, 70, LV_GRID_TEMPLATE_LAST};
  lv_obj_set_grid_dsc_array(grid, p_cols, p_rows);

  for (int i = 0; i < 9; i++) {
    int c = i % 3;
    int r = i / 3;
    lv_obj_t *pbtn = lv_btn_create(grid);
    lv_obj_set_grid_cell(pbtn, LV_GRID_ALIGN_STRETCH, c, 1, LV_GRID_ALIGN_STRETCH, r, 1);
    lv_obj_set_style_radius(pbtn, 14, LV_PART_MAIN);
    lv_obj_set_style_bg_color(pbtn, colorHex(0x232730), LV_PART_MAIN);
    lv_obj_set_style_border_color(pbtn, colorHex(0x34495e), LV_PART_MAIN);
    lv_obj_set_style_border_width(pbtn, 1, LV_PART_MAIN);
    lv_obj_set_style_bg_color(pbtn, colorHex(0x3498db), (lv_style_selector_t)((uint32_t)LV_PART_MAIN | (uint32_t)LV_STATE_PRESSED));

    lv_obj_t *plbl = lv_label_create(pbtn);
    lv_label_set_text(plbl, presets[i].label);
    lv_obj_set_style_text_font(plbl, &lv_font_montserrat_20, LV_PART_MAIN);
    lv_obj_set_style_text_color(plbl, colorHex(0xffffff), LV_PART_MAIN);
    lv_obj_center(plbl);

    lv_obj_add_event_cb(pbtn, preset_btn_cb, LV_EVENT_CLICKED, (void*)(uintptr_t)presets[i].seconds);
  }

  // Bottom action buttons: Custom... & Cancel
  lv_obj_t *btn_custom = lv_btn_create(card);
  lv_obj_set_size(btn_custom, 255, 52);
  lv_obj_align(btn_custom, LV_ALIGN_BOTTOM_LEFT, 15, -12);
  lv_obj_set_style_radius(btn_custom, 14, LV_PART_MAIN);
  lv_obj_set_style_bg_color(btn_custom, colorHex(0x2980b9), LV_PART_MAIN);
  lv_obj_t *lbl_custom = lv_label_create(btn_custom);
  lv_label_set_text(lbl_custom, "Custom Duration...");
  lv_obj_set_style_text_font(lbl_custom, &lv_font_montserrat_18, LV_PART_MAIN);
  lv_obj_set_style_text_color(lbl_custom, colorHex(0xffffff), LV_PART_MAIN);
  lv_obj_center(lbl_custom);
  lv_obj_add_event_cb(btn_custom, open_custom_modal_cb, LV_EVENT_CLICKED, NULL);

  lv_obj_t *btn_cancel = lv_btn_create(card);
  lv_obj_set_size(btn_cancel, 255, 52);
  lv_obj_align(btn_cancel, LV_ALIGN_BOTTOM_RIGHT, -15, -12);
  lv_obj_set_style_radius(btn_cancel, 14, LV_PART_MAIN);
  lv_obj_set_style_bg_color(btn_cancel, colorHex(0x374151), LV_PART_MAIN);
  lv_obj_t *lbl_cancel = lv_label_create(btn_cancel);
  lv_label_set_text(lbl_cancel, "Cancel");
  lv_obj_set_style_text_font(lbl_cancel, &lv_font_montserrat_18, LV_PART_MAIN);
  lv_obj_set_style_text_color(lbl_cancel, colorHex(0xffffff), LV_PART_MAIN);
  lv_obj_center(lbl_cancel);
  lv_obj_add_event_cb(btn_cancel, modal_close_cb, LV_EVENT_CLICKED, NULL);
}

static void update_custom_duration_display() {
  if (custom_duration_display_lbl) {
    char buf[16];
    formatTimeString(custom_duration_edit_sec, buf, sizeof(buf));
    lv_label_set_text(custom_duration_display_lbl, buf);
  }
}

static void custom_adjust_cb(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_CLICKED) {
    int32_t delta = (int32_t)(intptr_t)lv_event_get_user_data(e);
    int32_t newVal = (int32_t)custom_duration_edit_sec + delta;
    if (newVal < 5) newVal = 5;
    if (newVal > 35999) newVal = 35999;
    custom_duration_edit_sec = (uint32_t)newVal;
    playClickSound();
    update_custom_duration_display();
  }
}

static void custom_save_cb(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_CLICKED) {
    if (modal_target_timer) {
      modal_target_timer->widget_type = WIDGET_COUNTDOWN;
      modal_target_timer->timer_initial_duration = custom_duration_edit_sec;
      modal_target_timer->timer_seconds = custom_duration_edit_sec;
      resetTimerWidget(*modal_target_timer);
      playConfirmSound();
    }
    closeTimerModals();
  }
}

void openCustomDurationModal() {
  if (!timer_modal_layer) return;

  // Clear modal children to render custom duration editor
  lv_obj_clean(timer_modal_layer);

  if (modal_target_timer && modal_target_timer->timer_initial_duration > 0) {
    custom_duration_edit_sec = modal_target_timer->timer_initial_duration;
  } else {
    custom_duration_edit_sec = 300;
  }

  // Dialog Card
  lv_obj_t *card = lv_obj_create(timer_modal_layer);
  lv_obj_set_size(card, 580, 420);
  lv_obj_center(card);
  lv_obj_set_style_radius(card, 24, LV_PART_MAIN);
  lv_obj_set_style_bg_color(card, colorHex(0x181a20), LV_PART_MAIN);
  lv_obj_set_style_bg_opa(card, LV_OPA_COVER, LV_PART_MAIN);
  lv_obj_set_style_border_color(card, colorHex(0x00f0ff), LV_PART_MAIN);
  lv_obj_set_style_border_width(card, 2, LV_PART_MAIN);
  lv_obj_set_style_shadow_color(card, colorHex(0x00f0ff), LV_PART_MAIN);
  lv_obj_set_style_shadow_width(card, 25, LV_PART_MAIN);
  lv_obj_set_style_shadow_opa(card, LV_OPA_50, LV_PART_MAIN);
  lv_obj_clear_flag(card, LV_OBJ_FLAG_SCROLLABLE);

  // Header Title
  lv_obj_t *title = lv_label_create(card);
  lv_label_set_text(title, "Set Custom Duration");
  lv_obj_set_style_text_font(title, &lv_font_montserrat_22, LV_PART_MAIN);
  lv_obj_set_style_text_color(title, colorHex(0xffffff), LV_PART_MAIN);
  lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 6);

  // Big Time Display
  custom_duration_display_lbl = lv_label_create(card);
  lv_obj_set_style_text_font(custom_duration_display_lbl, &lv_font_montserrat_44, LV_PART_MAIN);
  lv_obj_set_style_text_color(custom_duration_display_lbl, colorHex(0x00f0ff), LV_PART_MAIN);
  lv_obj_align(custom_duration_display_lbl, LV_ALIGN_TOP_MID, 0, 42);
  update_custom_duration_display();

  // Adjustment Row 1: Minutes
  int16_t row1_y = 118;
  struct AdjustBtn {
    const char *txt;
    int32_t delta;
  };
  const AdjustBtn min_btns[4] = {
    {"-5m", -300},
    {"-1m", -60},
    {"+1m", 60},
    {"+5m", 300}
  };

  for (int i = 0; i < 4; i++) {
    lv_obj_t *b = lv_btn_create(card);
    lv_obj_set_size(b, 125, 52);
    lv_obj_set_pos(b, 15 + i * 135, row1_y);
    lv_obj_set_style_radius(b, 12, LV_PART_MAIN);
    lv_obj_set_style_bg_color(b, colorHex(0x232730), LV_PART_MAIN);
    lv_obj_set_style_border_color(b, colorHex(0x34495e), LV_PART_MAIN);
    lv_obj_set_style_border_width(b, 1, LV_PART_MAIN);

    lv_obj_t *lbl = lv_label_create(b);
    lv_label_set_text(lbl, min_btns[i].txt);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_20, LV_PART_MAIN);
    lv_obj_set_style_text_color(lbl, colorHex(0xffffff), LV_PART_MAIN);
    lv_obj_center(lbl);

    lv_obj_add_event_cb(b, custom_adjust_cb, LV_EVENT_CLICKED, (void*)(intptr_t)min_btns[i].delta);
  }

  // Adjustment Row 2: Seconds
  int16_t row2_y = 186;
  const AdjustBtn sec_btns[4] = {
    {"-30s", -30},
    {"-10s", -10},
    {"+10s", 10},
    {"+30s", 30}
  };

  for (int i = 0; i < 4; i++) {
    lv_obj_t *b = lv_btn_create(card);
    lv_obj_set_size(b, 125, 52);
    lv_obj_set_pos(b, 15 + i * 135, row2_y);
    lv_obj_set_style_radius(b, 12, LV_PART_MAIN);
    lv_obj_set_style_bg_color(b, colorHex(0x232730), LV_PART_MAIN);
    lv_obj_set_style_border_color(b, colorHex(0x34495e), LV_PART_MAIN);
    lv_obj_set_style_border_width(b, 1, LV_PART_MAIN);

    lv_obj_t *lbl = lv_label_create(b);
    lv_label_set_text(lbl, sec_btns[i].txt);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_20, LV_PART_MAIN);
    lv_obj_set_style_text_color(lbl, colorHex(0xffffff), LV_PART_MAIN);
    lv_obj_center(lbl);

    lv_obj_add_event_cb(b, custom_adjust_cb, LV_EVENT_CLICKED, (void*)(intptr_t)sec_btns[i].delta);
  }

  // Bottom action buttons: Save / Set & Back / Cancel
  lv_obj_t *btn_set = lv_btn_create(card);
  lv_obj_set_size(btn_set, 255, 56);
  lv_obj_align(btn_set, LV_ALIGN_BOTTOM_LEFT, 15, -12);
  lv_obj_set_style_radius(btn_set, 14, LV_PART_MAIN);
  lv_obj_set_style_bg_color(btn_set, colorHex(0x27ae60), LV_PART_MAIN);
  lv_obj_t *lbl_set = lv_label_create(btn_set);
  lv_label_set_text(lbl_set, "Set Duration");
  lv_obj_set_style_text_font(lbl_set, &lv_font_montserrat_20, LV_PART_MAIN);
  lv_obj_set_style_text_color(lbl_set, colorHex(0xffffff), LV_PART_MAIN);
  lv_obj_center(lbl_set);
  lv_obj_add_event_cb(btn_set, custom_save_cb, LV_EVENT_CLICKED, NULL);

  lv_obj_t *btn_cancel = lv_btn_create(card);
  lv_obj_set_size(btn_cancel, 255, 56);
  lv_obj_align(btn_cancel, LV_ALIGN_BOTTOM_RIGHT, -15, -12);
  lv_obj_set_style_radius(btn_cancel, 14, LV_PART_MAIN);
  lv_obj_set_style_bg_color(btn_cancel, colorHex(0x374151), LV_PART_MAIN);
  lv_obj_t *lbl_cancel = lv_label_create(btn_cancel);
  lv_label_set_text(lbl_cancel, "Cancel");
  lv_obj_set_style_text_font(lbl_cancel, &lv_font_montserrat_20, LV_PART_MAIN);
  lv_obj_set_style_text_color(lbl_cancel, colorHex(0xffffff), LV_PART_MAIN);
  lv_obj_center(lbl_cancel);
  lv_obj_add_event_cb(btn_cancel, modal_close_cb, LV_EVENT_CLICKED, NULL);
}

// --- Folder / Sub-Menu Modal System on lv_layer_top() ---
static lv_obj_t *folder_modal_layer = NULL;
static ButtonWidget *modal_target_folder = NULL;

void closeFolderModal() {
  if (folder_modal_layer) {
    lv_obj_del(folder_modal_layer);
    folder_modal_layer = NULL;
    modal_target_folder = NULL;
    lv_refr_now(NULL);
  }
}

static void folder_modal_close_cb(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_CLICKED) {
    playClickSound();
    closeFolderModal();
  }
}

static void sub_btn_click_cb(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_CLICKED) {
    int subIdx = (int)(intptr_t)lv_event_get_user_data(e);
    if (modal_target_folder && subIdx >= 0 && subIdx < modal_target_folder->sub_button_count) {
      SubButtonInfo &sub = modal_target_folder->sub_buttons[subIdx];
      playConfirmSound();

      StaticJsonDocument<256> doc;
      doc["type"] = "trigger";
      doc["page"] = modal_target_folder->page + 1;
      doc["button"] = modal_target_folder->index + 1;
      doc["sub_button"] = subIdx;
      doc["sub_id"] = sub.id;
      serializeJson(doc, Serial);
      Serial.println();
    }
    closeFolderModal();
  }
}

void openFolderModal(ButtonWidget *w) {
  closeFolderModal();
  closeTimerModals();
  if (!w || !w->has_sub_buttons || w->sub_button_count == 0) return;
  modal_target_folder = w;

  // Full-screen overlay layer on top
  folder_modal_layer = lv_obj_create(lv_layer_top());
  lv_obj_set_size(folder_modal_layer, JC_SCREEN_WIDTH, JC_SCREEN_HEIGHT);
  lv_obj_set_pos(folder_modal_layer, 0, 0);
  lv_obj_set_style_bg_color(folder_modal_layer, colorHex(0x111317), LV_PART_MAIN);
  lv_obj_set_style_bg_opa(folder_modal_layer, LV_OPA_COVER, LV_PART_MAIN);
  lv_obj_set_style_border_width(folder_modal_layer, 0, LV_PART_MAIN);
  lv_obj_set_style_pad_all(folder_modal_layer, 0, LV_PART_MAIN);
  lv_obj_clear_flag(folder_modal_layer, LV_OBJ_FLAG_SCROLLABLE);

  // 1. Top Header Bar (56px high, matching main screen header)
  lv_obj_t *header = lv_obj_create(folder_modal_layer);
  lv_obj_set_size(header, JC_SCREEN_WIDTH, 56);
  lv_obj_align(header, LV_ALIGN_TOP_MID, 0, 0);
  lv_obj_set_style_bg_color(header, colorHex(0x181a1f), LV_PART_MAIN);
  lv_obj_set_style_bg_opa(header, LV_OPA_COVER, LV_PART_MAIN);
  lv_obj_set_style_border_side(header, LV_BORDER_SIDE_BOTTOM, LV_PART_MAIN);
  lv_obj_set_style_border_color(header, colorHex(0x2c3e50), LV_PART_MAIN);
  lv_obj_set_style_border_width(header, 1, LV_PART_MAIN);
  lv_obj_set_style_pad_left(header, 16, LV_PART_MAIN);
  lv_obj_set_style_pad_right(header, 16, LV_PART_MAIN);
  lv_obj_set_style_pad_top(header, 6, LV_PART_MAIN);
  lv_obj_set_style_pad_bottom(header, 6, LV_PART_MAIN);
  lv_obj_clear_flag(header, LV_OBJ_FLAG_SCROLLABLE);

  // Back / Exit Button
  lv_obj_t *btn_back = lv_btn_create(header);
  lv_obj_set_size(btn_back, 110, 42);
  lv_obj_align(btn_back, LV_ALIGN_LEFT_MID, 0, 0);
  lv_obj_set_style_radius(btn_back, 12, LV_PART_MAIN);
  lv_obj_set_style_bg_color(btn_back, colorHex(0x2d3748), LV_PART_MAIN);
  lv_obj_set_style_border_color(btn_back, colorHex(0x4a5568), LV_PART_MAIN);
  lv_obj_set_style_border_width(btn_back, 1, LV_PART_MAIN);
  lv_obj_set_style_bg_color(btn_back, colorHex(0x38bdf8), (lv_style_selector_t)((uint32_t)LV_PART_MAIN | (uint32_t)LV_STATE_PRESSED));
  lv_obj_t *lbl_back = lv_label_create(btn_back);
  lv_label_set_text(lbl_back, LV_SYMBOL_LEFT " Back");
  lv_obj_set_style_text_font(lbl_back, &lv_font_montserrat_18, LV_PART_MAIN);
  lv_obj_set_style_text_color(lbl_back, colorHex(0xffffff), LV_PART_MAIN);
  lv_obj_center(lbl_back);
  lv_obj_add_event_cb(btn_back, folder_modal_close_cb, LV_EVENT_CLICKED, NULL);

  // Folder Title (Center)
  lv_obj_t *title_lbl = lv_label_create(header);
  const char* folderName = lv_label_get_text(w->label);
  String titleStr = (folderName && strlen(folderName) > 0) ? String(folderName) : "Sub-Menu";
  lv_label_set_text_fmt(title_lbl, LV_SYMBOL_DIRECTORY "  %s", titleStr.c_str());
  lv_obj_set_style_text_font(title_lbl, &lv_font_montserrat_22, LV_PART_MAIN);
  lv_obj_set_style_text_color(title_lbl, colorHex(0x9472f7), LV_PART_MAIN);
  lv_obj_center(title_lbl);

  // Close "X" Button (Right)
  lv_obj_t *btn_close = lv_btn_create(header);
  lv_obj_set_size(btn_close, 42, 42);
  lv_obj_align(btn_close, LV_ALIGN_RIGHT_MID, 0, 0);
  lv_obj_set_style_radius(btn_close, 12, LV_PART_MAIN);
  lv_obj_set_style_bg_color(btn_close, colorHex(0x2d3748), LV_PART_MAIN);
  lv_obj_set_style_border_color(btn_close, colorHex(0x4a5568), LV_PART_MAIN);
  lv_obj_set_style_border_width(btn_close, 1, LV_PART_MAIN);
  lv_obj_set_style_bg_color(btn_close, colorHex(0xe53e3e), (lv_style_selector_t)((uint32_t)LV_PART_MAIN | (uint32_t)LV_STATE_PRESSED));
  lv_obj_t *lbl_close = lv_label_create(btn_close);
  lv_label_set_text(lbl_close, LV_SYMBOL_CLOSE);
  lv_obj_set_style_text_font(lbl_close, &lv_font_montserrat_18, LV_PART_MAIN);
  lv_obj_set_style_text_color(lbl_close, colorHex(0xffffff), LV_PART_MAIN);
  lv_obj_center(lbl_close);
  lv_obj_add_event_cb(btn_close, folder_modal_close_cb, LV_EVENT_CLICKED, NULL);

  // 2. 6-Button Grid Container (matching main screen 3x2 grid exactly)
  lv_obj_t *grid = lv_obj_create(folder_modal_layer);
  lv_obj_set_size(grid, JC_SCREEN_WIDTH, JC_SCREEN_HEIGHT - 56);
  lv_obj_set_pos(grid, 0, 56);
  lv_obj_set_style_bg_opa(grid, LV_OPA_TRANSP, LV_PART_MAIN);
  lv_obj_set_style_border_width(grid, 0, LV_PART_MAIN);
  lv_obj_clear_flag(grid, LV_OBJ_FLAG_SCROLLABLE);

  lv_obj_set_style_pad_left(grid, 18, LV_PART_MAIN);
  lv_obj_set_style_pad_right(grid, 18, LV_PART_MAIN);
  lv_obj_set_style_pad_top(grid, 14, LV_PART_MAIN);
  lv_obj_set_style_pad_bottom(grid, 14, LV_PART_MAIN);
  lv_obj_set_style_pad_column(grid, 18, LV_PART_MAIN);
  lv_obj_set_style_pad_row(grid, 16, LV_PART_MAIN);

  static lv_coord_t col_dsc[] = {242, 242, 242, LV_GRID_TEMPLATE_LAST};
  static lv_coord_t row_dsc[] = {186, 186, LV_GRID_TEMPLATE_LAST};
  lv_obj_set_grid_dsc_array(grid, col_dsc, row_dsc);

  uint8_t count = w->sub_button_count;

  for (int b = 0; b < 6; b++) {
    int col = b % 3;
    int row = b / 3;

    lv_obj_t *sbtn = lv_btn_create(grid);
    lv_obj_set_grid_cell(sbtn, LV_GRID_ALIGN_STRETCH, col, 1, LV_GRID_ALIGN_STRETCH, row, 1);
    lv_obj_clear_flag(sbtn, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scroll_dir(sbtn, LV_DIR_NONE);
    lv_obj_set_flex_flow(sbtn, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(sbtn, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

    if (b < count) {
      SubButtonInfo &sub = w->sub_buttons[b];
      uint8_t rad = sub.border_radius > 0 ? sub.border_radius : 20;
      lv_obj_set_style_radius(sbtn, rad, LV_PART_MAIN);
      lv_obj_set_style_clip_corner(sbtn, true, LV_PART_MAIN);
      lv_obj_set_style_bg_color(sbtn, sub.bg_color, LV_PART_MAIN);
      lv_obj_set_style_bg_opa(sbtn, LV_OPA_COVER, LV_PART_MAIN);

      if (sub.border_width > 0) {
        lv_obj_set_style_border_color(sbtn, sub.border_color, LV_PART_MAIN);
        lv_obj_set_style_border_width(sbtn, sub.border_width, LV_PART_MAIN);
        lv_obj_set_style_border_opa(sbtn, LV_OPA_COVER, LV_PART_MAIN);
        lv_obj_set_style_border_side(sbtn, LV_BORDER_SIDE_FULL, LV_PART_MAIN);
      } else {
        lv_obj_set_style_border_width(sbtn, 0, LV_PART_MAIN);
      }
      lv_obj_set_style_bg_color(sbtn, lv_color_darken(sub.bg_color, 40), (lv_style_selector_t)((uint32_t)LV_PART_MAIN | (uint32_t)LV_STATE_PRESSED));

      const char* iconStr = sub.icon;
      bool isImageIcon = false;
      if (strlen(iconStr) > 4) {
        const char* ext = iconStr + strlen(iconStr) - 4;
        if (strcasecmp(ext, ".png") == 0 || strcasecmp(ext, ".jpg") == 0 || strcasecmp(ext, ".bmp") == 0) {
          isImageIcon = true;
        }
      }

      if (isImageIcon) {
        char fullImgPath[64];
        if (iconStr[0] == 'A' && iconStr[1] == ':') {
          snprintf(fullImgPath, sizeof(fullImgPath), "%s", iconStr);
        } else {
          snprintf(fullImgPath, sizeof(fullImgPath), "A:/%s", iconStr);
        }
        lv_obj_set_layout(sbtn, 0);
        lv_obj_set_style_pad_all(sbtn, 0, LV_PART_MAIN);
        lv_obj_t *simg = lv_img_create(sbtn);
        lv_obj_set_style_radius(simg, rad, LV_PART_MAIN);
        lv_obj_set_style_clip_corner(simg, true, LV_PART_MAIN);
        lv_img_cache_invalidate_src(fullImgPath);
        lv_img_set_src(simg, fullImgPath);
        lv_img_set_zoom(simg, 256);
        lv_obj_set_size(simg, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
        lv_obj_set_align(simg, LV_ALIGN_CENTER);
        lv_obj_set_pos(simg, 0, 0);
      } else {
        lv_obj_set_flex_flow(sbtn, LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(sbtn, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
        if (strlen(iconStr) > 0) {
          const char* sym = getMaterialSymbolUtf8(String(iconStr));
          if (strlen(sym) > 0) {
            lv_obj_t *sicon = lv_label_create(sbtn);
            lv_label_set_text(sicon, sym);
            lv_obj_set_style_text_font(sicon, getIconFontForSize(24), LV_PART_MAIN);
            lv_obj_set_style_text_color(sicon, sub.icon_color, LV_PART_MAIN);
          }
        }

        lv_obj_t *slbl = lv_label_create(sbtn);
        if (strlen(sub.label) > 0) {
          lv_label_set_text(slbl, sub.label);
        } else if (strlen(iconStr) == 0) {
          char fallback[16];
          snprintf(fallback, sizeof(fallback), "Button %d", b + 1);
          lv_label_set_text(slbl, fallback);
        } else {
          lv_label_set_text(slbl, "");
        }
        lv_label_set_long_mode(slbl, LV_LABEL_LONG_WRAP);
        lv_obj_set_width(slbl, 220);
        lv_obj_set_style_text_font(slbl, &lv_font_montserrat_24, LV_PART_MAIN);
        lv_obj_set_style_text_color(slbl, sub.text_color, LV_PART_MAIN);
        lv_obj_set_style_text_align(slbl, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN);
      }

      lv_obj_add_event_cb(sbtn, sub_btn_click_cb, LV_EVENT_CLICKED, (void*)(intptr_t)b);
    } else {
      // Unused slot in 6-button grid
      lv_obj_set_style_radius(sbtn, 20, LV_PART_MAIN);
      lv_obj_set_style_bg_color(sbtn, colorHex(0x14171d), LV_PART_MAIN);
      lv_obj_set_style_bg_opa(sbtn, LV_OPA_COVER, LV_PART_MAIN);
      lv_obj_set_style_border_color(sbtn, colorHex(0x222733), LV_PART_MAIN);
      lv_obj_set_style_border_width(sbtn, 1, LV_PART_MAIN);
      lv_obj_clear_flag(sbtn, LV_OBJ_FLAG_CLICKABLE);
    }
  }
}

// Global Timer Subsystem Tick Handler (Runs every 250ms)
static void timer_subsystem_tick_cb(lv_timer_t *t) {
  uint32_t now = millis();
  for (int p = 0; p < total_pages; p++) {
    for (int b = 0; b < BUTTONS_PER_PAGE; b++) {
      ButtonWidget &w = grid_buttons[p][b];
      if (w.widget_type == WIDGET_STOPWATCH) {
        if (w.timer_running) {
          if (now - w.last_tick_ms >= 1000) {
            uint32_t elapsedSec = (now - w.last_tick_ms) / 1000;
            w.timer_seconds += elapsedSec;
            w.last_tick_ms = now;
            updateTimerLabel(w);
          }
        }
      } else if (w.widget_type == WIDGET_COUNTDOWN) {
        if (w.timer_running) {
          if (now - w.last_tick_ms >= 1000) {
            uint32_t elapsedSec = (now - w.last_tick_ms) / 1000;
            w.last_tick_ms = now;
            if (w.timer_seconds > elapsedSec) {
              w.timer_seconds -= elapsedSec;
              updateTimerLabel(w);
            } else {
              w.timer_seconds = 0;
              w.timer_running = false;
              w.timer_alerting = true;
              const char* notifSym = getMaterialSymbolUtf8("notifications");
              if (w.icon && notifSym && strlen(notifSym) > 0) {
                lv_label_set_text(w.icon, notifSym);
                lv_obj_clear_flag(w.icon, LV_OBJ_FLAG_HIDDEN);
              }
              updateTimerLabel(w);
              playAlarmBeep();
            }
          }
        }
        if (w.timer_alerting) {
          static uint32_t last_alarm_beep = 0;
          w.alert_flash_state = !w.alert_flash_state;
          if (w.alert_flash_state) {
            lv_obj_set_style_bg_color(w.btn, colorHex(0xe74c3c), LV_PART_MAIN);
            lv_obj_set_style_text_color(w.label, colorHex(0xffffff), LV_PART_MAIN);
            if (w.icon) lv_obj_set_style_text_color(w.icon, colorHex(0xffffff), LV_PART_MAIN);
          } else {
            lv_obj_set_style_bg_color(w.btn, colorHex(0x1a1d24), LV_PART_MAIN);
            lv_obj_set_style_text_color(w.label, colorHex(0xe74c3c), LV_PART_MAIN);
            if (w.icon) lv_obj_set_style_text_color(w.icon, colorHex(0xe74c3c), LV_PART_MAIN);
          }
          lv_obj_invalidate(w.btn);
          if (now - last_alarm_beep >= 1200) {
            playAlarmBeep();
            last_alarm_beep = now;
          }
        }
      }
    }
  }

  // Handle Full-Screen Perimeter Edge Flash & Tab Indicators
  bool any_alarm = false;
  for (int p = 0; p < total_pages; p++) {
    page_has_alarm[p] = false;
    for (int b = 0; b < BUTTONS_PER_PAGE; b++) {
      if (grid_buttons[p][b].timer_alerting) {
        page_has_alarm[p] = true;
        any_alarm = true;
      }
    }
  }

  if (any_alarm) {
    hideScreensaver();
    edge_flash_active = true;
    static uint32_t last_edge_toggle_ms = 0;
    if (now - last_edge_toggle_ms >= 350) {
      last_edge_toggle_ms = now;
      edge_flash_state = !edge_flash_state;
      if (edge_flash_overlay) {
        if (edge_flash_state) {
          lv_obj_clear_flag(edge_flash_overlay, LV_OBJ_FLAG_HIDDEN);
          lv_obj_set_style_border_opa(edge_flash_overlay, LV_OPA_COVER, LV_PART_MAIN);
        } else {
          lv_obj_set_style_border_opa(edge_flash_overlay, LV_OPA_TRANSP, LV_PART_MAIN);
        }
        lv_obj_invalidate(edge_flash_overlay);
      }
      for (int p = 0; p < total_pages; p++) {
        if (p != active_page && page_has_alarm[p]) {
          if (edge_flash_state) {
            lv_obj_set_style_border_color(tab_btns[p], colorHex(0xef4444), LV_PART_MAIN);
            lv_obj_set_style_border_width(tab_btns[p], 3, LV_PART_MAIN);
          } else {
            lv_color_t defaultBorder = isLightColor(current_bg_color) ? colorHex(0x0f172a) : colorHex(0x3e4451);
            lv_obj_set_style_border_color(tab_btns[p], defaultBorder, LV_PART_MAIN);
            lv_obj_set_style_border_width(tab_btns[p], 2, LV_PART_MAIN);
          }
        }
      }
    }
  } else if (edge_flash_active) {
    edge_flash_active = false;
    if (edge_flash_overlay) {
      lv_obj_add_flag(edge_flash_overlay, LV_OBJ_FLAG_HIDDEN);
      lv_obj_invalidate(edge_flash_overlay);
    }
    for (int p = 0; p < total_pages; p++) {
      if (p != active_page) {
        lv_color_t defaultBorder = isLightColor(current_bg_color) ? colorHex(0x0f172a) : colorHex(0x3e4451);
        lv_obj_set_style_border_color(tab_btns[p], defaultBorder, LV_PART_MAIN);
        lv_obj_set_style_border_width(tab_btns[p], 2, LV_PART_MAIN);
      }
    }
  }
}

// Navigation Header Click Handlers
static void nav_tab_click_cb(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_PRESSED) {
    playClickSound();
  } else if (code == LV_EVENT_CLICKED) {
    int p = (int)(intptr_t)lv_event_get_user_data(e);
    switch_page(p);
  }
}

static void nav_prev_click_cb(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_PRESSED) {
    playClickSound();
  } else if (code == LV_EVENT_CLICKED) {
    int prevP = (active_page - 1 + total_pages) % total_pages;
    switch_page(prevP);
  }
}

static void nav_next_click_cb(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_PRESSED) {
    playClickSound();
  } else if (code == LV_EVENT_CLICKED) {
    int nextP = (active_page + 1) % total_pages;
    switch_page(nextP);
  }
}

static bool long_press_handled = false;

// Button Click Event Handler
static void btn_event_cb(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  ButtonWidget *w = (ButtonWidget *)lv_event_get_user_data(e);
  if (!w) return;

  if (code == LV_EVENT_PRESSED) {
    long_press_handled = false;
    playClickSound();
  } else if (code == LV_EVENT_LONG_PRESSED) {
    long_press_handled = true;
    if (w->has_sub_buttons && w->sub_button_count > 0) {
      playConfirmSound();
      openFolderModal(w);
      return;
    } else if (w->widget_type == WIDGET_COUNTDOWN || w->widget_type == WIDGET_STOPWATCH) {
      w->timer_running = false;
      openTimerPresetModal(w);
      return;
    }
  } else if (code == LV_EVENT_CLICKED) {
    if (long_press_handled) {
      long_press_handled = false;
      return;
    }

    if (w->widget_type == WIDGET_STOPWATCH || w->widget_type == WIDGET_COUNTDOWN) {
      if (w->timer_alerting) {
        resetTimerWidget(*w);
        playClickSound();
        return;
      }

      uint32_t now = millis();
      if ((now - w->last_click_time) < 350 && w->last_click_time > 0) {
        // Double tap detected -> Reset
        resetTimerWidget(*w);
        playConfirmSound();
        w->last_click_time = 0;
      } else {
        // Single tap -> Toggle Start / Pause
        w->last_click_time = now;
        w->timer_running = !w->timer_running;
        if (w->timer_running) {
          w->last_tick_ms = millis();
        }
      }
      return;
    }

    StaticJsonDocument<128> doc;
    doc["type"] = "trigger";
    doc["button"] = w->index + 1;
    doc["page"] = w->page + 1;
    serializeJson(doc, Serial);
    Serial.println();
  }
}

static void btn_draw_event_cb(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code != LV_EVENT_DRAW_POST) return;

  ButtonWidget *w = (ButtonWidget *)lv_event_get_user_data(e);
  if (!w || w->border_width == 0 || w->border_style == BORDER_NONE || w->border_style == BORDER_SOLID) return;

  lv_draw_ctx_t *draw_ctx = lv_event_get_draw_ctx(e);
  if (!draw_ctx) return;

  lv_area_t coords;
  lv_obj_get_coords(w->btn, &coords);

  lv_draw_line_dsc_t line_dsc;
  lv_draw_line_dsc_init(&line_dsc);
  line_dsc.color = w->border_color;
  line_dsc.width = w->border_width;
  line_dsc.opa = LV_OPA_COVER;

  int16_t inset = w->border_width / 2;
  int16_t x1 = coords.x1 + inset;
  int16_t y1 = coords.y1 + inset;
  int16_t x2 = coords.x2 - inset;
  int16_t y2 = coords.y2 - inset;
  int16_t rad = w->border_radius;
  if (rad > (x2 - x1) / 2) rad = (x2 - x1) / 2;
  if (rad > (y2 - y1) / 2) rad = (y2 - y1) / 2;

  if (w->border_style == BORDER_DASHED || w->border_style == BORDER_DOTTED) {
    bool is_dot = (w->border_style == BORDER_DOTTED);
    int16_t d_len = is_dot ? w->border_width : (w->dash_len > 0 ? w->dash_len : 12);
    int16_t d_gap = is_dot ? (w->border_width * 3 + 3) : (w->dash_gap > 0 ? w->dash_gap : 8);
    if (is_dot) {
      line_dsc.round_start = 1;
      line_dsc.round_end = 1;
    }

    // Top edge
    for (int16_t x = x1 + rad; x < x2 - rad; x += (d_len + d_gap)) {
      int16_t end_x = (x + d_len < x2 - rad) ? (x + d_len) : (x2 - rad);
      lv_point_t p1 = { x, y1 };
      lv_point_t p2 = { end_x, y1 };
      lv_draw_line(draw_ctx, &line_dsc, &p1, &p2);
    }
    // Bottom edge
    for (int16_t x = x1 + rad; x < x2 - rad; x += (d_len + d_gap)) {
      int16_t end_x = (x + d_len < x2 - rad) ? (x + d_len) : (x2 - rad);
      lv_point_t p1 = { x, y2 };
      lv_point_t p2 = { end_x, y2 };
      lv_draw_line(draw_ctx, &line_dsc, &p1, &p2);
    }
    // Left edge
    for (int16_t y = y1 + rad; y < y2 - rad; y += (d_len + d_gap)) {
      int16_t end_y = (y + d_len < y2 - rad) ? (y + d_len) : (y2 - rad);
      lv_point_t p1 = { x1, y };
      lv_point_t p2 = { x1, end_y };
      lv_draw_line(draw_ctx, &line_dsc, &p1, &p2);
    }
    // Right edge
    for (int16_t y = y1 + rad; y < y2 - rad; y += (d_len + d_gap)) {
      int16_t end_y = (y + d_len < y2 - rad) ? (y + d_len) : (y2 - rad);
      lv_point_t p1 = { x2, y };
      lv_point_t p2 = { x2, end_y };
      lv_draw_line(draw_ctx, &line_dsc, &p1, &p2);
    }

    // Radiused Corner Arcs
    if (rad > 2) {
      lv_draw_arc_dsc_t arc_dsc;
      lv_draw_arc_dsc_init(&arc_dsc);
      arc_dsc.color = w->border_color;
      arc_dsc.width = w->border_width;
      arc_dsc.opa = LV_OPA_COVER;
      arc_dsc.rounded = is_dot ? 1 : 0;

      float d_ang = (d_len * 180.0f) / (3.14159f * (float)rad);
      float g_ang = (d_gap * 180.0f) / (3.14159f * (float)rad);
      if (d_ang < 2.0f) d_ang = 2.0f;
      if (g_ang < 2.0f) g_ang = 2.0f;
      float step_ang = d_ang + g_ang;

      // Top-Left (180 to 270)
      lv_point_t c_tl = { (lv_coord_t)(x1 + rad), (lv_coord_t)(y1 + rad) };
      for (float a = 180.0f; a < 270.0f; a += step_ang) {
        float a_end = (a + d_ang < 270.0f) ? (a + d_ang) : 270.0f;
        lv_draw_arc(draw_ctx, &arc_dsc, &c_tl, (uint16_t)rad, (uint16_t)a, (uint16_t)a_end);
      }
      // Top-Right (270 to 360)
      lv_point_t c_tr = { (lv_coord_t)(x2 - rad), (lv_coord_t)(y1 + rad) };
      for (float a = 270.0f; a < 360.0f; a += step_ang) {
        float a_end = (a + d_ang < 360.0f) ? (a + d_ang) : 360.0f;
        lv_draw_arc(draw_ctx, &arc_dsc, &c_tr, (uint16_t)rad, (uint16_t)a, (uint16_t)a_end);
      }
      // Bottom-Right (0 to 90)
      lv_point_t c_br = { (lv_coord_t)(x2 - rad), (lv_coord_t)(y2 - rad) };
      for (float a = 0.0f; a < 90.0f; a += step_ang) {
        float a_end = (a + d_ang < 90.0f) ? (a + d_ang) : 90.0f;
        lv_draw_arc(draw_ctx, &arc_dsc, &c_br, (uint16_t)rad, (uint16_t)a, (uint16_t)a_end);
      }
      // Bottom-Left (90 to 180)
      lv_point_t c_bl = { (lv_coord_t)(x1 + rad), (lv_coord_t)(y2 - rad) };
      for (float a = 90.0f; a < 180.0f; a += step_ang) {
        float a_end = (a + d_ang < 180.0f) ? (a + d_ang) : 180.0f;
        lv_draw_arc(draw_ctx, &arc_dsc, &c_bl, (uint16_t)rad, (uint16_t)a, (uint16_t)a_end);
      }
    }
  } else if (w->border_style == BORDER_BRACKETS) {
    int16_t arm_pct = w->bracket_len > 0 ? w->bracket_len : 35;
    int16_t arm_w = ((x2 - x1) * arm_pct) / 100;
    int16_t arm_h = ((y2 - y1) * arm_pct) / 100;
    if (arm_w < 12) arm_w = 12;
    if (arm_h < 12) arm_h = 12;

    // Top-Left
    lv_point_t tl1 = { (lv_coord_t)x1, (lv_coord_t)(y1 + arm_h) }, tl2 = { (lv_coord_t)x1, (lv_coord_t)y1 }, tl3 = { (lv_coord_t)(x1 + arm_w), (lv_coord_t)y1 };
    lv_draw_line(draw_ctx, &line_dsc, &tl1, &tl2);
    lv_draw_line(draw_ctx, &line_dsc, &tl2, &tl3);

    // Top-Right
    lv_point_t tr1 = { (lv_coord_t)(x2 - arm_w), (lv_coord_t)y1 }, tr2 = { (lv_coord_t)x2, (lv_coord_t)y1 }, tr3 = { (lv_coord_t)x2, (lv_coord_t)(y1 + arm_h) };
    lv_draw_line(draw_ctx, &line_dsc, &tr1, &tr2);
    lv_draw_line(draw_ctx, &line_dsc, &tr2, &tr3);

    // Bottom-Left
    lv_point_t bl1 = { (lv_coord_t)x1, (lv_coord_t)(y2 - arm_h) }, bl2 = { (lv_coord_t)x1, (lv_coord_t)y2 }, bl3 = { (lv_coord_t)(x1 + arm_w), (lv_coord_t)y2 };
    lv_draw_line(draw_ctx, &line_dsc, &bl1, &bl2);
    lv_draw_line(draw_ctx, &line_dsc, &bl2, &bl3);

    // Bottom-Right
    lv_point_t br1 = { (lv_coord_t)(x2 - arm_w), (lv_coord_t)y2 }, br2 = { (lv_coord_t)x2, (lv_coord_t)y2 }, br3 = { (lv_coord_t)x2, (lv_coord_t)(y2 - arm_h) };
    lv_draw_line(draw_ctx, &line_dsc, &br1, &br2);
    lv_draw_line(draw_ctx, &line_dsc, &br2, &br3);
  } else if (w->border_style == BORDER_DOUBLE) {
    lv_draw_rect_dsc_t rect_dsc;
    lv_draw_rect_dsc_init(&rect_dsc);
    rect_dsc.bg_opa = LV_OPA_TRANSP;
    rect_dsc.border_color = w->border_color;
    rect_dsc.border_width = (w->border_width > 0) ? w->border_width : 1;
    rect_dsc.border_opa = LV_OPA_COVER;
    rect_dsc.radius = rad;

    // Outer rect
    lv_area_t outer_area = { (lv_coord_t)coords.x1, (lv_coord_t)coords.y1, (lv_coord_t)coords.x2, (lv_coord_t)coords.y2 };
    lv_draw_rect(draw_ctx, &rect_dsc, &outer_area);

    // Inner rect with gap
    int16_t gap = (w->border_width >= 3) ? (w->border_width + 2) : 4;
    int16_t in_rad = (rad > gap) ? (rad - gap) : 0;
    rect_dsc.radius = in_rad;
    lv_area_t inner_area = {
      (lv_coord_t)(coords.x1 + gap),
      (lv_coord_t)(coords.y1 + gap),
      (lv_coord_t)(coords.x2 - gap),
      (lv_coord_t)(coords.y2 - gap)
    };
    lv_draw_rect(draw_ctx, &rect_dsc, &inner_area);
  }
}

const lv_font_t* getFontForSize(int size) {
  // Supports both direct px (12-24) and companion app slider values (28-112)
  if (size <= 14) return &lv_font_montserrat_14;
  if (size <= 16) return &lv_font_montserrat_16;
  if (size <= 18) return &lv_font_montserrat_18;
  if (size <= 20) return &lv_font_montserrat_20;
  if (size <= 24) return &lv_font_montserrat_24;
  if (size <= 32) return &lv_font_montserrat_16; // 28px in app dropdown -> 16px font
  if (size <= 40) return &lv_font_montserrat_18; // 36px in app dropdown -> 18px font
  if (size <= 48) return &lv_font_montserrat_20; // 44px in app dropdown -> 20px font
  if (size <= 56) return &lv_font_montserrat_22; // 52px in app dropdown -> 22px font
  if (size <= 64) return &lv_font_montserrat_24; // 60px in app dropdown -> 24px font
  if (size <= 72) return &lv_font_montserrat_26; // 68px (Default) in app dropdown -> 26px font
  if (size <= 80) return &lv_font_montserrat_30; // 76px in app dropdown -> 30px font
  if (size <= 90) return &lv_font_montserrat_34; // 84px in app dropdown -> 34px font
  if (size <= 104) return &lv_font_montserrat_38; // 96px in app dropdown -> 38px font
  return &lv_font_montserrat_44; // 112px in app dropdown -> 44px font
}

// Construct Dynamic Macropad UI
void build_ui() {
  lv_obj_t *scr = lv_scr_act();
  lv_obj_set_style_bg_color(scr, colorHex(0x111317), LV_PART_MAIN);
  lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_scroll_dir(scr, LV_DIR_NONE);

  // 1. Navigation Header Bar (800x60)
  tab_track = lv_obj_create(scr);
  lv_obj_set_size(tab_track, 228 * MAX_PAGES, 50);
  lv_obj_set_pos(tab_track, 0, 8);
  lv_obj_set_style_bg_opa(tab_track, LV_OPA_TRANSP, LV_PART_MAIN);
  lv_obj_set_style_border_width(tab_track, 0, LV_PART_MAIN);
  lv_obj_set_style_pad_all(tab_track, 0, LV_PART_MAIN);
  lv_obj_clear_flag(tab_track, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_scroll_dir(tab_track, LV_DIR_NONE);

  for (int i = 0; i < MAX_PAGES; i++) {
    tab_btns[i] = lv_btn_create(tab_track);
    lv_obj_set_size(tab_btns[i], 216, 46);
    lv_obj_set_pos(tab_btns[i], i * 228, 2);
    lv_obj_set_style_radius(tab_btns[i], 12, LV_PART_MAIN);
    lv_obj_set_style_bg_opa(tab_btns[i], LV_OPA_TRANSP, LV_PART_MAIN);
    lv_obj_set_style_border_color(tab_btns[i], colorHex(0x3e4451), LV_PART_MAIN);
    lv_obj_set_style_border_width(tab_btns[i], 2, LV_PART_MAIN);
    lv_obj_clear_flag(tab_btns[i], LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scroll_dir(tab_btns[i], LV_DIR_NONE);

    tab_btn_labels[i] = lv_label_create(tab_btns[i]);
    lv_label_set_text_fmt(tab_btn_labels[i], "Page %d", i + 1);
    lv_obj_set_style_text_font(tab_btn_labels[i], &lv_font_montserrat_18, LV_PART_MAIN);
    lv_obj_set_style_text_color(tab_btn_labels[i], colorHex(0x8a99ad), LV_PART_MAIN);
    lv_obj_center(tab_btn_labels[i]);

    lv_obj_add_event_cb(tab_btns[i], nav_tab_click_cb, LV_EVENT_ALL, (void*)(intptr_t)i);

    if (i >= total_pages) {
      lv_obj_add_flag(tab_btns[i], LV_OBJ_FLAG_HIDDEN);
    }
  }

  // Prev Page Button (Top Left)
  btn_prev = lv_btn_create(scr);
  lv_obj_set_size(btn_prev, 48, 48);
  lv_obj_set_pos(btn_prev, 6, 8);
  lv_obj_set_style_radius(btn_prev, 12, LV_PART_MAIN);
  lv_obj_set_style_bg_opa(btn_prev, LV_OPA_TRANSP, LV_PART_MAIN);
  lv_obj_set_style_border_color(btn_prev, colorHex(0x3e4451), LV_PART_MAIN);
  lv_obj_set_style_border_width(btn_prev, 2, LV_PART_MAIN);
  lv_obj_clear_flag(btn_prev, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_scroll_dir(btn_prev, LV_DIR_NONE);
  lv_obj_t *lbl_prev = lv_label_create(btn_prev);
  lv_label_set_text(lbl_prev, LV_SYMBOL_LEFT);
  lv_obj_set_style_text_font(lbl_prev, &lv_font_montserrat_20, LV_PART_MAIN);
  lv_obj_set_style_text_color(lbl_prev, colorHex(0xffffff), LV_PART_MAIN);
  lv_obj_center(lbl_prev);
  lv_obj_add_event_cb(btn_prev, nav_prev_click_cb, LV_EVENT_ALL, NULL);

  // Next Page Button (Top Right)
  btn_next = lv_btn_create(scr);
  lv_obj_set_size(btn_next, 48, 48);
  lv_obj_set_pos(btn_next, 746, 8);
  lv_obj_set_style_radius(btn_next, 12, LV_PART_MAIN);
  lv_obj_set_style_bg_opa(btn_next, LV_OPA_TRANSP, LV_PART_MAIN);
  lv_obj_set_style_border_color(btn_next, colorHex(0x3e4451), LV_PART_MAIN);
  lv_obj_set_style_border_width(btn_next, 2, LV_PART_MAIN);
  lv_obj_clear_flag(btn_next, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_scroll_dir(btn_next, LV_DIR_NONE);
  lv_obj_t *lbl_next = lv_label_create(btn_next);
  lv_label_set_text(lbl_next, LV_SYMBOL_RIGHT);
  lv_obj_set_style_text_font(lbl_next, &lv_font_montserrat_20, LV_PART_MAIN);
  lv_obj_set_style_text_color(lbl_next, colorHex(0xffffff), LV_PART_MAIN);
  lv_obj_center(lbl_next);
  lv_obj_add_event_cb(btn_next, nav_next_click_cb, LV_EVENT_ALL, NULL);

  // 2. Tabview for Button Grid Pages (800x416)
  tabview = lv_tabview_create(scr, LV_DIR_TOP, 0);
  lv_obj_set_pos(tabview, 0, 64);
  lv_obj_set_size(tabview, 800, 416);
  lv_obj_set_style_bg_opa(tabview, LV_OPA_TRANSP, LV_PART_MAIN);
  lv_obj_set_style_pad_all(tabview, 0, LV_PART_MAIN);
  lv_obj_set_style_border_width(tabview, 0, LV_PART_MAIN);
  lv_obj_clear_flag(tabview, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_scroll_dir(tabview, LV_DIR_NONE);

  lv_obj_t *tv_content = lv_tabview_get_content(tabview);
  if (tv_content) {
    lv_obj_set_style_bg_opa(tv_content, LV_OPA_TRANSP, LV_PART_MAIN);
    lv_obj_clear_flag(tv_content, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scroll_dir(tv_content, LV_DIR_NONE);
  }

  // Build Grid Pages
  for (int p = 0; p < MAX_PAGES; p++) {
    char buf[16];
    snprintf(buf, sizeof(buf), "p%d", p + 1);
    tab_pages[p] = lv_tabview_add_tab(tabview, buf);
    lv_obj_set_style_bg_opa(tab_pages[p], LV_OPA_TRANSP, LV_PART_MAIN);
    lv_obj_clear_flag(tab_pages[p], LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scroll_dir(tab_pages[p], LV_DIR_NONE);

    // Center 3 Columns x 2 Rows Grid in 800x416 space
    lv_obj_set_style_pad_left(tab_pages[p], 18, LV_PART_MAIN);
    lv_obj_set_style_pad_right(tab_pages[p], 18, LV_PART_MAIN);
    lv_obj_set_style_pad_top(tab_pages[p], 14, LV_PART_MAIN);
    lv_obj_set_style_pad_bottom(tab_pages[p], 14, LV_PART_MAIN);
    lv_obj_set_style_pad_column(tab_pages[p], 18, LV_PART_MAIN);
    lv_obj_set_style_pad_row(tab_pages[p], 16, LV_PART_MAIN);

    static lv_coord_t col_dsc[] = {242, 242, 242, LV_GRID_TEMPLATE_LAST};
    static lv_coord_t row_dsc[] = {186, 186, LV_GRID_TEMPLATE_LAST};

    lv_obj_set_grid_dsc_array(tab_pages[p], col_dsc, row_dsc);

    for (int b = 0; b < BUTTONS_PER_PAGE; b++) {
      int col = b % 3;
      int row = b / 3;

      ButtonWidget &w = grid_buttons[p][b];
      w.page = p;
      w.index = b;

      w.btn = lv_btn_create(tab_pages[p]);
      lv_obj_set_grid_cell(w.btn, LV_GRID_ALIGN_STRETCH, col, 1, LV_GRID_ALIGN_STRETCH, row, 1);
      lv_obj_set_style_radius(w.btn, 20, LV_PART_MAIN);
      lv_obj_set_style_bg_color(w.btn, colorHex(0x1a1d24), LV_PART_MAIN);
      lv_obj_set_style_border_color(w.btn, colorHex(0x2c3e50), LV_PART_MAIN);
      lv_obj_set_style_border_width(w.btn, 2, LV_PART_MAIN);
      lv_obj_set_style_bg_color(w.btn, colorHex(0x3498db), (lv_style_selector_t)((uint32_t)LV_PART_MAIN | (uint32_t)LV_STATE_PRESSED));
      lv_obj_clear_flag(w.btn, LV_OBJ_FLAG_SCROLLABLE);
      lv_obj_set_scroll_dir(w.btn, LV_DIR_NONE);

      // Flex column layout inside button to center Icon and Title
      lv_obj_set_flex_flow(w.btn, LV_FLEX_FLOW_COLUMN);
      lv_obj_set_flex_align(w.btn, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

      // Vector Symbol Icon
      w.icon = lv_label_create(w.btn);
      lv_label_set_text(w.icon, "");
      lv_obj_set_style_text_font(w.icon, &lv_font_material_symbols_28, LV_PART_MAIN);
      lv_obj_set_style_text_color(w.icon, colorHex(0xffffff), LV_PART_MAIN);
      lv_obj_add_flag(w.icon, LV_OBJ_FLAG_HIDDEN);

      // Custom Image Icon (PNG, JPG, BMP)
      w.img = lv_img_create(w.btn);
      lv_obj_add_flag(w.img, LV_OBJ_FLAG_HIDDEN);

      // Main Title Label
      w.label = lv_label_create(w.btn);
      lv_label_set_text(w.label, "");
      lv_label_set_long_mode(w.label, LV_LABEL_LONG_WRAP);
      lv_obj_set_width(w.label, 220);
      lv_obj_set_style_text_font(w.label, &lv_font_montserrat_24, LV_PART_MAIN);
      lv_obj_set_style_text_color(w.label, colorHex(0xffffff), LV_PART_MAIN);
      lv_obj_set_style_text_align(w.label, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN);

      // Open Folder Badge in top right corner (for sub-page / folder actions)
      w.folder_badge = lv_label_create(w.btn);
      lv_obj_set_style_text_font(w.folder_badge, &lv_font_montserrat_20, LV_PART_MAIN);
      lv_label_set_text(w.folder_badge, LV_SYMBOL_DIRECTORY);
      lv_obj_set_style_text_color(w.folder_badge, colorHex(0x94a3b8), LV_PART_MAIN);
      lv_obj_align(w.folder_badge, LV_ALIGN_TOP_RIGHT, -12, 10);
      lv_obj_add_flag(w.folder_badge, LV_OBJ_FLAG_FLOATING | LV_OBJ_FLAG_EVENT_BUBBLE | LV_OBJ_FLAG_HIDDEN);

      lv_obj_add_event_cb(w.btn, btn_event_cb, LV_EVENT_ALL, &w);
      lv_obj_add_event_cb(w.btn, btn_draw_event_cb, LV_EVENT_DRAW_POST, &w);
    }
  }

  // 3. Syncing Layout Popup Modal (Centered Dark Glass Card)
  sync_popup = lv_obj_create(scr);
  lv_obj_set_size(sync_popup, 360, 100);
  lv_obj_center(sync_popup);
  lv_obj_set_style_radius(sync_popup, 20, LV_PART_MAIN);
  lv_obj_set_style_bg_color(sync_popup, colorHex(0x181a1f), LV_PART_MAIN);
  lv_obj_set_style_bg_opa(sync_popup, LV_OPA_90, LV_PART_MAIN);
  lv_obj_set_style_border_color(sync_popup, colorHex(0x3498db), LV_PART_MAIN);
  lv_obj_set_style_border_width(sync_popup, 2, LV_PART_MAIN);
  lv_obj_set_style_shadow_color(sync_popup, colorHex(0x000000), LV_PART_MAIN);
  lv_obj_set_style_shadow_width(sync_popup, 30, LV_PART_MAIN);
  lv_obj_set_style_shadow_opa(sync_popup, LV_OPA_70, LV_PART_MAIN);
  lv_obj_clear_flag(sync_popup, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_scroll_dir(sync_popup, LV_DIR_NONE);

  lv_obj_set_flex_flow(sync_popup, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(sync_popup, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

  lv_obj_t *sync_icon = lv_label_create(sync_popup);
  const char* syncSym = getMaterialSymbolUtf8("refresh");
  lv_label_set_text(sync_icon, (strlen(syncSym) > 0) ? syncSym : LV_SYMBOL_REFRESH);
  lv_obj_set_style_text_font(sync_icon, &lv_font_montserrat_26, LV_PART_MAIN);
  lv_obj_set_style_text_color(sync_icon, colorHex(0x3498db), LV_PART_MAIN);

  sync_popup_lbl = lv_label_create(sync_popup);
  lv_label_set_text(sync_popup_lbl, "Syncing Layout...");
  lv_obj_set_style_text_font(sync_popup_lbl, &lv_font_montserrat_24, LV_PART_MAIN);
  lv_obj_set_style_text_color(sync_popup_lbl, colorHex(0xffffff), LV_PART_MAIN);
  lv_obj_set_style_pad_left(sync_popup_lbl, 12, LV_PART_MAIN);

  lv_obj_add_flag(sync_popup, LV_OBJ_FLAG_HIDDEN);

  // 4. Full-Screen Perimeter Edge Flash Alarm Overlay (Top Layer)
  lv_obj_t *top_layer = lv_layer_top();
  edge_flash_overlay = lv_obj_create(top_layer);
  lv_obj_set_size(edge_flash_overlay, 800, 480);
  lv_obj_set_pos(edge_flash_overlay, 0, 0);
  lv_obj_set_style_bg_opa(edge_flash_overlay, LV_OPA_TRANSP, LV_PART_MAIN);
  lv_obj_set_style_border_color(edge_flash_overlay, colorHex(0xef4444), LV_PART_MAIN);
  lv_obj_set_style_border_width(edge_flash_overlay, 6, LV_PART_MAIN);
  lv_obj_set_style_radius(edge_flash_overlay, 0, LV_PART_MAIN);
  lv_obj_set_style_pad_all(edge_flash_overlay, 0, LV_PART_MAIN);
  lv_obj_clear_flag(edge_flash_overlay, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_clear_flag(edge_flash_overlay, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_flag(edge_flash_overlay, LV_OBJ_FLAG_HIDDEN);

  switch_page(0);
}

// --- Startup Splash Screen (3-second branded boot card) ---
static lv_obj_t *startup_splash_layer = NULL;

static void startup_splash_close_cb(lv_timer_t *t) {
  if (startup_splash_layer) {
    lv_obj_del(startup_splash_layer);
    startup_splash_layer = NULL;
  }
}

void showStartupScreen() {
  startup_splash_layer = lv_obj_create(lv_layer_top());
  lv_obj_set_size(startup_splash_layer, JC_SCREEN_WIDTH, JC_SCREEN_HEIGHT);
  lv_obj_set_style_bg_color(startup_splash_layer, colorHex(0x0c0d0f), LV_PART_MAIN);
  lv_obj_set_style_bg_opa(startup_splash_layer, LV_OPA_COVER, LV_PART_MAIN);
  lv_obj_set_style_border_width(startup_splash_layer, 0, LV_PART_MAIN);
  lv_obj_set_style_pad_all(startup_splash_layer, 0, LV_PART_MAIN);
  lv_obj_clear_flag(startup_splash_layer, LV_OBJ_FLAG_SCROLLABLE);

  lv_obj_t *title = lv_label_create(startup_splash_layer);
  lv_label_set_text(title, "Matrix MacroPad");
  lv_obj_set_style_text_font(title, &lv_font_montserrat_48, LV_PART_MAIN);
  lv_obj_set_style_text_color(title, colorHex(0x9472f7), LV_PART_MAIN);
  lv_obj_center(title);

  // Force immediate full-screen render of splash frame before any underlying UI is constructed
  lv_refr_now(NULL);

  lv_timer_t *timer = lv_timer_create(startup_splash_close_cb, 3000, NULL);
  lv_timer_set_repeat_count(timer, 1);
}

// Auto-detect and palette mapping for themes
PaletteColor getThemePaletteColor(const String &themeName, const String &colorKey) {
  String t = themeName;
  t.toLowerCase();
  String k = colorKey;
  k.toLowerCase();

  if (t == "cyberpunk") {
    if (k == "c-edit" || k == "blue") return {0x00f0ff, 0x0077fe, 0x000000};
    if (k == "c-system" || k == "green") return {0x05ffa1, 0x00b86b, 0x000000};
    if (k == "c-util" || k == "purple") return {0xff007f, 0x9b00e8, 0xffffff};
    if (k == "c-nav" || k == "orange" || k == "yellow") return {0xffe600, 0xff5e00, 0x000000};
    if (k == "c-danger" || k == "red") return {0xff003c, 0x990024, 0xffffff};
    if (k == "c-gray" || k == "gray") return {0x241c38, 0x130e20, 0x00f0ff};
    if (k == "c-black" || k == "dark") return {0x08050e, 0x000000, 0x05ffa1};
    if (k == "c-white" || k == "white") return {0xe0f7fa, 0x000000, 0x0b0813};
  } else if (t == "synthwave") {
    if (k == "c-edit" || k == "blue") return {0x01cdfe, 0x0575e6, 0xffffff};
    if (k == "c-system" || k == "green") return {0x05ffa1, 0x00b4d8, 0x000000};
    if (k == "c-util" || k == "purple") return {0xff71ce, 0xb900b4, 0xffffff};
    if (k == "c-nav" || k == "orange") return {0xf9d423, 0xff4e50, 0x000000};
    if (k == "c-danger" || k == "red") return {0xff2a6d, 0x990024, 0xffffff};
    if (k == "c-gray" || k == "gray") return {0x241734, 0x12071f, 0xff71ce};
    if (k == "c-black" || k == "dark") return {0x0f051d, 0x000000, 0x01cdfe};
    if (k == "c-white" || k == "white") return {0xf8f8f2, 0x000000, 0x1a0826};
  } else if (t == "matrix") {
    if (k == "c-edit" || k == "blue") return {0x00ff66, 0x009944, 0x000000};
    if (k == "c-system" || k == "green") return {0x00cc55, 0x003311, 0x000000};
    if (k == "c-util" || k == "purple") return {0x009944, 0x003311, 0xffffff};
    if (k == "c-nav" || k == "orange") return {0xaaff00, 0x009944, 0x000000};
    if (k == "c-danger" || k == "red") return {0xff3333, 0x990000, 0xffffff};
    if (k == "c-gray" || k == "gray") return {0x003311, 0x051105, 0x00ff66};
    if (k == "c-black" || k == "dark") return {0x051105, 0x000000, 0x00ff66};
    if (k == "c-white" || k == "white") return {0xd4ffd4, 0x000000, 0x051105};
  } else if (t == "midnight") {
    if (k == "c-edit" || k == "blue") return {0x2563eb, 0x1d4ed8, 0xffffff};
    if (k == "c-system" || k == "green") return {0x059669, 0x047857, 0xffffff};
    if (k == "c-util" || k == "purple") return {0x7c3aed, 0x6d28d9, 0xffffff};
    if (k == "c-nav" || k == "orange") return {0xd97706, 0xb45309, 0xffffff};
    if (k == "c-danger" || k == "red") return {0xdc2626, 0xb91c1c, 0xffffff};
    if (k == "c-gray" || k == "gray") return {0x1e293b, 0x0f172a, 0x94a3b8};
    if (k == "c-black" || k == "dark") return {0x020617, 0x000000, 0x38bdf8};
    if (k == "c-white" || k == "white") return {0xf8fafc, 0x000000, 0x0f172a};
  }

  // Default theme
  if (k == "c-edit" || k == "blue") return {0x2980b9, 0x2573a7, 0xffffff};
  if (k == "c-danger" || k == "red") return {0xc0392b, 0xa62c1f, 0xffffff};
  if (k == "c-system" || k == "green") return {0x27ae60, 0x219653, 0xffffff};
  if (k == "c-util" || k == "purple") return {0x8e44ad, 0x7d3c98, 0xffffff};
  if (k == "c-nav" || k == "orange") return {0xf39c12, 0xd35400, 0xffffff};
  if (k == "c-gray" || k == "gray") return {0x4b5563, 0x374151, 0xffffff};
  if (k == "c-black" || k == "dark") return {0x181a1f, 0x0d0f12, 0xffffff};
  if (k == "c-white" || k == "white") return {0xffffff, 0xe2e8f0, 0x0f172a};

  return {0x4b5563, 0x374151, 0xffffff};
}

String sanitizeLabel(const String &raw) {
  String clean = "";
  for (size_t i = 0; i < raw.length(); i++) {
    char c = raw[i];
    if (c >= 0x20 && c <= 0x7E) {
      clean += c;
    }
  }
  clean.trim();
  return clean;
}

static String active_theme = "default";

// Apply button formatting and styling from JSON object
void applyButtonData(ButtonWidget &w, JsonObject bObj, const String &themeName = "") {
  String currentTheme = themeName.length() > 0 ? themeName : active_theme;

  const char* rawLabel = bObj["label"] | "";
  String cleanLabel = sanitizeLabel(String(rawLabel));

  const char* cName = bObj["color"] | "c-gray";
  const char* bgHex = bObj["bg_color"] | bObj["bgColor"] | bObj["bg"] | "";
  const char* bg2Hex = bObj["bg2_color"] | bObj["bg2Color"] | bObj["bg2"] | "";
  const char* textColorHex = bObj["text_color"] | bObj["textColor"] | bObj["customTextColor"] | "";
  const char* borderColorHex = bObj["border_color"] | bObj["borderColor"] | "";
  const char* borderStyle = bObj["borderStyle"] | bObj["border_style"] | "";
  int bWidth = bObj.containsKey("border_width") ? (int)bObj["border_width"] : (bObj.containsKey("borderWidth") ? (int)bObj["borderWidth"] : 0);
  if (strcmp(borderStyle, "none") == 0) {
    bWidth = 0;
  }
  int bRadius = bObj.containsKey("border_radius") ? (int)bObj["border_radius"] : (bObj.containsKey("borderRadius") ? (int)bObj["borderRadius"] : (bObj.containsKey("radius") ? (int)bObj["radius"] : 24));
  const char* matIcon = bObj["materialIcon"] | "";
  const char* rawIcon = bObj["icon"] | "";
  const char* sym = (strlen(matIcon) > 0) ? getMaterialSymbolUtf8(String(matIcon)) : (strlen(rawIcon) > 0 ? getMaterialSymbolUtf8(String(rawIcon)) : "");
  bool hasImage = (strlen(rawIcon) > 0 && strlen(sym) == 0 && !String(rawIcon).startsWith("data:"));

  int fontSize = bObj.containsKey("font_size") ? (int)bObj["font_size"] : (bObj.containsKey("fontSize") ? (int)bObj["fontSize"] : 24);

  // Optional bounding box positioning / sizing override
  if (bObj.containsKey("w") && bObj.containsKey("h")) {
    int w_px = bObj["w"] | 0;
    int h_px = bObj["h"] | 0;
    if (w_px > 0 && h_px > 0) {
      lv_obj_set_size(w.btn, w_px, h_px);
    }
  }
  if (bObj.containsKey("x") && bObj.containsKey("y")) {
    int x_px = bObj["x"] | -1;
    int y_px = bObj["y"] | -1;
    if (x_px >= 0 && y_px >= 0) {
      lv_obj_set_pos(w.btn, x_px, y_px);
    }
  }

  lv_obj_set_style_text_font(w.label, getFontForSize(fontSize), LV_PART_MAIN);
  if (cleanLabel.length() > 0 && !hasImage) {
    lv_label_set_text(w.label, cleanLabel.c_str());
    lv_obj_clear_flag(w.label, LV_OBJ_FLAG_HIDDEN);
  } else {
    lv_label_set_text(w.label, "");
    lv_obj_add_flag(w.label, LV_OBJ_FLAG_HIDDEN);
  }

  // Explicit Icon / Image handling
  if (strlen(sym) > 0) {
    lv_obj_set_flex_flow(w.btn, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(w.btn, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_text_font(w.icon, getIconFontForSize(fontSize), LV_PART_MAIN);
    lv_label_set_text(w.icon, sym);
    lv_obj_clear_flag(w.icon, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(w.img, LV_OBJ_FLAG_HIDDEN);
  } else if (hasImage) {
    String imgName = String(rawIcon);
    if (imgName.endsWith(".jpg")) imgName.replace(".jpg", ".png");
    if (imgName.endsWith(".jpeg")) imgName.replace(".jpeg", ".png");
    if (imgName.endsWith(".bmp")) imgName.replace(".bmp", ".png");
    if (imgName.endsWith(".webp")) imgName.replace(".webp", ".png");
    snprintf(w.img_path, sizeof(w.img_path), "A:/%s", imgName.c_str());
    lv_img_cache_invalidate_src(w.img_path);
    lv_img_set_src(w.img, w.img_path);
    const char* iconFit = bObj["iconFit"] | bObj["icon_fit"] | "contain";
    lv_img_set_zoom(w.img, 256);
    lv_obj_set_size(w.img, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
    // Disable flex layout and set persistent center alignment on image
    lv_obj_set_layout(w.btn, 0);
    lv_obj_set_style_pad_all(w.btn, 0, LV_PART_MAIN);
    lv_obj_set_align(w.img, LV_ALIGN_CENTER);
    lv_obj_set_pos(w.img, 0, 0);
    lv_obj_clear_flag(w.img, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(w.icon, LV_OBJ_FLAG_HIDDEN);
  } else {
    lv_obj_set_flex_flow(w.btn, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(w.btn, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_label_set_text(w.icon, "");
    w.img_path[0] = '\0';
    lv_obj_add_flag(w.icon, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(w.img, LV_OBJ_FLAG_HIDDEN);
  }

  // Resolve Colors
  lv_color_t btnColor;
  lv_color_t gradColor;
  lv_color_t textColor;
  bool useGrad = false;

  const char* customC1 = bObj["customColor1"] | "";
  const char* customC2 = bObj["customColor2"] | "";
  const char* customText = bObj["customTextColor"] | "";

  if (strlen(bgHex) > 0) {
    btnColor = parseHexColor(bgHex);
    if (strlen(bg2Hex) > 0) {
      gradColor = parseHexColor(bg2Hex);
      useGrad = true;
    }
    textColor = strlen(textColorHex) > 0 ? parseHexColor(textColorHex) : colorHex(0xffffff);
  } else if (strcmp(cName, "custom") == 0 || strlen(customC1) > 0) {
    btnColor = strlen(customC1) > 0 ? parseHexColor(customC1) : colorHex(0x2980b9);
    if (strlen(customC2) > 0) {
      gradColor = parseHexColor(customC2);
      useGrad = true;
    }
    textColor = strlen(customText) > 0 ? parseHexColor(customText) : (strlen(textColorHex) > 0 ? parseHexColor(textColorHex) : colorHex(0xffffff));
  } else if (cName[0] == '#') {
    btnColor = parseHexColor(cName);
    if (strlen(bg2Hex) > 0) {
      gradColor = parseHexColor(bg2Hex);
      useGrad = true;
    }
    textColor = strlen(textColorHex) > 0 ? parseHexColor(textColorHex) : colorHex(0xffffff);
  } else {
    PaletteColor pCol = getThemePaletteColor(currentTheme, String(cName));
    btnColor = colorHex(pCol.bg);
    if (pCol.bg2 != 0) {
      gradColor = colorHex(pCol.bg2);
      useGrad = true;
    }
    textColor = strlen(textColorHex) > 0 ? parseHexColor(textColorHex) : colorHex(pCol.text);
  }

  lv_obj_set_style_radius(w.btn, bRadius, LV_PART_MAIN);
  lv_obj_set_style_clip_corner(w.btn, true, LV_PART_MAIN);
  lv_obj_set_style_radius(w.img, bRadius, LV_PART_MAIN);
  lv_obj_set_style_clip_corner(w.img, true, LV_PART_MAIN);

  bool isTransparent = (strcmp(cName, "transparent") == 0 || strcmp(cName, "c-transparent") == 0 || strcmp(bgHex, "transparent") == 0);
  if (isTransparent) {
    lv_obj_set_style_bg_opa(w.btn, LV_OPA_TRANSP, LV_PART_MAIN);
  } else {
    lv_obj_set_style_bg_opa(w.btn, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_bg_color(w.btn, btnColor, LV_PART_MAIN);
  }

  if (useGrad) {
    lv_obj_set_style_bg_grad_color(w.btn, gradColor, LV_PART_MAIN);
    int customAngle = bObj["customAngle"] | bObj["angle"] | 180;
    const char* gradDir = bObj["gradientDir"] | bObj["gradient_dir"] | "";
    if (customAngle == 90 || strcmp(gradDir, "horizontal") == 0 || strcmp(gradDir, "hor") == 0) {
      lv_obj_set_style_bg_grad_dir(w.btn, LV_GRAD_DIR_HOR, LV_PART_MAIN);
    } else {
      lv_obj_set_style_bg_grad_dir(w.btn, LV_GRAD_DIR_VER, LV_PART_MAIN);
    }
  } else {
    lv_obj_set_style_bg_grad_dir(w.btn, LV_GRAD_DIR_NONE, LV_PART_MAIN);
  }

  if (strcmp(borderStyle, "dashed") == 0) {
    w.border_style = BORDER_DASHED;
    w.border_width = bWidth > 0 ? bWidth : 2;
    w.dash_gap = bObj["borderDashGap"] | bObj["dash_gap"] | 8;
    w.dash_len = bObj["borderDashLength"] | bObj["dash_len"] | 12;
  } else if (strcmp(borderStyle, "dotted") == 0) {
    w.border_style = BORDER_DOTTED;
    w.border_width = bWidth > 0 ? bWidth : 2;
  } else if (strcmp(borderStyle, "double") == 0) {
    w.border_style = BORDER_DOUBLE;
    w.border_width = bWidth > 0 ? bWidth : 2;
  } else if (strcmp(borderStyle, "brackets") == 0) {
    w.border_style = BORDER_BRACKETS;
    w.border_width = bWidth > 0 ? bWidth : 2;
    w.bracket_len = bObj["borderBracketLength"] | bObj["bracket_len"] | 35;
  } else if (strcmp(borderStyle, "none") == 0 || bWidth == 0) {
    w.border_style = BORDER_NONE;
    w.border_width = 0;
  } else {
    w.border_style = BORDER_SOLID;
    w.border_width = bWidth;
  }

  w.border_color = (strlen(borderColorHex) > 0) ? parseHexColor(borderColorHex) : colorHex(0xffffff);
  w.border_radius = bRadius;

  if (w.border_style == BORDER_SOLID && w.border_width > 0) {
    lv_obj_set_style_border_color(w.btn, w.border_color, LV_PART_MAIN);
    lv_obj_set_style_border_width(w.btn, w.border_width, LV_PART_MAIN);
    lv_obj_set_style_border_opa(w.btn, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_border_side(w.btn, LV_BORDER_SIDE_FULL, LV_PART_MAIN);
  } else {
    lv_obj_set_style_border_width(w.btn, 0, LV_PART_MAIN);
    lv_obj_set_style_border_opa(w.btn, LV_OPA_TRANSP, LV_PART_MAIN);
  }

  lv_obj_set_style_text_color(w.label, textColor, LV_PART_MAIN);

  lv_color_t iconColor = textColor;
  const char* customIcon = bObj["customIconColor"] | bObj["iconColor"] | bObj["icon_color"] | "";
  if (strlen(customIcon) > 0 && String(customIcon) != "same_as_text" && customIcon[0] == '#') {
    iconColor = parseHexColor(customIcon);
  }
  lv_obj_set_style_text_color(w.icon, iconColor, LV_PART_MAIN);
  lv_obj_set_style_bg_color(w.btn, lv_color_darken(btnColor, 35), (lv_style_selector_t)((uint32_t)LV_PART_MAIN | (uint32_t)LV_STATE_PRESSED));

  w.orig_bg_color = btnColor;
  w.orig_text_color = textColor;

  // Widget Type Recognition (Shortcut, Stopwatch, Countdown / Timer)
  const char* bType = bObj["type"] | "shortcut";
  String bTypeStr = String(bType);
  bTypeStr.toLowerCase();

  if (bTypeStr == "stopwatch") {
    w.widget_type = WIDGET_STOPWATCH;
    w.timer_running = false;
    w.timer_alerting = false;
    w.timer_seconds = 0;
    w.last_click_time = 0;
    const char* widgetSym = (strlen(sym) > 0) ? sym : getMaterialSymbolUtf8("timer");
    if (w.icon && widgetSym && strlen(widgetSym) > 0) {
      lv_label_set_text(w.icon, widgetSym);
      lv_obj_clear_flag(w.icon, LV_OBJ_FLAG_HIDDEN);
    }
    updateTimerLabel(w);
  } else if (bTypeStr == "countdown" || bTypeStr == "timer") {
    w.widget_type = WIDGET_COUNTDOWN;
    w.timer_running = false;
    w.timer_alerting = false;
    uint32_t dur = bObj["duration"] | 300;
    if (dur == 0) dur = 300;
    w.timer_initial_duration = dur;
    w.timer_seconds = dur;
    w.last_click_time = 0;
    const char* widgetSym = (strlen(sym) > 0) ? sym : getMaterialSymbolUtf8("hourglass_top");
    if (w.icon && widgetSym && strlen(widgetSym) > 0) {
      lv_label_set_text(w.icon, widgetSym);
      lv_obj_clear_flag(w.icon, LV_OBJ_FLAG_HIDDEN);
    }
    updateTimerLabel(w);
  } else {
    w.widget_type = WIDGET_BUTTON;
    w.timer_running = false;
    w.timer_alerting = false;
  }

  // Parse Sub-Buttons / Folder Children
  w.has_sub_buttons = false;
  w.sub_button_count = 0;
  JsonArray subArr;
  if (bObj.containsKey("sub_buttons")) {
    subArr = bObj["sub_buttons"].as<JsonArray>();
  } else if (bObj.containsKey("children")) {
    subArr = bObj["children"].as<JsonArray>();
  }

  if (!subArr.isNull() && subArr.size() > 0) {
    w.has_sub_buttons = true;
    for (JsonObject sObj : subArr) {
      if (w.sub_button_count >= MAX_SUB_BUTTONS) break;
      SubButtonInfo &sub = w.sub_buttons[w.sub_button_count];
      sub.id = sObj["id"] | (w.sub_button_count + 1);

      const char* subLabel = sObj["label"] | "";
      snprintf(sub.label, sizeof(sub.label), "%s", subLabel);

      const char* subType = sObj["type"] | "KEYSTROKE";
      snprintf(sub.type, sizeof(sub.type), "%s", subType);

      const char* subPayload = sObj["payload"] | sObj["value"] | "";
      snprintf(sub.payload, sizeof(sub.payload), "%s", subPayload);

      const char* subMat = sObj["materialIcon"] | sObj["icon"] | "";
      snprintf(sub.icon, sizeof(sub.icon), "%s", subMat);

      const char* sText = sObj["customTextColor"] | sObj["textColor"] | sObj["text_color"] | "";
      sub.text_color = (strlen(sText) > 0 && sText[0] == '#') ? parseHexColor(sText) : colorHex(0xFFFFFF);

      const char* sIconCol = sObj["customIconColor"] | sObj["iconColor"] | sObj["icon_color"] | "";
      sub.icon_color = (strlen(sIconCol) > 0 && String(sIconCol) != "same_as_text" && sIconCol[0] == '#') ? parseHexColor(sIconCol) : sub.text_color;

      const char* sBg = sObj["color"] | sObj["bg_color"] | sObj["bgColor"] | sObj["bg"] | sObj["customColor1"] | "";
      if (sBg[0] == '#') {
        sub.bg_color = parseHexColor(sBg);
      } else if (strlen(sBg) > 0 && strcmp(sBg, "custom") != 0) {
        PaletteColor pCol = getThemePaletteColor(currentTheme, String(sBg));
        sub.bg_color = colorHex(pCol.bg);
        if (strlen(sText) == 0) sub.text_color = colorHex(pCol.text);
      } else {
        const char* c1 = sObj["customColor1"] | "";
        sub.bg_color = (strlen(c1) > 0 && c1[0] == '#') ? parseHexColor(c1) : colorHex(0x232730);
      }

      const char* sBorder = sObj["borderColor"] | sObj["border_color"] | "";
      sub.border_color = (strlen(sBorder) > 0 && sBorder[0] == '#') ? parseHexColor(sBorder) : colorHex(0x34495e);

      const char* bStyle = sObj["borderStyle"] | sObj["border_style"] | "solid";
      int sBorderWidth = sObj.containsKey("borderWidth") ? (int)sObj["borderWidth"] : (sObj.containsKey("border_width") ? (int)sObj["border_width"] : 2);
      if (strcmp(bStyle, "none") == 0) sBorderWidth = 0;
      sub.border_width = (uint8_t)sBorderWidth;

      int sRadius = sObj.containsKey("borderRadius") ? (int)sObj["borderRadius"] : (sObj.containsKey("border_radius") ? (int)sObj["border_radius"] : 24);
      sub.border_radius = (uint8_t)sRadius;

      w.sub_button_count++;
    }
  }

  // Update top-right folder badge indicator
  if (w.folder_badge) {
    if (bTypeStr == "subpage" || bTypeStr == "folder" || w.has_sub_buttons) {
      lv_obj_clear_flag(w.folder_badge, LV_OBJ_FLAG_HIDDEN);
      lv_obj_set_style_text_color(w.folder_badge, colorHex(0xa855f7), LV_PART_MAIN);
      lv_obj_set_style_text_opa(w.folder_badge, LV_OPA_COVER, LV_PART_MAIN);
    } else {
      lv_obj_add_flag(w.folder_badge, LV_OBJ_FLAG_HIDDEN);
    }
  }

  lv_obj_invalidate(w.label);
  lv_obj_invalidate(w.btn);
}

// Active Profile Tracking & Profile Management
static char current_profile_name[64] = "default.json";

void applyLayoutJsonDoc(DynamicJsonDocument &doc) {
  if (doc.containsKey("_brightness")) {
    int bVal = doc["_brightness"] | 100;
    active_backlight_val = (uint8_t)constrain(bVal, 0, 100);
    if (!screensaver_active || screensaver_anim_mode != "screen_off") {
      hal.setBrightness(active_backlight_val);
    }
  }

  if (doc.containsKey("_volume")) {
    int vVal = doc["_volume"] | 80;
    audio_volume = constrain(vVal, 0, 100);
  }

  if (doc.containsKey("_screensaverTimeout")) {
    int sVal = doc["_screensaverTimeout"] | 300;
    screensaver_timeout_sec = constrain(sVal, 0, 3600);
  }

  if (doc.containsKey("_screensaverAnim")) {
    screensaver_anim_mode = String((const char*)(doc["_screensaverAnim"] | "bouncing_clock"));
  }

  if (doc.containsKey("_bgColor")) {
    const char* bgStr = doc["_bgColor"] | "#111317";
    if (bgStr && bgStr[0] == '#') {
      uint32_t bgHex = (uint32_t)strtol(bgStr + 1, NULL, 16);
      current_bg_color = bgHex;
      lv_obj_set_style_bg_color(lv_scr_act(), colorHex(bgHex), LV_PART_MAIN);
      switch_page(active_page);
    }
  }

  if (doc.containsKey("_theme")) {
    active_theme = String((const char*)(doc["_theme"] | "default"));
  }

  int maxP = 1;
  for (int p = 1; p <= MAX_PAGES; p++) {
    char keyName[16];
    snprintf(keyName, sizeof(keyName), "p%d-name", p);
    char keyBtn1[16];
    snprintf(keyBtn1, sizeof(keyBtn1), "p%d-b1", p);
    if (doc.containsKey(keyName) || doc.containsKey(keyBtn1)) {
      maxP = p;
    }
  }
  if (doc.containsKey("totalPages")) {
    maxP = doc["totalPages"] | maxP;
  }
  if (maxP < 1) maxP = 1;
  if (maxP > MAX_PAGES) maxP = MAX_PAGES;
  total_pages = maxP;

  for (int i = 0; i < MAX_PAGES; i++) {
    if (i < total_pages) {
      lv_obj_clear_flag(tab_btns[i], LV_OBJ_FLAG_HIDDEN);
    } else {
      lv_obj_add_flag(tab_btns[i], LV_OBJ_FLAG_HIDDEN);
    }
  }

  for (int p = 0; p < total_pages; p++) {
    int pageNum = p + 1;
    char keyName[16];
    snprintf(keyName, sizeof(keyName), "p%d-name", pageNum);
    const char* rawPageTitle = doc[keyName] | "";
    String cleanTitle = sanitizeLabel(String(rawPageTitle));
    if (cleanTitle.length() > 0) {
      lv_label_set_text(tab_btn_labels[p], cleanTitle.c_str());
    } else {
      char defaultTitle[16];
      snprintf(defaultTitle, sizeof(defaultTitle), "Page %d", pageNum);
      lv_label_set_text(tab_btn_labels[p], defaultTitle);
    }
    lv_obj_center(tab_btn_labels[p]);

    for (int b = 0; b < BUTTONS_PER_PAGE; b++) {
      int btnNum = b + 1;
      char keyBtn[16];
      snprintf(keyBtn, sizeof(keyBtn), "p%d-b%d", pageNum, btnNum);

      if (doc.containsKey(keyBtn)) {
        JsonObject bObj = doc[keyBtn].as<JsonObject>();
        applyButtonData(grid_buttons[p][b], bObj, active_theme);
      }
    }
    lv_obj_invalidate(tab_pages[p]);
  }

  switch_page(active_page < total_pages ? active_page : 0);
  lv_obj_invalidate(lv_scr_act());
  lv_refr_now(NULL);
}

void loadFallbackDefaultProfile() {
  Serial.println("[Profile] Applying hardcoded fallback profile from Flash.");
  snprintf(current_profile_name, sizeof(current_profile_name), "fallback_default");
  total_pages = 3;
  for (int i = 0; i < MAX_PAGES; i++) {
    if (i < total_pages) {
      lv_obj_clear_flag(tab_btns[i], LV_OBJ_FLAG_HIDDEN);
    } else {
      lv_obj_add_flag(tab_btns[i], LV_OBJ_FLAG_HIDDEN);
    }
  }

  const char* defaultPageTitles[3] = {"Editing Tools", "System Controls", "Custom Macros"};
  for (int p = 0; p < 3; p++) {
    lv_label_set_text(tab_btn_labels[p], defaultPageTitles[p]);
    lv_obj_center(tab_btn_labels[p]);
  }

  const char* p1Labels[6] = {"Select All", "Copy", "Paste", "Undo", "Redo", "Delete"};
  const char* p1Icons[6] = {"select_all", "content_copy", "content_paste", "undo", "redo", "delete"};
  const char* p2Labels[6] = {"Prev", "Play/Pause", "Next", "Vol -", "Vol +", "Mute"};
  const char* p2Icons[6] = {"skip_previous", "play_arrow", "skip_next", "volume_down", "volume_up", "volume_mute"};

  for (int b = 0; b < BUTTONS_PER_PAGE; b++) {
    ButtonWidget &w1 = grid_buttons[0][b];
    lv_label_set_text(w1.label, p1Labels[b]);
    lv_obj_clear_flag(w1.label, LV_OBJ_FLAG_HIDDEN);
    const char* sym1 = getMaterialSymbolUtf8(p1Icons[b]);
    if (strlen(sym1) > 0) {
      lv_label_set_text(w1.icon, sym1);
      lv_obj_clear_flag(w1.icon, LV_OBJ_FLAG_HIDDEN);
    }
    lv_obj_invalidate(w1.btn);

    ButtonWidget &w2 = grid_buttons[1][b];
    lv_label_set_text(w2.label, p2Labels[b]);
    lv_obj_clear_flag(w2.label, LV_OBJ_FLAG_HIDDEN);
    const char* sym2 = getMaterialSymbolUtf8(p2Icons[b]);
    if (strlen(sym2) > 0) {
      lv_label_set_text(w2.icon, sym2);
      lv_obj_clear_flag(w2.icon, LV_OBJ_FLAG_HIDDEN);
    }
    lv_obj_invalidate(w2.btn);
  }

  switch_page(0);
}

String getActiveProfileName() {
  if (!hal.storage) return "default.json";

  if (hal.storage->exists("/active_profile.txt")) {
    File f = hal.storage->open("/active_profile.txt", "r");
    if (f) {
      String name = f.readStringUntil('\n');
      f.close();
      name.trim();
      if (name.length() > 0) {
        while (name.startsWith("/")) name = name.substring(1);
        return name;
      }
    }
  }

  if (hal.storage->exists("/default.json")) {
    return "default.json";
  }

  File root = hal.storage->open("/");
  if (root && root.isDirectory()) {
    File file = root.openNextFile();
    while (file) {
      if (!file.isDirectory()) {
        String name = String(file.name());
        while (name.startsWith("/")) name = name.substring(1);
        String lower = name;
        lower.toLowerCase();
        if (lower.endsWith(".json")) {
          return name;
        }
      }
      file = root.openNextFile();
    }
  }

  return "default.json";
}

bool setActiveProfileName(const char* name) {
  if (!name || strlen(name) == 0 || !hal.storage) return false;
  String cleanName = name;
  cleanName.trim();
  while (cleanName.startsWith("/")) cleanName = cleanName.substring(1);

  File f = hal.storage->open("/active_profile.txt", "w");
  if (f) {
    f.println(cleanName);
    f.flush();
    f.close();
    snprintf(current_profile_name, sizeof(current_profile_name), "%s", cleanName.c_str());
    return true;
  }
  return false;
}

bool loadProfile(const char* filename) {
  if (!hal.storage || !filename || strlen(filename) == 0) {
    Serial.println("{\"type\":\"warning\",\"message\":\"Storage not available or invalid profile name\"}");
    loadFallbackDefaultProfile();
    return false;
  }

  String path = filename;
  path.trim();
  while (path.startsWith("/")) path = path.substring(1);
  String fullPath = String("/") + path;

  if (!hal.storage->exists(fullPath)) {
    Serial.printf("{\"type\":\"warning\",\"message\":\"Profile not found: %s\"}\n", fullPath.c_str());
    loadFallbackDefaultProfile();
    return false;
  }

  File f = hal.storage->open(fullPath, "r");
  if (!f) {
    Serial.printf("{\"type\":\"warning\",\"message\":\"Failed to open profile: %s\"}\n", fullPath.c_str());
    loadFallbackDefaultProfile();
    return false;
  }

  DynamicJsonDocument* doc = new (std::nothrow) DynamicJsonDocument(32768);
  if (!doc) {
    Serial.println("{\"type\":\"error\",\"message\":\"PSRAM/Heap allocation failed for profile JSON\"}");
    f.close();
    loadFallbackDefaultProfile();
    return false;
  }

  DeserializationError err = deserializeJson(*doc, f);
  f.close();

  if (err != DeserializationError::Ok) {
    Serial.printf("{\"type\":\"warning\",\"message\":\"JSON deserialization failed for %s: %s\"}\n", fullPath.c_str(), err.c_str());
    delete doc;
    loadFallbackDefaultProfile();
    return false;
  }

  snprintf(current_profile_name, sizeof(current_profile_name), "%s", path.c_str());
  setActiveProfileName(path.c_str());
  applyLayoutJsonDoc(*doc);
  delete doc;

  Serial.printf("{\"type\":\"profile_loaded\",\"name\":\"%s\",\"status\":\"ok\"}\n", path.c_str());
  return true;
}

void listProfiles() {
  if (!hal.storage) {
    Serial.println("{\"type\":\"error\",\"message\":\"Storage not available\"}");
    return;
  }

  File root = hal.storage->open("/");
  if (!root || !root.isDirectory()) {
    Serial.println("{\"type\":\"error\",\"message\":\"Failed to open root directory\"}");
    return;
  }

  DynamicJsonDocument doc(4096);
  doc["type"] = "profile_list";
  doc["active"] = current_profile_name;
  JsonArray profiles = doc.createNestedArray("profiles");

  File file = root.openNextFile();
  while (file) {
    if (!file.isDirectory()) {
      String name = String(file.name());
      while (name.startsWith("/")) name = name.substring(1);
      String lower = name;
      lower.toLowerCase();
      if (lower.endsWith(".json")) {
        profiles.add(name);
      }
    }
    file = root.openNextFile();
  }

  serializeJson(doc, Serial);
  Serial.println();
}

// File upload state
static File uploadFile;
static bool uploadActive = false;

static const char b64_table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
int base64_decode_chunk(const char *input, uint8_t *output) {
  int len = strlen(input);
  int out_idx = 0;
  for (int i = 0; i < len; i += 4) {
    uint32_t val = 0;
    int pad = 0;
    for (int j = 0; j < 4; j++) {
      char c = (i + j < len) ? input[i + j] : '=';
      if (c == '=') {
        pad++;
        val <<= 6;
      } else {
        const char *p = strchr(b64_table, c);
        val = (val << 6) | (p ? (p - b64_table) : 0);
      }
    }
    output[out_idx++] = (val >> 16) & 0xFF;
    if (pad < 2) output[out_idx++] = (val >> 8) & 0xFF;
    if (pad < 1) output[out_idx++] = val & 0xFF;
  }
  return out_idx;
}

// Process Received JSON Command
void processJsonCommand(const char* jsonStr) {
  DynamicJsonDocument doc(16384);
  DeserializationError err = deserializeJson(doc, jsonStr);
  if (err != DeserializationError::Ok) {
    Serial.printf("{\"type\":\"error\",\"code\":\"json_err\",\"detail\":\"%s\"}\n", err.c_str());
    return;
  }

  const char* cmd = doc["cmd"] | "";

  if (strcmp(cmd, "list_profiles") == 0) {
    listProfiles();
    return;
  } else if (strcmp(cmd, "load_profile") == 0) {
    const char* name = doc["name"] | doc["profile"] | "";
    if (strlen(name) > 0) {
      loadProfile(name);
    } else {
      Serial.println("{\"type\":\"error\",\"message\":\"Missing profile name\"}");
    }
    return;
  } else if (strcmp(cmd, "save_profile") == 0) {
    showSyncPopup("Saving Layout...");
    const char* name = doc["name"] | "layout.json";
    if (strlen(name) > 0 && hal.storage) {
      String cleanName = name;
      cleanName.trim();
      while (cleanName.startsWith("/")) cleanName = cleanName.substring(1);
      String fullPath = String("/") + cleanName;

      File f = hal.storage->open(fullPath, "w");
      if (f) {
        if (doc.containsKey("data")) {
          serializeJson(doc["data"], f);
        } else {
          DynamicJsonDocument profileData(8192);
          for (JsonPair kv : doc.as<JsonObject>()) {
            if (strcmp(kv.key().c_str(), "cmd") != 0 && strcmp(kv.key().c_str(), "name") != 0) {
              profileData[kv.key()] = kv.value();
            }
          }
          serializeJson(profileData, f);
        }
        f.flush();
        f.close();

        setActiveProfileName(cleanName.c_str());
        Serial.printf("{\"type\":\"profile_saved\",\"name\":\"%s\",\"status\":\"ok\"}\n", cleanName.c_str());
      } else {
        Serial.printf("{\"type\":\"error\",\"message\":\"Failed to write: %s\"}\n", fullPath.c_str());
      }
    }
    return;
  } else if (strcmp(cmd, "file_start") == 0) {
    showSyncPopup("Syncing Assets...");
    const char* name = doc["name"] | "";
    if (strlen(name) > 0) {
      String fullPath = String("/") + name;
      if (hal.storage) {
        uploadFile = hal.storage->open(fullPath, "w");
        uploadActive = (bool)uploadFile;
      }
      Serial.printf("{\"type\":\"file_start_ack\",\"name\":\"%s\",\"ready\":%s}\n", name, uploadActive ? "true" : "false");
    }
    return;
  } else if (strcmp(cmd, "file_chunk") == 0) {
    if (uploadActive && uploadFile) {
      const char* b64 = doc["data"] | "";
      if (strlen(b64) > 0) {
        uint8_t outBuf[1024];
        int decLen = base64_decode_chunk(b64, outBuf);
        if (decLen > 0) {
          uploadFile.write(outBuf, decLen);
        }
      }
    }
    return;
  } else if (strcmp(cmd, "file_end") == 0) {
    const char* name = doc["name"] | "";
    if (uploadActive && uploadFile) {
      uploadFile.flush();
      uploadFile.close();
      uploadActive = false;
      Serial.printf("{\"type\":\"file_done\",\"name\":\"%s\"}\n", name);
    }
    return;
  } else if (strcmp(cmd, "ping") == 0) {
    Serial.println("{\"type\":\"pong\",\"engine\":\"LVGL-v8.3.11\",\"board\":\"JC8048W550\"}");
  } else if (strcmp(cmd, "set_brightness") == 0) {
    int bVal = doc["brightness"] | 100;
    active_backlight_val = (uint8_t)constrain(bVal, 0, 100);
    if (!screensaver_active || screensaver_anim_mode != "screen_off") {
      hal.setBrightness(active_backlight_val);
    }
    Serial.printf("{\"type\":\"brightness_ack\",\"brightness\":%d}\n", active_backlight_val);
  } else if (strcmp(cmd, "set_volume") == 0) {
    int vVal = doc["volume"] | 80;
    audio_volume = constrain(vVal, 0, 100);
    Serial.printf("{\"type\":\"volume_ack\",\"volume\":%d}\n", audio_volume);
  } else if (strcmp(cmd, "set_screensaver") == 0) {
    int toVal = doc["timeout"] | 300;
    screensaver_timeout_sec = constrain(toVal, 0, 3600);
    if (doc.containsKey("anim")) {
      screensaver_anim_mode = String((const char*)(doc["anim"] | "bouncing_clock"));
      updateScreensaverTheme();
    }
    Serial.printf("{\"type\":\"screensaver_ack\",\"timeout\":%d,\"anim\":\"%s\"}\n", screensaver_timeout_sec, screensaver_anim_mode.c_str());
  } else if (strcmp(cmd, "sync_time") == 0) {
    uint32_t epoch = doc["epoch"] | 0;
    if (epoch > 0) {
      struct timeval tv = { (time_t)epoch, 0 };
      settimeofday(&tv, NULL);
    }
  } else if (strcmp(cmd, "sync_page") == 0) {
    bool silent = doc["silent"] | false;
    if (!silent) {
      showSyncPopup("Syncing Layout...");
    }
    int p = doc["page"] | 1;
    int tPages = doc["totalPages"] | 3;
    const char* pageTitle = doc["title"] | "";

    if (tPages >= 1 && tPages <= MAX_PAGES && tPages != total_pages) {
      total_pages = tPages;
      for (int i = 0; i < MAX_PAGES; i++) {
        if (i < total_pages) {
          lv_obj_clear_flag(tab_btns[i], LV_OBJ_FLAG_HIDDEN);
        } else {
          lv_obj_add_flag(tab_btns[i], LV_OBJ_FLAG_HIDDEN);
        }
      }
      switch_page(active_page < total_pages ? active_page : 0);
    }

    if (p >= 1 && p <= MAX_PAGES) {
      int pIdx = p - 1;

      // Update Tab Label
      if (strlen(pageTitle) > 0 && pIdx < MAX_PAGES) {
        lv_label_set_text(tab_btn_labels[pIdx], pageTitle);
        lv_obj_clear_flag(tab_btns[pIdx], LV_OBJ_FLAG_HIDDEN);
        lv_obj_center(tab_btn_labels[pIdx]);
        lv_obj_invalidate(tab_btns[pIdx]);
      }

      JsonArray btnArr = doc["buttons"].as<JsonArray>();
      int bIdx = 0;
      for (JsonObject bObj : btnArr) {
        if (bIdx < BUTTONS_PER_PAGE) {
          applyButtonData(grid_buttons[pIdx][bIdx], bObj);
        }
        bIdx++;
      }
      lv_obj_invalidate(tab_pages[pIdx]);
      if (pIdx == active_page) {
        lv_obj_invalidate(lv_scr_act());
        lv_refr_now(NULL);
      }

      Serial.printf("{\"type\":\"ack\",\"page\":%d,\"total\":%d}\n", p, total_pages);
    }
  } else if (strcmp(cmd, "widget_update") == 0) {
    int p = doc["page"] | 1;
    int b = doc["button"] | 1;
    const char* label = doc["label"] | "";

    if (p >= 1 && p <= MAX_PAGES && b >= 1 && b <= BUTTONS_PER_PAGE) {
      int pIdx = p - 1;
      int bIdx = b - 1;
      ButtonWidget &w = grid_buttons[pIdx][bIdx];
      if (strlen(label) > 0) {
        lv_label_set_text(w.label, label);
        lv_obj_clear_flag(w.label, LV_OBJ_FLAG_HIDDEN);
        lv_obj_center(w.label);
        lv_obj_invalidate(w.label);
        if (pIdx == active_page) {
          lv_obj_invalidate(w.btn);
        }
      }
    }
  }
}

// 100% Non-blocking Serial Line Buffer (Zero CPU Stall)
static char serial_rx_buf[16384];
static size_t serial_rx_idx = 0;

void handleIncomingSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serial_rx_idx > 0) {
        serial_rx_buf[serial_rx_idx] = '\0';
        String line = String(serial_rx_buf);
        line.trim();

        if (line.startsWith("LOAD_PROFILE:") || line.startsWith("LOAD_PROFILE ")) {
          int colonIdx = line.indexOf(':');
          if (colonIdx < 0) colonIdx = line.indexOf(' ');
          String prof = line.substring(colonIdx + 1);
          prof.trim();
          loadProfile(prof.c_str());
        } else if (line.equalsIgnoreCase("LIST_PROFILES")) {
          listProfiles();
        } else if (line.startsWith("{")) {
          processJsonCommand(serial_rx_buf);
        }
        serial_rx_idx = 0;
      }
    } else {
      if (serial_rx_idx < sizeof(serial_rx_buf) - 1) {
        serial_rx_buf[serial_rx_idx++] = c;
      }
    }
  }
}

void setup() {
  Serial.setRxBufferSize(8192);
  Serial.begin(115200);
  delay(100);

  // Initialize JC8048W550 Hardware (RGB Panel, Backlight PWM, GT911 Touch, LittleFS, SD)
  if (!hal.begin()) {
    Serial.println("{\"type\":\"error\",\"message\":\"JC8048W550 HAL init failed\"}");
  }

  // Initialize LVGL
  lv_init();

  // Allocate Full Frame Buffer in PSRAM
  buf1 = (lv_color_t *)ps_malloc(DISP_BUF_SIZE * sizeof(lv_color_t));
  if (!buf1) buf1 = (lv_color_t *)malloc(DISP_BUF_SIZE * sizeof(lv_color_t));

  lv_disp_draw_buf_init(&draw_buf, buf1, NULL, DISP_BUF_SIZE);

  // Register Display Driver
  static lv_disp_drv_t disp_drv;
  lv_disp_drv_init(&disp_drv);
  disp_drv.hor_res = JC_SCREEN_WIDTH;
  disp_drv.ver_res = JC_SCREEN_HEIGHT;
  disp_drv.flush_cb = my_disp_flush;
  disp_drv.draw_buf = &draw_buf;
  lv_disp_drv_register(&disp_drv);

  // Register Touchpad Driver
  static lv_indev_drv_t indev_drv;
  lv_indev_drv_init(&indev_drv);
  indev_drv.type = LV_INDEV_TYPE_POINTER;
  indev_drv.read_cb = my_touchpad_read;
  lv_indev_drv_register(&indev_drv);

  // Register File System Drivers for 'A' (Auto-detect), 'S' (SD), and 'L' (LittleFS)
  static lv_fs_drv_t fs_drv_a;
  lv_fs_drv_init(&fs_drv_a);
  fs_drv_a.letter = 'A';
  fs_drv_a.open_cb = fs_open_cb;
  fs_drv_a.close_cb = fs_close_cb;
  fs_drv_a.read_cb = fs_read_cb;
  fs_drv_a.seek_cb = fs_seek_cb;
  fs_drv_a.tell_cb = fs_tell_cb;
  lv_fs_drv_register(&fs_drv_a);

  static lv_fs_drv_t fs_drv_s;
  lv_fs_drv_init(&fs_drv_s);
  fs_drv_s.letter = 'S';
  fs_drv_s.open_cb = fs_open_cb;
  fs_drv_s.close_cb = fs_close_cb;
  fs_drv_s.read_cb = fs_read_cb;
  fs_drv_s.seek_cb = fs_seek_cb;
  fs_drv_s.tell_cb = fs_tell_cb;
  lv_fs_drv_register(&fs_drv_s);

  static lv_fs_drv_t fs_drv_l;
  lv_fs_drv_init(&fs_drv_l);
  fs_drv_l.letter = 'L';
  fs_drv_l.open_cb = fs_open_cb;
  fs_drv_l.close_cb = fs_close_cb;
  fs_drv_l.read_cb = fs_read_cb;
  fs_drv_l.seek_cb = fs_seek_cb;
  fs_drv_l.tell_cb = fs_tell_cb;
  lv_fs_drv_register(&fs_drv_l);

#if LV_USE_PNG
  lv_png_init();
#endif
#if LV_USE_BMP
  lv_bmp_init();
#endif
#if LV_USE_SJPG
  lv_split_jpeg_init();
#endif

  // Expand LVGL Image Decoder Cache to 16 slots for seamless multi-button graphics
  lv_img_cache_set_size(16);

  // Initialize I2S Audio Driver
  initI2SAudio();

  // Show Startup Screen immediately before any UI elements or layouts are constructed
  showStartupScreen();

  // Construct UI Skeleton
  build_ui();

  // Create Timer & Stopwatch Subsystem Periodic Task (250ms interval)
  lv_timer_create(timer_subsystem_tick_cb, 250, NULL);

  // Load Active Profile from SD card or fallback to Flash default
  String activeProf = getActiveProfileName();
  Serial.printf("[Boot] Active profile: %s\n", activeProf.c_str());
  loadProfile(activeProf.c_str());

  Serial.println("{\"type\":\"ready\",\"engine\":\"LVGL-v8.3.11\",\"board\":\"JC8048W550\"}");
}

void loop() {
  lv_timer_handler();
  handleIncomingSerial();

  // Screensaver Inactivity Check
  if (screensaver_timeout_sec > 0 && !screensaver_active) {
    uint32_t inactive_ms = lv_disp_get_inactive_time(NULL);
    if (inactive_ms >= (screensaver_timeout_sec * 1000UL)) {
      showScreensaver();
    }
  }

  // Tier 2: Turn Screen Off after 10 minutes of screensaver showing
  if (screensaver_active && !screen_sleep_active && screensaver_anim_mode != "screen_off") {
    if (millis() - screensaver_start_ms >= (10 * 60 * 1000UL)) { // 10 minutes (600,000ms)
      screen_sleep_active = true;
      hal.setBrightness(0);
      if (screensaver_timer) {
        lv_timer_pause(screensaver_timer);
      }
      Serial.println("{\"type\":\"screensaver\",\"state\":\"screen_off\"}");
    }
  }

  if (sync_popup_hide_time > 0 && millis() >= sync_popup_hide_time) {
    hideSyncPopup();
  }
  delay(5);
}
