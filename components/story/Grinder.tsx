"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useModel, MODEL_URLS } from "./models";
import type { StoryProgress } from "./StoryScene";
import { GRINDER, T } from "./layout";
import { range } from "@/components/three/math";

/* Moedor real (GLB) + pó saindo da bica e formando um monte no copinho. */

const N = 240;

export default function Grinder({ progress }: { progress: StoryProgress }) {
  const model = useModel(MODEL_URLS.grinder);
  const body = useRef<THREE.Group>(null);
  const powder = useRef<THREE.InstancedMesh>(null);
  const mound = useRef<THREE.Mesh>(null);
  const tex = useTexture("/img/po-cafe.webp");
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.5, 1.5);
  }, [tex]);

  const sim = useMemo(() => {
    const life = new Float32Array(N).map(() => Math.random());
    const off = Array.from({ length: N }, () => new THREE.Vector3((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.08));
    const size = new Float32Array(N).map(() => 0.012 + Math.random() * 0.016);
    const spin = new Float32Array(N).map(() => Math.random() * 6);
    return { life, off, size, spin };
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [cx, cyChute, cz] = GRINDER.chute;
  const cupTop = GRINDER.catchCup.center[1];
  const cupBottom = GRINDER.catchCup.bottomY;

  useFrame((state, dtRaw) => {
    const p = progress.current.value;
    const dt = Math.min(dtRaw, 1 / 20);
    const t = state.clock.elapsedTime;
    const grind = range(p, T.grind[0], T.grind[1]);
    const active = grind > 0 && grind < 1;

    // vibração do motor
    if (body.current) {
      const v = active ? 0.006 : 0;
      body.current.position.set(GRINDER.position[0] + Math.sin(t * 90) * v, 0, GRINDER.position[2] + Math.cos(t * 77) * v);
    }

    // monte de pó cresce no copinho
    const moundH = 0.03 + grind * 0.3;
    if (mound.current) {
      mound.current.visible = grind > 0;
      mound.current.scale.set(1, moundH / 0.3, 1);
      mound.current.position.y = cupBottom + moundH / 2;
    }
    const surface = cupBottom + moundH * 0.8;

    const m = powder.current;
    if (!m) return;
    m.visible = active;
    if (!active) return;
    const fallLen = cyChute - surface;
    for (let i = 0; i < N; i++) {
      sim.life[i] += dt * 1.6;
      if (sim.life[i] > 1) {
        sim.life[i] -= 1;
        sim.off[i].set((Math.random() - 0.5) * 0.09, 0, (Math.random() - 0.5) * 0.09);
      }
      const l = sim.life[i];
      // aceleração da gravidade: desce devagar no começo e mais rápido embaixo
      const y = cyChute - fallLen * l * l;
      const spread = 1 + l * 1.4;
      dummy.position.set(cx + sim.off[i].x * spread, y, cz + sim.off[i].z * spread);
      dummy.rotation.set(sim.spin[i] + t * 3, sim.spin[i] * 2, t * 2);
      dummy.scale.setScalar(sim.size[i]);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <group ref={body} position={GRINDER.position}>
        <primitive object={model} scale={GRINDER.scale} />
      </group>
      <instancedMesh ref={powder} args={[undefined, undefined, N]} frustumCulled={false} visible={false} castShadow>
        <tetrahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#3a2114" roughness={0.9} />
      </instancedMesh>
      <mesh ref={mound} position={[cx, cupBottom, GRINDER.catchCup.center[2]]} visible={false} receiveShadow>
        <coneGeometry args={[GRINDER.catchCup.radius * 0.92, 0.3, 40, 1]} />
        <meshStandardMaterial map={tex} color="#b98b6a" roughness={0.95} />
      </mesh>
      {/* lembrete visual do topo do copinho (não renderiza nada) */}
      <group position={[cx, cupTop, cz]} />
    </group>
  );
}
