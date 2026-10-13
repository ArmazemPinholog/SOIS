/* Roteiro do filme do hero: cada capítulo ocupa um trecho do scroll (from → to, de 0 a 1)
   e "esfrega" o vídeo correspondente do começo ao fim dentro desse trecho. */

export type Chapter = {
  id: string;
  n: string;
  label: string;
  word: string; // palavra gigante atrás do vídeo
  title: [string, string]; // linha normal + linha em itálico
  lead: string;
  src: string;
  poster: string;
  from: number;
  to: number;
  theme: "creme" | "areia" | "bordo" | "laranja" | "claro" | "cafe";
  /** foco horizontal do recorte no celular (object-position X, em %) */
  focusX: number;
};

export const CHAPTERS: Chapter[] = [
  {
    id: "origem",
    n: "01",
    label: "Origem",
    word: "GRÃO",
    title: ["Escolhido", "grão a grão."],
    lead: "Torra que revela doçura, corpo e aquele dourado de fim de tarde.",
    src: "/video/1-origem.mp4",
    poster: "/video/1-origem.webp",
    from: 0.07,
    to: 0.21,
    theme: "creme",
    focusX: 62,
  },
  {
    id: "moagem",
    n: "02",
    label: "Moagem",
    word: "MOER",
    title: ["Moído", "na hora."],
    lead: "Direto da bica para o coador: o aroma começa aqui, segundos antes da água.",
    src: "/video/2-moagem.mp4",
    poster: "/video/2-moagem.webp",
    from: 0.21,
    to: 0.35,
    theme: "areia",
    focusX: 60,
  },
  {
    id: "agua",
    n: "03",
    label: "Água",
    word: "FLORESCER",
    title: ["Em círculos", "lentos."],
    lead: "A água quente encontra o pó, que floresce, respira e entrega o que tem de melhor.",
    src: "/video/3-agua.mp4",
    poster: "/video/3-agua.webp",
    from: 0.35,
    to: 0.54,
    theme: "bordo",
    focusX: 55,
  },
  {
    id: "serpentina",
    n: "04",
    label: "Serpentina",
    word: "VOLTA",
    title: ["Devagar,", "volta a volta."],
    lead: "O café atravessa o vidro em espiral e chega no ponto certo ao copo.",
    src: "/video/4-serpentina.mp4",
    poster: "/video/4-serpentina.webp",
    from: 0.54,
    to: 0.71,
    theme: "laranja",
    focusX: 42,
  },
  {
    id: "gelo",
    n: "05",
    label: "Gelo",
    word: "GELO",
    title: ["Por último,", "o gelo."],
    lead: "Cubo a cubo, sobre o café recém-passado. O jeito Sóis de atravessar o calor de Goa.",
    src: "/video/5-gelo.mp4",
    poster: "/video/5-gelo.webp",
    from: 0.71,
    to: 0.86,
    theme: "claro",
    focusX: 50,
  },
];

export const FINAL = {
  word: "SOL",
  src: "/video/6-final.mp4",
  poster: "/video/6-final.webp",
  from: 0.86,
  theme: "cafe" as const,
};

/** largura da transição entre dois vídeos (em progresso do scroll) */
export const XFADE = 0.014;

/** trecho do scroll em que os grãos do logo despencam no funil do primeiro vídeo */
export const BEAN_FALL: [number, number] = [0.008, 0.07];
