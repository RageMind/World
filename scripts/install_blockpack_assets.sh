#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TMP_DIR="/tmp/yourwill_blockpack_assets"
ZIP="$TMP_DIR/kenney_blockpack.zip"
OUT="cozy/assets/kenney/blockpack"
PNG_DIR="$OUT/png"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR" "$PNG_DIR"

printf 'Installing dependencies...\n'
if command -v apt >/dev/null 2>&1; then
  apt update -y >/dev/null
  apt install -y curl unzip python3 python3-pil >/dev/null
fi

printf 'Downloading Kenney Block Pack from OpenGameArt mirror...\n'
curl -L --fail --retry 3 -A 'Mozilla/5.0' \
  'https://opengameart.org/sites/default/files/kenney_blockpack.zip' \
  -o "$ZIP"

printf 'Unpacking...\n'
unzip -q "$ZIP" -d "$TMP_DIR/unpack"

printf 'Copying PNG files...\n'
find "$TMP_DIR/unpack" -type f -iname '*.png' -print0 | while IFS= read -r -d '' file; do
  rel="${file#$TMP_DIR/unpack/}"
  safe="$(echo "$rel" | tr '/ ' '__')"
  cp "$file" "$PNG_DIR/$safe"
done

cat > "$OUT/LICENSE.txt" <<'EOF'
Kenney Block Pack
Source: https://kenney.nl/assets/block-pack
Mirror used for automated download: https://opengameart.org/content/block-pack
License: Creative Commons CC0
Author: Kenney
Attribution is not required, but appreciated.
EOF

cat > "$OUT/SOURCE.txt" <<'EOF'
Official page: https://kenney.nl/assets/block-pack
Mirror: https://opengameart.org/content/block-pack
License: Creative Commons CC0
EOF

python3 - <<'PY'
from pathlib import Path
from PIL import Image
import json, re

base = Path('cozy/assets/kenney/blockpack/png')
files = sorted(base.glob('*.png'))

houses = []
people = []
camps = []
props = []

house_words = ['house','home','hut','building','shop','roof','cabin','tent','castle','tower']
people_words = ['character','person','player','human','man','woman','male','female','villager','worker','hero','unit']
camp_words = ['fire','camp','torch','flame']
prop_words = ['crate','barrel','chest','rock','tree','bush','wood','log','fence','well']

for p in files:
    name = p.name.lower()
    try:
        im = Image.open(p).convert('RGBA')
        bbox = im.getbbox()
        if not bbox:
            continue
        bw = bbox[2] - bbox[0]
        bh = bbox[3] - bbox[1]
    except Exception:
        continue

    item = {'file': p.name, 'w': bw, 'h': bh}
    if any(w in name for w in camp_words):
        camps.append(item)
    elif any(w in name for w in house_words):
        houses.append(item)
    elif any(w in name for w in people_words):
        people.append(item)
    elif any(w in name for w in prop_words):
        props.append(item)

# Fallback heuristics if filenames are not descriptive.
if not houses:
    candidates = []
    for p in files:
        try:
            im = Image.open(p).convert('RGBA')
            bbox = im.getbbox()
            if not bbox: continue
            bw, bh = bbox[2]-bbox[0], bbox[3]-bbox[1]
            if bw >= 40 and bh >= 35 and bw <= 160 and bh <= 160:
                candidates.append({'file': p.name, 'w': bw, 'h': bh})
        except Exception:
            pass
    houses = candidates[:12]

if not people:
    candidates = []
    for p in files:
        try:
            im = Image.open(p).convert('RGBA')
            bbox = im.getbbox()
            if not bbox: continue
            bw, bh = bbox[2]-bbox[0], bbox[3]-bbox[1]
            ratio = bh / max(1,bw)
            if 18 <= bw <= 80 and 28 <= bh <= 110 and ratio >= 1.05:
                candidates.append({'file': p.name, 'w': bw, 'h': bh})
        except Exception:
            pass
    people = candidates[:24]

manifest = {
    'all': [p.name for p in files],
    'houses': houses,
    'people': people,
    'camps': camps,
    'props': props,
}
Path('cozy/assets/kenney/blockpack/manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print('PNG files:', len(files))
print('houses:', len(houses), 'people:', len(people), 'camps:', len(camps), 'props:', len(props))
print('Example houses:', [x['file'] for x in houses[:5]])
print('Example people:', [x['file'] for x in people[:5]])
PY

printf 'Done. Files are in %s\n' "$PNG_DIR"
printf 'Next: git add cozy/assets/kenney/blockpack scripts/install_blockpack_assets.sh && git commit -m "Add Kenney Block Pack assets" && git push origin cozy-characters-buildings-v1\n'
