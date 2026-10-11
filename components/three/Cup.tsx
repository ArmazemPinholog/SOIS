"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { COLORS, createCupTexture, seeded } from "./assets";
import type { ProgressRef } from "./Experience";
import { easeInOutCubic, easeOutBack, easeOutCubic, range } from "./math";

// Medidas do copo (unidades da cena). Base na origem do grupo.
const H = 2.3;
const R_BOTTOM = 0.74;
const R_TOP = 0.98;
const radiusAt = (y: number) => R_BOTTOM + (R_TOP - R_BOTTOM) * (y / H);

const STREAM_TOP = H + 6;
const ICE = [
  { x: -0.22, z: 0.12, s: 0.4, rot: [0.3, 0.6, 0.1] },
  { x: 0.26, z: -0.08, s: 0.36, rot: [0.7, 0.2, 0.5] },
  { x: 0.02, z: -0.3, s: 0.34, rot: [0.1, 1.1, 0.4] },
];

type Props = {
  progress: ProgressRef;
  position: [number, number, number];
  scale: number;
};

function lathe(radiusScale: number, segments = 128) {
  const pts: THREE.Vector2[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * H;
    pts.push(new THREE.Vector2(radiusAt(y) * radiusScale, y));
  }
  return new THREE.LatheGeometry(pts, segments);
}

export default function Cup({ progress, position, scale }: Props) {
  const gl = useThree((s) => s.gl);
  const group = useRef<THREE.Group>(null);
  const cup = useRef<THREE.Group>(null);
  const surface = useRef<THREE.Mesh>(null);
  const stream = useRef<THREE.Mesh>(null);
  const ice = useRef<(THREE.Mesh | null)[]>([]);

  const texture = useMemo(() => createCupTexture(gl.capabilities.getMaxAnisotropy()), [gl]);
  const outer = useMemo(() => lathe(1), []);
  const inner = useMemo(() => lathe(0.975), []);
  const streamGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.06, 0.075, 1, 24, 1, true);
    g.translate(0, -0.5, 0); // topo na origem: escala Y = comprimento
    return g;
  }, []);
  const iceSeeds = useMemo(() => {
    const r = seeded(9);
    return ICE.map(() => r() * Math.PI * 2);
  }, []);

  useFrame((state) => {
    const g = group.current;
    const c = cup.current;
    if (!g || !c) return;
    const p = progress.current.value;
    const t = state.clock.elapsedTime;

    const enter = easeOutCubic(range(p, 0.5, 0.62));
    g.visible = p > 0.48;
    if (!g.visible) return;
    g.position.set(position[0], position[1] - (1 - enter) * 8, position[2]);

    // giro: leve rotação constante + volta completa conduzida pelo scroll no fim + inclinação pelo mouse
    const turn = easeInOutCubic(range(p, 0.78, 1));
    c.rotation.y = -0.5 + t * 0.06 + turn * Math.PI * 1.5;
    c.rotation.x = THREE.MathUtils.lerp(c.rotation.x, -state.pointer.y * 0.06, 0.05);
    c.rotation.z = THREE.MathUtils.lerp(c.rotation.z, -state.pointer.x * 0.05, 0.05);

    // café enchendo
    const fill = easeInOutCubic(range(p, 0.6, 0.76));
    const level = 0.1 + fill * (H - 0.26);
    if (surface.current) {
      surface.current.visible = fill > 0.01;
      surface.current.position.y = level;
      const r = radiusAt(level) * 0.97;
      surface.current.scale.set(r, r, 1);
    }

    // fio de café: a "cabeça" desce até a superfície, depois a "cauda" desce e some
    if (stream.current) {
      const head = easeOutCubic(range(p, 0.57, 0.61));
      const tail = easeInOutCubic(range(p, 0.75, 0.79));
      const top = STREAM_TOP - tail * (STREAM_TOP - level);
      const bottom = STREAM_TOP - head * (STREAM_TOP - level);
      const len = Math.max(0.0001, top - bottom);
      stream.current.visible = head > 0 && tail < 1;
      stream.current.position.y = top;
      const wobble = 1 + Math.sin(t * 18) * 0.06;
      stream.current.scale.set(wobble, len, wobble);
    }

    // gelo caindo no copo
    ICE.forEach((cube, i) => {
      const m = ice.current[i];
      if (!m) return;
      const drop = range(p, 0.72 + i * 0.025, 0.79 + i * 0.025);
      m.visible = drop > 0;
      const y0 = H + 4;
      const yEnd = level - cube.s * 0.25 + Math.sin(t * 1.4 + iceSeeds[i]) * 0.015;
      m.position.set(cube.x, y0 + (yEnd - y0) * easeOutBack(drop), cube.z);
      m.rotation.set(
        cube.rot[0] + (1 - drop) * 2.5,
        cube.rot[1] + (1 - drop) * 1.5 + t * 0.05,
        cube.rot[2],
      );
    });
  });

  return (
    <group ref={group} position={position} scale={scale}>
      {/* chão infinito (ciclorama): mesma cor da parede, sem linha de horizonte */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.001, -4]}>
        <planeGeometry args={[120, 60]} />
        <meshBasicMaterial color={COLORS.creme} toneMapped={false} />
      </mesh>
      {/* só a sombra projetada pela luz do sol */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, -4]} receiveShadow>
        <planeGeometry args={[120, 60]} />
        <shadowMaterial color="#6b4524" opacity={0.22} />
      </mesh>
      <ContactShadows position={[0, 0.002, 0]} scale={5} blur={2.4} opacity={0.5} far={3} color="#5a3a22" />

      <group ref={cup}>
        {/* corpo com a estampa */}
        <mesh geometry={outer} castShadow>
          <meshPhysicalMaterial map={texture} roughness={0.55} clearcoat={0.25} clearcoatRoughness={0.6} side={THREE.FrontSide} />
        </mesh>
        {/* parte interna de papel */}
        <mesh geometry={inner}>
          <meshStandardMaterial color="#e9d6b3" roughness={0.9} side={THREE.BackSide} />
        </mesh>
        {/* borda enrolada */}
        <mesh position-y={H} rotation-x={Math.PI / 2}>
          <torusGeometry args={[R_TOP * 0.99, 0.035, 16, 128]} />
          <meshStandardMaterial color={COLORS.creme} roughness={0.7} />
        </mesh>
        {/* fundo */}
        <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
          <circleGeometry args={[R_BOTTOM, 64]} />
          <meshStandardMaterial color="#e9d6b3" />
        </mesh>
        {/* superfície do café */}
        <mesh ref={surface} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1, 64]} />
          <meshPhysicalMaterial color="#2b150c" roughness={0.12} clearcoat={1} clearcoatRoughness={0.05} />
        </mesh>
        {/* gelo */}
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
              color="#fff7ec"
              transmission={1}
              thickness={0.45}
              roughness={0.06}
              ior={1.31}
              clearcoat={1}
              attenuationColor="#e8c79a"
              attenuationDistance={1.2}
            />
          </RoundedBox>
        ))}
      </group>

      {/* fio de café */}
      <mesh ref={stream} geometry={streamGeo} visible={false}>
        <meshPhysicalMaterial color="#3a1c0e" roughness={0.08} clearcoat={1} clearcoatRoughness={0.05} />
      </mesh>
    </group>
  );
}
