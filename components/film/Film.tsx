"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import SoisSymbol from "@/components/SoisSymbol";
import { BEAN_BURST, CAM, CHAPTERS, FINAL, OPEN_OUT, XFADE } from "./chapters";
import "./film.css";

gsap.registerPlugin(ScrollTrigger, SplitText);

const BeanLogo = dynamic(() => import("./BeanLogo"), { ssr: false });
const Floaters = dynamic(() => import("./Floaters"), { ssr: false });

function hasWebGL() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

const THEMES = [...CHAPTERS.map((c) => c.theme), FINAL.theme];
const WORDS = CHAPTERS.map((c) => c.word);
const FROM = [...CHAPTERS.map((c) => c.from), FINAL.from];
/** cor de fundo de cada tema (a onda entre as seções pinta com a cor da próxima) */
const THEME_BG: Record<string, string> = {
  creme: "#f8eacf",
  areia: "#ecd3a9",
  claro: "#fcf5e7",
  cafe: "#30211a",
  bordo: "#6a1e1e",
  laranja: "#e0892f",
};
const DROPS = [0.18, 0.34, 0.52, 0.69, 0.83];

/** borda de cima ondulada (viewBox 0–100), subindo de baixo (k=0) até cobrir tudo (k=1) */
function wavePath(k: number, lead: number, amp: number, phase: number) {
  const top = 100 - (k * (100 + amp * 2 + lead)) + lead;
  let d = `M0,${(top + Math.sin(phase) * amp).toFixed(2)}`;
  for (let x = 5; x <= 100; x += 5) d += ` L${x},${(top + Math.sin(phase + x * 0.075) * amp + Math.sin(phase * 1.7 + x * 0.19) * amp * 0.35).toFixed(2)}`;
  return d + " L100,140 L0,140 Z";
}

const BEAN_WIN: [number, number] = [OPEN_OUT - 0.012, CHAPTERS[1].to + 0.01];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const ease = (k: number) => k * k * (3 - 2 * k);

