"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import Cup, { cupLevel, type CupState } from "./Cup";
import { COLORS } from "./assets";
import type { ProgressRef } from "./Experience";
import { easeInOutCubic, easeOutCubic, range } from "./math";

/* Estação de café coado com serpentina (unidades locais, base da madeira em y = 0):
   coador de vidro com nervuras em espiral -> serpentina de vidro -> copo da Sóis. */

const BASE_TOP = 0.22;
const CUP_SCALE = 0.8;
const ROD_X = -1.25;
const ROD_Z = -0.35;
const ROD_H = 6.3;

const DRIP_TIP = 4.6; // ponta do coador
const DRIP_H = 1.0; // altura do cone
const DRIP_R = 0.95; // raio da boca
const RING_Y = 4.95;

const COIL_TOP = 4.25;
const COIL_BOTTOM = 2.95;
const COIL_R = 0.36;
const COIL_TURNS = 4.5;
const COIL_EXIT = 2.55;

const TUBULAR = 640;
const RADIAL = 12;

/* Linha do tempo desta estação (progresso global da seção). */
export const STATION_TIMELINE = {
  enter: [0.5, 0.62],
  ice: [0.55, 0.62],
  pour: [0.58, 0.7], // água/café entrando no coador
  coil: [0.64, 0.77], // café descendo pela serpentina
  drip: [0.74, 0.9], // café caindo no copo
  fill: [0.76, 0.9],
  spin: [0.9, 1],
} as const;

/** Altura (local) para onde a câmera olha em cada momento. */
export function stationFocus(p: number) {
  if (p < 0.66) return 4.4;
  if (p < 0.78) return THREE.MathUtils.lerp(4.4, 2.6, easeInOutCubic(range(p, 0.66, 0.78)));
  if (p < 0.9) return THREE.MathUtils.lerp(2.6, 1.8, easeInOutCubic(range(p, 0.78, 0.84)));
  return THREE.MathUtils.lerp(1.8, 3.3, easeInOutCubic(range(p, 0.9, 0.98)));
}

function coilCurve() {
  const pts: THREE.Vector3[] = [new THREE.Vector3(0, DRIP_TIP + 0.02, 0), new THREE.Vector3(0, DRIP_TIP - 0.18, 0)];
  const steps = Math.round(COIL_TURNS * 28);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * COIL_TURNS * Math.PI * 2;
    const y = THREE.MathUtils.lerp(COIL_TOP, COIL_BOTTOM, t);
    pts.push(new THREE.Vector3(Math.cos(a) * COIL_R, y, Math.sin(a) * COIL_R));
  }
  pts.push(new THREE.Vector3(COIL_R * 0.3, COIL_BOTTOM - 0.2, 0));
  pts.push(new THREE.Vector3(0, COIL_EXIT + 0.12, 0));
  pts.push(new THREE.Vector3(0, COIL_EXIT, 0));
  return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
}

/** Cone do coador: raio cresce da ponta (y=0) até a boca (y=DRIP_H). */
function coneGeometry(radiusScale: number, closedTop: boolean) {
  const pts = [new THREE.Vector2(0.075 * radiusScale, 0)];
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const y = (i / steps) * DRIP_H;
    pts.push(new THREE.Vector2(THREE.MathUtils.lerp(0.075, DRIP_R, y / DRIP_H) * radiusScale, y));
  }
  if (closedTop) pts.push(new THREE.Vector2(0, DRIP_H));
  else pts.unshift(new THREE.Vector2(0.001, 0));
  return new THREE.LatheGeometry(pts, 96);
}

function ribGeometries() {
  // nervuras em espiral na parede interna do coador
  const ribs: THREE.TubeGeometry[] = [];
  const count = 10;
  for (let k = 0; k < count; k++) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24; // 0 = boca, 1 = ponta
      const y = DRIP_H * (1 - t) * 0.92 + 0.06;
      const r = THREE.MathUtils.lerp(0.075, DRIP_R, y / DRIP_H) * 0.93;
      const a = (k / count) * Math.PI * 2 + t * 1.7;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.016, 6, false));
  }
  return ribs;
}

