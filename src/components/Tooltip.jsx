import { useLayoutEffect, useRef, useState } from 'preact/hooks';

/**
 * Sits right above the mark it describes (pass the mark itself, not its hit area) and stays inside the mark's card.
 * When there's no room above without covering the card's heading, it moves beside the mark instead.
 * The caret tracks the mark even when the box is pushed in from an edge, and the box glides between neighbours.
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
    const b = tip.bounds;
    // The card, trimmed to the viewport; a card narrower than the tooltip (phones) falls back to the viewport.
    const minX = b && b.width > box.width + 2 * pad ? Math.max(pad, b.left + pad) : pad;
    const maxX = (b && b.width > box.width + 2 * pad ? Math.min(innerWidth, b.right) : innerWidth) - pad;
    const minY = Math.max(pad, tip.ceiling ?? (b ? b.top + pad : pad));
    const clampX = (x) => Math.min(Math.max(minX, x), maxX - box.width);
    let side = 'top';
    let left = clampX(r.left + r.width / 2 - box.width / 2);
    let top = r.top - box.height - gap;
    if (top < minY) {
      // Beside the mark, on whichever side has room, vertically centred on the mark's top.
      const right = r.right + gap;
      side = right + box.width <= maxX ? 'right' : 'left';
      left = side === 'right' ? right : Math.max(pad, r.left - gap - box.width);
      top = Math.min(Math.max(minY, r.top - box.height / 2), innerHeight - box.height - pad);
      if (side === 'left' && r.left - gap - box.width < pad) {
        side = 'bottom';
        left = clampX(r.left + r.width / 2 - box.width / 2);
        top = r.bottom + gap;
      }
    }
    const caret =
      side === 'top' || side === 'bottom'
        ? Math.min(Math.max(12, r.left + r.width / 2 - left), box.width - 12)
        : Math.min(Math.max(12, r.top + Math.min(r.height, 12) / 2 - top), box.height - 12);
    setPos({ left, top, side, caret, glide: wasOpen.current });
    wasOpen.current = true;
  }, [tip]);

  return (
    <div
      ref={ref}
      class="tip"
      role="status"
      aria-live="polite"
      data-open={tip && pos ? '' : undefined}
      data-side={pos?.side}
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
