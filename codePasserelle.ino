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
const char* NAME_MAQUETTE = "PASSERELLE01";
const char* ZONE_MAQUETTE = "ETAGE02";

// Topics
const char* TOPIC_DB_FMT     = "campus/bruit/%s/db";
const char* TOPIC_STATUS_FMT = "campus/bruit/%s/status";
// Topic pour les commandes reçues du backend vers les capteurs
const char* TOPIC_CMD = "campus/bruit/cmd";

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
char buf[64];
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
// MQTT CALLBACK (commandes du backend)
// =======================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Traiter les commandes reçues sur campus/bruit/cmd
  // Format JSON attendu : {"sensorId":"capteur_maquette","action":"DISABLE"}
  // Actions possibles : ENABLE, DISABLE, ECO_ON, ECO_OFF

  char msg[128];
  if (length >= sizeof(msg)) return;
  memcpy(msg, payload, length);
  msg[length] = '\0';

  Serial.print("[MQTT CMD] ");
  Serial.println(msg);

  // Parse simple JSON pour extraire sensorId et action
  char sensorId[32] = "";
  char action[16] = "";

  char* sidStart = strstr(msg, "\"sensorId\":\"");
  if (sidStart) {
    sidStart += 12;
    char* sidEnd = strchr(sidStart, '"');
    if (sidEnd && (sidEnd - sidStart) < (int)sizeof(sensorId)) {
      memcpy(sensorId, sidStart, sidEnd - sidStart);
      sensorId[sidEnd - sidStart] = '\0';
    }
  }

  char* actStart = strstr(msg, "\"action\":\"");
  if (actStart) {
    actStart += 10;
    char* actEnd = strchr(actStart, '"');
    if (actEnd && (actEnd - actStart) < (int)sizeof(action)) {
      memcpy(action, actStart, actEnd - actStart);
      action[actEnd - actStart] = '\0';
    }
  }

  if (strlen(sensorId) == 0 || strlen(action) == 0) {
    Serial.println("[MQTT CMD] Invalid command format");
    return;
  }

  // Relayer la commande au capteur via Zigbee
  Serial1.print("CMD:");
  Serial1.print(action);
  Serial1.print("\n");

  Serial.print("[ZIGBEE TX] CMD:");
  Serial.print(action);
  Serial.print(" -> ");
  Serial.println(sensorId);
}

// =======================
// MQTT
// =======================
void connectMQTT() {
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  char topicStatus[64];
  snprintf(topicStatus, sizeof(topicStatus), TOPIC_STATUS_FMT, ZONE_REAL);

  // LWT offline (capteur reel)
  char willPayload[128];
  snprintf(willPayload, sizeof(willPayload),
           "{\"online\":false,\"sensorId\":\"%s\",\"zone\":\"%s\",\"ts\":%lu}",
           NAME_MAQUETTE, ZONE_MAQUETTE, nowEpoch());

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
           NAME_MAQUETTE, ZONE_MAQUETTE, nowEpoch());

  mqttClient.publish(topicStatus, onlinePayload, true);

  // S'abonner aux commandes du backend
  mqttClient.subscribe(TOPIC_CMD, 1);
  Serial.println("[MQTT] Subscribed to command topic");
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

// Publier un ACK de commande vers le backend
void publishCommandAck(const char* sensorId, const char* ackType) {
  char topic[64];
  snprintf(topic, sizeof(topic), "campus/bruit/%s/cmd_ack", ZONE_REAL);

  char payload[128];
  snprintf(payload, sizeof(payload),
           "{\"sensorId\":\"%s\",\"ack\":\"%s\",\"ts\":%lu}",
           sensorId, ackType, nowEpoch());

  mqttClient.publish(topic, payload);
  Serial.print("[MQTT TX] ACK: ");
  Serial.println(ackType);
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

      // Vérifier si c'est un ACK du capteur
      if (strncmp(buf, "ACK:", 4) == 0) {
        const char* ackType = buf + 4;
        Serial.print("[ZIGBEE RX] ACK: ");
        Serial.println(ackType);
        // Relayer le ACK vers le backend via MQTT
        publishCommandAck(NAME_MAQUETTE, ackType);
      }
      else {
        // C'est une mesure de bruit : "sensorId:value"
        char sensorId[32];
        char valueStr[16];

        char* sep = strchr(buf, ':');
        if (sep) {
          *sep = '\0';
          strcpy(sensorId, buf);
          strcpy(valueStr, sep + 1);

          float db = atof(valueStr);
          if (db < 0)   db = 0;
          if (db > 120) db = 120;

          publishNoise(ZONE_REAL, sensorId, db);
        }
      }
    }
    else {
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
