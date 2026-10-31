import { duration, pct, when } from '../lib/format.js';

const WINDOWS = [
  ['fiveHour', '5-hour window', 'Resets five hours after the first message of a session.'],
  ['sevenDay', 'Weekly limit', 'Rolling seven days across every model.'],
];

/** Status is never colour alone: each level carries an icon and words. */
function level(p) {
  if (p >= 90) return { key: 'critical', icon: '■', text: 'Near the limit' };
  if (p >= 75) return { key: 'warning', icon: '▲', text: 'Getting close' };
  return null;
}

function Meter({ label, note, w, now }) {
  const resetMs = w.resetsAt ? w.resetsAt * 1000 : null;
  const lapsed = resetMs != null && resetMs <= now;
  const p = Math.min(100, Math.max(0, w.pct));
  const lvl = lapsed ? null : level(p);
  return (
    <div class="meter" data-level={lvl?.key} data-lapsed={lapsed ? '' : undefined}>
      <div class="meter__head">
        <span class="meter__name">{label}</span>
        <span class="meter__pct">{pct(p)}</span>
      </div>
      <div class="meter__track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(p)} aria-label={`${label} used`}>
        <div class="meter__fill" style={{ width: `${p}%` }} />
      </div>
      <p class="meter__foot">
        {lvl && (
          <span class="meter__status">
            <span aria-hidden="true">{lvl.icon}</span> {lvl.text} ·{' '}
          </span>
        )}
        {lapsed
          ? 'This window has reset since the reading.'
          : resetMs
            ? `Resets ${when(resetMs)} (in ${duration(resetMs - now)}).`
            : note}
      </p>
    </div>
  );
}

export default function Limits({ limits, now }) {
  const shown = limits && WINDOWS.filter(([k]) => limits[k]);
  return (
    <section class="card card--limits" aria-labelledby="t2">
      <p class="label" id="t2">T.2 Plan limits · Max 5x</p>
      {shown?.length ? (
        <>
          {shown.map(([k, label, note]) => (
            <Meter key={k} label={label} note={note} w={limits[k]} now={now} />
          ))}
          <p class="fine">
            Read {duration(now - Date.parse(limits.capturedAt))} ago from Claude Code's status line, the last time I had it
            open. Same numbers as <code>/usage</code>.
          </p>
        </>
      ) : (
        <p class="fine">
          No reading yet. Claude Code reports plan limits to its status line, and the next session will record one.
        </p>
      )}
    </section>
  );
}
