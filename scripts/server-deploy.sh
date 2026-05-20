#!/usr/bin/env bash
set -e

APP_DIR="/www/wwwroot/ecommerce-ai-workflow"
APP_NAME="ecommerce-ai-workflow"
PORT_VALUE="${PORT:-3000}"

cd "$APP_DIR"

git fetch origin main
git reset --hard origin/main

rm -rf .next
npm run build

# Next standalone needs static assets copied next to server.js.
rm -rf .next/standalone/.next/static
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
if [ -d public ]; then
  cp -r public .next/standalone/public
fi

set -a
. ./.env.local
set +a

pm2 delete "$APP_NAME" || true
PORT="$PORT_VALUE" HOSTNAME=0.0.0.0 pm2 start .next/standalone/server.js --name "$APP_NAME"
pm2 save

/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload

pm2 status