function streamGeometry(r0: number, r1: number) {
  const g = new THREE.CylinderGeometry(r0, r1, 1, 20, 1, true);
  g.translate(0, -0.5, 0); // topo na origem: escala Y = comprimento
  return g;
}

type Props = {
  progress: ProgressRef;
  position: [number, number, number];
  scale: number;
};

export default function Station({ progress, position, scale }: Props) {
  const group = useRef<THREE.Group>(null);
  const bed = useRef<THREE.Group>(null);
  const coilCoffee = useRef<THREE.Mesh>(null);
  const pour = useRef<THREE.Mesh>(null);
  const drip = useRef<THREE.Mesh>(null);
  const cupState = useRef<CupState>({ fill: 0, ice: 0, spin: 0 });

  const glass = useMemo(
    () =>
      // vidro "leve": transparente com reflexos, sem o passe de transmissão
      // (assim o café dentro da serpentina aparece nítido)
      new THREE.MeshPhysicalMaterial({
        color: "#fffdf8",
        transparent: true,
        opacity: 0.22,
        roughness: 0.03,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        envMapIntensity: 2.2,
        specularIntensity: 1,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const brass = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#c79a4b", metalness: 1, roughness: 0.28 }),
    [],
  );
  const coffeeMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#8a4415",
        emissive: "#5a2306",
        emissiveIntensity: 0.45,
        roughness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
      }),
    [],
  );

  const geo = useMemo(() => {
    const curve = coilCurve();
    return {
      coilGlass: new THREE.TubeGeometry(curve, TUBULAR, 0.06, RADIAL, false),
      coilCoffee: new THREE.TubeGeometry(curve, TUBULAR, 0.042, RADIAL, false),
      cone: coneGeometry(1, false),
      bed: coneGeometry(0.9, true),
      ribs: ribGeometries(),
      pour: streamGeometry(0.05, 0.06),
      drip: streamGeometry(0.03, 0.04),
    };
  }, []);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const p = progress.current.value;
    const t = state.clock.elapsedTime;
    const T = STATION_TIMELINE;

    g.visible = p > T.enter[0] - 0.02;
    if (!g.visible) return;
    const enter = easeOutCubic(range(p, T.enter[0], T.enter[1]));
    g.position.set(position[0], position[1] - (1 - enter) * 9, position[2]);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, -0.35 + state.pointer.x * 0.12, 0.04);

    // café no coador: sobe com a água e baixa enquanto escorre pela serpentina
    const fillBed = easeOutCubic(range(p, T.pour[0], T.pour[1])) * 0.62;
    const drain = easeInOutCubic(range(p, T.drip[0], T.drip[1])) * 0.3;
    const bedF = Math.max(0, fillBed - drain);
    if (bed.current) {
      bed.current.visible = bedF > 0.01;
      bed.current.scale.setScalar(Math.max(0.001, bedF));
    }
    const bedTop = DRIP_TIP + DRIP_H * bedF;

    // fio de água/café entrando no coador (a chaleira entra aqui depois)
    if (pour.current) {
      const head = easeOutCubic(range(p, T.pour[0], T.pour[0] + 0.03));
      const tail = easeInOutCubic(range(p, T.pour[1] - 0.03, T.pour[1]));
      const top = 11 - tail * (11 - bedTop);
      const bottom = 11 - head * (11 - bedTop);
      pour.current.visible = head > 0 && tail < 1;
      pour.current.position.y = top;
      const w = 1 + Math.sin(t * 17) * 0.07;
      pour.current.scale.set(w, Math.max(0.0001, top - bottom), w);
    }

    // café percorrendo a serpentina
    if (coilCoffee.current) {
      const c = range(p, T.coil[0], T.coil[1]);
      const segs = Math.floor(c * TUBULAR);
      coilCoffee.current.visible = segs > 0;
      coilCoffee.current.geometry.setDrawRange(0, segs * RADIAL * 6);
    }

    // gotejamento da saída da serpentina para o copo
    const fill = easeInOutCubic(range(p, T.fill[0], T.fill[1]));
    const surfaceY = BASE_TOP + cupLevel(fill) * CUP_SCALE;
    if (drip.current) {
      const head = easeOutCubic(range(p, T.drip[0], T.drip[0] + 0.02));
      const tail = easeInOutCubic(range(p, T.drip[1] - 0.02, T.drip[1]));
      const top = COIL_EXIT - tail * (COIL_EXIT - surfaceY);
      const bottom = COIL_EXIT - head * (COIL_EXIT - surfaceY);
      drip.current.visible = head > 0 && tail < 1;
      drip.current.position.y = top;
      const w = 1 + Math.sin(t * 23) * 0.12;
      drip.current.scale.set(w, Math.max(0.0001, top - bottom), w);
    }

    cupState.current.fill = fill;
    cupState.current.ice = range(p, T.ice[0], T.ice[1]);
    cupState.current.spin = easeInOutCubic(range(p, T.spin[0], T.spin[1])) * Math.PI * 1.2;
  });

  return (
    <group ref={group} position={position} scale={scale} visible={false}>
      {/* chão infinito (ciclorama) + sombra do sol */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, -4]}>
        <planeGeometry args={[140, 70]} />
        <meshBasicMaterial color={COLORS.creme} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -4]} receiveShadow>
        <planeGeometry args={[140, 70]} />
        <shadowMaterial color="#6b4524" opacity={0.22} />
      </mesh>
      <ContactShadows position={[0, 0.003, 0]} scale={6} blur={2.6} opacity={0.4} far={2} color="#5a3a22" />

      {/* base de madeira */}
      <RoundedBox args={[3.2, BASE_TOP, 2.2]} radius={0.06} smoothness={4} position={[-0.3, BASE_TOP / 2, -0.1]} castShadow receiveShadow>
        <meshStandardMaterial color="#5b3320" roughness={0.55} />
      </RoundedBox>

      {/* haste, braço e anel de latão */}
      <mesh position={[ROD_X, BASE_TOP + ROD_H / 2, ROD_Z]} material={brass} castShadow>
        <cylinderGeometry args={[0.055, 0.055, ROD_H, 24]} />
      </mesh>
      <mesh position={[ROD_X, BASE_TOP + ROD_H + 0.09, ROD_Z]} material={brass} castShadow>
        <sphereGeometry args={[0.11, 24, 16]} />
      </mesh>
      {(() => {
        const len = Math.hypot(ROD_X, ROD_Z) - 0.36;
        const ang = Math.atan2(ROD_Z, ROD_X);
        return (
          <mesh
            position={[(ROD_X + Math.cos(ang) * 0.36) / 2, RING_Y, (ROD_Z + Math.sin(ang) * 0.36) / 2]}
            rotation={[0, -ang, Math.PI / 2]}
            material={brass}
            castShadow
          >
            <cylinderGeometry args={[0.035, 0.035, len, 16]} />
          </mesh>
        );
      })()}
      <mesh position={[0, RING_Y, 0]} rotation-x={Math.PI / 2} material={brass} castShadow>
        <torusGeometry args={[0.38, 0.035, 16, 64]} />
      </mesh>

      {/* coador de vidro com nervuras em espiral */}
      <group position-y={DRIP_TIP}>
        <mesh geometry={geo.cone} material={glass} />
        {geo.ribs.map((r, i) => (
          <mesh key={i} geometry={r} material={glass} />
        ))}
        <mesh position-y={DRIP_H} rotation-x={Math.PI / 2} material={glass}>
          <torusGeometry args={[DRIP_R, 0.025, 12, 96]} />
        </mesh>
        <group ref={bed} position-y={0.02} visible={false}>
          <mesh geometry={geo.bed}>
            <meshPhysicalMaterial color="#3a1c0e" roughness={0.35} clearcoat={0.6} />
          </mesh>
        </group>
      </group>

      {/* serpentina */}
      <mesh geometry={geo.coilGlass} material={glass} />
      <mesh ref={coilCoffee} geometry={geo.coilCoffee} material={coffeeMat} visible={false} />

      {/* fios de líquido */}
      <mesh ref={pour} geometry={geo.pour} material={coffeeMat} visible={false} />
      <mesh ref={drip} geometry={geo.drip} material={coffeeMat} visible={false} />

      {/* copo da Sóis sobre a base */}
      <group position={[0, BASE_TOP, 0]} scale={CUP_SCALE}>
        <Cup state={cupState} />
      </group>
    </group>
  );
}
