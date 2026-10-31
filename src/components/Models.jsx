import { OUT, IN, CW, CR, REQ } from '../lib/data.js';
import { compact, full, pct } from '../lib/format.js';
import { famColor } from './Daily.jsx';

/** Every model version, every count. Also the table view for the charts above. */
export default function Models({ models, totals }) {
  return (
    <section class="card card--models" aria-labelledby="t7">
      <p class="label" id="t7">T.7 Models</p>
      <h2 class="card__title">By model version</h2>
      <div class="table-scroll">
        <table class="models">
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">Requests</th>
              <th scope="col">Written</th>
              <th scope="col">Share</th>
              <th scope="col" class="wide">Input</th>
              <th scope="col" class="wide">Cache write</th>
              <th scope="col" class="wide">Cache read</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id}>
                <th scope="row">
                  <span class="legend__key" style={{ background: famColor(m.family) }} />
                  {m.name}
                </th>
                <td>{full(m.t[REQ])}</td>
                <td title={full(m.t[OUT])}>{compact(m.t[OUT])}</td>
                <td>{pct(totals.output ? (m.t[OUT] / totals.output) * 100 : 0)}</td>
                <td class="wide" title={full(m.t[IN])}>{compact(m.t[IN])}</td>
                <td class="wide" title={full(m.t[CW])}>{compact(m.t[CW])}</td>
                <td class="wide" title={full(m.t[CR])}>{compact(m.t[CR])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
