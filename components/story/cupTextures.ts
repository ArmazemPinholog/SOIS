import * as THREE from "three";
import { drawSymbol, STROKE } from "@/lib/soisSymbol";
import { seeded } from "@/components/three/assets";

/* Texturas do copo da Sóis geradas a partir do símbolo oficial:
   - cor: bordô com sóis em laranja (folha metálica) e creme, girados e espalhados como no copo de referência
   - orm: canal G = rugosidade, B = metal (só o laranja brilha)
   - relevo: fibras do papel */

const W = 2048;
const H = 900;

type Mark = { x: number; y: number; rot: number; size: number };

function layout(): Mark[] {
  // 4 fileiras desencontradas, 7 sóis por volta, com pequenas variações (como impressão real)
  const rand = seeded(19);
  const marks: Mark[] = [];
  const rows = 4;
  const cols = 7;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ((c + (r % 2 ? 0.5 : 0) + (rand() - 0.5) * 0.18) / cols) * W;
      const y = H * (0.16 + (r / (rows - 1)) * 0.66) + (rand() - 0.5) * 30;
      marks.push({ x, y, rot: (rand() - 0.5) * 0.9, size: 165 + rand() * 30 });
    }
  }
  return marks;
}

function stamp(ctx: CanvasRenderingContext2D, marks: Mark[], top: string, bottom: string, width: number) {
  for (const m of marks) {
    for (const ox of [-W, 0, W]) {
      ctx.save();
      ctx.translate(m.x + ox, m.y);
      ctx.rotate(m.rot);
      drawSymbol(ctx, 0, 0, m.size, { top, bottom }, width);
      ctx.restore();
    }
  }
}

export function createCupTextures(maxAnisotropy = 8) {
  const marks = layout();
  const line = STROKE * 1.35;

  // cor
  const color = document.createElement("canvas");
  color.width = W;
  color.height = H;
  const c = color.getContext("2d")!;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#5e1919");
  g.addColorStop(0.5, "#6a1e1e");
  g.addColorStop(1, "#5a1717");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  const rand = seeded(11);
  for (let i = 0; i < 42000; i++) {
    const a = rand() * 0.05;
    c.fillStyle = rand() > 0.5 ? `rgba(255,232,205,${a})` : `rgba(18,0,0,${a * 1.4})`;
    c.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 1 + rand() * 2);
  }
  stamp(c, marks, "#e7963f", "#f3dfc0", line);
  // emenda lateral: aba sobreposta, levemente mais escura
  c.fillStyle = "rgba(25,4,4,0.28)";
  c.fillRect(0, 0, 7, H);
  c.fillStyle = "rgba(255,225,200,0.08)";
  c.fillRect(7, 0, 3, H);

  // rugosidade (G) e metal (B)
  const orm = document.createElement("canvas");
  orm.width = W / 2;
  orm.height = H / 2;
  const o = orm.getContext("2d")!;
  o.fillStyle = "rgb(255, 214, 0)";
  o.fillRect(0, 0, W, H);
  o.scale(0.5, 0.5);
  stamp(o, marks, "rgb(255, 92, 235)", "rgb(255, 196, 0)", line);

  // relevo do papel
  const bump = document.createElement("canvas");
  bump.width = 512;
  bump.height = 512;
  const b = bump.getContext("2d")!;
  b.fillStyle = "#808080";
  b.fillRect(0, 0, 512, 512);
  const r2 = seeded(3);
  for (let i = 0; i < 9000; i++) {
    const v = 110 + Math.floor(r2() * 40);
    b.strokeStyle = `rgba(${v},${v},${v},0.35)`;
    b.lineWidth = 0.6;
    const x = r2() * 512;
    const y = r2() * 512;
    const a = r2() * Math.PI;
    const l = 3 + r2() * 9;
    b.beginPath();
    b.moveTo(x, y);
    b.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    b.stroke();
  }

  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;
  const ormTex = new THREE.CanvasTexture(orm);
  ormTex.wrapS = THREE.RepeatWrapping;
  ormTex.anisotropy = maxAnisotropy;
  const bumpTex = new THREE.CanvasTexture(bump);
  bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(5, 2);
  return { map, orm: ormTex, bump: bumpTex };
}
