#include "matrix_ancs.h"

// Prevent Arduino core from releasing Bluetooth controller memory during initArduino()
extern "C" bool btInUse(void) {
  return true;
}

#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wmacro-redefined"
#include <NimBLEDevice.h>
#pragma GCC diagnostic pop
#include <host/ble_gatt.h>
#include <host/ble_hs.h>
#include <os/os_mbuf.h>

// --- ANCS 128-bit UUIDs (Little-Endian for NimBLE C APIs) ---
// Service: 7905F431-B5CE-4E99-A40F-4B1E122D00D0
static const ble_uuid128_t ANCS_SVC_UUID =
  BLE_UUID128_INIT(0xd0, 0x00, 0x2d, 0x12, 0x1e, 0x4b, 0x0f, 0xa4, 0x99, 0x4e, 0xce, 0xb5, 0x31, 0xf4, 0x05, 0x79);

// Notification Source: 9FBF120D-6301-42D9-8C58-25E699A21DBD
static const ble_uuid128_t ANCS_NOTIF_SRC_UUID =
  BLE_UUID128_INIT(0xbd, 0x1d, 0xa2, 0x99, 0xe6, 0x25, 0x58, 0x8c, 0xd9, 0x42, 0x01, 0x63, 0x0d, 0x12, 0xbf, 0x9f);

// Data Source: 22EAC6E9-24D6-4BB5-BE44-B36ACE7C7BFB
static const ble_uuid128_t ANCS_DATA_SRC_UUID =
  BLE_UUID128_INIT(0xfb, 0x7b, 0x7c, 0xce, 0x6a, 0xb3, 0x44, 0xbe, 0xb5, 0x4b, 0xd6, 0x24, 0xe9, 0xc6, 0xea, 0x22);

// Control Point: 69D1D8F3-45E1-49A8-9821-9BBDFDAAD9D9
static const ble_uuid128_t ANCS_CTRL_PT_UUID =
  BLE_UUID128_INIT(0xd9, 0xd9, 0xaa, 0xfd, 0xbd, 0x9b, 0x21, 0x98, 0xa8, 0x49, 0xe1, 0x45, 0xf3, 0xd8, 0xd1, 0x69);

// --- Notification Queue (Circular Buffer) ---
#define NOTIF_QUEUE_SIZE 8
static AncsNotification s_notif_queue[NOTIF_QUEUE_SIZE];
static volatile int s_queue_head = 0;
static volatile int s_queue_tail = 0;
static portMUX_TYPE s_queue_mux = portMUX_INITIALIZER_UNLOCKED;

// --- State Variables ---
static NimBLEServer *s_pServer = nullptr;
static bool s_connected = false;
static bool s_ancs_ready = false;
static uint16_t s_conn_handle = BLE_HS_CONN_HANDLE_NONE;

static uint16_t s_notif_src_handle = 0;
static uint16_t s_data_src_handle = 0;
static uint16_t s_ctrl_pt_handle = 0;

static uint8_t s_data_buf[512];
static size_t s_data_len = 0;
static uint32_t s_current_uid = 0;
static AncsCategory s_current_category = ANCS_CAT_OTHER;
static bool s_current_is_call = false;
static bool s_current_is_preexisting = false;
static bool s_current_is_silent = false;

// Pending attribute request
static volatile uint32_t s_pending_req_uid = 0;

// Forward declarations
static void discoverAncsServices();
static void requestNotificationAttributes(uint32_t uid);
static void parseDataSourceStream();
static int customGapHandler(struct ble_gap_event *event, void *arg);

static void sanitizeAncsText(char *str) {
  if (!str) return;
  char *src = str;
  char *dst = str;

  while (*src) {
    uint8_t b1 = (uint8_t)*src;
    if (b1 == 0xE2 && (uint8_t)*(src + 1) == 0x80) {
      uint8_t b3 = (uint8_t)*(src + 2);
      if (b3 == 0x98 || b3 == 0x99 || b3 == 0x9A || b3 == 0x9B) {
        // Single quotation marks / apostrophes: ‘ ’ ‚ ‛ -> '
        *dst++ = '\'';
        src += 3;
      } else if (b3 == 0x9C || b3 == 0x9D || b3 == 0x9E || b3 == 0x9F) {
        // Double quotation marks: “ ” „ ‟ -> "
        *dst++ = '"';
        src += 3;
      } else if (b3 == 0x93 || b3 == 0x94) {
        // En dash, em dash: – — -> -
        *dst++ = '-';
        src += 3;
      } else if (b3 == 0xA6) {
        // Horizontal ellipsis: … -> ...
        *dst++ = '.';
        *dst++ = '.';
        *dst++ = '.';
        src += 3;
      } else {
        *dst++ = *src++;
      }
    } else if (b1 == 0xC2 && (uint8_t)*(src + 1) == 0xA0) {
      // Non-breaking space -> regular space
      *dst++ = ' ';
      src += 2;
    } else if (b1 == 0xC2 && (uint8_t)*(src + 1) == 0xB4) {
      // Acute accent ´ -> '
      *dst++ = '\'';
      src += 2;
    } else if (b1 == '`') {
      *dst++ = '\'';
      src++;
    } else {
      *dst++ = *src++;
    }
  }
  *dst = '\0';
}

