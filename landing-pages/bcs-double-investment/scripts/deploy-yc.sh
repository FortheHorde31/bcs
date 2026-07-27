#!/usr/bin/env bash
set -euo pipefail

# Deploy BCS landing folder to Yandex Object Storage (static website hosting).
# Prerequisite: yc init (or yc config set token ...)

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_DIR="${PUBLIC_DIR:-$PROJECT_DIR/public}"
BUCKET="${BUCKET_NAME:-bcs-double-investment-2026}"
FOLDER_ID="${YC_FOLDER_ID:-}"

if ! command -v yc >/dev/null 2>&1; then
  echo "yc CLI not found. Install: brew install yandex-cloud-cli"
  exit 1
fi

if ! yc config list >/dev/null 2>&1; then
  echo "Yandex Cloud is not configured. Run: yc init"
  exit 1
fi

if [[ ! -f "$PUBLIC_DIR/index.html" ]]; then
  echo "public/index.html not found. Run: node scripts/unpack.mjs"
  exit 1
fi

if [[ -z "$FOLDER_ID" ]]; then
  FOLDER_ID="$(yc config get folder-id 2>/dev/null || true)"
fi

WEBSITE_JSON="$(mktemp)"
trap 'rm -f "$WEBSITE_JSON"' EXIT
cat > "$WEBSITE_JSON" <<'EOF'
{
  "index": "index.html",
  "error": "index.html"
}
EOF

echo "Bucket: $BUCKET"
if yc storage bucket get --name "$BUCKET" >/dev/null 2>&1; then
  echo "Bucket exists, updating settings..."
else
  echo "Creating bucket..."
  CREATE_ARGS=(storage bucket create --name "$BUCKET" --public-read)
  if [[ -n "$FOLDER_ID" ]]; then
    CREATE_ARGS+=(--folder-id "$FOLDER_ID")
  fi
  yc "${CREATE_ARGS[@]}"
fi

yc storage bucket update --name "$BUCKET" --public-read --website-settings-from-file "$WEBSITE_JSON"

echo "Uploading public/ ..."
while IFS= read -r -d '' file; do
  rel="${file#$PUBLIC_DIR/}"
  case "$rel" in
    *.html) ct="text/html; charset=utf-8" ;;
    *.js)   ct="application/javascript; charset=utf-8" ;;
    *.css)  ct="text/css; charset=utf-8" ;;
    *.svg)  ct="image/svg+xml" ;;
    *.png)  ct="image/png" ;;
    *.woff2) ct="font/woff2" ;;
    *)      ct="application/octet-stream" ;;
  esac
  echo "  → $rel"
  yc storage s3 cp "$file" "s3://$BUCKET/$rel" \
    --content-type "$ct" \
    --cache-control "public, max-age=300"
done < <(find "$PUBLIC_DIR" -type f -print0)

echo ""
echo "Done. Public URLs:"
echo "  https://${BUCKET}.website.yandexcloud.net"
echo "  https://website.yandexcloud.net/${BUCKET}"
echo "  https://storage.yandexcloud.net/${BUCKET}/index.html"
