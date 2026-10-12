"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { streamCentre, type StreamKind } from "./Stream";

/* Gotas em instâncias (um único draw call):
   - "satélites" que se soltam do fio, como nos vídeos de referência;
   - "coroa" de respingos quando o fio bate na superfície. */

type Props = {
  kind: StreamKind;
  /** y do topo do fio e comprimento total do <Stream> */
  top: number;
  length: number;
  twist: number;
  /** 0..1: quanto o fio já desceu */
  headRef: RefObject<number>;
  /** 0..1: parte do topo do fio que já se soltou (opcional) */
  tailRef?: RefObject<number>;
  /** 0..1: intensidade do fluxo (controla a taxa de gotas) */
  flowRef: RefObject<number>;
  /** y atual da superfície do líquido no copo (sobe com o nível) */
  surfaceYRef: RefObject<number>;
  /** 1 quando o fio já toca a superfície (liga a coroa de respingos) */
  touchRef: RefObject<number>;
  position?: [number, number, number];
  max?: number;
};

const GRAVITY = 7.5;

export default function Drops({
  kind,
  top,
  length,
  twist,
  headRef,
  tailRef,
  flowRef,
  surfaceYRef,
  touchRef,
  position = [0, 0, 0],
  max = 220,
}: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const state = useMemo(
    () => ({
      pos: new Float32Array(max * 3),
      vel: new Float32Array(max * 3),
      size: new Float32Array(max),
      life: new Float32Array(max), // <=0 = livre
      cursor: 0,
      accShed: 0,
      accCrown: 0,
    }),
    [max],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const water = kind === "water";

  const spawn = (x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number) => {
    const i = state.cursor;
    state.cursor = (state.cursor + 1) % max;
    state.pos[i * 3] = x;
    state.pos[i * 3 + 1] = y;
    state.pos[i * 3 + 2] = z;
    state.vel[i * 3] = vx;
    state.vel[i * 3 + 1] = vy;
    state.vel[i * 3 + 2] = vz;
    state.size[i] = size;
    state.life[i] = 1;
  };

  useFrame((s, dtRaw) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(dtRaw, 1 / 20);
    const head = headRef.current ?? 0;
    const flow = flowRef.current ?? 0;
    const time = s.clock.elapsedTime;
    const surfaceY = surfaceYRef.current ?? top - length;
    const touching = (touchRef.current ?? 0) > 0.5;

    // satélites: pequenas gotas que escapam do fio
    state.accShed += dt * 26 * flow * (water ? 0.5 : 1);
    while (state.accShed > 1) {
      state.accShed -= 1;
      const tail = tailRef?.current ?? 0;
      const from = Math.max(0.12, tail);
      const sPos = from + Math.random() * 0.85 * Math.max(head - from, 0.02);
      streamCentre(sPos, length, twist, time, tmp);
      const a = Math.random() * Math.PI * 2;
      const out = 0.18 + Math.random() * 0.5;
      spawn(
        tmp.x + Math.cos(a) * 0.05,
        top + tmp.y,
        tmp.z + Math.sin(a) * 0.05,
        Math.cos(a) * out,
        -Math.random() * 0.4,
        Math.sin(a) * out,
        0.008 + Math.random() * 0.013,
      );
    }
    // coroa: só depois que o fio toca a superfície
    if (touching) {
      state.accCrown += dt * 46 * flow * (water ? 0.6 : 1);
      while (state.accCrown > 1) {
        state.accCrown -= 1;
        const a = Math.random() * Math.PI * 2;
        const out = 0.45 + Math.random() * 1.1;
        spawn(
          Math.cos(a) * 0.06,
          surfaceY + 0.02,
          Math.sin(a) * 0.06,
          Math.cos(a) * out,
          1.4 + Math.random() * 2.2,
          Math.sin(a) * out,
          0.007 + Math.random() * 0.015,
        );
      }
    }

    for (let i = 0; i < max; i++) {
      if (state.life[i] <= 0) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const i3 = i * 3;
      state.vel[i3 + 1] -= GRAVITY * dt;
      state.pos[i3] += state.vel[i3] * dt;
      state.pos[i3 + 1] += state.vel[i3 + 1] * dt;
      state.pos[i3 + 2] += state.vel[i3 + 2] * dt;
      if (state.pos[i3 + 1] < surfaceY && state.vel[i3 + 1] < 0) {
        state.life[i] = 0;
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const speed = Math.hypot(state.vel[i3], state.vel[i3 + 1], state.vel[i3 + 2]);
      dir.set(state.vel[i3], state.vel[i3 + 1], state.vel[i3 + 2]).normalize();
      dummy.quaternion.setFromUnitVectors(up, dir);
      const r = state.size[i];
      dummy.scale.set(r, r * (1 + Math.min(speed * 0.35, 1.4)), r);
      dummy.position.set(state.pos[i3], state.pos[i3 + 1], state.pos[i3 + 2]);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, max]} position={position} frustumCulled={false} renderOrder={4}>
      <sphereGeometry args={[1, 12, 9]} />
      {water ? (
        <meshPhysicalMaterial color="#dbe9f0" roughness={0.04} metalness={0} transparent opacity={0.55} envMapIntensity={1.6} clearcoat={1} />
      ) : (
        <meshPhysicalMaterial color="#3a1a08" roughness={0.05} metalness={0} envMapIntensity={2.2} clearcoat={1} clearcoatRoughness={0.03} />
      )}
    </instancedMesh>
  );
}
