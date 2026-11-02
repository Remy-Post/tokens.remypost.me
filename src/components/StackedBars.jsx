import { useEffect, useRef } from 'preact/hooks';
import { column } from '../lib/data.js';
import { compact, famColor, full, ticks } from '../lib/format.js';
import { useRoving, useTip, useWidth } from '../lib/hooks.js';
import { TipRow, TipSplit } from './Tooltip.jsx';

const AXIS = 44; // room for y tick labels
const BASE = 26; // x label band below the baseline
const TOP = 10; // headroom above the tallest bar
const GAP = 2; // surface gap between stacked segments

/**
 * Columns stacked by model family, filtered and spotlit by the shared family filter.
 * bins: [{ key, keys (dates it covers, for the calendar echo), fam: {Opus: n, …}, title, x (axis label or null), pre?, peak? }]
 * The tooltip anchors to the top of the visible stack, never to the column's full-height hit area.
 */
export default function StackedBars({ name, bins, series, filter, label, axis = true, height, echo, sparseX = true }) {
  const tip = useTip();
  const [box, width] = useWidth();
  const svg = useRef(null);
  const anchors = useRef([]);
  const { enabled, spot, showAll } = filter;

  const shown = series.filter((f) => enabled.has(f) || !filter.families.includes(f));
  const stackOf = (b) => shown.reduce((s, f) => s + (b.fam[f] ?? 0), 0);
  const left = axis ? AXIS : 0;
  const plotW = Math.max(0, width - left);
  const slot = bins.length ? plotW / bins.length : 0;
  const barW = Math.max(2, Math.min(24, slot - GAP));
  const h = height(width);
  const plotH = h - BASE - TOP;
  const max = Math.max(...bins.map(stackOf), 1);
  const yt = ticks(max);
  const top = axis ? yt.at(-1) : max;
  const y = (v) => TOP + plotH - (v / top) * plotH;
  const none = !shown.length;

  const { active, setActive, onKeyDown } = useRoving(bins.length, (i, key) =>
    key === 'ArrowLeft' ? i - 1 : key === 'ArrowRight' ? i + 1 : null,
  );

  const open = (i) => {
    const b = bins[i];
    const el = anchors.current[i];
    if (!b || !el) return;
    const total = stackOf(b);
    tip.show(
      el,
      <>
        <p class="tip__title">{b.title}</p>
        {b.pre ? (
          <p class="tip__note">Before tracking began.</p>
        ) : (
          <>
            <TipRow value={full(total)} label={none ? 'nothing shown' : 'output tokens'} total />
            {total > 0 && <TipSplit parts={shown.map((f) => ({ key: f, value: b.fam[f] ?? 0, color: famColor(f) }))} />}
            {shown.map(
              (f) => b.fam[f] > 0 && <TipRow key={f} color={famColor(f)} value={compact(b.fam[f])} label={f} />,
            )}
          </>
        )}
      </>,
    );
  };
  // Switching between daily and weekly bars changes how many there are; keep the selection on a real bar.
  useEffect(() => {
    if (active >= bins.length) setActive(bins.length - 1);
  }, [bins.length]);
  // The tooltip follows keyboard moves, and re-anchors when a filter change resizes the bars under it.
  useEffect(() => {
    if (active >= 0 && active < bins.length && document.activeElement === svg.current) open(active);
  }, [active, bins.length, enabled, width]);

  // Label the first bin, the last, and a few evenly spaced between, never crowding. A label ("Aug 10") is six
  // Fragment Mono characters (0.618em each) at 0.62rem; the root size grows on big screens, so the spacing does too.
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const textW = rem * 0.62 * 0.618 * 6;
  const step = Math.max(slot, 1);
  const every = Math.max(1, Math.ceil(Math.max(64, textW + 24) / step));
  // With a y axis the first and last labels hug their bar's outer edge, so the label next to one needs its own half
  // width, the edge label's full width and a gap between their bars.
  const edge = axis ? Math.max(1, Math.ceil((1.5 * textW + 8 - barW / 2) / step)) : every;
  const last = bins.length - 1;

  return (
    <div ref={box} class="chart">
      {width > 0 && (
        <svg
          ref={svg}
          width={width}
          height={h}
          viewBox={`0 0 ${width} ${h}`}
          role="listbox"
          tabIndex={0}
          aria-label={`${label} Use arrow keys to step through.`}
          aria-activedescendant={active >= 0 ? `${name}-${active}` : undefined}
          data-spot={spot && shown.includes(spot) ? spot : undefined}
          data-echo={echo != null ? '' : undefined}
          onKeyDown={onKeyDown}
          onFocus={() => (active < 0 ? setActive(bins.length - 1) : open(active))}
          onBlur={tip.hide}
          onPointerLeave={tip.hide}
        >
          {axis &&
            yt.map((t) => (
              <g key={t} class="grid">
                {t > 0 && <line x1={left} x2={width} y1={y(t)} y2={y(t)} />}
                <text x={left - 10} y={y(t)} dy="0.32em" text-anchor="end">
                  {compact(t)}
                </text>
              </g>
            ))}
          {bins.map((b, i) => {
            const x = left + i * slot + (slot - barW) / 2;
            const segs = shown.filter((f) => b.fam[f] > 0);
            const stackTop = y(stackOf(b));
            let acc = 0;
            return (
              <g
                key={b.key}
                id={`${name}-${i}`}
                role="option"
                aria-selected={i === active}
                aria-label={`${b.title}: ${b.pre ? 'before tracking' : `${compact(stackOf(b))} output tokens`}`}
                class="col"
                data-active={i === active ? '' : undefined}
                data-echo={echo != null && b.keys?.includes(echo) ? '' : undefined}
                data-pre={b.pre ? '' : undefined}
                onPointerEnter={() => {
                  setActive(i);
                  open(i);
                }}
              >
                {/* Hit target: the whole slot, full height, bigger than the mark. */}
                <rect class="col__hit" x={left + i * slot} y={0} width={slot} height={TOP + plotH} />
                <rect class="col__glow" x={x - 3} y={TOP} width={barW + 6} height={plotH} rx="5" />
                {segs.map((f, s) => {
                  const v = b.fam[f];
                  const y1 = y(acc + v);
                  const y0 = y(acc);
                  acc += v;
                  const segH = Math.max(0, y0 - y1 - (s > 0 ? GAP : 0));
                  return (
                    <path
                      key={f}
                      class="seg"
                      data-fam={f}
                      data-lit={spot === f ? '' : undefined}
                      d={column(x, y1, barW, segH, s === segs.length - 1)}
                      fill={famColor(f)}
                    />
                  );
                })}
                {/* The tooltip's anchor: a 1px line on top of the visible stack (on the baseline when empty). */}
                <rect
                  class="col__anchor"
                  ref={(el) => (anchors.current[i] = el)}
                  x={x}
                  y={stackTop - 1}
                  width={barW}
                  height={1}
                />
                {b.x != null &&
                  (!sparseX ||
                    ((i % every === 0 || i === last) && (i === 0 || i === last || (i >= edge && last - i >= edge)))) && (
                    <text
                      class="col__x"
                      data-peak={b.peak ? '' : undefined}
                      // With a y axis, the first and last labels hug their bar's outer edge so a large font never
                      // runs into the tick labels or off the card.
                      x={axis && i === 0 ? x : axis && i === last ? x + barW : x + barW / 2}
                      y={h - 8}
                      text-anchor={axis && i === 0 ? 'start' : axis && i === last ? 'end' : 'middle'}
                    >
                      {b.x}
                    </text>
                  )}
                {b.peak && <circle class="col__peak" cx={x + barW / 2} cy={h - BASE + 6} r="2" />}
              </g>
            );
          })}
          <line class="baseline" x1={left} x2={width} y1={y(0)} y2={y(0)} />
        </svg>
      )}
      {none && width > 0 && (
        <p class="chart__empty">
          Every model is hidden.{' '}
          <button type="button" class="link" onClick={showAll}>
            Show all
          </button>
        </p>
      )}
    </div>
  );
}
