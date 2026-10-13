/* Roteiro do hero: a câmera desce por uma única máquina de café (funil → bica → coador → chaleira →
   serpentina → copo). Cada capítulo ocupa um trecho do scroll (from → to, de 0 a 1) e mostra uma peça
   em foto recortada de alta resolução, com a palavra gigante atrás e o texto ao lado. */

export type Chapter = {
  id: string;
  n: string;
  label: string;
  word: string; // palavra gigante atrás da peça
  title: [string, string]; // linha normal + linha em itálico
  lead: string;
  img: string; // /img/maquina/<img>.webp (e -m.webp no celular)
  w: number; // tamanho do recorte (px)
  h: number;
  from: number;
  to: number;
  theme: "creme" | "areia" | "bordo" | "laranja" | "claro" | "cafe";
  /** altura da peça em fração da tela (desktop / celular) */
  size: [number, number];
  /** onde a peça encosta: "base" = sai por baixo da tela; "coluna" = atravessa de cima a baixo */
  anchor: "base" | "coluna";
  /** deslocamento horizontal do centro da peça no desktop (fração da largura) */
  x: number;
  /** vapor animado: posição sobre a peça (fração do recorte) */
  steam?: { x: number; y: number };
};

export const CHAPTERS: Chapter[] = [
  {
    id: "origem",
    n: "01",
    label: "Origem",
    word: "GRÃO",
    title: ["Escolhido", "grão a grão."],
    lead: "Torra que revela doçura, corpo e aquele dourado de fim de tarde.",
    img: "1-funil",
    w: 1274,
    h: 1438,
    from: 0.07,
    to: 0.2,
    theme: "creme",
    size: [0.86, 0.5],
    anchor: "base",
    x: 0.66,
  },
  {
    id: "moagem",
    n: "02",
    label: "Moagem",
    word: "MOER",
    title: ["Moído", "na hora."],
    lead: "Direto da bica para a tigela: o aroma começa aqui, segundos antes da água.",
    img: "2-bica",
    w: 1787,
    h: 1438,
    from: 0.2,
    to: 0.34,
    theme: "areia",
    size: [1.04, 0.46],
    anchor: "coluna",
    x: 0.66,
  },
  {
    id: "coador",
    n: "03",
    label: "Coador",
    word: "AROMA",
    title: ["O pó", "descansa."],
    lead: "Moagem média, no coador de cerâmica bordô. Tudo pronto para a primeira água.",
    img: "3-coador",
    w: 1821,
    h: 1438,
    from: 0.34,
    to: 0.47,
    theme: "claro",
    size: [0.84, 0.48],
    anchor: "base",
    x: 0.65,
  },
  {
    id: "agua",
    n: "04",
    label: "Água",
    word: "FLORESCER",
    title: ["Em círculos", "lentos."],
    lead: "A água quente encontra o pó, que floresce, respira e entrega o que tem de melhor.",
    img: "4-chaleira",
    w: 1663,
    h: 1093,
    from: 0.47,
    to: 0.61,
    theme: "creme",
    size: [0.74, 0.44],
    anchor: "base",
    x: 0.65,
    steam: { x: 0.37, y: 0.33 },
  },
  {
    id: "serpentina",
    n: "05",
    label: "Serpentina",
    word: "VOLTA",
    title: ["Devagar,", "volta a volta."],
    lead: "O café atravessa o vidro em espiral e chega no ponto certo ao copo.",
    img: "5-serpentina",
    w: 1247,
    h: 1438,
    from: 0.61,
    to: 0.74,
    theme: "areia",
    size: [1.04, 0.5],
    anchor: "coluna",
    x: 0.66,
  },
  {
    id: "gelo",
    n: "06",
    label: "Gelo",
    word: "GELO",
    title: ["Por último,", "o gelo."],
    lead: "Cubo a cubo, sobre o café recém-passado. O jeito Sóis de atravessar o calor de Goa.",
    img: "6-copo",
    w: 1990,
    h: 1418,
    from: 0.74,
    to: 0.86,
    theme: "claro",
    size: [0.8, 0.44],
    anchor: "base",
    x: 0.65,
  },
];

/** final: o gelo cai no café (vídeo em tela cheia, esfregado pelo scroll) */
export const FINAL = {
  word: "SOL",
  src: "/video/gelo-final.mp4",
  from: 0.86,
  theme: "claro" as const,
};

/** largura da troca de palavra gigante (em progresso do scroll) */
export const XFADE = 0.014;

/* Abertura: os grãos do logo explodem em direção à tela e a primeira peça sobe por baixo (OPEN_OUT). */
export const BEAN_BURST: [number, number] = [0.004, 0.048];
export const OPEN_OUT = 0.06;
/** meia-largura da passagem entre duas peças (em progresso do scroll) */
export const CAM = 0.022;
