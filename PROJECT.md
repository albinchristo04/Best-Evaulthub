# deportesenvivo.live — Full Project Specification

> **For Claude Code**: Build this entire project in THIS repo (`Best-Evaulthub`). Follow every section precisely.

## Tech Stack

- **Framework**: Astro 5.x (SSG, `output: 'static'`)
- **Styling**: Vanilla CSS (dark theme, premium design)
- **Deployment**: GitHub Pages + Cloudflare
- **Domain**: `deportesenvivo.live`
- **View Tracking**: Supabase (MCP connected — use it to create tables)
- **Ads**: Adsterra popup only (script below)
- **Language**: Spanish primary

---

## Data Sources

### S1 — Primary (Spanish, SEO content)
**URL**: `https://raw.githubusercontent.com/albinchristo04/arda/refs/heads/main/rereyano_data.json`
**Timezone**: CET (UTC+2) — times like "04:10" mean 04:10 CET
**Structure**:
```json
{
  "events": [
    {
      "date": "01-04-2026",
      "time": "04:10",
      "league": "MLB",
      "teams": "Los Angeles Dodgers - Cleveland Guardians",
      "channels": [{ "id": "5", "lang": "fr" }, { "id": "198", "lang": "us" }]
    }
  ]
}
```
**Embed URL pattern**: `https://cartelive.club/vip3.php/player/{channelId}/1`
**Label on site**: "Servidor 1"

### S2 — Secondary
**URL**: `https://raw.githubusercontent.com/albinchristo04/mayiru/refs/heads/main/sports_events.json`
**Timezone**: UTC — organized by day names (TUESDAY, WEDNESDAY, etc.)
**Structure**:
```json
{
  "events": {
    "TUESDAY": [
      {
        "time": "00:00",
        "event": "USA x Portugal",
        "streams": ["https://w2.sportzsonline.click/channels/hd/hd1.php"]
      }
    ]
  }
}
```
**Embed URL**: Use the stream URLs directly as iframe src
**Label on site**: "Servidor 2"

### S3 — Tertiary (English, has posters)
**URL**: `https://raw.githubusercontent.com/albinchristo04/ptv/refs/heads/main/events.json`
**Timezone**: Unix timestamps (`starts_at`, `ends_at`)
**Structure**:
```json
{
  "events": {
    "streams": [
      {
        "category": "Football",
        "streams": [
          {
            "name": "Brazil vs. Croatia",
            "tag": "Ligue 1",
            "poster": "https://...",
            "uri_name": "mens-international-friendly/2026-04-01/bra-cro",
            "starts_at": 1775001600,
            "ends_at": 1775010600,
            "iframe": "https://pooembed.eu/embed/...",
            "category_name": "Football",
            "viewers": "300"
          }
        ]
      }
    ]
  }
}
```
**Embed URL**: Use the `iframe` field directly
**Label on site**: "Servidor 3"

---

## Ad Code (Adsterra Popup — USE EVERYWHERE)

```html
<script src="https://widthwidowzoology.com/99/19/f6/9919f61cfc44e5526b3b8d954079e2fd.js"></script>
```

Place this script in:
- Homepage
- Every hub page
- Every match page
- Every embed page

---

## Supabase Setup

Use the Supabase MCP to create these tables:

### Table: `page_views`
```sql
CREATE TABLE page_views (
  id BIGSERIAL PRIMARY KEY,
  page_path TEXT NOT NULL,
  page_type TEXT NOT NULL CHECK (page_type IN ('home','hub','match','embed','share')),
  match_id TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pv_created ON page_views(created_at);
CREATE INDEX idx_pv_path ON page_views(page_path);
```

### Table: `embed_views`
```sql
CREATE TABLE embed_views (
  id BIGSERIAL PRIMARY KEY,
  match_slug TEXT NOT NULL,
  source_server TEXT NOT NULL,
  referrer_domain TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ev_slug ON embed_views(match_slug);
```

Enable **anonymous inserts** on both tables via RLS:
```sql
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous inserts" ON page_views FOR INSERT WITH CHECK (true);
ALTER TABLE embed_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous inserts" ON embed_views FOR INSERT WITH CHECK (true);
```

Add a lightweight client-side tracking script on every page that POSTs to Supabase REST API using the anon key. Get the Supabase URL and anon key from the MCP connection.

---

## Homepage Design (`/`)

