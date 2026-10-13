"use client";

import { useEffect, useRef } from "react";

/* Cursor da marca: um círculo creme que segue o mouse com inércia.
   - sobre links, botões e elementos com data-cursor="Texto" ele cresce e mostra a palavra;
   - o filme pode pedir uma palavra (evento "sois:cursor"), como "Segure", com um anel de progresso.
   Só aparece com mouse (em telas de toque fica o comportamento normal). */
export default function Cursor() {
  const root = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    const lb = label.current;
    if (!el || !lb) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    document.documentElement.classList.add("has-cursor");

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const cur = { ...pos };
    let hoverLabel: string | null = null;
    let filmLabel: string | null = null;
    let shown = "";
    let visible = false;

    const apply = () => {
      const text = filmLabel ?? hoverLabel;
      const mode = filmLabel ? "hold" : hoverLabel !== null ? "hover" : "";
      if (text !== shown || el.dataset.mode !== mode) {
        shown = text ?? "";
        lb.textContent = shown;
        el.dataset.mode = mode;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (!visible) {
        visible = true;
        cur.x = pos.x;
        cur.y = pos.y;
        el.classList.add("is-visible");
      }
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-cursor], a, button");
      hoverLabel = t ? (t.dataset.cursor ?? "") : null;
      apply();
    };
    const onLeave = () => {
      visible = false;
      el.classList.remove("is-visible");
    };
    const onDown = () => el.classList.add("is-down");
    const onUp = () => el.classList.remove("is-down");
    const onFilm = (e: Event) => {
      const d = (e as CustomEvent<{ label: string | null; progress: number }>).detail;
      filmLabel = d.label;
      el.style.setProperty("--p", String(d.progress ?? 0));
      apply();
    };

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      cur.x += (pos.x - cur.x) * 0.2;
      cur.y += (pos.y - cur.y) * 0.2;
      el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`;
    };
    raf = requestAnimationFrame(loop);

    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("sois:cursor", onFilm);
    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("has-cursor");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("sois:cursor", onFilm);
    };
  }, []);

  return (
    <div ref={root} className="cursor" aria-hidden="true">
      <div className="cursor__dot">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="47" pathLength={1} />
        </svg>
        <span ref={label} className="cursor__label" />
      </div>
    </div>
  );
}