// --- Queue Functions ---
static bool pushNotification(const AncsNotification &notif) {
  AncsNotification cleanNotif = notif;
  sanitizeAncsText(cleanNotif.title);
  sanitizeAncsText(cleanNotif.message);

  portENTER_CRITICAL(&s_queue_mux);
  int next = (s_queue_head + 1) % NOTIF_QUEUE_SIZE;
  if (next == s_queue_tail) {
    s_queue_tail = (s_queue_tail + 1) % NOTIF_QUEUE_SIZE;
  }
  s_notif_queue[s_queue_head] = cleanNotif;
  s_queue_head = next;
  portEXIT_CRITICAL(&s_queue_mux);
  return true;
}

bool matrix_ancs_has_notification() {
  portENTER_CRITICAL(&s_queue_mux);
  bool has = (s_queue_head != s_queue_tail);
  portEXIT_CRITICAL(&s_queue_mux);
  return has;
}

bool matrix_ancs_pop_notification(AncsNotification *outNotif) {
  if (!outNotif) return false;
  portENTER_CRITICAL(&s_queue_mux);
  if (s_queue_head == s_queue_tail) {
    portEXIT_CRITICAL(&s_queue_mux);
    return false;
  }
  *outNotif = s_notif_queue[s_queue_tail];
  s_queue_tail = (s_queue_tail + 1) % NOTIF_QUEUE_SIZE;
  portEXIT_CRITICAL(&s_queue_mux);
  return true;
}

bool matrix_ancs_is_connected() {
  return s_connected && s_ancs_ready;
}

// Request Title, Subtitle, Message, and AppID from Control Point
// Attribute request callback
static int onControlPointWritten(uint16_t conn_handle, const struct ble_gatt_error *error, struct ble_gatt_attr *attr, void *arg) {
  Serial.printf("[ANCS] Control Point write status=%d\n", error->status);
  return 0;
}

// Request Title, Subtitle, Message, and AppID from Control Point
static void requestNotificationAttributes(uint32_t uid) {
  if (s_conn_handle == BLE_HS_CONN_HANDLE_NONE || s_ctrl_pt_handle == 0) {
    Serial.printf("[ANCS] Cannot req attr: conn=%d, ctrl=%d\n", s_conn_handle, s_ctrl_pt_handle);
    return;
  }

  uint8_t cmd[32];
  int idx = 0;
  cmd[idx++] = 0; // CommandIDGetNotificationAttributes
  cmd[idx++] = uid & 0xFF;
  cmd[idx++] = (uid >> 8) & 0xFF;
  cmd[idx++] = (uid >> 16) & 0xFF;
  cmd[idx++] = (uid >> 24) & 0xFF;

  // Attribute 0: AppIdentifier
  cmd[idx++] = 0;

  // Attribute 1: Title (max 64 bytes)
  cmd[idx++] = 1;
  cmd[idx++] = 64;
  cmd[idx++] = 0;

  // Attribute 2: Subtitle (max 64 bytes)
  cmd[idx++] = 2;
  cmd[idx++] = 64;
  cmd[idx++] = 0;

  // Attribute 3: Message (max 140 bytes)
  cmd[idx++] = 3;
  cmd[idx++] = 140;
  cmd[idx++] = 0;

  int rc = ble_gattc_write_flat(s_conn_handle, s_ctrl_pt_handle, cmd, idx, onControlPointWritten, NULL);
  Serial.printf("[ANCS] Req attr uid=%u written to ctrl=%d, rc=%d\n", uid, s_ctrl_pt_handle, rc);
}

