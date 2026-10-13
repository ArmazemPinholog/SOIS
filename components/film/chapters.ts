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
  from: number;
  to: number;
  theme: "creme" | "areia" | "bordo" | "laranja" | "claro" | "cafe";
  /** como a cena entra: a câmera desce pelo aparelho, ou dissolve no lugar quando é a mesma peça */
  enter: "descend" | "dissolve";
  /** foco horizontal do recorte no celular (object-position X, em %) */
  focusX: number;
  /** quadro de detalhe: ponto ampliado do mesmo vídeo (em %) e zoom */
  detail: { x: number; y: number; zoom: number };
  /** "segure para servir": o scroll para em `at` (fração do capítulo); segurando, o vídeo vai de tA a tB (s) */
  hold?: { at: number; tA: number; tB: number };
};

export const CHAPTERS: Chapter[] = [
  {
    id: "origem",
    n: "01",
    label: "Origem",
    word: "GRÃO",
    title: ["Escolhido", "grão a grão."],
    lead: "Torra que revela doçura, corpo e aquele dourado de fim de tarde.",
    src: "/video/obj/1-origem.mp4",
    from: 0.09,
    to: 0.21,
    theme: "creme",
    enter: "descend",
    focusX: 55,
    detail: { x: 60, y: 30, zoom: 2.3 },
  },
  {
    id: "moagem",
    n: "02",
    label: "Moagem",
    word: "MOER",
    title: ["Moído", "na hora."],
    lead: "Direto da bica para o coador: o aroma começa aqui, segundos antes da água.",
    src: "/video/obj/2-moagem.mp4",
    from: 0.21,
    to: 0.35,
    theme: "areia",
    enter: "descend",
    focusX: 50,
    detail: { x: 50, y: 50, zoom: 2.5 },
  },
  {
    id: "agua",
    n: "03",
    label: "Água",
    word: "FLORESCER",
    title: ["Em círculos", "lentos."],
    lead: "A água quente encontra o pó, que floresce, respira e entrega o que tem de melhor.",
    src: "/video/obj/3-agua.mp4",
    from: 0.35,
    to: 0.54,
    theme: "bordo",
    enter: "dissolve",
    focusX: 45,
    detail: { x: 50, y: 55, zoom: 2.7 },
    hold: { at: 0.32, tA: 1.3, tB: 5.2 },
  },
  {
    id: "serpentina",
    n: "04",
    label: "Serpentina",
    word: "VOLTA",
    title: ["Devagar,", "volta a volta."],
    lead: "O café atravessa o vidro em espiral e chega no ponto certo ao copo.",
    src: "/video/obj/4-serpentina.mp4",
    from: 0.54,
    to: 0.71,
    theme: "laranja",
    enter: "dissolve",
    focusX: 45,
    detail: { x: 63, y: 45, zoom: 2.4 },
  },
  {
    id: "gelo",
    n: "05",
    label: "Gelo",
    word: "GELO",
    title: ["Por último,", "o gelo."],
    lead: "Cubo a cubo, sobre o café recém-passado. O jeito Sóis de atravessar o calor de Goa.",
    src: "/video/obj/5-gelo.mp4",
    from: 0.71,
    to: 0.86,
    theme: "claro",
    enter: "dissolve",
    focusX: 50,
    detail: { x: 50, y: 42, zoom: 2.3 },
  },
];

export const FINAL = {
  word: "SOL",
  src: "/video/obj/6-final.mp4",
  from: 0.86,
  theme: "cafe" as const,
  enter: "dissolve" as const,
};

/** largura da transição entre dois vídeos (em progresso do scroll) */
export const XFADE = 0.014;

/* Abertura: os grãos do logo explodem em direção à tela e o primeiro objeto sobe por baixo (OPEN_OUT). */
export const BEAN_BURST: [number, number] = [0.004, 0.048];
export const OPEN_OUT = 0.06;
/** meia-largura do movimento de câmera entre dois capítulos (em progresso do scroll) */
export const CAM = 0.022;
