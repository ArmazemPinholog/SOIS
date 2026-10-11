import * as THREE from "three";
import { drawSymbol } from "@/lib/soisSymbol";

export const COLORS = {
  bordo: "#6a1e1e",
  creme: "#f8eacf",
  cafe: "#30211a",
  laranja: "#e0892f",
  amarelo: "#f6d44d",
};

// Gerador pseudoaleatório com semente: o layout fica igual a cada carregamento.
export function seeded(seed = 7) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Grão de café: elipsoide com um lado achatado e o sulco em "S". Comprimento ≈ 2 * scale no eixo X. */
export function createBeanGeometry(scale = 0.12) {
  const g = new THREE.SphereGeometry(1, 40, 28);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const x = v.x;
    let y = v.y * 0.7;
    let z = v.z * 0.52;
    if (z < 0) z *= 0.5; // lado plano
    // sulco central em leve "S" no lado plano
    const crease = 0.1 * Math.sin(x * 2.4);
    const d = y - crease;
    const edgeFade = Math.max(0, 1 - Math.pow(Math.abs(x), 6));
    const groove = Math.exp(-(d * d) / (2 * 0.05 * 0.05)) * edgeFade;
    if (v.z < 0.05) z += groove * 0.2;
    // pequena irregularidade para não parecer perfeito demais
    y *= 1 + 0.04 * Math.sin(x * 5.0);
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  g.scale(scale, scale, scale);
  return g;
}

/** Estampa do copo: padrão de sóis (laranja + creme) sobre bordô, com leve textura de papel. */
export function createCupTexture(maxAnisotropy = 8) {
  const W = 2048;
  const H = 880;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = COLORS.bordo;
  ctx.fillRect(0, 0, W, H);

  // textura de papel
  const rand = seeded(11);
  for (let i = 0; i < 26000; i++) {
    const a = rand() * 0.05;
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,235,210,${a})` : `rgba(20,0,0,${a * 1.4})`;
    ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 1 + rand() * 2);
  }

  // grade em quincôncio, repetindo nas bordas para a emenda ficar invisível
  const cols = 8;
  const rows = 4;
  const dx = W / cols;
  const dy = H / rows;
  const size = 175;
  const r2 = seeded(5);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * dx + (row % 2 ? dx / 2 : 0) + dx / 4;
      const y = row * dy + dy / 2;
      const rot = (r2() - 0.5) * 0.5;
      for (const ox of [-W, 0, W]) {
        ctx.save();
        ctx.translate(x + ox, y);
        ctx.rotate(rot);
        drawSymbol(ctx, 0, 0, size, { top: "#eb9a45", bottom: "#f6e2c4" }, 7);
        ctx.restore();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/** Parede creme com sombras de folhas de palmeira desfocadas (fundo da cena). */
export function createPalmWallTexture() {
  const W = 2048;
  const H = 1152;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // gradiente de luz quente vindo do canto superior direito
  const g = ctx.createRadialGradient(W * 0.8, H * 0.1, 50, W * 0.6, H * 0.4, W * 0.9);
  g.addColorStop(0, "#fbf0d9");
  g.addColorStop(1, "#f8eacf");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const rand = seeded(3);
  // As sombras são desenhadas fora da tela e só a "sombra" (shadowBlur) cai no canvas:
  // isso desfoca em todos os navegadores, inclusive Safari.
  const OFF = 4000;
  ctx.shadowColor = "rgba(110, 82, 50, 0.32)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetX = OFF;
  ctx.fillStyle = "#000";

  const frond = (x: number, y: number, angle: number, len: number, droop: number) => {
    const steps = 26;
    let px = x;
    let py = y;
    let a = angle;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const seg = len / steps;
      const nx = px + Math.cos(a) * seg;
      const ny = py + Math.sin(a) * seg;
      // nervura
      ctx.beginPath();
      ctx.moveTo(px - OFF, py);
      ctx.lineTo(nx - OFF, ny);
      ctx.lineWidth = 6 * (1 - t) + 1;
      ctx.strokeStyle = "#000";
      ctx.shadowColor = "rgba(110, 82, 50, 0.3)";
      ctx.stroke();
      // folíolos dos dois lados
      const leafLen = len * 0.32 * Math.sin(Math.PI * (0.15 + t * 0.85)) + 20;
      for (const side of [-1, 1]) {
        const la = a + side * (0.9 + rand() * 0.25);
        const lx = nx + Math.cos(la) * leafLen;
        const ly = ny + Math.sin(la) * leafLen + leafLen * 0.25;
        const w = 9 * (1 - t * 0.6);
        ctx.beginPath();
        ctx.moveTo(nx - OFF, ny);
        ctx.quadraticCurveTo(
          (nx + lx) / 2 - OFF + Math.cos(la + Math.PI / 2) * w,
          (ny + ly) / 2 + Math.sin(la + Math.PI / 2) * w,
          lx - OFF,
          ly,
        );
        ctx.quadraticCurveTo(
          (nx + lx) / 2 - OFF - Math.cos(la + Math.PI / 2) * w,
          (ny + ly) / 2 - Math.sin(la + Math.PI / 2) * w,
          nx - OFF,
          ny,
        );
        ctx.fill();
      }
      px = nx;
      py = ny;
      a += droop / steps;
    }
  };

  frond(-80, 140, 0.28, 1100, 0.7);
  frond(-120, 560, -0.12, 900, 0.9);
  frond(60, -60, 0.75, 760, 0.5);
  frond(W + 60, 900, Math.PI + 0.35, 700, -0.6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
