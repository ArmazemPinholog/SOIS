// Geometria do símbolo oficial da Sóis (dois meios-sóis formando um "S"), extraída do logo da marca
// (logo.pdf, 2026-10-11) por ajuste de círculos e segmentos. Coordenadas no viewBox 0 0 218.38 264.0.
// Usada pelo SVG (components/SoisSymbol.tsx), pelos grãos 3D e pela estampa do copo.

export type Seg = [number, number, number, number];

export const VIEWBOX = { w: 218.38, h: 264.0 };

/** espessura do traço no logo oficial, nas unidades do viewBox */
export const STROKE = 4.89;

export const TOP = {
  // meio-sol laranja: arco pela esquerda, hastes para cima e para baixo
  center: [109.82, 108.95] as const,
  radius: 44.26,
  arc: { from: 270.07, to: 94.44 },
  /** haste de cima e haste de baixo (verticais, nas pontas do arco) */
  stems: [
    [109.87, 4.38, 109.87, 64.69],
    [106.39, 153.08, 106.39, 195.65],
  ] as Seg[],
  /** contorno contínuo: haste de cima -> arco -> haste de baixo */
  arcPath: "M109.87 4.38 L109.87 64.69 A44.26 44.26 0 0 0 106.39 153.08 L106.39 195.65",
  rays: [
    [62.95, 96.22, 15.74, 75.16],
    [69.4, 82.0, 44.56, 64.36],
    [80.05, 70.67, 49.7, 34.38],
    [95.83, 62.44, 87.48, 28.78],
    [92.48, 154.25, 81.63, 184.15],
    [80.05, 147.36, 52.76, 189.81],
    [69.24, 135.61, 25.17, 164.32],
    [63.47, 123.16, 31.09, 131.65],
    [61.43, 110.45, 4.38, 110.43],
  ] as Seg[],
};

export const BOTTOM = {
  // meio-sol bordô: arco pela direita, hastes para cima e para baixo
  center: [105.5, 167.39] as const,
  radius: 43.31,
  arc: { from: -88.91, to: 90.14 },
  /** haste de cima e haste de baixo (verticais, nas pontas do arco) */
  stems: [
    [106.32, 82.47, 106.32, 124.09],
    [105.39, 210.7, 105.39, 255.44],
  ] as Seg[],
  /** contorno contínuo: haste de cima -> arco -> haste de baixo */
  arcPath: "M106.32 82.47 L106.32 124.09 A43.31 43.31 0 0 1 105.39 210.7 L105.39 255.44",
  rays: [
    [117.87, 122.03, 126.41, 93.86],
    [128.85, 126.54, 154.19, 84.33],
    [138.54, 133.94, 161.87, 110.22],
    [146.08, 143.65, 199.8, 111.37],
    [150.49, 153.56, 190.86, 144.26],
    [152.59, 164.91, 213.99, 165.22],
    [151.86, 176.18, 190.88, 186.67],
    [148.2, 187.27, 197.75, 216.43],
    [141.08, 198.14, 168.97, 225.14],
    [131.36, 206.73, 162.77, 259.62],
    [118.44, 212.52, 124.65, 242.3],
  ] as Seg[],
};

/* Espessura do arco no logo: é um crescente, mais grosso no meio e fino nas pontas.
   Meia-espessura em unidades do viewBox (medida no logo oficial). */
export const BAND = { halfEnd: 3.02, halfMid: 6.05 };

type Part = typeof TOP | typeof BOTTOM;

/** Contorno preenchido do arco em crescente. `scale` engrossa junto com o traço dos raios. */
export function bandPath(part: Part, scale = 1, steps = 48): string {
  const [cx, cy] = part.center;
  const from = (part.arc.from * Math.PI) / 180;
  const to = (part.arc.to * Math.PI) / 180;
  const mid = (from + to) / 2;
  const half = (a: number) => {
    const m = Math.abs(Math.cos(a - mid)) ** 1.4;
    return (BAND.halfEnd + (BAND.halfMid - BAND.halfEnd) * m) * scale;
  };
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + (to - from) * (i / steps);
    const h = half(a);
    outer.push(`${(cx + (part.radius + h) * Math.cos(a)).toFixed(2)} ${(cy + (part.radius + h) * Math.sin(a)).toFixed(2)}`);
    inner.push(`${(cx + (part.radius - h) * Math.cos(a)).toFixed(2)} ${(cy + (part.radius - h) * Math.sin(a)).toFixed(2)}`);
  }
  return `M${outer.join(" L")} L${inner.reverse().join(" L")} Z`;
}

export type SymbolPoint = {
  x: number;
  y: number;
  /** ângulo da tangente do traço, em radianos (coordenadas do SVG) */
  angle: number;
  half: "top" | "bottom";
};

function sampleLine([x1, y1, x2, y2]: Seg, spacing: number, half: SymbolPoint["half"]): SymbolPoint[] {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(1, Math.round(len / spacing));
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const pts: SymbolPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0.5 : i / n;
    pts.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, angle, half });
  }
  return pts;
}

function sampleArc(
  [cx, cy]: readonly [number, number],
  r: number,
  fromDeg: number,
  toDeg: number,
  spacing: number,
  half: SymbolPoint["half"],
): SymbolPoint[] {
  const span = ((toDeg - fromDeg) * Math.PI) / 180;
  const n = Math.max(2, Math.round((Math.abs(span) * r) / spacing));
  const pts: SymbolPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (fromDeg * Math.PI) / 180 + span * (i / n);
    const tangent = a + (span > 0 ? Math.PI / 2 : -Math.PI / 2);
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), angle: tangent, half });
  }
  return pts;
}

/** Pontos distribuídos ao longo dos traços do símbolo (onde cada grão vai pousar). */
export function sampleSymbol(spacing = 7.5): SymbolPoint[] {
  const pts: SymbolPoint[] = [];
  for (const [part, half] of [
    [TOP, "top"],
    [BOTTOM, "bottom"],
  ] as const) {
    for (const stem of part.stems) pts.push(...sampleLine(stem, spacing, half));
    pts.push(...sampleArc(part.center, part.radius, part.arc.from, part.arc.to, spacing, half));
    for (const ray of part.rays) pts.push(...sampleLine(ray, spacing, half));
  }
  // remove pontos quase sobrepostos (junções de traços)
  const out: SymbolPoint[] = [];
  for (const p of pts) {
    if (!out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < spacing * 0.6)) out.push(p);
  }
  return out;
}

/** Desenha o símbolo num canvas 2D (usado na estampa do copo). */
export function drawSymbol(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colors: { top: string; bottom: string },
  lineWidth = STROKE,
) {
  const s = size / VIEWBOX.h;
  ctx.save();
  ctx.translate(x - (VIEWBOX.w * s) / 2, y - (VIEWBOX.h * s) / 2);
  ctx.scale(s, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = lineWidth;
  for (const [part, color] of [
    [TOP, colors.top],
    [BOTTOM, colors.bottom],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.stroke(new Path2D(part.arcPath));
    ctx.fill(new Path2D(bandPath(part, lineWidth / STROKE)));
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of part.rays) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  }
  ctx.restore();
}
