"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { MODEL_URLS, toFloatGeometry } from "./models";
import type { StoryProgress } from "./StoryScene";
import { GRINDER, STAND, T, hopperLift } from "./layout";
import { easeInOutCubic, range } from "@/components/three/math";

/* Moedor real (GLB) em vista explodida, flutuando sobre o V60.
   O GLB é uma malha única: separamos os triângulos por região (medida nas vistas ortográficas)
   em funil, corpo (com a bica), base de madeira e copinho, e animamos cada peça. */

type PartName = "hopper" | "body" | "base" | "cup";

function classify(cx: number, cy: number, cz: number): PartName {
  if (cy > 0.705) return "hopper";
  if (cy < 0.072) return "base";
  if (cz > 0.11 && cy < 0.235 && Math.abs(cx) < 0.13) return "cup";
  return "body";
}

function splitGrinder(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true);
  let mesh: THREE.Mesh | null = null;
  scene.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
  });
  const src = mesh! as THREE.Mesh;
  // geometria em float, já com a transformação do nó (a quantização do meshopt guarda escala/offset no nó)
  const g = toFloatGeometry(src.geometry);
  g.applyMatrix4(src.matrixWorld);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const idx = g.index!;
  const lists: Record<PartName, number[]> = { hopper: [], body: [], base: [], cup: [] };
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i);
    const b = idx.getX(i + 1);
    const c = idx.getX(i + 2);
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
    const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
    const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    lists[classify(cx, cy, cz)].push(a, b, c);
  }
  const parts = {} as Record<PartName, { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }>;
  (Object.keys(lists) as PartName[]).forEach((k) => {
    const pg = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "uv"]) {
      const at = g.getAttribute(name);
      if (at) pg.setAttribute(name, at);
    }
    pg.setIndex(lists[k]);
    const mat = (src.material as THREE.MeshStandardMaterial).clone();
    mat.envMapIntensity = 1.15;
    parts[k] = { geometry: pg, material: mat };
  });
  return parts;
}

const N = 420;

export default function Grinder({ progress }: { progress: StoryProgress }) {
  const { scene } = useGLTF(MODEL_URLS.grinder, false, true);
  const parts = useMemo(() => splitGrinder(scene), [scene]);
  const root = useRef<THREE.Group>(null);
  const refs = useRef<Record<PartName, THREE.Mesh | null>>({ hopper: null, body: null, base: null, cup: null });
  const powder = useRef<THREE.InstancedMesh>(null);

  const sim = useMemo(() => {
    const life = new Float32Array(N).map(() => Math.random());
    const off = Array.from({ length: N }, () => new THREE.Vector2((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1));
    const size = new Float32Array(N).map(() => 0.011 + Math.random() * 0.016);
    const spin = new Float32Array(N).map(() => Math.random() * 6);
    return { life, off, size, spin };
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const S = GRINDER.scale;

  useFrame((state, dtRaw) => {
    const p = progress.current.value;
    const dt = Math.min(dtRaw, 1 / 20);
    const t = state.clock.elapsedTime;
    const e = easeInOutCubic(range(p, T.explode[0], T.explode[1]));
    const out = easeInOutCubic(range(p, T.grinderOut[0], T.grinderOut[1]));
    const grind = range(p, T.grind[0], T.grind[1]);
    const grinding = grind > 0 && grind < 1;
    const r = refs.current;

    if (root.current) {
      root.current.visible = out < 1;
      // saída: as peças sobem e se abrem, desaparecendo
      root.current.position.set(GRINDER.position[0], GRINDER.position[1] + out * out * 3.2, GRINDER.position[2]);
      root.current.rotation.y = out * 0.6;
    }
    const v = grinding ? 0.012 : 0;
    // as peças ficam dentro de um grupo com escala S: deslocamentos em unidades do mundo / S
    if (r.body) r.body.position.set((Math.sin(t * 90) * v) / S, 0, (Math.cos(t * 77) * v) / S);
    if (r.hopper) r.hopper.position.y = (hopperLift(p) + out * 1.4) / S;
    if (r.base) r.base.position.set(0, (-0.9 * e) / S, (-1.1 * e) / S);
    if (r.cup) r.cup.position.set((0.6 * e) / S, (-0.45 * e) / S, (1.2 * e) / S);
    // só fica transparente enquanto está sumindo (evita o aspecto "fantasma" e problemas de ordenação)
    const fade = (m: THREE.MeshStandardMaterial, o: number) => {
      m.opacity = o;
      m.transparent = o < 0.999;
      m.depthWrite = o > 0.5;
    };
    fade(parts.body.material, 1 - out);
    fade(parts.hopper.material, 1 - out);
    fade(parts.base.material, 1 - e);
    fade(parts.cup.material, 1 - e);
    if (r.base) r.base.visible = e < 1;
    if (r.cup) r.cup.visible = e < 1;

    /* pó caindo da bica direto na cama do V60 */
    const m = powder.current;
    if (!m) return;
    m.visible = grinding;
    if (!grinding) return;
    const [cx, cy, cz] = GRINDER.chute;
    const bedTop = STAND.bed.y + 0.1 * grind;
    const fallLen = cy - bedTop;
    for (let i = 0; i < N; i++) {
      sim.life[i] += dt * 0.95;
      if (sim.life[i] > 1) {
        sim.life[i] -= 1;
        sim.off[i].set((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1);
      }
      const l = sim.life[i];
      const y = cy - fallLen * l * l;
      const spread = 1 + l * 2.2;
      dummy.position.set(cx + sim.off[i].x * spread, y, cz + sim.off[i].y * spread);
      dummy.rotation.set(sim.spin[i] + t * 3, sim.spin[i] * 2, t * 2);
      dummy.scale.setScalar(sim.size[i] * (1 - l * 0.25));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <group ref={root} position={GRINDER.position}>
        <group scale={S}>
          {(Object.keys(parts) as PartName[]).map((k) => (
            <mesh
              key={k}
              ref={(el) => void (refs.current[k] = el)}
              geometry={parts[k].geometry}
              material={parts[k].material}
              castShadow
              receiveShadow
            />
          ))}
        </group>
      </group>
      <instancedMesh ref={powder} args={[undefined, undefined, N]} frustumCulled={false} visible={false} castShadow>
        <tetrahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#3a2114" roughness={0.9} />
      </instancedMesh>
    </group>
  );
}
