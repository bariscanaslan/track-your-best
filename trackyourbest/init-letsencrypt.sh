#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# init-letsencrypt.sh
# Run ONCE on first deploy to obtain Let's Encrypt certificates.
# After this, the certbot container auto-renews every 12 h.
#
# Usage:
#   chmod +x init-letsencrypt.sh
#   ./init-letsencrypt.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

DOMAINS=("app.trackyourbest.net" "api.trackyourbest.net")
EMAIL="admin@trackyourbest.net"   # ← change to your email (used for expiry alerts)
STAGING=0                          # set to 1 to test against Let's Encrypt staging CA

# ── 1. Create dummy self-signed certs so nginx can start ─────────────────────
echo "Creating dummy certificates so nginx can start..."
for domain in "${DOMAINS[@]}"; do
    mkdir -p "$(docker volume inspect tyb_certbot_certs --format '{{.Mountpoint}}')/live/$domain" 2>/dev/null || true

    docker compose run --rm --entrypoint "openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout /etc/letsencrypt/live/$domain/privkey.pem \
        -out    /etc/letsencrypt/live/$domain/fullchain.pem \
        -subj   '/CN=localhost'" certbot
done

# ── 2. Start nginx with the dummy certs ──────────────────────────────────────
echo "Starting nginx..."
docker compose up -d nginx

# ── 3. Obtain real certificates via ACME HTTP-01 challenge ───────────────────
staging_flag=""
[[ "$STAGING" -eq 1 ]] && staging_flag="--staging"

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

# ── 4. Reload nginx with real certs ──────────────────────────────────────────
echo "Reloading nginx..."
docker compose exec nginx nginx -s reload

echo ""
echo "Done. Run 'docker compose up -d' to bring up all services."
