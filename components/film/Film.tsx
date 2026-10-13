"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import SoisSymbol from "@/components/SoisSymbol";
import { BEAN_FALL, CHAPTERS, FINAL, XFADE } from "./chapters";
import "./film.css";

gsap.registerPlugin(ScrollTrigger, SplitText);

const BeanLogo = dynamic(() => import("./BeanLogo"), { ssr: false });

function hasWebGL() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

const SOURCES = [...CHAPTERS.map((c) => c.src), FINAL.src];
const POSTERS = [...CHAPTERS.map((c) => c.poster), FINAL.poster];
const THEMES = [...CHAPTERS.map((c) => c.theme), FINAL.theme];
const WORDS = [...CHAPTERS.map((c) => c.word), FINAL.word];
const FROM = [...CHAPTERS.map((c) => c.from), FINAL.from];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Baixa o vídeo inteiro antes de usar: com o arquivo na memória o avanço/retrocesso pelo scroll fica instantâneo. */
async function loadBlob(url: string, onProgress?: (k: number) => void) {
  const res = await fetch(url);
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !total) {
    const b = await res.blob();
    onProgress?.(1);
    return URL.createObjectURL(b);
  }
  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress?.(got / total);
  }
  onProgress?.(1);
  return URL.createObjectURL(new Blob(chunks, { type: "video/mp4" }));
}

function Preloader({ progress, onDone }: { progress: number; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown((s) => s + (progress * 100 - s) * 0.2));
    return () => cancelAnimationFrame(id);
  });

  useEffect(() => {
    const finish = () => {
      if (done.current) return;
      done.current = true;
      gsap.to(root.current, { clipPath: "inset(0 0 100% 0)", duration: 1.1, ease: "expo.inOut", delay: 0.3, onComplete: onDone });
    };
    if (progress >= 1 && shown > 99) finish();
    const t = window.setTimeout(finish, 9000); // nunca prender a página
    return () => window.clearTimeout(t);
  }, [progress, shown, onDone]);

  return (
    <div ref={root} className="film__loader" aria-hidden="true">
      <SoisSymbol className="film__loader-symbol" />
      <span className="film__loader-count">{String(Math.min(100, Math.round(shown))).padStart(3, "0")}</span>
      <span className="film__loader-label">Preparando o ritual</span>
    </div>
  );
}

