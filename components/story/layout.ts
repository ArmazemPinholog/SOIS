import * as THREE from "three";

/* Mundo da história: 1 unidade = 10 cm. Bancada em y = 0, parede ao fundo em z = -5.
   Os pontos de encaixe foram medidos nos GLBs (vistas ortográficas com grade) e convertidos
   para o mundo com a escala de cada objeto. */

export type V3 = [number, number, number];

/** Moedor (moedor.glb): bica para frente (+z). */
export const GRINDER = {
  scale: 4.4,
  position: [-7, 0, 0] as V3,
  hopperTop: [-7, 4.28, -0.1] as V3,
  hopperRadius: 0.85,
  throatY: 3.15,
  chute: [-7, 1.94, 0.97] as V3,
  catchCup: { center: [-7, 0.92, 0.93] as V3, radius: 0.36, bottomY: 0.36 },
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
  form: [0.04, 0.2],
  toGrinder: [0.25, 0.37],
  grind: [0.35, 0.46],
  kettleIn: [0.48, 0.55],
  pour: [0.54, 0.665],
  kettleOut: [0.665, 0.72],
  bloom: [0.55, 0.68],
  coil: [0.6, 0.71],
  ice: [0.69, 0.75],
  drip: [0.735, 0.885],
  fill: [0.745, 0.885],
  turn: [0.88, 1],
} as const;

/* ---------- câmera (desktop): texto à esquerda, assunto à direita ---------- */
/** sx = x do assunto em cena (no retrato a câmera centraliza nele em vez de deixar espaço para o texto) */
type Key = { p: number; pos: V3; target: V3; sx: number };
export const CAMERA_KEYS: Key[] = [
  { p: 0.0, pos: [-5.6, 8.9, 15.5], target: [-8.7, 8.1, 0], sx: -7 },
  { p: 0.22, pos: [-5.8, 8.6, 13.6], target: [-8.5, 8.0, 0], sx: -7 },
  { p: 0.31, pos: [-4.2, 6.4, 10.8], target: [-8.1, 4.1, 0], sx: -7.1 },
  { p: 0.41, pos: [-4.6, 3.2, 7.2], target: [-7.9, 1.75, 0.6], sx: -7.2 },
  { p: 0.5, pos: [3.2, 6.4, 12.6], target: [-1.3, 3.6, 0], sx: 0.3 },
  { p: 0.6, pos: [1.7, 10.6, 5.6], target: [-0.7, 3.75, 0], sx: 0.2 },
  { p: 0.7, pos: [1.8, 3.5, 6.0], target: [-0.85, 1.95, 0], sx: 0 },
  { p: 0.8, pos: [1.15, 3.15, 3.7], target: [-0.45, 1.05, 0], sx: 0 },
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
