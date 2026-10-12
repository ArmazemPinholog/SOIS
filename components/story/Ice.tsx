"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { StoryProgress } from "./StoryScene";
import { toFloatGeometry } from "./models";
import { CUP, CUP_INNER_BOTTOM, T } from "./layout";
import { range } from "@/components/three/math";

/* Gelo: forma dos GLBs (suavizada, porque a conversão por imagem deixou a superfície amassada)
   + material transparente de gelo em código, com um miolo leitoso como no gelo de verdade. */

const URLS = ["/models/gelo-1.glb", "/models/gelo-2.glb", "/models/gelo-3.glb"];
const SIZE = 0.235;

function prepare(src: THREE.BufferGeometry) {
  let g = toFloatGeometry(src, ["position"]);
  g = mergeVertices(g, 1e-4);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const index = g.index!;
  // vizinhança de cada vértice
  const nb: Set<number>[] = Array.from({ length: pos.count }, () => new Set<number>());
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    nb[a].add(b).add(c);
    nb[b].add(a).add(c);
    nb[c].add(a).add(b);
  }
  // suavização de Taubin (encolhe pouco): passos alternados +λ / -μ
  const p = new Float32Array(pos.array as ArrayLike<number>);
  const tmp = new Float32Array(p.length);
  const step = (k: number) => {
    for (let v = 0; v < pos.count; v++) {
      let sx = 0;
      let sy = 0;
      let sz = 0;
      const n = nb[v].size || 1;
      for (const u of nb[v]) {
        sx += p[u * 3];
        sy += p[u * 3 + 1];
        sz += p[u * 3 + 2];
      }
      tmp[v * 3] = p[v * 3] + k * (sx / n - p[v * 3]);
      tmp[v * 3 + 1] = p[v * 3 + 1] + k * (sy / n - p[v * 3 + 1]);
      tmp[v * 3 + 2] = p[v * 3 + 2] + k * (sz / n - p[v * 3 + 2]);
    }
    p.set(tmp);
  };
  for (let i = 0; i < 6; i++) {
    step(0.5);
    step(-0.53);
  }
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const size = bb.getSize(new THREE.Vector3());
  const c = bb.getCenter(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z);
  g.scale(SIZE / Math.max(size.x, size.y, size.z), SIZE / Math.max(size.x, size.y, size.z), SIZE / Math.max(size.x, size.y, size.z));
  g.computeVertexNormals();
  return g;
}

function firstGeometry(scene: THREE.Object3D) {
  let geo: THREE.BufferGeometry | null = null;
  scene.traverse((o) => {
    if (!geo && (o as THREE.Mesh).isMesh) geo = (o as THREE.Mesh).geometry;
  });
  return geo!;
}

/** Onde cada cubo assenta dentro do copo (local ao copo) e de onde cai. */
const B = CUP_INNER_BOTTOM;
const REST = [
  { pos: new THREE.Vector3(-0.15, B + 0.13, 0.05), rot: new THREE.Euler(0.3, 0.6, 0.15), delay: 0, shape: 0 },
  { pos: new THREE.Vector3(0.14, B + 0.14, -0.08), rot: new THREE.Euler(-0.2, 1.4, 0.4), delay: 0.12, shape: 1 },
  { pos: new THREE.Vector3(0.03, B + 0.38, 0.14), rot: new THREE.Euler(0.7, 2.2, -0.3), delay: 0.24, shape: 2 },
  { pos: new THREE.Vector3(-0.13, B + 0.43, -0.12), rot: new THREE.Euler(-0.5, 0.2, 0.6), delay: 0.36, shape: 0 },
  { pos: new THREE.Vector3(0.16, B + 0.62, 0.02), rot: new THREE.Euler(0.4, 2.9, 0.2), delay: 0.5, shape: 1 },
  { pos: new THREE.Vector3(-0.07, B + 0.78, 0.04), rot: new THREE.Euler(-0.3, 1.1, -0.5), delay: 0.64, shape: 2 },
];

export default function Ice({ progress }: { progress: StoryProgress }) {
  const gltfs = useGLTF(URLS, false, true);
  const geos = useMemo(() => gltfs.map((g) => prepare(firstGeometry(g.scene))), [gltfs]);
  const cores = useMemo(() => geos.map((g) => g.clone().scale(0.58, 0.58, 0.58)), [geos]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const qRest = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);

  const ice = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#f7fbff",
        transmission: 1,
        thickness: 0.22,
        ior: 1.31,
        roughness: 0.07,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        attenuationColor: new THREE.Color("#e3eef3"),
        attenuationDistance: 0.9,
        specularIntensity: 1,
        envMapIntensity: 1.4,
      }),
    [],
  );
  const core = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        transmission: 0.55,
        roughness: 0.75,
        thickness: 0.15,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    [],
  );

  useFrame((state) => {
    const p = progress.current.value;
    const t = state.clock.elapsedTime;
    REST.forEach((r, i) => {
      const g = groups.current[i];
      if (!g) return;
      const k = range(p, T.ice[0] + r.delay * 0.045, T.ice[0] + r.delay * 0.045 + 0.022);
      g.visible = k > 0;
      if (!g.visible) return;
      // queda com pequeno quique
      const fall = k < 0.8 ? (k / 0.8) ** 2 : 1 - Math.sin(((k - 0.8) / 0.2) * Math.PI) * 0.06;
      const startY = CUP.position[1] + 2.2;
      const y = THREE.MathUtils.lerp(startY, r.pos.y, Math.min(fall, 1)) + (k >= 0.8 ? (1 - fall) * 0.6 : 0);
      g.position.set(r.pos.x, y, r.pos.z);
      // gira ao cair e assenta
      e.set(r.rot.x + (1 - k) * 4, r.rot.y + (1 - k) * 3, r.rot.z + (1 - k) * 2);
      q.setFromEuler(e);
      qRest.setFromEuler(r.rot);
      g.quaternion.copy(q).slerp(qRest, k);
      // depois de assentado, boia de leve conforme o café sobe
      const fill = range(p, T.fill[0], T.fill[1]);
      if (k >= 1) g.position.y += Math.sin(t * 1.4 + i) * 0.005 * fill + fill * 0.03 * (i >= 4 ? 1 : 0.3);
    });
  });

  return (
    <group position={CUP.position}>
      {REST.map((r, i) => (
        <group key={i} ref={(el) => void (groups.current[i] = el)} visible={false}>
          <mesh geometry={geos[r.shape]} material={ice} castShadow />
          <mesh geometry={cores[r.shape]} material={core} />
        </group>
      ))}
    </group>
  );
}

useGLTF.preload(URLS, false, true);
