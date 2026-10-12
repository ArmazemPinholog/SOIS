"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CUP, CUP_PROFILE, CUP_INNER_BOTTOM, cupOuterRadius } from "./layout";
import { createCupTextures } from "./cupTextures";

/* Copo da Sóis: silhueta medida no copo.glb (parede cônica + borda enrolada), reconstruída por
   revolução para a parede ficar lisa e a estampa oficial ser aplicada sem distorção. */

const SEG = 128;

function wallGeometry(inner: boolean) {
  const s = CUP.scale;
  const top = CUP_PROFILE.height * s;
  const pts: THREE.Vector2[] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const y = 0.03 * s + (i / n) * (top - 0.03 * s);
    const r = cupOuterRadius(y) - (inner ? CUP_PROFILE.wall * s : 0);
    pts.push(new THREE.Vector2(r, y));
  }
  // por dentro a ordem inverte para as normais apontarem para o centro
  if (inner) pts.reverse();
  const g = new THREE.LatheGeometry(pts, SEG, -Math.PI / 2, Math.PI * 2);
  // uv.x dá a volta, uv.y acompanha a altura (o Lathe já distribui assim)
  return g;
}

function rimGeometry() {
  const s = CUP.scale;
  const y = CUP_PROFILE.rimY * s;
  const r = cupOuterRadius(CUP_PROFILE.height * s) - CUP_PROFILE.wall * s * 0.5;
  const tube = CUP_PROFILE.rimR * s;
  const g = new THREE.TorusGeometry(r + tube * 0.35, tube, 16, SEG);
  g.rotateX(Math.PI / 2);
  g.translate(0, y - tube * 0.55, 0);
  return g;
}

function bottomGeometry() {
  // fundo recuado com a dobra do papel embaixo
  const s = CUP.scale;
  const r0 = cupOuterRadius(0.03 * s);
  const pts = [
    new THREE.Vector2(0.001, CUP_INNER_BOTTOM),
    new THREE.Vector2(r0 - 0.01, CUP_INNER_BOTTOM),
    new THREE.Vector2(r0 - 0.012, 0.006),
    new THREE.Vector2(r0 - 0.004, 0.0),
    new THREE.Vector2(r0, 0.012),
    new THREE.Vector2(r0, 0.03 * s),
  ];
  return new THREE.LatheGeometry(pts, SEG);
}

/** Sombreamento interno (mais escuro no fundo), em cores por vértice. */
function interiorShade(g: THREE.BufferGeometry) {
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const top = CUP_PROFILE.height * CUP.scale;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / top, 0, 1);
    const k = 0.55 + 0.45 * Math.pow(t, 0.7);
    col[i * 3] = k;
    col[i * 3 + 1] = k * 0.97;
    col[i * 3 + 2] = k * 0.92;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

export default function SoisCup() {
  const gl = useThree((s) => s.gl);
  const tex = useMemo(() => createCupTextures(gl.capabilities.getMaxAnisotropy()), [gl]);
  const outer = useMemo(() => wallGeometry(false), []);
  const inner = useMemo(() => interiorShade(wallGeometry(true)), []);
  const rim = useMemo(() => rimGeometry(), []);
  const bottom = useMemo(() => bottomGeometry(), []);

  return (
    <group>
      <mesh geometry={outer} castShadow receiveShadow>
        <meshPhysicalMaterial
          map={tex.map}
          roughnessMap={tex.orm}
          metalnessMap={tex.orm}
          roughness={1}
          metalness={1}
          bumpMap={tex.bump}
          bumpScale={0.4}
          sheen={0.25}
          sheenColor="#ffd9b0"
          envMapIntensity={1.15}
        />
      </mesh>
      <mesh geometry={inner} receiveShadow>
        <meshStandardMaterial color="#f1e0c3" vertexColors roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={rim} castShadow>
        <meshStandardMaterial color="#efdcbc" roughness={0.6} />
      </mesh>
      <mesh geometry={bottom} receiveShadow>
        <meshStandardMaterial color="#5d1818" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
