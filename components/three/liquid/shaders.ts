/* Trechos de GLSL compartilhados pelos líquidos (fio, serpentina, superfície).
   O "ambiente" é procedural (janelas de luz quentes), então não depende de HDR externo. */

export const ENV_GLSL = /* glsl */ `
vec3 liquidEnv(vec3 r) {
  float up = r.y * 0.5 + 0.5;
  vec3 base = mix(vec3(0.18, 0.10, 0.06), vec3(0.96, 0.86, 0.70), pow(up, 1.4));
  float w1 = smoothstep(0.80, 0.95, dot(r, normalize(vec3(0.6, 0.5, 0.6))));
  float w2 = smoothstep(0.86, 0.97, dot(r, normalize(vec3(-0.7, 0.3, 0.5))));
  float strip = smoothstep(0.92, 0.99, dot(r, normalize(vec3(0.0, 0.9, -0.4))));
  return base * 0.55 + vec3(1.0, 0.95, 0.85) * (w1 * 1.7 + w2 * 0.9 + strip * 1.2);
}
`;

/* uKind: 0 = café, 1 = água. Devolve rgb em .rgb e opacidade em .a */
export const SHADE_GLSL = /* glsl */ `
vec4 liquidShade(vec3 N, vec3 V, float kind, float glow, float envK) {
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  vec3 R = reflect(-V, N);
  vec3 env = liquidEnv(R) * envK;
  vec3 L = normalize(vec3(0.5, 0.8, 0.6));
  float spec = pow(max(dot(reflect(-L, N), V), 0.0), kind > 0.5 ? 140.0 : 90.0);
  if (kind < 0.5) {
    float fres = pow(1.0 - ndv, 3.0);
    float back = pow(1.0 - ndv, 1.5);
    vec3 deep = vec3(0.060, 0.022, 0.010);
    vec3 amber = vec3(0.70, 0.28, 0.06);
    vec3 body = mix(deep, amber, back * 0.9 * glow);
    vec3 col = body + env * (0.10 + 0.95 * fres) + vec3(1.0, 0.92, 0.8) * spec * 1.4;
    return vec4(col, 0.97);
  }
  float fres = pow(1.0 - ndv, 2.2);
  float edge = pow(1.0 - ndv, 1.6);
  vec3 col = vec3(0.50, 0.64, 0.72) * 0.34 + env * (0.20 + 0.85 * fres) + vec3(1.0) * spec * 1.6;
  col = mix(col, vec3(0.30, 0.42, 0.50), edge * 0.45);
  float a = clamp(0.20 + edge * 0.6 + fres * 0.4 + spec * 0.9, 0.0, 0.95);
  return vec4(col, a);
}
`;

/* Fio de líquido: cilindro unitário deformado no vertex shader (raio ondulado, torção em "corda",
   cabeça arredondada que desce). Normais por diferenças finitas, então o brilho acompanha a forma. */
export const STREAM_VERT = /* glsl */ `
uniform float uTime;
uniform float uLen;
uniform float uR0;
uniform float uHead;
uniform float uTwist;
uniform float uAmp;
uniform float uThin;
varying vec3 vNormalW;
varying vec3 vPosW;
varying float vS;

float radAt(float s) {
  float y = s * uLen;
  float wob = 1.0 + uAmp * (0.55 * sin(y * 6.0 - uTime * 5.0)
                          + 0.30 * sin(y * 13.0 - uTime * 8.3 + 1.7)
                          + 0.15 * sin(y * 27.0 - uTime * 12.0));
  float thin = 1.0 - uThin * smoothstep(0.0, 1.0, s);
  float cap = 0.035;
  float t = max(0.0, s - (uHead - cap)) / cap;
  float headMul = s > uHead ? 0.0 : sqrt(clamp(1.0 - t * t, 0.0, 1.0));
  float topFade = smoothstep(0.0, 0.02, s);
  return uR0 * wob * thin * headMul * mix(0.55, 1.0, topFade);
}

vec3 centreAt(float s) {
  float y = s * uLen;
  float ph = y * 3.2 - uTime * 2.4;
  float a = uTwist * smoothstep(0.0, 0.5, s) * (0.5 + 0.5 * s);
  return vec3(sin(ph) * a, -y, cos(ph) * a * 0.8);
}

vec3 surfaceAt(float th, float s) {
  float ss = min(s, uHead);
  vec3 c = centreAt(ss);
  float r = radAt(s);
  float rot = ss * uLen * 4.0 - uTime * 3.0;
  float lobes = 1.0 + 0.22 * sin(2.0 * (th - rot)) * smoothstep(0.0, 0.3, s);
  return c + vec3(sin(th), 0.0, cos(th)) * r * lobes;
}

void main() {
  float th = atan(position.x, position.z);
  float s = clamp(0.5 - position.y, 0.0, 1.0);
  vec3 p = surfaceAt(th, s);
  float d = 0.01;
  float ds = 0.002;
  vec3 dth = surfaceAt(th + d, s) - surfaceAt(th - d, s);
  vec3 dsv = surfaceAt(th, min(s + ds, 1.0)) - surfaceAt(th, max(s - ds, 0.0));
  vec3 n = cross(dsv, dth);
  float ln = length(n);
  n = ln < 1e-9 ? vec3(0.0, -1.0, 0.0) : n / ln;
  if (dot(n, vec3(sin(th), 0.0, cos(th))) < 0.0) n = -n;
  vNormalW = normalize(mat3(modelMatrix) * n);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vPosW = w.xyz;
  vS = s;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const STREAM_FRAG = /* glsl */ `
