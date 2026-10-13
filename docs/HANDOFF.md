# Sóis Café · Goa — passagem de contexto (sessão na nuvem → sessão local)

Documento para retomar o projeto numa sessão local. O histórico completo ficou na conversa da nuvem; aqui está o que importa.

## Regra de trabalho combinada com o Christian
**Não alterar nem aplicar nada no código antes de ele pedir.** Primeiro avaliar, explicar e propor; só implementar quando houver pedido explícito.

## O projeto
Site premium para a **Sóis Café · Goa** (cafeteria; conceito "dois sóis que se encontram como um só": quatro amigos, quatro histórias, um destino). Referências de estilo: sites de café com scroll cinematográfico e objetos em 3D (developer.jot, enkywebstudio "Wake the Beans", "Pour/Play", "Premium The Lines").

### Identidade visual
- Bordô `#6A1E1E`, Amarelo `#F6D44D`, Creme `#F8EACF`, Café `#30211A`, mais o laranja dos raios (~`#E0892F`).
- Logo: dois meios-sóis de raios retos formando um "S" (laranja em cima, bordô embaixo), com "SÓIS" em serifa e "CAFÉ · GOA" espaçado.
- Slogan: "Good coffee, bright people, same sun." / "Dois sóis. Um só café."
- Tipografia do site: Cormorant Garamond (títulos) + Jost (texto).

## Estado do repositório (`ArmazemPinholog/SOIS`, branch `master`)
- Next.js 16 + React 19 + TypeScript, GSAP/ScrollTrigger, Lenis, Three.js (React Three Fiber + drei).
- **Site atual (`/`)**: hero com sequência de 360 frames (vídeo gerado por IA, cenas café→grãos→gelo) controlada pelo scroll, depois seções: copo, faixa de valores, manifesto, cardápio (provisório), visite, rodapé. Funciona e foi testado em desktop e celular.
- **Protótipo 3D (`/prototipo-3d`)**: grãos 3D formam o símbolo e caem; estação de coado com coador, serpentina de vidro com o café percorrendo o tubo, café caindo no copo da Sóis com gelo. Tudo gerado em código (ver `components/three/`).
- Detalhes de arquivos no `README.md`.

## Decisão de arquitetura (3D)
Abordagem **híbrida**:
- **Modelos GLB** (gerados por imagem no Grok → Meshy/Tripo) só para a *forma* dos objetos sólidos.
- **Em código**: materiais (gelo e vidro transparentes, estampa e folha metálica do copo), líquidos, partículas, pó de café, espiral de vidro, câmera e linha do tempo do scroll.
- Líquido **não** via modelo 3D (é dinâmico). Se não ficar bom em código, usar os vídeos de respingo já gerados só nesse momento.
- Imagem→3D erra vidro/gelo transparente: gerar o gelo fosco/opaco para capturar a forma e aplicar o material transparente em código. Mesma ideia para a estampa do copo: usar o GLB só para a forma e reaplicar a estampa a partir do logo vetorial (UV cilíndrico recalculado em código).

## Imagens aprovadas (geradas pelo Christian; ainda não estão no repo)
Aprovadas para virar 3D: suporte sem a espiral (base oval de nogueira, haste de aço com remate de meio-sol de latão, anel de latão, V60 bordô com borda dourada, colar de saída de latão), chaleira bico de ganso (bordô, latão, botão de tampa em forma de sol, cabo creme), moedor (corpo creme, funil bordô aberto, latão, copinho bordô, base de nogueira), grão de café (macro realista), gelos (3 formas; converter primeiro o opaco), textura de pó de café, copo da marca vazio (bordô, interior creme, estampa dos sóis em laranja e creme, emenda lateral).
Os prompts usados estão em `docs/prompts-3d.md`.

