"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import type Lenis from "lenis";
import SoisSymbol from "@/components/SoisSymbol";
import LiquidLayer, { type LiquidHandle } from "@/components/film/LiquidLayer";
import { CARD, CHAPTERS, CUTS, FINAL, HOLD_SECONDS, INTRO, LIQUID_HALF, LOOP_VIDEO, SEQUENCE, SHOT_ZOOM, SHOTS, STYLE_ID, TL_SCALE, TOTAL_VH, VIDEOS, type Chapter, type Shot } from "./script";

/** tempos do roteiro desenhados para a trilha antiga (1250vh), na escala da atual */
const u = (x: number) => x * TL_SCALE;
const HAS_LIQUID = CUTS.some((c) => c.style === "liquid");
import { RitualGL, TitleMask, type GLState } from "./RitualGL";
import { clamp01, easeInOutCubic, easeOutExpo, lerp, loadBlob, magnetic, SCRAMBLE_CHARS, smooth, timecode } from "./fx";
import "./ritual.css";

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

const BeanLogo = dynamic(() => import("@/components/film/BeanLogo"), { ssr: false });

const CREME: [number, number, number] = [0xf8 / 255, 0xea / 255, 0xcf / 255];
const CAFE: [number, number, number] = [0x30 / 255, 0x21 / 255, 0x1a / 255];
const VIDEO_ASPECT = 16 / 9;
const TITLE = "SÓIS";

function hasWebGL2() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

function setCursor(label: string | null, progress = 0) {
  window.dispatchEvent(new CustomEvent("sois:cursor", { detail: { label, progress } }));
}

/* ---------- preloader: símbolo desenhado, contagem e cortina dupla ---------- */
function Preloader({ progress, onDone }: { progress: number; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown((s) => s + (progress * 100 - s) * 0.18));
    return () => cancelAnimationFrame(id);
  });

  useEffect(() => {
    if (label.current) {
      gsap.to(label.current, { duration: 1.4, scrambleText: { text: "Preparando o ritual", chars: SCRAMBLE_CHARS, speed: 0.5 }, delay: 0.2 });
    }
  }, []);

  useEffect(() => {
    const finish = () => {
      if (done.current || !root.current) return;
      done.current = true;
      const r = root.current;
      const tl = gsap.timeline({ onComplete: onDone });
      tl.to(r.querySelectorAll(".rl-loader__content > *"), { y: -24, autoAlpha: 0, stagger: 0.06, duration: 0.5, ease: "power2.in" }, 0.2);
      tl.to(r.querySelector(".rl-loader__panel--a"), { clipPath: "inset(0 0 100% 0)", duration: 1.05, ease: "expo.inOut" }, 0.45);
      tl.to(r.querySelector(".rl-loader__panel--b"), { clipPath: "inset(0 0 100% 0)", duration: 1.05, ease: "expo.inOut" }, 0.6);
    };
    if (progress >= 1 && shown > 99) finish();
    const t = window.setTimeout(finish, 9000); // nunca prender a página
    return () => window.clearTimeout(t);
  }, [progress, shown, onDone]);

  const n = Math.min(100, Math.round(shown));
  return (
    <div ref={root} className="rl-loader" aria-hidden="true">
      <div className="rl-loader__panel rl-loader__panel--b" />
      <div className="rl-loader__panel rl-loader__panel--a">
        <div className="rl-loader__content">
          <SoisSymbol className="rl-loader__symbol" />
          <span className="rl-loader__count">{String(n).padStart(3, "0")}</span>
          <span className="rl-loader__bar">
            <i style={{ transform: `scaleX(${n / 100})` }} />
          </span>
          <span ref={label} className="rl-loader__label">
            &nbsp;
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- número que rola como um odômetro (o palco move a coluna) ---------- */
function Odometer() {
  return (
    <span className="rl-odo" aria-hidden="true">
      <span className="rl-odo__digit">0</span>
      <span className="rl-odo__win">
        <span className="rl-odo__col">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i}>{i}</span>
          ))}
        </span>
      </span>
    </span>
  );
}

/** palavra gigante: contorno embaixo e uma cópia preenchida que é revelada pelo scroll */
function GiantWord({ word, i }: { word: string; i: number }) {
  const letters = (cls: string) => (
    <span className={cls} aria-hidden="true">
      {word.split("").map((l, j) => (
        <span key={j} className="rl-giant__mask">
          <span className="rl-giant__letter">{l}</span>
        </span>
      ))}
    </span>
  );
  return (
    <p className={`rl-giant rl-giant--${i}`} style={{ ["--len" as string]: word.length }}>
      {letters("rl-giant__stroke")}
      {letters("rl-giant__fill")}
    </p>
  );
}

