import type { ReactElement, ReactNode } from 'react';

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }): ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        className={`panel max-h-[92vh] w-full overflow-y-auto p-4 shadow-2xl scrollbar-thin ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export const RARITY_STYLE: Record<string, string> = {
  common: 'border-stone-400/40 text-stone-200',
  uncommon: 'border-emerald-400/60 text-emerald-200',
  rare: 'border-sky-400/70 text-sky-200',
  mythic: 'border-fuchsia-400/80 text-fuchsia-200',
};

export const RARITY_KO: Record<string, string> = { common: '일반', uncommon: '고급', rare: '희귀', mythic: '신화' };
