import * as THREE from "three";
import { easeInOutCubic, range } from "@/components/three/math";

/* Mundo da história: 1 unidade = 10 cm. Bancada em y = 0, parede ao fundo em z = -5.
   Os pontos de encaixe foram medidos nos GLBs (vistas ortográficas com grade) e convertidos
   para o mundo com a escala de cada objeto. */

export type V3 = [number, number, number];

/** Moedor (moedor.glb), flutuando desmontado logo acima do V60: a bica fica exatamente sobre o
    coador, então o pó cai direto na cama do V60. Medidas locais (normalizadas) vindas do GLB:
    bica (0, 0.44, 0.22), topo do funil y = 0.98, garganta y = 0.70, boca do funil r = 0.215. */
const GS = 3.4;
const G_POS: V3 = [0, 6.5 - 0.44 * GS, -0.22 * GS];
export const GRINDER = {
  scale: GS,
  position: G_POS,
  hopperTop: [0, G_POS[1] + 0.98 * GS, G_POS[2] - 0.03 * GS] as V3,
  hopperRadius: 0.215 * GS,
  throatY: G_POS[1] + 0.7 * GS,
  chute: [0, 6.5, 0] as V3,
};

/** Suporte com V60 (suporte-coado.glb), posicionado para o eixo do V60 ficar em x = 0. */
export const STAND = {
  scale: 5.2,
  /** posição do GLB em relação ao eixo do V60 */
  position: [-0.39, 0, 0] as V3,
  /** gira o suporte em torno do eixo do V60 para a haste ficar atrás (fora do primeiro plano) */
  rotationY: -Math.PI / 2,
  axisX: 0,
  rimY: 4.33,
  rimRadius: 1.0,
  collarY: 2.55,
  baseTopY: 0.41,
  /** cama de pó dentro do V60 */
  bed: { y: 3.42, radius: 0.56 },
  /** nível do café dentro do V60 durante a passagem */
  pool: { y0: 3.46, y1: 3.78, r0: 0.6, r1: 0.76 },
};

/** Serpentina de vidro feita em código: do colar de latão até acima do copo. */
export const COIL_CFG = {
  entryTop: 2.62,
  top: 2.38,
  bottom: 2.0,
  radius: 0.27,
  turns: 3.2,
  exitY: 1.82,
  tube: 0.054,
  liquid: 0.038,
};

/** Chaleira (chaleira.glb): bico no lado -x. */
export const KETTLE = {
  scale: 3.2,
  /** ponta do bico em coordenadas locais (já na escala) */
  tip: new THREE.Vector3(-0.483 * 3.2, 0.416 * 3.2, 0),
  rest: [3.6, 0, 0.8] as V3,
  pourTipY: 5.15,
  pourAngle: 0.46,
};

/** Copo da Sóis sobre a base do suporte. */
export const CUP = {
  position: [0, STAND.baseTopY, 0] as V3,
  /** escala do perfil normalizado do GLB (altura 0.98) */
  scale: 1.02,
};

/* Perfil externo medido no copo.glb (normalizado): parede cônica r = a + b·y. */
export const CUP_PROFILE = { a: 0.3017, b: 0.1162, height: 0.95, rimY: 0.962, rimR: 0.0145, wall: 0.006 };

export function cupOuterRadius(yLocal: number) {
  const yn = yLocal / CUP.scale;
  return (CUP_PROFILE.a + CUP_PROFILE.b * yn) * CUP.scale;
}
export const CUP_HEIGHT = CUP_PROFILE.height * CUP.scale;
export const CUP_INNER_BOTTOM = 0.045;

