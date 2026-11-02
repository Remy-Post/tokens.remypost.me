import { toWeeks } from '../lib/data.js';
import { day, dayLong } from '../lib/format.js';
import { useWidth } from '../lib/hooks.js';
import Legend from './Legend.jsx';
import StackedBars from './StackedBars.jsx';
import TableView from './TableView.jsx';

/** Output per day over the same three months as the calendar, stacked by model family. */
export default function Daily({ days, filter, echo, title = 'Which Claude did the writing' }) {
  const [box, width] = useWidth();
  const { families } = filter;
  // One column per day while each gets at least 6px, otherwise one per week.
  const weekly = days.length * 6 > Math.max(0, width - 44);
  const bins = (weekly ? toWeeks(days, families) : days).map((b, i, all) => ({
    key: b.d,
    keys: weekly ? days.filter((d) => d.d >= b.d && d.d <= b.end).map((d) => d.d) : [b.d],
    fam: b.fam,
    pre: weekly ? days.filter((d) => d.d >= b.d && d.d <= b.end).every((d) => d.pre) : b.pre,
    title: weekly ? `Week of ${day(b.d)}` : dayLong(b.d),
    x: day(b.d),
  }));

  return (
    <section class="card card--daily" aria-labelledby="t4" ref={box}>
      <header class="card__head">
        <p class="label" id="t4">T.4 Used by model</p>
        <h2 class="card__title">{title}</h2>
        <p class="fine">Output tokens {weekly ? 'per week' : 'per day'} over the last three months.</p>
      </header>
      <Legend filter={filter} />
      <StackedBars
        name="day"
        bins={bins}
        series={families}
        filter={filter}
        echo={echo}
        label={`Output tokens ${weekly ? 'per week' : 'per day'} over the last three months, stacked by model family.`}
        height={(w) => Math.round(Math.min(380, Math.max(200, w * 0.42)))}
      />
      <TableView
        caption={`Output tokens ${weekly ? 'per week' : 'per day'} by model family`}
        head={[weekly ? 'Week of' : 'Day', ...families, 'Total']}
        rows={[...(weekly ? toWeeks(days, families) : days)]
          .reverse()
          .filter((b) => b.out > 0)
          .map((b) => [dayLong(b.d), ...families.map((f) => b.fam[f]), b.out])}
      />
    </section>
  );
}
