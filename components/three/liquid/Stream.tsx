"use client";

import { useMemo, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STREAM_FRAG, STREAM_VERT } from "./shaders";

export type StreamKind = "coffee" | "water";

type Props = {
  kind: StreamKind;
  /** comprimento total do fio (unidades da cena) */
  length: number;
  /** raio no topo */
  radius: number;
  /** 0..1: até onde o fio já desceu (a "cabeça" arredondada) */
  headRef: RefObject<number>;
  /** 0..1: quanto do topo do fio já se soltou (fim do despejo). Opcional. */
  tailRef?: RefObject<number>;
  position?: [number, number, number];
  twist?: number;
  amp?: number;
  thin?: number;
  /** brilho âmbar nas bordas (translucidez) e força dos reflexos; fios finos pedem menos */
  glow?: number;
  env?: number;
};

/** Mesma fórmula do vertex shader, para posicionar gotas sobre o fio. */
export function streamCentre(s: number, length: number, twist: number, time: number, out = new THREE.Vector3()) {
  const y = s * length;
  const ph = y * 3.2 - time * 2.4;
  const sm = THREE.MathUtils.smoothstep(s, 0, 0.5);
  const a = twist * sm * (0.5 + 0.5 * s);
  return out.set(Math.sin(ph) * a, -y, Math.cos(ph) * a * 0.8);
}

export default function Stream({
  kind,
  length,
  radius,
  headRef,
  tailRef,
  position = [0, 0, 0],
  twist = 0.05,
  amp = 0.16,
  thin = 0.42,
  glow = 1,
  env = 1,
}: Props) {
  const geometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 40, 220, true), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: STREAM_VERT,
        fragmentShader: STREAM_FRAG,
        transparent: true,
        depthWrite: kind === "coffee",
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uLen: { value: length },
          uR0: { value: radius },
          uHead: { value: 0 },
          uTwist: { value: twist },
          uAmp: { value: amp },
          uThin: { value: thin },
          uTail: { value: 0 },
          uKind: { value: kind === "water" ? 1 : 0 },
          uGlow: { value: glow },
          uEnv: { value: env },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind],
  );

  useFrame((state) => {
    const u = material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uLen.value = length;
    u.uR0.value = radius;
    u.uTwist.value = twist;
    u.uAmp.value = amp;
    u.uThin.value = thin;
    u.uHead.value = headRef.current ?? 0;
    u.uTail.value = tailRef?.current ?? 0;
    u.uGlow.value = glow;
    u.uEnv.value = env;
  });

  return (
    <mesh position={position} geometry={geometry} material={material} frustumCulled={false} renderOrder={kind === "water" ? 3 : 2} />
  );
}
