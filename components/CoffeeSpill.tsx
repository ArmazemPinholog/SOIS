"use client";

import { useEffect, useRef } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { gsap } from "gsap";

gsap.registerPlugin(ScrollTrigger);

/* Café escorrendo pela tela (filmagem real, fundo verde removido e cor ajustada para café),
   avançando com o scroll até cobrir tudo com a cor do cardápio, que entra em seguida.
   Origem: Mixkit, "Chocolate syrup covering a green background" (licença gratuita Mixkit). */

const SRC = { wide: "/video/cafe-escorrendo", tall: "/video/cafe-escorrendo-celular" };
const COVER = 0.86; // a partir daqui a tela já está coberta; o resto do trecho é o texto

export default function CoffeeSpill() {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = root.current;
    const v = video.current;
    if (!el || !v) return;
    let url = "";
    let target = 0;
    let loaded = false;

    const load = async () => {
      if (loaded) return;
      loaded = true;
      const tall = window.innerWidth / window.innerHeight < 0.9;
      const ext = v.canPlayType('video/mp4; codecs="avc1.42E01E"') ? ".mp4" : ".webm";
      const src = (tall ? SRC.tall : SRC.wide) + ext;
      try {
        const res = await fetch(src);
        url = URL.createObjectURL(await res.blob());
        v.src = url;
      } catch {
        v.src = src;
      }
    };

    // só baixa quando a seção estiver chegando
    const io = new IntersectionObserver(([e]) => e.isIntersecting && load(), { rootMargin: "150% 0px" });
    io.observe(el);

    const st = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (s) => {
        target = s.progress;
        el.style.setProperty("--spill", String(s.progress));
      },
    });

    let value = 0;
    const tick = (_t: number, dtMs: number) => {
      value += (target - value) * (1 - Math.exp(-8 * Math.min(dtMs / 1000, 0.1)));
      if (!v.duration || v.seeking) return;
      const time = Math.min(1, value / COVER) * (v.duration - 0.05);
      if (Math.abs(v.currentTime - time) > 1 / 40) v.currentTime = time;
    };
    gsap.ticker.add(tick);

    return () => {
      io.disconnect();
      st.kill();
      gsap.ticker.remove(tick);
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  return (
    <section ref={root} className="spill" aria-hidden="true">
      <div className="spill__stage">
        <video ref={video} className="spill__video" muted playsInline preload="auto" />
        <div className="spill__fill" />
        <p className="spill__word">
          <span>Para</span> <em>beber</em>
        </p>
      </div>
    </section>
  );
}
