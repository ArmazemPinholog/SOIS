"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { StoryProgress } from "./StoryScene";
import { range } from "@/components/three/math";

/* Onda de café que atravessa a tela na diagonal (transição entre capítulos, como nas referências).
   É um plano preso à frente da câmera; a faixa líquida tem bordas onduladas, relevo e reflexos. */

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform float uW;
uniform float uTime;
uniform float uAspect;
varying vec2 vUv;
float edgeWave(float y, float k) {
  return 0.07 * sin(y * 7.0 + uTime * 1.6 + k) + 0.035 * sin(y * 17.0 - uTime * 2.3 + k * 2.0) + 0.012 * sin(y * 41.0 + uTime * 3.1 + k);
}
void main() {
  vec2 uv = vUv;
  // coordenada ao longo da diagonal da varredura
  float d = uv.x * 0.8 + (1.0 - uv.y) * 0.35;
  float front = mix(-0.55, 1.75, uW);
  float back = front - 1.25;
  float e1 = front - (d + edgeWave(uv.y, 0.0));
  float e2 = (d + edgeWave(uv.y, 3.0)) - back;
  float inside = min(e1, e2);
  float aa = fwidth(inside) * 1.5;
  float alpha = smoothstep(-aa, aa, inside);
  if (alpha <= 0.001) discard;

  // espessura do líquido: fino (âmbar translúcido) nas bordas, grosso (quase preto) no meio
  float thick = smoothstep(0.0, 0.22, inside);
  vec3 amber = vec3(0.62, 0.27, 0.07);
  vec3 deep = vec3(0.075, 0.03, 0.015);
  vec3 col = mix(amber, deep, pow(thick, 0.6));

  // brilho: fio de luz logo dentro de cada borda + reflexo largo que escorre
  float line1 = exp(-pow((e1 - 0.03) / 0.008, 2.0));
  float line2 = exp(-pow((e2 - 0.045) / 0.012, 2.0)) * 0.6;
  float sheen = smoothstep(0.55, 1.0, sin(d * 5.0 - uv.y * 2.5 + uTime * 0.5)) * 0.10 * thick;
  float caustic = (0.5 + 0.5 * sin(d * 38.0 + uv.y * 11.0 - uTime * 2.2)) * 0.05 * thick;
  col += vec3(1.0, 0.82, 0.58) * (line1 * 0.32 + line2 * 0.2 + sheen) + vec3(0.6, 0.3, 0.1) * caustic;

  float a = alpha * mix(0.82, 1.0, thick);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
  // o canvas usa alfa pré-multiplicado
  gl_FragColor.rgb *= gl_FragColor.a;
}
`;

type Props = { progress: StoryProgress; windows: readonly (readonly [number, number])[] };

function WipePlane({ progress, windows }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const size = useThree((s) => s.size);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        premultipliedAlpha: true,
        depthTest: false,
        depthWrite: false,
        uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 } },
      }),
    [],
  );

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const p = progress.current.value;
    let w = -1;
    for (const [a, b] of windows) {
      const k = range(p, a, b);
      if (k > 0 && k < 1) w = k;
    }
    m.visible = w >= 0;
    if (!m.visible) return;
    mat.uniforms.uW.value = w;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uAspect.value = size.width / size.height;
  });

  // quad em tela cheia (câmera ortográfica padrão de -1..1 no espaço de clip via escala)
  return (
    <mesh ref={mesh} material={mat} frustumCulled={false} visible={false} scale={[size.width, size.height, 1]}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

/** Camada própria (canvas transparente por cima da cena), fora da pós-produção:
    a onda fica nítida e sempre na frente de tudo. */
export default function LiquidWipe({ progress, windows }: Props) {
  return (
    <Canvas
      className="story__wipe"
      orthographic
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 10], zoom: 1 }}
      style={{ pointerEvents: "none" }}
    >
      <WipePlane progress={progress} windows={windows} />
    </Canvas>
  );
}