/* ---------- linha do tempo (progresso 0..1 da seção da história) ---------- */
export const T = {
  form: [0.04, 0.19],
  /** grãos despencam do símbolo para dentro do funil */
  drop: [0.235, 0.32],
  /** moedor se desmonta: funil sobe, base e copinho se afastam */
  explode: [0.29, 0.35],
  grind: [0.33, 0.44],
  /** peças do moedor saem de cena */
  grinderOut: [0.43, 0.49],
  /** onda de café atravessando a tela (transição) */
  wipe1: [0.455, 0.515],
  kettleIn: [0.49, 0.545],
  pour: [0.535, 0.645],
  kettleOut: [0.645, 0.7],
  bloom: [0.54, 0.66],
  coil: [0.6, 0.69],
  drip: [0.685, 0.8],
  fill: [0.695, 0.8],
  /** cubos de gelo caindo dentro do café, um a um */
  ice: [0.795, 0.865],
  turn: [0.88, 1],
} as const;

/** quanto o funil sobe na vista explodida (unidades do mundo) — os grãos dentro dele sobem junto */
export const hopperLift = (p: number) => easeInOutCubic(range(p, T.explode[0], T.explode[1])) * 0.45;

/* ---------- câmera (desktop): texto à esquerda, assunto à direita ---------- */
/** sx = x do assunto em cena (no retrato a câmera centraliza nele em vez de deixar espaço para o texto) */
type Key = { p: number; pos: V3; target: V3; sx: number };
export const CAMERA_KEYS: Key[] = [
  { p: 0.0, pos: [1.0, 12.4, 16.2], target: [-2.75, 11.5, -0.4], sx: 0 },
  { p: 0.22, pos: [0.8, 12.1, 14.3], target: [-2.55, 11.4, -0.4], sx: 0 },
  { p: 0.3, pos: [1.6, 9.9, 11.4], target: [-2.1, 8.5, -0.5], sx: 0 },
  { p: 0.38, pos: [2.2, 7.9, 10.6], target: [-1.95, 5.6, -0.3], sx: 0 },
  { p: 0.47, pos: [2.0, 9.0, 8.4], target: [-1.4, 4.1, 0], sx: 0 },
  { p: 0.58, pos: [1.7, 10.6, 5.6], target: [-0.7, 3.75, 0], sx: 0.1 },
  { p: 0.67, pos: [1.8, 3.5, 6.0], target: [-0.85, 1.95, 0], sx: 0 },
  { p: 0.76, pos: [0.95, 3.25, 3.8], target: [-0.75, 1.05, 0], sx: 0 },
  { p: 0.83, pos: [0.55, 3.75, 2.6], target: [-0.6, 1.15, 0], sx: 0 },
  { p: 0.92, pos: [0.6, 2.85, 4.5], target: [-0.9, 1.15, 0], sx: 0 },
  { p: 1.0, pos: [-0.3, 2.95, 5.0], target: [-1.0, 1.2, 0], sx: 0 },
];

const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

export function cameraAt(p: number, portrait: boolean, outPos: THREE.Vector3, outTarget: THREE.Vector3) {
  const keys = CAMERA_KEYS;
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].p) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const t = smoother(THREE.MathUtils.clamp((p - a.p) / (b.p - a.p), 0, 1));
  outPos.set(
    THREE.MathUtils.lerp(a.pos[0], b.pos[0], t),
    THREE.MathUtils.lerp(a.pos[1], b.pos[1], t),
    THREE.MathUtils.lerp(a.pos[2], b.pos[2], t),
  );
  outTarget.set(
    THREE.MathUtils.lerp(a.target[0], b.target[0], t),
    THREE.MathUtils.lerp(a.target[1], b.target[1], t),
    THREE.MathUtils.lerp(a.target[2], b.target[2], t),
  );
  if (portrait) {
    // no celular o assunto fica centralizado e o texto embaixo: centraliza no assunto, afasta e sobe o quadro
    const sx = THREE.MathUtils.lerp(a.sx, b.sx, t);
    const shiftX = sx - outTarget.x;
    outTarget.x += shiftX;
    outPos.x += shiftX * 0.6;
    const dir = outPos.clone().sub(outTarget);
    // o símbolo é largo: no começo afasta mais
    const far = 1.5 + 0.35 * (1 - THREE.MathUtils.clamp((p - 0.24) / 0.06, 0, 1));
    outPos.copy(outTarget).add(dir.multiplyScalar(far));
    outTarget.y -= dir.length() * 0.07;
  }
}
