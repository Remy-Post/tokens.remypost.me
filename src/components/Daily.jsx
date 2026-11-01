import { useEffect, useRef } from 'preact/hooks';
import { toWeeks } from '../lib/data.js';
import { compact, day, dayLong, full, ticks } from '../lib/format.js';
import { useRoving, useTip, useWidth } from '../lib/hooks.js';
import { TipRow } from './Tooltip.jsx';

const AXIS = 44; // room for y tick labels
const BASE = 26; // x label band below the baseline
const GAP = 2; // surface gap between stacked segments and between bars

export const famColor = (f) => `var(--fam-${f.toLowerCase()})`;

export default function Daily({ data }) {
  const tip = useTip();
  const [box, width] = useWidth();
  const svg = useRef(null);
  const marks = useRef([]);
  const { families } = data;

  // One column per day while each gets at least 6px, otherwise one per week.
  const plotW = Math.max(0, width - AXIS);
  const weekly = data.days.length * 6 > plotW;
  const bins = weekly ? toWeeks(data.days, families) : data.days;
  const slot = bins.length ? plotW / bins.length : 0;
  const barW = Math.max(2, Math.min(24, slot - GAP));
  const h = Math.round(Math.min(360, Math.max(170, width * 0.3)));
  const plotH = h - BASE - 8;
  const max = Math.max(...bins.map((b) => b.out), 1);
  const yt = ticks(max);
  const top = yt.at(-1);
  const y = (v) => 8 + plotH - (v / top) * plotH;

  const { active, setActive, onKeyDown } = useRoving(bins.length, (i, key) =>
    key === 'ArrowLeft' ? i - 1 : key === 'ArrowRight' ? i + 1 : null,
  );

  const open = (i) => {
    const b = bins[i];
    const el = marks.current[i];
    if (!b || !el) return;
    tip.show(el, (
      <>
        <p class="tip__title">{weekly ? `Week of ${day(b.d)}` : dayLong(b.d)}</p>
        <TipRow value={full(b.out)} label="output tokens" />
        {families.map((f) => b.fam[f] > 0 && <TipRow key={f} color={famColor(f)} value={compact(b.fam[f])} label={f} />)}
      </>
    ));
  };
  // Switching between daily and weekly bars changes how many there are; keep the selection on a real bar.
  useEffect(() => {
    if (active >= bins.length) setActive(bins.length - 1);
  }, [bins.length]);
  useEffect(() => {
    if (active >= 0 && active < bins.length && document.activeElement === svg.current) open(active);
  }, [active, weekly]);

  // Label the first bin, the last, and a few evenly spaced between, never crowding.
  const every = Math.max(1, Math.ceil(64 / Math.max(slot, 1)));

  return (
    <section class="card card--daily" aria-labelledby="t4">
      <p class="label" id="t4">T.4 Output by model</p>
      <h2 class="card__title">Tokens Claude wrote, {weekly ? 'per week' : 'per day'}</h2>
      <ul class="legend">
        {families.map((f) => (
          <li key={f}>
            <span class="legend__key" style={{ background: famColor(f) }} />
            {f}
          </li>
        ))}
      </ul>
      <div ref={box} class="chart">
        {width > 0 && (
          <svg
            ref={svg}
            width={width}
            height={h}
            viewBox={`0 0 ${width} ${h}`}
            role="listbox"
            tabIndex={0}
            aria-label={`Output tokens ${weekly ? 'per week' : 'per day'}, stacked by model family. Use arrow keys to step through.`}
            aria-activedescendant={active >= 0 ? `bar-${active}` : undefined}
            onKeyDown={onKeyDown}
            onFocus={() => (active < 0 ? setActive(bins.length - 1) : open(active))}
            onBlur={tip.hide}
          >
            {yt.map((t) => (
              <g key={t} class="grid">
                <line x1={AXIS} x2={width} y1={y(t)} y2={y(t)} />
                <text x={AXIS - 8} y={y(t)} dy="0.32em" text-anchor="end">
                  {compact(t)}
                </text>
              </g>
            ))}
            {bins.map((b, i) => {
              const x = AXIS + i * slot + (slot - barW) / 2;
              let acc = 0;
              const segs = families.filter((f) => b.fam[f] > 0);
              return (
                <g
                  key={b.d}
                  id={`bar-${i}`}
                  role="option"
                  aria-selected={i === active}
                  aria-label={`${weekly ? `Week of ${day(b.d)}` : dayLong(b.d)}: ${compact(b.out)} output tokens`}
                  class="col"
                  data-active={i === active ? '' : undefined}
                  ref={(el) => (marks.current[i] = el)}
                  onPointerEnter={() => {
                    setActive(i);
                    open(i);
                  }}
                  onPointerLeave={tip.hide}
                >
                  {/* Hit target: the whole slot, full height, bigger than the mark. */}
                  <rect class="col__hit" x={AXIS + i * slot} y={8} width={slot} height={plotH} />
                  {segs.map((f, s) => {
                    const v = b.fam[f];
                    const y1 = y(acc + v);
                    const y0 = y(acc);
                    acc += v;
                    const isTop = s === segs.length - 1;
                    const segH = Math.max(0, y0 - y1 - (s > 0 ? GAP : 0));
                    return <path key={f} d={column(x, y1, barW, segH, isTop)} fill={famColor(f)} />;
                  })}
                  {(i % every === 0 || i === bins.length - 1) && (i === bins.length - 1 || bins.length - 1 - i >= every) && (
                    <text class="col__x" x={x + barW / 2} y={h - 8} text-anchor="middle">
                      {day(b.d)}
                    </text>
                  )}
                </g>
              );
            })}
            <line class="baseline" x1={AXIS} x2={width} y1={y(0)} y2={y(0)} />
          </svg>
        )}
      </div>
      <details class="table-view">
        <summary>Show as a table</summary>
        <div class="table-scroll">
          <table>
            <caption class="sr-only">Output tokens {weekly ? 'per week' : 'per day'} by model family</caption>
            <thead>
              <tr>
                <th scope="col">{weekly ? 'Week of' : 'Day'}</th>
                {families.map((f) => (
                  <th key={f} scope="col">{f}</th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...bins].reverse().filter((b) => b.out > 0).map((b) => (
                <tr key={b.d}>
                  <th scope="row">{dayLong(b.d)}</th>
                  {families.map((f) => (
                    <td key={f}>{b.fam[f] ? full(b.fam[f]) : '–'}</td>
                  ))}
                  <td>{full(b.out)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

/** A column segment: 4px rounded data-end on the top segment only, square everywhere else. */
function column(x, y, w, h, roundTop) {
  if (h <= 0) return '';
  const r = roundTop ? Math.min(4, w / 2, h) : 0;
  return `M${x},${y + h}V${y + r}${r ? `Q${x},${y} ${x + r},${y}` : ''}H${x + w - r}${r ? `Q${x + w},${y} ${x + w},${y + r}` : ''}V${y + h}Z`;
}