uniform float uKind;
uniform float uGlow;
varying vec3 vNormalW;
varying vec3 vPosW;
varying float vS;
${ENV_GLSL}
${SHADE_GLSL}
void main() {
  vec3 N = normalize(vNormalW);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vPosW);
  vec4 c = liquidShade(N, V, uKind, uGlow, 1.0);
  c.a *= smoothstep(0.0, 0.02, vS);
  gl_FragColor = c;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/* Superfície do líquido no copo: ondas que partem do ponto de impacto, calombo sob o fio e menisco na parede. */
export const SURFACE_VERT = /* glsl */ `
uniform float uTime;
uniform float uImpact;
uniform float uRadius;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec2 vXZ;

float heightAt(vec2 p) {
  float r = length(p);
  float wave = sin(r * 28.0 - uTime * 9.0) * exp(-r * 3.2) * 0.035 * uImpact;
  float wave2 = sin(r * 47.0 - uTime * 14.0 + 1.3) * exp(-r * 4.5) * 0.018 * uImpact;
  float mound = exp(-r * r * 900.0) * 0.045 * uImpact;
  float slosh = sin(p.x * 3.0 + uTime * 2.1) * 0.004 + sin(p.y * 4.0 - uTime * 1.7) * 0.003;
  float meniscus = smoothstep(uRadius - 0.07, uRadius, r) * 0.022;
  return wave + wave2 + mound + slosh + meniscus;
}

void main() {
  vec2 p = position.xz;
  float h = heightAt(p);
  float e = 0.012;
  float hx = heightAt(p + vec2(e, 0.0)) - heightAt(p - vec2(e, 0.0));
  float hz = heightAt(p + vec2(0.0, e)) - heightAt(p - vec2(0.0, e));
  vec3 n = normalize(vec3(-hx, 2.0 * e, -hz));
  vNormalW = normalize(mat3(modelMatrix) * n);
  vec4 w = modelMatrix * vec4(p.x, h, p.y, 1.0);
  vPosW = w.xyz;
  vXZ = p;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const SURFACE_FRAG = /* glsl */ `
uniform float uKind;
uniform float uRadius;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec2 vXZ;
${ENV_GLSL}
${SHADE_GLSL}
void main() {
  if (length(vXZ) > uRadius) discard;
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  vec4 c = liquidShade(N, V, uKind, 0.35, uKind > 0.5 ? 0.6 : 0.3);
  float edge = smoothstep(uRadius, uRadius - 0.05, length(vXZ));
  c.rgb *= mix(0.55, 1.0, edge);
  gl_FragColor = c;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/* Café dentro do tubo de vidro: preenche ao longo do comprimento (uv.x), com brilho de fluxo. */
export const COIL_VERT = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;
varying float vU;
void main() {
  vU = uv.x;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vPosW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const COIL_FRAG = /* glsl */ `
uniform float uFill;
uniform float uTime;
varying vec3 vNormalW;
varying vec3 vPosW;
varying float vU;
${ENV_GLSL}
${SHADE_GLSL}
void main() {
  if (vU > uFill) discard;
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  vec4 c = liquidShade(N, V, 0.0, 1.25, 0.8);
  float flow = 0.5 + 0.5 * sin(vU * 260.0 - uTime * 7.0);
  c.rgb *= 0.92 + 0.16 * flow;
  float front = smoothstep(uFill - 0.02, uFill, vU);
  c.rgb += vec3(0.35, 0.16, 0.04) * front * 0.6;
  gl_FragColor = vec4(c.rgb, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
