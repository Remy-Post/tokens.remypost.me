import { useEffect, useMemo, useState } from 'preact/hooks';
import Calendar from './components/Calendar.jsx';
import Daily from './components/Daily.jsx';
import Hours from './components/Hours.jsx';
import Limits from './components/Limits.jsx';
import Mix from './components/Mix.jsx';
import Models from './components/Models.jsx';
import Tooltip from './components/Tooltip.jsx';
import Volume from './components/Volume.jsx';
import { VIEWS, derive } from './lib/data.js';
import { dayLong, duration, when } from './lib/format.js';
import { TipContext, useFamilyFilter } from './lib/hooks.js';

const STALE_MS = 13 * 3600 * 1000; // exports land at 00:00 and 12:00 Eastern

const COPY = {
  cloud: {
    lead: 'How much Claude',
    voice: 'I use.',
    sub: "Every token my Claude Max subscription has spent in Claude Code. Counted on my Mac from Claude Code's own logs, published here at noon and midnight.",
    calendar: 'What Claude wrote, day by day',
    daily: 'Which Claude did the writing',
  },
  local: {
    lead: 'How much runs',
    voice: 'on my Mac.',
    sub: "Every token my local models have read and written through Ollama. Counted from Ollama's own logs on the same Mac, published with the cloud numbers.",
    calendar: 'What my Mac wrote, day by day',
    daily: 'Which model did the writing',
  },
  all: {
    lead: 'Every token',
    voice: 'I use.',
    sub: 'Claude in the cloud and the models on my Mac, added together. Published at noon and midnight.',
    calendar: 'What got written, day by day',
    daily: 'Cloud or local',
  },
};
const LABEL = { cloud: 'Cloud', local: 'Local', all: 'All' };

/** ?view=local and ?view=all are shareable; cloud is the default and keeps the plain URL. */
function initialView() {
  const v = new URLSearchParams(location.search).get('view');
  return VIEWS.includes(v) ? v : 'cloud';
}

export default function App() {
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [tip, setTip] = useState(null);
  const [echo, setEcho] = useState(null); // the calendar day under the pointer, echoed in the model chart
  const [view, setView] = useState(initialView);
  const pick = (v) => {
    setView(v);
    setEcho(null);
    history.replaceState(null, '', v === 'cloud' ? location.pathname : `?view=${v}`);
  };

  const load = () => {
    setError(null);
    fetch('/data/usage.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (json?.v !== 1) throw new Error('Unknown data version');
        setRaw(json);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);
  // Reset countdowns tick once a minute; nothing else moves.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const hasLocal = Boolean(raw?.local?.range);
  const shown = raw && !hasLocal ? 'cloud' : view; // a ?view= link keeps its heading while the data loads
  const copy = COPY[shown];
  const data = useMemo(() => raw && raw.range && derive(raw, shown), [raw, shown]);
  const filter = useFamilyFilter(data?.families ?? []);
  const tipApi = useMemo(
    () => ({
      // The card's bounds and the foot of its heading keep the tooltip inside the chart it describes,
      // clear of the card's title and of the cards beside it.
      show: (el, content) => {
        const card = el.closest('.card');
        setTip({
          rect: el.getBoundingClientRect(),
          bounds: card?.getBoundingClientRect(),
          ceiling: card?.querySelector('.card__head')?.getBoundingClientRect().bottom,
          content,
        });
      },
      hide: () => setTip(null),
    }),
    [],
  );
  useEffect(() => {
    if (!tip) return;
    const close = () => setTip(null);
    addEventListener('scroll', close, { passive: true, once: true });
    return () => removeEventListener('scroll', close);
  }, [tip]);

  const age = raw ? now - Date.parse(raw.generatedAt) : 0;

  return (
    <TipContext.Provider value={tipApi}>
      <a class="skip" href="#main">
        Skip to the numbers
      </a>
      <main id="main" class="wrap">
        <div class="intro">
          <p class="label">Appendix T</p>
          <h1>
            {copy.lead} <em class="voice">{copy.voice}</em>
          </h1>
          <p class="voice intro__sub">{copy.sub}</p>
          {hasLocal && (
            <fieldset class="view">
              <legend>Which tokens to show</legend>
              {VIEWS.map((v) => (
                <label key={v}>
                  <input type="radio" name="view" value={v} checked={shown === v} onChange={() => pick(v)} />
                  {LABEL[v]}
                </label>
              ))}
            </fieldset>
          )}
          {raw && age > STALE_MS && (
            <p class="notice" role="status">
              <span aria-hidden="true">▲</span> Last update was {duration(age)} ago. The Mac is probably asleep; the next one
              catches up on wake.
            </p>
          )}
        </div>

        {error && (
          <div class="card notice notice--error" role="alert">
            <p>The numbers didn't load ({error}).</p>
            <button class="btn btn--line" type="button" onClick={load}>
              Try again
            </button>
          </div>
        )}
        {!data && !error && (
          <p class="loading" aria-live="polite">
            Counting…
          </p>
        )}

        {data && (
          <div class="board">
            <Volume data={data} />
            {shown !== 'local' && <Limits limits={data.limits} now={now} />}
            <Calendar days={data.window} families={data.series} from={data.raw.range.from} onDay={setEcho} title={copy.calendar} />
            <Daily days={data.window} series={data.series} filter={filter} echo={echo} title={copy.daily} />
            <Hours hours={data.hours} byFamily={data.hoursByFamily} filter={filter} />
            <Mix totals={data.totals} view={shown} />
            <Models models={data.models} totals={data.totals} filter={filter} />
          </div>
        )}

        <section class="method" aria-labelledby="method">
          <p class="label" id="method">Method</p>
          <ul>
            <li>
              Counts come from Claude Code's transcripts on my Mac, deduplicated per response. Chats on claude.ai and
              other machines aren't included.
            </li>
            {hasLocal && (
              <li>
                Local counts come from Ollama's server logs on the same Mac, which record each request's prompt and output
                tokens. They start {dayLong(raw.local.range.from)}, the oldest log Ollama kept. Requests served by Ollama's
                newer engine (mxfp8 builds) log no token counts and aren't included.
              </li>
            )}
            <li>Plan limits come from Claude Code's documented status-line data. No passwords or tokens are read.</li>
            <li>Only totals leave my machine: no prompts, file names or projects.</li>
            {raw && <li>Last export: {when(Date.parse(raw.generatedAt))} Eastern.</li>}
          </ul>
        </section>
      </main>

      <footer class="foot wrap">
        <a class="foot__brand" href="https://remypost.me" aria-label="Remy Post, home">
          <span class="monogram" aria-hidden="true">
            <span>R</span>
            <span>P</span>
          </span>
          <span>© Remy Post</span>
        </a>
        <span>
          <a class="ul" href="https://remypost.me">remypost.me</a> ·{' '}
          <a class="ul" href="https://github.com/Remy-Post">GitHub</a>
        </span>
      </footer>
      <Tooltip tip={tip} />
    </TipContext.Provider>
  );
}
