import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * FLIP card motion: every element with `data-flip="<uid>"` inside `root` animates from where it was
 * on the previous render to where it is now (hand → field → captured piles). Elements that just
 * appeared start on the stock pile (`data-flip="stock"`) and flip face-up on the way.
 * Returns how many cards moved into the captured piles this render (for the "탁" sound).
 */
export function useFlip(root: RefObject<HTMLElement | null>, deps: unknown[], opts: { enabled: boolean; onCapture?: (n: number) => void }): void {
  const prev = useRef<Map<string, DOMRect>>(new Map());
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-flip]'));
    const next = new Map<string, DOMRect>();
    for (const n of nodes) next.set(n.dataset.flip!, n.getBoundingClientRect());
    const stock = next.get('stock');
    let captured = 0;
    if (opts.enabled && prev.current.size) {
      for (const n of nodes) {
        const id = n.dataset.flip!;
        if (id === 'stock') continue;
        const now = next.get(id)!;
        const before = prev.current.get(id);
        const into = n.dataset.flipZone === 'captured';
        if (before) {
          const dx = before.left - now.left;
          const dy = before.top - now.top;
          if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;
          const sx = before.width / Math.max(1, now.width);
          if (into) captured++;
          n.animate(
            into
              ? [
                  { transform: `translate(${dx}px, ${dy}px) scale(${sx})`, zIndex: 40 },
                  { transform: 'translate(0, 0) scale(1.18)', offset: 0.75, zIndex: 40 },
                  { transform: 'none' },
                ]
              : [{ transform: `translate(${dx}px, ${dy}px) scale(${sx})`, zIndex: 40 }, { transform: 'none' }],
            { duration: into ? 420 : 320, easing: 'cubic-bezier(.2,.8,.2,1)' },
          );
        } else if (stock && n.dataset.flipZone === 'field') {
          const dx = stock.left - now.left;
          const dy = stock.top - now.top;
          n.animate(
            [
              { transform: `translate(${dx}px, ${dy}px) rotateY(90deg)`, opacity: 0.6 },
              { transform: 'translate(0, 0) rotateY(0deg)', opacity: 1 },
            ],
            { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' },
          );
        }
      }
    }
    prev.current = next;
    if (captured && opts.onCapture) opts.onCapture(captured);
  }, deps);
}
