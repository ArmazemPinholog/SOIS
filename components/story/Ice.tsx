"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { StoryProgress } from "./StoryScene";
import { toFloatGeometry } from "./models";
import { CUP, T } from "./layout";
import { levelToY } from "./CupCoffee";
import { ENV_GLSL, SHADE_GLSL } from "@/components/three/liquid/shaders";
import { range } from "@/components/three/math";

/* Gelo caindo dentro do café já servido: cada cubo afunda, levanta uma coroa de café com gotas
   e volta a boiar. Tudo é função do progresso do scroll (rolar para trás desfaz o respingo). */

const URLS = ["/models/gelo-1.glb", "/models/gelo-2.glb", "/models/gelo-3.glb"];
const SIZE = 0.26;

function prepare(src: THREE.BufferGeometry) {
  let g = toFloatGeometry(src, ["position"]);
  g = mergeVertices(g, 1e-4);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const index = g.index!;
  const nb: Set<number>[] = Array.from({ length: pos.count }, () => new Set<number>());
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    nb[a].add(b).add(c);
    nb[b].add(a).add(c);
    nb[c].add(a).add(b);
  }
  // suavização de Taubin (tira o aspecto amassado sem encolher o cubo)
  const p = new Float32Array(pos.array as ArrayLike<number>);
  const tmp = new Float32Array(p.length);
  const step = (k: number) => {
    for (let v = 0; v < pos.count; v++) {
      let sx = 0;
      let sy = 0;
      let sz = 0;
      const n = nb[v].size || 1;
      for (const u of nb[v]) {
        sx += p[u * 3];
        sy += p[u * 3 + 1];
        sz += p[u * 3 + 2];
      }
      tmp[v * 3] = p[v * 3] + k * (sx / n - p[v * 3]);
      tmp[v * 3 + 1] = p[v * 3 + 1] + k * (sy / n - p[v * 3 + 1]);
      tmp[v * 3 + 2] = p[v * 3 + 2] + k * (sz / n - p[v * 3 + 2]);
    }
    p.set(tmp);
  };
  for (let i = 0; i < 6; i++) {
    step(0.5);
    step(-0.53);
  }
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const size = bb.getSize(new THREE.Vector3());
  const c = bb.getCenter(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z);
  const k = SIZE / Math.max(size.x, size.y, size.z);
  g.scale(k, k, k);
  g.computeVertexNormals();
  return g;
}

function firstGeometry(scene: THREE.Object3D) {
  let geo: THREE.BufferGeometry | null = null;
  scene.traverse((o) => {
    if (!geo && (o as THREE.Mesh).isMesh) geo = (o as THREE.Mesh).geometry;
  });
  return geo!;
}

/** nível do café no copo (igual ao da estação) */
const cupLevelAt = (p: number) => range(p, T.fill[0], T.fill[1]) * 0.7 + range(p, T.ice[0], T.ice[1] + 0.01) * 0.12;

/** cubos: posição de repouso (x, z, quanto boia em relação à superfície), forma e momento do impacto */
const CUBES = [
  { x: 0.02, z: 0.02, dy: 0.07, rot: new THREE.Euler(0.3, 0.6, 0.15), shape: 0 },
  { x: -0.16, z: 0.07, dy: 0.04, rot: new THREE.Euler(-0.2, 1.4, 0.4), shape: 1 },
  { x: 0.16, z: -0.07, dy: 0.05, rot: new THREE.Euler(0.7, 2.2, -0.3), shape: 2 },
  { x: -0.06, z: -0.17, dy: -0.01, rot: new THREE.Euler(-0.5, 0.2, 0.6), shape: 0 },
  { x: 0.1, z: 0.16, dy: 0.01, rot: new THREE.Euler(0.4, 2.9, 0.2), shape: 1 },
  { x: -0.01, z: -0.01, dy: 0.16, rot: new THREE.Euler(-0.3, 1.1, -0.5), shape: 2 },
].map((c, i, all) => ({ ...c, impact: T.ice[0] + 0.004 + (i / (all.length - 1)) * (T.ice[1] - T.ice[0] - 0.02) }));

