/** Pure, seeded generator for mountain-range silhouettes (no images, no randomness at render time). */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RidgeOptions {
  width?: number;
  height?: number;
  /** Baseline as a fraction of height from the top (bigger = lower on screen). */
  base?: number;
  /** Peak height as a fraction of height. */
  amp?: number;
  /** Horizontal feature size in px for the largest peaks. */
  scale?: number;
}

/** Ridged fractal noise along x gives sharp peaks and soft valleys. */
export function ridgePath(seed: number, opts: RidgeOptions = {}): string {
  const { width = 1600, height = 500, base = 0.62, amp = 0.38, scale = 420 } = opts;
  const rand = mulberry32(seed);
  const lattice = Array.from({ length: 64 }, () => rand());
  const noise = (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const s = f * f * (3 - 2 * f);
    return lattice[i & 63] * (1 - s) + lattice[(i + 1) & 63] * s;
  };
  const ridged = (x: number) => {
    let sum = 0;
    let freq = 1 / scale;
    let a = 1;
    let norm = 0;
    for (let o = 0; o < 4; o++) {
      sum += a * (1 - Math.abs(2 * noise(x * freq + o * 7.3) - 1));
      norm += a;
      a *= 0.5;
      freq *= 2.1;
    }
    return sum / norm;
  };

  const step = 16;
  const pts: string[] = [];
  for (let x = 0; x <= width; x += step) {
    const y = height * (base - amp * Math.pow(ridged(x), 1.6));
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return `M0,${height} L${pts.join(" L")} L${width},${height} Z`;
}
