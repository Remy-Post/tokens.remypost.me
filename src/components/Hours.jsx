import { useEffect, useRef } from 'preact/hooks';
import { compact, full } from '../lib/format.js';
import { useRoving, useTip, useWidth } from '../lib/hooks.js';
import { TipRow } from './Tooltip.jsx';

const label = (h) => (h === 0 ? '12 am' : h === 12 ? 'noon' : h < 12 ? `${h} am` : `${h - 12} pm`);

/** Output by hour of day, Eastern. One series, so no legend: the title names it. */
export default function Hours({ hours }) {
  const tip = useTip();
  const [box, width] = useWidth();
  const svg = useRef(null);
  const marks = useRef([]);
  const h = Math.round(Math.min(220, Math.max(120, width * 0.36)));
  const plotH = h - 30;
  const slot = width / 24;
  const barW = Math.max(2, Math.min(24, slot - 2));
  const max = Math.max(...hours, 1);
  const peak = hours.indexOf(max);

  const { active, setActive, onKeyDown } = useRoving(24, (i, key) =>
    key === 'ArrowLeft' ? i - 1 : key === 'ArrowRight' ? i + 1 : null,
  );
  const open = (i) => {
    const el = marks.current[i];
    if (!el) return;
    tip.show(el, (
      <>
        <p class="tip__title">{label(i)} to {label((i + 1) % 24)}</p>
        <TipRow value={full(hours[i])} label="output tokens" />
      </>
    ));
  };
  useEffect(() => {
    if (active >= 0 && document.activeElement === svg.current) open(active);
  }, [active]);

  return (
    <section class="card card--hours" aria-labelledby="t6">
      <p class="label" id="t6">T.6 Hours</p>
      <h2 class="card__title">When the writing happens</h2>
      <p class="fine">Output by hour, Eastern time. Busiest: {label(peak)}.</p>
      <div ref={box} class="chart">
        {width > 0 && (
          <svg
            ref={svg}
            width={width}
            height={h}
            viewBox={`0 0 ${width} ${h}`}
            role="listbox"
            tabIndex={0}
            aria-label="Output tokens by hour of day. Use arrow keys to step through."
            aria-activedescendant={active >= 0 ? `hr-${active}` : undefined}
            onKeyDown={onKeyDown}
            onFocus={() => (active < 0 ? setActive(peak) : open(active))}
            onBlur={tip.hide}
          >
            {hours.map((v, i) => {
              const bh = (v / max) * (plotH - 8);
              const x = i * slot + (slot - barW) / 2;
              const y = plotH - bh;
              const r = Math.min(4, barW / 2, bh);
              return (
                <g
                  key={i}
                  id={`hr-${i}`}
                  role="option"
                  aria-selected={i === active}
                  aria-label={`${label(i)}: ${compact(v)} output tokens`}
                  class="col"
                  data-active={i === active ? '' : undefined}
                  ref={(el) => (marks.current[i] = el)}
                  onPointerEnter={() => {
                    setActive(i);
                    open(i);
                  }}
                  onPointerLeave={tip.hide}
                >
                  <rect class="col__hit" x={i * slot} y={0} width={slot} height={plotH} />
                  {bh > 0 && (
                    <path
                      class={i === peak ? 'col__peak' : 'col__fill'}
                      d={`M${x},${plotH}V${y + r}Q${x},${y} ${x + r},${y}H${x + barW - r}Q${x + barW},${y} ${x + barW},${y + r}V${plotH}Z`}
                    />
                  )}
                  {i % 6 === 0 && (
                    <text class="col__x" x={x + barW / 2} y={h - 8} text-anchor="middle">
                      {label(i)}
                    </text>
                  )}
                </g>
              );
            })}
            <line class="baseline" x1={0} x2={width} y1={plotH} y2={plotH} />
          </svg>
        )}
      </div>
      <details class="table-view">
        <summary>Show as a table</summary>
        <div class="table-scroll">
          <table>
            <caption class="sr-only">Output tokens by hour of day, Eastern time</caption>
            <thead>
              <tr>
                <th scope="col">Hour</th>
                <th scope="col">Output tokens</th>
              </tr>
            </thead>
            <tbody>
              {hours.map((v, i) => (
                <tr key={i}>
                  <th scope="row">{label(i)}</th>
                  <td>{full(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
