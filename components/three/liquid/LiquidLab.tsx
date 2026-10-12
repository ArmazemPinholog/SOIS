"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Stream, { type StreamKind } from "./Stream";
import Drops from "./Drops";
import GlassCup, { GLASS } from "./GlassCup";
import GlassCoil, { COIL } from "./GlassCoil";
import { easeInOutCubic, easeOutCubic, range } from "../math";

/* Laboratório isolado do líquido (rota /teste-liquido). Nada aqui é usado pelo site atual. */

export type SceneId = "cafe" | "serpentina" | "agua";

const SCENES: { id: SceneId; label: string; hint: string }[] = [
  { id: "cafe", label: "Fio de café", hint: "Fio torcido, gotas satélite, coroa de respingo e ondas no copo." },
  { id: "serpentina", label: "Serpentina", hint: "Café percorrendo o tubo de vidro e caindo no copo." },
  { id: "agua", label: "Água da chaleira", hint: "Fio fino e transparente do bico de ganso." },
];

const LOOP = 14;

/** Relógio da cena: reinicia com o botão e aceita deslocamento (?t=) para capturas. */
function useSceneClock(resetKey: number, offset: number, freeze: boolean) {
  const t = useRef(0);
  const t0 = useRef<number | null>(null);
  const lastKey = useRef(resetKey);
  useFrame((s) => {
    if (t0.current === null || lastKey.current !== resetKey) {
      t0.current = s.clock.elapsedTime;
      lastKey.current = resetKey;
    }
    const raw = freeze ? offset : s.clock.elapsedTime - t0.current + offset;
    t.current = ((raw % LOOP) + LOOP) % LOOP;
  });
  return t;
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={5} color="#fff2dc" position={[3, 4, 4]} scale={[7, 3.5, 1]} />
        <Lightformer form="rect" intensity={3} color="#ffd9a8" position={[-4, 2, 3]} scale={[1.6, 6, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 6, -2]} scale={[8, 1.2, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#c98a52" position={[0, -2, 4]} scale={[8, 2, 1]} />
      </Environment>
    </>
  );
}

function BrassNozzle({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.07, 0.045, 0.34, 32]} />
        <meshStandardMaterial color="#b8893a" metalness={1} roughness={0.25} envMapIntensity={1.5} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.4, 32]} />
        <meshStandardMaterial color="#b8893a" metalness={1} roughness={0.3} envMapIntensity={1.5} />
      </mesh>
    </group>
  );
}

function GooseneckSpout({ tipY }: { tipY: number }) {
  const geo = useMemo(() => {
    const c = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-1.5, tipY - 0.55, 0),
        new THREE.Vector3(-1.1, tipY - 0.15, 0),
        new THREE.Vector3(-0.55, tipY + 0.28, 0),
        new THREE.Vector3(-0.18, tipY + 0.18, 0),
        new THREE.Vector3(0, tipY + 0.02, 0),
      ],
      false,
      "catmullrom",
      0.5,
    );
    return new THREE.TubeGeometry(c, 80, 0.05, 20, false);
  }, [tipY]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#b8893a" metalness={1} roughness={0.25} envMapIntensity={1.5} />
    </mesh>
  );
}

type SceneProps = { resetKey: number; offset: number; flow: number; freeze: boolean };

/* 1) fio de café caindo no copo */
function CafeScene({ resetKey, offset, flow, freeze }: SceneProps) {
  const TOP = 3.55;
  const BOTTOM = 0.1;
  const LEN = TOP - BOTTOM;
  const TWIST = 0.05;
  const clock = useSceneClock(resetKey, offset, freeze);
  const head = useRef(0);
  const flowRef = useRef(0);
  const level = useRef(0);
  const impact = useRef(0);
  const touch = useRef(0);
  const surfaceY = useRef(0.3);

  useFrame(() => {
    const t = clock.current;
    const grow = easeInOutCubic(range(t, 0.2, 1.4));
    head.current = grow;
    flowRef.current = easeOutCubic(range(t, 0.2, 0.8)) * (t < 11.5 ? 1 : 1 - range(t, 11.5, 12.5));
    level.current = range(t, 1.3, 10) * 0.92 + (t > 1.3 ? 0.08 : 0);
    const surf = 0.05 + (0.06 + level.current * (GLASS.height - 0.1) * 0.82);
    surfaceY.current = surf;
    const reach = (TOP - surf) / LEN;
    touch.current = head.current >= reach ? 1 : 0;
    impact.current = THREE.MathUtils.lerp(impact.current, touch.current * flowRef.current, 0.08);
    if (head.current >= reach) head.current = Math.max(head.current, 1);
  });

  return (
    <group>
      <BrassNozzle y={TOP} />
      <Stream kind="coffee" length={LEN} radius={0.062 * flow} headRef={head} position={[0, TOP, 0]} twist={TWIST} />
      <Drops
        kind="coffee"
        top={TOP}
        length={LEN}
        twist={TWIST}
        headRef={head}
        flowRef={flowRef}
        surfaceYRef={surfaceY}
        touchRef={touch}
      />
      <GlassCup kind="coffee" levelRef={level} impactRef={impact} />
    </group>
  );
}