// Parse accumulated stream from Data Source
static void parseDataSourceStream() {
  if (s_data_len < 5) return;

  uint32_t respUid = (uint32_t)s_data_buf[1] | ((uint32_t)s_data_buf[2] << 8) | ((uint32_t)s_data_buf[3] << 16) | ((uint32_t)s_data_buf[4] << 24);
  Serial.printf("[ANCS] parse stream: data_len=%u, respUid=%u, currentUid=%u\n", (unsigned)s_data_len, respUid, s_current_uid);
  if (respUid != s_current_uid) return;

  AncsNotification notif;
  memset(&notif, 0, sizeof(notif));
  notif.uid = s_current_uid;
  notif.category = s_current_category;
  notif.is_call = s_current_is_call;
  notif.received_ms = millis();

  size_t offset = 5;

  while (offset + 3 <= s_data_len) {
    uint8_t attrId = s_data_buf[offset++];
    uint16_t attrLen = (uint16_t)s_data_buf[offset] | ((uint16_t)s_data_buf[offset + 1] << 8);
    offset += 2;

    if (offset + attrLen > s_data_len) {
      return; // Wait for next packet
    }

    if (attrId == 0) { // AppIdentifier
      size_t copyLen = (attrLen < sizeof(notif.app_id) - 1) ? attrLen : sizeof(notif.app_id) - 1;
      memcpy(notif.app_id, s_data_buf + offset, copyLen);
      notif.app_id[copyLen] = '\0';
    } else if (attrId == 1) { // Title
      size_t copyLen = (attrLen < sizeof(notif.title) - 1) ? attrLen : sizeof(notif.title) - 1;
      memcpy(notif.title, s_data_buf + offset, copyLen);
      notif.title[copyLen] = '\0';
    } else if (attrId == 2) { // Subtitle
      if (strlen(notif.title) == 0 && attrLen > 0) {
        size_t copyLen = (attrLen < sizeof(notif.title) - 1) ? attrLen : sizeof(notif.title) - 1;
        memcpy(notif.title, s_data_buf + offset, copyLen);
        notif.title[copyLen] = '\0';
      }
    } else if (attrId == 3) { // Message
      size_t copyLen = (attrLen < sizeof(notif.message) - 1) ? attrLen : sizeof(notif.message) - 1;
      memcpy(notif.message, s_data_buf + offset, copyLen);
      notif.message[copyLen] = '\0';
    }

    offset += attrLen;
  }

  Serial.printf("[ANCS] Stream parsed: title='%s', msg='%s'\n", notif.title, notif.message);
  if (strlen(notif.title) > 0 || strlen(notif.message) > 0 || notif.is_call) {
    notif.is_preexisting = s_current_is_preexisting;
    notif.is_silent = s_current_is_silent;
    pushNotification(notif);
    s_data_len = 0;
  }
}

// Sequential CCCD write callbacks
static int onDataCccdWritten(uint16_t conn_handle, const struct ble_gatt_error *error, struct ble_gatt_attr *attr, void *arg) {
  Serial.printf("[ANCS] Data Source CCCD write result: status=%d\n", error->status);
  if (error->status == 0) {
    s_ancs_ready = true;
    Serial.println("[ANCS] Fully subscribed to Notification Source and Data Source!");
  }
  return 0;
}

static int onNotifCccdWritten(uint16_t conn_handle, const struct ble_gatt_error *error, struct ble_gatt_attr *attr, void *arg) {
  Serial.printf("[ANCS] Notif Source CCCD write result: status=%d\n", error->status);
  if (error->status == 0 && s_data_src_handle > 0) {
    static uint8_t cccd_enable[2] = {0x01, 0x00};
    int rc = ble_gattc_write_flat(conn_handle, s_data_src_handle + 1, cccd_enable, sizeof(cccd_enable), onDataCccdWritten, NULL);
    Serial.printf("[ANCS] Initiated Data Source subscription, rc=%d\n", rc);
  }
  return 0;
}

