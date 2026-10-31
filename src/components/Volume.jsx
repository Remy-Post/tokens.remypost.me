import { compact, dayLong, full } from '../lib/format.js';

/** The one number the page leads with, and the three that put it in scale. */
export default function Volume({ data }) {
  const { totals, activeDays, busiest, raw } = data;
  return (
    <section class="card card--volume" aria-labelledby="t1">
      <p class="label" id="t1">T.1 Volume</p>
      <p class="hero" title={`${full(totals.all)} tokens`}>
        {compact(totals.all)}
        <span class="hero__unit">tokens</span>
      </p>
      <p class="voice lede">
        through Claude Code since {dayLong(raw.range.from)}. Claude wrote {compact(totals.output)} of them; the rest is
        it reading my code and its own notes back.
      </p>
      <dl class="stats">
        <div>
          <dt>Requests</dt>
          <dd>{compact(totals.requests)}</dd>
        </div>
        <div>
          <dt>Days in use</dt>
          <dd>{activeDays}</dd>
        </div>
        {busiest && (
          <div>
            <dt>Busiest day</dt>
            <dd>
              {compact(busiest.out)} <small>out · {dayLong(busiest.d)}</small>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
