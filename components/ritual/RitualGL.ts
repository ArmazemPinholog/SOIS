/* Compositor do hero: desenha numa só passada o vídeo da tomada atual, a transição para a próxima,
   as letras de SÓIS (máscara), o quadro do final e a pós-produção (grão, vinheta, aberração e o sol
   que segue o mouse). Os <video> continuam no DOM; aqui eles só viram textura. */

import { FRAG, VERT } from "./shaders";

export type GLState = {
  a: number;
  b: number;
  mix: number;
  style: number;
  origin: [number, number];
  /** foco x, foco y, zoom, proporção */
  fitA: [number, number, number, number];
  fitB: [number, number, number, number];
  /** quadro do vídeo em px do CSS */
  rect: [number, number, number, number];
  radius: number;
  shadow: number;
  bg: [number, number, number];
  maskOn: boolean;
  tint: number;
  reveal: number;
  revealC: [number, number];
  mouse: [number, number];
  vel: number;
  spot: number;
  spotC: [number, number];
  grain: number;
};

const UNIFORMS = [
  "uRes", "uDpr", "uTime", "uA", "uB", "uFitA", "uFitB", "uMix", "uStyle", "uOrigin", "uRect", "uRadius",
  "uShadow", "uBg", "uMask", "uMaskOn", "uTint", "uReveal", "uRevealC", "uMouse", "uVel", "uSpot", "uSpotC", "uGrain",
] as const;
type U = (typeof UNIFORMS)[number];

/* ---------- letras de SÓIS desenhadas num canvas 2D (vira a máscara do vídeo) ---------- */
export class TitleMask {
  readonly canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d")!;
  private letters: { ch: string; x: number }[] = [];
  private size = 100;
  private baseline = 0;
  private top = 0;
  private bottom = 0;
  /** ponto da haste do "I" por onde a câmera atravessa (px do CSS) */
  pivot: [number, number] = [0, 0];
  dirty = true;
  private last = "";

  constructor(
    private text: string,
    private family: string,
    private weight = 600,
    private tracking = 0.035,
  ) {}

  /** encaixa a palavra no retângulo do layout (px do CSS) */
  layout(slot: DOMRect, family = this.family) {
    this.family = family;
    const c = this.ctx;
    c.font = `${this.weight} 100px ${this.family}`;
    const widths = [...this.text].map((ch) => c.measureText(ch).width);
    const total = widths.reduce((s, w) => s + w, 0) + 100 * this.tracking * (widths.length - 1);
    const m = c.measureText(this.text);
    const asc = m.actualBoundingBoxAscent || 90;
    const desc = m.actualBoundingBoxDescent || 2;
    this.size = Math.min((slot.width / total) * 100, (slot.height / (asc + desc)) * 100);
    const k = this.size / 100;
    let x = slot.left + (slot.width - total * k) / 2;
    this.letters = [...this.text].map((ch, i) => {
      const l = { ch, x };
      x += (widths[i] + 100 * this.tracking) * k;
      return l;
    });
    this.top = slot.top + (slot.height - (asc + desc) * k) / 2;
    this.baseline = this.top + asc * k;
    this.bottom = this.baseline + desc * k;
    const iIdx = this.text.indexOf("I");
    const cap = (c.measureText("I").actualBoundingBoxAscent || 63) * k;
    const li = this.letters[Math.max(0, iIdx)];
    const wi = widths[Math.max(0, iIdx)] * k;
    this.pivot = [li.x + wi / 2, this.baseline - cap * 0.5];
    this.dirty = true;
    this.last = "";
  }

  /**
   * @param scale   zoom da câmera (1 = em repouso)
   * @param anchor  para onde o pivô vai na tela enquanto o zoom cresce (px do CSS)
   * @param intro   entrada de cada letra (0 → 1)
   */
  draw(W: number, H: number, dpr: number, scale: number, anchor: [number, number], intro: number[]) {
    const key = `${W}|${H}|${scale.toFixed(4)}|${anchor[0].toFixed(1)}|${anchor[1].toFixed(1)}|${intro.map((k) => k.toFixed(3)).join(",")}`;
    if (key === this.last) return;
    this.last = key;
    const cv = this.canvas;
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#000";
    c.fillRect(0, 0, W, H);
    const [px, py] = this.pivot;
    c.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (anchor[0] - px * scale), dpr * (anchor[1] - py * scale));
    c.font = `${this.weight} ${this.size}px ${this.family}`;
    c.textBaseline = "alphabetic";
    c.fillStyle = "#fff";
    const pad = this.size * 0.06;
    this.letters.forEach((l, i) => {
      const k = intro[i] ?? 1;
      if (k <= 0) return;
      c.save();
      // cada letra sobe de dentro da própria linha (máscara)
      c.beginPath();
      c.rect(l.x - pad, this.top - pad, this.size, this.bottom - this.top + pad * 2);
      c.clip();
      c.globalAlpha = Math.min(1, k * 1.4);
      c.fillText(l.ch, l.x, this.baseline + (1 - k) * (this.bottom - this.top + pad));
      c.restore();
    });
    this.dirty = true;
  }
}