// GATT Discovery Callbacks
static int ancsChrDiscoveredCb(uint16_t conn_handle, const struct ble_gatt_error *error, const struct ble_gatt_chr *chr, void *arg) {
  Serial.printf("[ANCS] Chr cb: status=%d, chr=%p\n", error->status, chr);
  if (error->status == 0 && chr != NULL) {
    char uuid_str[BLE_UUID_STR_LEN];
    ble_uuid_to_str(&chr->uuid.u, uuid_str);
    Serial.printf("[ANCS] Discovered chr UUID: %s, handle: %d\n", uuid_str, chr->val_handle);
    if (ble_uuid_cmp(&chr->uuid.u, &ANCS_NOTIF_SRC_UUID.u) == 0) {
      s_notif_src_handle = chr->val_handle;
    } else if (ble_uuid_cmp(&chr->uuid.u, &ANCS_DATA_SRC_UUID.u) == 0) {
      s_data_src_handle = chr->val_handle;
    } else if (ble_uuid_cmp(&chr->uuid.u, &ANCS_CTRL_PT_UUID.u) == 0) {
      s_ctrl_pt_handle = chr->val_handle;
    }
  } else if (error->status == BLE_HS_EDONE) {
    Serial.printf("[ANCS] Chr discovery complete. Handles -> Notif: %d, Data: %d, Ctrl: %d\n", s_notif_src_handle, s_data_src_handle, s_ctrl_pt_handle);
    if (s_notif_src_handle > 0 && s_data_src_handle > 0 && s_ctrl_pt_handle > 0) {
      static uint8_t cccd_enable[2] = {0x01, 0x00};
      int rc = ble_gattc_write_flat(conn_handle, s_notif_src_handle + 1, cccd_enable, sizeof(cccd_enable), onNotifCccdWritten, NULL);
      Serial.printf("[ANCS] Initiated Notification Source subscription, rc=%d\n", rc);
    }
  }
  return 0;
}

static int ancsSvcDiscoveredCb(uint16_t conn_handle, const struct ble_gatt_error *error, const struct ble_gatt_svc *service, void *arg) {
  Serial.printf("[ANCS] Svc cb: status=%d, svc=%p\n", error->status, service);
  if (error->status == 0 && service != NULL) {
    Serial.printf("[ANCS] ANCS service found! Handles: %d to %d\n", service->start_handle, service->end_handle);
    int rc = ble_gattc_disc_all_chrs(conn_handle, service->start_handle, service->end_handle, ancsChrDiscoveredCb, NULL);
    Serial.printf("[ANCS] ble_gattc_disc_all_chrs rc=%d\n", rc);
  }
  return 0;
}

static void discoverAncsServices() {
  if (s_conn_handle == BLE_HS_CONN_HANDLE_NONE) return;
  Serial.printf("[ANCS] Discovering ANCS service on handle %d...\n", s_conn_handle);
  int rc = ble_gattc_disc_svc_by_uuid(s_conn_handle, &ANCS_SVC_UUID.u, ancsSvcDiscoveredCb, NULL);
  Serial.printf("[ANCS] ble_gattc_disc_svc_by_uuid rc=%d\n", rc);
}

// --- Custom GAP Event Handler ---
static int customGapHandler(struct ble_gap_event *event, void *arg) {
  Serial.printf("[GAP] Event type=%d\n", event->type);
  switch (event->type) {
    case BLE_GAP_EVENT_NOTIFY_RX: {
      uint16_t handle = event->notify_rx.attr_handle;
      uint16_t len = OS_MBUF_PKTLEN(event->notify_rx.om);
      Serial.printf("[ANCS-RX] handle=%d, len=%d (notif_src=%d, data_src=%d)\n", handle, len, s_notif_src_handle, s_data_src_handle);

      if (handle == s_notif_src_handle && len >= 8) {
        uint8_t notifData[8];
        os_mbuf_copydata(event->notify_rx.om, 0, 8, notifData);

        uint8_t eventId = notifData[0];
        uint8_t eventFlags = notifData[1];
        uint8_t categoryId = notifData[2];
        uint32_t uid = (uint32_t)notifData[4] | ((uint32_t)notifData[5] << 8) | ((uint32_t)notifData[6] << 16) | ((uint32_t)notifData[7] << 24);
        Serial.printf("[ANCS-RX] NotifSource: eventId=%d, flags=0x%02X, cat=%d, uid=%u\n", eventId, eventFlags, categoryId, uid);

        if (eventId == 0 || eventId == 1) { // Added or Modified
          s_current_uid = uid;
          s_current_category = (categoryId <= 11) ? (AncsCategory)categoryId : ANCS_CAT_OTHER;
          s_current_is_call = (categoryId == 1);
          s_current_is_preexisting = (eventFlags & 0x04) != 0;
          s_current_is_silent = (eventFlags & 0x01) != 0;
          s_data_len = 0;

          // Queue attribute request for the main loop
          s_pending_req_uid = uid;
        } else if (eventId == 2) { // Removed / Dismissed on iPhone
          if (s_current_uid == uid) {
            s_pending_req_uid = 0;
          }
          AncsNotification removedNotif;
          memset(&removedNotif, 0, sizeof(removedNotif));
          removedNotif.uid = uid;
          removedNotif.is_removed = true;
          pushNotification(removedNotif);
        }
      } else if (handle == s_data_src_handle && len > 0) {
        Serial.printf("[ANCS-RX] DataSource chunk: len=%d\n", len);
        if (s_data_len + len <= sizeof(s_data_buf)) {
          os_mbuf_copydata(event->notify_rx.om, 0, len, s_data_buf + s_data_len);
          s_data_len += len;
          parseDataSourceStream();
        }
      }
      break;
    }
    case BLE_GAP_EVENT_ENC_CHANGE: {
      if (event->enc_change.status == 0) {
        Serial.println("[ANCS] Encryption enabled. Ready for service discovery.");
        discoverAncsServices();
      }
      break;
    }
    default:
      break;
  }
  return 0;
}