const FALL = 0.013; // duração da queda (em progresso)
const SETTLE = 0.016;
const SPLASH = 0.022;

/* ---------- coroa de café (folha de líquido que sobe em volta do impacto) ---------- */
const CROWN_VERT = /* glsl */ `
uniform float uC;
uniform float uSeed;
uniform float uR0;
uniform float uH;
varying vec3 vNormalW;
varying vec3 vPosW;
varying float vV;
vec3 P(float th, float v) {
  float c = uC;
  float r = uR0 * (1.0 + 1.5 * c) + v * v * 0.13 * c;
  float spike = 0.7 + 0.3 * pow(abs(sin(th * 5.0 + uSeed)), 2.0) + 0.08 * sin(th * 11.0 + uSeed * 2.0);
  float h = uH * sin(3.14159 * min(c * 1.25, 1.0)) * (1.0 - 0.3 * c);
  float y = v * h * (1.0 + (spike - 1.0) * v * v);
  return vec3(sin(th) * r, y, cos(th) * r);
}
void main() {
  float th = atan(position.x, position.z);
  float v = position.y + 0.5;
  vec3 p = P(th, v);
  vec3 a = P(th + 0.01, v) - P(th - 0.01, v);
  vec3 b = P(th, min(v + 0.02, 1.0)) - P(th, max(v - 0.02, 0.0));
  vec3 n = normalize(cross(b, a) + 1e-6);
  if (dot(n, vec3(sin(th), 0.0, cos(th))) < 0.0) n = -n;
  vNormalW = normalize(mat3(modelMatrix) * n);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vPosW = w.xyz;
  vV = v;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const CROWN_FRAG = /* glsl */ `
uniform float uC;
varying vec3 vNormalW;
varying vec3 vPosW;
varying float vV;
${ENV_GLSL}
${SHADE_GLSL}
void main() {
  vec3 N = normalize(vNormalW);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vPosW);
  vec4 c = liquidShade(N, V, 0.0, 1.6, 0.4);
  // borda de cima mais fina e translúcida, e a coroa some no fim
  c.a = (1.0 - smoothstep(0.72, 1.0, uC)) * mix(1.0, 0.75, vV);
  gl_FragColor = c;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const DROPS_PER = 12;

