# Prompts para gerar imagens que viram 3D (Grok → Meshy/Tripo)

## Regras
Um objeto só, inteiro e centralizado, vista 3/4 levemente de cima, fundo liso off-white, luz de estúdio suave, sem sombra projetada, sem texto nem logo, 1:1.
Exportar em **GLB** com PBR, até ~50 mil polígonos (copo até ~30 mil; grão reduzido a 3–5 mil faces, pois será instanciado centenas de vezes). Conferir a licença da ferramenta antes de usar no site.

**Bloco final (colar em todos):**
```
Single object only, fully visible and centered with margin around it, 3/4 view from slightly above, isolated on a plain seamless off-white background, soft even studio lighting, no cast shadows, no reflections of the environment, no text, no logos, no props, photorealistic product render, sharp details, 1:1
```

## Suporte de coado (sem a espiral; ela é feita em código)
```
A premium pour-over coffee stand, product design object. An oval walnut wood base, a tall slim vertical brushed steel rod on the back left topped with a flat brass half-sun finial with short straight rays, a horizontal brass arm holding a thin brass ring at about two thirds of the rod height. Sitting in the ring, a glossy deep burgundy (#6A1E1E) ceramic V60 cone dripper with a thin gold rim. At the dripper tip, only a short brass outlet collar pointing straight down. No spiral, no coil, no glass tube. Below the dripper there is a very large empty space down to the wooden base, at least half of the total height. Empty, no coffee, no liquid, no cup, no kettle. Minimal, luxurious, elegant proportions.
```

## Chaleira bico de ganso
```
A premium gooseneck pour-over kettle, elegant slim curved gooseneck spout, rounded body with a flat bottom, matte burgundy (#6A1E1E) enamel body, polished brass spout, brass lid knob shaped like a small sun with short straight rays, curved brass handle with a cream (#F8EACF) ceramic grip, minimal and luxurious design.
```

## Moedor
```
A premium electric burr coffee grinder, tall cylindrical body in matte cream (#F8EACF) ceramic finish, wide open funnel-shaped hopper on top in glossy burgundy (#6A1E1E) with no lid, so the inside of the hopper is visible, a polished brass dial ring in the middle, a short brass chute in the front, and a small burgundy catch cup under the chute, round walnut wood base, minimal Scandinavian luxury design.
```

## Grão de café
```
A single roasted coffee bean, medium roast, glossy dark brown surface with natural subtle variations, a clearly visible center crease, the flat side facing the camera and slightly tilted. One bean only, perfectly sharp macro product render.
```
(Gerar também uma vista do verso, abaulado, para ajudar a conversão.)

## Gelo (só a forma; o material transparente é aplicado em código)
```
A single irregular ice cube, shape study. Frosted opaque white matte ice so the shape is clearly visible, slightly melted rounded edges, subtle surface cracks, slightly uneven faces. One ice cube only, sharp product render.
```
Gerar 2–3 formas diferentes. Converter primeiro a mais opaca.

## Textura de pó de café
```
Top-down macro photograph of freshly ground coffee, medium grind, filling the entire frame edge to edge, uniform, seamless tileable texture, flat even lighting, no objects, no cup, no spoon, no shadows, photorealistic, 1:1
```

## Copo da marca (a partir da foto do copo; vazio, sem gelo nem café)
```
Edit this image: keep the same cup, same burgundy color, same cream interior, same sun pattern. Make it look like a real physical paper cup photographed in a studio: matte uncoated paper with fine visible fibers, a thin vertical glued seam on the side, a thick rolled rim with visible thickness and a soft shadow under it, a curled rolled bottom edge visible at the base, the orange parts of the pattern printed as a subtle metallic hot-foil finish, tiny natural imperfections, soft shading. 3/4 view from slightly above, centered, isolated on a plain seamless off-white background, soft even studio lighting, no cast shadows, no ice, no coffee, no text, photorealistic product render, 1:1
```

## Suporte com espiral de vidro (referência visual, não converter)
A imagem com a espiral de vidro serviu de referência de proporção; a serpentina é feita em código, saindo do colar de latão e terminando bem acima da base, deixando espaço para o copo.