// --- Server Callbacks ---
class MatrixServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer *pServer, ble_gap_conn_desc *desc) override {
    Serial.printf("[BLE] iPhone connected. Handle: %d\n", desc->conn_handle);
    s_conn_handle = desc->conn_handle;
    s_connected = true;
    s_ancs_ready = false;

    // Trigger encryption / authentication
    NimBLEDevice::startSecurity(desc->conn_handle);
  }

  void onDisconnect(NimBLEServer *pServer) override {
    Serial.println("[BLE] iPhone disconnected. Restarting advertising...");
    s_connected = false;
    s_ancs_ready = false;
    s_conn_handle = BLE_HS_CONN_HANDLE_NONE;
    s_notif_src_handle = 0;
    s_data_src_handle = 0;
    s_ctrl_pt_handle = 0;

    NimBLEDevice::startAdvertising();
  }

  void onAuthenticationComplete(ble_gap_conn_desc *desc) override {
    Serial.println("[ANCS] Authentication complete.");
    discoverAncsServices();
  }
};

void matrix_ancs_init(const char *devName) {
  const char *name = (devName && strlen(devName) > 0 && strlen(devName) <= 12) ? devName : "MatrixPad";
  Serial.println("[ANCS] Initializing NimBLE device...");
  NimBLEDevice::init(name);

  // Security Configuration for iOS Bonding & Authorization (Just Works without MITM)
  Serial.println("[ANCS] Setting security parameters...");
  NimBLEDevice::setSecurityAuth(BLE_SM_PAIR_AUTHREQ_BOND | BLE_SM_PAIR_AUTHREQ_SC);
  NimBLEDevice::setSecurityIOCap(BLE_HS_IO_NO_INPUT_OUTPUT);
  NimBLEDevice::setSecurityInitKey(BLE_SM_PAIR_KEY_DIST_ENC | BLE_SM_PAIR_KEY_DIST_ID);
  NimBLEDevice::setSecurityRespKey(BLE_SM_PAIR_KEY_DIST_ENC | BLE_SM_PAIR_KEY_DIST_ID);
  NimBLEDevice::setCustomGapHandler(customGapHandler);

  s_pServer = NimBLEDevice::createServer();
  s_pServer->setCallbacks(new MatrixServerCallbacks());

  // 1. Device Information Service (0x180A) with PnP ID (0x2A50)
  NimBLEService *pDevInfo = s_pServer->createService("180A");
  NimBLECharacteristic *pPnpId = pDevInfo->createCharacteristic("2A50", NIMBLE_PROPERTY::READ);
  const uint8_t pnpData[] = {0x02, 0x02, 0x0E, 0x00, 0x00, 0x01, 0x00};
  pPnpId->setValue(pnpData, sizeof(pnpData));
  pDevInfo->start();

  // 2. Battery Service (0x180F) with encrypted read to trigger iOS pairing
  NimBLEService *pBatService = s_pServer->createService("180F");
  NimBLECharacteristic *pBatLevel = pBatService->createCharacteristic("2A19", NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::READ_ENC);
  uint8_t batVal = 100;
  pBatLevel->setValue(&batVal, 1);
  pBatService->start();

  // 3. Human Interface Device Service (0x1812) with full Report Map for native iOS discovery
  NimBLEService *pHidService = s_pServer->createService("1812");

  // Protocol Mode (0x2A4E)
  NimBLECharacteristic *pProtoMode = pHidService->createCharacteristic("2A4E", NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE_NR);
  uint8_t protoMode = 1; // Report Mode
  pProtoMode->setValue(&protoMode, 1);

  // HID Information (0x2A4A)
  NimBLECharacteristic *pHidInfo = pHidService->createCharacteristic("2A4A", NIMBLE_PROPERTY::READ);
  const uint8_t hidInfoData[] = {0x11, 0x01, 0x00, 0x02}; // bcdHID 1.11, country 0, normally connectable
  pHidInfo->setValue(hidInfoData, sizeof(hidInfoData));

  // HID Control Point (0x2A4C)
  pHidService->createCharacteristic("2A4C", NIMBLE_PROPERTY::WRITE_NR);

  // Report Map (0x2A4B) - 63-byte standard USB HID keyboard descriptor
  static const uint8_t hidReportMap[] = {
    0x05, 0x01, 0x09, 0x06, 0xA1, 0x01, 0x05, 0x07,
    0x19, 0xE0, 0x29, 0xE7, 0x15, 0x00, 0x25, 0x01,
    0x75, 0x01, 0x95, 0x08, 0x81, 0x02, 0x95, 0x01,
    0x75, 0x08, 0x81, 0x01, 0x95, 0x05, 0x75, 0x01,
    0x05, 0x08, 0x19, 0x01, 0x29, 0x05, 0x91, 0x02,
    0x95, 0x01, 0x75, 0x03, 0x91, 0x01, 0x95, 0x06,
    0x75, 0x08, 0x15, 0x00, 0x25, 0x65, 0x05, 0x07,
    0x19, 0x00, 0x29, 0x65, 0x81, 0x00, 0xC0
  };
  NimBLECharacteristic *pReportMap = pHidService->createCharacteristic("2A4B", NIMBLE_PROPERTY::READ);
  pReportMap->setValue(hidReportMap, sizeof(hidReportMap));

  // Input Report (0x2A4D) with encrypted read
  NimBLECharacteristic *pInputReport = pHidService->createCharacteristic("2A4D", NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY | NIMBLE_PROPERTY::READ_ENC);
  NimBLEDescriptor *pRepRef = pInputReport->createDescriptor("2908", NIMBLE_PROPERTY::READ);
  const uint8_t reportRefData[] = {0x00, 0x01}; // Report ID 0, Input
  pRepRef->setValue(reportRefData, sizeof(reportRefData));

  pHidService->start();

  // Setup Advertising: Primary broadcast with Flags, 128-bit ANCS Solicitation, and Name 'Matrix'
  Serial.println("[ANCS] Configuring advertising data...");
  NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();

  NimBLEAdvertisementData advData;
  advData.setFlags(BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP);

  // 128-bit Service Solicitation for Apple ANCS: 0x11 (length 17), 0x15 (AD type), 16-byte UUID
  const uint8_t ancsSolicitRaw[] = {
    0x11, 0x15,
    0xd0, 0x00, 0x2d, 0x12, 0x1e, 0x4b, 0x0f, 0xa4, 0x99, 0x4e, 0xce, 0xb5, 0x31, 0xf4, 0x05, 0x79
  };
  advData.addData((char*)ancsSolicitRaw, sizeof(ancsSolicitRaw));
  advData.setName("Matrix");
  pAdvertising->setAdvertisementData(advData);

  // Scan Response Data: Appearance + Full Name
  NimBLEAdvertisementData scanData;
  scanData.setName("Matrix Macropad");
  scanData.setAppearance(0x03C1); // HID Keyboard
  pAdvertising->setScanResponseData(scanData);
  pAdvertising->setScanResponse(true);

  pAdvertising->start();
  Serial.println("[ANCS] BLE Initialized. Advertising with ANCS Solicitation as Matrix");
}

void matrix_ancs_loop() {
  if (s_connected && !s_ancs_ready && s_conn_handle != BLE_HS_CONN_HANDLE_NONE) {
    static uint32_t last_discovery_attempt = 0;
    if (millis() - last_discovery_attempt >= 2000) {
      last_discovery_attempt = millis();
      discoverAncsServices();
    }
  }

  // Process pending attribute request cleanly from main loop
  if (s_pending_req_uid != 0 && s_connected && s_ancs_ready && s_ctrl_pt_handle > 0) {
    uint32_t reqUid = s_pending_req_uid;
    s_pending_req_uid = 0;
    requestNotificationAttributes(reqUid);
  }
}
