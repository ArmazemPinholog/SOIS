"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export const MODEL_URLS = {
  grinder: "/models/moedor.glb",
  stand: "/models/suporte-coado.glb",
  kettle: "/models/chaleira.glb",
  bean: "/models/graodecafe.glb",
} as const;

/** Clona a cena do GLB e liga sombras (projeta e recebe). */
export function useModel(url: string, envIntensity = 1.1) {
  const { scene } = useGLTF(url, false, true);
  return useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && "envMapIntensity" in mat) mat.envMapIntensity = envIntensity;
      }
    });
    return c;
  }, [scene, envIntensity]);
}

/** Converte atributos quantizados/intercalados (meshopt) em Float32 simples, para editar a geometria. */
export function toFloatGeometry(src: THREE.BufferGeometry, attrs: string[] = ["position", "normal", "uv"]) {
  const g = new THREE.BufferGeometry();
  for (const name of attrs) {
    const a = src.getAttribute(name) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
    if (!a) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) {
      out[i * a.itemSize] = a.getX(i);
      if (a.itemSize > 1) out[i * a.itemSize + 1] = a.getY(i);
      if (a.itemSize > 2) out[i * a.itemSize + 2] = a.getZ(i);
      if (a.itemSize > 3) out[i * a.itemSize + 3] = a.getW(i);
    }
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  if (src.index) g.setIndex(Array.from(src.index.array as ArrayLike<number>));
  return g;
}

for (const url of Object.values(MODEL_URLS)) useGLTF.preload(url, false, true);
