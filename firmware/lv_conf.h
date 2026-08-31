/**
 * @file lv_conf.h
 * Configuration file for v8.3.11
 */

#ifndef LV_CONF_H
#define LV_CONF_H

#include <stdint.h>

#define LV_COLOR_DEPTH 16
#define LV_COLOR_16_SWAP 0

#include <esp_heap_caps.h>
#include <esp32-hal-psram.h>

static inline void* lv_custom_alloc(size_t size) {
    void* ptr = ps_malloc(size);
    if (!ptr) ptr = malloc(size);
    return ptr;
}

static inline void lv_custom_free(void* ptr) {
    free(ptr);
}

static inline void* lv_custom_realloc(void* ptr, size_t size) {
    void* new_ptr = ps_realloc(ptr, size);
    if (!new_ptr) new_ptr = realloc(ptr, size);
    return new_ptr;
}

#define LV_MEM_CUSTOM 1
#if LV_MEM_CUSTOM
    #define LV_MEM_CUSTOM_INCLUDE "lv_conf.h"
    #define LV_MEM_CUSTOM_ALLOC   lv_custom_alloc
    #define LV_MEM_CUSTOM_FREE    lv_custom_free
    #define LV_MEM_CUSTOM_REALLOC lv_custom_realloc
#endif

#define LV_IMG_CACHE_DEF_SIZE 32

#define LV_TICK_CUSTOM 1
#if LV_TICK_CUSTOM
    #define LV_TICK_CUSTOM_INCLUDE "Arduino.h"
    #define LV_TICK_CUSTOM_SYS_TIME_EXPR (millis())
#endif

#define LV_DPI_DEF 130

#define LV_USE_LOG 0

#define LV_FONT_MONTSERRAT_14 1
#define LV_FONT_MONTSERRAT_16 1
#define LV_FONT_MONTSERRAT_18 1
#define LV_FONT_MONTSERRAT_20 1
#define LV_FONT_MONTSERRAT_22 1
#define LV_FONT_MONTSERRAT_24 1
#define LV_FONT_MONTSERRAT_26 1
#define LV_FONT_MONTSERRAT_28 1
#define LV_FONT_MONTSERRAT_30 1
#define LV_FONT_MONTSERRAT_32 1
#define LV_FONT_MONTSERRAT_34 1
#define LV_FONT_MONTSERRAT_36 1
#define LV_FONT_MONTSERRAT_38 1
#define LV_FONT_MONTSERRAT_40 1
#define LV_FONT_MONTSERRAT_42 1
#define LV_FONT_MONTSERRAT_44 1
#define LV_FONT_MONTSERRAT_46 1
#define LV_FONT_MONTSERRAT_48 1
#define LV_FONT_DEFAULT &lv_font_montserrat_24

#define LV_USE_THEME_DEFAULT 1
#define LV_THEME_DEFAULT_DARK 1
#define LV_THEME_DEFAULT_GROW 0
#define LV_THEME_DEFAULT_TRANSITION_TIME 0

#define LV_USE_FLEX 1
#define LV_USE_GRID 1

#define LV_USE_ARC 1
#define LV_USE_BAR 1
#define LV_USE_BTN 1
#define LV_USE_BTNMATRIX 1
#define LV_USE_CANVAS 1
#define LV_USE_CHECKBOX 1
#define LV_USE_DROPDOWN 1
#define LV_USE_IMG 1
#define LV_USE_LABEL 1
#define LV_USE_LINE 1
#define LV_USE_ROLLER 1
#define LV_USE_SLIDER 1
#define LV_USE_SWITCH 1
#define LV_USE_TEXTAREA 1
#define LV_USE_TABLE 1

#define LV_USE_ANIMIMG 1
#define LV_USE_CALENDAR 1
#define LV_USE_CHART 1
#define LV_USE_COLORWHEEL 1
#define LV_USE_IMGBTN 1
#define LV_USE_KEYBOARD 1
#define LV_USE_LED 1
#define LV_USE_LIST 1
#define LV_USE_MENU 1
#define LV_USE_METER 1
#define LV_USE_MSGBOX 1
#define LV_USE_SPAN 1
#define LV_USE_SPINBOX 1
#define LV_USE_SPINNER 1
#define LV_USE_TABVIEW 1
#define LV_USE_TILEVIEW 1
#define LV_USE_WIN 1

/* Extra Decoders & Image Processing */
#define LV_USE_PNG 1
#define LV_USE_BMP 1
#define LV_USE_SJPG 1

#endif /*LV_CONF_H*/
