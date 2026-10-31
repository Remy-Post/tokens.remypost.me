import { useLayoutEffect, useRef, useState } from 'preact/hooks';

/** Sits above the mark it describes, flips below near the top edge, never leaves the viewport. */
export default function Tooltip({ tip }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!tip || !ref.current) return setPos(null);
    const r = tip.rect;
    const box = ref.current.getBoundingClientRect();
    const pad = 8;
    let left = r.left + r.width / 2 - box.width / 2;
    left = Math.min(Math.max(pad, left), window.innerWidth - box.width - pad);
    let top = r.top - box.height - 10;
    if (top < pad) top = r.bottom + 10;
    setPos({ left, top });
  }, [tip]);

  return (
    <div
      ref={ref}
      class="tip"
      role="status"
      aria-live="polite"
      data-open={tip ? '' : undefined}
      style={pos ? { transform: `translate(${pos.left}px, ${pos.top}px)` } : undefined}
    >
      {tip?.content}
    </div>
  );
}

/** A tooltip row: line key, then value (strong), then label. */
export function TipRow({ color, value, label }) {
  return (
    <div class="tip__row">
      {color && <span class="tip__key" style={{ background: color }} />}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
