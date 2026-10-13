"use client";

import { Suspense, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { sampleSymbol, VIEWBOX } from "@/lib/soisSymbol";
import { seeded } from "@/components/three/assets";
import { MODEL_URLS, toFloatGeometry } from "@/components/story/models";
import { BEAN_FALL } from "./chapters";

/* Abertura: grãos de café reais (graodecafe.glb, instanciado) chegam de todos os lados e formam o
   símbolo oficial da Sóis. Ao rolar, despencam no funil do moedor do primeiro vídeo.
   Câmera ortográfica em pixels: 1 unidade = 1 px da tela, para casar com o layout em CSS. */

export type FilmProgress = RefObject<{ target: number; value: number }>;


type Props = {
  progress: FilmProgress;
  ready: boolean;
  slot: RefObject<HTMLDivElement | null>;
  frame: RefObject<HTMLDivElement | null>;
  onReady?: () => void;
};

const BEAN_SVG_LEN = 15.5; // comprimento do grão em unidades do SVG do símbolo
/** posição do funil dentro do quadro do vídeo 1 (fração da largura/altura) */
const HOPPER = { x: 0.6, y: 0.5, r: 0.11 };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function beanGeometry(src: THREE.BufferGeometry) {
  const g = toFloatGeometry(src);
  // comprimento do grão em x, sulco virado para -z
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0));
  g.applyMatrix4(m);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const c = bb.getCenter(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z);
  const len = bb.max.x - bb.min.x;
  g.scale(1 / len, 1 / len, 1 / len); // comprimento 1: a escala por instância dá o tamanho em px
  g.computeVertexNormals();
  return g;
}

type Bean = {
  sx: number; // posição no símbolo (fração do SVG)
  sy: number;
  quat: THREE.Quaternion;
  scatter: THREE.Vector3; // fração da tela + profundidade
  spin: THREE.Vector3;
  phase: number;
  delay: number;
  fallDelay: number;
  hopper: THREE.Vector2; // ponto de chegada no funil (fração do raio)
  dark: boolean;
};

const P = new THREE.Vector3();
const Q = new THREE.Quaternion();
const Qs = new THREE.Quaternion();
const E = new THREE.Euler();
const S = new THREE.Vector3();
const M = new THREE.Matrix4();
const zAxis = new THREE.Vector3(0, 0, 1);
const xAxis = new THREE.Vector3(1, 0, 0);

