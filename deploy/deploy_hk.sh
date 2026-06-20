#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ./deploy/deploy_hk.sh user@host [remote_dir]"
  echo "Example: ./deploy/deploy_hk.sh root@1.2.3.4 /var/www/coinpusher"
  exit 1
fi

SERVER="$1"
REMOTE_DIR="${2:-/var/www/coinpusher}"

npm run build

ssh "$SERVER" "mkdir -p '$REMOTE_DIR/dist'"
rsync -az --delete dist/ "$SERVER:$REMOTE_DIR/dist/"

echo "Deployed to $SERVER:$REMOTE_DIR/dist"
echo "Nginx root should point to $REMOTE_DIR/dist"
