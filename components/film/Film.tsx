"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import type Lenis from "lenis";
import SoisSymbol from "@/components/SoisSymbol";
import { BEAN_BURST, CAM, CHAPTERS, FINAL, OPEN_OUT, XFADE } from "./chapters";
import ObjectStage, { type ObjectDraw, type ObjectStageHandle } from "./ObjectStage";
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
const THEMES = [...CHAPTERS.map((c) => c.theme), FINAL.theme];
const WORDS = [...CHAPTERS.map((c) => c.word), FINAL.word];
const FROM = [...CHAPTERS.map((c) => c.from), FINAL.from];
const ENTER = [...CHAPTERS.map((c) => c.enter), FINAL.enter];
const HOLD_SECONDS = 3.2; // quanto tempo segurando para servir tudo

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

function setCursor(label: string | null, progress = 0) {
  window.dispatchEvent(new CustomEvent("sois:cursor", { detail: { label, progress } }));
}

export default function Film() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const slot = useRef<HTMLDivElement>(null);
  const objects = useRef<ObjectStageHandle>(null);
  const palm = useRef<HTMLDivElement>(null);
  const holdUi = useRef<HTMLDivElement>(null);
  const prog = useRef({ target: 0, value: 0 });
  const [firstProgress, setFirstProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [beans, setBeans] = useState(false); // logo de grãos em 3D disponível
  const [beansReady, setBeansReady] = useState(false);
  const [beansActive, setBeansActive] = useState(true);
  const onBeansReady = useCallback(() => setBeansReady(true), []);
  const onLoaded = useCallback(() => setLoaded(true), []);

  useEffect(() => setBeans(hasWebGL()), []);

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

  // carrega os vídeos em ordem; o primeiro alimenta o preloader
  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    // H.264 (Safari/iOS) ou VP9 (Chrome, Firefox, Android)
    const probe = document.createElement("video");
    const ext = probe.canPlayType('video/mp4; codecs="avc1.42E01E"') ? ".mp4" : ".webm";
    const attach = (i: number, src: string) => {
      const v = videos.current[i];
      if (v) {
        v.src = src;
        v.load();
      }
    };
    (async () => {
      for (let i = 0; i < SOURCES.length; i++) {
        const file = SOURCES[i].replace(/\.mp4$/, ext);
        try {
          const url = await loadBlob(file, i === 0 ? (k) => alive && setFirstProgress(k) : undefined);
          if (!alive) return URL.revokeObjectURL(url);
          urls.push(url);
          attach(i, url);
        } catch {
          attach(i, file); // sem blob: usa o arquivo direto
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
    if (loaded) stage.current?.classList.add("is-open");
    return () => document.documentElement.classList.remove("is-loading");
  }, [loaded]);

  // scroll → abertura, vídeos, café, tema e textos
  useEffect(() => {
    const el = section.current;
    const st = stage.current;
    if (!el || !st) return;
    const pr = prog.current;
    let theme = "";
    let beansOn = true;
    let active = -2;

    /* "segure para servir": o scroll para num ponto do capítulo e o vídeo só anda segurando */
    const holdChapter = CHAPTERS.findIndex((c) => c.hold);
    const hc = CHAPTERS[holdChapter];
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

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
          onUpdate: (s) => {
            if (!hold.locked) pr.target = s.progress;
          },
        },
      });

      // abertura: letreiro sobe e some enquanto o café sobe; depois a camada da abertura sai por baixo do café
      tl.to(".film__open-mask", { yPercent: -70, autoAlpha: 0, stagger: 0.003, duration: 0.02, ease: "power2.in" }, 0.008);
      tl.to(".film__open-meta", { y: -30, autoAlpha: 0, duration: 0.016 }, 0.004);
      tl.to(".film__hint", { autoAlpha: 0, duration: 0.012 }, 0.002);
      tl.to(".film__opening", { autoAlpha: 0, duration: 0.012 }, OPEN_OUT - 0.012);

      // palavras gigantes: letras sobem, deslizam na horizontal e saem
      const words = gsap.utils.toArray<HTMLElement>(".film__word");
      words.forEach((w, i) => {
        const from = FROM[i];
        const to = i < CHAPTERS.length ? CHAPTERS[i].to : 1.02;
        const letters = w.querySelectorAll(".film__letter");
        // a palavra nova só sobe depois que a anterior saiu (sem sobreposição na passagem)
        const wIn = i === 0 ? from - XFADE : from + 0.002;
        tl.set(w, { autoAlpha: 1 }, wIn);
        tl.fromTo(letters, { yPercent: 105 }, { yPercent: 0, stagger: 0.004, duration: 0.025, ease: "power3.out" }, wIn);
        tl.fromTo(w, { xPercent: 4 }, { xPercent: -4, duration: to - from + XFADE }, from - XFADE);
        if (i < CHAPTERS.length) {
          tl.to(letters, { yPercent: -105, stagger: 0.003, duration: 0.016, ease: "power2.in" }, to - 0.024);
          tl.set(w, { autoAlpha: 0 }, to);
        }
      });

      // textos dos capítulos: número, linhas por máscara, régua e caixa de narração
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
        tl.fromTo(panel.querySelector(".film__lead"), { autoAlpha: 0, y: 16, clipPath: "inset(0 100% 0 0)" }, { autoAlpha: 1, y: 0, clipPath: "inset(0 0% 0 0)", duration: 0.022 }, at + 0.014);
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

    /** tempo do vídeo de um capítulo, levando em conta o trecho "segure para servir" */
    const chapterTime = (i: number, p: number, dur: number) => {
      const c = CHAPTERS[i];
      const end = dur - 0.06;
      const k = clamp01((p - c.from) / (c.to - c.from));
      if (!c.hold) return k * end;
      const tA = Math.min(c.hold.tA, end * 0.4);
      const tB = Math.min(c.hold.tB, end * 0.92);
      const at = c.hold.at;
      // travado, o scroll fica um fio abaixo de `at` (amortecimento): conta como já no ponto
      if (!hold.locked && k < at - 0.004) return (k / at) * tA;
      if (!hold.done) return tA + hold.h * (tB - tA);
      return tB + (Math.max(0, k - at) / (1 - at)) * (end - tB);
    };

    const tick = (time: number, dtMs: number) => {
      const dt = Math.min(dtMs / 1000, 0.1);
      pr.value += (pr.target - pr.value) * (1 - Math.exp(-7 * dt));
      let p = pr.value;

      // ---- segure para servir ----
      if (hc?.hold) {
        const L = lenis();
        if (!L) hold.done = true; // sem scroll suave (movimento reduzido): segue direto
        // só trava para quem chega rolando aos poucos; saltos e cliques no menu passam direto
        const nav = (window as unknown as { __soisNav?: boolean }).__soisNav;
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
        const show = hold.locked;
        if (show !== hold.shown) {
          hold.shown = show;
          st.classList.toggle("is-holding", show);
          setCursor(show ? "Segure para servir" : null);
        }
        if (show) setCursor("Segure para servir", hold.h);
      }

      gsap.set(".film__index-fill", { scaleY: p });
      const on = p < BEAN_BURST[1] + 0.01;
      if (on !== beansOn) {
        beansOn = on;
        setBeansActive(on);
      }

      // tema e capítulo ativo (troca no meio do movimento de câmera)
      let a = -1;
      for (let i = 0; i < FROM.length; i++) if (p >= FROM[i]) a = i;
      const t = THEMES[Math.max(a, 0)];
      if (t !== theme) {
        theme = t;
        st.dataset.theme = t;
      }
      if (a !== active) {
        active = a;
        el.querySelectorAll(".film__index li").forEach((li, i) => li.classList.toggle("is-on", i === a));
      }

      // ---- objetos recortados: a câmera desce pelo aparelho (bica → coador → serpentina → copo) ----
      const W = window.innerWidth;
      const H = window.innerHeight;
      const mobile = W < 821;
      const items: ObjectDraw[] = [];
      videos.current.forEach((v, i) => {
        if (!v) return;
        const isFinal = i === CHAPTERS.length;
        const from = FROM[i];
        const to = isFinal ? 2 : CHAPTERS[i].to;
        // entra subindo por baixo e sai por cima; o primeiro sobe quando o logo se desfaz
        const kin = i === 0 ? smooth(OPEN_OUT - CAM * 2, OPEN_OUT + CAM * 0.5, p) : smooth(from - CAM, from + CAM, p);
        const kout = isFinal ? 0 : smooth(to - CAM, to + CAM, p);
        const visible = kin > 0.0005 && kout < 0.9995;
        if (isFinal) {
          if (visible && v.paused && v.readyState >= 2) v.play().catch(() => {});
          else if (!visible && !v.paused) v.pause();
        } else if (visible && v.duration) {
          const vt = chapterTime(i, p, v.duration);
          if (!v.seeking && Math.abs(v.currentTime - vt) > 1 / 40) v.currentTime = vt;
        }
        if (!visible) return;
        const ease = (k: number) => k * k * (3 - 2 * k);
        // descer: a peça sai por cima e a próxima sobe; dissolver: mesma peça, troca no lugar com leve zoom
        const inDissolve = i > 0 && ENTER[i] === "dissolve";
        const outDissolve = !isFinal && ENTER[i + 1] === "dissolve";
        const dy = (inDissolve ? 0 : (1 - ease(kin)) * H * 1.1) - (outDissolve ? 0 : ease(kout) * H * 1.1);
        // passagem limpa: a cena atual se aproxima e some na 1ª metade; a próxima entra na 2ª (nunca as duas juntas)
        const kIn2 = clamp01(kin * 2 - 1);
        const kOut2 = clamp01(kout * 2);
        const opacity = (inDissolve ? ease(kIn2) : 1) * (outDissolve ? 1 - ease(kOut2) : 1);
        const zoom = (inDissolve ? 0.94 + 0.06 * ease(kIn2) : 1) * (outDissolve ? 1 + 0.08 * ease(kOut2) : 1);
        const h = mobile ? H * 0.58 : H * 1.02;
        const aspect = v.videoWidth ? v.videoWidth / (v.videoHeight / 2) : 16 / 9;
        const fx = (i < CHAPTERS.length ? CHAPTERS[i].focusX : 50) / 100;
        items.push({
          i,
          x: mobile ? W / 2 + (0.5 - fx) * h * aspect : W * 0.63,
          y: (mobile ? H * 0.4 : H * 0.5) + dy,
          h: h * zoom,
          opacity,
        });
      });
      objects.current?.draw(items);
    };
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("wheel", onTry);
      window.removeEventListener("touchmove", onTry);
      if (hold.locked) lenis()?.start();
      setCursor(null);
      ctx.revert();
    };
  }, []);

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

        {/* vídeos de origem (escondidos): o palco WebGL desenha os objetos recortados */}
        <div className="film__sources" aria-hidden="true">
          {SOURCES.map((s, i) => (
            <video
              key={s}
              ref={(v) => {
                videos.current[i] = v;
              }}
              muted
              playsInline
              preload="auto"
              loop={i === CHAPTERS.length}
            />
          ))}
        </div>
        <ObjectStage ref={objects} videos={videos} className="film__objects" />

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
            <a className="btn btn--creme" href="#cardapio" data-cursor="Ver">
              Ver cardápio
            </a>
            <a className="btn btn--ghost-light" href="#visite" data-cursor="Ver">
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

        {/* segure para servir */}
        <div ref={holdUi} className="film__hold" aria-live="polite">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="56" className="film__hold-track" />
            <circle cx="60" cy="60" r="56" className="film__hold-ring" pathLength={1} />
          </svg>
          <span>
            Segure
            <br />
            para servir
          </span>
        </div>

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