/* ---------- compositor ---------- */
export class RitualGL {
  private gl: WebGLRenderingContext;
  private u = {} as Record<U, WebGLUniformLocation | null>;
  private tex: WebGLTexture[] = [];
  private maskTex: WebGLTexture | null = null;
  private dirty: boolean[];
  private ready: boolean[];
  private off: (() => void)[] = [];
  private lost = false;
  dpr = 1;

  static supported() {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch {
      return false;
    }
  }

  constructor(
    private canvas: HTMLCanvasElement,
    private videos: (HTMLVideoElement | null)[],
    private mask: TitleMask,
    posters: string[] = [],
  ) {
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("sem WebGL");
    this.gl = gl;
    this.dirty = videos.map(() => true);
    this.ready = videos.map(() => false);
    this.init();

    /* O quadro novo é copiado para a textura no instante em que o seek termina. Esperar o próximo
       render não serve: enquanto o scroll anda, cada quadro já pede outro seek antes de desenhar,
       e um vídeo em seek não tem imagem (readyState 1), então a textura nunca seria atualizada. */
    videos.forEach((v, i) => {
      if (!v) return;
      const grab = () => {
        this.dirty[i] = true;
        this.upload(i);
      };
      for (const ev of ["seeked", "loadeddata", "canplay"]) v.addEventListener(ev, grab);
      this.off.push(() => {
        for (const ev of ["seeked", "loadeddata", "canplay"]) v.removeEventListener(ev, grab);
      });
    });

    const onLost = (e: Event) => {
      e.preventDefault();
      this.lost = true;
    };
    const onRestored = () => {
      this.lost = false;
      this.init();
      this.dirty = this.videos.map(() => true);
      this.mask.dirty = true;
    };
    // enquanto o vídeo não chega, a textura mostra o pôster (quem rola rápido não vê tela vazia)
    posters.forEach((src, i) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (this.ready[i] || this.lost) return;
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      };
      img.src = src;
    });

    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    this.off.push(() => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    });
  }

  private init() {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of UNIFORMS) this.u[n] = gl.getUniformLocation(prog, n);

    const make = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // enquanto o vídeo não chega: um pixel creme
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([234, 214, 180]));
      return t;
    };
    this.tex = this.videos.map(make);
    this.maskTex = make();
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.uniform1i(this.u.uA, 0);
    gl.uniform1i(this.u.uB, 1);
    gl.uniform1i(this.u.uMask, 2);
  }

  resize() {
    const c = this.canvas;
    this.dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 820 ? 1.25 : 1.5);
    const w = Math.max(1, Math.round(c.clientWidth * this.dpr));
    const h = Math.max(1, Math.round(c.clientHeight * this.dpr));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    return [w, h] as const;
  }

  get size() {
    return [this.canvas.width, this.canvas.height] as const;
  }

  /** o vídeo já mostrou pelo menos um quadro */
  hasFrame(i: number) {
    return this.ready[i];
  }

  private upload(i: number) {
    const v = this.videos[i];
    if (this.lost || !v || v.readyState < 2 || v.seeking) return;
    // vídeo tocando (o copo em loop) sobe todo quadro; os esfregados só quando o seek termina
    if (!this.dirty[i] && v.paused) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
      this.ready[i] = true;
      this.dirty[i] = false;
    } catch {
      /* quadro ainda indisponível */
    }
  }

  render(s: GLState, time: number) {
    if (this.lost) return;
    const gl = this.gl;
    const u = this.u;
    const d = this.dpr;
    const [W, H] = this.size;

    this.upload(s.a);
    if (s.mix > 0) this.upload(s.b);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[s.a]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[s.b]);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    if (s.maskOn && this.mask.dirty) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.mask.canvas);
      this.mask.dirty = false;
    }

    gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uDpr, d);
    gl.uniform1f(u.uTime, time);
    gl.uniform4f(u.uFitA, ...s.fitA);
    gl.uniform4f(u.uFitB, ...s.fitB);
    gl.uniform1f(u.uMix, s.mix);
    gl.uniform1f(u.uStyle, s.style);
    gl.uniform2f(u.uOrigin, ...s.origin);
    gl.uniform4f(u.uRect, s.rect[0] * d, s.rect[1] * d, Math.max(1, s.rect[2] * d), Math.max(1, s.rect[3] * d));
    gl.uniform1f(u.uRadius, s.radius * d);
    gl.uniform1f(u.uShadow, s.shadow);
    gl.uniform3f(u.uBg, ...s.bg);
    gl.uniform1f(u.uMaskOn, s.maskOn ? 1 : 0);
    gl.uniform1f(u.uTint, s.tint);
    gl.uniform1f(u.uReveal, s.reveal);
    gl.uniform2f(u.uRevealC, s.revealC[0] * d, s.revealC[1] * d);
    gl.uniform2f(u.uMouse, ...s.mouse);
    gl.uniform1f(u.uVel, s.vel);
    gl.uniform1f(u.uSpot, s.spot);
    gl.uniform2f(u.uSpotC, s.spotC[0] * d, s.spotC[1] * d);
    gl.uniform1f(u.uGrain, s.grain);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* sem loseContext(): no modo estrito do React o mesmo canvas é montado de novo e receberia um contexto perdido */
  destroy() {
    this.off.forEach((f) => f());
    const gl = this.gl;
    this.tex.forEach((t) => gl.deleteTexture(t));
    if (this.maskTex) gl.deleteTexture(this.maskTex);
  }
}
