# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Installation de toutes les dépendances (y compris devDependencies pour TypeScript)
# Utilisation de --legacy-peer-deps pour résoudre le conflit entre fastify@5 et fastify-socket.io@5.1.0
RUN npm install --legacy-peer-deps

# Copie du code source et compilation TypeScript
COPY . .
RUN npm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Copie des fichiers package pour l'installation des dépendances de production
COPY --from=builder /app/package*.json ./

# Installation des dépendances de production uniquement
# Utilisation de --legacy-peer-deps pour résoudre le conflit entre fastify@5 et fastify-socket.io@5.1.0
RUN npm ci --production --legacy-peer-deps

# Copie du code compilé
COPY --from=builder /app/dist ./dist

# Copie des fichiers de migration Drizzle
COPY --from=builder /app/drizzle ./drizzle

# Copie du fichier retention.sql (nécessaire pour le plugin log-retention)
# Le dossier dist/db existe déjà après la compilation TypeScript, mais on s'assure qu'il existe
RUN mkdir -p ./dist/db && chown -R node:node ./dist/db
COPY --from=builder /app/src/db/retention.sql ./dist/db/retention.sql

# Copie et configuration du script d'entrypoint
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && chown node:node ./docker-entrypoint.sh

# Sécurité: Utilisation de l'utilisateur par défaut 'node'
USER node

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
