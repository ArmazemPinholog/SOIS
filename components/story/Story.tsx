"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useProgress } from "@react-three/drei";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import SoisSymbol from "@/components/SoisSymbol";
import HeroSequence from "@/components/HeroSequence";
import type { StoryProgress } from "./StoryScene";
import { T } from "./layout";
import "./story.css";

gsap.registerPlugin(ScrollTrigger, SplitText);

const StoryScene = dynamic(() => import("./StoryScene"), { ssr: false });
const LiquidWipe = dynamic(() => import("./LiquidWipe"), { ssr: false });

/* Capítulos (posição no progresso da seção). Os números batem com a linha do tempo em layout.ts. */
const CHAPTERS = [
  { id: "origem", n: "01", label: "Origem", at: 0.245, out: 0.31 },
  { id: "moagem", n: "02", label: "Moagem", at: 0.335, out: 0.43 },
  { id: "agua", n: "03", label: "Água", at: 0.525, out: 0.62 },
  { id: "serpentina", n: "04", label: "Serpentina", at: 0.635, out: 0.69 },
  { id: "gelo", n: "05", label: "Gelo", at: 0.745, out: 0.865 },
] as const;

type Mode = "checking" | "3d" | "video";

function detectMode(): Mode {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "video";
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return "video";
  } catch {
    return "video";
  }
  return "3d";
}

