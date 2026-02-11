#include <WiFiS3.h>
#include <PubSubClient.h>
#include <WiFiUdp.h>
#include <NTPClient.h>

// =======================
// CONFIG
// =======================
const char* WIFI_SSID = "Livebox-5B56";
const char* WIFI_PASS = "123456789";

const char* MQTT_SERVER = "172.20.10.2";
const int   MQTT_PORT   = 1883;
const char* MQTT_USER   = "deviceA";       
const char* MQTT_PASS   = "ChangeMe123!";   

// Zones
const char* ZONE_REAL = "demo_salle";
const char* ZONE_FAKE = "fake_salle";

// Capteur reel
const char* SENSOR_ID_REAL = "A";

// Topics
const char* TOPIC_DB_FMT     = "campus/bruit/%s/db";
const char* TOPIC_STATUS_FMT = "campus/bruit/%s/status";

// =======================
// WIFI / MQTT / NTP
// =======================
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 0, 6UL * 60UL * 60UL * 1000UL);

// =======================
// TIME SYNC
// =======================
unsigned long millisAtSync = 0;
unsigned long epochAtSync  = 0;
bool timeSynced = false;

// =======================
// ZIGBEE RX BUFFER
// =======================
char buf[32];
int idx = 0;

// =======================
// FAKE DATA TIMER
// =======================
unsigned long lastFakeSend = 0;
const unsigned long FAKE_PERIOD_MS = 2000;

// =======================
// WIFI
// =======================
void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

// =======================
// NTP
// =======================
bool syncTimeNTP() {
  timeClient.begin();

  for (int i = 0; i < 10; i++) {
    if (timeClient.update()) {
      epochAtSync  = timeClient.getEpochTime();
      millisAtSync = millis();
      timeSynced   = true;
      return true;
    }
    delay(300);
  }
  return false;
}

unsigned long nowEpoch() {
  if (!timeSynced) return 0;
  return epochAtSync + (millis() - millisAtSync) / 1000UL;
}

// =======================
// MQTT
// =======================
void connectMQTT() {
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);

  char topicStatus[64];
  snprintf(topicStatus, sizeof(topicStatus), TOPIC_STATUS_FMT, ZONE_REAL);

  // LWT offline (capteur reel)
  char willPayload[128];
  snprintf(willPayload, sizeof(willPayload),
           "{\"online\":false,\"sensorId\":\"%s\",\"zone\":\"%s\",\"ts\":%lu}",
           SENSOR_ID_REAL, ZONE_REAL, nowEpoch());

  while (!mqttClient.connected()) {
      const char* clientId = "sonometre-A";

    mqttClient.connect(clientId,
                       MQTT_USER, MQTT_PASS,  
                       topicStatus,
                       1,
                       true,
                       willPayload);
    delay(500);
  }

  // Publish online status (retain)
  char onlinePayload[128];
  snprintf(onlinePayload, sizeof(onlinePayload),
           "{\"online\":true,\"sensorId\":\"%s\",\"zone\":\"%s\",\"ts\":%lu}",
           SENSOR_ID_REAL, ZONE_REAL, nowEpoch());

  mqttClient.publish(topicStatus, onlinePayload, true);
}

// =======================
// PUBLISH FUNCTIONS
// =======================
void publishNoise(const char* zone, const char* sensorId, float dbValue) {
  char topic[64];
  snprintf(topic, sizeof(topic), TOPIC_DB_FMT, zone);

  char payload[128];
  snprintf(payload, sizeof(payload),
           "{\"db\":%.1f,\"sensorId\":\"%s\",\"zone\":\"%s\",\"ts\":%lu}",
           dbValue, sensorId, zone, nowEpoch());

  mqttClient.publish(topic, payload);
}

// =======================
// SETUP
// =======================
void setup() {
  Serial.begin(115200);
  Serial1.begin(9600);

  randomSeed(analogRead(A0));

  connectWiFi();
  syncTimeNTP();
  connectMQTT();
}

// =======================
// LOOP
// =======================
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    syncTimeNTP();
  }

  if (!mqttClient.connected()) {
    connectMQTT();
  }

  mqttClient.loop();

  // =====================
  // CAPTEUR REEL (ZigBee)
  // =====================
  while (Serial1.available()) {
    char c = (char)Serial1.read();

    if (c == '\n') {
      buf[idx] = '\0';
      idx = 0;

      char* valueStr = buf;
      char* sep = strchr(buf, ':');
      if (sep) valueStr = sep + 1;

      float db = atof(valueStr);
      if (db < 0)   db = 0;
      if (db > 120) db = 120;

      publishNoise(ZONE_REAL, SENSOR_ID_REAL, db);

    } else {
      if (idx < (int)sizeof(buf) - 1) {
        buf[idx++] = c;
      } else {
        idx = 0;
      }
    }
  }

  // =====================
  // FAKE SALLE
  // =====================
  if (millis() - lastFakeSend > FAKE_PERIOD_MS) {
    lastFakeSend = millis();

    float fakeDb = random(0, 1200) / 10.0;
    publishNoise(ZONE_FAKE, "SIM", fakeDb);
  }
}