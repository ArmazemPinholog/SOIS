"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sampleSymbol, VIEWBOX } from "@/lib/soisSymbol";
import { createBeanGeometry, seeded } from "./assets";
import type { ProgressRef } from "./Experience";
import { clamp01, easeInOutCubic } from "./math";

// tamanho do símbolo em unidades 3D: 1 unidade do SVG = K unidades da cena
const K = 0.022;

type Props = {
  progress: ProgressRef;
  position: [number, number, number];
  scale: number;
};

type Bean = {
  target: THREE.Vector3;
  targetQuat: THREE.Quaternion;
  scatter: THREE.Vector3;
  spin: THREE.Vector3;
  phase: number;
  delay: number;
  fallDelay: number;
  side: number;
};

const tmpPos = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const spinQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpScale = new THREE.Vector3(1, 1, 1);
const tmpMat = new THREE.Matrix4();
const zAxis = new THREE.Vector3(0, 0, 1);
const xAxis = new THREE.Vector3(1, 0, 0);

export default function Beans({ progress, position, scale }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => createBeanGeometry(0.115), []);

  const beans = useMemo<Bean[]>(() => {
    const rand = seeded(21);
    return sampleSymbol(7.2).map((pt) => {
      const target = new THREE.Vector3(
        (pt.x - VIEWBOX.w / 2) * K,
        -(pt.y - VIEWBOX.h / 2) * K,
        (rand() - 0.5) * 0.08,
      );
      // alinha o grão ao traço e gira em torno do próprio eixo (mostra ora o sulco, ora o dorso)
      const roll = rand() < 0.55 ? Math.PI + (rand() - 0.5) * 0.6 : (rand() - 0.5) * 0.6;
      const targetQuat = new THREE.Quaternion()
        .setFromAxisAngle(zAxis, -pt.angle + (rand() - 0.5) * 0.25)
        .multiply(new THREE.Quaternion().setFromAxisAngle(xAxis, roll));
      const scatter = new THREE.Vector3((rand() - 0.5) * 12, (rand() - 0.5) * 7, 1.2 - rand() * 3.8);
      return {
        target,
        targetQuat,
        scatter,
        spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.4),
        phase: rand() * Math.PI * 2,
        delay: rand(),
        fallDelay: rand(),
        side: pt.half === "top" ? -1 : 1,
      };
    });
  }, []);

  // torra mais clara na metade de cima (eco do laranja do logo), mais escura embaixo
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const light = new THREE.Color("#8d4c24");
    const dark = new THREE.Color("#3b2116");
    const rand = seeded(4);
    beans.forEach((b, i) => {
      const c = (b.side < 0 ? light : dark).clone().offsetHSL(0, 0, (rand() - 0.5) * 0.05);
      m.setColorAt(i, c);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [beans]);

  useFrame((state) => {
    const m = mesh.current;
    const g = group.current;
    if (!m || !g) return;
    const p = progress.current.value;
    const t = state.clock.elapsedTime;

    // depois que os grãos caem, não precisa mais desenhar
    m.visible = p < 0.66;
    if (!m.visible) return;

    // ponteiro em coordenadas locais do grupo (para os grãos soltos se afastarem do mouse)
    const vw = state.viewport.width;
    const vh = state.viewport.height;
    const px = ((state.pointer.x * vw) / 2 - g.position.x) / g.scale.x;
    const py = ((state.pointer.y * vh) / 2 - g.position.y) / g.scale.y;

    for (let i = 0; i < beans.length; i++) {
      const b = beans[i];
      const form = easeInOutCubic(clamp01((p - 0.03 - b.delay * 0.12) / 0.18));
      const fall = clamp01((p - 0.43 - b.fallDelay * 0.07) / 0.14);

      // flutuando solto
      const fx = b.scatter.x + Math.sin(t * 0.45 + b.phase) * 0.35;
      const fy = b.scatter.y + Math.cos(t * 0.38 + b.phase * 1.3) * 0.4;
      const fz = b.scatter.z + Math.sin(t * 0.3 + b.phase) * 0.3;
      const dx = fx - px;
      const dy = fy - py;
      const d2 = dx * dx + dy * dy;
      const push = (1 - form) * Math.exp(-d2 / 2.2) * 1.4;
      const len = Math.sqrt(d2) || 1;

      tmpPos.set(fx + (dx / len) * push, fy + (dy / len) * push, fz);
      // respiração leve depois de formado
      const breath = Math.sin(t * 1.3 + b.phase) * 0.012;
      tmpTarget.copy(b.target).setY(b.target.y + breath);
      tmpPos.lerp(tmpTarget, form);
      // arco em direção à câmera durante o voo
      tmpPos.z += Math.sin(form * Math.PI) * 1.4;

      // giro solto -> orientação do traço
      tmpEuler.set(
        b.phase + t * b.spin.x,
        b.phase * 0.7 + t * b.spin.y,
        b.phase * 1.3 + t * b.spin.z,
      );
      spinQuat.setFromEuler(tmpEuler);
      tmpQuat.copy(spinQuat).slerp(b.targetQuat, form);

      // queda: o símbolo se desfaz e os grãos despencam para fora da tela
      if (fall > 0) {
        const f2 = fall * fall;
        tmpPos.y -= f2 * 11;
        tmpPos.x += b.side * fall * 0.6 + Math.sin(b.phase) * f2 * 0.8;
        tmpPos.z += f2 * 1.5;
        tmpEuler.set(f2 * b.spin.x * 9, f2 * b.spin.y * 9, f2 * b.spin.z * 9);
        tmpQuat.multiply(spinQuat.setFromEuler(tmpEuler));
      }

      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      m.setMatrixAt(i, tmpMat);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={group} position={position} scale={scale}>
      <instancedMesh ref={mesh} args={[geometry, undefined, beans.length]} castShadow frustumCulled={false}>
        <meshPhysicalMaterial roughness={0.42} clearcoat={0.65} clearcoatRoughness={0.3} sheen={0.3} sheenColor="#c98a4f" />
      </instancedMesh>
    </group>
  );
}
