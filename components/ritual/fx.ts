import { gsap } from "gsap";

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0 → 1 entre a e b, com início e fim suaves */
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** "00:03:12" (minutos, segundos e quadros a 24 fps) */
export function timecode(seconds: number, fps = 24) {
  const s = Math.max(0, seconds);
  const f = Math.floor((s % 1) * fps);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}:${pad(f)}`;
}

/** Baixa o arquivo inteiro antes de usar: com o vídeo na memória o scroll vai e volta sem travar. */
export async function loadBlob(url: string, type: string, onProgress?: (k: number) => void) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
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
    onProgress?.(Math.min(1, got / total));
  }
  onProgress?.(1);
  return URL.createObjectURL(new Blob(chunks, { type }));
}

/**
 * Botões magnéticos: o elemento com [data-magnetic="força"] é puxado em direção ao cursor
 * e o conteúdo [data-magnetic-inner] vai um pouco mais longe (dá profundidade). Só com mouse.
 */
export function magnetic(root: HTMLElement) {
  if (!window.matchMedia("(pointer: fine)").matches) return () => {};
  const offs: (() => void)[] = [];
  root.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
    const k = Number(el.dataset.magnetic) || 0.35;
    const inner = el.querySelector<HTMLElement>("[data-magnetic-inner]");
    const x = gsap.quickTo(el, "x", { duration: 0.7, ease: "power3.out" });
    const y = gsap.quickTo(el, "y", { duration: 0.7, ease: "power3.out" });
    const ix = inner ? gsap.quickTo(inner, "x", { duration: 0.7, ease: "power3.out" }) : null;
    const iy = inner ? gsap.quickTo(inner, "y", { duration: 0.7, ease: "power3.out" }) : null;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      x(dx * k);
      y(dy * k);
      ix?.(dx * k * 0.5);
      iy?.(dy * k * 0.5);
    };
    const leave = () => {
      x(0);
      y(0);
      ix?.(0);
      iy?.(0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    offs.push(() => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    });
  });
  return () => offs.forEach((f) => f());
}

/** caracteres usados no embaralhar dos textos (inclui os acentos da marca) */
export const SCRAMBLE_CHARS = "SÓISCAFÉGOA·ÃÇ0123456789";