## Atualização 12/10/2026 (sessão local)
- **Hero do site (`/`) virou a história 3D** (`components/story/`): grãos reais formam o símbolo oficial → voam para o funil do moedor → pó cai no copinho → chaleira despeja água em círculos no V60 (cama de pó + café subindo) → café pela serpentina de vidro → cubos de gelo caem no copo da Sóis → café cai sobre o gelo → copo gira no final. Câmera e textos guiados pelo scroll; pós-produção com grão de filme, vinheta, brilho, aberração ligada à velocidade e profundidade de campo nos planos do copo. Sem WebGL ou com movimento reduzido, cai no vídeo antigo (`HeroSequence`).
- **Modelos**: GLBs do Tripo (~61 MB e ~2 mi triângulos cada) comprimidos para `public/models/` (meshopt + WebP; total ~2,2 MB). Grão com 1,1 mil triângulos (instanciado), gelo com 6 mil (suavizado em código), demais com 40 mil.
- **Copo**: perfil medido no `copo.glb` (parede cônica r = 0,3017 + 0,1162·y, borda enrolada) e reconstruído por revolução, porque o GLB trazia os sóis em relevo. Estampa gerada do símbolo oficial, laranja com folha metálica.
- **Símbolo oficial** extraído do `logo.pdf` por ajuste geométrico (`lib/soisSymbol.ts`): duas hastes por meio-sol, 9 e 11 raios, arco em crescente.
- **Líquido em código** (`components/three/liquid/`) e laboratório em `/teste-liquido`.
- Medidas de encaixe (funil, bica, colar do V60, bico da chaleira) estão em `components/story/layout.ts`.

## Atualização 12/10/2026 (2) — história em cascata vertical
Pedido do Christian: as etapas estavam desconectadas e o gelo "caía do nada". A história virou uma **cascata no eixo do V60**, seguindo a gravidade:
símbolo de grãos no alto → grãos despencam no funil → **moedor em vista explodida** (o GLB foi separado em funil, corpo, base e copinho; base e copinho se afastam) → **pó cai da bica direto na cama do V60** → peças do moedor sobem e somem → **onda de café atravessa a tela** (transição, camada própria fora da pós-produção) → chaleira despeja em círculos → serpentina → copo enche → **cubos de gelo caem dentro do café com coroa de respingo e gotas** (guiado pelo scroll, reversível) → copo gira no final.
Arquivos: `Grinder.tsx` (separação e explosão), `Ice.tsx` (gelo + coroa), `LiquidWipe.tsx` (onda), linha do tempo e câmera em `layout.ts`.

## Atualização 12/10/2026 (3) — hero em vídeo (filme por scroll)
O Christian achou a cascata 3D "artificial". O hero virou um **filme de 6 tomadas geradas por IA** (imagens-chave K0–K6 → vídeos no Grok), esfregadas pelo scroll (`components/film/`):
- `chapters.ts`: capítulos, trecho do scroll de cada um, palavra gigante, textos, tema de cor e foco do recorte no celular.
- `Film.tsx`: baixa cada vídeo inteiro (blob) para o scroll ir e voltar sem travar; escolhe MP4/H.264 (Safari) ou WebM/VP9 (Chrome, Firefox, Android); transição suave entre tomadas; o vídeo final (copo girando) roda em loop atrás do texto final.
- Layout editorial: quadro do vídeo à direita, palavra gigante atrás (GRÃO, MOER, FLORESCER, VOLTA, GELO, SOL), texto à esquerda, cor de fundo por capítulo (creme, areia, bordô, laranja, creme claro, café).
- Vídeos em `public/video/` (`1-origem` … `6-final`, `.mp4` + `.webm` + pôster `.webp`). Origem, Moagem e Final vieram em 752×416 e passaram por upscale com Real-ESRGAN (realesr-general-x4v3); Serpentina recortada embaixo (o Grok escreveu "Sois" no copo); Gelo começa em 3,9 s (antes repetia o café enchendo e tinha uma folha verde). Áudio removido. Codificação com keyframe a cada 4 quadros para o scroll responder rápido.
- **Café escorrendo** (`components/CoffeeSpill.tsx`): entre o manifesto e o cardápio, filmagem real de líquido escorrendo (Mixkit, "Chocolate syrup covering a green background", licença gratuita) com o verde removido por chroma key com "unmix" e a cor puxada para café; versão larga (recorte do topo) e vertical para celular, controladas pelo scroll.
- **Logo de grãos 3D** (`components/film/BeanLogo.tsx`): na abertura, grãos reais (GLB) formam o símbolo oficial e, ao rolar, caem no funil do primeiro vídeo.
- **Serpentina nova** (13/10): take refeito pelo Christian com o tubo saindo do bico; usamos só 0–3,0 s (depois volta a cair um fio pelo meio da espiral), com upscale Real-ESRGAN.
- **Abertura, segure para servir, cursor, quadros de detalhe e café nas emendas**: ver `components/film/` (`Film.tsx`, `LiquidLayer.tsx`, `BeanLogo.tsx`) e `components/Cursor.tsx`. O travamento do "segure" só acontece para quem rola aos poucos; saltos e links do menu (`window.__soisNav`) passam direto.
- A história 3D (`components/story/`) continua no repositório, mas não é mais usada na página.

