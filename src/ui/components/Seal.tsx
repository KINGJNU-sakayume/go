import type { ReactElement } from 'react';

/** A carved seal (낙관): a hanja in a stamped square — the game's icon language instead of emoji. */
export function Seal({
  char,
  size = 32,
  tone = 'red',
  round,
  className = '',
}: {
  char: string;
  size?: number;
  tone?: 'red' | 'ink' | 'gold' | 'indigo';
  round?: boolean;
  className?: string;
}): ReactElement {
  const bg = { red: '#b8261c', ink: '#1a1410', gold: '#9a7430', indigo: '#2b3f73' }[tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-black leading-none text-[#fff2e6] ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.58,
        background: bg,
        borderRadius: round ? '50%' : Math.max(2, size * 0.1),
        fontFamily: 'var(--font-serif)',
        boxShadow: 'inset 0 0 0 2px rgba(255,230,210,0.55), inset 0 0 6px rgba(0,0,0,0.35)',
      }}
      aria-hidden
    >
      {char}
    </span>
  );
}
