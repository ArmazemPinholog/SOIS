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
| `components/story/Story.tsx` | Hero do site: história 3D por scroll (preloader, capítulos, índice) com fallback para o vídeo |
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

## Trocar o vídeo do hero

1. Gere os frames em uma pasta nova (evita cache antigo):
   ```bash
   npm run frames -- caminho/do/video.mp4 hero-v2 12
   ```
2. Em `components/HeroSequence.tsx`, atualize `HERO_SEQUENCE` (`folder` e `count`).
3. Ajuste em que ponto do scroll cada texto aparece (linha do tempo `tl`), se as cenas mudarem de duração.

## Pendências de material

- Logo oficial em SVG nativo (o atual foi reconstruído a partir do PDF do Canva, que contém só imagem)
- Fotos de gelo real para refinar o material do gelo
- Vídeo da cena 3b (copo bordô) em alta resolução
- Cenas 4, 5 e 6 (cardápio, a casa, pôr do sol)
- Cardápio oficial, endereço, horário e link do Instagram
