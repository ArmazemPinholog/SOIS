"use client";

import { useMemo, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { COIL_FRAG, COIL_VERT } from "./shaders";

/* Serpentina de vidro com o café percorrendo o tubo (uFill = fração do comprimento já preenchida). */

export type CoilConfig = {
  /** y onde o tubo começa (sai da fonte) */
  entryTop: number;
  top: number;
  bottom: number;
  radius: number;
  turns: number;
  /** onde o tubo termina e o fio cai */
  exitY: number;
  tube: number;
  liquid: number;
};

export const COIL: CoilConfig = {
  entryTop: 4.0,
  top: 3.55,
  bottom: 2.45,
  radius: 0.34,
  turns: 4.5,
  exitY: 2.1,
  tube: 0.062,
  liquid: 0.044,
};

export function coilCurve(cfg: CoilConfig = COIL) {
  const pts: THREE.Vector3[] = [new THREE.Vector3(0, cfg.entryTop, 0), new THREE.Vector3(0, cfg.top + 0.1, 0)];
  const steps = Math.round(cfg.turns * 28);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * cfg.turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * cfg.radius, THREE.MathUtils.lerp(cfg.top, cfg.bottom, t), Math.sin(a) * cfg.radius));
  }
  const last = pts[pts.length - 1];
  pts.push(new THREE.Vector3(last.x * 0.3, cfg.bottom - (cfg.bottom - cfg.exitY) * 0.55, last.z * 0.3));
  pts.push(new THREE.Vector3(0, cfg.exitY + 0.08, 0));
  pts.push(new THREE.Vector3(0, cfg.exitY, 0));
  return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
}

type Props = { fillRef: RefObject<number>; cfg?: CoilConfig; collar?: boolean; glow?: number; env?: number };

export default function GlassCoil({ fillRef, cfg = COIL, collar = true, glow = 0.85, env = 0.45 }: Props) {
  const curve = useMemo(() => coilCurve(cfg), [cfg]);
  const glassGeo = useMemo(() => new THREE.TubeGeometry(curve, 720, cfg.tube, 16, false), [curve, cfg]);
  const liquidGeo = useMemo(() => new THREE.TubeGeometry(curve, 720, cfg.liquid, 14, false), [curve, cfg]);
  const liquid = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: COIL_VERT,
        fragmentShader: COIL_FRAG,
        uniforms: { uFill: { value: 0 }, uTime: { value: 0 }, uGlow: { value: glow }, uEnv: { value: env } },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((s) => {
    liquid.uniforms.uFill.value = fillRef.current ?? 0;
    liquid.uniforms.uTime.value = s.clock.elapsedTime;
  });

  return (
    <group>
      <mesh geometry={liquidGeo} material={liquid} renderOrder={1} />
      <mesh geometry={glassGeo} renderOrder={5}>
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0.02}
          transparent
          opacity={0.11}
          envMapIntensity={1.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {collar && (
        <mesh position={[0, cfg.entryTop - 0.03, 0]}>
          <cylinderGeometry args={[0.1, 0.075, 0.2, 32]} />
          <meshStandardMaterial color="#b8893a" metalness={1} roughness={0.28} envMapIntensity={1.4} />
        </mesh>
      )}
    </group>
  );
}
