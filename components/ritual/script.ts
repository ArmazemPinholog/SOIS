/* Roteiro do hero "Ritual": um plano-sequência comandado pelo scroll (progresso de 0 a 1).

   abertura  o copo da Sóis gira dentro das letras de "SÓIS"; ao rolar, a câmera atravessa as letras
   01–05     cada tomada ocupa a tela inteira e é "esfregada" pelo scroll, do primeiro ao último quadro
   final     o vídeo encolhe até virar um quadro, com o convite para o cardápio

   Entre uma tomada e outra há uma transição (CUTS): tinta, café real, gota ou onda.
   Tudo o que muda o ritmo do scroll está aqui; os textos também. */

export type Tone = "creme" | "bordo" | "laranja";

export type Stat = {
  label: string;
  /** número que conta com o scroll (ex.: 92) ou texto que se embaralha (ex.: "Média") */
  value: number | string;
  suffix?: string;
};

export type Chapter = {
  id: string;
  n: number;
  label: string;
  /** palavra gigante, em contorno, que se preenche enquanto o capítulo passa */
  word: string;
  title: [string, string];
  lead: string;
  /** índice em VIDEOS */
  video: number;
  from: number;
  to: number;
  tone: Tone;
  /** foco do recorte quando a tela é mais estreita que o vídeo (celular), em fração de 0 a 1 */
  focus: [number, number];
  /** dados do painel lateral — PROVISÓRIOS, confirmar com a Sóis */
  stats: Stat[];
  /** "segure para servir": o scroll para em `at` (fração do capítulo); segurando, o vídeo vai de tA a tB (s) */
  hold?: { at: number; tA: number; tB: number };
};

/** Tomadas, na ordem em que são baixadas. A primeira (o copo girando) abre e fecha o filme. */
export const VIDEOS = [
  "/video/6-final", // 0 — abertura e final (em loop)
  "/video/1-origem", // 1
  "/video/2-moagem", // 2
  "/video/3-agua", // 3
  "/video/4-serpentina", // 4
  "/video/5-gelo", // 5
] as const;

export const LOOP_VIDEO = 0;

export const CHAPTERS: Chapter[] = [
  {
    id: "origem",
    n: 1,
    label: "Origem",
    word: "GRÃO",
    title: ["Escolhido", "grão a grão."],
    lead: "Torra que revela doçura, corpo e aquele dourado de fim de tarde.",
    video: 1,
    from: 0.088,
    to: 0.235,
    tone: "creme",
    focus: [0.6, 0.5],
    stats: [
      { label: "Torra", value: "Média" },
      { label: "Notas", value: "Cacau · caramelo" },
    ],
  },
  {
    id: "moagem",
    n: 2,
    label: "Moagem",
    word: "MOER",
    title: ["Moído", "na hora."],
    lead: "Direto da bica para o coador: o aroma começa aqui, segundos antes da água.",
    video: 2,
    from: 0.235,
    to: 0.375,
    tone: "creme",
    focus: [0.58, 0.5],
    stats: [
      { label: "Dose", value: 20, suffix: "g" },
      { label: "Moagem", value: "Média-fina" },
    ],
  },
  {
    id: "agua",
    n: 3,
    label: "Água",
    word: "FLORESCER",
    title: ["Em círculos", "lentos."],
    lead: "A água quente encontra o pó, que floresce, respira e entrega o que tem de melhor.",
    video: 3,
    from: 0.375,
    to: 0.575,
    tone: "bordo",
    focus: [0.56, 0.5],
    stats: [
      { label: "Água", value: 92, suffix: "°C" },
      { label: "Florada", value: 30, suffix: "s" },
    ],
    hold: { at: 0.32, tA: 2.6, tB: 7.2 },
  },
  {
    id: "serpentina",
    n: 4,
    label: "Serpentina",
    word: "VOLTA",
    title: ["Devagar,", "volta a volta."],
    lead: "O café atravessa o vidro em espiral e chega no ponto certo ao copo.",
    video: 4,
    from: 0.575,
    to: 0.685,
    tone: "laranja",
    focus: [0.6, 0.5],
    stats: [
      { label: "Voltas", value: 4 },
      { label: "Caminho", value: "Vidro" },
    ],
  },
  {
    id: "gelo",
    n: 5,
    label: "Gelo",
    word: "GELO",
    title: ["Por último,", "o gelo."],
    lead: "Cubo a cubo, sobre o café recém-passado. O jeito Sóis de atravessar o calor de Goa.",
    video: 5,
    from: 0.685,
    to: 0.835,
    tone: "creme",
    focus: [0.5, 0.5],
    stats: [
      { label: "Gelo", value: 0, suffix: "°C" },
      { label: "Servido", value: "Na hora" },
    ],
  },
];

export const FINAL = { word: "SOL", video: LOOP_VIDEO, from: 0.835 };

/* ---------- abertura ---------- */
export const INTRO = {
  /** grãos do símbolo explodem em direção à tela */
  burst: [0.004, 0.05] as [number, number],
  /** a câmera atravessa as letras (escala da máscara de 1 a `scale`) */
  zoom: [0.006, 0.074] as [number, number],
  scale: 16,
  /** depois de grande o bastante, a máscara se abre em círculo a partir do centro */
  reveal: [0.042, 0.072] as [number, number],
};

/* ---------- final: o vídeo encolhe até o quadro ---------- */
export const CARD = [0.85, 0.915] as [number, number];

/* ---------- transições ---------- */
export type CutStyle = "ink" | "ripple" | "drip" | "liquid";
export type Cut = {
  at: number;
  /** largura da transição (em progresso do scroll), centrada em `at` */
  width: number;
  style: CutStyle;
  /** ponto de origem da onda (fração da tela, y para baixo) */
  origin?: [number, number];
};

/** a transição i leva SEQUENCE[i] → SEQUENCE[i + 1] */
export const SEQUENCE = [LOOP_VIDEO, 1, 2, 3, 4, 5, LOOP_VIDEO];
export const CUTS: Cut[] = [
  { at: 0.081, width: 0.022, style: "ink" }, // copo → grão
  { at: 0.235, width: 0.026, style: "ink" }, // grão → moagem (mesmo enquadramento: vira um "morph")
  { at: 0.375, width: 0.044, style: "liquid" }, // moagem → água: café de verdade cobre a tela
  { at: 0.575, width: 0.03, style: "drip" }, // água → serpentina: o café escorre de cima
  { at: 0.685, width: 0.03, style: "ripple", origin: [0.5, 0.4] }, // serpentina → gelo: onda no copo
  { at: 0.835, width: 0.026, style: "ink" }, // gelo → copo girando
];

export const STYLE_ID: Record<CutStyle, number> = { ink: 0, ripple: 1, drip: 2, liquid: 3 };

/** quanto tempo segurando para servir tudo */
export const HOLD_SECONDS = 3.2;

/** quanto do café real já cobre a tela em cada lado da emenda "liquid" */
export const LIQUID_HALF = 0.022;
