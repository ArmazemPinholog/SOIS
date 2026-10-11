"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { COLORS, createCupTexture, seeded } from "./assets";
import { easeOutBack } from "./math";

// Medidas do copo (unidades locais). Base na origem.
export const CUP_H = 2.3;
const R_BOTTOM = 0.74;
const R_TOP = 0.98;
export const cupRadiusAt = (y: number) => R_BOTTOM + (R_TOP - R_BOTTOM) * (y / CUP_H);
/** altura da superfície do café para um enchimento 0..1 */
export const cupLevel = (fill: number) => 0.1 + fill * (CUP_H - 0.26);

const ICE = [
  { x: -0.22, z: 0.12, s: 0.4, rot: [0.3, 0.6, 0.1] },
  { x: 0.26, z: -0.08, s: 0.36, rot: [0.7, 0.2, 0.5] },
  { x: 0.02, z: -0.3, s: 0.34, rot: [0.1, 1.1, 0.4] },
];

/** Estado do copo controlado de fora (mutável, lido a cada frame). */
export type CupState = {
  fill: number; // 0..1
  ice: number; // 0..1, gelo caindo dentro do copo
  spin: number; // rotação extra em radianos
};

function lathe(radiusScale: number, segments = 128) {
  const pts: THREE.Vector2[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * CUP_H;
    pts.push(new THREE.Vector2(cupRadiusAt(y) * radiusScale, y));
  }
  return new THREE.LatheGeometry(pts, segments);
}

export default function Cup({ state }: { state: RefObject<CupState> }) {
  const gl = useThree((s) => s.gl);
  const body = useRef<THREE.Group>(null);
  const surface = useRef<THREE.Mesh>(null);
  const ice = useRef<(THREE.Mesh | null)[]>([]);

  const texture = useMemo(() => createCupTexture(gl.capabilities.getMaxAnisotropy()), [gl]);
  const outer = useMemo(() => lathe(1), []);
  const inner = useMemo(() => lathe(0.975), []);
  const iceSeeds = useMemo(() => {
    const r = seeded(9);
    return ICE.map(() => r() * Math.PI * 2);
  }, []);

  useFrame((frame) => {
    const s = state.current;
    const t = frame.clock.elapsedTime;
    if (body.current) {
      body.current.rotation.y = -0.5 + t * 0.06 + s.spin;
      body.current.rotation.x = THREE.MathUtils.lerp(body.current.rotation.x, -frame.pointer.y * 0.05, 0.05);
      body.current.rotation.z = THREE.MathUtils.lerp(body.current.rotation.z, -frame.pointer.x * 0.04, 0.05);
    }

    const level = cupLevel(s.fill);
    if (surface.current) {
      surface.current.visible = s.fill > 0.01;
      surface.current.position.y = level;
      const r = cupRadiusAt(level) * 0.97;
      surface.current.scale.set(r, r, 1);
    }

    // o gelo cai antes do café e depois sobe junto com o nível
    ICE.forEach((cube, i) => {
      const m = ice.current[i];
      if (!m) return;
      const drop = THREE.MathUtils.clamp((s.ice - i * 0.18) / 0.64, 0, 1);
      m.visible = drop > 0;
      const rest = Math.max(0.1 + cube.s * 0.5 + i * 0.12, level - cube.s * 0.25);
      const yEnd = rest + Math.sin(t * 1.4 + iceSeeds[i]) * (s.fill > 0.2 ? 0.015 : 0);
      const y0 = CUP_H + 3.5;
      m.position.set(cube.x, y0 + (yEnd - y0) * easeOutBack(drop), cube.z);
      m.rotation.set(cube.rot[0] + (1 - drop) * 2.5, cube.rot[1] + (1 - drop) * 1.5, cube.rot[2]);
    });
  });

  return (
    <group>
      <group ref={body}>
        <mesh geometry={outer} castShadow>
          <meshPhysicalMaterial map={texture} roughness={0.55} clearcoat={0.25} clearcoatRoughness={0.6} />
        </mesh>
        <mesh geometry={inner}>
          <meshStandardMaterial color="#e9d6b3" roughness={0.9} side={THREE.BackSide} />
        </mesh>
        <mesh position-y={CUP_H} rotation-x={Math.PI / 2}>
          <torusGeometry args={[R_TOP * 0.99, 0.035, 16, 128]} />
          <meshStandardMaterial color={COLORS.creme} roughness={0.7} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
          <circleGeometry args={[R_BOTTOM, 64]} />
          <meshStandardMaterial color="#e9d6b3" />
        </mesh>
      </group>
      {/* café e gelo não giram com o copo */}
      <mesh ref={surface} rotation-x={-Math.PI / 2} visible={false}>
        <circleGeometry args={[1, 64]} />
        <meshPhysicalMaterial color="#2b150c" roughness={0.12} clearcoat={1} clearcoatRoughness={0.05} />
      </mesh>
      {ICE.map((cube, i) => (
        <RoundedBox
          key={i}
          ref={(el: THREE.Mesh | null) => {
            ice.current[i] = el;
          }}
          args={[cube.s, cube.s, cube.s]}
          radius={0.05}
          smoothness={4}
          visible={false}
        >
          <meshPhysicalMaterial
            color="#f3e6d2"
            transparent
            opacity={0.55}
            roughness={0.05}
            clearcoat={1}
            clearcoatRoughness={0.02}
            envMapIntensity={2}
          />
        </RoundedBox>
      ))}
    </group>
  );
}
