import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function teamsToSlug(teams) {
  // Normalise separators " - " and " x " → " vs "
  const normalised = teams
    .replace(/\s+-\s+/g, ' vs ')
    .replace(/\s+x\s+/g, ' vs ');
  return toSlug(normalised);
}

function teamsToDisplay(teams, separator = ' - ') {
  if (separator === ' x ') {
    return teams.replace(/\s+x\s+/g, ' vs ');
  }
  return teams.replace(/\s+-\s+/g, ' vs ');
}

const CATEGORY_MAP = [
  ['football',   ['futbol', 'fútbol', 'soccer', 'football', 'fifa', 'uefa', 'champions', 'europa', 'premier', 'laliga', 'serie a', 'bundesliga', 'ligue 1', 'ligue', 'mls', 'copa', 'conmebol', 'world cup', 'euro', 'mundial', 'liga', 'nfl']],
  ['basketball', ['basketball', 'nba', 'ncaa', 'euroleague', 'basket']],
  ['baseball',   ['baseball', 'mlb', 'béisbol', 'beisbol']],
  ['tennis',     ['tennis', 'tenis', 'atp', 'wta', 'grand slam', 'wimbledon', 'roland']],
  ['cricket',    ['cricket', 'ipl', 'test match']],
  ['hockey',     ['hockey', 'nhl']],
  ['boxing',     ['boxing', 'boxeo', 'wbc', 'wba', 'wbo']],
  ['mma',        ['mma', 'ufc', 'fight']],
  ['darts',      ['darts', 'pdc', 'dardo']],
];

function detectCategory(text) {
  if (!text) return 'other';
  const lower = text.toLowerCase();
  for (const [cat, keywords] of CATEGORY_MAP) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'other';
}

async function safeFetch(url) {
  try {
    console.log(`  Fetching ${url} …`);
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  WARNING: HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`  WARNING: Failed to fetch ${url} — ${err.message}`);
    return null;
  }
}

// Slug uniqueness tracker (shared across all sources)
const usedSlugs = new Map(); // slug → count

function uniqueSlug(baseSlug, serverNum) {
  if (!usedSlugs.has(baseSlug)) {
    usedSlugs.set(baseSlug, 1);
    return baseSlug;
  }
  // Duplicate — append server suffix
  const suffixed = `${baseSlug}-s${serverNum}`;
  if (!usedSlugs.has(suffixed)) {
    usedSlugs.set(suffixed, 1);
    return suffixed;
  }
  // Still duplicate — keep incrementing
  let i = 2;
  while (usedSlugs.has(`${suffixed}-${i}`)) i++;
  const final = `${suffixed}-${i}`;
  usedSlugs.set(final, 1);
  return final;
}

// ---------------------------------------------------------------------------
// S1 — Primary source
// URL: rereyano_data.json
// Times: CET (UTC+2), date "DD-MM-YYYY", time "HH:MM"
// ---------------------------------------------------------------------------

async function fetchS1() {
  const url = 'https://raw.githubusercontent.com/albinchristo04/arda/refs/heads/main/rereyano_data.json';
  console.log('Fetching S1 …');
  const data = await safeFetch(url);
  if (!data) return [];

  const events = data.events ?? data ?? [];
  if (!Array.isArray(events)) {
    console.warn('  WARNING: S1 events is not an array');
    return [];
  }

  const results = [];
  for (const ev of events) {
    try {
      // Parse date "DD-MM-YYYY"
      const [dd, mm, yyyy] = (ev.date ?? '').split('-').map(Number);
      const [hh, min] = (ev.time ?? '00:00').split(':').map(Number);

      if (!dd || !mm || !yyyy) {
        console.warn(`  WARNING: S1 bad date for event: ${JSON.stringify(ev)}`);
        continue;
      }

      // CET is UTC+2: subtract 2 hours to get UTC
      // Using Date.UTC with adjusted hours
      const startMs = Date.UTC(yyyy, mm - 1, dd, hh - 2, min, 0);
      const startTime = Math.floor(startMs / 1000);
      const endTime = startTime + 7200; // default +2h

      const teamsRaw = ev.teams ?? '';
      const teamsDisplay = teamsToDisplay(teamsRaw, ' - ');
      const baseSlug = teamsToSlug(teamsRaw);
      const id = uniqueSlug(baseSlug, 1);

      const league = ev.league ?? '';
      const category = detectCategory(league);

      const channels = (ev.channels ?? []).map((ch, idx) => ({
        name: `Canal ${idx + 1}`,
        lang: ch.lang ?? 'es',
        embedUrl: `https://cartelive.club/player/1/${ch.id}`,
      }));

      results.push({
        id,
        teams: teamsDisplay,
        league,
        category,
        startTime,
        endTime,
        server: 1,
        channels,
        poster: null,
        viewers: null,
      });
    } catch (err) {
      console.warn(`  WARNING: S1 failed to parse event — ${err.message}`);
    }
  }

  console.log(`  S1: ${results.length} events parsed`);
  return results;
}

