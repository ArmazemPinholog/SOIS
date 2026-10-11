export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

export const easeOutBack = (x: number) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/** Progresso local (0..1) de uma faixa [start, end] do progresso global. */
export const range = (p: number, start: number, end: number) => clamp01((p - start) / (end - start));
