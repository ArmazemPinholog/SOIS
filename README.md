# Sóis Café · Goa: site

Site com scroll cinematográfico: o hero é um plano-sequência de vídeos que o scroll comanda, montado em WebGL.

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
| `components/ritual/Ritual.tsx` | **Hero do site ("Ritual")**: abertura com o copo girando dentro das letras de SÓIS, câmera que atravessa as letras, plano-sequência de 10 tomadas encadeadas sem corte (grão → pôr do sol com dois sóis) esfregado pelo scroll, 8 capítulos de texto, final em quadro com o convite |
| `components/ritual/script.ts` | Roteiro do hero: tomadas (`SHOTS`, com o encaixe medido de cada emenda), capítulos de texto, transições, textos, dados do painel lateral (provisórios) e o "segure para servir" |
| `components/ritual/RitualGL.ts` | Compositor WebGL: vídeos viram textura, máscara das letras, transições, quadro do final; sem WebGL os `<video>` aparecem direto |
| `components/ritual/shaders.ts` | Shader das transições (tinta, onda, gota, emenda), aberração cromática pela velocidade do scroll, grão, vinheta e o "sol" que segue o mouse |
| `components/ritual/fx.ts` | Botões magnéticos, timecode, download dos vídeos em blob e curvas de easing |
| `components/ritual/ritual.css` | Layout do hero, tons por capítulo, HUD, preloader, selo giratório, botões |
| `components/HomePage.tsx` | Página inicial com o hero trocável: `/` usa o Ritual, `/filme` mostra o hero anterior para comparar |
| `components/film/Film.tsx` | Hero anterior (em `/filme`): filme de 6 tomadas num quadro à direita, palavras gigantes e cores por capítulo |
| `components/film/chapters.ts` | Roteiro do filme: trecho do scroll, textos, palavra, cor e recorte do celular de cada capítulo |
| `public/video/` | Tomadas em MP4 (H.264) e WebM (VP9), sem áudio, com pôster WebP |
| `components/CoffeeSpill.tsx` | Café escorrendo (filmagem real) que abre o cardápio: `public/video/cafe-escorrendo*.mp4/webm`, a partir de "Chocolate syrup covering a green background" (Mixkit, licença gratuita), com o verde removido e a cor ajustada para café |
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
| `app/page.tsx` | Página inicial (hero Ritual + seções de `components/HomePage.tsx`: copo, manifesto, cardápio provisório, visite, rodapé) |
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

## Efeitos do hero (Ritual)

Um momento central (o copo dentro das letras e a câmera atravessando) e o resto construído em volta:

- **WebGL (shader próprio)**: vídeo dentro do texto com zoom que atravessa a letra · transições entre tomadas por tinta, onda e gota · aberração cromática e ondulação pela velocidade do scroll · grão de filme, vinheta e gradação · paralaxe do vídeo pelo mouse · "sol" de luz que segue o cursor na abertura · vídeo que encolhe até virar quadro com sombra · tingimento bordô dentro das letras
- **3D**: grãos reais (GLB instanciado) formam o símbolo, fogem do cursor e explodem em direção à tela
- **Vídeo**: tomadas esfregadas pelo scroll (baixadas inteiras em blob), café real escorrendo entre Moagem e Água, pôster como textura enquanto o vídeo chega
- **Texto (GSAP)**: letras que sobem girando em 3D (SplitText) · palavras que acendem com o scroll · textos embaralhados (ScrambleText) · contadores · odômetro do número do capítulo · timecode do vídeo
- **CSS**: palavra gigante em contorno que se preenche com o scroll (com `mix-blend-mode`) · véu de leitura que muda de tom por capítulo · vidro fosco (`backdrop-filter`) · selo de texto circular com borda em `conic-gradient` · botões com brilho que atravessa e texto que rola · preloader com cortina dupla e símbolo desenhado
- **Interação**: scroll suave (Lenis) · cursor da marca · botões magnéticos · índice de capítulos clicável · "segure para servir" no capítulo Água
- **Acessibilidade e celular**: texto real para leitores de tela, sem WebGL cai nos `<video>`, movimento reduzido desliga o scroll suave e os efeitos de velocidade, layout próprio no celular

Para ajustar o ritmo, mexa em `components/ritual/script.ts` (trechos `from`/`to` de `SHOTS` e `CHAPTERS`, `INTRO`, `CARD`, `TOTAL_VH`). Os originais das tomadas ficam em `S/V/` (V1…V9b); as versões do site em `public/video/ritual/`.

## Trocar uma tomada do hero

1. Codifique sem áudio e com keyframe curto (o scroll precisa saltar rápido):
   ```bash
   ffmpeg -i tomada.mp4 -an -vf "scale=1280:720,format=yuv420p" -c:v libx264 -crf 26 -g 4 -keyint_min 4 -bf 0 -movflags +faststart public/video/3-agua.mp4
   ffmpeg -i public/video/3-agua.mp4 -c:v libvpx-vp9 -b:v 0 -crf 36 -g 4 -row-mt 1 -an public/video/3-agua.webm
   ffmpeg -i public/video/3-agua.mp4 -frames:v 1 -quality 72 public/video/3-agua.webp
   ```
2. Se a duração mudar muito, ajuste `from`/`to` do capítulo em `components/ritual/script.ts` (e em `components/film/chapters.ts`, se quiser manter o `/filme` igual).

## Pendências de material

- Logo oficial em SVG nativo (o atual foi reconstruído a partir do PDF do Canva, que contém só imagem)
- Fotos de gelo real para refinar o material do gelo
- Vídeo da cena 3b (copo bordô) em alta resolução
- Cenas 4, 5 e 6 (cardápio, a casa, pôr do sol)
- Cardápio oficial, endereço, horário e link do Instagram
- Dados do painel lateral do hero (torra, dose, temperatura etc. em `components/ritual/script.ts`): são provisórios, confirmar com a Sóis
