import Legend from './Legend.jsx';
import StackedBars from './StackedBars.jsx';
import TableView from './TableView.jsx';

const label = (h) => (h === 0 ? '12 am' : h === 12 ? 'noon' : h < 12 ? `${h} am` : `${h - 12} pm`);

/**
 * Output by hour of day, Eastern, stacked by model family with the same filter as the model chart.
 * Older exports without per-model hours fall back to one series.
 */
export default function Hours({ hours, byFamily, filter }) {
  const fams = byFamily ? [...filter.families, ...('Other' in byFamily[0] ? ['Other'] : [])] : ['Other'];
  const rows = byFamily ?? hours.map((v) => ({ Other: v }));
  const shown = fams.filter((f) => filter.enabled.has(f) || !filter.families.includes(f));
  const totals = rows.map((r) => shown.reduce((s, f) => s + (r[f] ?? 0), 0));
  const peak = totals.indexOf(Math.max(...totals));
  const bins = rows.map((r, i) => ({
    key: i,
    fam: r,
    peak: totals[peak] > 0 && i === peak,
    title: `${label(i)} to ${label((i + 1) % 24)}`,
    x: i % 6 === 0 ? label(i) : null,
  }));

  return (
    <section class="card card--hours" aria-labelledby="t5">
      <header class="card__head">
        <p class="label" id="t5">T.5 Hours</p>
        <h2 class="card__title">When the writing happens</h2>
        <p class="fine">
          Output by hour, Eastern time{byFamily ? ', split by model' : ''}.
          {totals[peak] > 0 && <> Busiest: {label(peak)}.</>}
        </p>
      </header>
      {byFamily && <Legend filter={filter} series={fams} />}
      <StackedBars
        name="hr"
        bins={bins}
        series={fams}
        filter={filter}
        axis={false}
        sparseX={false}
        label="Output tokens by hour of day, stacked by model family."
        height={(w) => Math.round(Math.min(300, Math.max(170, w * 0.46)))}
      />
      <TableView
        caption="Output tokens by hour of day, Eastern time"
        head={['Hour', ...(byFamily ? fams : []), 'Total']}
        rows={hours.map((v, i) => [label(i), ...(byFamily ? fams.map((f) => rows[i][f]) : []), v])}
      />
    </section>
  );
}
