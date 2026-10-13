"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SoisSymbol from "@/components/SoisSymbol";

gsap.registerPlugin(ScrollTrigger);

/* Abertura do cardápio: o copo no centro e os cartões das bebidas girando em volta dele em 3D,
   guiados pelo scroll. Os cartões de trás passam por trás do copo. */

type Item = { nome: string; tag: string };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export default function MenuOrbit({ items }: { items: Item[] }) {
  const root = useRef<HTMLElement>(null);
  const cards = useRef<(HTMLLIElement | null)[]>([]);
  const cup = useRef<HTMLDivElement>(null);
  const prog = useRef({ t: 0, v: 0 });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const pr = prog.current;
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (s) => {
        pr.t = s.progress;
      },
    });
    const n = items.length;
    const tick = (_: number, dtMs: number) => {
      const dt = Math.min(dtMs / 1000, 0.1);
      pr.v += (pr.t - pr.v) * (1 - Math.exp(-6 * dt));
      const p = pr.v;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const mobile = W < 821;
      const rx = mobile ? W * 0.42 : Math.min(W * 0.36, 620);
      const ry = mobile ? H * 0.07 : H * 0.11;
      const enter = clamp01(p / 0.22); // os cartões chegam de fora
      const k = enter * enter * (3 - 2 * enter);
      const spin = p * Math.PI * 2.2 + performance.now() * 0.00004;
      cards.current.forEach((c, i) => {
        if (!c) return;
        const a = spin + (i / n) * Math.PI * 2;
        const depth = Math.cos(a); // 1 = frente
        const x = Math.sin(a) * rx * (0.6 + 0.4 * k) + (1 - k) * (i % 2 ? 1 : -1) * W * 0.6;
        const y = -depth * ry + Math.sin(a * 2 + i) * 10 + (1 - k) * (i - n / 2) * 60;
        const s = (0.72 + 0.28 * (depth * 0.5 + 0.5)) * (mobile ? 0.78 : 1);
        c.style.transform = `translate3d(${x}px, ${y}px, 0) rotateY(${-Math.sin(a) * 38}deg) rotateZ(${Math.sin(a) * -6}deg) scale(${s})`;
        c.style.zIndex = String(depth > 0 ? 3 : 1);
        c.style.opacity = String(k * (0.45 + 0.55 * (depth * 0.5 + 0.5)));
        c.style.filter = depth < -0.2 ? `blur(${(-depth - 0.2) * 3}px)` : "none";
      });
      if (cup.current) cup.current.style.transform = `translate(-50%, -50%) translateY(${(0.5 - p) * 40}px) scale(${0.92 + 0.08 * k})`;
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      st.kill();
    };
  }, [items.length]);

  return (
    <section ref={root} className="orbit" aria-label="Cardápio — destaques">
      <div className="orbit__stage">
        <p className="orbit__word" aria-hidden="true">
          PROVE
        </p>
        <div className="orbit__head">
          <p className="kicker kicker--light">Destaques da casa</p>
          <h2 className="display display--light">
            Prove o <em>sol.</em>
          </h2>
        </div>
        <div ref={cup} className="orbit__cup">
          <img src="/img/maquina/6-copo.webp" alt="Copo bordô da Sóis com café gelado" />
        </div>
        <ul className="orbit__cards">
          {items.map((it, i) => (
            <li
              key={it.nome}
              ref={(d) => {
                cards.current[i] = d;
              }}
              className="orbit__card"
            >
              <SoisSymbol className="orbit__sun" />
              <span>{it.tag}</span>
              <strong>{it.nome}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
