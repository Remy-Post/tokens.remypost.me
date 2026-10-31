import { compact, full, pct } from '../lib/format.js';

/** Four kinds of token, as numbers. They differ by orders of magnitude, so a bar would hide three of them. */
export default function Mix({ totals }) {
  const share = (n) => (totals.all ? (n / totals.all) * 100 : 0);
  const rows = [
    ['Read from cache', totals.cacheRead, 'Context Claude already had, re-read each turn. Cheap and fast.'],
    ['Written to cache', totals.cacheWrite, 'New context stored so later turns can reuse it.'],
    ['Written by Claude', totals.output, `Code, prose and plans. ${compact(totals.thinking)} of it was thinking.`],
    ['Fresh input', totals.input, 'Text sent without caching: my messages, mostly.'],
  ];
  return (
    <section class="card card--mix" aria-labelledby="t5">
      <p class="label" id="t5">T.5 Where tokens go</p>
      <ul class="mix">
        {rows.map(([label, n, note]) => (
          <li key={label} class="mix__item">
            <span class="mix__label">{label}</span>
            <span class="mix__value" title={`${full(n)} tokens`}>
              {compact(n)}
            </span>
            <span class="mix__share">{share(n) < 0.1 ? '<0.1%' : pct(share(n), share(n) < 10 ? 1 : 0)}</span>
            <span class="mix__note">{note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
