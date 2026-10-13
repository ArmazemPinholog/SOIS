"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/* Palco dos objetos: cada capítulo é um vídeo recortado (cor em cima, alfa embaixo), desenhado em WebGL
   com transparência real por cima da cor do capítulo. O filme informa, a cada quadro, onde cada objeto
   fica na tela (px), a escala e a opacidade — assim a troca de cena é um movimento de câmera, não um corte. */

export type ObjectDraw = { i: number; x: number; y: number; h: number; opacity: number };
export type ObjectStageHandle = { draw: (items: ObjectDraw[]) => void };

const VERT = /* glsl */ `
attribute vec2 position;
uniform vec4 uRect; // x, y (centro, px), w, h (px)
uniform vec2 uView;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  vec2 px = uRect.xy + position * 0.5 * uRect.zw;
  vec2 clip = vec2(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float v = vUv.y * 0.5;                // vUv.y = 0 no topo do retângulo; metade de cima do arquivo = cor
  vec3 col = texture2D(uTex, vec2(vUv.x, v)).rgb;
  float a = texture2D(uTex, vec2(vUv.x, v + 0.5)).r;
  // nenhuma cor da marca tem mais verde que vermelho/azul: tira o reflexo do fundo verde (vidro, metal)
  if (col.g > col.r) col.g = col.r * 0.9; // reflexo verde no vidro/metal vira tom dourado
  // latão "oliva" (verde rebatido no metal amarelado) volta a ser dourado; creme, bordô e café não entram aqui
  if (col.b < col.g * 0.72 && col.g > col.r * 0.82) col.g = mix(col.g, col.r * 0.8, 0.85);
  col.g = min(col.g, max(col.r, col.b));
  // bordas de cima e de baixo suaves: o objeto continua para fora do quadro sem corte reto
  float edge = smoothstep(0.0, 0.07, vUv.y) * smoothstep(0.0, 0.12, 1.0 - vUv.y);
  a = smoothstep(0.03, 0.97, a) * edge * uOpacity;
  gl_FragColor = vec4(col * a, a);
}
`;

type Props = { videos: React.RefObject<(HTMLVideoElement | null)[]>; className?: string };

const ObjectStage = forwardRef<ObjectStageHandle, Props>(function ObjectStage({ videos, className }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const api = useRef<{ draw: (items: ObjectDraw[]) => void }>({ draw: () => {} });

  useImperativeHandle(ref, () => ({ draw: (items) => api.current.draw(items) }));

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const gl = c.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl) return;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const uRect = gl.getUniformLocation(prog, "uRect");
    const uView = gl.getUniformLocation(prog, "uView");
    const uOpacity = gl.getUniformLocation(prog, "uOpacity");

    const textures = new Map<number, { tex: WebGLTexture; t: number; ready: boolean }>();
    const texFor = (i: number) => {
      let e = textures.get(i);
      if (!e) {
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        e = { tex, t: -1, ready: false };
        textures.set(i, e);
      }
      return e;
    };

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      gl.viewport(0, 0, c.width, c.height);
    };
    resize();
    window.addEventListener("resize", resize);

    api.current.draw = (items) => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uView, c.width, c.height);
      for (const it of items) {
        const v = videos.current?.[it.i];
        if (!v || it.opacity <= 0.001 || v.readyState < 2) continue;
        const e = texFor(it.i);
        gl.bindTexture(gl.TEXTURE_2D, e.tex);
        // só sobe o quadro quando o vídeo mudou de posição (ou está tocando)
        if (!v.seeking && (!e.ready || e.t !== v.currentTime || !v.paused)) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
          e.t = v.currentTime;
          e.ready = true;
        }
        const aspect = v.videoWidth / (v.videoHeight / 2);
        const h = it.h * dpr;
        gl.uniform4f(uRect, it.x * dpr, it.y * dpr, h * aspect, h);
        gl.uniform1f(uOpacity, it.opacity);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };

    return () => window.removeEventListener("resize", resize);
  }, [videos]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
});

export default ObjectStage;
