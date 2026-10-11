"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Beans from "./Beans";
import Cup from "./Cup";
import { COLORS, createPalmWallTexture } from "./assets";
import { easeInOutCubic, range } from "./math";

gsap.registerPlugin(ScrollTrigger);

export type ProgressRef = RefObject<{ target: number; value: number }>;

/* Linha do tempo (progresso 0..1 do scroll da seção):
   0.00–0.03  grãos soltos, flutuando (reagem ao mouse)
   0.03–0.33  grãos voam e formam o símbolo dos dois sóis
   0.33–0.43  símbolo formado + título SÓIS
   0.43–0.57  símbolo se desfaz, grãos caem (aqui entram moer e passar nas próximas etapas)
   0.47–0.60  copo sobe
   0.57–0.79  fio de café enche o copo
   0.72–0.82  gelo cai
   0.78–1.00  copo gira com o scroll */

function useLayout() {
  const viewport = useThree((s) => s.viewport);
  const portrait = viewport.width / viewport.height < 1;
  return portrait
    ? {
        symbol: { position: [0, 1.15, 0] as [number, number, number], scale: 0.6 },
        cup: { position: [0, -2.9, 0] as [number, number, number], scale: 0.72 },
      }
    : {
        symbol: { position: [2.4, 0, 0] as [number, number, number], scale: 1 },
        cup: { position: [2.3, -1.55, 0] as [number, number, number], scale: 1.05 },
      };
}

function Backdrop() {
  const texture = useMemo(() => createPalmWallTexture(), []);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    // sombras das folhas balançando devagar
    texture.offset.x = Math.sin(state.clock.elapsedTime * 0.25) * 0.006;
    texture.offset.y = Math.cos(state.clock.elapsedTime * 0.2) * 0.004;
  });
  return (
    <mesh ref={mesh} position={[0, 2, -9]}>
      <planeGeometry args={[48, 27]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function Rig({ progress }: { progress: ProgressRef }) {
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, dt) => {
    const pr = progress.current;
    pr.value = THREE.MathUtils.damp(pr.value, pr.target, 3.2, dt);
    const p = pr.value;
    // na fase do copo a câmera sobe para enxergar o café e o gelo por cima
    const up = easeInOutCubic(range(p, 0.5, 0.66));
    const portrait = state.viewport.aspect < 1;
    const cam = state.camera;
    const px = state.pointer.x * 0.35;
    const py = state.pointer.y * 0.2;
    cam.position.x = THREE.MathUtils.lerp(cam.position.x, px, 0.04);
    cam.position.y = THREE.MathUtils.lerp(cam.position.y, py + up * 3.6, 0.08);
    cam.position.z = 12 - up * 0.8;
    look.set(0, up * (portrait ? -1.7 : -1.0), 0);
    cam.lookAt(look);
  });
  return null;
}

function Scene({ progress }: { progress: ProgressRef }) {
  const layout = useLayout();
  return (
    <>
      <color attach="background" args={[COLORS.creme]} />
      <fog attach="fog" args={[COLORS.creme, 16, 30]} />

      <hemisphereLight args={["#fff3dc", "#c99b6a", 0.9]} />
      <directionalLight
        position={[6, 9, 7]}
        intensity={2.4}
        color="#ffdcae"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <directionalLight position={[-6, 2, 4]} intensity={0.6} color="#ffc98f" />

      {/* reflexos quentes, sem baixar nenhum arquivo HDR */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} color="#ffe2b8" position={[4, 5, 5]} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#f8eacf" position={[-6, 1, 3]} scale={[6, 6, 1]} />
        <Lightformer form="ring" intensity={2} color="#f6d44d" position={[0, 6, -4]} scale={3} />
        <Lightformer form="rect" intensity={0.6} color="#6a1e1e" position={[0, -5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
      </Environment>

      <Backdrop />
      <Beans progress={progress} position={layout.symbol.position} scale={layout.symbol.scale} />
      <Cup progress={progress} position={layout.cup.position} scale={layout.cup.scale} />
      <Rig progress={progress} />
    </>
  );
}

export default function Experience() {
  const section = useRef<HTMLElement>(null);
  const progress = useRef({ target: 0, value: 0 });

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
          onUpdate: (st) => {
            progress.current.target = st.progress;
          },
        },
      });
      const show = (sel: string, at: number, out?: number) => {
        tl.fromTo(sel, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.05, ease: "power2.out" }, at);
        if (out !== undefined) tl.to(sel, { autoAlpha: 0, y: -50, duration: 0.04, ease: "power1.in" }, out);
      };
      tl.to(".p3d__hint", { autoAlpha: 0, duration: 0.03 }, 0.02);
      show(".p3d__panel--marca", 0.24, 0.42);
      show(".p3d__panel--ritual", 0.45, 0.56);
      show(".p3d__panel--cold", 0.6, 0.76);
      show(".p3d__panel--copo", 0.82);
      tl.to({}, { duration: 0.0001 }, 1);
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={section} className="p3d" aria-label="Sóis — protótipo 3D">
      <div className="p3d__sticky">
        <Canvas
          className="p3d__canvas"
          shadows
          dpr={[1, 2]}
          camera={{ fov: 30, position: [0, 0, 12], near: 0.1, far: 60 }}
          gl={{ antialias: true, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.05 }}
        >
          <Scene progress={progress} />
        </Canvas>

        <div className="p3d__hint">
          <p className="p3d__kicker">Sóis · Café · Goa</p>
          <p className="p3d__hint-title">Role para despertar os grãos</p>
          <span className="p3d__hint-line" />
        </div>

        <div className="p3d__panel p3d__panel--marca">
          <h1 className="p3d__title">SÓIS</h1>
          <p className="p3d__sub">
            Café <i aria-hidden="true">·</i> Goa
          </p>
          <p className="p3d__tagline">Dois sóis. Um só café.</p>
        </div>

        <div className="p3d__panel p3d__panel--ritual">
          <p className="p3d__kicker">01 — O ritual</p>
          <h2 className="p3d__display">
            Do grão
            <br />
            <em>à xícara.</em>
          </h2>
          <p className="p3d__lead">Próximas cenas do protótipo: o moedor e o coado.</p>
        </div>

        <div className="p3d__panel p3d__panel--cold">
          <p className="p3d__kicker">02 — Cold brew</p>
          <h2 className="p3d__display">
            Passado devagar,
            <br />
            <em>servido gelado.</em>
          </h2>
        </div>

        <div className="p3d__panel p3d__panel--copo">
          <p className="p3d__kicker">03 — A casa</p>
          <h2 className="p3d__display">
            Nosso sol
            <br />
            <em>em cada copo.</em>
          </h2>
          <p className="p3d__lead">Estampa gerada direto do símbolo da marca. Mova o mouse e continue rolando para girar o copo.</p>
        </div>
      </div>
    </section>
  );
}
