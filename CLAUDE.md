# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**deportesenvivo.live** — A Spanish-language sports streaming hub. Static site (Astro 5.x SSG) deployed to GitHub Pages via GitHub Actions every 30 minutes. Fetches live match data from 3 external JSON sources at build time.

Full specification is in `PROJECT.md` — read it before building anything.

## Commands

```bash
npm install
npm run build          # runs: node scripts/fetch-data.mjs && astro build
npm run dev            # astro dev (uses existing src/data/*.json)
```

> `scripts/fetch-data.mjs` MUST run before `astro build` — it generates `src/data/*.json` from the 3 remote sources.

## Architecture

### Data Flow (Build Time)
```
3 external JSON sources → scripts/fetch-data.mjs → src/data/{s1,s2,s3,all}-matches.json → Astro SSG → static HTML
```

- **S1** (`rereyano_data.json`): times in CET (UTC+2), embed URL = `https://cartelive.club/vip3.php/player/{channelId}/1`
- **S2** (`sports_events.json`): times in UTC, day-name keys (TUESDAY…), embed = stream URL directly
- **S3** (`events.json`): Unix timestamps, has poster images, use `iframe` field directly

Normalized event shape is defined in PROJECT.md §Data Processing.

### Pages
- `/` — Homepage with 3-server tab switcher + category filter pills
- `/match/[...slug]` — Player page; `?s=1|2|3` selects server, `?ch=0` selects channel
- `/embed/[...path]` — Minimal embed page for webmasters (no header/footer, `EmbedLayout.astro`)
- `/compartir` — Share tool: formats today's matches as Telegram-ready text
- 12 hub/SEO pages (`/futbol-libre`, `/pirlo-tv`, `/tarjeta-roja`, etc.)

### Key Implementation Rules

1. **Iframe sandboxing**: Source iframes must use `sandbox="allow-scripts allow-same-origin"` — no `allow-popups`. This blocks source-site popup ads. Adsterra script runs on the parent page outside the sandbox.
2. **Time display**: All times shown to users must be local timezone via `Intl.DateTimeFormat` in client JS. Build-time data stores UTC timestamps.
3. **Live badge**: `now >= startTime && now <= endTime` → show red pulsing "EN VIVO" badge.
4. **Slug uniqueness**: If two matches resolve to same slug, append server number.
5. **S2 day mapping**: Use `last_updated` field to anchor day names to real dates.
6. **Fetch resilience**: If one source fails, build proceeds with the other two.

### Tracking
Supabase (MCP-connected) tracks page views and embed views via client-side POST to Supabase REST API using the anon key. Tables: `page_views`, `embed_views` — see PROJECT.md §Supabase Setup for schema and RLS policies.

### Ads
Adsterra popup script placed on every page (homepage, hub pages, match pages, embed pages). See PROJECT.md for the script tag.

### CI/CD
`.github/workflows/deploy.yml` — triggers on push, every 30 min, and manual dispatch. Steps: fetch data → build → deploy to GitHub Pages → ping IndexNow.

## Dependencies
Minimal: only `astro` and `@astrojs/sitemap`. Google Fonts loaded via `<link>`, not npm.

## Design Tokens
Dark theme: background `#0a0a0f`, surface `#12121a`, primary red `#e53e3e`, accent teal `#38b2ac`. Font: Inter. Full token list in PROJECT.md §Design System.
