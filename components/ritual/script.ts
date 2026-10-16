/* Roteiro do hero "Ritual": um plano-sequência comandado pelo scroll (progresso de 0 a 1).

   abertura  o copo da Sóis gira dentro das letras de "SÓIS"; ao rolar, a câmera atravessa as letras
   01–10     dez tomadas encadeadas sem corte: cada uma começa no último quadro da anterior
             (grão → moagem → chaleira → água → serpentina → gelo → mesa → casa → subida → dois sóis)
   final     o pôr do sol com os dois sóis encolhe até virar um quadro, com o convite para o cardápio

   As tomadas (SHOTS) comandam o vídeo; os capítulos (CHAPTERS) só comandam os textos e podem
   cobrir mais de uma tomada. Entre duas tomadas a emenda é uma fusão curta ("seam"), e o
   enquadramento da tomada nova começa exatamente no da anterior (`align`) e volta ao seu aos poucos.
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
  from: number;
  to: number;
  tone: Tone;
  /** dados do painel lateral — PROVISÓRIOS, confirmar com a Sóis */
  stats: Stat[];
};

export type Shot = {
  /** índice em VIDEOS */
  video: number;
  from: number;
  to: number;
  /** foco do recorte no começo e no fim da tomada (fração de 0 a 1); manda no celular, onde só cabe uma faixa */
  focus: [[number, number], [number, number]];
  /**
   * como o primeiro quadro desta tomada se encaixa no último da anterior (medido nos arquivos):
   * uvAnterior = m · uvEsta + d. Sem isso, a emenda dá um pulinho de enquadramento.
   */
  align?: { m: number; d: [number, number] };
  /** "segure para servir": o scroll para em `at` (fração da tomada); segurando, o vídeo vai de tA a tB (s) */
  hold?: { at: number; tA: number; tB: number };
};

/** altura da trilha do scroll (vh); os tempos abaixo são frações dela */
export const TOTAL_VH = 2200;
/** os efeitos de texto foram desenhados para 1250vh: assim eles mantêm a mesma velocidade na tela */
export const TL_SCALE = 1250 / TOTAL_VH;
const u = (x: number) => x * TL_SCALE;

/** Tomadas, na ordem em que são baixadas. A primeira (o copo girando) abre o filme. */
export const VIDEOS = [
  "/video/6-final", // 0 — abertura (em loop)
  "/video/ritual/01-graos", // 1
  "/video/ritual/02-moagem", // 2
  "/video/ritual/03-chaleira", // 3
  "/video/ritual/04-agua", // 4
  "/video/ritual/05-serpentina", // 5
  "/video/ritual/06-gelo", // 6
  "/video/ritual/07-mesa", // 7
  "/video/ritual/08-casa", // 8
  "/video/ritual/09-subida", // 9
  "/video/ritual/10-por-do-sol", // 10
] as const;

export const LOOP_VIDEO = 0;

/** zoom de base das tomadas: a folga do recorte é o que deixa o `align` funcionar */
export const SHOT_ZOOM = 1.1;

export const SHOTS: Shot[] = [
  { video: 1, from: 0.05, to: 0.114, focus: [[0.47, 0.5], [0.45, 0.5]] },
  { video: 2, from: 0.114, to: 0.172, focus: [[0.45, 0.5], [0.5, 0.5]], align: { m: 1.0375, d: [-0.0187, -0.0576] } },
  { video: 3, from: 0.172, to: 0.278, focus: [[0.5, 0.5], [0.54, 0.5]], hold: { at: 0.3, tA: 2.4, tB: 7.4 } },
  { video: 4, from: 0.278, to: 0.344, focus: [[0.54, 0.5], [0.5, 0.5]] },
  { video: 5, from: 0.344, to: 0.405, focus: [[0.5, 0.5], [0.48, 0.5]], align: { m: 1.0025, d: [-0.0013, -0.0485] } },
  { video: 6, from: 0.405, to: 0.511, focus: [[0.48, 0.5], [0.47, 0.5]] },
  { video: 7, from: 0.511, to: 0.61, focus: [[0.47, 0.5], [0.475, 0.52]] },
  { video: 8, from: 0.61, to: 0.716, focus: [[0.475, 0.52], [0.64, 0.46]] },
  { video: 9, from: 0.716, to: 0.822, focus: [[0.64, 0.46], [0.52, 0.46]], align: { m: 0.995, d: [0.0025, -0.0031] } },
  { video: 10, from: 0.822, to: 0.915, focus: [[0.52, 0.46], [0.5, 0.5]], align: { m: 1.005, d: [-0.0041, 0.0114] } },
];