## Atualização 13/10/2026 — objetos recortados (fundo verde)
- O Christian refez as 6 tomadas no Grok com fundo verde. O script de recorte (`docs/recorte-verde.py`) recorta com chave adaptativa (o verde que amarela vira superfície ajustada por quadro), remove reflexos marcados e gera `public/video/obj/N-*.mp4|webm` com **cor em cima e alfa embaixo**.
- `components/film/ObjectStage.tsx` desenha os objetos em WebGL com transparência real sobre a cor do capítulo; o shader puxa reflexos verdes para dourado/âmbar e suaviza as bordas de cima/baixo.
- Passagens: Origem→Moagem a câmera desce; as demais são passagens limpas (a cena se aproxima e some, a próxima entra) — nunca dois objetos sobrepostos. Sombra de palmeira agora é do site (`.film__palm`).
- Café nas emendas e quadro de detalhe saíram; o café real (vídeo novo do Christian) ficou só antes do cardápio.

## Pendências
**Com o Christian**
- Testar a história no notebook e no celular reais (FPS e sensação do scroll); a nuvem só renderiza por software.
- Fotos de gelo real (para o material do gelo) e, se existir, o logo em SVG nativo.
- Conteúdo real: cardápio, endereço, horário, Instagram.
- Publicar na Vercel: o conector da nuvem não tem permissão no time `astrovia-solutions` (403). Caminho: vercel.com/new → importar `ArmazemPinholog/SOIS` → Deploy (Next.js é detectado sozinho; liberar a organização no GitHub App se o repo não aparecer).

**Com o Claude (quando o Christian pedir)**
1. Líquido em código: fio de café com shader, gotas, ondas na superfície, café na serpentina, água da chaleira. Começar por um teste isolado, por ser a parte de maior risco.
2. Pó de café: partículas na saída do moedor, monte no copinho, camada no coador (textura de pó já aprovada).
3. Integrar os GLB (compressão com gltf-transform/draco, escala, posição, materiais) e montar a linha do tempo: grão → moedor → chaleira + coador/serpentina → copo.
4. Copo: forma do GLB + estampa pelo logo vetorial, textura de papel, folha metálica no laranja, borda com espessura, emenda no lado, gotas de condensação, sombra interna.
5. Ajustes já identificados: tom do café mais âmbar na serpentina; conferir a estação no celular (copo e câmera em retrato); trocar o coador de vidro simples pelo V60 bordô com borda dourada.
6. Passar o 3D para o site principal, otimizar performance no celular e reduzir/remover a sequência de frames onde o 3D substituir o vídeo.
7. Cenas de vídeo restantes (4 cardápio, 5 a casa, 6 pôr do sol) — prompts na conversa original, opcionais agora.

## Como rodar
```bash
npm install
npm run dev   # http://localhost:3000  e  /prototipo-3d
```
Verificação rápida de tipos: `npx tsc --noEmit -p .`