### Server Tab System
The homepage has **3 server tabs** at the top:
- **Servidor 1** (S1 data) — selected by default
- **Servidor 2** (S2 data)
- **Servidor 3** (S3 data)

When user clicks a tab, ONLY that server's matches show. This is client-side JS toggling (no page reload). Each server's matches are pre-rendered in hidden divs.

### Layout
```
┌─────────────────────────────────────────┐
│ HEADER: Logo + Nav links to hub pages   │
├─────────────────────────────────────────┤
│ SEO Hero: "Deportes en Vivo Hoy -       │
│ Partidos de Fútbol, NBA, MLB en Vivo"   │
├─────────────────────────────────────────┤
│ [Servidor 1] [Servidor 2] [Servidor 3]  │
├─────────────────────────────────────────┤
│ Category Filter Pills:                  │
│ [Todos] [⚽Fútbol] [🏀NBA] [⚾MLB] ... │
├─────────────────────────────────────────┤
│ Match Cards Grid (2-3 cols):            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ 🔴 LIVE  │ │ 20:00    │ │ 22:30    │ │
│ │ Team A   │ │ Team C   │ │ Team E   │ │
│ │   vs     │ │   vs     │ │   vs     │ │
│ │ Team B   │ │ Team D   │ │ Team F   │ │
│ │ League   │ │ League   │ │ League   │ │
│ │ [VER →]  │ │ [VER →]  │ │ [VER →]  │ │
│ └──────────┘ └──────────┘ └──────────┘ │
├─────────────────────────────────────────┤
│ SEO Content Block (keyword-rich text)   │
├─────────────────────────────────────────┤
│ FAQ Section (JSON-LD FAQPage)           │
├─────────────────────────────────────────┤
│ FOOTER: Hub page links, copyright       │
└─────────────────────────────────────────┘
```

### Match Card Design
- Dark card with subtle gradient border
- Live badge (red pulse animation) if match is currently playing
- Time displayed in user's local timezone (JS `Intl.DateTimeFormat`)
- Team names in bold
- League/competition name
- "Ver en vivo →" button linking to `/match/{slug}?s={serverNum}`
- For S3: show poster image as card background if available

---

## Match Page (`/match/[slug]`)

**URL pattern**: `/match/{team1}-vs-{team2}`
**Query param**: `?s=1` or `?s=2` or `?s=3` (which server, default=1)
**Query param**: `?ch=0` (channel index, default=0)

### Layout
```
┌────────────────────────────────────────┐
│ HEADER                                 │
├────────────────────────────────────────┤
│ Breadcrumb: Inicio > Fútbol > Match    │
├────────────────────────────────────────┤
│ Match Title: "Team A vs Team B"        │
│ League | Date | Time (local)           │
├────────────────────────────────────────┤
│ Server Tabs: [S1] [S2] [S3]           │
│ (only show tabs for servers that       │
│  have this match)                      │
├────────────────────────────────────────┤
│ Channel Pills: [Canal 1] [Canal 2]     │
│ (channels from selected server)        │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │                                    │ │
│ │     STREAM PLAYER (16:9)           │ │
│ │     Source iframe with sandbox     │ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│ Embed Code Box: Copy embed snippet     │
├────────────────────────────────────────┤
│ SEO content about the match            │
├────────────────────────────────────────┤
│ Related matches from same league       │
├────────────────────────────────────────┤
│ FOOTER                                 │
└────────────────────────────────────────┘
```

### Player/Stream Implementation
The source iframe MUST be sandboxed to block their popup ads:
```html
<iframe
  src="{sourceUrl}"
  sandbox="allow-scripts allow-same-origin"
  allow="encrypted-media; autoplay"
  allowfullscreen
  style="width:100%;height:100%;border:none;"
></iframe>
```
The `sandbox` attribute without `allow-popups` blocks `window.open()` from inside the iframe.

Our Adsterra popup script runs on the PARENT page (outside the sandbox).

### Embed Code Snippet (for webmasters to copy)
Show a copyable code box with:
```html
<iframe src="https://deportesenvivo.live/embed/{slug}?s=1&ch=0" width="100%" height="500" frameborder="0" allowfullscreen></iframe>
```

---

## Embed Page (`/embed/[...path]`)

Minimal page for webmasters to embed. Uses `EmbedLayout.astro` (no header/footer).

### Contains only:
1. Our Adsterra popup script
2. Small branding bar at top: "deportesenvivo.live" with link
3. The sandboxed source iframe (same sandbox rules)
4. Supabase embed_views tracking

