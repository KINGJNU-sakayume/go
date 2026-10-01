import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import type { CardView } from '../../game';
import { CardDetail } from './CardDetail';

type HoverFn = (view: CardView | null) => void;
const HoverContext = createContext<HoverFn>(() => {});

export function useCardHover(): HoverFn {
  return useContext(HoverContext);
}

/** Global card tooltip that follows the pointer. */
export function HoverProvider({ children }: { children: ReactNode }): ReactElement {
  const [view, setView] = useState<CardView | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const move = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);
  const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  const left = pos.x + 310 > w ? pos.x - 310 : pos.x + 18;
  const top = Math.min(pos.y + 12, h - 380);
  return (
    <HoverContext.Provider value={setView}>
      {children}
      {view && (
        <div className="panel pointer-events-none fixed z-[100] p-3 shadow-2xl" style={{ left: Math.max(8, left), top: Math.max(8, top) }}>
          <CardDetail view={view} />
        </div>
      )}
    </HoverContext.Provider>
  );
}
