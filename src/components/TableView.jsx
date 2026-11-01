import { full } from '../lib/format.js';

/** The table behind every chart: one row per mark, a column per series. Zero cells show as a dash. */
export default function TableView({ caption, head, rows }) {
  return (
    <details class="table-view">
      <summary>Show as a table</summary>
      <div class="table-scroll">
        <table>
          <caption class="sr-only">{caption}</caption>
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, ...cells]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {cells.map((v, i) => (
                  <td key={i}>{v ? full(v) : '–'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