### Headers (set via Cloudflare or `<meta>`):
- No `X-Frame-Options` (allow embedding)
- `Referrer-Policy: origin` (to track referrers)

---

## Hub Pages (SEO Landing Pages)

Create these 12 hub pages. Each follows the SAME template but with different:
- Title/H1 (exact keyword match)
- Meta description
- Meta keywords
- SEO content paragraphs
- FAQ questions

### Hub Page Template Layout
```
┌─────────────────────────────────┐
│ HEADER                          │
├─────────────────────────────────┤
│ H1: "{Exact Keyword}"          │
│ Subtitle text                   │
├─────────────────────────────────┤
│ Server Tabs + Match Grid        │
│ (same as homepage)              │
├─────────────────────────────────┤
│ SEO Content (2-3 paragraphs)    │
│ with internal links to other    │
│ hub pages                       │
├─────────────────────────────────┤
│ FAQ (3-5 questions, JSON-LD)    │
├─────────────────────────────────┤
│ FOOTER                          │
└─────────────────────────────────┘
```

### Hub Page List

| File | H1 / Title | Meta Description (Spanish) |
|------|-----------|---------------------------|
| `futbol-libre.astro` | Fútbol Libre | Ver fútbol libre online gratis. Partidos en vivo hoy. |
| `pirlo-tv.astro` | Pirlo TV | Pirlo TV en vivo. Ver deportes gratis por internet. |
| `tarjeta-roja.astro` | Tarjeta Roja | Tarjeta Roja TV. Partidos de fútbol en vivo gratis. |
| `roja-directa.astro` | Roja Directa | Roja Directa online. Fútbol y deportes en vivo. |
| `rojadirecta-tv.astro` | Rojadirecta TV | Rojadirecta TV en vivo. Todos los partidos hoy. |
| `futbol-libre-tv.astro` | Fútbol Libre TV | Fútbol Libre TV online. Partidos en directo gratis. |
| `tarjeta-roja-tv.astro` | Tarjeta Roja TV | Tarjeta Roja TV en vivo. Ver fútbol hoy gratis. |
| `futbol-en-vivo.astro` | Fútbol en Vivo | Fútbol en vivo hoy. Ver partidos online gratis. |
| `partidos-en-vivo.astro` | Partidos en Vivo | Partidos en vivo hoy. Fútbol, NBA, MLB en directo. |
| `partidos-de-hoy.astro` | Partidos de Hoy | Partidos de hoy en vivo. Calendario deportivo completo. |
| `livetv.astro` | LiveTV | LiveTV deportes en vivo. Streaming gratis online. |
| `rojadirecta-en-vivo.astro` | Rojadirecta en Vivo | Rojadirecta en vivo hoy. Ver deportes gratis. |

Each hub page MUST include meta keywords tag (Bing reads it):
```html
<meta name="keywords" content="{keyword}, {keyword} hoy, ver {keyword}, {keyword} gratis, {keyword} online">
```

---

## Share Tool Page (`/compartir`)

### Features
- Fetches all today's matches from all 3 servers
- Groups by sport category with emojis
- Shows formatted text preview
- **"Copiar Todo"** button copies all matches as Telegram-formatted text
- **"Copiar Categoría"** buttons for each sport
- Select/deselect individual matches

### Copy Format (Telegram-friendly)
```
🔴 DEPORTES EN VIVO - 01/04/2026
deportesenvivo.live

⚽ FÚTBOL
• 20:00 Brasil vs Croacia
  → deportesenvivo.live/match/brasil-vs-croacia

• 22:00 México vs Bélgica
  → deportesenvivo.live/match/mexico-vs-belgica

🏀 NBA
• 01:00 Knicks vs Rockets
  → deportesenvivo.live/match/knicks-vs-rockets

⚾ MLB
• 04:10 Dodgers vs Guardians
  → deportesenvivo.live/match/dodgers-vs-guardians

📺 Ver todos → deportesenvivo.live
```

---

## Data Processing (Build-time Script)

Create `scripts/fetch-data.mjs`. Run BEFORE astro build.

