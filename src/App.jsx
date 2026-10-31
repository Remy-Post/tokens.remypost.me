import { useEffect, useMemo, useState } from 'preact/hooks';
import Calendar from './components/Calendar.jsx';
import Daily from './components/Daily.jsx';
import Hours from './components/Hours.jsx';
import Limits from './components/Limits.jsx';
import Mix from './components/Mix.jsx';
import Models from './components/Models.jsx';
import Tooltip from './components/Tooltip.jsx';
import Volume from './components/Volume.jsx';
import { derive } from './lib/data.js';
import { duration, when } from './lib/format.js';
import { TipContext } from './lib/hooks.js';

const STALE_MS = 13 * 3600 * 1000; // exports land at 00:00 and 12:00 Eastern

export default function App() {
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [tip, setTip] = useState(null);

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

  const data = useMemo(() => raw && raw.range && derive(raw), [raw]);
  const tipApi = useMemo(
    () => ({
      show: (el, content) => setTip({ rect: el.getBoundingClientRect(), content }),
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
      <header class="bar">
        <div class="wrap bar__inner">
          <a class="brand" href="https://remypost.me" aria-label="Remy Post, home">
            <span class="monogram" aria-hidden="true">
              <span>R</span>
              <span>P</span>
            </span>
            <span class="brand__name">Remy Post</span>
          </a>
          <a class="bar__link ul" href="https://remypost.me">
            remypost.me
          </a>
        </div>
      </header>

      <main id="main" class="wrap">
        <div class="intro">
          <p class="label">Appendix T</p>
          <h1>
            How much Claude <em class="voice">I use.</em>
          </h1>
          <p class="voice intro__sub">
            Every token my Claude Max subscription has spent in Claude Code. Counted on my Mac from Claude Code's own
            logs, published here at noon and midnight.
          </p>
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
            <Limits limits={data.limits} now={now} />
            <Calendar days={data.days} />
            <Mix totals={data.totals} />
            <Daily data={data} />
            <Hours hours={data.hours} />
            <Models models={data.models} totals={data.totals} />
          </div>
        )}

        <section class="method" aria-labelledby="method">
          <p class="label" id="method">Method</p>
          <ul>
            <li>
              Counts come from Claude Code's transcripts on my Mac, deduplicated per response. Chats on claude.ai and
              other machines aren't included.
            </li>
            <li>Plan limits come from Claude Code's documented status-line data. No passwords or tokens are read.</li>
            <li>Only totals leave my machine: no prompts, file names or projects.</li>
            {raw && <li>Last export: {when(Date.parse(raw.generatedAt))} Eastern.</li>}
          </ul>
        </section>
      </main>

      <footer class="foot wrap">
        <span>© Remy Post</span>
        <span>
          <a class="ul" href="https://remypost.me">remypost.me</a> ·{' '}
          <a class="ul" href="https://github.com/Remy-Post">GitHub</a>
        </span>
      </footer>
      <Tooltip tip={tip} />
    </TipContext.Provider>
  );
}