export default function Film() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const slot = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const prog = useRef({ target: 0, value: 0 });
  const [firstProgress, setFirstProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [beans, setBeans] = useState(false); // logo de grãos em 3D disponível
  const [beansReady, setBeansReady] = useState(false);
  const [beansActive, setBeansActive] = useState(true);
  const onBeansReady = useCallback(() => setBeansReady(true), []);

  useEffect(() => setBeans(hasWebGL()), []);

  // carrega os vídeos em ordem; o primeiro alimenta o preloader
  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    // H.264 (Safari/iOS) ou VP9 (Chrome, Firefox, Android)
    const probe = document.createElement("video");
    const ext = probe.canPlayType('video/mp4; codecs="avc1.42E01E"') ? ".mp4" : ".webm";
    (async () => {
      for (let i = 0; i < SOURCES.length; i++) {
        try {
          const url = await loadBlob(SOURCES[i].replace(/\.mp4$/, ext), i === 0 ? (k) => alive && setFirstProgress(k) : undefined);
          if (!alive) return URL.revokeObjectURL(url);
          urls.push(url);
          const v = videos.current[i];
          if (v) {
            v.src = url;
            v.load();
          }
        } catch {
          // sem rede para o blob: usa o arquivo direto
          const v = videos.current[i];
          if (v) v.src = SOURCES[i].replace(/\.mp4$/, ext);
          if (i === 0 && alive) setFirstProgress(1);
        }
      }
    })();
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("is-loading", !loaded);
    return () => document.documentElement.classList.remove("is-loading");
  }, [loaded]);

  // scroll → vídeos, tema e textos
  useEffect(() => {
    const el = section.current;
    const st = stage.current;
    if (!el || !st) return;
    const pr = prog.current;
    let theme = "";
    let beansOn = true;
    let active = -2;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
          onUpdate: (s) => (pr.target = s.progress),
        },
      });

      // abertura sai, quadro assenta
      tl.to(".film__intro", { autoAlpha: 0, y: -50, duration: 0.03 }, 0.025);
      tl.to(".film__hint", { autoAlpha: 0, duration: 0.015 }, 0.01);
      tl.fromTo(".film__frame", { scale: 0.86, yPercent: 6 }, { scale: 1, yPercent: 0, duration: 0.06, ease: "power2.out" }, 0);
      // no celular o quadro aparece enquanto os grãos caem nele
      if (window.matchMedia("(max-width: 820px)").matches) {
        tl.fromTo(".film__frame", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.035 }, 0.012);
      }

      // palavras gigantes: letras sobem, deslizam na horizontal e saem
      const words = gsap.utils.toArray<HTMLElement>(".film__word");
      words.forEach((w, i) => {
        const from = FROM[i];
        const to = i < CHAPTERS.length ? CHAPTERS[i].to : 1.02;
        const letters = w.querySelectorAll(".film__letter");
        tl.set(w, { autoAlpha: 1 }, from - XFADE);
        tl.fromTo(letters, { yPercent: 105 }, { yPercent: 0, stagger: 0.004, duration: 0.025, ease: "power3.out" }, from - XFADE);
        tl.fromTo(w, { xPercent: 4 }, { xPercent: -4, duration: to - from + XFADE }, from - XFADE);
        if (i < CHAPTERS.length) {
          tl.to(letters, { yPercent: -105, stagger: 0.003, duration: 0.02, ease: "power2.in" }, to - XFADE - 0.004);
          tl.set(w, { autoAlpha: 0 }, to + XFADE);
        }
      });

      // textos dos capítulos: número, linhas por máscara, régua e texto de apoio
      CHAPTERS.forEach((c) => {
        const panel = el.querySelector<HTMLElement>(`.film__panel--${c.id}`);
        if (!panel) return;
        const title = panel.querySelector(".film__title");
        const split = title ? SplitText.create(title, { type: "lines", mask: "lines", linesClass: "film__line" }) : null;
        const at = c.from + 0.008;
        const out = c.to - 0.022;
        tl.set(panel, { autoAlpha: 1 }, at - 0.001);
        tl.fromTo(panel.querySelector(".film__num"), { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0, duration: 0.015 }, at);
        if (split) tl.fromTo(split.lines, { yPercent: 110 }, { yPercent: 0, stagger: 0.006, duration: 0.022, ease: "power3.out" }, at + 0.003);
        tl.fromTo(panel.querySelector(".film__rule"), { scaleX: 0 }, { scaleX: 1, duration: 0.03, ease: "power2.inOut" }, at + 0.006);
        tl.fromTo(panel.querySelector(".film__lead"), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.02 }, at + 0.014);
        if (split) tl.to(split.lines, { yPercent: -110, stagger: 0.004, duration: 0.016, ease: "power2.in" }, out);
        tl.to(panel.querySelectorAll(".film__num, .film__lead, .film__rule"), { autoAlpha: 0, duration: 0.012 }, out);
        tl.set(panel, { autoAlpha: 0 }, out + 0.024);
      });

      // final
      const fin = el.querySelector<HTMLElement>(".film__final");
      if (fin) {
        const split = SplitText.create(fin.querySelector(".film__title")!, { type: "lines", mask: "lines", linesClass: "film__line" });
        tl.set(fin, { autoAlpha: 1 }, FINAL.from + 0.01);
        tl.fromTo(split.lines, { yPercent: 110 }, { yPercent: 0, stagger: 0.008, duration: 0.03, ease: "power3.out" }, FINAL.from + 0.01);
        tl.fromTo(fin.querySelectorAll(".film__lead, .film__ctas"), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, stagger: 0.01, duration: 0.025 }, FINAL.from + 0.035);
      }
      tl.to({}, { duration: 0.0001 }, 1);
    }, el);

    const tick = (_t: number, dtMs: number) => {
      const dt = Math.min(dtMs / 1000, 0.1);
      pr.value += (pr.target - pr.value) * (1 - Math.exp(-7 * dt));
      const p = pr.value;
      gsap.set(".film__index-fill", { scaleY: p });
      const on = p < BEAN_FALL[1] + 0.01;
      if (on !== beansOn) {
        beansOn = on;
        setBeansActive(on);
      }

      // tema e capítulo ativo
      let a = -1;
      for (let i = 0; i < FROM.length; i++) if (p >= FROM[i] - XFADE) a = i;
      const t = THEMES[Math.max(a, 0)];
      if (t !== theme) {
        theme = t;
        st.dataset.theme = t;
      }
      if (a !== active) {
        active = a;
        el.querySelectorAll(".film__index li").forEach((li, i) => li.classList.toggle("is-on", i === a));
      }

      // vídeos: opacidade (transição suave entre tomadas) e posição no tempo
      videos.current.forEach((v, i) => {
        if (!v) return;
        const isFinal = i === CHAPTERS.length;
        const from = FROM[i];
        const to = isFinal ? 2 : CHAPTERS[i].to;
        const fadeIn = i === 0 ? 1 : smooth(from - XFADE, from + XFADE, p);
        const fadeOut = isFinal || i === CHAPTERS.length - 1 ? 1 : 1 - smooth(to + XFADE, to + XFADE * 1.6, p);
        // o vídeo de baixo só some depois que o de cima cobriu tudo
        const o = isFinal ? fadeIn : fadeIn * fadeOut;
        v.style.opacity = String(o);
        v.style.visibility = o > 0.001 ? "visible" : "hidden";

        if (isFinal) {
          if (o > 0.01 && v.paused && v.readyState >= 2) v.play().catch(() => {});
          else if (o <= 0.01 && !v.paused) v.pause();
          return;
        }
        if (!v.duration || o <= 0.001) return;
        const k = clamp01((p - from) / (to - from));
        const time = k * (v.duration - 0.06);
        if (!v.seeking && Math.abs(v.currentTime - time) > 1 / 40) v.currentTime = time;
      });
    };
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      ctx.revert();
    };
  }, []);

  return (
    <section ref={section} className="film" id="inicio" aria-label="Sóis Café · Goa — o ritual">
      <div ref={stage} className={`film__stage${beans ? " has-beans" : ""}`} data-theme="creme">
        <div className="film__words" aria-hidden="true">
          {WORDS.map((w, i) => (
            <p key={w} className={`film__word film__word--${i}`} style={{ ["--len" as string]: w.length }}>
              {w.split("").map((l, j) => (
                <span key={j} className="film__mask">
                  <span className="film__letter">{l}</span>
                </span>
              ))}
            </p>
          ))}
        </div>

        <div ref={frame} className="film__frame">
          {SOURCES.map((s, i) => (
            <video
              key={s}
              ref={(v) => {
                videos.current[i] = v;
              }}
              className="film__video"
              poster={POSTERS[i]}
              muted
              playsInline
              preload="auto"
              loop={i === CHAPTERS.length}
              style={{ ["--fx" as string]: `${i < CHAPTERS.length ? CHAPTERS[i].focusX : 50}%`, opacity: i === 0 ? 1 : 0 }}
              aria-hidden="true"
            />
          ))}
          <div className="film__grain" aria-hidden="true" />
        </div>

        <div ref={slot} className="film__logo-slot" aria-hidden="true" />
        {beans && (
          <BeanLogo progress={prog} ready={loaded && beansReady} slot={slot} frame={frame} active={beansActive} onReady={onBeansReady} />
        )}

        <div className="film__intro">
          <SoisSymbol className="film__intro-symbol" />
          <h1 className="film__intro-title">SÓIS</h1>
          <p className="film__intro-sub">
            Café <i aria-hidden="true">·</i> Goa
          </p>
          <p className="film__intro-tag">Dois sóis. Um só café.</p>
        </div>

        {CHAPTERS.map((c) => (
          <article key={c.id} className={`film__panel film__panel--${c.id}`}>
            <p className="film__num">
              {c.n} — {c.label}
            </p>
            <h2 className="film__title">
              {c.title[0]}
              <br />
              <em>{c.title[1]}</em>
            </h2>
            <span className="film__rule" />
            <p className="film__lead">{c.lead}</p>
          </article>
        ))}

        <article className="film__final">
          <h2 className="film__title">
            Seu café,
            <br />
            <em>sob o mesmo sol.</em>
          </h2>
          <p className="film__lead">Do grão ao gelo, cada etapa feita com calma e com o calor de Goa.</p>
          <div className="film__ctas">
            <a className="btn btn--creme" href="#cardapio">
              Ver cardápio
            </a>
            <a className="btn btn--ghost-light" href="#visite">
              Como chegar
            </a>
          </div>
        </article>

        <ol className="film__index" aria-hidden="true">
          {CHAPTERS.map((c) => (
            <li key={c.id}>
              <span>{c.n}</span>
              <em>{c.label}</em>
            </li>
          ))}
          <span className="film__index-track">
            <span className="film__index-fill" />
          </span>
        </ol>

        <div className="film__hint" aria-hidden="true">
          <span>Role para começar o ritual</span>
          <span className="film__hint-line" />
        </div>

        {!loaded && <Preloader progress={firstProgress} onDone={() => setLoaded(true)} />}
      </div>
    </section>
  );
}