/** Baixa o vídeo inteiro antes de usar: com o arquivo na memória o avanço/retrocesso pelo scroll fica instantâneo. */
async function loadBlob(url: string) {
  const res = await fetch(url);
  const b = await res.blob();
  return URL.createObjectURL(b);
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

/** layout de cada peça (px): centro, altura e largura, no desktop e no celular */
function layout(c: (typeof CHAPTERS)[number], W: number, H: number) {
  const mobile = W < 821;
  const aspect = c.w / c.h;
  let h = (mobile ? c.size[1] : c.size[0]) * H;
  const maxW = mobile ? W * 0.96 : W * 0.54;
  if (h * aspect > maxW) h = maxW / aspect;
  if (c.anchor === "coluna" && !mobile) h = Math.max(h, H * 1.04);
  const x = mobile ? W / 2 : W * c.x;
  // "base": a peça sai por baixo; "coluna": atravessa a tela (no celular fica no meio, com as pontas esfumadas)
  const y = mobile ? (c.anchor === "coluna" ? H * 0.39 : H * 0.63 - h / 2) : c.anchor === "coluna" ? H * 0.5 : H * 1.015 - h / 2;
  return { x, y, h, w: h * aspect };
}

export default function Film() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pieces = useRef<(HTMLDivElement | null)[]>([]);
  const finalVideo = useRef<HTMLVideoElement>(null);
  const wave = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const palm = useRef<HTMLDivElement>(null);
  const prog = useRef({ target: 0, value: 0 });
  const [firstProgress, setFirstProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [beans, setBeans] = useState(false); // WebGL disponível (grãos e gelo em 3D)
  const [beansReady, setBeansReady] = useState(false);
  const [beansActive, setBeansActive] = useState(true);
  const [floatActive, setFloatActive] = useState(false);
  const [mobile, setMobile] = useState(false);
  const onBeansReady = useCallback(() => setBeansReady(true), []);
  const onLoaded = useCallback(() => setLoaded(true), []);

  useEffect(() => {
    setBeans(hasWebGL());
    setMobile(window.innerWidth < 821);
  }, []);

  // sombra de palmeira do site (a mesma em todos os capítulos), gerada uma vez
  useEffect(() => {
    let alive = true;
    import("@/components/three/assets").then((m) => {
      const t = m.createPalmWallTexture();
      const url = (t.image as HTMLCanvasElement).toDataURL("image/webp", 0.82);
      t.dispose();
      if (alive && palm.current) palm.current.style.backgroundImage = `url(${url})`;
    });
    return () => {
      alive = false;
    };
  }, []);

  // pré-carrega as peças (alimentam o preloader); o vídeo final vem depois, sem segurar a abertura
  useEffect(() => {
    let alive = true;
    let url = "";
    const suf = window.innerWidth < 821 ? "-m" : "";
    let done = 0;
    Promise.all(
      CHAPTERS.map(
        (c) =>
          new Promise<void>((res) => {
            const im = new Image();
            im.onload = im.onerror = () => {
              done++;
              if (alive) setFirstProgress(done / CHAPTERS.length);
              res();
            };
            im.src = `/img/maquina/${c.img}${suf}.webp`;
          }),
      ),
    ).then(async () => {
      const probe = document.createElement("video");
      const file = FINAL.src.replace(/\.mp4$/, probe.canPlayType('video/mp4; codecs="avc1.42E01E"') ? ".mp4" : ".webm");
      try {
        url = await loadBlob(file);
      } catch {
        url = file;
      }
      if (!alive) return;
      const v = finalVideo.current;
      if (v) {
        v.src = url;
        v.load();
      }
    });
    return () => {
      alive = false;
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("is-loading", !loaded);
    if (loaded) stage.current?.classList.add("is-open");
    return () => document.documentElement.classList.remove("is-loading");
  }, [loaded]);

  // scroll → abertura, peças, tema e textos
  useEffect(() => {
    const el = section.current;
    const st = stage.current;
    if (!el || !st) return;
    const pr = prog.current;
    let theme = "";
    let beansOn = true;
    let floatOn = false;
    let active = -2;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
          onUpdate: (s) => {
            pr.target = s.progress;
          },
        },
      });

      // abertura: letreiro sobe e some; depois a camada da abertura sai e a primeira peça sobe
      tl.to(".film__open-mask", { yPercent: -70, autoAlpha: 0, stagger: 0.003, duration: 0.02, ease: "power2.in" }, 0.008);
      tl.to(".film__open-meta", { y: -30, autoAlpha: 0, duration: 0.016 }, 0.004);
      tl.to(".film__hint", { autoAlpha: 0, duration: 0.012 }, 0.002);
      tl.to(".film__opening", { autoAlpha: 0, duration: 0.012 }, OPEN_OUT - 0.012);

      // palavras gigantes: letras sobem, deslizam na horizontal e saem
      const words = gsap.utils.toArray<HTMLElement>(".film__word");
      words.forEach((w, i) => {
        const from = FROM[i];
        const to = CHAPTERS[i].to;
        const letters = w.querySelectorAll(".film__letter");
        const wIn = i === 0 ? from - XFADE : from + 0.002;
        tl.set(w, { autoAlpha: 1 }, wIn);
        tl.fromTo(letters, { yPercent: 105 }, { yPercent: 0, stagger: 0.004, duration: 0.025, ease: "power3.out" }, wIn);
        tl.fromTo(w, { xPercent: 4 }, { xPercent: -4, duration: to - from + XFADE }, from - XFADE);
        tl.to(letters, { yPercent: -105, stagger: 0.003, duration: 0.016, ease: "power2.in" }, to - 0.024);
        tl.set(w, { autoAlpha: 0 }, to);
      });

      // textos dos capítulos: número, linhas por máscara e caixa de narração
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
        tl.fromTo(panel.querySelector(".film__lead"), { autoAlpha: 0, y: 16, clipPath: "inset(0 100% 0 0)" }, { autoAlpha: 1, y: 0, clipPath: "inset(0 0% 0 0)", duration: 0.022 }, at + 0.014);
        if (split) tl.to(split.lines, { yPercent: -110, stagger: 0.004, duration: 0.016, ease: "power2.in" }, out);
        tl.to(panel.querySelectorAll(".film__num, .film__lead"), { autoAlpha: 0, duration: 0.012 }, out);
        tl.set(panel, { autoAlpha: 0 }, out + 0.024);
      });

      // final
      const fin = el.querySelector<HTMLElement>(".film__final");
      if (fin) {
        const split = SplitText.create(fin.querySelector(".film__title")!, { type: "lines", mask: "lines", linesClass: "film__line" });
        tl.set(fin, { autoAlpha: 1 }, FINAL.from + 0.012);
        tl.fromTo(split.lines, { yPercent: 110 }, { yPercent: 0, stagger: 0.008, duration: 0.03, ease: "power3.out" }, FINAL.from + 0.012);
        tl.fromTo(fin.querySelectorAll(".film__lead, .film__ctas"), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, stagger: 0.01, duration: 0.025 }, FINAL.from + 0.035);
      }
      tl.to({}, { duration: 0.0001 }, 1);
    }, el);

    const tick = (_time: number, dtMs: number) => {
      const dt = Math.min(dtMs / 1000, 0.1);
      pr.value += (pr.target - pr.value) * (1 - Math.exp(-7 * dt));
      const p = pr.value;

      gsap.set(".film__index-fill", { scaleY: p });
      const on = p < BEAN_BURST[1] + 0.01;
      if (on !== beansOn) {
        beansOn = on;
        setBeansActive(on);
      }
      const fl = (p > BEAN_WIN[0] - 0.01 && p < BEAN_WIN[1] + 0.01);
      if (fl !== floatOn) {
        floatOn = fl;
        setFloatActive(fl);
      }

      // ---- onda entre as seções: o café passa primeiro e a cor da próxima seção sobe atrás ----
      let wi = -1;
      for (let i = 1; i < FROM.length; i++) if (p > FROM[i] - CAM * 1.4 && p < FROM[i] + 0.001) wi = i;
      const wv = wave.current;
      if (wv) {
        if (wi < 0) {
          if (wv.style.visibility !== "hidden") wv.style.visibility = "hidden";
        } else {
          const kw = smooth(FROM[wi] - CAM * 1.4, FROM[wi], p);
          const ph = p * 60;
          wv.style.visibility = "visible";
          wv.querySelector<SVGPathElement>(".film__wave-liquid")!.setAttribute("d", wavePath(kw, 14, 4.5, ph));
          const bgp = wv.querySelector<SVGPathElement>(".film__wave-bg")!;
          bgp.setAttribute("d", wavePath(kw, 0, 2.6, ph + 0.8));
          bgp.style.fill = THEME_BG[THEMES[wi]];
          const top = 100 - kw * (100 + 9 + 14) + 14;
          wv.querySelectorAll<SVGEllipseElement>(".film__drop").forEach((c, j) => {
            const life = Math.sin(clamp01(kw * 1.3 - j * 0.05) * Math.PI);
            c.setAttribute("cx", String(DROPS[j] * 100));
            c.setAttribute("cy", String(top - 3 - life * (6 + j * 2.2)));
            const r = 0.35 + 0.5 * life * ((j % 3) * 0.3 + 0.6);
            c.setAttribute("ry", String(r));
            c.setAttribute("rx", String((r * window.innerHeight) / window.innerWidth));
            c.style.opacity = String(life);
          });
        }
      }

      // tema e capítulo ativo (troca quando a onda termina de cobrir a tela)
      let a = -1;
      for (let i = 0; i < FROM.length; i++) if (p >= FROM[i]) a = i;
      const t = THEMES[Math.max(a, 0)];
      if (t !== theme) {
        theme = t;
        st.dataset.theme = t;
        st.style.backgroundColor = THEME_BG[t];
      }
      if (a !== active) {
        active = a;
        el.querySelectorAll(".film__index li").forEach((li, i) => li.classList.toggle("is-on", i === a));
      }

      // ---- peças: a câmera desce pela máquina; a peça sai por cima e a próxima sobe por baixo ----
      const W = window.innerWidth;
      const H = window.innerHeight;
      CHAPTERS.forEach((c, i) => {
        const node = pieces.current[i];
        if (!node) return;
        const kin = i === 0 ? smooth(OPEN_OUT - CAM * 2, OPEN_OUT + CAM * 0.5, p) : smooth(c.from - CAM, c.from + CAM, p);
        const kout = smooth(c.to - CAM, c.to + CAM, p);
        const visible = kin > 0.0005 && kout < 0.9995;
        if (!visible) {
          if (node.style.visibility !== "hidden") node.style.visibility = "hidden";
          return;
        }
        node.style.visibility = "visible";
        const L = layout(c, W, H);
        // dentro do capítulo: a peça sobe devagar e chega um pouco mais perto (câmera viva)
        const k = clamp01((p - c.from) / (c.to - c.from));
        const drift = (0.5 - k) * H * 0.05;
        // passagem: quem sai sobe e some na 1ª metade; quem entra sobe por baixo na 2ª (nunca as duas inteiras juntas)
        const dy = (1 - ease(kin)) * H * 0.42 - ease(kout) * H * 0.42;
        // a onda de café cobre a peça que sai (ela só some debaixo da onda); a próxima surge depois
        const opacity = (i === 0 ? ease(clamp01(kin * 1.6 - 0.6)) : ease(clamp01((kin - 0.42) * 2))) * (kout < 0.5 ? 1 : 0);
        const scale = (0.94 + 0.06 * ease(kin)) * (1 + 0.035 * k) * (1 + 0.05 * ease(kout));
        node.style.width = `${L.w}px`;
        node.style.height = `${L.h}px`;
        node.style.opacity = String(opacity);
        node.style.transform = `translate3d(${L.x - L.w / 2}px, ${L.y - L.h / 2 + dy + drift}px, 0) scale(${scale})`;
      });

      // ---- final: o gelo cai no café, em tela cheia ----
      const v = finalVideo.current;
      const kf = smooth(FINAL.from - CAM, FINAL.from + CAM * 0.6, p);
      if (v) {
        v.style.opacity = String(kf);
        v.style.visibility = kf > 0.001 ? "visible" : "hidden";
        if (kf > 0.001 && v.duration) {
          const vt = clamp01((p - FINAL.from + CAM) / (1 - FINAL.from + CAM)) * (v.duration - 0.05);
          if (!v.seeking && Math.abs(v.currentTime - vt) > 1 / 40) v.currentTime = vt;
        }
      }
    };
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      ctx.revert();
    };
  }, []);

  const suf = mobile ? "-m" : "";

  return (
    <section ref={section} className="film" id="inicio" aria-label="Sóis Café · Goa — o ritual">
      <div ref={stage} className="film__stage" data-theme="creme">
        <div ref={palm} className="film__palm" aria-hidden="true" />
        <div className="film__grain" aria-hidden="true" />
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

        {/* onda de café entre as seções */}
        <div ref={wave} className="film__wave" aria-hidden="true">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="film-liquid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#7a4a2c" />
                <stop offset="0.25" stopColor="#4a2a1a" />
                <stop offset="1" stopColor="#2b1810" />
              </linearGradient>
            </defs>
            <path className="film__wave-liquid" fill="url(#film-liquid)" />
            <path className="film__wave-bg" />
            {DROPS.map((d) => (
              <ellipse key={d} className="film__drop" rx="0" ry="0" fill="#4a2a1a" />
            ))}
          </svg>
        </div>

        {/* a máquina: uma peça por capítulo, em foto recortada de alta resolução */}
        <div className="film__machine" aria-hidden="true">
          {CHAPTERS.map((c, i) => (
            <div
              key={c.id}
              ref={(d) => {
                pieces.current[i] = d;
              }}
              className={`film__piece film__piece--${c.anchor}`}
            >
              <img src={`/img/maquina/${c.img}${suf}.webp`} alt="" draggable={false} decoding="async" />
              {c.steam && (
                <span className="film__steam" style={{ left: `${c.steam.x * 100}%`, top: `${c.steam.y * 100}%` }}>
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
          ))}
        </div>

        <video ref={finalVideo} className="film__finalvid" muted playsInline preload="auto" aria-hidden="true" />

        {beans && <Floaters progress={prog} active={floatActive} beanWin={BEAN_WIN} />}

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
            <a className="btn btn--bordo" href="#cardapio" data-cursor="Ver">
              Ver cardápio
            </a>
            <a className="btn btn--ghost" href="#visite" data-cursor="Ver">
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

        {/* abertura */}
        <div className="film__opening">
          <div ref={slot} className="film__logo-slot" aria-hidden="true">
            {!beans && <SoisSymbol className="film__logo-fallback" />}
          </div>
          <h1 className="film__open-title" aria-label="Sóis">
            {"SÓIS".split("").map((l, i) => (
              <span key={i} className="film__open-mask" aria-hidden="true">
                <span className="film__open-letter" style={{ ["--i" as string]: i }}>
                  {l}
                </span>
              </span>
            ))}
          </h1>
          <div className="film__open-meta">
            <p className="film__open-sub">
              Café <i aria-hidden="true">·</i> Goa
            </p>
            <p className="film__open-tag">Dois sóis. Um só café.</p>
          </div>
        </div>

        {beans && <BeanLogo progress={prog} ready={loaded && beansReady} slot={slot} active={beansActive} onReady={onBeansReady} />}

        <div className="film__hint" aria-hidden="true">
          <span>Role para começar o ritual</span>
          <span className="film__hint-line" />
        </div>

        {!loaded && <Preloader progress={firstProgress} onDone={onLoaded} />}
      </div>
    </section>
  );
}
