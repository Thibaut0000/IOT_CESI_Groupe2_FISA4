FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json .
COPY src ./src

# Create data directory
RUN mkdir -p data

RUN npm run build

EXPOSE 4000
CMD ["npm", "run", "start"]