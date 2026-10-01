/**
 * Deterministic seeded RNG (sfc32) with a fully serializable state.
 * Never use Math.random for game logic — derive a stream with `deriveRng`.
 */
export type RngState = [number, number, number, number];

/** cyrb128 string hash → four 32-bit seeds. */
export function hashString(input: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    [this.a, this.b, this.c, this.d] = state;
  }

  static fromSeed(seed: string): Rng {
    const rng = new Rng(hashString(seed));
    // warm up so similar seeds diverge quickly
    for (let i = 0; i < 12; i++) rng.next();
    return rng;
  }

  getState(): RngState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    if (n <= 0) return 0;
    return Math.floor(this.next() * n);
  }

  range(min: number, max: number): number {
    return min + this.int(max - min + 1);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick on empty array');
    return items[this.int(items.length)];
  }

  pickOrUndefined<T>(items: readonly T[]): T | undefined {
    return items.length === 0 ? undefined : items[this.int(items.length)];
  }

  /** Returns a new shuffled array (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Pick n distinct items. */
  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items).slice(0, Math.max(0, n));
  }

  weighted<T>(items: readonly { item: T; weight: number }[]): T {
    const total = items.reduce((s, it) => s + Math.max(0, it.weight), 0);
    if (total <= 0) return items[0].item;
    let roll = this.next() * total;
    for (const it of items) {
      roll -= Math.max(0, it.weight);
      if (roll < 0) return it.item;
    }
    return items[items.length - 1].item;
  }
}

/** Independent RNG stream for one purpose (e.g. stage 3 shuffle, shop at node 7). */
export function deriveRng(seed: string, ...parts: (string | number)[]): Rng {
  return Rng.fromSeed([seed, ...parts].join('::'));
}
