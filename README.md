# Sóis Café · Goa: site

Site com scroll cinematográfico: o vídeo do hero vira uma sequência de frames que o scroll comanda.

## Rodar localmente

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de produção
```

## Stack

- Next.js (App Router), React, TypeScript
- GSAP + ScrollTrigger (animações ligadas ao scroll)
- Lenis (scroll suave)
- Fontes: Cormorant Garamond (títulos) e Jost (textos)

## Estrutura

| Arquivo | O que faz |
|---|---|
| `components/film/Film.tsx` | Hero do site: filme de 6 tomadas esfregado pelo scroll (preloader, capítulos, palavras gigantes, cores por capítulo) |
| `components/film/chapters.ts` | Roteiro do filme: trecho do scroll, textos, palavra, cor e recorte do celular de cada capítulo |
| `public/video/` | Tomadas em MP4 (H.264) e WebM (VP9), sem áudio, com pôster WebP |
| `components/CoffeeSpill.tsx` | Transição do café derramando que abre o cardápio |
| `components/story/Story.tsx` | História 3D anterior (não usada na página; mantida como referência) |
| `components/story/StoryScene.tsx` | Canvas 3D, luzes, bancada, câmera guiada pelo scroll e pós-produção |
| `components/story/layout.ts` | Escalas, pontos de encaixe dos modelos, linha do tempo e câmera (tudo ajustável aqui) |
| `components/story/*.tsx` | Grãos, moedor, estação de coado + chaleira, copo da Sóis, café no copo, gelo |
| `components/three/liquid/` | Líquido em código (fio, gotas, superfície, serpentina) — também em `/teste-liquido` |
| `public/models/` | GLBs comprimidos (meshopt + WebP). Os originais pesados ficam fora do repositório |
| `components/HeroSequence.tsx` | Hero antigo em frames: agora é o fallback (sem WebGL ou com movimento reduzido) |
| `components/SoisSymbol.tsx` | Símbolo oficial dos dois sóis em SVG (geometria em `lib/soisSymbol.ts`) |
| `components/ScrollEffects.tsx` | Reveals, parallax, zoom e texto do manifesto |
| `components/SmoothScroll.tsx` | Scroll suave + links internos |
| `app/page.tsx` | Seções: copo, manifesto, cardápio (provisório), visite e rodapé |
| `app/globals.css` | Paleta da marca e estilos |

## Protótipo 3D (`/prototipo-3d`)

Cena em tempo real com Three.js (React Three Fiber), separada do site atual:

| Arquivo | O que faz |
|---|---|
| `components/three/Experience.tsx` | Canvas, câmera, luzes, linha do tempo do scroll e textos |
| `components/three/Beans.tsx` | Grãos 3D que formam o símbolo dos dois sóis e depois caem |
| `components/three/Cup.tsx` | Copo com a estampa da marca, fio de café, nível subindo e gelo |
| `components/three/assets.ts` | Geometria do grão e texturas geradas em código (estampa e parede com sombra de palmeira) |
| `lib/soisSymbol.ts` | Traços do símbolo, usados pelo SVG, pelos grãos e pela estampa |

## Trocar uma tomada do hero

1. Codifique sem áudio e com keyframe curto (o scroll precisa saltar rápido):
   ```bash
   ffmpeg -i tomada.mp4 -an -vf "scale=1280:720,format=yuv420p" -c:v libx264 -crf 26 -g 4 -keyint_min 4 -bf 0 -movflags +faststart public/video/3-agua.mp4
   ffmpeg -i public/video/3-agua.mp4 -c:v libvpx-vp9 -b:v 0 -crf 36 -g 4 -row-mt 1 -an public/video/3-agua.webm
   ffmpeg -i public/video/3-agua.mp4 -frames:v 1 -quality 72 public/video/3-agua.webp
   ```
2. Se a duração mudar muito, ajuste `from`/`to` do capítulo em `components/film/chapters.ts`.

## Pendências de material

- Logo oficial em SVG nativo (o atual foi reconstruído a partir do PDF do Canva, que contém só imagem)
- Fotos de gelo real para refinar o material do gelo
- Vídeo da cena 3b (copo bordô) em alta resolução
- Cenas 4, 5 e 6 (cardápio, a casa, pôr do sol)
- Cardápio oficial, endereço, horário e link do Instagram
