const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generates a fresh visible run seed like `HWATU-7K2M9A`.
 * This is the only place that reads ambient entropy; all game logic derives from the seed.
 */
export function generateSeed(): string {
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    const t = Date.now();
    for (let i = 0; i < bytes.length; i++) bytes[i] = (t >>> (i * 5)) & 0xff;
  }
  let body = '';
  for (const b of bytes) body += SEED_ALPHABET[b % SEED_ALPHABET.length];
  return `HWATU-${body}`;
}

/** Normalizes user-entered seeds; any non-empty string is a valid seed. */
export function normalizeSeed(input: string): string {
  const trimmed = input.trim().toUpperCase().replace(/\s+/g, '-');
  if (!trimmed) return generateSeed();
  return trimmed.startsWith('HWATU-') ? trimmed : `HWATU-${trimmed}`;
}
