"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { sampleSymbol, VIEWBOX } from "@/lib/soisSymbol";
import { seeded } from "@/components/three/assets";
import { clamp01, easeInOutCubic, range } from "@/components/three/math";
import { MODEL_URLS, toFloatGeometry } from "./models";
import type { StoryProgress } from "./StoryScene";
import { GRINDER, T, hopperLift } from "./layout";

/* Grãos reais (graodecafe.glb, instanciado): soltos no ar → formam o símbolo oficial →
   voam em arco para o funil do moedor → afundam na garganta enquanto ele mói. */

const K = 0.022; // 1 unidade do SVG = K unidades da cena
const CENTER = new THREE.Vector3(0, 11.6, -0.4);
const BEAN_LEN = 0.23;
const HOPPER_SCALE = 0.5; // no funil os grãos ficam no tamanho real em relação ao moedor

function beanGeometry(src: THREE.BufferGeometry) {
  const g = toFloatGeometry(src);
  // o GLB tem o comprimento em z e o sulco em +y: leva o comprimento para x e o sulco para -z
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0));
  g.applyMatrix4(m);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const c = bb.getCenter(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z);
  const len = bb.max.x - bb.min.x;
  g.scale(BEAN_LEN / len, BEAN_LEN / len, BEAN_LEN / len);
  g.computeVertexNormals();
  return g;
}

type Bean = {
  target: THREE.Vector3;
  targetQuat: THREE.Quaternion;
  scatter: THREE.Vector3;
  hopper: THREE.Vector3;
  hopperQuat: THREE.Quaternion;
  spin: THREE.Vector3;
  phase: number;
  delay: number;
  flyDelay: number;
  sinkOrder: number;
  half: number;
};

const tPos = new THREE.Vector3();
const tTarget = new THREE.Vector3();
const tQuat = new THREE.Quaternion();
const sQuat = new THREE.Quaternion();
const tEuler = new THREE.Euler();
const tScale = new THREE.Vector3();
const tMat = new THREE.Matrix4();
const ctrl = new THREE.Vector3();
const zAxis = new THREE.Vector3(0, 0, 1);
const xAxis = new THREE.Vector3(1, 0, 0);