/* 2) serpentina de vidro */
function CoilScene({ resetKey, offset, flow, freeze }: SceneProps) {
  const TOP = COIL.exitY;
  const BOTTOM = 0.1;
  const LEN = TOP - BOTTOM;
  const TWIST = 0.035;
  const clock = useSceneClock(resetKey, offset, freeze);
  const fill = useRef(0);
  const head = useRef(0);
  const flowRef = useRef(0);
  const level = useRef(0);
  const impact = useRef(0);
  const touch = useRef(0);
  const surfaceY = useRef(0.3);

  useFrame(() => {
    const t = clock.current;
    fill.current = easeInOutCubic(range(t, 0.4, 6.4));
    const pour = range(t, 6.4, 7.2);
    head.current = easeInOutCubic(pour);
    flowRef.current = easeOutCubic(range(t, 6.4, 7)) * (t < 12.2 ? 1 : 1 - range(t, 12.2, 13));
    level.current = range(t, 7.1, 13) * 0.92 + (t > 7.1 ? 0.08 : 0);
    const surf = 0.05 + (0.06 + level.current * (GLASS.height - 0.1) * 0.82);
    surfaceY.current = surf;
    const reach = (TOP - surf) / LEN;
    touch.current = head.current >= reach ? 1 : 0;
    impact.current = THREE.MathUtils.lerp(impact.current, touch.current * flowRef.current, 0.08);
  });

  return (
    <group>
      <GlassCoil fillRef={fill} />
      <Stream kind="coffee" length={LEN} radius={0.036 * flow} headRef={head} position={[0, TOP, 0]} twist={TWIST} amp={0.12} />
      <Drops
        kind="coffee"
        top={TOP}
        length={LEN}
        twist={TWIST}
        headRef={head}
        flowRef={flowRef}
        surfaceYRef={surfaceY}
        touchRef={touch}
        max={120}
      />
      <GlassCup kind="coffee" levelRef={level} impactRef={impact} />
    </group>
  );
}

/* 3) água do bico de ganso */
function WaterScene({ resetKey, offset, flow, freeze }: SceneProps) {
  const TOP = 3.3;
  const BOTTOM = 0.1;
  const LEN = TOP - BOTTOM;
  const TWIST = 0.012;
  const clock = useSceneClock(resetKey, offset, freeze);
  const head = useRef(0);
  const flowRef = useRef(0);
  const level = useRef(0);
  const impact = useRef(0);
  const touch = useRef(0);
  const surfaceY = useRef(0.3);

  useFrame(() => {
    const t = clock.current;
    head.current = easeInOutCubic(range(t, 0.2, 1.3));
    flowRef.current = easeOutCubic(range(t, 0.2, 0.8)) * (t < 11.5 ? 1 : 1 - range(t, 11.5, 12.5));
    level.current = range(t, 1.2, 10) * 0.92 + (t > 1.2 ? 0.08 : 0);
    const surf = 0.05 + (0.06 + level.current * (GLASS.height - 0.1) * 0.82);
    surfaceY.current = surf;
    const reach = (TOP - surf) / LEN;
    touch.current = head.current >= reach ? 1 : 0;
    impact.current = THREE.MathUtils.lerp(impact.current, touch.current * flowRef.current, 0.08);
  });

  return (
    <group>
      <GooseneckSpout tipY={TOP} />
      <Stream kind="water" length={LEN} radius={0.034 * flow} headRef={head} position={[0, TOP, 0]} twist={TWIST} amp={0.07} thin={0.3} />
      <Drops
        kind="water"
        top={TOP}
        length={LEN}
        twist={TWIST}
        headRef={head}
        flowRef={flowRef}
        surfaceYRef={surfaceY}
        touchRef={touch}
        max={140}
      />
      <GlassCup kind="water" levelRef={level} impactRef={impact} />
    </group>
  );
}

