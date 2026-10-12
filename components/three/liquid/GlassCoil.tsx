"use client";

import { useMemo, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { COIL_FRAG, COIL_VERT } from "./shaders";

/* Serpentina de vidro com o café percorrendo o tubo (uFill = fração do comprimento já preenchida). */

export const COIL = {
  top: 3.55,
  bottom: 2.45,
  radius: 0.34,
  turns: 4.5,
  /** onde o tubo termina e o fio cai */
  exitY: 2.1,
};

export function coilCurve() {
  const pts: THREE.Vector3[] = [new THREE.Vector3(0, COIL.top + 0.45, 0), new THREE.Vector3(0, COIL.top + 0.1, 0)];
  const steps = Math.round(COIL.turns * 28);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * COIL.turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * COIL.radius, THREE.MathUtils.lerp(COIL.top, COIL.bottom, t), Math.sin(a) * COIL.radius));
  }
  pts.push(new THREE.Vector3(COIL.radius * 0.3, COIL.bottom - 0.18, 0));
  pts.push(new THREE.Vector3(0, COIL.exitY + 0.1, 0));
  pts.push(new THREE.Vector3(0, COIL.exitY, 0));
  return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
}

type Props = { fillRef: RefObject<number> };

export default function GlassCoil({ fillRef }: Props) {
  const curve = useMemo(() => coilCurve(), []);
  const glassGeo = useMemo(() => new THREE.TubeGeometry(curve, 720, 0.062, 16, false), [curve]);
  const liquidGeo = useMemo(() => new THREE.TubeGeometry(curve, 720, 0.044, 14, false), [curve]);
  const liquid = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: COIL_VERT,
        fragmentShader: COIL_FRAG,
        uniforms: { uFill: { value: 0 }, uTime: { value: 0 } },
      }),
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
      {/* colar de latão na entrada */}
      <mesh position={[0, COIL.top + 0.42, 0]}>
        <cylinderGeometry args={[0.1, 0.075, 0.2, 32]} />
        <meshStandardMaterial color="#b8893a" metalness={1} roughness={0.28} envMapIntensity={1.4} />
      </mesh>
    </group>
  );
}
