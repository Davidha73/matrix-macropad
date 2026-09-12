#pragma once

#include <Arduino.h>

enum AncsCategory {
  ANCS_CAT_OTHER = 0,
  ANCS_CAT_INCOMING_CALL = 1,
  ANCS_CAT_MISSED_CALL = 2,
  ANCS_CAT_VOICEMAIL = 3,
  ANCS_CAT_SOCIAL = 4,
  ANCS_CAT_SCHEDULE = 5,
  ANCS_CAT_EMAIL = 6,
  ANCS_CAT_NEWS = 7,
  ANCS_CAT_HEALTH = 8,
  ANCS_CAT_FINANCE = 9,
  ANCS_CAT_LOCATION = 10,
  ANCS_CAT_ENTERTAINMENT = 11
};

struct AncsNotification {
  uint32_t uid;
  AncsCategory category;
  char app_id[32];
  char title[64];
  char message[160];
  uint32_t received_ms;
  bool is_call;
  bool is_removed;
  bool is_preexisting;
  bool is_silent;
};

struct AncsAppMeta {
  const char *appName;
  const char *iconSym;
  uint32_t accentColor;
};

// Initialize BLE stack, advertising, and ANCS service solicitation
void matrix_ancs_init(const char *devName = "Matrix Macropad BLE");

// Periodic maintenance loop for connection monitoring and queue processing
void matrix_ancs_loop();

// Check if currently bonded and connected to an iPhone
bool matrix_ancs_is_connected();

// Check if there are pending notifications in the thread-safe queue
bool matrix_ancs_has_notification();

// Dequeue the oldest notification for UI presentation
bool matrix_ancs_pop_notification(AncsNotification *outNotif);