export default function Ice({ progress }: { progress: StoryProgress }) {
  const gltfs = useGLTF(URLS, false, true);
  const geos = useMemo(() => gltfs.map((g) => prepare(firstGeometry(g.scene))), [gltfs]);
  const cores = useMemo(() => geos.map((g) => g.clone().scale(0.58, 0.58, 0.58)), [geos]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const crowns = useRef<(THREE.Mesh | null)[]>([]);
  const drops = useRef<THREE.InstancedMesh>(null);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const qRest = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const vel = useMemo(() => new THREE.Vector3(), []);

  const ice = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#f7fbff",
        transmission: 1,
        thickness: 0.22,
        ior: 1.31,
        roughness: 0.07,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        attenuationColor: new THREE.Color("#e3eef3"),
        attenuationDistance: 0.9,
        specularIntensity: 1,
        envMapIntensity: 2.2,
      }),
    [],
  );
  const core = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        transmission: 0.4,
        roughness: 0.8,
        thickness: 0.15,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }),
    [],
  );
  const crownGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 72, 12, true), []);
  const crownMats = useMemo(
    () =>
      CUBES.map(
        (_, i) =>
          new THREE.ShaderMaterial({
            vertexShader: CROWN_VERT,
            fragmentShader: CROWN_FRAG,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            uniforms: { uC: { value: 0 }, uSeed: { value: i * 1.7 }, uR0: { value: 0.08 }, uH: { value: 0.19 } },
          }),
      ),
    [],
  );
  const dropSeeds = useMemo(
    () =>
      CUBES.map((_, i) =>
        Array.from({ length: DROPS_PER }, (_, j) => ({
          a: (j / DROPS_PER) * Math.PI * 2 + i * 0.7 + Math.random() * 0.3,
          vh: 0.35 + Math.random() * 0.35,
          vy: 1.05 + Math.random() * 0.6,
          s: 0.006 + Math.random() * 0.007,
        })),
      ),
    [],
  );

  useFrame((state) => {
    const p = progress.current.value;
    const t = state.clock.elapsedTime;
    const surf = levelToY(cupLevelAt(p));

    CUBES.forEach((c, i) => {
      const g = groups.current[i];
      if (!g) return;
      const fall = range(p, c.impact - FALL, c.impact);
      const settle = range(p, c.impact, c.impact + SETTLE);
      g.visible = fall > 0;
      if (!g.visible) return;
      const rest = surf + c.dy;
      let y: number;
      if (settle <= 0) {
        // queda acelerando, entrando pelo alto do quadro
        y = THREE.MathUtils.lerp(surf + 1.9, surf - 0.02, fall * fall);
      } else {
        // mergulha e volta boiando
        y = rest - 0.17 * Math.sin(settle * Math.PI) * (1 - 0.35 * settle);
      }
      const bob = settle >= 1 ? Math.sin(t * 1.3 + i * 1.7) * 0.006 : 0;
      g.position.set(c.x, y + bob, c.z);
      e.set(c.rot.x + (1 - fall) * 3.5, c.rot.y + (1 - fall) * 2.5, c.rot.z + (1 - fall) * 1.8);
      q.setFromEuler(e);
      qRest.setFromEuler(c.rot);
      g.quaternion.copy(q).slerp(qRest, Math.min(1, fall * 0.6 + settle * 0.4));

      // coroa
      const k = range(p, c.impact, c.impact + SPLASH);
      const crown = crowns.current[i];
      if (crown) {
        crown.visible = k > 0 && k < 1;
        crown.position.set(c.x, surf, c.z);
        crownMats[i].uniforms.uC.value = k;
      }
    });

    // gotas da coroa: trajetórias balísticas em função do progresso do respingo
    const m = drops.current;
    if (!m) return;
    let n = 0;
    CUBES.forEach((c, i) => {
      const k = range(p, c.impact, c.impact + SPLASH);
      dropSeeds[i].forEach((d) => {
        const T_ = 0.62 * k;
        const r = 0.12 + d.vh * T_;
        const y = surf + d.vy * T_ - 4.9 * T_ * T_;
        const alive = k > 0.02 && k < 1 && y > surf - 0.01;
        if (!alive) {
          dummy.scale.setScalar(0);
        } else {
          dummy.position.set(c.x + Math.cos(d.a) * r, y, c.z + Math.sin(d.a) * r);
          vel.set(Math.cos(d.a) * d.vh, d.vy - 9.8 * T_, Math.sin(d.a) * d.vh).normalize();
          dummy.quaternion.setFromUnitVectors(up, vel);
          dummy.scale.set(d.s, d.s * 1.45, d.s);
        }
        dummy.updateMatrix();
        m.setMatrixAt(n++, dummy.matrix);
      });
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={CUP.position}>
      {CUBES.map((c, i) => (
        <group key={i} ref={(el) => void (groups.current[i] = el)} visible={false}>
          <mesh geometry={geos[c.shape]} material={ice} castShadow />
          <mesh geometry={cores[c.shape]} material={core} />
        </group>
      ))}
      {CUBES.map((_, i) => (
        <mesh
          key={`c${i}`}
          ref={(el) => void (crowns.current[i] = el)}
          geometry={crownGeo}
          material={crownMats[i]}
          visible={false}
          frustumCulled={false}
          renderOrder={3}
        />
      ))}
      <instancedMesh ref={drops} args={[undefined, undefined, CUBES.length * DROPS_PER]} frustumCulled={false} renderOrder={4}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshPhysicalMaterial color="#3a1a08" roughness={0.05} envMapIntensity={2.2} clearcoat={1} clearcoatRoughness={0.03} />
      </instancedMesh>
    </group>
  );
}

useGLTF.preload(URLS, false, true);
