"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SURFACE_FRAG, SURFACE_VERT } from "@/components/three/liquid/shaders";
import { CUP, CUP_HEIGHT, CUP_INNER_BOTTOM, CUP_PROFILE, cupOuterRadius } from "./layout";

/* Café dentro do copo: corpo cônico acompanhando a parede interna + superfície com ondas. */

export const innerRadius = (y: number) => cupOuterRadius(y) - CUP_PROFILE.wall * CUP.scale - 0.004;
export const levelToY = (level: number) => CUP_INNER_BOTTOM + level * (CUP_HEIGHT * 0.86 - CUP_INNER_BOTTOM);

type Props = { levelRef: RefObject<number>; impactRef: RefObject<number> };

const SEG = 72;

export default function CupCoffee({ levelRef, impactRef }: Props) {
  const body = useRef<THREE.Mesh>(null);
  const surf = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, SEG, 1, false), []);
  const bodyMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#170904", roughness: 0.18, clearcoat: 0.6, envMapIntensity: 0.5 }),
    [],
  );
  const rMax = innerRadius(CUP_HEIGHT);
  const plane = useMemo(() => {
    const g = new THREE.PlaneGeometry(rMax * 2, rMax * 2, 96, 96);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [rMax]);
  const surface = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: SURFACE_FRAG,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uImpact: { value: 0 }, uRadius: { value: 0.3 }, uKind: { value: 0 } },
      }),
    [],
  );

  useFrame((s) => {
    const lvl = THREE.MathUtils.clamp(levelRef.current ?? 0, 0, 1);
    const vis = lvl > 0.003;
    if (body.current) body.current.visible = vis;
    if (surf.current) surf.current.visible = vis;
    if (!vis) return;
    const y1 = levelToY(lvl);
    const y0 = CUP_INNER_BOTTOM;
    // reposiciona os anéis de topo e base do cilindro unitário
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const rt = innerRadius(y1);
    const rb = innerRadius(y0);
    for (let i = 0; i < pos.count; i++) {
      const top = pos.getY(i) > 0;
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const len = Math.hypot(x, z);
      if (len < 1e-6) {
        pos.setY(i, top ? y1 : y0);
        continue;
      }
      const r = top ? rt : rb;
      pos.setXYZ(i, (x / len) * r, top ? y1 : y0, (z / len) * r);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    if (surf.current) surf.current.position.y = y1;
    surface.uniforms.uRadius.value = rt;
    surface.uniforms.uTime.value = s.clock.elapsedTime;
    surface.uniforms.uImpact.value = impactRef.current ?? 0;
  });

  return (
    <group position={CUP.position}>
      <mesh ref={body} geometry={geo} material={bodyMat} visible={false} />
      <mesh ref={surf} geometry={plane} material={surface} visible={false} />
    </group>
  );
}