export default function StoryBeans({ progress }: { progress: StoryProgress }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { scene } = useGLTF(MODEL_URLS.bean, false, true);
  const { geometry, material } = useMemo(() => {
    let src: THREE.Mesh | null = null;
    scene.traverse((o) => {
      if (!src && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh;
    });
    const mesh0 = src! as THREE.Mesh;
    const mat = (mesh0.material as THREE.MeshStandardMaterial).clone();
    mat.roughness = 0.45;
    mat.envMapIntensity = 1.2;
    return { geometry: beanGeometry(mesh0.geometry), material: mat };
  }, [scene]);

  const beans = useMemo<Bean[]>(() => {
    const rand = seeded(21);
    const pts = sampleSymbol(7.2);
    const [hx, hy, hz] = GRINDER.hopperTop;
    return pts.map((pt, i) => {
      const target = new THREE.Vector3((pt.x - VIEWBOX.w / 2) * K, -(pt.y - VIEWBOX.h / 2) * K, (rand() - 0.5) * 0.08).add(CENTER);
      const roll = rand() < 0.55 ? Math.PI + (rand() - 0.5) * 0.6 : (rand() - 0.5) * 0.6;
      const targetQuat = new THREE.Quaternion()
        .setFromAxisAngle(zAxis, -pt.angle + (rand() - 0.5) * 0.25)
        .multiply(new THREE.Quaternion().setFromAxisAngle(xAxis, roll));
      const scatter = new THREE.Vector3((rand() - 0.5) * 13, (rand() - 0.5) * 7, 1.5 - rand() * 4).add(CENTER);
      // monte dentro do funil (cone que abre para cima)
      const u = rand();
      const y = GRINDER.throatY + 0.18 + Math.pow(u, 0.8) * (hy - GRINDER.throatY - 0.35);
      const rCone = THREE.MathUtils.lerp(0.12, GRINDER.hopperRadius - 0.08, (y - GRINDER.throatY) / (hy - GRINDER.throatY));
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * rCone;
      const hopper = new THREE.Vector3(hx + Math.cos(a) * rr, y, hz + Math.sin(a) * rr);
      const hopperQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6));
      return {
        target,
        targetQuat,
        scatter,
        hopper,
        hopperQuat,
        spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.4),
        phase: rand() * Math.PI * 2,
        delay: rand(),
        // cai primeiro quem está mais embaixo no símbolo
        flyDelay: THREE.MathUtils.clamp(0.5 + (target.y - CENTER.y) / 6 + (rand() - 0.5) * 0.35, 0, 1),
        sinkOrder: 1 - (y - GRINDER.throatY) / (hy - GRINDER.throatY),
        half: pt.half === "top" ? -1 : 1,
      };
    });
  }, []);

  // torra um pouco mais clara na metade de cima (eco do laranja do logo), mais escura embaixo
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    // a textura do GLB é âmbar; cores neutras puxam para o marrom de grão torrado
    const light = new THREE.Color("#9c8270");
    const dark = new THREE.Color("#6a5244");
    const rand = seeded(4);
    beans.forEach((b, i) => m.setColorAt(i, (b.half < 0 ? light : dark).clone().offsetHSL(0, 0, (rand() - 0.5) * 0.06)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [beans]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const p = progress.current.value;
    const t = state.clock.elapsedTime;
    m.visible = p < T.grind[1] + 0.01;
    if (!m.visible) return;
    const grind = range(p, T.grind[0], T.grind[1]);

    for (let i = 0; i < beans.length; i++) {
      const b = beans[i];
      const form = easeInOutCubic(clamp01((p - T.form[0] - b.delay * 0.06) / (T.form[1] - T.form[0] - 0.06)));
      const fall = clamp01((p - T.drop[0] - b.flyDelay * 0.035) / (T.drop[1] - T.drop[0] - 0.035));
      const fly = fall * fall * (3 - 2 * fall);

      // solto no ar, reagindo ao mouse
      const fx = b.scatter.x + Math.sin(t * 0.45 + b.phase) * 0.35;
      const fy = b.scatter.y + Math.cos(t * 0.38 + b.phase * 1.3) * 0.4;
      const fz = b.scatter.z + Math.sin(t * 0.3 + b.phase) * 0.3;
      tPos.set(fx, fy, fz);
      const breath = Math.sin(t * 1.3 + b.phase) * 0.012;
      tTarget.copy(b.target).setY(b.target.y + breath);
      tPos.lerp(tTarget, form);
      tPos.z += Math.sin(form * Math.PI) * 1.4;

      tEuler.set(b.phase + t * b.spin.x, b.phase * 0.7 + t * b.spin.y, b.phase * 1.3 + t * b.spin.z);
      sQuat.setFromEuler(tEuler);
      tQuat.copy(sQuat).slerp(b.targetQuat, form);
      let scale = 1;

      if (fly > 0) {
        // arco (Bézier quadrática) do símbolo até o monte no funil
        // queda quase vertical (gravidade), com leve abertura para fora
        ctrl.set((tPos.x + b.hopper.x) / 2 + b.half * 0.35, (tPos.y + b.hopper.y) / 2 + 0.6, (tPos.z + b.hopper.z) / 2 + 0.35);
        const u = fly;
        const a = (1 - u) * (1 - u);
        const bb = 2 * (1 - u) * u;
        const c = u * u;
        const lift = hopperLift(p);
        tPos.set(
          a * tPos.x + bb * ctrl.x + c * b.hopper.x,
          a * tPos.y + bb * ctrl.y + c * (b.hopper.y + lift),
          a * tPos.z + bb * ctrl.z + c * b.hopper.z,
        );
        tEuler.set(u * b.spin.x * 8, u * b.spin.y * 8, u * b.spin.z * 8);
        tQuat.multiply(sQuat.setFromEuler(tEuler)).slerp(b.hopperQuat, u);
        scale = THREE.MathUtils.lerp(1, HOPPER_SCALE, u);
      }
      if (grind > 0) {
        // os de baixo somem primeiro, puxados para a garganta
        const s = clamp01((grind - b.sinkOrder * 0.7) / 0.3);
        tPos.lerp(ctrl.set(GRINDER.hopperTop[0], GRINDER.throatY + hopperLift(p) - 0.1, GRINDER.hopperTop[2]), s);
        scale *= 1 - s;
      }
      tScale.setScalar(scale);
      tMat.compose(tPos, tQuat, tScale);
      m.setMatrixAt(i, tMat);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, beans.length]} castShadow frustumCulled={false} />;
}
