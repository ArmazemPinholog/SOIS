"use client";

import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { seeded } from "@/components/three/assets";
import { toFloatGeometry } from "@/components/story/models";
import type { FilmProgress } from "./BeanLogo";

/* Grãos soltos em 3D por cima das primeiras seções, em camadas de profundidade:
   os da frente são maiores e correm mais rápido com o scroll (parallax), os de trás quase param.
   Câmera ortográfica em pixels, como a abertura. */

type Item = {
  x: number; // fração da tela
  y: number;
  size: number; // fração da altura da tela
  speed: number; // parallax (fração da altura por unidade de progresso)
  spin: THREE.Vector3;
  phase: number;
  win: [number, number]; // trecho do scroll em que aparece
};

const P = new THREE.Vector3();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
const M = new THREE.Matrix4();
const E = new THREE.Euler();
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function normalized(src: THREE.BufferGeometry) {
  const g = toFloatGeometry(src);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const c = bb.getCenter(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z);
  const s = bb.getSize(new THREE.Vector3());
  const len = Math.max(s.x, s.y, s.z);
  g.scale(1 / len, 1 / len, 1 / len);
  g.computeVertexNormals();
  return g;
}

function firstMesh(scene: THREE.Object3D) {
  let m: THREE.Mesh | null = null;
  scene.traverse((o) => {
    if (!m && (o as THREE.Mesh).isMesh) m = o as THREE.Mesh;
  });
  return m! as THREE.Mesh;
}

function make(seed: number, n: number, win: [number, number], area: { x: [number, number]; y: [number, number] }, size: [number, number]) {
  const r = seeded(seed);
  return Array.from({ length: n }, (_, i): Item => {
    const depth = i / Math.max(1, n - 1); // 0 = fundo, 1 = frente
    return {
      x: area.x[0] + r() * (area.x[1] - area.x[0]),
      y: area.y[0] + r() * (area.y[1] - area.y[0]),
      size: size[0] + (size[1] - size[0]) * depth * depth,
      speed: 1.2 + depth * 5.5,
      spin: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9),
      phase: r() * Math.PI * 2,
      win,
    };
  });
}

function Layer({ url, items, material, progress, tint }: { url: string; items: Item[]; material: THREE.Material; progress: FilmProgress; tint?: (i: number) => THREE.Color }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const size = useThree((s) => s.size);
  const { scene } = useGLTF(url, false, true);
  const geometry = useMemo(() => normalized(firstMesh(scene).geometry), [scene]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m || !tint) return;
    items.forEach((_, i) => m.setColorAt(i, tint(i)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items, tint]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    const p = progress.current.value;
    const W = size.width;
    const H = size.height;
    const mobile = W < 821;
    let any = false;
    items.forEach((it, i) => {
      const [a, b] = it.win;
      const k = smooth(a, a + 0.02, p) * (1 - smooth(b - 0.02, b, p));
      const mid = (a + b) / 2;
      const s = it.size * H * (mobile ? 0.75 : 1) * (0.6 + 0.4 * k);
      const x = it.x * W + Math.sin(t * 0.35 + it.phase) * 10;
      const y = it.y * H - (p - mid) * it.speed * H + Math.cos(t * 0.5 + it.phase) * 8;
      E.set(it.phase + t * it.spin.x + p * 9 * it.spin.y, it.phase * 0.6 + t * it.spin.y, it.phase + t * it.spin.z + p * 6);
      Q.setFromEuler(E);
      P.set(x - W / 2, H / 2 - y, it.size * 1000);
      S.setScalar(k > 0.001 ? s : 0.0001);
      if (k > 0.001) any = true;
      M.compose(P, Q, S);
      m.setMatrixAt(i, M);
    });
    m.visible = any;
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, items.length]} frustumCulled={false} />;
}

function Scene({ progress, beanWin }: { progress: FilmProgress; beanWin: [number, number] }) {
  const beanMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4, envMapIntensity: 1.1 }), []);
  // grãos: espalhados à esquerda e no alto (o lado do texto fica livre embaixo)
  const beans = useMemo(() => make(5, 11, beanWin, { x: [0.04, 0.96], y: [0.08, 0.92] }, [0.022, 0.09]), [beanWin]);
  const beanTint = useMemo(() => {
    const r = seeded(3);
    const cols = beans.map(() => new THREE.Color(r() < 0.5 ? "#5e3b27" : "#3f261a").offsetHSL(0, 0, (r() - 0.5) * 0.06));
    return (i: number) => cols[i];
  }, [beans]);

  return (
    <>
      <Layer url="/models/graodecafe.glb" items={beans} material={beanMat} progress={progress} tint={beanTint} />
    </>
  );
}

export default function Floaters({ progress, active, beanWin }: { progress: FilmProgress; active: boolean; beanWin: [number, number] }) {
  return (
    <Canvas
      className="film__floaters"
      orthographic
      frameloop={active ? "always" : "never"}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 1000], near: 1, far: 3000, zoom: 1 }}
      style={{ pointerEvents: "none" }}
    >
      <hemisphereLight args={["#fff1d8", "#8a5a3c", 0.9]} />
      <directionalLight position={[300, 600, 800]} intensity={2.6} color="#ffe2bd" />
      <directionalLight position={[-600, -100, 400]} intensity={0.6} color="#ffc68a" />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={3} color="#ffe2b8" position={[4, 6, 6]} scale={[9, 4, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#f8eacf" position={[-7, 2, 4]} scale={[6, 7, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 3, 9]} scale={[12, 2, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <Scene progress={progress} beanWin={beanWin} />
      </Suspense>
    </Canvas>
  );
}
