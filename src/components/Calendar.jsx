import { useEffect, useRef, useState } from 'preact/hooks';
import { compact, day, dayLong, famColor, full } from '../lib/format.js';
import { useRoving, useTip, useWidth } from '../lib/hooks.js';
import { TipRow, TipSplit } from './Tooltip.jsx';
import TableView from './TableView.jsx';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STEPS = 5;
const STEP_LABEL = ['', 'Quietest fifth', 'Quiet', 'Typical', 'Busy', 'Busiest fifth'];
const monthFmt = new Intl.DateTimeFormat('en-CA', { month: 'short', timeZone: 'UTC' });
const monthLongFmt = new Intl.DateTimeFormat('en-CA', { month: 'long', timeZone: 'UTC' });

/** Quantile thresholds over active days, so one huge day doesn't wash every other day out. */
function thresholds(values) {
  const v = values.filter(Boolean).sort((a, b) => a - b);
  if (!v.length) return [];
  return Array.from({ length: STEPS - 1 }, (_, i) => v[Math.floor(((i + 1) / STEPS) * (v.length - 1))]);
}
const stepOf = (n, th) => (n ? 1 + th.filter((t) => n > t).length : 0);

/** Output, active days and the busiest family for each month in the window, newest first. */
function monthSums(days, families) {
  const by = new Map();
  for (const d of days) {
    const key = d.d.slice(0, 7);
    let m = by.get(key);
    if (!m)
      by.set(key, (m = { key, name: monthLongFmt.format(new Date(`${d.d}T00:00:00Z`)), out: 0, active: 0, fam: {} }));
    m.out += d.out;
    if (d.out) m.active++;
    for (const f of families) m.fam[f] = (m.fam[f] ?? 0) + d.fam[f];
  }
  return [...by.values()].reverse().map((m) => {
    const top = families.reduce((a, f) => (m.fam[f] > (m.fam[a] ?? 0) ? f : a), null);
    return { ...m, top: m.fam[top] ? top : null };
  });
}

/** Where each month starts, as a week index, for the month labels. */
function monthStarts(days, lead) {
  const out = [];
  days.forEach((d, i) => {
    if (i === 0 || d.d.endsWith('-01')) {
      const week = Math.floor((lead + i) / 7);
      // A month that starts late in the first week would print on top of the next label.
      if (out.at(-1)?.week === week) out.pop();
      out.push({ label: monthFmt.format(new Date(`${d.d}T00:00:00Z`)), week });
    }
  });
  return out;
}

