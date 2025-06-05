# Spécifier la plateforme pour éviter les conflits d'architecture
FROM node:22-alpine3.21

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-eng tesseract-ocr-data-fra
ENTRYPOINT ["node", "/app/src/app.js"]