export const CHAPTERS: Chapter[] = [
  {
    id: "origem",
    n: 1,
    label: "Origem",
    word: "GRÃO",
    title: ["Escolhido", "grão a grão."],
    lead: "Torra que revela doçura, corpo e aquele dourado de fim de tarde.",
    from: 0.05,
    to: 0.114,
    tone: "creme",
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
    from: 0.114,
    to: 0.172,
    tone: "creme",
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
    from: 0.172,
    to: 0.278,
    tone: "bordo",
    stats: [
      { label: "Água", value: 92, suffix: "°C" },
      { label: "Florada", value: 30, suffix: "s" },
    ],
  },
  {
    id: "serpentina",
    n: 4,
    label: "Serpentina",
    word: "VOLTA",
    title: ["Devagar,", "volta a volta."],
    lead: "O café atravessa o vidro em espiral e chega no ponto certo ao copo.",
    from: 0.278,
    to: 0.405,
    tone: "laranja",
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
    from: 0.405,
    to: 0.511,
    tone: "creme",
    stats: [
      { label: "Gelo", value: 0, suffix: "°C" },
      { label: "Servido", value: "Na hora" },
    ],
  },
  {
    id: "mesa",
    n: 6,
    label: "Mesa",
    word: "MESA",
    title: ["Direto", "para a sua mesa."],
    lead: "Ainda gelando, ao lado do cardápio, com a luz da janela e boa conversa.",
    from: 0.511,
    to: 0.61,
    tone: "creme",
    stats: [
      { label: "Luz", value: "Natural" },
      { label: "Ritmo", value: "Sem pressa" },
    ],
  },
  {
    id: "casa",
    n: 7,
    label: "Casa",
    word: "CASA",
    title: ["A casa,", "perto do mar."],
    lead: "Toldos bordô, palmeiras e mesas na calçada, com o mar no fim da rua.",
    from: 0.61,
    to: 0.716,
    tone: "bordo",
    stats: [
      { label: "Onde", value: "Goa" },
      { label: "Mesas", value: "Na calçada" },
    ],
  },
  {
    id: "sol",
    n: 8,
    label: "Pôr do sol",
    word: "DOIS",
    title: ["No fim do dia,", "dois sóis."],
    lead: "Um no céu, outro refletido no mar. E o seu café, gelado, na mão.",
    from: 0.716,
    to: 0.905,
    tone: "laranja",
    stats: [
      { label: "Hora", value: "Fim de tarde" },
      { label: "Vista", value: "Para o mar" },
    ],
  },
];

export const FINAL = { word: "SOL", video: 10, from: 0.905 };

/* ---------- abertura ---------- */
export const INTRO = {
  /** grãos do símbolo explodem em direção à tela */
  burst: [u(0.004), u(0.05)] as [number, number],
  /** a câmera atravessa as letras (escala da máscara de 1 a `scale`) */
  zoom: [u(0.006), u(0.074)] as [number, number],
  scale: 16,
  /** depois de grande o bastante, a máscara se abre em círculo a partir do centro */
  reveal: [u(0.042), u(0.072)] as [number, number],
};

/* ---------- final: o vídeo encolhe até o quadro ---------- */
export const CARD = [0.915, 0.952] as [number, number];

/* ---------- transições ---------- */
export type CutStyle = "ink" | "ripple" | "drip" | "liquid" | "seam";
export type Cut = {
  at: number;
  /** largura da transição (em progresso do scroll), centrada em `at` */
  width: number;
  style: CutStyle;
  /** ponto de origem da onda (fração da tela, y para baixo) */
  origin?: [number, number];
};

/** a transição i leva SEQUENCE[i] → SEQUENCE[i + 1] */
export const SEQUENCE = [LOOP_VIDEO, ...SHOTS.map((s) => s.video)];
export const CUTS: Cut[] = [
  { at: u(0.081), width: u(0.022), style: "ink" }, // copo → grão: a câmera sai das letras para dentro da torre
  // entre as tomadas: fusão curta, com o enquadramento já casado
  ...SHOTS.slice(1).map((s): Cut => ({ at: s.from, width: u(0.008), style: "seam" })),
];

export const STYLE_ID: Record<CutStyle, number> = { ink: 0, ripple: 1, drip: 2, liquid: 3, seam: 4 };

/** quanto tempo segurando para servir tudo */
export const HOLD_SECONDS = 3.2;

/** quanto do café real já cobre a tela em cada lado da emenda "liquid" */
export const LIQUID_HALF = 0.022;
