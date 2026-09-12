const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const catalog = [
  'play_arrow', 'pause', 'play_pause', 'stop', 'skip_previous', 'skip_next', 'fast_forward', 'fast_rewind', 'replay', 'shuffle', 'repeat', 'equalizer', 'radio', 'movie', 'music_note', 'queue_music',
  'volume_up', 'volume_down', 'volume_mute', 'volume_off', 'mic', 'mic_off', 'headphones', 'hearing', 'speaker', 'surround_sound', 'spatial_audio', 'graphic_eq',
  'close', 'cancel', 'clear', 'highlight_off', 'check', 'done', 'check_circle', 'add', 'add_circle', 'remove', 'remove_circle',
  'content_cut', 'content_copy', 'content_paste', 'undo', 'redo', 'select_all', 'edit', 'delete', 'save', 'refresh', 'sync', 'find_in_page', 'text_fields', 'format_bold', 'format_italic', 'format_list_bulleted', 'format_quote',
  'language', 'home', 'public', 'open_in_new', 'tab', 'tab_close', 'link', 'link_off', 'bookmark', 'search', 'explore', 'arrow_back', 'arrow_forward', 'arrow_upward', 'arrow_downward', 'chevron_left', 'chevron_right', 'folder', 'folder_open',
  'settings', 'build', 'tune', 'terminal', 'code', 'lock', 'lock_open', 'power_settings_new', 'power_off', 'exit_to_app', 'logout', 'restart_alt', 'desktop_windows', 'laptop', 'smartphone', 'videocam', 'camera_alt', 'screenshot', 'bolt', 'rocket_launch',
  'timer', 'hourglass_top', 'hourglass_bottom', 'hourglass_empty', 'hourglass', 'schedule', 'calendar_month', 'calendar_today', 'notifications', 'notifications_active', 'sports_esports', 'shield', 'info', 'warning', 'help',
  'calculate', 'edit_note', 'palette', 'brush', 'monitoring', 'analytics', 'crop', 'description', 'apps', 'dashboard', 'widgets', 'mail', 'chat', 'storefront', 'travel_explore'
];

const codepointsPath = path.join(__dirname, 'firmware', 'MaterialSymbolsOutlined.codepoints');
const lines = fs.readFileSync(codepointsPath, 'utf8').split('\n');
const nameToHex = {};
const hexToName = {};

lines.forEach(line => {
  const parts = line.trim().split(/\s+/);
  if (parts.length === 2) {
    nameToHex[parts[0]] = parts[1];
    hexToName[parts[1]] = parts[0];
  }
});

const foundCodepoints = [];
const iconToUtf8Map = {};

catalog.forEach(name => {
  const hex = nameToHex[name];
  if (hex) {
    const cp = parseInt(hex, 16);
    foundCodepoints.push(cp);
    iconToUtf8Map[name] = cp;
  } else {
    console.warn(`Icon not found in codepoints: ${name}`);
  }
});

foundCodepoints.sort((a, b) => a - b);
const symbolsArg = foundCodepoints.map(cp => `0x${cp.toString(16)}`).join(',');

console.log(`Found ${foundCodepoints.length} / ${catalog.length} icons in Material Symbols codepoint table.`);

// Generate the C font for multiple sizes using lv_font_conv
const fontSizes = [20, 28, 36, 48];
const ttfPath = path.join(__dirname, 'firmware', 'MaterialSymbolsOutlined.ttf');

fontSizes.forEach(sz => {
  const outPath = path.join(__dirname, 'firmware', 'src', `lv_font_material_symbols_${sz}.c`);
  const cmd = `npx -y lv_font_conv --font "${ttfPath}" -r ${symbolsArg} --size ${sz} --format lvgl --bpp 4 --no-compress -o "${outPath}"`;
  console.log('Running:', cmd);
  execSync(cmd, { stdio: 'inherit' });

  // Ensure include is "lvgl.h" for Arduino PlatformIO builds
  let cContent = fs.readFileSync(outPath, 'utf8');
  cContent = cContent.replace(/#ifdef LV_LVGL_H_INCLUDE_SIMPLE[\s\S]*?#endif/, '#include "lvgl.h"');
  fs.writeFileSync(outPath, cContent);
});

// Also generate a C lookup table header: material_symbols_map.h
let headerContent = `// Auto-generated Material Symbols codepoints table
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
`;

Object.entries(iconToUtf8Map).forEach(([name, cp]) => {
  const code = cp;
  // Convert codepoint to UTF-8 hex escape
  const utf8Buf = Buffer.from(String.fromCodePoint(code));
  const escapeStr = Array.from(utf8Buf).map(b => '\\x' + b.toString(16).padStart(2, '0')).join('');
  headerContent += `  if (name == "${name}") return "${escapeStr}";\n`;
});

headerContent += `
  // Common aliases
  if (name == "arrow_left" || name == "west") return getMaterialSymbolUtf8("arrow_back");
  if (name == "arrow_right" || name == "east") return getMaterialSymbolUtf8("arrow_forward");
  if (name == "arrow_up" || name == "north") return getMaterialSymbolUtf8("arrow_upward");
  if (name == "arrow_down" || name == "south") return getMaterialSymbolUtf8("arrow_downward");
  if (name == "x" || name == "cross") return getMaterialSymbolUtf8("close");
  if (name == "tick") return getMaterialSymbolUtf8("check");
  if (name == "plus") return getMaterialSymbolUtf8("add");
  if (name == "minus") return getMaterialSymbolUtf8("remove");

  return "";
}
`;

fs.writeFileSync(path.join(__dirname, 'firmware', 'src', 'material_symbols_map.h'), headerContent);
console.log('Generated material_symbols_map.h and all font sizes successfully.');
