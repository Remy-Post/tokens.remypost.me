const compactFmt = new Intl.NumberFormat('en-CA', { notation: 'compact', maximumFractionDigits: 1 });
const fullFmt = new Intl.NumberFormat('en-CA');

/** 2_634_258_855 -> "2.6B"; 950 -> "950" */
export const compact = (n) => compactFmt.format(n);
export const full = (n) => fullFmt.format(n);
export const pct = (n, digits = 0) => `${n.toFixed(digits)}%`;

/** Day strings are calendar dates (already in Eastern time), so format them as UTC to avoid shifting. */
const dayFmt = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dayLongFmt = new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
export const day = (d) => dayFmt.format(new Date(`${d}T00:00:00Z`));
export const dayLong = (d) => dayLongFmt.format(new Date(`${d}T00:00:00Z`));

const whenFmt = new Intl.DateTimeFormat('en-CA', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' });
export const when = (ms) => whenFmt.format(new Date(ms));

/** 7_560_000 ms -> "2 h 6 min"; 90_000 -> "2 min" */
export function duration(ms) {
  const min = Math.max(1, Math.round(ms / 60000));
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${m} min`;
  return `${m} min`;
}

/** Three round ticks covering max: 0, step, 2*step... */
export function ticks(max, count = 3) {
  if (!max) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw);
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

/** Fixed family colours live in CSS so both themes stay in one place. */
export const famColor = (f) => `var(--fam-${f.toLowerCase()})`;
