# ================================
# 1) BUILD STAGE
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --include=dev

COPY .env.production ./
COPY . .

RUN npm run build


# ================================
# 2) RUNTIME STAGE (Next.js Server)
# ================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3003

CMD ["npm", "start"]
