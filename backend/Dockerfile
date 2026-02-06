FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json .
COPY src ./src

# Create data directory
RUN mkdir -p data

RUN npm run build

EXPOSE 4000
CMD ["npm", "run", "start"]