// ---------------------------------------------------------------------------
// S2 — Secondary source
// URL: sports_events.json
// Times: UTC, organized by day name
// ---------------------------------------------------------------------------

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function parseDateFlexible(str) {
  if (!str) return null;
  // Try ISO format first
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function getDateForDayName(dayName, referenceDate) {
  const refDay = referenceDate.getUTCDay(); // 0=Sun … 6=Sat
  const targetDay = DAY_NAMES.indexOf(dayName.toUpperCase());
  if (targetDay === -1) return null;
  const diff = targetDay - refDay;
  const d = new Date(referenceDate);
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

async function fetchS2() {
  const url = 'https://raw.githubusercontent.com/albinchristo04/mayiru/refs/heads/main/sports_events.json';
  console.log('Fetching S2 …');
  const data = await safeFetch(url);
  if (!data) return [];

  // Determine reference date from last_updated
  let referenceDate = parseDateFlexible(data.last_updated);
  if (!referenceDate) {
    console.warn('  WARNING: S2 last_updated missing or unparseable, using today as reference');
    referenceDate = new Date();
  }

  const eventsObj = data.events ?? {};
  if (typeof eventsObj !== 'object' || Array.isArray(eventsObj)) {
    console.warn('  WARNING: S2 events is not an object');
    return [];
  }

  const results = [];
  for (const [dayName, dayEvents] of Object.entries(eventsObj)) {
    if (!Array.isArray(dayEvents)) continue;

    const dayDate = getDateForDayName(dayName, referenceDate);
    if (!dayDate) {
      console.warn(`  WARNING: S2 unknown day name: ${dayName}`);
      continue;
    }

    for (const ev of dayEvents) {
      try {
        const [hh, min] = (ev.time ?? '00:00').split(':').map(Number);

        const startMs = Date.UTC(
          dayDate.getUTCFullYear(),
          dayDate.getUTCMonth(),
          dayDate.getUTCDate(),
          hh,
          min,
          0,
        );
        const startTime = Math.floor(startMs / 1000);
        const endTime = startTime + 7200;

        const eventRaw = ev.event ?? '';
        const teamsDisplay = teamsToDisplay(eventRaw, ' x ');
        const baseSlug = teamsToSlug(eventRaw);
        const id = uniqueSlug(baseSlug, 2);

        // Try to guess league/category from event name — S2 has no explicit league field
        const category = detectCategory(eventRaw);

        const streams = ev.streams ?? [];
        const channels = streams.map((streamUrl, idx) => ({
          name: `Canal ${idx + 1}`,
          lang: 'es',
          embedUrl: streamUrl,
        }));

        results.push({
          id,
          teams: teamsDisplay,
          league: '',
          category,
          startTime,
          endTime,
          server: 2,
          channels,
          poster: null,
          viewers: null,
        });
      } catch (err) {
        console.warn(`  WARNING: S2 failed to parse event — ${err.message}`);
      }
    }
  }

  console.log(`  S2: ${results.length} events parsed`);
  return results;
}

// ---------------------------------------------------------------------------
// S3 — Tertiary source
// URL: events.json
// Times: Unix timestamps (starts_at, ends_at)
// ---------------------------------------------------------------------------

async function fetchS3() {
  const url = 'https://raw.githubusercontent.com/albinchristo04/ptv/refs/heads/main/events.json';
  console.log('Fetching S3 …');
  const data = await safeFetch(url);
  if (!data) return [];

  const streams = data.events?.streams ?? [];
  if (!Array.isArray(streams)) {
    console.warn('  WARNING: S3 events.streams is not an array');
    return [];
  }

  const results = [];
  for (const categoryGroup of streams) {
    const categoryLabel = categoryGroup.category ?? categoryGroup.category_name ?? '';
    const categoryEvents = categoryGroup.streams ?? [];

    if (!Array.isArray(categoryEvents)) continue;

    for (const ev of categoryEvents) {
      try {
        const startTime = typeof ev.starts_at === 'number' ? ev.starts_at : parseInt(ev.starts_at, 10);
        const endTime = typeof ev.ends_at === 'number' ? ev.ends_at : parseInt(ev.ends_at, 10) || startTime + 7200;

        if (isNaN(startTime)) {
          console.warn(`  WARNING: S3 invalid starts_at for event: ${ev.name}`);
          continue;
        }

        const teamsRaw = ev.name ?? '';
        // S3 uses "Team A vs. Team B" or similar — normalise to "vs"
        const teamsDisplay = teamsRaw.replace(/\s+vs\.\s+/gi, ' vs ').replace(/\s+-\s+/g, ' vs ').replace(/\s+x\s+/g, ' vs ');
        const baseSlug = toSlug(teamsDisplay);
        const id = uniqueSlug(baseSlug, 3);

        const league = ev.tag ?? ev.category_name ?? categoryLabel ?? '';
        const category = detectCategory(ev.category_name ?? categoryLabel ?? league);

        const embedUrl = ev.iframe ?? '';
        const channels = embedUrl
          ? [{ name: 'Canal 1', lang: 'en', embedUrl }]
          : [];

        results.push({
          id,
          teams: teamsDisplay,
          league,
          category,
          startTime,
          endTime,
          server: 3,
          channels,
          poster: ev.poster ?? null,
          viewers: ev.viewers ? String(ev.viewers) : null,
        });
      } catch (err) {
        console.warn(`  WARNING: S3 failed to parse event — ${err.message}`);
      }
    }
  }

  console.log(`  S3: ${results.length} events parsed`);
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== fetch-data.mjs starting ===');

  // Ensure output directory exists
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Output directory: ${DATA_DIR}`);

  const [s1, s2, s3] = await Promise.all([fetchS1(), fetchS2(), fetchS3()]);

  // Combined + sorted by startTime ascending
  const all = [...s1, ...s2, ...s3].sort((a, b) => a.startTime - b.startTime);

  // Write individual files
  const write = (filename, data) => {
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`  Wrote ${filePath} (${data.length} records)`);
  };

  write('s1-matches.json', s1);
  write('s2-matches.json', s2);
  write('s3-matches.json', s3);
  write('all-matches.json', all);

  console.log(`=== Done. Total events: ${all.length} (S1: ${s1.length}, S2: ${s2.length}, S3: ${s3.length}) ===`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