### Steps:
1. Fetch all 3 JSON sources
2. **S1**: Parse date "DD-MM-YYYY" + time "HH:MM" as CET (UTC+2). Convert to UTC timestamp. Build embed URL: `https://cartelive.club/vip3.php/player/{channelId}/1`
3. **S2**: Map day names to actual dates relative to `last_updated` field. Parse time as UTC. Stream URLs are direct iframe sources.
4. **S3**: `starts_at` is already Unix timestamp. Use `iframe` field directly. Has `poster`, `category_name`, `viewers`.
5. For each source, generate normalized events:
```json
{
  "id": "slug-string",
  "teams": "Team A vs Team B",
  "league": "League Name",
  "category": "football|basketball|baseball|tennis|other",
  "startTime": 1775001600,
  "endTime": 1775010600,
  "server": 1,
  "channels": [
    { "name": "Canal 1", "lang": "es", "embedUrl": "https://..." },
    { "name": "Canal 2", "lang": "en", "embedUrl": "https://..." }
  ],
  "poster": "https://..." or null,
  "viewers": "300" or null
}
```
6. Write `src/data/s1-matches.json`, `src/data/s2-matches.json`, `src/data/s3-matches.json`
7. Also write `src/data/all-matches.json` (all combined for share tool)

### Slug Generation
- Take team names, lowercase, remove accents, replace spaces with hyphens
- Example: "Los Angeles Dodgers - Cleveland Guardians" → `los-angeles-dodgers-vs-cleveland-guardians`

---

## SEO Configuration

### Structured Data (on every match page)
```json
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "Team A vs Team B",
  "startDate": "2026-04-01T20:00:00Z",
  "endDate": "2026-04-01T22:00:00Z",
  "location": { "@type": "VirtualLocation", "url": "https://deportesenvivo.live/match/..." },
  "competitor": [
    { "@type": "SportsTeam", "name": "Team A" },
    { "@type": "SportsTeam", "name": "Team B" }
  ]
}
```

### Structured Data (on hub pages — FAQPage)
Each hub page has 3-5 FAQ questions in Spanish about that keyword. Wrap in FAQPage JSON-LD.

### BreadcrumbList JSON-LD on all pages

### robots.txt
```
User-agent: *
Allow: /
Disallow: /embed/

Sitemap: https://deportesenvivo.live/sitemap-index.xml
```
Note: Block `/embed/` from indexing (those are for webmasters only).

### Sitemap
Use `@astrojs/sitemap` integration. Auto-generate for all pages except `/embed/`.

### IndexNow (Bing)
In GitHub Actions after deploy:
1. Generate a key file at `public/{key}.txt`
2. POST changed URLs to `https://api.indexnow.org/indexnow`

### Meta Tags Pattern (every page)
```html
<title>{Page Title} | Deportes en Vivo</title>
<meta name="description" content="{Spanish description with keywords}">
<meta name="keywords" content="{comma-separated keywords}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://deportesenvivo.live/{path}">
<meta property="og:locale" content="es_ES">
<link rel="canonical" href="https://deportesenvivo.live/{path}">
```

---

## Design System (CSS)

### Theme
- **Background**: `#0a0a0f` (near-black)
- **Surface**: `#12121a` (cards)
- **Surface hover**: `#1a1a2e`
- **Border**: `#ffffff10`
- **Primary**: `#e53e3e` (red — matches sports/live theme)
- **Primary glow**: `#e53e3e40`
- **Accent**: `#38b2ac` (teal)
- **Text**: `#f0f0f0`
- **Text muted**: `#a0a0b0`
- **Live badge**: `#e53e3e` with pulse animation
- **Font**: `Inter` from Google Fonts (weight 400, 600, 700)

### Key UI Elements
- Cards with `border: 1px solid #ffffff10` and subtle box-shadow
- Server tabs: pill-style, active tab has `background: var(--primary)` with glow
- Category filter pills: horizontal scroll on mobile
- Live pulse animation: `@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`
- Match time displayed with `font-variant-numeric: tabular-nums`
- Responsive: 1 col mobile, 2 col tablet, 3 col desktop
- Player container: 16:9 aspect ratio with `aspect-ratio: 16/9`

---

## GitHub Actions Workflow

File: `.github/workflows/deploy.yml`

### Triggers
- `push` to `main`
- `schedule`: `cron: '*/30 * * * *'` (every 30 minutes)
- `workflow_dispatch` (manual)

### Steps
1. Checkout repo
2. Setup Node 20
3. `npm ci`
4. `node scripts/fetch-data.mjs` (fetch + process sources)
5. `npm run build`
6. Deploy to GitHub Pages (`actions/deploy-pages@v4`)
7. Ping IndexNow with sitemap URL

