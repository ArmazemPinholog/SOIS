"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SoisSymbol from "./SoisSymbol";

gsap.registerPlugin(ScrollTrigger);

// Sequência gerada a partir do vídeo das cenas 1 + 2 + 3a (ver scripts/extract-frames.sh).
// Ao trocar o vídeo, gere uma pasta nova (hero-v2...) para não pegar cache antigo.
const HERO_SEQUENCE = { folder: "/seq/hero-v1", count: 360 };
const frameSrc = (i: number) =>
  `${HERO_SEQUENCE.folder}/f${String(i + 1).padStart(3, "0")}.webp`;

// Ponto de foco horizontal do recorte em telas estreitas (0 = esquerda, 1 = direita).
// Cena 1: fio de café no terço direito -> grãos -> gelo no centro.
function focusX(frame: number) {
  const t = frame / (HERO_SEQUENCE.count - 1);
  if (t < 0.33) return 0.72;
  if (t < 0.4) return gsap.utils.interpolate(0.72, 0.62, (t - 0.33) / 0.07);
  if (t < 0.62) return 0.62;
  if (t < 0.7) return gsap.utils.interpolate(0.62, 0.5, (t - 0.62) / 0.08);
  return 0.5;
}

export default function HeroSequence() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const images: HTMLImageElement[] = new Array(HERO_SEQUENCE.count);
    const loaded: boolean[] = new Array(HERO_SEQUENCE.count).fill(false);
    const state = { frame: 0 };
    let drawn = -1;
    let cancelled = false;

    const draw = (force = false) => {
      let i = Math.round(state.frame);
      while (i > 0 && !loaded[i]) i--;
      if (!loaded[i] || (i === drawn && !force)) return;
      drawn = i;
      const img = images[i];
      const cw = canvas.width;
      const ch = canvas.height;
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      const x = (cw - w) * focusX(i);
      const y = (ch - h) / 2;
      ctx.drawImage(img, x, y, w, h);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.imageSmoothingQuality = "high";
      draw(true);
    };

    // Carrega o primeiro frame logo; o resto em segundo plano, em ordem, com concorrência limitada.
    const load = (i: number) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          images[i] = img;
          loaded[i] = true;
          if (Math.abs(i - Math.round(state.frame)) < 3 || i === 0) draw(true);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = frameSrc(i);
      });

    (async () => {
      await load(0);
      let next = 1;
      const worker = async () => {
        while (!cancelled && next < HERO_SEQUENCE.count) await load(next++);
      };
      await Promise.all(Array.from({ length: 6 }, worker));
    })();

    resize();
    window.addEventListener("resize", resize);

    const gctx = gsap.context(() => {
      // Entrada do símbolo e do título (ao carregar a página).
      if (!reduced) {
        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
        intro
          .from(".hero .sun-top", { x: -36, y: -24, rotate: -35, svgOrigin: "100 130", opacity: 0, duration: 1.6 }, 0.2)
          .from(".hero .sun-bottom", { x: 36, y: 24, rotate: -35, svgOrigin: "100 130", opacity: 0, duration: 1.6 }, 0.2)
          .from(".hero .sun-arc", { strokeDashoffset: 1, strokeDasharray: 1, duration: 1.4, ease: "power2.inOut" }, 0.3)
          .from(".hero .sun-ray", { strokeDashoffset: 1, strokeDasharray: 1, duration: 0.7, stagger: 0.04 }, 0.8)
          .from(".hero__title span", { yPercent: 110, duration: 1.2, stagger: 0.08, ease: "expo.out" }, 0.6)
          .from(".hero__intro [data-intro]", { y: 20, opacity: 0, duration: 1, stagger: 0.1 }, 1.1)
          .from(".hero__hint, .hero__progress", { opacity: 0, duration: 1 }, 1.6);
      }

      // Linha do tempo controlada pelo scroll (duração total = 1).
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
          onUpdate: (st) => {
            gsap.set(".hero__progress-fill", { scaleY: st.progress });
            const step = st.progress < 0.36 ? 0 : st.progress < 0.66 ? 1 : 2;
            section.querySelectorAll(".hero__step").forEach((el, i) =>
              el.classList.toggle("is-active", i === step),
            );
          },
        },
      });

      tl.to(state, { frame: HERO_SEQUENCE.count - 1, duration: 1, onUpdate: () => draw() }, 0)
        .to(".hero__hint", { opacity: 0, duration: 0.03 }, 0.01)
        .to(".hero__intro", { opacity: 0, y: -80, duration: 0.09, ease: "power1.in" }, 0.2)
        .fromTo(".hero__panel--origem", { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.07, ease: "power2.out" }, 0.39)
        .to(".hero__panel--origem", { autoAlpha: 0, y: -60, duration: 0.07, ease: "power1.in" }, 0.58)
        .fromTo(".hero__panel--gelo", { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.07, ease: "power2.out" }, 0.7)
        .to(".hero__panel--gelo", { autoAlpha: 0, y: -40, duration: 0.05, ease: "power1.in" }, 0.95);
    }, section);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      gctx.revert();
    };
  }, []);

  return (
    <section ref={sectionRef} className="hero" id="inicio" aria-label="Sóis Café · Goa">
      <div className="hero__sticky">
        <canvas ref={canvasRef} className="hero__canvas" aria-hidden="true" />
        <div className="hero__veil" aria-hidden="true" />

        <div className="hero__intro">
          <SoisSymbol className="hero__symbol" />
          <h1 className="hero__title" aria-label="Sóis">
            <span>S</span>
            <span>Ó</span>
            <span>I</span>
            <span>S</span>
          </h1>
          <p className="hero__sub" data-intro>
            Café <i aria-hidden="true">·</i> Goa
          </p>
          <p className="hero__tagline" data-intro>
            Dois sóis. Um só café.
          </p>
          <a className="btn btn--bordo" href="#cardapio" data-intro>
            Ver cardápio
          </a>
        </div>

        <div className="hero__panel hero__panel--origem">
          <p className="kicker">01 — Origem</p>
          <h2 className="display">
            Quatro amigos.
            <br />
            Uma mesma luz.
          </h2>
          <p className="lead">
            Grãos escolhidos a dedo e torrados para revelar doçura, corpo e aquele dourado de fim de tarde.
          </p>
        </div>

        <div className="hero__panel hero__panel--gelo">
          <p className="kicker">02 — Cold brew</p>
          <h2 className="display">
            Gelo, sol
            <br />e café.
          </h2>
          <p className="lead">
            Extraído a frio por horas, servido sobre gelo cristalino. O jeito Sóis de atravessar o calor de Goa.
          </p>
        </div>

        <div className="hero__progress" aria-hidden="true">
          <span className="hero__step is-active">01</span>
          <span className="hero__step">02</span>
          <span className="hero__step">03</span>
          <span className="hero__progress-track">
            <span className="hero__progress-fill" />
          </span>
        </div>

        <div className="hero__hint" aria-hidden="true">
          <span>Role para descobrir</span>
          <span className="hero__hint-line" />
        </div>
      </div>
    </section>
  );
}
