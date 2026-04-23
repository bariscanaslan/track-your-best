### Stage 1 — build the React app ###
FROM node:20-alpine AS builder

WORKDIR /app

# VITE_API_URL is baked into the JS bundle at build time
ARG VITE_API_URL=http://localhost:8899
ENV VITE_API_URL=$VITE_API_URL

COPY package.json .
RUN npm install

COPY . .
RUN npm run build

### Stage 2 — serve with nginx ###
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
