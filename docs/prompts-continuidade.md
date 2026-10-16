# Plano-sequência contínuo — prompts (Gemini para imagens, Grok para vídeos)

## A ideia
Uma única **torre do ritual**, montada na vertical sobre uma base de nogueira, e a câmera **descendo sem corte**, seguindo a gravidade:

grãos caindo → funil do moedor → bica → pó caindo no V60 → água da chaleira → café saindo do V60 para a serpentina de vidro → serpentina → copo da Sóis → **a mão do barista põe o gelo e leva o copo** → mesa com o cardápio e gente ao fundo → a câmera sai pela janela e mostra a fachada com a placa e as palmeiras → sobe para o mar no pôr do sol, com o sol e o reflexo formando **dois sóis**.

Do macro ao plano aberto sem nenhum corte: o copo é o fio que puxa a câmera para fora.

Cada peça encaixa na de baixo, então a história não precisa de transição: é o mesmo lugar, a mesma luz e a mesma câmera o tempo todo.

**Mãos e pessoas:** é onde a IA mais erra (dedos, objetos que derretem). Por isso: uma mão só, manga de linho creme, gesto simples e lento; pessoas sempre ao fundo e desfocadas. **Placa e cardápio:** a IA escreve errado. Peça sem letras legíveis; o nome e o cardápio de verdade eu coloco por cima no site.

**Truque para manter tudo igual:** primeiro gere UMA imagem mestra da torre inteira (M). Todas as imagens-chave (K1–K7) saem dela, como "closes" de regiões dessa mesma imagem.

**Ordem de trabalho**
1. Gemini: imagem mestra M (anexe também `public/img/casa-placa.jpg` para K9; as referências: `referencias/cena3b-copo-provisorio.jpg` ou `public/img/copo-bordo.jpg` para o copo, e um quadro de cada vídeo atual para o estilo).
2. Gemini: K1 a K10, sempre anexando M **e** a imagem-chave anterior.
3. Upscayl em todas as imagens (mínimo 1920 px de largura).
4. Grok: um vídeo por par de imagens (V1 começa em K1, V2 começa no **último quadro** do V1, e assim por diante). Se o gerador aceitar imagem final, use K(n+1) como final.
5. Video2X → Flowframes → me mande os arquivos.

Mantenha a torre **no centro** do quadro: assim eu recorto a versão de celular sem perder nada.

---

## Bloco de estilo (cole no fim de TODOS os prompts)

```
Style: photorealistic luxury product commercial, macro cinematography, 85mm lens, shallow depth of field, soft warm golden-hour light from the upper left, warm cream plaster wall background (#F8EACF) with soft blurred palm-leaf shadows, burgundy glazed ceramic (#6A1E1E) and brushed brass details, dark walnut wood, rich coffee browns, gentle film grain, 16:9, centered vertical composition. No text, no letters, no words, no logos, no watermarks, no people, no hands.
```

---

**Variante do bloco (K7 em diante, onde entram mão e pessoas):** troque o final `No text, no letters, no words, no logos, no watermarks, no people, no hands.` por:
```
No text, no letters, no words, no logos, no watermarks. Hands must be anatomically correct with five fingers, moving slowly. Any people stay in the soft blurred background.
```

---

## Imagens (Gemini)

### M — imagem mestra da torre inteira (formato vertical 9:16)
```
Create one tall vertical image of a single coffee-ritual tower standing on an oval dark walnut base, centered, front view, everything aligned on one vertical axis, top to bottom:
1. coffee beans falling from above into
2. an open burgundy ceramic grinder funnel with a brass ring, on a cream cylindrical grinder body with a round brass knob and a short brass spout;
3. right below the spout, a burgundy ceramic V60 pour-over dripper with a thin gold rim, held by a brass ring on a thin steel stand topped with a small brass half-sun finial;
4. under the V60, a clear glass spiral coil (serpentine) with 4 loops, filled with amber coffee;
5. at the bottom, a burgundy paper cup with a cream rim and a repeating pattern of orange and cream half-suns (use the attached cup as reference), on the walnut base.
A burgundy gooseneck kettle with a brass sun-shaped lid knob stands at the right side, near the V60.
Everything physically connected, realistic proportions, same light on every object.
[STYLE BLOCK]
```

### K1 — grãos caindo no funil
```
Using the attached master image, render a close-up of the top of the same tower: coffee beans falling in mid-air into the burgundy grinder funnel. Keep every object, color, material, light and background identical to the master image. Camera at the height of the funnel, centered.
[STYLE BLOCK]
```

### K2 — bica soltando o pó
```
Using the attached master image and the attached previous frame, move the camera straight down from the previous frame to the brass spout of the same grinder: fresh coffee grounds pouring from the spout. The top of the V60 is just entering the bottom of the frame. Same objects, same light, same background, same lens; only the camera height changed.
[STYLE BLOCK]
```

### K3 — pó no V60
```
Using the attached master image and the attached previous frame, move the camera straight down to the burgundy V60 with the gold rim: the last grounds falling from the spout above into a fresh mound of coffee grounds inside the V60. The brass half-sun finial of the stand is visible at the left. Same objects, light and background; only the camera height changed.
[STYLE BLOCK]
```

### K4 — água em círculos
```
Using the attached master image and the attached previous frame, keep the same camera position. The burgundy gooseneck kettle enters from the right and pours a thin stream of hot water in slow circles onto the coffee bed in the V60. The bed blooms with fine bubbles, a little soft steam rises. Nothing else changes.
[STYLE BLOCK]
```

