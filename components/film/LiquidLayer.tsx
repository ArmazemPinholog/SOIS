"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";

/* Café real atravessando a tela (filmagem do Mixkit, "Chocolate syrup covering a green background",
   com o verde removido e a cor puxada para café). O vídeo vem com a cor na metade de cima e o recorte
   (alfa) na metade de baixo, então roda como H.264/VP9 comum em qualquer navegador.
   O filme controla a camada por `set({ k, flipY, flipX, visible })`:
   k = 0 → sem café · k = 1 → tela coberta; flipY = o café nasce embaixo; flipX = espelha a borda. */

export type LiquidState = { k: number; flipY: boolean; flipX: boolean; visible: boolean };
export type LiquidHandle = { set: (s: LiquidState) => void };

const SRC = { wide: "/video/cafe-alfa", tall: "/video/cafe-alfa-celular" };
/** segundo do vídeo em que a tela fica totalmente coberta */
const COVER_AT = { wide: 4.9, tall: 8.4 };
const ASPECT = { wide: 16 / 9, tall: 9 / 16 };

const VERT = /* glsl */ `
attribute vec2 position;
varying vec2 vUv;
void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform float uFlipY;
uniform float uFlipX;
uniform float uScreenAspect;
uniform float uVideoAspect;
varying vec2 vUv;
void main() {
  vec2 p = vUv;                       // tela: y = 1 no topo
  if (uFlipY > 0.5) p.y = 1.0 - p.y;  // o café nasce embaixo
  if (uFlipX > 0.5) p.x = 1.0 - p.x;
  // cobre a tela mantendo a origem do líquido (topo do vídeo)
  if (uScreenAspect > uVideoAspect) p.y = 1.0 - (1.0 - p.y) * (uVideoAspect / uScreenAspect);
  else p.x = 0.5 + (p.x - 0.5) * (uScreenAspect / uVideoAspect);
  // textura do vídeo: v = 0 é a linha de cima do arquivo (cor em cima, alfa embaixo)
  float v = (1.0 - p.y) * 0.5;
  vec3 col = texture2D(uTex, vec2(p.x, v)).rgb;
  float a = texture2D(uTex, vec2(p.x, v + 0.5)).r;
  a = smoothstep(0.02, 0.98, a);
  gl_FragColor = vec4(col * a, a); // alfa pré-multiplicado
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

const LiquidLayer = forwardRef<LiquidHandle, { className?: string }>(function LiquidLayer({ className }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useMemo(() => (typeof document === "undefined" ? null : document.createElement("video")), []);
  const state = useRef<LiquidState>({ k: 0, flipY: true, flipX: false, visible: false });
  const draw = useRef<() => void>(() => {});
  const kind = useRef<"wide" | "tall">("wide");

  useImperativeHandle(ref, () => ({
    set: (s) => {
      const prev = state.current;
      state.current = s;
      const c = canvas.current;
      if (c) c.style.visibility = s.visible && s.k > 0.002 ? "visible" : "hidden";
      if (!s.visible || s.k <= 0.002) return;
      const v = video;
      if (v && v.duration && !v.seeking) {
        const t = Math.min(v.duration - 0.05, s.k * COVER_AT[kind.current]);
        if (Math.abs(v.currentTime - t) > 1 / 40) v.currentTime = t;
      }
      if (prev.flipX !== s.flipX || prev.flipY !== s.flipY || prev.visible !== s.visible) draw.current();
    },
  }));

  useEffect(() => {
    const c = canvas.current;
    const v = video;
    if (!c || !v) return;
    const gl = c.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";

    kind.current = window.innerWidth / window.innerHeight < 0.9 ? "tall" : "wide";
    const ext = v.canPlayType('video/mp4; codecs="avc1.42E01E"') ? ".mp4" : ".webm";
    const src = SRC[kind.current] + ext;
    let url = "";
    let alive = true;
    fetch(src)
      .then((r) => r.blob())
      .then((b) => {
        if (!alive) return;
        url = URL.createObjectURL(b);
        v.src = url;
      })
      .catch(() => (v.src = src));

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uFlipY = u("uFlipY");
    const uFlipX = u("uFlipX");
    const uSA = u("uScreenAspect");
    const uVA = u("uVideoAspect");
    let hasFrame = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      gl.viewport(0, 0, c.width, c.height);
      draw.current();
    };

    draw.current = () => {
      if (!hasFrame) return;
      const s = state.current;
      gl.uniform1f(uFlipY, s.flipY ? 1 : 0);
      gl.uniform1f(uFlipX, s.flipX ? 1 : 0);
      gl.uniform1f(uSA, c.width / Math.max(1, c.height));
      gl.uniform1f(uVA, ASPECT[kind.current]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    // sobe o quadro novo do vídeo para a textura sempre que um "seek" termina
    const upload = () => {
      if (v.readyState < 2) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
      hasFrame = true;
      draw.current();
    };
    v.addEventListener("seeked", upload);
    v.addEventListener("loadeddata", upload);
    window.addEventListener("resize", resize);
    resize();

    return () => {
      alive = false;
      v.removeEventListener("seeked", upload);
      v.removeEventListener("loadeddata", upload);
      window.removeEventListener("resize", resize);
      v.removeAttribute("src");
      v.load();
      if (url) URL.revokeObjectURL(url);
    };
  }, [video]);

  return <canvas ref={canvas} className={className} aria-hidden="true" style={{ visibility: "hidden" }} />;
});

export default LiquidLayer;
