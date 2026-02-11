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
 
void setup() {
  Serial.begin(115200);
  Serial1.begin(9600); // XBee
  Serial.println("=== MAX4466 dB meter (ID + value) ===");
}
 
void loop() {
  float db_now = measureDbRMS();
 
  // Format Zigbee: "A:66.1\n"
  Serial1.print(SENSOR_ID);
  Serial1.print(":");
  Serial1.print(db_now, 1);
  Serial1.print("\n");
 
  Serial.print("TX ");
  Serial.print(SENSOR_ID);
  Serial.print(":");
  Serial.println(db_now, 1);
 
  delay(1000);
}
 