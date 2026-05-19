FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Build
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public

# Data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
