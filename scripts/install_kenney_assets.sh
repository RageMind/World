#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

URL="https://kenney.nl/media/pages/assets/isometric-tiles-landscape/bbeffd6459-1677695072/kenney_isometric-landscape.zip"
TMP_DIR="/tmp/yourwill_kenney_assets"
ZIP="$TMP_DIR/kenney_isometric-landscape.zip"
OUT="cozy/assets/kenney/isometric-landscape"
FLAT="$OUT/png"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR" "$FLAT"

printf 'Downloading Kenney Isometric Tiles Landscape...\n'
curl -L --fail --retry 3 -A 'Mozilla/5.0' "$URL" -o "$ZIP"

printf 'Unpacking...\n'
unzip -q "$ZIP" -d "$TMP_DIR/unpack"

printf 'Copying PNG files...\n'
find "$TMP_DIR/unpack" -type f -iname '*.png' -print0 | while IFS= read -r -d '' file; do
  base="$(basename "$file")"
  cp "$file" "$FLAT/$base"
done

cat > "$OUT/LICENSE.txt" <<'EOF'
Kenney Isometric Tiles Landscape
Source: https://kenney.nl/assets/isometric-tiles-landscape
License: Creative Commons CC0
Author: Kenney
Attribution is not required, but appreciated.
EOF

cat > "$OUT/SOURCE.txt" <<EOF
Downloaded from: $URL
Official page: https://kenney.nl/assets/isometric-tiles-landscape
License: Creative Commons CC0
EOF

python3 - <<'PY'
from pathlib import Path
import json
base = Path('cozy/assets/kenney/isometric-landscape/png')
files = sorted(p.name for p in base.glob('*.png'))
Path('cozy/assets/kenney/isometric-landscape/manifest.json').write_text(json.dumps(files, indent=2), encoding='utf-8')
print(f'PNG files copied: {len(files)}')
PY

printf 'Done. Files are in %s\n' "$FLAT"
printf 'Next: git add cozy/assets/kenney scripts/install_kenney_assets.sh && git commit -m "Add Kenney isometric landscape assets" && git push\n'
