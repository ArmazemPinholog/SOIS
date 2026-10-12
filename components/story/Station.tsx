"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useModel, MODEL_URLS } from "./models";
import type { StoryProgress } from "./StoryScene";
import { COIL_CFG, CUP, CUP_INNER_BOTTOM, KETTLE, STAND, T } from "./layout";
import { levelToY } from "./CupCoffee";
import Stream from "@/components/three/liquid/Stream";
import Drops from "@/components/three/liquid/Drops";
import GlassCoil from "@/components/three/liquid/GlassCoil";
import { SURFACE_FRAG, SURFACE_VERT } from "@/components/three/liquid/shaders";
import { easeInOutCubic, range } from "@/components/three/math";

/* Estação de coado: suporte com V60 (GLB), cama de pó, chaleira (GLB) despejando água em círculos,
   café passando pela serpentina de vidro e caindo no copo. Tudo comandado pelo progresso do scroll. */

const WATER_TOP = KETTLE.pourTipY;
const WATER_LEN = WATER_TOP - STAND.bed.y;
const COFFEE_TOP = COIL_CFG.exitY;
const COFFEE_LEN = COFFEE_TOP - (CUP.position[1] + CUP_INNER_BOTTOM);

type Refs = {
  waterHead: { current: number };
  waterTail: { current: number };
  waterFlow: { current: number };
  poolY: { current: number };
  poolTouch: { current: number };
  coffeeHead: { current: number };
  coffeeTail: { current: number };
  coffeeFlow: { current: number };
  cupSurfaceY: { current: number };
  cupTouch: { current: number };
  coilFill: { current: number };
};

export function useStationRefs(): Refs {
  return useMemo(
    () => ({
      waterHead: { current: 0 },
      waterTail: { current: 0 },
      waterFlow: { current: 0 },
      poolY: { current: STAND.pool.y0 },
      poolTouch: { current: 0 },
      coffeeHead: { current: 0 },
      coffeeTail: { current: 0 },
      coffeeFlow: { current: 0 },
      cupSurfaceY: { current: 0 },
      cupTouch: { current: 0 },
      coilFill: { current: 0 },
    }),
    [],
  );
}

type Props = {
  progress: StoryProgress;
  refs: Refs;
  /** nível do café no copo (0..1) e impacto, compartilhados com <CupCoffee> */
  cupLevel: { current: number };
  cupImpact: { current: number };
};

