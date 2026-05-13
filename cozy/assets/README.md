# Cozy game assets

Grass chunk source file is stored as Base64 in `grass_chunk.png.b64` because the connected GitHub tool only writes text files directly. On VPS, decode it into `grass_chunk.png` with:

```bash
base64 -d /var/www/cozy-concept/cozy/assets/grass_chunk.png.b64 > /var/www/cozy-concept/cozy/assets/grass_chunk.png
```

Then the game can load it as `/assets/grass_chunk.png`.