### K5 — a serpentina
```
Using the attached master image and the attached previous frame, move the camera straight down below the V60: amber coffee flows from the brass outlet into the clear glass spiral coil, filling the 4 loops. The bottom of the V60 is at the top of the frame, the rim of the burgundy cup just appears at the bottom. Same objects, light and background; only the camera height changed.
[STYLE BLOCK]
```

### K6 — café chegando no copo
```
Using the attached master image and the attached previous frame, move the camera straight down to the burgundy cup with the orange and cream half-sun pattern (attached reference): a thin stream of coffee falls from the end of the glass coil into the cup, which is almost full of dark coffee. Same objects, light and background; only the camera height changed.
[STYLE BLOCK]
```

### K7 — a mão do barista põe o gelo
```
Using the attached master image and the attached previous frame, same cup, same light, same camera. A barista's hand in a cream linen sleeve holds brass ice tongs and drops a clear ice cube into the coffee; two cubes already float, a small splash crown rises.
[STYLE BLOCK — variante]
```

### K8 — o copo na mesa, com o cardápio
```
Continue the same scene: the hand has carried the burgundy cup with ice to a walnut café table next to a sunny window and set it down beside a cream menu card with a burgundy border (the card has only abstract lines, no readable text). Palm-leaf shadows fall across the table. In the soft blurred background, two friends talk and smile at another table. Same warm golden light and colors as the previous frame.
[STYLE BLOCK — variante]
```

### K9 — a fachada (anexe public/img/casa-placa.jpg)
```
Continue the same story outside: the front of the same café seen from the street in late-afternoon light. Cream plaster facade, burgundy details, the round sign from the attached photo showing only the two-half-suns symbol (no lettering), tall palm trees, people blurred at small outdoor tables, the sea glimpsed at the end of the street. Same warm golden palette.
[STYLE BLOCK — variante]
```

### K10 — pôr do sol, dois sóis
```
Continue the same story: the camera has risen above the café and faces the sea at sunset. A large orange sun touches the horizon and its reflection on the calm water forms a second sun right below it, the two shapes meeting like the café's two-half-suns symbol. Palm silhouettes at the edges, the café terrace softly lit in the foreground. Warm orange, burgundy and cream sky.
[STYLE BLOCK — variante]
```

---

## Vídeos (Grok — imagem → vídeo, 6 a 8 segundos cada)

Regra para todos: comece cada vídeo pelo **último quadro** do anterior (eu extraio esses quadros se você me mandar os vídeos). Cole o bloco de movimento no fim de cada prompt:

```
Motion: one single continuous camera move, very slow and smooth, constant speed, no cuts, no zoom jumps, no camera shake, no new objects appearing, objects do not change shape or color, physically realistic liquid and particles, 24fps. No text, no letters, no logos.
```

**V1 (K1 → K2)**
```
Coffee beans fall in slow motion into the burgundy funnel and settle. The camera slowly cranes straight down along the cream grinder body to the brass spout, where fresh grounds start pouring out.
[MOTION BLOCK]
```

**V2 (K2 → K3)**
```
Coffee grounds pour from the brass spout in a fine stream. The camera slowly cranes down, following the falling grounds, until the burgundy V60 fills the frame with a fresh mound of grounds.
[MOTION BLOCK]
```

**V3 (K3 → K4)**
```
The camera holds still on the V60. The burgundy gooseneck kettle slowly enters from the right and pours a thin stream of hot water in slow circles; the coffee bed blooms and bubbles, soft steam rises.
[MOTION BLOCK]
```

**V4 (K4 → K5)**
```
Coffee starts dripping from the bottom of the V60. The camera slowly cranes down, following the amber coffee as it enters the clear glass spiral coil and travels loop after loop.
[MOTION BLOCK]
```

**V5 (K5 → K6)**
```
The camera keeps following the amber coffee down the last loops of the glass coil until it falls in a thin stream into the burgundy cup with the half-sun pattern, filling it.
[MOTION BLOCK]
```

**V6 (K6 → K7)**
```
The coffee stream stops. A barista's hand in a cream linen sleeve enters slowly from the right with brass ice tongs and drops clear ice cubes one by one into the cup; small splash crowns and droplets in slow motion.
[MOTION BLOCK]
```

**V7 (K7 → K8)**
```
The hand gently lifts the cup with ice. The camera follows the cup as it is carried a few steps and set down on a sunny walnut table beside a cream menu card; friends talk in the soft blurred background.
[MOTION BLOCK]
```

**V8 (K8 → K9)**
```
The camera keeps moving backward, slowly gliding out through the open window to the street, revealing the cream café facade with the round sun-symbol sign, palm trees swaying and people at outdoor tables.
[MOTION BLOCK]
```

**V9 (K9 → K10)**
```
The camera slowly cranes up over the café and turns toward the sea; the sun lowers to the horizon and its reflection on the water forms a second sun below it. Palm leaves move gently in the breeze.
[MOTION BLOCK]
```

No V6 a V9 troque no bloco de movimento `no new objects appearing` por `hands and people move naturally and slowly`.

---

## Depois da geração
1. **Imagens** → Upscayl (modelo "Real-ESRGAN" / "Ultrasharp", 2× ou 4×) **antes** de ir para o vídeo.
2. **Vídeos** → Video2X (Real-ESRGAN para imagens reais, saída 1920×1080) → Flowframes (RIFE, 2×, de 24 para 48 fps).
3. Exporte em alta qualidade (MP4 H.264 com qualidade alta, ou ProRes) **sem** comprimir para web: eu faço a versão final do site (scroll, celular, tamanho).

Se algum vídeo sair com texto, objeto trocado ou corte no meio, descarte e gere de novo: no scroll qualquer "pulo" aparece.
