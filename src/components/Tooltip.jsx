import { useLayoutEffect, useRef, useState } from 'preact/hooks';

/**
 * Sits right above the mark it describes (pass the mark itself, not its hit area), flips below near the top edge,
 * never leaves the viewport. The caret tracks the mark even when the box is clamped to an edge, and the box
 * glides between neighbouring marks instead of blinking.
 */
export default function Tooltip({ tip }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const wasOpen = useRef(false);

  useLayoutEffect(() => {
    if (!tip || !ref.current) {
      wasOpen.current = false;
      return setPos(null);
    }
    const r = tip.rect;
    const box = ref.current.getBoundingClientRect();
    const pad = 8;
    const gap = 12;
    let left = r.left + r.width / 2 - box.width / 2;
    left = Math.min(Math.max(pad, left), window.innerWidth - box.width - pad);
    let top = r.top - box.height - gap;
    const flip = top < pad;
    if (flip) top = r.bottom + gap;
    const caret = Math.min(Math.max(12, r.left + r.width / 2 - left), box.width - 12);
    setPos({ left, top, flip, caret, glide: wasOpen.current });
    wasOpen.current = true;
  }, [tip]);

  return (
    <div
      ref={ref}
      class="tip"
      role="status"
      aria-live="polite"
      data-open={tip && pos ? '' : undefined}
      data-flip={pos?.flip ? '' : undefined}
      data-glide={pos?.glide ? '' : undefined}
      style={
        pos
          ? {
              transform: `translate3d(${Math.round(pos.left)}px, ${Math.round(pos.top)}px, 0)`,
              '--caret': `${pos.caret}px`,
            }
          : undefined
      }
    >
      {tip?.content}
    </div>
  );
}

/** A tooltip row: colour key, then value (strong), then label. */
export function TipRow({ color, value, label, total }) {
  return (
    <div class="tip__row" data-total={total ? '' : undefined}>
      {color && <span class="tip__key" style={{ background: color }} />}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

/** A thin bar split by family share, the at-a-glance version of the rows below it. */
export function TipSplit({ parts }) {
  const sum = parts.reduce((s, p) => s + p.value, 0);
  if (!sum) return null;
  return (
    <div class="tip__split" aria-hidden="true">
      {parts.map((p) => p.value > 0 && <span key={p.key} style={{ flexGrow: p.value, background: p.color }} />)}
    </div>
  );
}