export default function Calendar({ days, families, from, onDay }) {
  const tip = useTip();
  const [box, width] = useWidth();
  const cells = useRef([]);
  const grid = useRef(null);
  const [hot, setHot] = useState(false); // pointer or keyboard is in the grid
  const [step, setStep] = useState(null); // a scale swatch is hovered
  const [month, setMonth] = useState(null); // a month in the summary is hovered

  const lead = days.length ? days[0].dow : 0;
  const weeks = Math.ceil((lead + days.length) / 7);
  // Weeks run left to right once every week fits as a column at a readable size; otherwise top to bottom.
  const across = width >= weeks * 24 + 56;
  const th = thresholds(days.map((d) => d.out));
  const last = days.length - 1;

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

  const open = (i) => {
    const d = days[i];
    const el = cells.current[i];
    if (!d || !el) return;
    onDay?.(d.d);
    tip.show(
      el,
      d.pre ? (
        <>
          <p class="tip__title">{dayLong(d.d)}</p>
          <p class="tip__note">Before tracking began on {day(from)}.</p>
        </>
      ) : (
        <>
          <p class="tip__title">
            {dayLong(d.d)}
            {i === last && <span class="tip__badge">Latest</span>}
          </p>
          <TipRow value={full(d.out)} label="output tokens" total />
          {d.out > 0 && <TipSplit parts={families.map((f) => ({ key: f, value: d.fam[f], color: famColor(f) }))} />}
          {families.map(
            (f) => d.fam[f] > 0 && <TipRow key={f} color={famColor(f)} value={compact(d.fam[f])} label={f} />,
          )}
          <TipRow value={full(d.req)} label="requests" />
          {d.out > 0 && <p class="tip__note">{STEP_LABEL[stepOf(d.out, th)]} of active days</p>}
          {!d.out && <p class="tip__note">A day off.</p>}
        </>
      ),
    );
  };
  const close = () => {
    setHot(false);
    onDay?.(null);
    tip.hide();
  };

  // Keyboard moves the selection; the tooltip follows it while the grid has focus.
  useEffect(() => {
    if (active >= 0 && document.activeElement === grid.current) open(active);
  }, [active]);

  // The crosshair: the hovered day stays bright, its weekday row and week column stay readable, the rest recede.
  const aDow = (lead + active) % 7;
  const aWeek = Math.floor((lead + active) / 7);
  const align = (i) =>
    hot && active >= 0 && i !== active && ((lead + i) % 7 === aDow || Math.floor((lead + i) / 7) === aWeek);

  const months = monthStarts(days, lead);
  const tracked = days.filter((d) => !d.pre);
  const sums = monthSums(tracked, families);
  const maxMonth = Math.max(...sums.map((m) => m.out), 1);

  return (
    <section class="card card--calendar" aria-labelledby="t3">
      <header class="card__head">
        <p class="label" id="t3">T.3 Calendar</p>
        <h2 class="card__title">What Claude wrote, day by day</h2>
        <p class="fine">
          The last three months. {tracked.filter((d) => d.out).length} active days since {day(from)}.
        </p>
      </header>
      <div class="cal-body">
        <div ref={box} class="cal-area">
          <div class="cal" data-across={across ? '' : undefined} style={{ '--weeks': weeks }}>
            <div
              class="cal__months"
              aria-hidden="true"
              style={
                across
                  ? { gridTemplateColumns: `repeat(${weeks}, var(--c))` }
                  : { gridTemplateRows: `repeat(${weeks}, var(--c))` }
              }
            >
              {months.map((m) => (
                <span key={m.label + m.week} style={across ? { gridColumn: m.week + 1 } : { gridRow: m.week + 1 }}>
                  {m.label}
                </span>
              ))}
            </div>
            <div class="cal__dow" aria-hidden="true">
              {DOW.map((d, i) => (
                <span key={d} data-on={hot && active >= 0 && i === aDow ? '' : undefined}>
                  {across ? d.slice(0, 1) : d.slice(0, 2)}
                </span>
              ))}
            </div>
            <div
              class="cal__grid"
              role="listbox"
              aria-label="Output tokens per day for the last three months. Use arrow keys to move between days."
              ref={grid}
              tabIndex={0}
              data-hot={hot ? '' : undefined}
              data-step-hover={step ?? undefined}
              data-month-hover={month ?? undefined}
              aria-activedescendant={active >= 0 ? `cal-${days[active].d}` : undefined}
              onKeyDown={onKeyDown}
              onFocus={() => {
                setHot(true);
                active < 0 ? setActive(last) : open(active);
              }}
              onBlur={close}
              onPointerLeave={close}
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
                  data-step={d.pre ? 'pre' : stepOf(d.out, th)}
                  data-latest={i === last ? '' : undefined}
                  data-align={align(i) ? '' : undefined}
                  data-in={month && d.d.startsWith(month) ? '' : undefined}
                  aria-selected={i === active}
                  data-active={i === active ? '' : undefined}
                  aria-label={`${dayLong(d.d)}: ${d.pre ? 'before tracking' : `${compact(d.out)} output tokens`}${i === last ? ', latest day' : ''}`}
                  style={{ '--d': `${Math.floor((lead + i) / 7) * 18 + ((lead + i) % 7) * 6}ms` }}
                  onPointerEnter={() => {
                    setHot(true);
                    setActive(i);
                    open(i);
                  }}
                />
              ))}
            </div>
          </div>
          <div class="scale" onPointerLeave={() => setStep(null)}>
            <span aria-hidden="true">Quiet</span>
            {Array.from({ length: STEPS + 1 }, (_, s) => (
              <span
                key={s}
                class="cal__cell"
                data-step={s}
                tabIndex={0}
                role="img"
                aria-label={s ? `${STEP_LABEL[s]} of active days` : 'No output'}
                onPointerEnter={() => setStep(s)}
                onFocus={() => setStep(s)}
                onBlur={() => setStep(null)}
              />
            ))}
            <span aria-hidden="true">Busy</span>
          </div>
        </div>
        <ol class="cal__sum" onPointerLeave={() => setMonth(null)}>
          {sums.map((m) => (
            <li
              key={m.key}
              tabIndex={0}
              data-on={month === m.key ? '' : undefined}
              onPointerEnter={() => setMonth(m.key)}
              onFocus={() => setMonth(m.key)}
              onBlur={() => setMonth(null)}
            >
              <span class="cal__sum-name">{m.name}</span>
              <span class="cal__sum-value">{compact(m.out)}</span>
              <span class="cal__sum-bar" aria-hidden="true">
                <span style={{ width: `${(m.out / maxMonth) * 100}%` }} />
              </span>
              <span class="cal__sum-note">
                {m.active} active {m.active === 1 ? 'day' : 'days'}
                {m.top && (
                  <>
                    {' '}
                    · mostly <span class="key" style={{ background: famColor(m.top) }} /> {m.top}
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <TableView
        caption="Output tokens and requests per active day"
        head={['Day', 'Output tokens', 'Requests']}
        rows={[...days]
          .reverse()
          .filter((d) => d.out > 0)
          .map((d) => [dayLong(d.d), d.out, d.req])}
      />
    </section>
  );
}
