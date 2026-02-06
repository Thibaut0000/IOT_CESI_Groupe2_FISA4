# Web IOT - Bruit (MQTT ➜ API ➜ Dashboard)

Stack locale moderne avec ingestion MQTT, historisation InfluxDB, API Node.js/Express, et dashboard React.

##  Contraintes respectées
- Le navigateur ne se connecte **jamais** à MQTT.
- Ingestion MQTT côté API uniquement.
- Auth JWT + RBAC (admin/user).
- Historisation InfluxDB 2.x.
- Détection offline (>10s configurable).
- Logs JSON + audit admin.
- Déploiement local Docker principal.

## Architecture
```
Capteurs ➜ MQTT (broker existant) ➜ API (MQTT client) ➜ InfluxDB + WebSocket ➜ Front
```

## Prérequis
- Docker + Docker Compose
- Node.js 18+ (si exécution hors Docker)

## Configuration
Copier et ajuster le fichier d’environnement :
```
cp .env.example .env
```
**IMPORTANT**: le broker réel est déjà en place.
Par défaut :
- MQTT_HOST=172.20.10.2
- MQTT_PORT=1883

## Lancer en local (Docker)
```
docker compose up --build
```
- API: http://localhost:4000
- Front: http://localhost:5173
- InfluxDB: http://localhost:8086

## Créer un admin
```bash
cd backend
npm install
npx tsx src/scripts/createAdmin.ts --email admin@local --password Admin123!
```

## Endpoints principaux
- POST /auth/login
- GET /devices
- GET /metrics/latest?deviceId=A
- GET /metrics/history?deviceId=A&minutes=30
- GET /metrics/stats?deviceId=A&minutes=60

Admin (JWT role=admin):
- POST /admin/thresholds
- GET /admin/thresholds
- GET /admin/audit

## MQTT (réel)
Topics effectivement utilisés:
- campus/bruit/+/data

Payload JSON:
```
{
  "sensor": "A",
  "noise_db": 60.3,
  "ts": 943007
}
```

## Mosquitto (config TLS/ACL exemple)
Les fichiers de config sont prêts dans [mosquitto/config](mosquitto/config) et un script de génération de certificats DEV est disponible.
Le service Mosquitto Docker est optionnel via profile `local-broker`.

## Notes sécurité
- MQTT TLS et ACL sont fournis comme exemple.
- L’auth REST est JWT.
- Les mots de passe sont hashés bcrypt.

## Développement (sans Docker)
### Backend
```
cd backend
npm install
npm run dev
```

### Frontend
```
cd frontend
npm install
npm run dev
```

## Propositions d’amélioration (optionnelles)
- Ajout WebSocket par device (filtrage client)
- Statistiques avancées (boxplot, percentiles)
- Exports CSV
- Mode maintenance pour capteur