function Preloader({ onDone }: { onDone: () => void }) {
  const { progress, active } = useProgress();
  const [shown, setShown] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown((s) => s + (progress - s) * 0.18));
    return () => cancelAnimationFrame(id);
  });

  const finish = useRef(() => {
    if (done.current) return;
    done.current = true;
    gsap.timeline({ delay: 0.35, onComplete: onDone }).to(root.current, {
      clipPath: "inset(0 0 100% 0)",
      duration: 1.1,
      ease: "expo.inOut",
    });
  });

  useEffect(() => {
    if (!active && progress >= 100) finish.current();
  }, [active, progress]);

  // segurança: nunca prender a página no carregamento
  useEffect(() => {
    const id = window.setTimeout(() => finish.current(), 9000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div ref={root} className="story__loader" aria-hidden="true">
      <SoisSymbol className="story__loader-symbol" />
      <span className="story__loader-count">{String(Math.round(shown)).padStart(3, "0")}</span>
      <span className="story__loader-label">Preparando o ritual</span>
    </div>
  );
}

export default function Story() {
  const [mode, setMode] = useState<Mode>("checking");
  const [active, setActive] = useState(true);
  const [rich, setRich] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const section = useRef<HTMLElement>(null);
  const progress = useRef({ target: 0, value: 0, velocity: 0 });

  useEffect(() => {
    setMode(detectMode());
    // celular / tela pequena: pós-produção mais leve
    setRich(!window.matchMedia("(max-width: 820px)").matches);
  }, []);

  // pausa o 3D quando a história sai da tela
  useEffect(() => {
    if (mode !== "3d" || !section.current) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: "200px" });
    io.observe(section.current);
    return () => io.disconnect();
  }, [mode]);

  useEffect(() => {
    if (mode !== "3d") return;
    const el = section.current;
    if (!el) return;
    document.documentElement.classList.toggle("is-loading", !loaded);
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.5,
          onUpdate: (st) => {
            progress.current.target = st.progress;
            gsap.set(".story__index-fill", { scaleY: st.progress });
            let current = -1;
            CHAPTERS.forEach((c, i) => {
              if (st.progress >= c.at - 0.02 && st.progress < c.out + 0.02) current = i;
            });
            el.querySelectorAll(".story__index li").forEach((li, i) => li.classList.toggle("is-on", i === current));
          },
        },
      });

      // título SÓIS com letras subindo + símbolo desenhado
      tl.to(".story__intro", { autoAlpha: 0, y: -40, duration: 0.035 }, 0.03);
      tl.to(".story__hint", { autoAlpha: 0, duration: 0.02 }, 0.01);

      const brand = el.querySelector(".story__brand");
      if (brand) {
        tl.fromTo(brand, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, 0.12);
        tl.fromTo(".story__brand-letter", { yPercent: 115 }, { yPercent: 0, stagger: 0.008, duration: 0.04, ease: "power3.out" }, 0.12);
        tl.fromTo(".story__brand-line", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, stagger: 0.01, duration: 0.03, ease: "power2.out" }, 0.16);
        tl.to(".story__brand-letter", { yPercent: -115, stagger: 0.006, duration: 0.03, ease: "power2.in" }, 0.205);
        tl.to(".story__brand-line", { autoAlpha: 0, y: -20, duration: 0.02 }, 0.21);
        tl.set(brand, { autoAlpha: 0 }, 0.24);
      }

      // capítulos: linhas reveladas por máscara, número com contador
      CHAPTERS.forEach((c) => {
        const panel = el.querySelector(`.story__panel--${c.id}`);
        if (!panel) return;
        const title = panel.querySelector(".story__title");
        const split = title ? SplitText.create(title, { type: "lines", mask: "lines", linesClass: "story__line" }) : null;
        tl.set(panel, { autoAlpha: 1 }, c.at - 0.001);
        tl.fromTo(panel.querySelector(".story__num"), { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0, duration: 0.02 }, c.at);
        if (split) tl.fromTo(split.lines, { yPercent: 110 }, { yPercent: 0, stagger: 0.008, duration: 0.03, ease: "power3.out" }, c.at + 0.004);
        tl.fromTo(panel.querySelector(".story__lead"), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.025 }, c.at + 0.02);
        tl.fromTo(panel.querySelector(".story__rule"), { scaleX: 0 }, { scaleX: 1, duration: 0.04, ease: "power2.inOut" }, c.at + 0.008);
        if (split) tl.to(split.lines, { yPercent: -110, stagger: 0.005, duration: 0.02, ease: "power2.in" }, c.out);
        tl.to(panel.querySelectorAll(".story__num, .story__lead, .story__rule"), { autoAlpha: 0, duration: 0.015 }, c.out);
        tl.set(panel, { autoAlpha: 0 }, c.out + 0.03);
      });

      // final
      const fin = el.querySelector(".story__final");
      if (fin) {
        const split = SplitText.create(fin.querySelector(".story__title")!, { type: "lines", mask: "lines", linesClass: "story__line" });
        tl.set(fin, { autoAlpha: 1 }, 0.9);
        tl.fromTo(split.lines, { yPercent: 110 }, { yPercent: 0, stagger: 0.01, duration: 0.035, ease: "power3.out" }, 0.9);
        tl.fromTo(fin.querySelectorAll(".story__lead, .story__ctas"), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, stagger: 0.01, duration: 0.03 }, 0.93);
      }
      tl.to({}, { duration: 0.0001 }, 1);
    }, el);
    return () => ctx.revert();
  }, [mode, loaded]);

  if (mode === "video") return <HeroSequence />;

  return (
    <section ref={section} className="story" id="inicio" aria-label="Sóis Café · Goa — o ritual">
      <div className="story__sticky">
        {mode === "3d" && <StoryScene progress={progress as StoryProgress} active={active} rich={rich} />}
        {mode === "3d" && active && <LiquidWipe progress={progress as StoryProgress} windows={[T.wipe1]} />}
        <div className="story__veil" aria-hidden="true" />
        <div className="story__grain" aria-hidden="true" />

        <div className="story__intro">
          <SoisSymbol className="story__intro-symbol" />
          <h1 className="story__intro-title">SÓIS</h1>
          <p className="story__intro-sub">
            Café <i aria-hidden="true">·</i> Goa
          </p>
          <p className="story__intro-tag">Dois sóis. Um só café.</p>
        </div>

        <div className="story__brand" aria-hidden="true">
          <p className="story__brand-title">
            {"SÓIS".split("").map((l, i) => (
              <span key={i} className="story__brand-mask">
                <span className="story__brand-letter">{l}</span>
              </span>
            ))}
          </p>
          <p className="story__brand-line story__brand-sub">Café · Goa</p>
          <p className="story__brand-line story__brand-tag">Good coffee, bright people, same sun.</p>
        </div>

        <article className="story__panel story__panel--origem">
          <p className="story__num">01 — Origem</p>
          <h2 className="story__title">
            Escolhido
            <br />
            <em>grão a grão.</em>
          </h2>
          <span className="story__rule" />
          <p className="story__lead">Torra que revela doçura, corpo e aquele dourado de fim de tarde.</p>
        </article>

        <article className="story__panel story__panel--moagem">
          <p className="story__num">02 — Moagem</p>
          <h2 className="story__title">
            Moído
            <br />
            <em>na hora.</em>
          </h2>
          <span className="story__rule" />
          <p className="story__lead">Direto da bica para o coador: o aroma começa aqui, segundos antes da água.</p>
        </article>

        <article className="story__panel story__panel--agua">
          <p className="story__num">03 — Água</p>
          <h2 className="story__title">
            Em círculos
            <br />
            <em>lentos.</em>
          </h2>
          <span className="story__rule" />
          <p className="story__lead">O pó floresce, respira e entrega o que tem de melhor.</p>
        </article>

        <article className="story__panel story__panel--serpentina">
          <p className="story__num">04 — Serpentina</p>
          <h2 className="story__title">
            Devagar,
            <br />
            <em>volta a volta.</em>
          </h2>
          <span className="story__rule" />
          <p className="story__lead">O café atravessa o vidro em espiral e chega no ponto certo.</p>
        </article>

        <article className="story__panel story__panel--gelo">
          <p className="story__num">05 — Gelo</p>
          <h2 className="story__title">
            Por último,
            <br />
            <em>o gelo.</em>
          </h2>
          <span className="story__rule" />
          <p className="story__lead">Cubo a cubo, sobre o café recém-passado. O jeito Sóis de atravessar o calor de Goa.</p>
        </article>

        <article className="story__final">
          <h2 className="story__title">
            Seu café,
            <br />
            <em>sob o mesmo sol.</em>
          </h2>
          <p className="story__lead">Do grão ao gelo, cada etapa feita com calma e com o calor de Goa.</p>
          <div className="story__ctas">
            <a className="btn btn--bordo" href="#cardapio">
              Ver cardápio
            </a>
            <a className="btn btn--ghost" href="#visite">
              Como chegar
            </a>
          </div>
        </article>

        <ol className="story__index" aria-hidden="true">
          {CHAPTERS.map((c) => (
            <li key={c.id}>
              <span>{c.n}</span>
              <em>{c.label}</em>
            </li>
          ))}
          <span className="story__index-track">
            <span className="story__index-fill" />
          </span>
        </ol>

        <div className="story__hint" aria-hidden="true">
          <span>Role para começar o ritual</span>
          <span className="story__hint-line" />
        </div>

        {mode === "3d" && !loaded && <Preloader onDone={() => setLoaded(true)} />}
      </div>
    </section>
  );
}
