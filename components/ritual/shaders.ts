/* Shaders do compositor do hero (WebGL 1, um único quad na tela inteira).
   Coordenadas: `frag` em px do buffer com origem no canto de cima à esquerda (y para baixo),
   igual ao layout do CSS; as texturas de vídeo e da máscara também têm v = 0 na linha de cima. */

export const VERT = /* glsl */ `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;

uniform sampler2D uA;
uniform sampler2D uB;
uniform vec4 uFitA;      // foco x, foco y, zoom, proporção do vídeo
uniform vec4 uFitB;
uniform float uMix;      // 0 = só A, 1 = só B
uniform float uStyle;    // 0 tinta · 1 onda · 2 gota · 3 corte seco (por baixo do café real) · 4 emenda
uniform vec2 uOrigin;    // origem da onda (fração do quadro)

uniform vec4 uRect;      // quadro do vídeo em px: x, y, largura, altura
uniform float uRadius;
uniform float uShadow;
uniform vec3 uBg;

uniform sampler2D uMask; // letras de SÓIS (branco = vídeo aparece)
uniform float uMaskOn;
uniform float uTint;     // tingimento bordô do vídeo dentro das letras (some quando a câmera entra)
uniform float uReveal;   // 0..1: a máscara se abre em círculo
uniform vec2 uRevealC;

uniform vec2 uMouse;     // -1..1, suavizado
uniform float uVel;      // velocidade do scroll, -1..1
uniform float uSpot;     // intensidade do "sol" que segue o mouse no fundo
uniform vec2 uSpotC;
uniform float uGrain;

const float PI = 3.14159265;
const vec3 COFFEE = vec3(0.34, 0.18, 0.09);
const vec3 BORDO = vec3(0.416, 0.118, 0.118);
const vec3 SUN = vec3(0.97, 0.56, 0.2);

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}

/* recorte "cover" dentro do quadro, com foco e zoom; o mouse desloca de leve (paralaxe) */
vec2 cover(vec2 q, float ra, vec4 fit) {
  vec2 s = vec2(1.0);
  if (ra > fit.w) s.y = fit.w / ra;
  else s.x = ra / fit.w;
  s /= fit.z;
  vec2 c = fit.xy - uMouse * s * vec2(0.018, 0.012);
  c = clamp(c, s * 0.5, 1.0 - s * 0.5);
  return c + (q - 0.5) * s;
}

/* aberração cromática: separa vermelho e azul na direção do movimento */
vec3 sampleRGB(sampler2D t, vec2 uv, vec2 off) {
  return vec3(texture2D(t, uv + off).r, texture2D(t, uv).g, texture2D(t, uv - off).b);
}

void main() {
  vec2 frag = vec2(vUv.x, 1.0 - vUv.y) * uRes;

  // quadro (arredondado) onde o vídeo aparece
  vec2 hs = uRect.zw * 0.5;
  vec2 d = abs(frag - (uRect.xy + hs)) - (hs - uRadius);
  float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - uRadius;
  float inRect = 1.0 - smoothstep(-1.0, 1.0, sd);
  vec2 q = (frag - uRect.xy) / uRect.zw;
  float ra = uRect.z / uRect.w;

  // ondulação horizontal quando o scroll acelera
  q.x += sin(q.y * 9.0 + uTime * 2.2) * uVel * 0.006;

  vec2 qa = q;
  vec2 qb = q;
  float b = uMix;   // quanto de B aparece neste pixel
  float edge = 0.0; // frente da transição (borda de tinta)
  float drop = 0.0; // gotas de café penduradas (transição "gota")
  float pulse = sin(PI * uMix);

  if (uMix > 0.0 && uMix < 1.0) {
    if (uStyle < 0.5) {
      // tinta: o café se espalha como mancha, deformando as duas imagens
      float n = fbm(q * vec2(ra, 1.0) * 2.4 + vec2(uTime * 0.04, 0.0));
      float t = uMix * 1.3 - 0.15;
      b = 1.0 - smoothstep(t - 0.025, t + 0.025, n);
      edge = b * (1.0 - b) * 4.0;
      vec2 disp = (vec2(n, fbm(q * 3.1 + 4.0)) - 0.5) * 0.16 * pulse;
      qa += disp;
      qb -= disp * 0.6;
    } else if (uStyle < 1.5) {
      // onda: abre em círculo a partir do copo, com anéis que deformam a imagem
      vec2 dv = (q - uOrigin) * vec2(ra, 1.0);
      float dist = length(dv);
      vec2 dir = dist > 0.0 ? dv / dist : vec2(0.0);
      float far = length(max(uOrigin, 1.0 - uOrigin) * vec2(ra, 1.0)) + 0.15;
      float R = uMix * far;
      float rr = R + (fbm(dir * 2.5 + uTime * 0.15) - 0.5) * 0.09;
      b = 1.0 - smoothstep(rr - 0.012, rr + 0.012, dist);
      float ring = exp(-pow((dist - R) * 9.0, 2.0)) * pulse;
      edge = ring * 0.6;
      qa -= dir * ring * 0.05;
      qb += dir * (ring * 0.035 + sin(dist * 70.0 - uTime * 7.0) * 0.004 * pulse);
    } else if (uStyle < 2.5) {
      // gota: a nova tomada escorre de cima, com fios de comprimentos diferentes
      // frente ondulada + gotas: cada coluna tem um "dedo" arredondado de comprimento próprio
      float x = q.x * ra;
      float cx = x * 9.0;
      float id = floor(cx);
      float u = fract(cx) - 0.5;
      float w = 0.18 + 0.22 * hash(vec2(id, 7.7));
      float len = pow(hash(vec2(id, 3.1)), 1.6) * 0.42;
      float finger = sqrt(max(0.0, 1.0 - pow(u / w, 2.0))) * len;
      float tip = len * (1.0 - smoothstep(0.0, w, abs(u)));
      float base = uMix * 1.62 - 0.55 + (fbm(vec2(x * 2.2, 3.0)) - 0.5) * 0.12;
      float front = base + max(finger, tip * 0.92);
      b = 1.0 - smoothstep(front - 0.008, front + 0.008, q.y);
      // o que pende abaixo da linha da frente é café (as gotas), com borda escura
      drop = b * smoothstep(base - 0.01, base + 0.04, q.y) * (1.0 - pow(uMix, 4.0));
      float rim = (1.0 - smoothstep(0.0, 0.035, front - q.y)) * b;
      edge = rim;
      qb.y -= (1.0 - uMix) * 0.08 * (1.0 - q.y);
      qa.y += pulse * 0.025 * b;
    } else if (uStyle < 3.5) {
      b = step(0.5, uMix); // por baixo do café real: troca seca
    } else {
      // emenda entre tomadas encadeadas: os quadros já casam, então é só uma fusão curta e limpa
      b = uMix * uMix * (3.0 - 2.0 * uMix);
    }
  }

  vec2 offA = vec2(uVel * 0.004 + edge * 0.003, 0.0);
  vec3 colA = sampleRGB(uA, cover(qa, ra, uFitA), offA);
  vec3 vid = colA;
  if (b > 0.001) {
    vec3 colB = sampleRGB(uB, cover(qb, ra, uFitB), offA);
    vid = mix(colA, colB, b);
  }

  // frente de tinta escura e um vazamento de luz quente no meio da transição
  if (uStyle < 2.5) {
    vid = mix(vid, vid * COFFEE * 2.2, clamp(edge, 0.0, 1.0) * 0.5);
    // gota: âmbar escuro com um brilho na lateral, como o café na serpentina
    float gloss = pow(clamp(1.0 - abs(fract(q.x * ra * 9.0) - 0.38) * 6.0, 0.0, 1.0), 3.0);
    vec3 amber = mix(vec3(0.24, 0.11, 0.05), vec3(0.62, 0.32, 0.1), smoothstep(0.0, 1.0, edge)) + gloss * 0.22;
    vid = mix(vid, amber, drop * 0.94);
    float leak = smoothstep(0.15, 1.1, q.x * 0.7 + (1.0 - q.y) * 0.5);
    vid += SUN * pulse * pulse * leak * 0.16;
  }

  // gradação: um pouco mais de contraste e vinheta
  vid = mix(vid, vid * vid * (3.0 - 2.0 * vid), 0.22);
  float vig = smoothstep(1.2, 0.3, length((q - 0.5) * vec2(ra * 0.75, 1.0)));
  vid *= mix(0.8, 1.0, vig);

  // letras de SÓIS
  float m = 1.0;
  if (uMaskOn > 0.5) {
    m = texture2D(uMask, vUv * vec2(1.0, -1.0) + vec2(0.0, 1.0)).r;
    // dentro das letras o vídeo puxa para o bordô (as partes claras da parede viram rosa-queimado)
    float lum = dot(vid, vec3(0.299, 0.587, 0.114));
    vid = mix(vid, mix(BORDO * 0.8, vec3(0.86, 0.55, 0.42), lum * lum) * (0.55 + 0.6 * vid), uTint * smoothstep(0.35, 0.95, lum));
    float diag = length(uRes);
    float rd = length(frag - uRevealC) + (fbm(frag / uRes.y * 3.0 + uTime * 0.05) - 0.5) * 0.18 * diag;
    float rv = uReveal * diag * 1.1;
    m = max(m, 1.0 - smoothstep(rv - 30.0 * uDpr, rv, rd));
  }

  // fundo: creme com um sol que segue o mouse, e a sombra do quadro no final
  vec3 bg = uBg;
  float sp = exp(-pow(length(frag - uSpotC) / uRes.y, 2.0) * 2.4) * uSpot;
  bg = mix(bg, vec3(1.0, 0.975, 0.92), sp * 0.75);
  bg = mix(bg, SUN, sp * sp * 0.07);
  float sh = (1.0 - smoothstep(-20.0 * uDpr, 70.0 * uDpr, sd - 26.0 * uDpr)) * uShadow;
  bg *= 1.0 - sh * 0.55;

  vec3 col = mix(bg, vid, inRect * m);

  // grão de filme
  col += (hash(frag + fract(uTime * 7.31) * 113.0) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}
`;
