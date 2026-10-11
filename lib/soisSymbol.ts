// Geometria do símbolo provisório da Sóis (dois meios-sóis formando um "S"), no sistema de
// coordenadas do SVG (viewBox 0 0 200 264). Usada pelo SVG, pelos grãos 3D e pela estampa do copo.
// Substituir pelos dados do vetor oficial quando ele chegar.

export type Seg = [number, number, number, number];

export const VIEWBOX = { w: 200, h: 264 };

export const TOP = {
  center: [100, 96] as const,
  radius: 34,
  // arco de 290° a 90° passando por 180° (sentido anti-horário na tela)
  arc: { from: 290, to: 90 },
  stem: [111.63, 18, 111.63, 64.05] as Seg,
  arcPath: "M111.63 18 L111.63 64.05 A34 34 0 1 0 100 130",
  rays: [
    [78.5, 133.24, 65.5, 155.76],
    [68.62, 125.39, 56.94, 136.33],
    [61.43, 115.02, 38.12, 126.52],
    [57.57, 103.0, 41.79, 105.61],
    [57.37, 90.39, 31.59, 86.99],
    [60.83, 78.25, 46.26, 71.65],
    [67.67, 67.65, 48.12, 50.51],
    [77.29, 59.48, 68.84, 45.9],
    [88.87, 54.47, 82.14, 29.35],
  ] as Seg[],
};

export const BOTTOM = {
  center: [100, 164] as const,
  radius: 34,
  // arco de 270° a 470° (=110°) passando por 0°
  arc: { from: 270, to: 470 },
  stem: [88.37, 195.95, 88.37, 246] as Seg,
  arcPath: "M100 130 A34 34 0 0 1 88.37 195.95 L88.37 246",
  rays: [
    [111.13, 122.47, 117.86, 97.35],
    [122.71, 127.48, 131.16, 113.9],
    [132.33, 135.65, 151.88, 118.51],
    [139.17, 146.25, 153.74, 139.65],
    [142.63, 158.39, 168.41, 154.99],
    [142.43, 171.0, 158.21, 173.61],
    [138.57, 183.02, 161.88, 194.52],
    [131.38, 193.39, 143.06, 204.33],
    [121.5, 201.24, 134.5, 223.76],
  ] as Seg[],
};

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
    pts.push(...sampleLine(part.stem, spacing, half));
    pts.push(...sampleArc(part.center, part.radius, part.arc.from, part.arc.to, spacing, half));
    // os raios começam um pouco afastados do arco, então amostramos do início ao fim do traço
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
  lineWidth = 5,
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
    ctx.stroke(new Path2D(part.arcPath));
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of part.rays) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  }
  ctx.restore();
}
