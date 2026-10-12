"use client";

import { useMemo, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SURFACE_FRAG, SURFACE_VERT } from "./shaders";
import type { StreamKind } from "./Stream";

/* Copo de vidro simples com líquido que sobe e superfície com ondas (para o teste isolado).
   O copo real da Sóis entra depois, pela geometria por revolução + estampa. */

export const GLASS = { radius: 0.56, height: 1.15 };

type Props = {
  kind: StreamKind;
  /** 0..1: nível do líquido */
  levelRef: RefObject<number>;
  /** 0..1: intensidade do impacto do fio (ondas) */
  impactRef: RefObject<number>;
  position?: [number, number, number];
};

export default function GlassCup({ kind, levelRef, impactRef, position = [0, 0, 0] }: Props) {
  const inner = GLASS.radius - 0.035;
  const surface = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: SURFACE_FRAG,
        transparent: kind === "water",
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uImpact: { value: 0 },
          uRadius: { value: inner },
          uKind: { value: kind === "water" ? 1 : 0 },
        },
      }),
    [kind, inner],
  );
  const planeGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(inner * 2, inner * 2, 90, 90);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [inner]);

  const bodyGeo = useMemo(() => new THREE.CylinderGeometry(inner, inner * 0.94, 1, 64, 1, false), [inner]);
  const body = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: kind === "water" ? new THREE.Color("#a9c6d4") : new THREE.Color("#1a0a04"),
        roughness: kind === "water" ? 0.02 : 0.16,
        transparent: true,
        opacity: kind === "water" ? 0.14 : 0.98,
        envMapIntensity: kind === "water" ? 1.4 : 0.6,
      }),
    [kind],
  );

  const bodyRef = useMemo(() => ({ current: null as THREE.Mesh | null }), []);
  const surfRef = useMemo(() => ({ current: null as THREE.Mesh | null }), []);
  const innerH = GLASS.height - 0.1;

  useFrame((s) => {
    const lvl = THREE.MathUtils.clamp(levelRef.current ?? 0, 0, 1);
    const h = Math.max(0.001, 0.06 + lvl * (innerH * 0.82));
    const empty = lvl < 0.004; // copo vazio antes de o fio chegar
    if (bodyRef.current) bodyRef.current.visible = !empty;
    if (surfRef.current) surfRef.current.visible = !empty;
    if (bodyRef.current) {
      bodyRef.current.scale.y = h;
      bodyRef.current.position.y = 0.05 + h / 2;
    }
    if (surfRef.current) surfRef.current.position.y = 0.05 + h;
    surface.uniforms.uTime.value = s.clock.elapsedTime;
    surface.uniforms.uImpact.value = impactRef.current ?? 0;
  });

  return (
    <group position={position}>
      {/* líquido */}
      <mesh ref={(m) => void (bodyRef.current = m)} geometry={bodyGeo} material={body} renderOrder={1} />
      <mesh ref={(m) => void (surfRef.current = m)} geometry={planeGeo} material={surface} renderOrder={1} />
      {/* vidro: parede + fundo grosso */}
      <mesh position={[0, GLASS.height / 2, 0]} renderOrder={5}>
        <cylinderGeometry args={[GLASS.radius, GLASS.radius * 0.95, GLASS.height, 64, 1, true]} />
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0.02}
          transparent
          opacity={0.14}
          envMapIntensity={1.6}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.025, 0]} renderOrder={5}>
        <cylinderGeometry args={[GLASS.radius * 0.95, GLASS.radius * 0.95, 0.05, 64]} />
        <meshPhysicalMaterial color="#ffffff" roughness={0.02} transparent opacity={0.3} envMapIntensity={1.6} depthWrite={false} />
      </mesh>
      <mesh position={[0, GLASS.height, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={5}>
        <torusGeometry args={[GLASS.radius - 0.012, 0.014, 12, 80]} />
        <meshPhysicalMaterial color="#ffffff" roughness={0.03} transparent opacity={0.4} envMapIntensity={2} depthWrite={false} />
      </mesh>
    </group>
  );
}
