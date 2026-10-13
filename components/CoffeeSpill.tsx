"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* Café derramando: um fio cai primeiro, depois o café escorre pela tela inteira em gotas que se fundem
   (filtro "goo" + brilho especular) até cobrir tudo com a cor do cardápio, que entra em seguida. */

type Drip = { x: number; w: number; delay: number; speed: number };

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeDrips(w: number): Drip[] {
  const r = seeded(7);
  const drips: Drip[] = [];
  let x = -20;
  while (x < w + 20) {
    const k = Math.min(1, Math.max(0.62, w / 1200));
    const dw = (46 + r() * 90) * k;
    // as gotas perto do fio central saem primeiro
    const centre = Math.abs(x + dw / 2 - w / 2) / (w / 2);
    drips.push({ x, w: dw, delay: 0.08 + centre * 0.22 + r() * 0.12, speed: 0.9 + r() * 0.8 });
    x += dw * (0.55 + r() * 0.3);
  }
  return drips;
}

export default function CoffeeSpill() {
  const root = useRef<HTMLElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = root.current;
    const s = svg.current;
    if (!el || !s) return;
    const g = s.querySelector<SVGGElement>(".spill__shapes")!;
    let W = 0;
    let H = 0;
    let drips: Drip[] = [];
    let nodes: { body: SVGRectElement; head: SVGCircleElement }[] = [];
    let p = 0;

    const stream = s.querySelector<SVGRectElement>(".spill__stream")!;
    const band = s.querySelector<SVGRectElement>(".spill__band")!;

    const build = () => {
      W = el.clientWidth;
      H = window.innerHeight;
      s.setAttribute("viewBox", `0 0 ${W} ${H}`);
      drips = makeDrips(W);
      nodes.forEach((n) => {
        n.body.remove();
        n.head.remove();
      });
      nodes = drips.map(() => {
        const body = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        const head = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        g.appendChild(body);
        g.appendChild(head);
        return { body, head };
      });
      draw();
    };

    const draw = () => {
      // 1) o fio desce pelo centro
      const k1 = gsap.utils.clamp(0, 1, p / 0.22);
      const sw = Math.max(10, W * 0.012);
      stream.setAttribute("x", String(W / 2 - sw / 2));
      stream.setAttribute("width", String(sw));
      stream.setAttribute("height", String(gsap.parseEase("power2.in")(k1) * (H + 60)));
      // 2) faixa do topo engrossa
      const k3 = gsap.utils.clamp(0, 1, (p - 0.18) / 0.72);
      const bandH = gsap.parseEase("power2.inOut")(k3) * (H + 120);
      band.setAttribute("width", String(W + 40));
      band.setAttribute("height", String(bandH));
      // 3) gotas escorrem com velocidades diferentes
      drips.forEach((d, i) => {
        const t = Math.max(0, p - d.delay) * d.speed * 1.6;
        const len = Math.min(H * 1.4, gsap.parseEase("power1.in")(Math.min(t, 1)) * H * 1.25 + bandH);
        const n = nodes[i];
        n.body.setAttribute("x", String(d.x));
        n.body.setAttribute("width", String(d.w));
        n.body.setAttribute("y", "-40");
        n.body.setAttribute("height", String(Math.max(0, len + 40)));
        n.head.setAttribute("cx", String(d.x + d.w / 2));
        n.head.setAttribute("cy", String(len));
        n.head.setAttribute("r", String(len > 2 ? d.w * 0.62 : 0));
      });
      el.style.setProperty("--spill", String(p));
    };

    build();
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.4,
      onUpdate: (self) => {
        p = self.progress;
        draw();
      },
    });
    const onResize = () => build();
    window.addEventListener("resize", onResize);
    return () => {
      st.kill();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <section ref={root} className="spill" aria-hidden="true">
      <div className="spill__stage">
        <svg ref={svg} className="spill__svg" preserveAspectRatio="none">
          <defs>
            <filter id="spill-goo" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11" result="goo" />
              {/* brilho de líquido: relevo a partir da forma e luz especular quente */}
              <feGaussianBlur in="goo" stdDeviation="6" result="bump" />
              <feSpecularLighting in="bump" surfaceScale="7" specularConstant="1.25" specularExponent="28" lightingColor="#ffd9a6" result="spec">
                <feDistantLight azimuth="235" elevation="38" />
              </feSpecularLighting>
              <feComposite in="spec" in2="goo" operator="in" result="specIn" />
              <feComposite in="goo" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.8" k4="0" />
            </filter>
          </defs>
          <g className="spill__shapes" filter="url(#spill-goo)" fill="#30211a">
            <rect className="spill__band" x="-20" y="-60" />
            <rect className="spill__stream" y="-20" rx="8" />
          </g>
        </svg>
        <p className="spill__word">
          <span>Para</span> <em>beber</em>
        </p>
      </div>
    </section>
  );
}