### Permissions
```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

---

## Astro Config

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://deportesenvivo.live',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/embed/')
    })
  ],
  build: { format: 'directory' },
  vite: { build: { rollupOptions: { output: { manualChunks: undefined } } } }
});
```

---

## File Structure

```
Best-Evaulthub/
├── .github/workflows/deploy.yml
├── public/
│   ├── robots.txt
│   ├── favicon.svg              # Red play button icon
│   └── {indexnow-key}.txt
├── scripts/
│   └── fetch-data.mjs           # Build-time data fetcher
├── src/
│   ├── data/                    # Generated at build time
│   │   ├── s1-matches.json
│   │   ├── s2-matches.json
│   │   ├── s3-matches.json
│   │   └── all-matches.json
│   ├── styles/
│   │   └── global.css
│   ├── components/
│   │   ├── SEOHead.astro
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── MatchCard.astro
│   │   ├── MatchGrid.astro
│   │   ├── ServerTabs.astro
│   │   ├── CategoryFilter.astro
│   │   ├── Player.astro
│   │   ├── EmbedBox.astro
│   │   ├── AdPopup.astro
│   │   ├── ShareTool.astro
│   │   ├── FAQ.astro
│   │   └── Breadcrumb.astro
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── EmbedLayout.astro
│   └── pages/
│       ├── index.astro
│       ├── futbol-libre.astro
│       ├── pirlo-tv.astro
│       ├── tarjeta-roja.astro
│       ├── roja-directa.astro
│       ├── rojadirecta-tv.astro
│       ├── futbol-libre-tv.astro
│       ├── tarjeta-roja-tv.astro
│       ├── futbol-en-vivo.astro
│       ├── partidos-en-vivo.astro
│       ├── partidos-de-hoy.astro
│       ├── livetv.astro
│       ├── rojadirecta-en-vivo.astro
│       ├── compartir.astro
│       ├── match/
│       │   └── [...slug].astro
│       └── embed/
│           └── [...path].astro
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

---

## Popup Ad Blocking Strategy (Source Iframes)

On match pages and embed pages, the source iframe gets:
1. `sandbox="allow-scripts allow-same-origin"` — this blocks `window.open()`, `alert()`, navigation, form submission from inside the iframe
2. Do NOT add `allow-popups` to the sandbox — this is what blocks their ads
3. Our Adsterra popup script is placed in the PARENT document (outside any sandbox), so it works normally

---

## Navigation (Header Links)

```
Logo | Fútbol Libre | Pirlo TV | Tarjeta Roja | Roja Directa | Partidos de Hoy | Compartir
```

## Footer Links (Internal Linking for SEO)

All 12 hub page links in the footer organized in columns:
- Column 1: Fútbol Libre, Fútbol Libre TV, Fútbol en Vivo
- Column 2: Pirlo TV, Tarjeta Roja, Tarjeta Roja TV
- Column 3: Roja Directa, Rojadirecta TV, Rojadirecta en Vivo
- Column 4: Partidos de Hoy, Partidos en Vivo, LiveTV

---

## Important Implementation Notes

1. **Timezone display**: All times shown to user must be in their LOCAL timezone. Use `Intl.DateTimeFormat` with `timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone` in client-side JS.
2. **Build time data**: The `scripts/fetch-data.mjs` runs BEFORE `astro build`. Add to package.json: `"build": "node scripts/fetch-data.mjs && astro build"`
3. **If a source is down**: The fetch script should handle errors gracefully — if one source fails, still build with the other two.
4. **Match slugs must be unique**: If two matches have the same slug, append the server number.
5. **S2 day mapping**: Map day names (TUESDAY, WEDNESDAY, etc.) to actual dates. Use the `last_updated` field to determine the current week. If `last_updated` is Tuesday, then TUESDAY = that date, WEDNESDAY = next day, etc.
6. **Category emoji map**: `football:⚽, basketball:🏀, baseball:⚾, tennis:🎾, cricket:🏏, hockey:🏒, boxing:🥊, mma:🥊, darts:🎯, other:🏆`
7. **Live detection**: A match is "live" if `now >= startTime && now <= endTime`. Show red pulsing "EN VIVO" badge.
8. **Supabase tracking**: Use the Supabase MCP to get project URL and anon key. Create a tiny inline script that fires on `DOMContentLoaded`.
9. **No unnecessary npm packages**: Keep dependencies minimal — only `astro`, `@astrojs/sitemap`, and that's it.
10. **Google Fonts**: Load Inter via `<link>` in the head, not npm.
