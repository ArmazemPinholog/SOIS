"use client";

import { Suspense, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode, type DepthOfFieldEffect } from "postprocessing";
import * as THREE from "three";
import { createPalmWallTexture, seeded } from "@/components/three/assets";
import StoryBeans from "./StoryBeans";
import Grinder from "./Grinder";
import Station, { useStationRefs } from "./Station";
import SoisCup from "./SoisCup";
import CupCoffee from "./CupCoffee";
import Ice from "./Ice";
import { CUP, T, cameraAt } from "./layout";
import { range } from "@/components/three/math";

export type StoryProgress = RefObject<{ target: number; value: number; velocity: number }>;

/* ---------- cenário: bancada de travertino e parede creme com sombra de palmeiras ---------- */
function travertineTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e8d6b6";
  g.fillRect(0, 0, 1024, 1024);
  const r = seeded(9);
  // veios horizontais suaves e poros, como travertino
  for (let i = 0; i < 70; i++) {
    const y = r() * 1024;
    g.strokeStyle = `rgba(${150 + r() * 40},${120 + r() * 30},${85 + r() * 25},${0.05 + r() * 0.08})`;
    g.lineWidth = 1 + r() * 6;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6 + (r() - 0.5) * 4);
    g.stroke();
  }
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(120,90,60,${r() * 0.12})`;
    g.beginPath();
    g.ellipse(r() * 1024, r() * 1024, 1 + r() * 4, 0.5 + r() * 1.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 1.4);
  return t;
}

function Backdrop() {
  const wall = useMemo(() => createPalmWallTexture(), []);
  const stone = useMemo(() => travertineTexture(), []);
  useFrame((s) => {
    wall.offset.x = Math.sin(s.clock.elapsedTime * 0.22) * 0.006;
    wall.offset.y = Math.cos(s.clock.elapsedTime * 0.18) * 0.004;
  });
  return (
    <group>
      <mesh position={[-3, -0.3, 0.5]} receiveShadow>
        <boxGeometry args={[34, 0.6, 9]} />
        <meshStandardMaterial map={stone} roughness={0.55} />
      </mesh>
      <mesh position={[-3, 7, -5]} receiveShadow>
        <planeGeometry args={[60, 32]} />
        <meshStandardMaterial map={wall} roughness={1} />
      </mesh>
    </group>
  );
}

/* ---------- câmera guiada pelo scroll + leve paralaxe do mouse ---------- */
function Rig({ progress, look }: { progress: StoryProgress; look: THREE.Vector3 }) {
  const pos = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const size = useThree((s) => s.size);
  const portrait = size.width / size.height < 0.85;
  useFrame((state, dt) => {
    const pr = progress.current;
    const prev = pr.value;
    pr.value = THREE.MathUtils.damp(pr.value, pr.target, 3.4, dt);
    pr.velocity = THREE.MathUtils.damp(pr.velocity, (pr.value - prev) / Math.max(dt, 1e-3), 6, dt);
    cameraAt(pr.value, portrait, pos, target);
    const cam = state.camera;
    // amortecimento por tempo (independe do FPS do aparelho)
    const d = THREE.MathUtils.damp;
    cam.position.x = d(cam.position.x, pos.x + state.pointer.x * 0.3, 4.5, dt);
    cam.position.y = d(cam.position.y, pos.y + state.pointer.y * 0.18, 4.5, dt);
    cam.position.z = d(cam.position.z, pos.z, 4.5, dt);
    look.set(d(look.x, target.x, 6, dt), d(look.y, target.y, 6, dt), d(look.z, target.z, 6, dt));
    cam.lookAt(look);
  });
  return null;
}

/* ---------- copo: gira devagar no final ---------- */
function CupGroup({ progress, children }: { progress: StoryProgress; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const p = progress.current.value;
    const k = range(p, T.turn[0], T.turn[1]);
    if (g.current) g.current.rotation.y = THREE.MathUtils.damp(g.current.rotation.y, -0.5 + k * 1.6, 4, dt);
  });
  return (
    <group ref={g} position={[CUP.position[0], 0, CUP.position[2]]}>
      <group position={[-CUP.position[0], 0, -CUP.position[2]]}>{children}</group>
    </group>
  );
}

function CupOnStand() {
  return (
    <group position={CUP.position}>
      <SoisCup />
    </group>
  );
}

/* ---------- pós-produção: grão de filme, vinheta, brilho e aberração ligada à velocidade do scroll ---------- */
function Effects({ progress, rich, focus }: { progress: StoryProgress; rich: boolean; focus: THREE.Vector3 }) {
  const offset = useMemo(() => new THREE.Vector2(0, 0), []);
  const dof = useRef<DepthOfFieldEffect>(null);
  const aim = useMemo(() => new THREE.Vector3(), []);
  const cupCenter = useMemo(() => new THREE.Vector3(CUP.position[0], CUP.position[1] + 0.55, CUP.position[2]), []);
  useFrame(() => {
    const v = Math.min(Math.abs(progress.current.velocity) * 0.05, 0.0025);
    offset.set(v, v * 0.6);
    const d = dof.current;
    if (d) {
      // foco segue o assunto; nos planos fechados do copo, trava no copo e o desfoque cresce
      const p = progress.current.value;
      const k = range(p, 0.72, 0.78);
      aim.copy(focus).lerp(cupCenter, k);
      d.target = aim;
      d.bokehScale = k * 3.2;
    }
  });
  if (!rich) {
    return (
      <EffectComposer multisampling={0}>
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.24} />
        <Vignette offset={0.3} darkness={0.5} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={4}>
      <DepthOfField ref={dof} focusRange={1.6} bokehScale={0} height={540} />
      <Bloom intensity={0.35} luminanceThreshold={0.86} luminanceSmoothing={0.2} mipmapBlur />
      <ChromaticAberration offset={offset} radialModulation modulationOffset={0.35} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.26} />
      <Vignette offset={0.28} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
}

function World({ progress, rich }: { progress: StoryProgress; rich: boolean }) {
  const refs = useStationRefs();
  const cupLevel = useMemo(() => ({ current: 0 }), []);
  const cupImpact = useMemo(() => ({ current: 0 }), []);
  const look = useMemo(() => new THREE.Vector3(-2.75, 11.5, -0.4), []);
  return (
    <>
      <color attach="background" args={["#f3e3c4"]} />
      <fog attach="fog" args={["#f3e3c4", 22, 42]} />
      <hemisphereLight args={["#fff1d8", "#b98a5c", 0.75]} />
      <directionalLight
        position={[5, 13, 9]}
        intensity={2.6}
        color="#ffd9a6"
        castShadow
        shadow-mapSize={rich ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={15}
        shadow-camera-bottom={-2}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <directionalLight position={[-8, 4, 6]} intensity={0.55} color="#ffc68a" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3.2} color="#ffe2b8" position={[4, 6, 6]} scale={[9, 4, 1]} />
        <Lightformer form="rect" intensity={1.3} color="#f8eacf" position={[-7, 2, 4]} scale={[6, 7, 1]} />
        <Lightformer form="ring" intensity={2.2} color="#f6d44d" position={[0, 7, -4]} scale={3} />
        <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 3, 9]} scale={[12, 2, 1]} />
        <Lightformer form="rect" intensity={2.4} color="#fff4e2" position={[-3, 4, 7]} scale={[2.5, 12, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#6a1e1e" position={[0, -5, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
      </Environment>

      <Backdrop />
      <StoryBeans progress={progress} />
      <Grinder progress={progress} />
      <Station progress={progress} refs={refs} cupLevel={cupLevel} cupImpact={cupImpact} />
      <CupGroup progress={progress}>
        <CupOnStand />
        <CupCoffee levelRef={cupLevel} impactRef={cupImpact} />
        <Ice progress={progress} />
      </CupGroup>
      <Rig progress={progress} look={look} />
      <Effects progress={progress} rich={rich} focus={look} />
    </>
  );
}

type Props = { progress: StoryProgress; active: boolean; rich: boolean };

export default function StoryScene({ progress, active, rich }: Props) {
  return (
    <Canvas
      className="story__canvas"
      shadows={{ type: THREE.PCFShadowMap }}
      frameloop={active ? "always" : "never"}
      dpr={rich ? [1, 1.75] : [1, 1.3]}
      camera={{ fov: 30, position: [1.0, 12.4, 16.2], near: 0.1, far: 80 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>
        <World progress={progress} rich={rich} />
      </Suspense>
    </Canvas>
  );
}
