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

## Pendências
**Com o Christian**
- Enviar os GLB: grão, gelo (2 ou 3 formas), suporte sem espiral, chaleira, moedor, copo vazio.
- **Logo oficial em vetor (SVG/PDF/AI)** — o símbolo atual (`lib/soisSymbol.ts`) é provisório.
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
