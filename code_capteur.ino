#include <Arduino.h>
#include <math.h>

// =======================
// CONFIG
// =======================
const char* SENSOR_ID = "capteur_maquette";

const int MIC_PIN = A0;

// Fenêtre RMS (ms) : plus long = plus stable
const uint16_t WINDOW_MS = 100;

// Sampling (µs)
const uint16_t SAMPLE_US = 200;

// Calibration (offset dB) pour coller à une référence (iPhone etc.)
float CAL_OFFSET_DB = 56.0f;

// =======================
// SOBRIÉTÉ ÉNERGÉTIQUE
// =======================
// Logique événementielle : envoyer seulement si delta > seuil ou timeout
const float DB_CHANGE_THRESHOLD = 2.0f;        // delta dB minimum pour envoyer
const unsigned long NORMAL_MAX_INTERVAL = 30000; // 30 s max entre deux envois (mode normal)
const unsigned long ECO_MAX_INTERVAL = 120000;   // 120 s max entre deux envois (mode éco)
const unsigned long NORMAL_MEASURE_INTERVAL = 1000; // mesure toutes les 1 s (mode normal)
const unsigned long ECO_MEASURE_INTERVAL = 5000;    // mesure toutes les 5 s (mode éco)

float lastSentDb = -999.0f;              // dernière valeur envoyée
unsigned long lastSentTime = 0;           // timestamp du dernier envoi

// État du capteur (modifiable via commandes Zigbee de la passerelle)
bool sensorEnabled = true;   // capteur actif ou désactivé
bool ecoMode = false;        // mode économie d'énergie

// =======================
// UTILS
// =======================
float measureDCOffset(uint16_t samples = 300) {
  uint32_t sum = 0;
  for (uint16_t i = 0; i < samples; i++) {
    sum += analogRead(MIC_PIN);
    delayMicroseconds(SAMPLE_US);
  }
  return (float)sum / (float)samples;
}

float measureDbRMS() {
  const uint32_t start = millis();

  const float dc = measureDCOffset(200);

  double sumSq = 0.0;
  uint32_t n = 0;

  while (millis() - start < WINDOW_MS) {
    float x = (float)analogRead(MIC_PIN) - dc;
    sumSq += (double)x * (double)x;
    n++;
    delayMicroseconds(SAMPLE_US);
  }

  if (n == 0) return 0.0f;

  double rms = sqrt(sumSq / (double)n);
  if (rms < 1e-6) rms = 1e-6;

  float db_raw = 20.0f * log10((float)rms);
  return db_raw + CAL_OFFSET_DB;
}

// =======================
// COMMANDES ZIGBEE
// =======================
// Buffer pour recevoir les commandes de la passerelle
char cmdBuf[32];
int cmdIdx = 0;

void processCommand(const char* cmd) {
  // Commandes attendues de la passerelle :
  //   CMD:ENABLE   -> activer le capteur
  //   CMD:DISABLE  -> désactiver le capteur
  //   CMD:ECO_ON   -> activer le mode économie d'énergie
  //   CMD:ECO_OFF  -> désactiver le mode économie d'énergie
  if (strncmp(cmd, "CMD:", 4) != 0) return;

  const char* action = cmd + 4;

  if (strcmp(action, "ENABLE") == 0) {
    sensorEnabled = true;
    Serial.println("[CMD] Capteur ACTIVÉ");
    // Envoyer un ACK à la passerelle
    Serial1.print("ACK:ENABLED\n");
  }
  else if (strcmp(action, "DISABLE") == 0) {
    sensorEnabled = false;
    Serial.println("[CMD] Capteur DÉSACTIVÉ");
    Serial1.print("ACK:DISABLED\n");
  }
  else if (strcmp(action, "ECO_ON") == 0) {
    ecoMode = true;
    Serial.println("[CMD] Mode ECO ACTIVÉ");
    Serial1.print("ACK:ECO_ON\n");
  }
  else if (strcmp(action, "ECO_OFF") == 0) {
    ecoMode = false;
    Serial.println("[CMD] Mode ECO DÉSACTIVÉ");
    Serial1.print("ACK:ECO_OFF\n");
  }
}

void checkZigbeeCommands() {
  while (Serial1.available()) {
    char c = (char)Serial1.read();
    if (c == '\n') {
      cmdBuf[cmdIdx] = '\0';
      cmdIdx = 0;
      processCommand(cmdBuf);
    } else {
      if (cmdIdx < (int)sizeof(cmdBuf) - 1) {
        cmdBuf[cmdIdx++] = c;
      } else {
        cmdIdx = 0; // overflow, reset
      }
    }
  }
}

// =======================
// SETUP
// =======================
void setup() {
  Serial.begin(115200);
  Serial1.begin(9600); // XBee / Zigbee
  Serial.println("=== MAX4466 dB meter – sobriété énergétique ===");
  Serial.println("Mode événementiel : envoi si delta > 2 dB ou timeout 30s/120s");
}

// =======================
// LOOP
// =======================
void loop() {
  // Toujours vérifier les commandes Zigbee même si le capteur est désactivé
  checkZigbeeCommands();

  // Si le capteur est désactivé, ne pas mesurer ni envoyer
  if (!sensorEnabled) {
    delay(500); // économiser du CPU en mode désactivé
    return;
  }

  float db_now = measureDbRMS();

  // Logique événementielle : envoyer seulement si nécessaire
  unsigned long maxInterval = ecoMode ? ECO_MAX_INTERVAL : NORMAL_MAX_INTERVAL;
  float deltaDb = fabs(db_now - lastSentDb);
  unsigned long elapsed = millis() - lastSentTime;

  bool shouldSend = false;

  if (deltaDb >= DB_CHANGE_THRESHOLD) {
    shouldSend = true;  // variation significative
  }
  if (elapsed >= maxInterval) {
    shouldSend = true;  // timeout atteint, envoi de keepalive
  }
  if (lastSentDb < -900.0f) {
    shouldSend = true;  // premier envoi
  }

  if (shouldSend) {
    // Format Zigbee: "capteur_maquette:66.1\n"
    Serial1.print(SENSOR_ID);
    Serial1.print(":");
    Serial1.print(db_now, 1);
    Serial1.print("\n");

    Serial.print("TX ");
    Serial.print(SENSOR_ID);
    Serial.print(":");
    Serial.print(db_now, 1);
    Serial.print(ecoMode ? " [ECO]" : "");
    Serial.print(" (delta=");
    Serial.print(deltaDb, 1);
    Serial.print("dB, elapsed=");
    Serial.print(elapsed / 1000);
    Serial.println("s)");

    lastSentDb = db_now;
    lastSentTime = millis();
  }

  // Intervalle de mesure adapté au mode
  unsigned long measureInterval = ecoMode ? ECO_MEASURE_INTERVAL : NORMAL_MEASURE_INTERVAL;
  delay(measureInterval);
}
 