export default function Station({ progress, refs, cupLevel, cupImpact }: Props) {
  const stand = useModel(MODEL_URLS.stand, 1.8);
  const kettle = useModel(MODEL_URLS.kettle);
  const kettleRef = useRef<THREE.Group>(null);
  const waterRig = useRef<THREE.Group>(null);
  const bed = useRef<THREE.Mesh>(null);
  const bedMat = useRef<THREE.MeshStandardMaterial>(null);
  const pool = useRef<THREE.Mesh>(null);
  const powder = useTexture("/img/po-cafe.webp");
  useMemo(() => {
    powder.colorSpace = THREE.SRGBColorSpace;
    powder.wrapS = powder.wrapT = THREE.RepeatWrapping;
  }, [powder]);

  const poolMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: SURFACE_FRAG,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uImpact: { value: 0 }, uRadius: { value: STAND.pool.r0 }, uKind: { value: 0 } },
      }),
    [],
  );
  const poolGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(STAND.pool.r1 * 2, STAND.pool.r1 * 2, 64, 64);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const bedGeo = useMemo(() => {
    // cama de pó levemente abaulada
    const g = new THREE.CircleGeometry(STAND.bed.radius, 48, 0, Math.PI * 2);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getZ(i)) / STAND.bed.radius;
      p.setY(i, (1 - r * r) * 0.06);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  const rot = useMemo(() => new THREE.Quaternion(), []);
  const tipRot = useMemo(() => new THREE.Vector3(), []);
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const dry = useMemo(() => new THREE.Color("#c99a72"), []);
  const wet = useMemo(() => new THREE.Color("#4a2a18"), []);

  useFrame((state) => {
    const p = progress.current.value;
    const t = state.clock.elapsedTime;

    /* ---------- chaleira ---------- */
    const kin = easeInOutCubic(range(p, T.kettleIn[0], T.kettleIn[1]));
    const kout = easeInOutCubic(range(p, T.kettleOut[0], T.kettleOut[1]));
    const pose = kin * (1 - kout);
    const pouring = range(p, T.pour[0], T.pour[1]);
    const circle = pouring > 0 && pouring < 1 ? 0.2 : 0.0;
    const tipX = STAND.axisX + Math.cos(t * 1.7) * circle * pose;
    const tipZ = Math.sin(t * 1.7) * circle * pose;
    const angle = KETTLE.pourAngle * pose;
    rot.setFromAxisAngle(zAxis, angle);
    tipRot.copy(KETTLE.tip).applyQuaternion(rot);
    // posição de repouso (na bancada) → posição de despejo (bico sobre o V60)
    const restPos = new THREE.Vector3(...KETTLE.rest);
    const pourPos = new THREE.Vector3(tipX - tipRot.x, WATER_TOP - tipRot.y, tipZ - tipRot.z);
    const lift = Math.sin(pose * Math.PI) * 0.6; // arco ao levantar
    if (kettleRef.current) {
      kettleRef.current.position.lerpVectors(restPos, pourPos, pose);
      kettleRef.current.position.y += lift;
      kettleRef.current.quaternion.copy(rot);
    }
    if (waterRig.current) waterRig.current.position.set(tipX, 0, tipZ);

    /* ---------- água ---------- */
    refs.waterHead.current = easeInOutCubic(range(p, T.pour[0], T.pour[0] + 0.012));
    refs.waterTail.current = range(p, T.pour[1] - 0.004, T.pour[1] + 0.01);
    refs.waterFlow.current = refs.waterHead.current * (1 - refs.waterTail.current);

    /* ---------- cama de pó e café no V60 ---------- */
    const bloom = range(p, T.bloom[0], T.bloom[1]);
    if (bedMat.current) bedMat.current.color.copy(dry).lerp(wet, Math.min(1, bloom * 1.6));
    // a cama nasce do pó que cai da bica e floresce com a água
    const grow = range(p, T.grind[0] + 0.015, T.grind[1]);
    if (bed.current) {
      bed.current.visible = grow > 0;
      const rr = Math.sqrt(Math.max(grow, 0.001));
      bed.current.scale.set(rr, (0.25 + grow * 0.75) * (1 + bloom * 1.5), rr);
    }
    // o café sobe no cone durante o despejo e baixa enquanto escorre para a serpentina
    const rise = range(p, T.pour[0] + 0.01, T.pour[1]);
    const drain = range(p, T.pour[1], T.coil[1] + 0.02);
    const lvl = Math.max(0, rise - drain * 1.05);
    const py = THREE.MathUtils.lerp(STAND.pool.y0, STAND.pool.y1, lvl);
    refs.poolY.current = py;
    refs.poolTouch.current = refs.waterHead.current > 0.99 ? 1 : 0;
    if (pool.current) {
      pool.current.visible = lvl > 0.01;
      pool.current.position.y = py;
    }
    poolMat.uniforms.uRadius.value = THREE.MathUtils.lerp(STAND.pool.r0, STAND.pool.r1, lvl);
    poolMat.uniforms.uTime.value = t;
    poolMat.uniforms.uImpact.value = refs.waterFlow.current * 0.8;

    /* ---------- serpentina ---------- */
    refs.coilFill.current = easeInOutCubic(range(p, T.coil[0], T.coil[1]));

    /* ---------- café caindo no copo ---------- */
    refs.coffeeHead.current = easeInOutCubic(range(p, T.drip[0], T.drip[0] + 0.012));
    refs.coffeeTail.current = range(p, T.drip[1] - 0.005, T.drip[1] + 0.012);
    refs.coffeeFlow.current = refs.coffeeHead.current * (1 - refs.coffeeTail.current);
    // o café enche até ~70%; o gelo que cai depois desloca o nível um pouco mais
    cupLevel.current = range(p, T.fill[0], T.fill[1]) * 0.7 + range(p, T.ice[0], T.ice[1] + 0.01) * 0.12;
    const surfY = CUP.position[1] + levelToY(cupLevel.current);
    refs.cupSurfaceY.current = surfY;
    const reach = (COFFEE_TOP - surfY) / COFFEE_LEN;
    refs.cupTouch.current = refs.coffeeHead.current >= reach && refs.coffeeFlow.current > 0.05 ? 1 : 0;
    cupImpact.current = THREE.MathUtils.lerp(cupImpact.current, refs.cupTouch.current * refs.coffeeFlow.current, 0.08);
  });

  return (
    <group>
      <group position={[STAND.axisX, 0, 0]} rotation-y={STAND.rotationY}>
        <primitive object={stand} position={STAND.position} scale={STAND.scale} />
      </group>

      {/* cama de pó no V60 */}
      <mesh ref={bed} geometry={bedGeo} position={[STAND.axisX, STAND.bed.y, 0]}>
        <meshStandardMaterial ref={bedMat} map={powder} color="#c99a72" roughness={0.95} />
      </mesh>
      <mesh ref={pool} geometry={poolGeo} material={poolMat} position={[STAND.axisX, STAND.pool.y0, 0]} visible={false} />

      {/* serpentina de vidro saindo do colar de latão */}
      <group position={[STAND.axisX, 0, 0]}>
        <GlassCoil fillRef={refs.coilFill} cfg={COIL_CFG} collar={false} glow={0.5} env={0.28} />
      </group>

      {/* chaleira */}
      <group ref={kettleRef} position={KETTLE.rest}>
        <primitive object={kettle} scale={KETTLE.scale} />
      </group>

      {/* água do bico */}
      <group ref={waterRig}>
        <Stream kind="water" length={WATER_LEN} radius={0.037} headRef={refs.waterHead} tailRef={refs.waterTail} position={[0, WATER_TOP, 0]} twist={0.012} amp={0.07} thin={0.3} />
        <Drops
          kind="water"
          top={WATER_TOP}
          length={WATER_LEN}
          twist={0.012}
          headRef={refs.waterHead}
          tailRef={refs.waterTail}
          flowRef={refs.waterFlow}
          surfaceYRef={refs.poolY}
          touchRef={refs.poolTouch}
          max={90}
        />
      </group>

      {/* café da serpentina para o copo */}
      <group position={[STAND.axisX, 0, 0]}>
        <Stream kind="coffee" length={COFFEE_LEN} radius={0.03} headRef={refs.coffeeHead} tailRef={refs.coffeeTail} position={[0, COFFEE_TOP, 0]} twist={0.02} amp={0.12} glow={0.45} env={0.4} />
        <Drops
          kind="coffee"
          top={COFFEE_TOP}
          length={COFFEE_LEN}
          twist={0.02}
          headRef={refs.coffeeHead}
          tailRef={refs.coffeeTail}
          flowRef={refs.coffeeFlow}
          surfaceYRef={refs.cupSurfaceY}
          touchRef={refs.cupTouch}
          max={120}
        />
      </group>
    </group>
  );
}
