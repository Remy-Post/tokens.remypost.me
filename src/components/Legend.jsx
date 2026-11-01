import { famColor } from '../lib/format.js';

/**
 * Family chips that double as filters. Click shows or hides a family everywhere it's stacked; double-click
 * shows only that one; hovering or focusing a chip spotlights the family in every chart.
 */
export default function Legend({ filter, series = filter.families }) {
  const { enabled, spot, setSpot, toggle, only } = filter;
  return (
    <ul class="legend" role="group" aria-label="Model families. Press to show or hide.">
      {series.map((f) => {
        const fixed = !filter.families.includes(f); // e.g. "Other": shown, not filterable
        return (
          <li key={f}>
            <button
              type="button"
              class="chip"
              style={{ '--key': famColor(f) }}
              aria-pressed={fixed ? undefined : enabled.has(f)}
              disabled={fixed}
              data-spot={spot === f ? '' : undefined}
              onClick={() => toggle(f)}
              onDblClick={() => only(f)}
              onPointerEnter={() => setSpot(f)}
              onPointerLeave={() => setSpot(null)}
              onFocus={() => setSpot(f)}
              onBlur={() => setSpot(null)}
            >
              <span class="chip__key" aria-hidden="true" />
              {f}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
