#!/usr/bin/env sh
set -e

mkdir -p .

# CA
openssl genrsa -out ca.key 2048
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.crt -subj "/CN=mosquitto-ca"

# Server key + CSR
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -subj "/CN=mosquitto"

# SAN config : accepte mosquitto (Docker), localhost, et toute IP privée courante
cat > san.cnf <<EOF
[v3_req]
subjectAltName = DNS:mosquitto, DNS:localhost, IP:127.0.0.1, IP:172.20.10.2, IP:192.168.1.1
EOF

openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 365 -sha256 -extfile san.cnf -extensions v3_req

rm -f san.cnf server.csr ca.srl

echo "Certificats générés (SAN: mosquitto, localhost, 172.20.10.2)"