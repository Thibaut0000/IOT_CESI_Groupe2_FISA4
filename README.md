# Web IOT – Bruit Campus (MQTT ➜ API ➜ Dashboard)

Stack locale : ingestion MQTT, historisation InfluxDB, API Node.js/Express, dashboard React.

## Contraintes respectées
- Le navigateur ne se connecte **jamais** à MQTT.
- Ingestion MQTT côté API uniquement.
- Auth JWT + RBAC (admin / user).
- Historisation InfluxDB 2.x.
- Détection offline (seuil configurable).
- Logs JSON (Pino) + audit admin.
- Déploiement local Docker.
- **MQTT sécurisé** : TLS (port 8883) + authentification + ACL.

## Architecture

```text
Arduino (ZigBee/UART) ──► MQTT (Mosquitto TLS) ──► API Node.js ──► InfluxDB
                                                         │
                                                         └──► WebSocket ──► Dashboard React
```

## Prérequis
- Docker & Docker Compose

---

## 🚀 Démarrage rapide

```bash
git clone <url-du-repo>
cd Web_IOT
docker compose --profile local-broker up -d --build
```

**C'est tout.** L'admin par défaut est créé automatiquement au premier lancement.

| Service   | URL                   |
|-----------|-----------------------|
| Dashboard | http://localhost:5173  |
| API       | http://localhost:4000  |
| InfluxDB  | http://localhost:8086  |

### Connexion au dashboard

| Champ        | Valeur         |
|--------------|----------------|
| Email        | `admin@local`  |
| Mot de passe | `Admin123!`    |

> 💡 Modifiable via `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` dans le `.env`.

---

## 🖥️ Mode client (front uniquement, serveur chez quelqu'un d'autre)

Si un membre de l'équipe fait tourner toute la stack (InfluxDB + Mosquitto), les autres peuvent ne lancer que l'API + le frontend chez eux.

1. Modifier le `.env` :
```
INFLUX_URL=http://<IP_SERVEUR>:8086
MQTT_HOST=<IP_SERVEUR>
MQTT_PORT=1883
MQTT_TLS=false
VITE_API_BASE_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000/ws
```

2. Lancer en mode client :
```bash
docker compose -f docker-compose.yml -f docker-compose.client.yml up -d --build api web
```

Seuls les conteneurs API et frontend démarrent — pas d'InfluxDB ni de Mosquitto en local.

---

## Configuration (.env)

Le `.env` est versionné (projet local entre amis). Variables principales :

| Variable | Défaut | Description |
|----------|--------|-------------|
| `MQTT_HOST` | `mosquitto` | Hostname du broker |
| `MQTT_PORT` | `8883` | Port MQTTS (TLS) |
| `MQTT_USERNAME` | `api` | User MQTT côté API |
| `MQTT_PASSWORD` | `ChangeMe123!` | Mot de passe MQTT API |
| `MQTT_TLS` | `true` | Activer TLS |
| `INFLUX_URL` | `http://influxdb:8086` | URL InfluxDB |
| `INFLUX_TOKEN` | *(dans .env)* | Token InfluxDB |
| `INFLUX_ORG` | `cesi` | Organisation InfluxDB |
| `INFLUX_BUCKET` | `bruit` | Bucket principal |
| `DEFAULT_ADMIN_EMAIL` | `admin@local` | Email admin auto-créé |
| `DEFAULT_ADMIN_PASSWORD` | `Admin123!` | Mot de passe admin |
| `OFFLINE_THRESHOLD_SECONDS` | `10` | Seuil détection offline |

---

## MQTT – Topics & Payloads

### Données bruit

Topic : `campus/bruit/<zone>/db`

```json
{
  "db": 65.3,
  "sensorId": "sensorA",
  "zone": "demo_salle",
  "ts": 1770730108
}
```

### Statut capteur

Topic : `campus/bruit/<zone>/status`

```json
{
  "online": true,
  "sensorId": "A",
  "zone": "demo_salle",
  "ts": 1770730108
}
```

> `ts` = epoch **secondes** (NTP). Le backend normalise en millisecondes si nécessaire.

### Credentials MQTT (Arduino)

| User | Mot de passe | Droits |
|------|-------------|--------|
| `deviceA` | `ChangeMe123!` | Publish `campus/bruit/+/db` et `campus/bruit/+/status` |
| `api` | `ChangeMe123!` | Subscribe `campus/bruit/#` et `$SYS/#` |

---

## Sécurité MQTT (TLS)

Mosquitto est configuré avec :
- **TLS** sur le port `8883` (certificats auto-signés dans `mosquitto/config/certs/`)
- **Port 1883** disponible en fallback (plain, pour les Arduinos sans TLS)
- **`allow_anonymous false`** — authentification obligatoire
- **ACL** par utilisateur (`mosquitto/config/aclfile`)

Régénérer les certificats dev :

```bash
cd mosquitto/config/certs
sh gen-dev-certs.sh
```

---

## Endpoints API

### Publics

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/auth/login` | Connexion → JWT |
| GET | `/health` | Statut MQTT + InfluxDB |

### Authentifiés (JWT Bearer)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/devices` | Liste des capteurs |
| GET | `/metrics/latest?deviceId=X` | Dernière mesure |
| GET | `/metrics/history?deviceId=X&minutes=30` | Historique |
| GET | `/metrics/stats?deviceId=X&minutes=60` | Stats (min/max/moy) |

### Admin (JWT role=admin)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET/POST | `/admin/thresholds` | Seuils d'alerte |
| GET | `/admin/audit` | Logs d'audit |
| GET/POST | `/admin/users` | Gestion utilisateurs |
| GET | `/admin/export/csv?deviceId=X&minutes=60` | Export CSV |

---

## Développement (sans Docker)

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```