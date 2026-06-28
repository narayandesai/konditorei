# Stage 1 — build the Vite frontend
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — minimal runtime image
# tsx is a devDependency but is needed to run the TypeScript server; it is
# installed separately here so devDependencies are otherwise excluded.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx

COPY --from=builder /app/dist ./dist
COPY server ./server

EXPOSE 3000
CMD ["node_modules/.bin/tsx", "server/index.ts"]
