import { OUT, IN, CW, CR, REQ } from '../lib/data.js';
import { compact, famColor, full, pct } from '../lib/format.js';

/** Every model version, every count. Hovering a row spotlights its family in the charts above. */
export default function Models({ models, totals, filter }) {
  const cache = totals.cacheWrite + totals.cacheRead > 0; // Ollama logs no cache split, so Local hides both columns
  return (
    <section class="card card--models" aria-labelledby="t7">
      <header class="card__head">
        <p class="label" id="t7">T.7 Models</p>
        <h2 class="card__title">By model version</h2>
      </header>
      <div class="table-scroll">
        <table class="models">
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">Requests</th>
              <th scope="col">Written</th>
              <th scope="col">Share</th>
              <th scope="col" class="wide">Input</th>
              {cache && <th scope="col" class="wide">Cache write</th>}
              {cache && <th scope="col" class="wide">Cache read</th>}
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr
                key={m.id}
                data-spot={filter.spot === m.family ? '' : undefined}
                data-off={filter.families.includes(m.family) && !filter.enabled.has(m.family) ? '' : undefined}
                tabIndex={0}
                onPointerEnter={() => filter.setSpot(m.family)}
                onPointerLeave={() => filter.setSpot(null)}
                onFocus={() => filter.setSpot(m.family)}
                onBlur={() => filter.setSpot(null)}
              >
                <th scope="row">
                  <span class="key" style={{ background: famColor(m.family) }} />
                  {m.name}
                </th>
                <td>{full(m.t[REQ])}</td>
                <td title={full(m.t[OUT])}>{compact(m.t[OUT])}</td>
                <td>{pct(totals.output ? (m.t[OUT] / totals.output) * 100 : 0)}</td>
                <td class="wide" title={full(m.t[IN])}>{compact(m.t[IN])}</td>
                {cache && <td class="wide" title={full(m.t[CW])}>{compact(m.t[CW])}</td>}
                {cache && <td class="wide" title={full(m.t[CR])}>{compact(m.t[CR])}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
