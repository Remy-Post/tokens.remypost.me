import { useEffect, useRef } from 'preact/hooks';
import { compact, day, dayLong, full } from '../lib/format.js';
import { useRoving, useTip, useWidth } from '../lib/hooks.js';
import { TipRow } from './Tooltip.jsx';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STEPS = 5;

/** Quantile thresholds over active days, so one huge day doesn't wash every other day out. */
function thresholds(values) {
  const v = values.filter(Boolean).sort((a, b) => a - b);
  if (!v.length) return [];
  return Array.from({ length: STEPS - 1 }, (_, i) => v[Math.floor(((i + 1) / STEPS) * (v.length - 1))]);
}
const stepOf = (n, th) => (n ? 1 + th.filter((t) => n > t).length : 0);

export default function Calendar({ days }) {
  const tip = useTip();
  const [box, width] = useWidth();
  const cells = useRef([]);
  // Weeks run left to right once there's room for every week as a column; otherwise top to bottom.
  const lead = days.length ? days[0].dow : 0;
  const weeks = Math.ceil((lead + days.length) / 7);
  const across = width >= weeks * 22 + 40;
  const th = thresholds(days.map((d) => d.out));

  // Arrows move within the grid as drawn and stop at its edges: across, a column is Mon–Sun of one week;
  // down, a row is. Stepping a day past Sunday would otherwise jump diagonally into the next week.
  const { active, setActive, onKeyDown } = useRoving(days.length, (i, key) => {
    const dow = (lead + i) % 7;
    const dayKeys = across ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
    const weekKeys = across ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    if (key === dayKeys[0]) return dow > 0 ? i - 1 : null;
    if (key === dayKeys[1]) return dow < 6 ? i + 1 : null;
    if (key === weekKeys[0]) return i - 7;
    if (key === weekKeys[1]) return i + 7;
    return null;
  });

  const grid = useRef(null);
  const open = (i) => {
    const d = days[i];
    const el = cells.current[i];
    if (!d || !el) return;
    tip.show(el, (
      <>
        <p class="tip__title">{dayLong(d.d)}</p>
        <TipRow value={full(d.out)} label="output tokens" />
        <TipRow value={full(d.req)} label="requests" />
      </>
    ));
  };

  // Keyboard moves the selection; the tooltip follows it while the grid has focus.
  useEffect(() => {
    if (active >= 0 && document.activeElement === grid.current) open(active);
  }, [active]);

  return (
    <section class="card card--calendar" aria-labelledby="t3">
      <p class="label" id="t3">T.3 Calendar</p>
      <h2 class="card__title">What Claude wrote, day by day</h2>
      <div ref={box} class="cal" data-across={across ? '' : undefined} style={{ '--weeks': weeks }}>
        <div class="cal__dow" aria-hidden="true">
          {DOW.map((d) => (
            <span key={d}>{across ? d[0] : d.slice(0, 2)}</span>
          ))}
        </div>
        <div
          class="cal__grid"
          role="listbox"
          aria-label="Output tokens per day. Use arrow keys to move between days."
          ref={grid}
          tabIndex={0}
          aria-activedescendant={active >= 0 ? `cal-${days[active].d}` : undefined}
          onKeyDown={onKeyDown}
          onFocus={() => (active < 0 ? setActive(days.length - 1) : open(active))}
          onBlur={tip.hide}
        >
          {Array.from({ length: lead }, (_, i) => (
            <span key={`pad${i}`} class="cal__pad" aria-hidden="true" />
          ))}
          {days.map((d, i) => (
            <span
              key={d.d}
              id={`cal-${d.d}`}
              ref={(el) => (cells.current[i] = el)}
              role="option"
              class="cal__cell"
              data-step={stepOf(d.out, th)}
              aria-selected={i === active}
              data-active={i === active ? '' : undefined}
              aria-label={`${dayLong(d.d)}: ${compact(d.out)} output tokens`}
              onPointerEnter={() => {
                setActive(i);
                open(i);
              }}
              onPointerLeave={tip.hide}
            />
          ))}
        </div>
      </div>
      <div class="scale" aria-hidden="true">
        <span>Quiet</span>
        {Array.from({ length: STEPS + 1 }, (_, s) => (
          <span key={s} class="cal__cell" data-step={s} />
        ))}
        <span>Busy</span>
      </div>
      <p class="fine">
        {day(days[0].d)} to {day(days.at(-1).d)}. Each step is a fifth of active days; the darkest is the busiest fifth.
      </p>
    </section>
  );
}
