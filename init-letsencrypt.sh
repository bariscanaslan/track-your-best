#!/usr/bin/env bash
set -euo pipefail

APP_DOMAIN="${APP_DOMAIN:-app.example.com}"
API_DOMAIN="${API_DOMAIN:-api.example.com}"
EMAIL="${CERTBOT_EMAIL:-you@example.com}"
STAGING="${CERTBOT_STAGING:-0}"
DOMAINS=("$APP_DOMAIN" "$API_DOMAIN")

echo "Creating temporary certificates so nginx can start..."
for domain in "${DOMAINS[@]}"; do
    docker compose run --rm --entrypoint \
        "sh -c 'mkdir -p /etc/letsencrypt/live/$domain && openssl req -x509 -nodes -newkey rsa:2048 -days 1 -keyout /etc/letsencrypt/live/$domain/privkey.pem -out /etc/letsencrypt/live/$domain/fullchain.pem -subj /CN=localhost'" \
        certbot
done

echo "Starting nginx..."
docker compose up -d nginx

staging_flag=""
if [[ "$STAGING" -eq 1 ]]; then
    staging_flag="--staging"
fi

for domain in "${DOMAINS[@]}"; do
    echo "Requesting certificate for $domain..."
    docker compose run --rm --entrypoint "certbot certonly \
        --webroot -w /var/www/certbot \
        $staging_flag \
        --email $EMAIL \
        --domain $domain \
        --rsa-key-size 4096 \
        --agree-tos \
        --force-renewal" certbot
done

echo "Reloading nginx..."
docker compose exec nginx nginx -s reload

echo "Done. Run 'docker compose up -d' to start all services."
