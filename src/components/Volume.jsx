import { compact, dayLong, full } from '../lib/format.js';

/** The one number the page leads with, and the three that put it in scale. */
const LEDE = {
  cloud: (from, out) => `through Claude Code since ${from}. Claude wrote ${out} of them; the rest is it reading my code and its own notes back.`,
  local: (from, out) => `through Ollama on my Mac since ${from}. The models wrote ${out} of them; the rest is the prompts they read.`,
  all: (from, out) => `in the cloud and on my Mac since ${from}. ${out} of them were written by a model.`,
};

export default function Volume({ data }) {
  const { totals, activeDays, busiest, raw, view } = data;
  return (
    <section class="card card--volume" aria-labelledby="t1">
      <p class="label" id="t1">T.1 Volume</p>
      <p class="hero" title={`${full(totals.all)} tokens`}>
        {compact(totals.all)}
        <span class="hero__unit">tokens</span>
      </p>
      <p class="voice lede">{LEDE[view](dayLong(raw.range.from), compact(totals.output))}</p>
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