function Beans({ progress, ready, slot, frame, onReady }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const size = useThree((s) => s.size);
  const start = useRef(-1);
  const rects = useRef({ slot: new DOMRect(), frame: new DOMRect() });
  const { scene } = useGLTF(MODEL_URLS.bean, false, true);

  const { geometry, material } = useMemo(() => {
    let src: THREE.Mesh | null = null;
    scene.traverse((o) => {
      if (!src && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh;
    });
    const m0 = src! as THREE.Mesh;
    const mat = (m0.material as THREE.MeshStandardMaterial).clone();
    mat.map = null; // a textura do GLB puxa para o vermelho; cor de torra vem por instância
    mat.color.set("#ffffff");
    mat.roughness = 0.38;
    mat.envMapIntensity = 1.15;
    return { geometry: beanGeometry(m0.geometry), material: mat };
  }, [scene]);

  const beans = useMemo<Bean[]>(() => {
    const r = seeded(21);
    return sampleSymbol(10.2).map((pt) => {
      const roll = r() < 0.55 ? Math.PI + (r() - 0.5) * 0.6 : (r() - 0.5) * 0.6;
      const a = r() * Math.PI * 2;
      const rr = Math.sqrt(r());
      return {
        sx: pt.x / VIEWBOX.w,
        sy: pt.y / VIEWBOX.h,
        quat: new THREE.Quaternion()
          .setFromAxisAngle(zAxis, -pt.angle + (r() - 0.5) * 0.25)
          .multiply(new THREE.Quaternion().setFromAxisAngle(xAxis, roll)),
        scatter: new THREE.Vector3(r() * 1.3 - 0.15, r() * 1.3 - 0.15, (r() - 0.5) * 400),
        spin: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.6),
        phase: r() * Math.PI * 2,
        delay: r(),
        // caem primeiro os grãos de baixo, como um monte que desaba
        fallDelay: clamp01(1 - pt.y / VIEWBOX.h + (r() - 0.5) * 0.3),
        hopper: new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr * 0.35),
        dark: pt.half === "bottom",
      };
    });
  }, []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const light = new THREE.Color("#66412b");
    const dark = new THREE.Color("#3f261a");
    const r = seeded(4);
    beans.forEach((b, i) => m.setColorAt(i, (b.dark ? dark : light).clone().offsetHSL(0, 0, (r() - 0.5) * 0.06)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    onReady?.();
  }, [beans, onReady]);

  // mede o lugar do símbolo e o quadro do vídeo (layout em CSS)
  useLayoutEffect(() => {
    const measure = () => {
      if (slot.current) rects.current.slot = slot.current.getBoundingClientRect();
      if (frame.current) {
        // o quadro tem escala animada pelo scroll; mede sem a transformação
        const f = frame.current;
        const prev = f.style.transform;
        f.style.transform = "none";
        rects.current.frame = f.getBoundingClientRect();
        f.style.transform = prev;
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [slot, frame, size.width, size.height]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    if (ready && start.current < 0) start.current = t;
    const since = start.current < 0 ? 0 : t - start.current;
    const p = progress.current.value;
    const W = size.width;
    const H = size.height;
    const { slot: sr, frame: fr } = rects.current;
    const beanPx = (BEAN_SVG_LEN / VIEWBOX.h) * sr.height;
    // px da tela → mundo (origem no centro, y para cima)
    const wx = (x: number) => x - W / 2;
    const wy = (y: number) => H / 2 - y;
    const hx = fr.left + fr.width * HOPPER.x;
    const hy = fr.top + fr.height * HOPPER.y;
    const hr = fr.width * HOPPER.r;
    const fallK = clamp01((p - BEAN_FALL[0]) / (BEAN_FALL[1] - BEAN_FALL[0]));
    m.visible = fallK < 1;
    if (!m.visible) return;

    for (let i = 0; i < beans.length; i++) {
      const b = beans[i];
      // 1) formação (no tempo, depois do carregamento)
      const form = easeInOut(clamp01((since - 0.15 - b.delay * 0.9) / 1.6));
      const fx = b.scatter.x * W + Math.sin(t * 0.5 + b.phase) * 18;
      const fy = b.scatter.y * H + Math.cos(t * 0.42 + b.phase * 1.3) * 18;
      const tx = sr.left + b.sx * sr.width;
      const ty = sr.top + b.sy * sr.height + Math.sin(t * 1.3 + b.phase) * 1.2;
      let x = fx + (tx - fx) * form;
      let y = fy + (ty - fy) * form;
      let z = b.scatter.z * (1 - form);
      E.set(b.phase + t * b.spin.x, b.phase * 0.7 + t * b.spin.y, b.phase * 1.3 + t * b.spin.z);
      Qs.setFromEuler(E);
      Q.copy(Qs).slerp(b.quat, form);
      let scale = beanPx * (0.75 + 0.25 * form);

      // 2) queda no funil (pelo scroll): gravidade no y, deriva suave no x
      const u = clamp01((fallK - b.fallDelay * 0.35) / 0.65);
      if (u > 0) {
        const gx = hx + b.hopper.x * hr;
        const gy = hy + b.hopper.y * hr;
        const ex = u * u * (3 - 2 * u);
        x = x + (gx - x) * ex;
        y = y + (gy - y) * (u * u);
        z = z + 120 * Math.sin(u * Math.PI);
        E.set(u * b.spin.x * 9, u * b.spin.y * 9, u * b.spin.z * 9);
        Q.multiply(Qs.setFromEuler(E));
        // os grãos do vídeo são menores: encolhem ao chegar e somem dentro do funil
        scale *= 1 - 0.45 * u;
        if (u > 0.9) scale *= 1 - (u - 0.9) / 0.1;
      }
      P.set(wx(x), wy(y), z);
      S.setScalar(Math.max(scale, 0.0001));
      M.compose(P, Q, S);
      m.setMatrixAt(i, M);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, beans.length]} frustumCulled={false} />;
}

export default function BeanLogo(props: Props & { active: boolean }) {
  const { active, ...rest } = props;
  return (
    <Canvas
      className="film__beans"
      orthographic
      frameloop={active ? "always" : "never"}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 1000], near: 1, far: 3000, zoom: 1 }}
      style={{ pointerEvents: "none" }}
    >
      <hemisphereLight args={["#fff1d8", "#8a5a3c", 0.9]} />
      <directionalLight position={[300, 600, 800]} intensity={2.8} color="#ffe2bd" />
      <directionalLight position={[-600, -100, 400]} intensity={0.6} color="#ffc68a" />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={3} color="#ffe2b8" position={[4, 6, 6]} scale={[9, 4, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#f8eacf" position={[-7, 2, 4]} scale={[6, 7, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 3, 9]} scale={[12, 2, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <Beans {...rest} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URLS.bean, false, true);
