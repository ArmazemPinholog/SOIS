"use client";

import { Suspense, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { sampleSymbol, VIEWBOX } from "@/lib/soisSymbol";
import { seeded } from "@/components/three/assets";
import { MODEL_URLS, toFloatGeometry } from "@/components/story/models";
import { BEAN_BURST } from "./chapters";

/* Abertura: grãos de café reais (graodecafe.glb, instanciado) chegam de todos os lados e formam o
   símbolo oficial da Sóis. Ao rolar, explodem em direção à tela (crescem, giram e saem pelas bordas)
   enquanto o café sobe e cobre a abertura.
   Câmera ortográfica em pixels: 1 unidade = 1 px da tela, para casar com o layout em CSS. */

export type FilmProgress = RefObject<{ target: number; value: number }>;


type Props = {
  progress: FilmProgress;
  ready: boolean;
  slot: RefObject<HTMLDivElement | null>;
  onReady?: () => void;
};

const BEAN_SVG_LEN = 15.5; // comprimento do grão em unidades do SVG do símbolo

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
  burstDelay: number;
  burst: THREE.Vector2; // direção da explosão
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

const TILT = new THREE.Quaternion();
const TV = new THREE.Vector3();
const IDQ = new THREE.Quaternion();

function Beans({ progress, ready, slot, onReady }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const sweep = useRef<THREE.PointLight>(null);
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0, px: -9999, py: -9999, lens: 0 });
  const spinAcc = useRef<Float32Array | null>(null);
  const size = useThree((s) => s.size);
  const start = useRef(-1);
  const rects = useRef({ slot: new DOMRect() });
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
      // explode para fora a partir do centro do símbolo, com um pouco de acaso
      const dx = pt.x / VIEWBOX.w - 0.5 + (r() - 0.5) * 0.25;
      const dy = pt.y / VIEWBOX.h - 0.5 + (r() - 0.5) * 0.25;
      const dl = Math.hypot(dx, dy) || 1;
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
        // os de fora saem primeiro, o centro por último
        burstDelay: clamp01(0.55 - dl * 0.7 + r() * 0.35),
        burst: new THREE.Vector2(dx / dl, dy / dl),
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

  // mede o lugar do símbolo (layout em CSS)
  useLayoutEffect(() => {
    const measure = () => {
      if (slot.current) rects.current.slot = slot.current.getBoundingClientRect();
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [slot, size.width, size.height]);

  // micromovimento: o símbolo inclina devagar seguindo o mouse (no celular, um balanço automático)
  useLayoutEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer.current.px = e.clientX;
      pointer.current.py = e.clientY;
      pointer.current.x = e.clientX / window.innerWidth - 0.5;
      pointer.current.y = e.clientY / window.innerHeight - 0.5;
    };
    const onLeave = () => {
      pointer.current.px = pointer.current.py = -9999;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  useFrame((state, delta) => {
    const m = mesh.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    const pt = pointer.current;
    const touch = size.width < 821;
    const tx = touch ? Math.sin(t * 0.45) * 0.22 : pt.x;
    const ty = touch ? Math.cos(t * 0.33) * 0.16 : pt.y;
    const kf = 1 - Math.exp(-2.4 * Math.min(delta, 0.1));
    pt.sx += (tx - pt.sx) * kf;
    pt.sy += (ty - pt.sy) * kf;
    E.set(pt.sy * 0.42, pt.sx * 0.55, 0);
    TILT.setFromEuler(E);
    // um brilho de luz atravessa os grãos a cada poucos segundos
    if (sweep.current) {
      const cyc = (t % 6.5) / 6.5;
      sweep.current.position.set((cyc * 1.8 - 0.9) * size.width, size.height * 0.25, 420);
      sweep.current.intensity = Math.sin(Math.min(1, cyc * 1.25) * Math.PI) * 2.2e5;
    }
    if (ready && start.current < 0) start.current = t;
    const since = start.current < 0 ? 0 : t - start.current;
    const p = progress.current.value;
    const W = size.width;
    const H = size.height;
    const { slot: sr } = rects.current;
    const beanPx = (BEAN_SVG_LEN / VIEWBOX.h) * sr.height;
    // px da tela → mundo (origem no centro, y para cima)
    const wx = (x: number) => x - W / 2;
    const wy = (y: number) => H / 2 - y;
    const burstK = clamp01((p - BEAN_BURST[0]) / (BEAN_BURST[1] - BEAN_BURST[0]));
    const reach = Math.hypot(W, H) * 0.75;
    m.visible = burstK < 1;
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

      // formado: cada grão "respira" (leve giro e pulsação próprios) e o símbolo inclina como peça só
      if (form > 0) {
        const life = form * form;
        E.set(Math.sin(t * 0.9 + b.phase) * 0.16 * life, Math.cos(t * 0.7 + b.phase * 1.7) * 0.2 * life, Math.sin(t * 0.6 + b.phase * 0.5) * 0.06 * life);
        Q.multiply(Qs.setFromEuler(E));
        scale *= 1 + Math.sin(t * 1.4 + b.phase) * 0.025 * life;
        const cx = sr.left + sr.width / 2;
        const cy = sr.top + sr.height / 2;
        TV.set(x - cx, cy - y, z).applyQuaternion(Qs.copy(TILT).slerp(IDQ, 1 - life));
        x = cx + TV.x;
        y = cy - TV.y;
        z = TV.z;
        Q.premultiply(Qs.copy(TILT).slerp(IDQ, 1 - life));

        // lupa: o grão sob o mouse cresce, vem para a frente e gira; os vizinhos abrem espaço
        if (!spinAcc.current || spinAcc.current.length !== beans.length) spinAcc.current = new Float32Array(beans.length);
        const lr = Math.max(60, sr.height * 0.16);
        const ddx = x - pt.px;
        const ddy = y - pt.py;
        const lens = Math.exp(-(ddx * ddx + ddy * ddy) / (lr * lr)) * life;
        if (lens > 0.002) {
          const dl = Math.hypot(ddx, ddy) || 1;
          x += (ddx / dl) * lens * lr * 0.18;
          y += (ddy / dl) * lens * lr * 0.18;
          z += 260 * lens;
          scale *= 1 + 0.85 * lens;
          spinAcc.current[i] += Math.min(delta, 0.05) * 5 * lens;
        }
        // longe do mouse o grão volta devagar para o lugar no símbolo
        spinAcc.current[i] *= 1 - Math.min(1, Math.min(delta, 0.05) * 1.1 * (1 - lens));
        const sp = spinAcc.current[i];
        if (sp) {
          E.set(sp * 0.6, sp, 0);
          Q.multiply(Qs.setFromEuler(E));
        }
      }

      // 2) explosão em direção à tela (pelo scroll): saem do símbolo acelerando, crescendo e girando
      const u = clamp01((burstK - b.burstDelay * 0.4) / 0.6);
      if (u > 0) {
        const e = u * u;
        x += b.burst.x * reach * e;
        y += b.burst.y * reach * e - 40 * Math.sin(u * Math.PI);
        z += 600 * u;
        E.set(u * b.spin.x * 7, u * b.spin.y * 7, u * b.spin.z * 7);
        Q.multiply(Qs.setFromEuler(E));
        scale *= 1 + 4.5 * e;
      }
      P.set(wx(x), wy(y), z);
      S.setScalar(Math.max(scale, 0.0001));
      M.compose(P, Q, S);
      m.setMatrixAt(i, M);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <pointLight ref={sweep} color="#fff0d6" distance={0} decay={2} intensity={0} />
      <instancedMesh ref={mesh} args={[geometry, material, beans.length]} frustumCulled={false} />
    </>
  );
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