/** Mede FPS e chamadas de desenho e escreve direto no DOM (sem re-render do React). */
function Stats() {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ frames: 0, time: 0 });
  useEffect(() => {
    gl.info.autoReset = false; // soma todos os passes do quadro (inclui a sombra de contato)
  }, [gl]);
  useFrame((_, dt) => {
    const a = acc.current;
    a.frames += 1;
    a.time += dt;
    if (a.time >= 0.5) {
      const el = document.getElementById("liquid-stats");
      if (el) {
        el.textContent = `${Math.round(a.frames / a.time)} fps · ${Math.round(gl.info.render.calls / a.frames)} draw calls · ${Math.round(
          gl.info.render.triangles / a.frames / 1000,
        )}k tri`;
      }
      gl.info.reset();
      a.frames = 0;
      a.time = 0;
    }
  });
  return null;
}

const CAMERAS: Record<SceneId, { pos: [number, number, number]; target: [number, number, number] }> = {
  cafe: { pos: [0.9, 1.9, 8.2], target: [0, 2.0, 0] },
  serpentina: { pos: [0.8, 2.1, 8.6], target: [0, 2.05, 0] },
  agua: { pos: [0.9, 1.9, 8.2], target: [0, 2.0, 0] },
};

function Rig({ scene }: { scene: SceneId }) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / s.size.height);
  useEffect(() => {
    const c = CAMERAS[scene];
    // em retrato (celular) afasta a câmera para o copo e o fio caberem
    const portrait = aspect < 0.8;
    const k = portrait ? 1 + (0.8 - aspect) * 1.9 : 1;
    const dy = portrait ? -0.75 : 0; // sobe a cena na tela para o painel não cobrir o copo
    camera.position.set(c.pos[0] * k, c.pos[1] + dy, c.pos[2] * k);
    controls.current?.target.set(c.target[0], c.target[1] + dy, c.target[2]);
    controls.current?.update();
  }, [scene, camera, aspect]);
  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      minDistance={2.5}
      maxDistance={14}
      minPolarAngle={0.5}
      maxPolarAngle={1.75}
    />
  );
}

export default function LiquidLab() {
  const [scene, setScene] = useState<SceneId>("cafe");
  const [flow, setFlow] = useState(1);
  const [resetKey, setResetKey] = useState(0);
  const [offset, setOffset] = useState(0);
  const [freeze, setFreeze] = useState(false);

  // ?cena=serpentina&t=8 abre direto numa cena/instante (usado para capturas de tela)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const c = q.get("cena");
    if (c === "cafe" || c === "serpentina" || c === "agua") setScene(c);
    const t = Number(q.get("t"));
    if (Number.isFinite(t) && t > 0) setOffset(t);
    if (q.get("fixo") === "1") setFreeze(true);
  }, []);

  const info = SCENES.find((s) => s.id === scene)!;
  const Scene = scene === "cafe" ? CafeScene : scene === "serpentina" ? CoilScene : WaterScene;

  return (
    <div className="lab">
      <Canvas
        className="lab__canvas"
        dpr={[1, 2]}
        camera={{ fov: 32, near: 0.1, far: 60, position: CAMERAS.cafe.pos }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <color attach="background" args={["#f6e7c9"]} />
        <Suspense fallback={null}>
          <Lights />
          <Scene key={scene + resetKey} resetKey={resetKey} offset={offset} flow={flow} freeze={freeze} />
          <ContactShadows position={[0, 0.002, 0]} opacity={0.4} scale={5} blur={2.6} far={1.4} resolution={512} color="#30211a" />
        </Suspense>
        <Rig scene={scene} />
        <Stats />
      </Canvas>

      <aside className="lab__panel">
        <p className="kicker">Teste isolado · líquido em código</p>
        <div className="lab__tabs" role="tablist">
          {SCENES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={scene === s.id}
              className={`lab__tab${scene === s.id ? " is-on" : ""}`}
              onClick={() => {
                setScene(s.id);
                setResetKey((k) => k + 1);
                setOffset(0);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="lab__hint">{info.hint}</p>
        <label className="lab__ctl">
          <span>Vazão</span>
          <input type="range" min={0.6} max={1.6} step={0.05} value={flow} onChange={(e) => setFlow(Number(e.target.value))} />
        </label>
        <button
          className="btn btn--small btn--bordo"
          onClick={() => {
            setOffset(0);
            setResetKey((k) => k + 1);
          }}
        >
          Reiniciar
        </button>
        <p className="lab__stats" id="liquid-stats" aria-live="off" />
      </aside>
    </div>
  );
}
