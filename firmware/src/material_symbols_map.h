// Auto-generated Material Symbols codepoints table
#pragma once
#include <Arduino.h>
#include "lvgl.h"

LV_FONT_DECLARE(lv_font_material_symbols_20);
LV_FONT_DECLARE(lv_font_material_symbols_28);
LV_FONT_DECLARE(lv_font_material_symbols_36);
LV_FONT_DECLARE(lv_font_material_symbols_48);

inline const lv_font_t* getIconFontForSize(int size) {
  if (size <= 36) return &lv_font_material_symbols_28; // 28px - 36px (Extra Small / Small)
  if (size <= 52) return &lv_font_material_symbols_36; // 44px - 52px (Medium-Small / Medium)
  return &lv_font_material_symbols_48;                  // 60px - 112px (Standard / Normal Default / Large / Huge / Max) -> 48px!
}

inline const char* getMaterialSymbolUtf8(const String& name) {
  if (name == "play_arrow") return "\xee\x80\xb7";
  if (name == "pause") return "\xee\x80\xb4";
  if (name == "play_pause") return "\xef\x84\xb7";
  if (name == "stop") return "\xee\x81\x87";
  if (name == "skip_previous") return "\xee\x81\x85";
  if (name == "skip_next") return "\xee\x81\x84";
  if (name == "fast_forward") return "\xee\x80\x9f";
  if (name == "fast_rewind") return "\xee\x80\xa0";
  if (name == "replay") return "\xee\x81\x82";
  if (name == "shuffle") return "\xee\x81\x83";
  if (name == "repeat") return "\xee\x81\x80";
  if (name == "equalizer") return "\xee\x80\x9d";
  if (name == "radio") return "\xee\x80\xbe";
  if (name == "movie") return "\xee\x9a\x84";
  if (name == "music_note") return "\xee\x90\x85";
  if (name == "queue_music") return "\xee\x80\xbd";
  if (name == "volume_up") return "\xee\x81\x90";
  if (name == "volume_down") return "\xee\x81\x8d";
  if (name == "volume_mute") return "\xee\x81\x8e";
  if (name == "volume_off") return "\xee\x81\x8f";
  if (name == "mic") return "\xee\x8c\x9d";
  if (name == "mic_off") return "\xee\x80\xab";
  if (name == "headphones") return "\xef\x80\x9f";
  if (name == "hearing") return "\xee\x80\xa3";
  if (name == "speaker") return "\xee\x8c\xad";
  if (name == "surround_sound") return "\xee\x81\x89";
  if (name == "spatial_audio") return "\xee\xaf\xab";
  if (name == "graphic_eq") return "\xee\x86\xb8";
  if (name == "close") return "\xee\x97\x8d";
  if (name == "cancel") return "\xee\xa2\x88";
  if (name == "clear") return "\xee\x97\x8d";
  if (name == "highlight_off") return "\xee\xa2\x88";
  if (name == "check") return "\xee\x99\xa8";
  if (name == "done") return "\xee\xa1\xb6";
  if (name == "check_circle") return "\xef\x82\xbe";
  if (name == "add") return "\xee\x85\x85";
  if (name == "add_circle") return "\xee\xa6\x90";
  if (name == "remove") return "\xee\x85\x9b";
  if (name == "remove_circle") return "\xef\x82\x8f";
  if (name == "content_cut") return "\xee\x85\x8e";
  if (name == "content_copy") return "\xee\x85\x8d";
  if (name == "content_paste") return "\xee\x85\x8f";
  if (name == "undo") return "\xee\x85\xa6";
  if (name == "redo") return "\xee\x85\x9a";
  if (name == "select_all") return "\xee\x85\xa2";
  if (name == "edit") return "\xef\x82\x97";
  if (name == "delete") return "\xee\xa4\xae";
  if (name == "save") return "\xee\x85\xa1";
  if (name == "refresh") return "\xee\x97\x95";
  if (name == "sync") return "\xee\x98\xa7";
  if (name == "find_in_page") return "\xee\xa2\x80";
  if (name == "text_fields") return "\xee\x89\xa2";
  if (name == "format_bold") return "\xee\x88\xb8";
  if (name == "format_italic") return "\xee\x88\xbf";
  if (name == "format_list_bulleted") return "\xee\x89\x81";
  if (name == "format_quote") return "\xee\x89\x84";
  if (name == "language") return "\xee\xa8\x87";
  if (name == "home") return "\xee\xa6\xb2";
  if (name == "public") return "\xee\xa0\x8b";
  if (name == "open_in_new") return "\xee\xa2\x9e";
  if (name == "tab") return "\xee\xa3\x98";
  if (name == "tab_close") return "\xef\x9d\x85";
  if (name == "link") return "\xee\x89\x90";
  if (name == "link_off") return "\xee\x85\xaf";
  if (name == "bookmark") return "\xee\xa3\xa7";
  if (name == "search") return "\xee\xbd\xba";
  if (name == "explore") return "\xee\xa1\xba";
  if (name == "arrow_back") return "\xee\x97\x84";
  if (name == "arrow_forward") return "\xee\x97\x88";
  if (name == "arrow_upward") return "\xee\x97\x98";
  if (name == "arrow_downward") return "\xee\x97\x9b";
  if (name == "folder") return "\xee\x8b\x87";
  if (name == "folder_open") return "\xee\x8b\x88";
  if (name == "settings") return "\xee\xa2\xb8";
  if (name == "build") return "\xef\xa3\x8d";
  if (name == "tune") return "\xee\x90\xa9";
  if (name == "terminal") return "\xee\xae\x8e";
  if (name == "code") return "\xee\xa1\xaf";
  if (name == "lock") return "\xee\xa2\x99";
  if (name == "lock_open") return "\xee\xa2\x98";
  if (name == "power_settings_new") return "\xef\xa3\x87";
  if (name == "power_off") return "\xee\x99\x86";
  if (name == "exit_to_app") return "\xee\xa1\xb9";
  if (name == "logout") return "\xee\xa6\xba";
  if (name == "restart_alt") return "\xef\x81\x93";
  if (name == "desktop_windows") return "\xee\x8c\x8c";
  if (name == "laptop") return "\xee\x8c\x9e";
  if (name == "smartphone") return "\xee\x9e\xba";
  if (name == "videocam") return "\xee\x81\x8b";
  if (name == "camera_alt") return "\xee\x90\x92";
  if (name == "screenshot") return "\xef\x81\x96";
  if (name == "bolt") return "\xee\xa8\x8b";
  if (name == "rocket_launch") return "\xee\xae\x9b";
  if (name == "timer") return "\xee\x90\xa5";
  if (name == "hourglass_top") return "\xee\xa9\x9b";
  if (name == "hourglass_bottom") return "\xee\xa9\x9c";
  if (name == "hourglass_empty") return "\xee\xa2\x8b";
  if (name == "hourglass") return "\xee\xaf\xbf";
  if (name == "schedule") return "\xee\xbf\x96";
  if (name == "calendar_month") return "\xee\xaf\x8c";
  if (name == "calendar_today") return "\xee\xa4\xb5";
  if (name == "notifications") return "\xee\x9f\xb5";
  if (name == "notifications_active") return "\xee\x9f\xb7";
  if (name == "sports_esports") return "\xee\xa8\xa8";
  if (name == "shield") return "\xee\xa7\xa0";
  if (name == "info") return "\xee\xa2\x8e";
  if (name == "warning") return "\xef\x82\x83";
  if (name == "help") return "\xee\xa3\xbd";
  if (name == "calculate") return "\xee\xa9\x9f";
  if (name == "edit_note") return "\xee\x9d\x85";
  if (name == "palette") return "\xee\x90\x8a";
  if (name == "brush") return "\xee\x8e\xae";
  if (name == "monitoring") return "\xef\x86\x90";
  if (name == "analytics") return "\xee\xbc\xbe";
  if (name == "crop") return "\xee\x8e\xbe";
  if (name == "description") return "\xee\xa1\xb3";
  if (name == "apps") return "\xee\x97\x83";
  if (name == "dashboard") return "\xee\xa1\xb1";
  if (name == "widgets") return "\xee\x86\xbd";
  if (name == "mail") return "\xee\x85\x99";
  if (name == "chat") return "\xee\x83\x89";
  if (name == "storefront") return "\xee\xa8\x92";
  if (name == "travel_explore") return "\xee\x8b\x9b";

  // Common aliases
  if (name == "arrow_left" || name == "west") return getMaterialSymbolUtf8("arrow_back");
  if (name == "arrow_right" || name == "east") return getMaterialSymbolUtf8("arrow_forward");
  if (name == "arrow_up" || name == "north") return getMaterialSymbolUtf8("arrow_upward");
  if (name == "arrow_down" || name == "south") return getMaterialSymbolUtf8("arrow_downward");
  if (name == "chevron_left") return getMaterialSymbolUtf8("arrow_back");
  if (name == "chevron_right") return getMaterialSymbolUtf8("arrow_forward");
  if (name == "x" || name == "cross") return getMaterialSymbolUtf8("close");
  if (name == "tick") return getMaterialSymbolUtf8("check");
  if (name == "plus") return getMaterialSymbolUtf8("add");
  if (name == "minus") return getMaterialSymbolUtf8("remove");

  return "";
}
