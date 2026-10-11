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
| `components/HeroSequence.tsx` | Hero: canvas com a sequência de frames e os textos de cada cena |
| `components/SoisSymbol.tsx` | Símbolo dos dois sóis em SVG (**provisório**, trocar pelo vetor oficial) |
| `components/ScrollEffects.tsx` | Reveals, parallax, zoom e texto do manifesto |
| `components/SmoothScroll.tsx` | Scroll suave + links internos |
| `app/page.tsx` | Seções: copo, manifesto, cardápio (provisório), visite e rodapé |
| `app/globals.css` | Paleta da marca e estilos |

## Trocar o vídeo do hero

1. Gere os frames em uma pasta nova (evita cache antigo):
   ```bash
   npm run frames -- caminho/do/video.mp4 hero-v2 12
   ```
2. Em `components/HeroSequence.tsx`, atualize `HERO_SEQUENCE` (`folder` e `count`).
3. Ajuste em que ponto do scroll cada texto aparece (linha do tempo `tl`), se as cenas mudarem de duração.

## Pendências de material

- Logo oficial em SVG
- Vídeo da cena 3b (copo bordô) em alta resolução
- Cenas 4, 5 e 6 (cardápio, a casa, pôr do sol)
- Cardápio oficial, endereço, horário e link do Instagram
