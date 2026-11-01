import { createContext } from 'preact';
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

/** Width of an element in CSS px, kept current with ResizeObserver. Charts draw in real pixels. */
export function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** One tooltip for the whole page. Marks call show(el, content) on hover and focus. */
export const TipContext = createContext({ show() {}, hide() {} });
export const useTip = () => useContext(TipContext);

/**
 * Roving focus for a grid of marks: one tab stop, arrow keys move (also what a TV remote's d-pad sends).
 * `move(index, key)` returns the next index or null.
 */
export function useRoving(count, move) {
  const [active, setState] = useState(-1);
  // Key repeat can fire faster than renders; read the latest index from a ref, not the closure.
  const current = useRef(-1);
  const setActive = (i) => {
    current.current = typeof i === 'function' ? i(current.current) : i;
    setState(current.current);
  };
  const onKeyDown = (e) => {
    const from = current.current < 0 ? count - 1 : current.current;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? count - 1 : move(from, e.key);
    if (next == null || next < 0 || next >= count) return;
    e.preventDefault();
    setActive(next);
  };
  return { active, setActive, onKeyDown };
}

/**
 * Shared model-family filter for every chart that stacks by family: which families are shown, and which one
 * is spotlit by hovering a legend chip, a bar segment or a row of the models table.
 */
export function useFamilyFilter(families) {
  const [enabled, setEnabled] = useState(() => new Set(families));
  const [spot, setSpot] = useState(null);
  const key = families.join(',');
  useEffect(() => setEnabled(new Set(families)), [key]);
  return {
    families,
    enabled,
    spot,
    setSpot,
    toggle: (f) =>
      setEnabled((s) => {
        const next = new Set(s);
        next.has(f) ? next.delete(f) : next.add(f);
        return next;
      }),
    only: (f) => setEnabled(new Set([f])),
    showAll: () => setEnabled(new Set(families)),
  };
}