function Stats({ c }: { c: Chapter }) {
  return (
    <dl className={`rl-stats rl-stats--${c.id}`}>
      {c.stats.map((s) => (
        <div key={s.label} className="rl-stat">
          <dt>{s.label}</dt>
          <dd>
            {typeof s.value === "number" ? (
              <>
                <span className="rl-stat__num" data-to={s.value}>
                  0
                </span>
                {s.suffix && <small>{s.suffix}</small>}
              </>
            ) : (
              <span className="rl-stat__text" data-text={s.value}>
                {s.value}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function Ritual() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const logoSlot = useRef<HTMLDivElement>(null);
  const titleSlot = useRef<HTMLDivElement>(null);
  const cardSlot = useRef<HTMLDivElement>(null);
  const liquid = useRef<LiquidHandle>(null);
  const holdUi = useRef<HTMLDivElement>(null);
  const badge = useRef<HTMLAnchorElement>(null);
  const pct = useRef<HTMLSpanElement>(null);
  const tc = useRef<HTMLSpanElement>(null);
  const tag = useRef<HTMLSpanElement>(null);
  const prog = useRef({ target: 0, value: 0 });
  const openAt = useRef(-1);
  const [firstProgress, setFirstProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [beans, setBeans] = useState(false);
  const [beansReady, setBeansReady] = useState(false);
  const [beansActive, setBeansActive] = useState(true);
  const onBeansReady = useCallback(() => setBeansReady(true), []);
  const onLoaded = useCallback(() => setLoaded(true), []);

  useEffect(() => setBeans(hasWebGL2()), []);

  /* vídeos: o copo primeiro (abre o filme e alimenta o preloader), depois as tomadas em ordem */
  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    const probe = document.createElement("video");
    const mp4 = !!probe.canPlayType('video/mp4; codecs="avc1.42E01E"'); // Safari/iOS; os outros preferem VP9
    const ext = mp4 ? ".mp4" : ".webm";
    const attach = (i: number, src: string) => {
      const v = videos.current[i];
      if (!v) return;
      v.src = src;
      v.load();
    };
    (async () => {
      for (let i = 0; i < VIDEOS.length; i++) {
        const file = VIDEOS[i] + ext;
        try {
          const url = await loadBlob(file, mp4 ? "video/mp4" : "video/webm", i === 0 ? (k) => alive && setFirstProgress(k) : undefined);
          if (!alive) return URL.revokeObjectURL(url);
          urls.push(url);
          attach(i, url);
        } catch {
          attach(i, file);
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
    if (loaded) {
      stage.current?.classList.add("is-open");
      openAt.current = gsap.ticker.time;
      if (tag.current) {
        gsap.fromTo(
          tag.current,
          { scrambleText: { text: " " } },
          { duration: 1.6, delay: 1.25, scrambleText: { text: "Dois sóis. Um só café.", chars: SCRAMBLE_CHARS, speed: 0.55, revealDelay: 0.3 } },
        );
      }
    }
    return () => document.documentElement.classList.remove("is-loading");
  }, [loaded]);

  /* ---------- palco: compositor, linha do tempo do scroll e interações ---------- */
  useEffect(() => {
    const el = section.current;
    const st = stage.current;
    const cv = canvas.current;
    const ts = titleSlot.current;
    if (!el || !st || !cv || !ts) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pr = prog.current;
    let alive = true;

    // compositor (sem WebGL: os <video> aparecem direto, com transição por opacidade)
    const family = getComputedStyle(ts).fontFamily;
    const mask = new TitleMask(TITLE, family);
    let gl: RitualGL | null = null;
    try {
      if (RitualGL.supported()) gl = new RitualGL(cv, videos.current, mask, VIDEOS.map((v) => `${v}.webp`));
    } catch {
      gl = null;
    }
    st.classList.toggle("is-gl", !!gl);
    st.classList.toggle("is-nogl", !gl);

    // medidas (relativas ao palco)
    const box = { W: 1, H: 1, card: [0, 0, 1, 1] as [number, number, number, number] };
    const measure = () => {
      const sr = st.getBoundingClientRect();
      box.W = sr.width;
      box.H = sr.height;
      const t = ts.getBoundingClientRect();
      mask.layout(new DOMRect(t.left - sr.left, t.top - sr.top, t.width, t.height), getComputedStyle(ts).fontFamily);
      const c = cardSlot.current?.getBoundingClientRect();
      if (c) box.card = [c.left - sr.left, c.top - sr.top, c.width, c.height];
      gl?.resize();
    };
    measure();
    document.fonts?.load(`600 100px ${family}`).then(() => alive && measure()).catch(() => {});
    document.fonts?.ready.then(() => alive && measure());
    window.addEventListener("resize", measure);

    // mouse (normalizado e em px) e velocidade do scroll
    const mouse = { tx: 0, ty: 0, x: 0, y: 0, px: box.W * 0.5, py: box.H * 0.3, spx: box.W * 0.5, spy: box.H * 0.3 };
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
      mouse.px = e.clientX;
      mouse.py = e.clientY;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const vel = { target: 0, value: 0 };
    const unMagnetic = magnetic(st);

    /* "segure para servir": o scroll para num ponto do capítulo e o vídeo só anda segurando */
    const hc = SHOTS.find((s) => s.hold);
    const lockP = hc?.hold ? hc.from + hc.hold.at * (hc.to - hc.from) : 2;
    const hold = { locked: false, done: false, h: 0, pressing: false, tries: 0, shown: false };
    let prevTarget = 0;
    const lenis = () => (window as unknown as { __lenis?: Lenis }).__lenis;
    const yOf = (p: number) => el.offsetTop + p * (el.offsetHeight - window.innerHeight);
    const press = (on: boolean) => {
      hold.pressing = on && hold.locked;
      st.classList.toggle("is-pressing", hold.pressing);
    };
    const onDown = (e: PointerEvent) => {
      if (!hold.locked) return;
      if ((e.target as HTMLElement).closest("a, button, .nav")) return;
      press(true);
    };
    const onUp = () => press(false);
    const onKey = (e: KeyboardEvent) => {
      if (!hold.locked) return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        press(e.type === "keydown");
      } else if (e.type === "keydown") hold.tries++;
    };
    const onTry = () => {
      if (!hold.locked) return;
      hold.tries++;
      holdUi.current?.classList.remove("is-nudge");
      void holdUi.current?.offsetWidth;
      holdUi.current?.classList.add("is-nudge");
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("wheel", onTry, { passive: true });
    window.addEventListener("touchmove", onTry, { passive: true });

    // a trilha do scroll (sempre existe; a linha do tempo dos textos entra quando as fontes chegam)
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (s) => {
        if (!hold.locked) pr.target = s.progress;
        vel.target = Math.max(-1, Math.min(1, s.getVelocity() / 4200));
      },
    });

    /* ---------- textos guiados pelo scroll ---------- */
    let ctx: gsap.Context | null = null;
    const build = () => {
      if (!alive) return;
      ctx = gsap.context(() => {
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: el, start: "top top", end: "bottom bottom", scrub: 0.7 },
        });

        // abertura sai
        tl.to(".rl-intro__fx", { y: -36, autoAlpha: 0, stagger: u(0.0015), duration: u(0.014), ease: "power2.in" }, u(0.002));
        tl.to(".rl-intro__badge", { scale: 0.6, autoAlpha: 0, duration: u(0.012) }, u(0.002));
        // sem WebGL o símbolo e o título são DOM de verdade; com WebGL já são invisíveis (só marcam o layout)
        tl.to(".rl-intro__logo, .rl-intro__title", { autoAlpha: 0, duration: u(0.03) }, INTRO.zoom[0] + u(0.01));
        tl.fromTo(".rl-veil", { autoAlpha: 0 }, { autoAlpha: 1, duration: u(0.014) }, CHAPTERS[0].from - u(0.006));
        tl.fromTo(".rl-hud", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: u(0.012) }, CHAPTERS[0].from);
        tl.to(".rl-veil, .rl-hud", { autoAlpha: 0, duration: u(0.012) }, FINAL.from + u(0.004));

        // capítulos
        CHAPTERS.forEach((c, i) => {
          const panel = el.querySelector<HTMLElement>(`.rl-panel--${c.id}`);
          const stats = el.querySelector<HTMLElement>(`.rl-stats--${c.id}`);
          const word = el.querySelector<HTMLElement>(`.rl-giant--${i}`);
          if (!panel) return;
          const title = panel.querySelector(".rl-panel__title")!;
          const lead = panel.querySelector(".rl-panel__lead")!;
          const st1 = SplitText.create(title, { type: "lines,chars", mask: "lines", linesClass: "rl-line", charsClass: "rl-char" });
          const st2 = SplitText.create(lead, { type: "words", wordsClass: "rl-word" });
          const at = c.from + (i === 0 ? u(0.004) : u(0.01));
          const out = c.to - u(0.024);

          tl.set(panel, { autoAlpha: 1 }, at - u(0.001));
          tl.fromTo(panel.querySelector(".rl-panel__label"), { autoAlpha: 0, x: -18 }, { autoAlpha: 1, x: 0, duration: u(0.012) }, at);
          tl.fromTo(st1.chars, { yPercent: 118, rotateX: -75 }, { yPercent: 0, rotateX: 0, stagger: u(0.0011), duration: u(0.02), ease: "power3.out" }, at + u(0.002));
          tl.fromTo(lead, { autoAlpha: 0, clipPath: "inset(0 100% 0 0)" }, { autoAlpha: 1, clipPath: "inset(0 0% 0 0)", duration: u(0.016), ease: "power2.inOut" }, at + u(0.008));
          tl.fromTo(st2.words, { opacity: 0.12 }, { opacity: 1, stagger: u(0.0018), duration: u(0.008) }, at + u(0.014));
          tl.to(st1.chars, { yPercent: -118, stagger: u(0.0006), duration: u(0.014), ease: "power2.in" }, out);
          tl.to(panel.querySelectorAll(".rl-panel__label, .rl-panel__lead"), { autoAlpha: 0, y: -14, duration: u(0.012) }, out);
          tl.set(panel, { autoAlpha: 0 }, out + u(0.02));

          if (stats) {
            const items = stats.querySelectorAll(".rl-stat");
            tl.set(stats, { autoAlpha: 1 }, at);
            tl.fromTo(items, { clipPath: "inset(0 0 100% 0)", y: 20 }, { clipPath: "inset(0 0 0% 0)", y: 0, stagger: u(0.004), duration: u(0.016), ease: "power3.out" }, at + u(0.01));
            stats.querySelectorAll<HTMLElement>(".rl-stat__num").forEach((n) => {
              const o = { v: 0 };
              const to = Number(n.dataset.to);
              tl.fromTo(o, { v: 0 }, { v: to, duration: u(0.035), ease: "power2.out", onUpdate: () => (n.textContent = String(Math.round(o.v))) }, at + u(0.012));
            });
            tl.to(items, { autoAlpha: 0, y: -14, stagger: u(0.002), duration: u(0.012) }, out);
            tl.set(stats, { autoAlpha: 0 }, out + u(0.02));
          }

          if (word) {
            const letters = word.querySelectorAll(".rl-giant__letter");
            tl.set(word, { autoAlpha: 1 }, c.from - u(0.004));
            tl.fromTo(letters, { yPercent: 105 }, { yPercent: 0, stagger: u(0.002), duration: u(0.024), ease: "power3.out" }, c.from - u(0.004));
            tl.fromTo(word, { xPercent: 5 }, { xPercent: -5, duration: c.to - c.from }, c.from - u(0.004));
            tl.fromTo(word, { "--fill": "0%" }, { "--fill": "100%", duration: (c.to - c.from) * 0.8 }, c.from + u(0.008));
            tl.to(letters, { yPercent: -105, stagger: u(0.0015), duration: u(0.018), ease: "power2.in" }, c.to - u(0.022));
            tl.set(word, { autoAlpha: 0 }, c.to);
          }
        });

        // final: o vídeo vira quadro, a palavra SOL e o convite
        const fin = el.querySelector<HTMLElement>(".rl-final");
        const sol = el.querySelector<HTMLElement>(`.rl-giant--${CHAPTERS.length}`);
        if (fin) {
          const s = SplitText.create(fin.querySelector(".rl-final__title")!, { type: "lines,chars", mask: "lines", linesClass: "rl-line", charsClass: "rl-char" });
          tl.set(fin, { autoAlpha: 1 }, CARD[0] + u(0.01));
          tl.fromTo(fin.querySelector(".rl-final__kicker"), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: u(0.014) }, CARD[0] + u(0.012));
          tl.fromTo(s.chars, { yPercent: 118, rotateX: -75 }, { yPercent: 0, rotateX: 0, stagger: u(0.0012), duration: u(0.024), ease: "power3.out" }, CARD[0] + u(0.016));
          tl.fromTo(fin.querySelectorAll(".rl-final__lead, .rl-final__ctas"), { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, stagger: u(0.008), duration: u(0.022) }, CARD[0] + u(0.04));
        }
        if (sol) {
          const letters = sol.querySelectorAll(".rl-giant__letter");
          tl.set(sol, { autoAlpha: 1, "--fill": "100%" }, CARD[0]);
          tl.fromTo(letters, { yPercent: 105 }, { yPercent: 0, stagger: u(0.004), duration: u(0.03), ease: "power3.out" }, CARD[0]);
        }
        tl.to({}, { duration: 0.0001 }, 1);
      }, el);
      ScrollTrigger.refresh();
    };
    if (document.fonts?.ready) document.fonts.ready.then(build);
    else build();

    /** tempo do vídeo de uma tomada, levando em conta o trecho "segure para servir" */
    const shotTime = (c: Shot, p: number, dur: number) => {
      const end = dur - 0.06;
      const k = clamp01((p - c.from) / (c.to - c.from));
      if (!c.hold) return k * end;
      const { at, tA, tB } = c.hold;
      if (!hold.locked && k < at - 0.004) return (k / at) * tA;
      if (!hold.done) return tA + hold.h * (tB - tA);
      return tB + (Math.max(0, k - at) / (1 - at)) * (end - tB);
    };

    let active = -1;
    let inView = true;
    const io = new IntersectionObserver(([e]) => (inView = e.isIntersecting), { rootMargin: "20% 0px" });
    io.observe(el);

    const state: GLState = {
      a: LOOP_VIDEO,
      b: LOOP_VIDEO,
      mix: 0,
      style: 0,
      origin: [0.5, 0.5],
      fitA: [0.5, 0.5, 1, VIDEO_ASPECT],
      fitB: [0.5, 0.5, 1, VIDEO_ASPECT],
      rect: [0, 0, 1, 1],
      radius: 0,
      shadow: 0,
      bg: CREME,
      maskOn: true,
      tint: 1,
      reveal: 0,
      revealC: [0, 0],
      mouse: [0, 0],
      vel: 0,
      spot: 1,
      spotC: [0, 0],
      grain: reduced ? 0.025 : 0.05,
    };
    const introK = [0, 0, 0, 0];
    const beansActiveRef = { current: true };
    let badgeRot = 0;

    const fitOf = (vi: number, p: number): [number, number, number, number] => {
      if (vi === LOOP_VIDEO) {
        // na abertura o copo começa mais perto e se afasta enquanto a câmera atravessa as letras
        const z = p < 0.5 ? lerp(1.22, 1.04, smooth(INTRO.zoom[0], INTRO.zoom[1] + u(0.01), p)) : 1.04;
        return [0.5, 0.48, z, VIDEO_ASPECT];
      }
      const i = SHOTS.findIndex((s) => s.video === vi);
      const s = SHOTS[i];
      const k = clamp01((p - s.from) / (s.to - s.from));
      const e = smooth(0, 1, k);
      let x = lerp(s.focus[0][0], s.focus[1][0], e);
      let y = lerp(s.focus[0][1], s.focus[1][1], e);
      let z = SHOT_ZOOM;
      // emenda: o primeiro quadro começa no enquadramento exato do último da tomada anterior
      // (uvAnterior = m · uvEsta + d) e volta devagar ao seu, como um ajuste de câmera
      const prev = SHOTS[i - 1];
      if (s.align && prev) {
        const { m, d } = s.align;
        const w = 1 - smooth(0, 0.45, k);
        x = lerp(x, (prev.focus[1][0] - d[0]) / m, w);
        y = lerp(y, (prev.focus[1][1] - d[1]) / m, w);
        z = lerp(z, SHOT_ZOOM * m, w);
      }
      return [x, y, z, VIDEO_ASPECT];
    };

    const tick = (time: number, dtMs: number) => {
      const dt = Math.min(dtMs / 1000, 0.1);
      pr.value += (pr.target - pr.value) * (1 - Math.exp(-7 * dt));
      let p = pr.value;

      // ---- segure para servir ----
      if (hc?.hold) {
        const L = lenis();
        if (!L) hold.done = true; // sem scroll suave (movimento reduzido): segue direto
        const nav = (window as unknown as { __soisNav?: boolean }).__soisNav;
        // só trava para quem chega rolando aos poucos; saltos e cliques no menu passam direto
        if (!hold.done && !hold.locked && pr.target >= lockP && (nav || prevTarget >= lockP || pr.target - lockP > 0.02)) {
          hold.done = true;
        }
        prevTarget = pr.target;
        if (!hold.done && !hold.locked && pr.target >= lockP) {
          hold.locked = true;
          hold.h = 0;
          hold.tries = 0;
          L?.scrollTo(yOf(lockP), { immediate: true, force: true });
          L?.stop();
          pr.target = lockP;
        }
        if (hold.locked) {
          p = pr.value = Math.min(pr.value, lockP);
          // quem insiste em rolar sem segurar: o café é servido sozinho, mais rápido
          const rate = hold.pressing ? 1 / HOLD_SECONDS : hold.tries >= 6 ? 1 / 1.4 : 0;
          hold.h = Math.min(1, hold.h + dt * rate);
          holdUi.current?.style.setProperty("--hold", String(hold.h));
          if (hold.h >= 1) {
            hold.locked = false;
            hold.done = true;
            press(false);
            L?.start();
          }
        }
        if (!hold.locked && hold.done && pr.target < lockP - 0.01) {
          hold.done = false; // voltou para antes: dá para servir de novo
          hold.h = 0;
        }
        if (hold.locked !== hold.shown) {
          hold.shown = hold.locked;
          st.classList.toggle("is-holding", hold.locked);
          if (!hold.locked) setCursor(null);
        }
        if (hold.locked) setCursor("Segure para servir", hold.h);
      }

      // mouse e velocidade suavizados
      const mk = 1 - Math.exp(-4 * dt);
      mouse.x += (mouse.tx - mouse.x) * mk;
      mouse.y += (mouse.ty - mouse.y) * mk;
      mouse.spx += (mouse.px - mouse.spx) * (1 - Math.exp(-3 * dt));
      mouse.spy += (mouse.py - mouse.spy) * (1 - Math.exp(-3 * dt));
      vel.target *= Math.exp(-5 * dt);
      vel.value += (vel.target - vel.value) * (1 - Math.exp(-8 * dt));
      st.style.setProperty("--vel", vel.value.toFixed(4));

      // grãos 3D só enquanto aparecem
      const beansOn = p < INTRO.burst[1] + u(0.01);
      if (beansOn !== beansActiveRef.current) {
        beansActiveRef.current = beansOn;
        setBeansActive(beansOn);
      }

      // ---- qual tomada, qual transição ----
      let seg = 0;
      CUTS.forEach((c, i) => {
        if (p >= c.at) seg = i + 1;
      });
      let a = SEQUENCE[seg];
      let b = a;
      let mix = 0;
      let style = 0;
      let origin: [number, number] = [0.5, 0.5];
      const lq = { k: 0, flipY: false, flipX: false, visible: false };
      CUTS.forEach((c, i) => {
        if (c.style === "liquid") {
          if (Math.abs(p - c.at) < LIQUID_HALF) {
            lq.visible = true;
            if (p < c.at) lq.k = smooth(c.at - LIQUID_HALF, c.at, p);
            else {
              lq.k = 1 - smooth(c.at, c.at + LIQUID_HALF, p);
              lq.flipY = true;
              lq.flipX = true;
            }
          }
          return;
        }
        const h = c.width / 2;
        if (p > c.at - h && p < c.at + h) {
          a = SEQUENCE[i];
          b = SEQUENCE[i + 1];
          mix = smooth(c.at - h, c.at + h, p);
          style = STYLE_ID[c.style];
          origin = c.origin ?? [0.5, 0.5];
        }
      });
      liquid.current?.set(lq);

      // vídeos: tempo de cada tomada visível e o copo em loop
      const visible = (vi: number) => vi === a || (mix > 0 && vi === b);
      SHOTS.forEach((c) => {
        const v = videos.current[c.video];
        if (!v || !v.duration || !visible(c.video)) return;
        const t = shotTime(c, p, v.duration);
        if (!v.seeking && Math.abs(v.currentTime - t) > 1 / 48) v.currentTime = t;
      });
      const loop = videos.current[LOOP_VIDEO];
      if (loop) {
        const on = visible(LOOP_VIDEO) && inView;
        if (on && loop.paused && loop.readyState >= 2) loop.play().catch(() => {});
        else if (!on && !loop.paused) loop.pause();
      }

      // ---- abertura: letras entram, câmera atravessa ----
      const since = openAt.current < 0 ? -1 : time - openAt.current;
      for (let i = 0; i < introK.length; i++) introK[i] = since < 0 ? 0 : easeOutExpo(clamp01((since - 0.35 - i * 0.12) / 1.3));
      const z = clamp01((p - INTRO.zoom[0]) / (INTRO.zoom[1] - INTRO.zoom[0]));
      const scale = 1 + (INTRO.scale - 1) * Math.pow(z, 2.4);
      const ak = easeInOutCubic(z);
      const anchor: [number, number] = [lerp(mask.pivot[0], box.W / 2, ak), lerp(mask.pivot[1], box.H / 2, ak)];
      const maskOn = p < INTRO.reveal[1] + u(0.003);

      // ---- final: o vídeo encolhe até o quadro ----
      const ck = easeInOutCubic(clamp01((p - CARD[0]) / (CARD[1] - CARD[0])));
      const full: [number, number, number, number] = [0, 0, box.W, box.H];
      const rect = full.map((f, i) => lerp(f, box.card[i], ck)) as [number, number, number, number];

      if (gl && inView) {
        const [bw, bh] = gl.size;
        if (maskOn) mask.draw(bw, bh, gl.dpr, scale, anchor, introK);
        state.a = a;
        state.b = b;
        state.mix = mix;
        state.style = style;
        state.origin = origin;
        state.fitA = fitOf(a, p);
        state.fitB = fitOf(b, p);
        state.rect = rect;
        state.radius = 22 * ck;
        state.shadow = ck;
        state.bg = p > 0.5 ? CAFE : CREME;
        state.maskOn = maskOn;
        state.tint = 1 - smooth(INTRO.zoom[0], INTRO.reveal[0], p);
        state.reveal = smooth(INTRO.reveal[0], INTRO.reveal[1], p);
        state.revealC = anchor;
        state.mouse = reduced ? [0, 0] : [mouse.x, mouse.y];
        state.vel = reduced ? 0 : vel.value;
        state.spot = 1 - smooth(0, INTRO.zoom[0] + u(0.03), p);
        state.spotC = [mouse.spx, mouse.spy];
        state.grain = reduced ? 0.025 : 0.05;
        gl.render(state, time);
      } else if (!gl) {
        videos.current.forEach((v, i) => {
          if (!v) return;
          const o = i === a ? 1 : i === b && mix > 0 ? mix : 0;
          v.style.opacity = String(i === LOOP_VIDEO && p < 0.5 ? o * smooth(INTRO.zoom[0], INTRO.reveal[1], p) : o);
        });
      }

      // ---- HUD ----
      let ch = 0;
      CHAPTERS.forEach((c) => {
        if (p >= c.from - u(0.004)) ch = c.n;
      });
      if (p >= FINAL.from) ch = CHAPTERS.length + 1;
      if (ch !== active) {
        active = ch;
        st.dataset.chapter = String(ch);
        st.dataset.tone = CHAPTERS[ch - 1]?.tone ?? (ch > CHAPTERS.length ? "cafe" : "intro");
        el.querySelectorAll(".rl-hud__index li").forEach((li, i) => li.classList.toggle("is-on", i === ch - 1));
        const col = el.querySelector<HTMLElement>(".rl-odo__col");
        if (col) col.style.transform = `translateY(${-Math.min(CHAPTERS.length, Math.max(1, ch)) * 10}%)`;
        const c = CHAPTERS[ch - 1];
        if (c) {
          const lbl = el.querySelector<HTMLElement>(`.rl-panel--${c.id} .rl-panel__label-text`);
          if (lbl) gsap.to(lbl, { duration: 0.9, scrambleText: { text: c.label, chars: SCRAMBLE_CHARS, speed: 0.6 }, overwrite: true });
          el.querySelectorAll<HTMLElement>(`.rl-stats--${c.id} .rl-stat__text`).forEach((t, j) => {
            gsap.to(t, { duration: 1.1, delay: 0.15 + j * 0.12, scrambleText: { text: t.dataset.text ?? "", chars: SCRAMBLE_CHARS, speed: 0.5 }, overwrite: true });
          });
        }
      }
      if (pct.current) pct.current.textContent = String(Math.round(p * 100)).padStart(3, "0");
      // timecode contínuo: a soma das tomadas já passadas mais o tempo da atual
      if (tc.current) {
        let acc = 0;
        for (const s of SHOTS) {
          const v = videos.current[s.video];
          if (p < s.to) {
            if (p >= s.from) acc += v?.currentTime || 0;
            break;
          }
          acc += v?.duration || 0;
        }
        tc.current.textContent = timecode(acc);
      }
      st.style.setProperty("--p", p.toFixed(4));

      // selo da abertura gira mais rápido quando o scroll acelera
      badgeRot += dt * (14 + Math.abs(vel.value) * 260);
      badge.current?.style.setProperty("--rot", `${badgeRot.toFixed(2)}deg`);
    };
    gsap.ticker.add(tick);

    return () => {
      alive = false;
      gsap.ticker.remove(tick);
      io.disconnect();
      trigger.kill();
      unMagnetic();
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("wheel", onTry);
      window.removeEventListener("touchmove", onTry);
      if (hold.locked) lenis()?.start();
      setCursor(null);
      ctx?.revert();
      gl?.destroy();
    };
  }, []);

  return (
    <section ref={section} className="rl" id="inicio" style={{ height: `${TOTAL_VH}vh` }} aria-label="Sóis Café · Goa — o ritual do café">
      {/* âncoras dos capítulos (o índice e o selo levam até elas) */}
      {CHAPTERS.map((c) => (
        <span key={c.id} id={`ritual-${c.id}`} className="rl-anchor" style={{ top: `calc((100% - 100vh) * ${c.from + u(0.016)})` }} />
      ))}
      <span id="ritual-final" className="rl-anchor" style={{ top: `calc((100% - 100vh) * ${Math.min(1, CARD[1] + u(0.03))})` }} />

      <div ref={stage} className="rl-stage" data-chapter="0" data-tone="intro">
        <div className="rl-videos" aria-hidden="true">
          {VIDEOS.map((src, i) => (
            <video
              key={src}
              ref={(v) => {
                videos.current[i] = v;
              }}
              className="rl-video"
              poster={`${src}.webp`}
              muted
              playsInline
              preload="auto"
              loop={i === LOOP_VIDEO}
            />
          ))}
        </div>
        <canvas ref={canvas} className="rl-gl" aria-hidden="true" />

        <div className="rl-veil" aria-hidden="true">
          <i className="rl-veil__creme" />
          <i className="rl-veil__bordo" />
          <i className="rl-veil__laranja" />
        </div>
        <div className="rl-giants" aria-hidden="true">
          {[...CHAPTERS.map((c) => c.word), FINAL.word].map((w, i) => (
            <GiantWord key={w} word={w} i={i} />
          ))}
        </div>

        {/* abertura */}
        <div className="rl-intro">
          <div ref={logoSlot} className="rl-intro__logo" aria-hidden="true">
            {!beans && <SoisSymbol className="rl-intro__logo-fallback" />}
          </div>
          <h1 className="rl-intro__title">
            <div ref={titleSlot} className="rl-intro__title-slot">
              {TITLE}
            </div>
          </h1>
          <p className="rl-intro__sub rl-intro__fx">
            <span>
              Café <i aria-hidden="true">·</i> Goa
            </span>
          </p>
          <p className="rl-intro__tag rl-intro__fx">
            <span ref={tag}>Dois sóis. Um só café.</span>
          </p>
          <p className="rl-intro__copy rl-intro__fx">
            <span>Cafés especiais, cold brew e a luz de Goa em cada copo. Role e acompanhe o ritual, do grão ao pôr do sol.</span>
          </p>
          <a ref={badge} className="rl-intro__badge" href={`#ritual-${CHAPTERS[0].id}`} data-magnetic="0.45" data-cursor="Rolar" aria-label="Começar o ritual">
            <span className="rl-intro__badge-in">
              <svg viewBox="0 0 200 200" className="rl-intro__badge-ring" aria-hidden="true">
                <defs>
                  <path id="rl-badge-path" d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
                </defs>
                <text>
                  <textPath href="#rl-badge-path" textLength="458" lengthAdjust="spacing">
                    Role para começar · O ritual do café ·
                  </textPath>
                </text>
              </svg>
              <span className="rl-intro__badge-core" data-magnetic-inner>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4v15m0 0-6-6m6 6 6-6" />
                </svg>
              </span>
            </span>
          </a>
        </div>

        {/* capítulos */}
        {CHAPTERS.map((c) => (
          <article key={c.id} className={`rl-panel rl-panel--${c.id}`}>
            <p className="rl-panel__label">
              <span className="rl-panel__label-n">{String(c.n).padStart(2, "0")}</span>
              <span className="rl-panel__label-text">{c.label}</span>
            </p>
            <h2 className="rl-panel__title">
              {c.title[0]}
              <br />
              <em>{c.title[1]}</em>
            </h2>
            <p className="rl-panel__lead">{c.lead}</p>
          </article>
        ))}
        {CHAPTERS.map((c) => (
          <Stats key={c.id} c={c} />
        ))}

        {/* final */}
        <div ref={cardSlot} className="rl-card-slot" aria-hidden="true" />
        <article className="rl-final">
          <p className="rl-final__kicker">Do grão ao pôr do sol</p>
          <h2 className="rl-final__title">
            Seu café,
            <br />
            <em>sob o mesmo sol.</em>
          </h2>
          <p className="rl-final__lead">Cada etapa feita com calma e com o calor de Goa. Agora é a sua vez.</p>
          <div className="rl-final__ctas">
            <a className="btn btn--creme rl-btn" href="#cardapio" data-cursor="Ver" data-magnetic="0.3">
              <span className="rl-roll" data-magnetic-inner>
                <span className="rl-roll__in" data-text="Ver cardápio">
                  Ver cardápio
                </span>
              </span>
            </a>
            <a className="btn btn--ghost-light rl-btn" href="#visite" data-cursor="Ver" data-magnetic="0.3">
              <span className="rl-roll" data-magnetic-inner>
                <span className="rl-roll__in" data-text="Como chegar">
                  Como chegar
                </span>
              </span>
            </a>
          </div>
        </article>

        {/* HUD: capítulo, índice, timecode e progresso */}
        <div className="rl-hud">
          <div className="rl-hud__count">
            <Odometer />
            <span className="rl-hud__of">/ {String(CHAPTERS.length).padStart(2, "0")}</span>
          </div>
          <ol className="rl-hud__index">
            {CHAPTERS.map((c) => (
              <li key={c.id}>
                <a href={`#ritual-${c.id}`} data-cursor="Ir">
                  {c.label}
                </a>
              </li>
            ))}
          </ol>
          <div className="rl-hud__meta" aria-hidden="true">
            <span>
              TC <span ref={tc}>00:00:00</span>
            </span>
            <span>
              <span ref={pct}>000</span>%
            </span>
          </div>
          <span className="rl-hud__bar" aria-hidden="true">
            <i />
          </span>
        </div>

        {/* segure para servir (no toque; com mouse quem pede é o cursor) */}
        <div ref={holdUi} className="rl-hold" aria-live="polite">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="56" className="rl-hold__track" />
            <circle cx="60" cy="60" r="56" className="rl-hold__ring" pathLength={1} />
          </svg>
          <span>
            Segure
            <br />
            para servir
          </span>
        </div>

        {HAS_LIQUID && <LiquidLayer ref={liquid} className="rl-liquid" />}
        {beans && (
          <BeanLogo
            progress={prog}
            ready={loaded && beansReady}
            slot={logoSlot}
            active={beansActive}
            onReady={onBeansReady}
            burst={INTRO.burst}
            repel
          />
        )}

        {!loaded && <Preloader progress={firstProgress} onDone={onLoaded} />}
      </div>
    </section>
  );
}
