#!/usr/bin/env bash
# Converte um vídeo em sequência de frames WebP para o scroll do hero.
# Uso: npm run frames -- caminho/do/video.mp4 [nome-da-pasta] [fps]
# Ex.:  npm run frames -- videos/hero.mp4 hero-v2 12
# Depois atualize HERO_SEQUENCE em components/HeroSequence.tsx (pasta e total de frames).
set -euo pipefail
VIDEO="${1:?informe o caminho do vídeo}"
NAME="${2:-hero-v1}"
FPS="${3:-12}"
OUT="public/seq/$NAME"
mkdir -p "$OUT"
rm -f "$OUT"/*.webp
ffmpeg -v error -y -i "$VIDEO" -an -vf "fps=$FPS,scale='min(1920,iw)':-2:flags=lanczos" \
  -c:v libwebp -quality 72 -compression_level 6 "$OUT/f%03d.webp"
echo "$(ls "$OUT" | wc -l) frames em $OUT ($(du -sh "$OUT" | cut -f1))"
