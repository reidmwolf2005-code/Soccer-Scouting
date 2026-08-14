# MIAC Soccer Scouting Hub — Developer Handoff

This is a **working front-end prototype** of a men's soccer scouting app for Gustavus
Adolphus / the MIAC. It is fully interactive but has **no backend** — all data lives in
the browser's `localStorage`. The goal of this handoff is to turn it into a real,
multi-user product. Read this file first; it is the source of truth for intent, data
shapes, and known gaps.

---

## 1. What's here

| File | Purpose |
|---|---|
| `MIAC Scouting Hub.dc.html` | Home. Next-match hero, MIAC programs grid, Out-of-Conference programs grid, schedule paste/upload modal. |
| `Team.dc.html` | Per-team scouting report: tactical review, projected XI (with per-player notes), season results, roster, last match. Coach **Manage Data** editor + **Save report**. |
| `Player.dc.html` | Per-player profile + game log. |
| `Schedule.dc.html` | Google-Calendar-style season view. Coaches add/edit/delete games, paste/upload import. |
| `Reports.dc.html` | Saved scouting reports as interactive cards (team, date, result) → detail snapshot. |
| `Admin.dc.html` | User/role management (prototype). |
| `data.js` | **All data logic** — sample-data generation, derived models, parsers, persistence. *This is the schema source of truth.* |
| `auth.js` | Users, roles, "who is signed in" (prototype only). |
| `image-slot.js`, `support.js` | Drag-drop image component; DC runtime (do not edit `support.js`). |

### How it's built
- Each page is a **Design Component** (`*.dc.html`): an HTML template + a `class Component`
  logic class, rendered by `support.js`. They open directly in a browser and link to each
  other with plain relative `<a href>`s.
- No build step, no framework install. Styling is inline. Fonts via Google Fonts CDN.
- Pages load `data.js` / `auth.js` as ES modules (`import('./data.js?v=N')`). The `?v=N` is
  just cache-busting — bump it when the file changes.

---

## 2. ⚠️ The #1 task: replace the storage + auth layer

Everything persists to `localStorage` **on a single browser**. Nothing syncs between
coaches or devices. `auth.js` is **not real authentication** — it's a user-switcher for the
demo. To ship this you need:

1. A **backend + database** (Postgres/Firebase/Supabase — your call).
2. **Real auth** (school SSO or email login) with the three roles already modeled:
   `player`, `coach`, `admin` (see `auth.js` → `ROLES`, `canEdit`, `isAdmin`).
3. Swap the `localStorage` read/write calls in `data.js` and `auth.js` for API calls. The
   function signatures are already clean seams — keep them and change the bodies.

### localStorage keys currently in use
| Key | Written by | Holds |
|---|---|---|
| `miac_model_<ABBR>` | `saveOverride` | A team's coach-edited model (roster, results, XI, tactical, notes) |
| `miac_schedule` | `saveSchedule` | Gustavus season schedule (array of games) |
| `miac_reports` | `saveReports` | Saved scouting reports |
| `miac_users` / `miac_current_user` | `auth.js` | Users + signed-in user |

These map 1:1 to future DB tables.

---

## 3. Data model & contracts (in `data.js`)

The app already defines exact import/parse contracts. **A real data pipeline only has to
emit these shapes** and the existing UI consumes them unchanged.

**Team registry** — `BASE` (10 MIAC teams) + `NONCONF_TEAMS` (non-conference opponents).
Keys: `name, short, mascot, abbr, crest, primary, ink, rank, formation, league`.
`teamBase(abbr)` / `teamExists(abbr)` unify the two.

**Roster CSV** — `parseRosterCSV(text)` columns:
`num, name, pos(GK|D|M|F), year, GP, GS, G, A, SH, SOG` (one player per line).

**Results CSV** — `parseResultsCSV(text)` columns:
`H/A, opponent, MIAC?(Y|N), GF, GA, date`.

**Schedule import** — `parseScheduleText(text)` accepts gogusties `.ics` **or** the "Text"
schedule columns **or** `date, opponent, H/A, time, venue` lines. Produces:
`{ date(YYYY-MM-DD), opp(ABBR|null), name, home(bool), time, venue, conf(bool) }`.
`matchTeam(name)` resolves a free-text opponent to a MIAC abbr (or null).

**Saved report** — `addReport(rep)` / `getReports()` / `removeReport(id)`. Shape:
`{ id, abbr, team, mascot, crest, date, resultType(UP|W|L|D), score, tactical, formation, record, isConf, leagueLabel, savedAt }`.

> Sample rosters/stats/records are **seeded & generated** (deterministic, see `genModel`).
> They are placeholders. Replace with real data via the contracts above.

---

## 4. Pulling real roster + stat data (every MIAC school)

**Key fact that makes this easy:** every MIAC athletics site runs on the **SIDEARM Sports**
platform (Gustavus, the conference, and all members). So **one scraper/importer handles all
schools** — only the base domain changes. URL paths are identical across schools:

```
https://<school-domain>/sports/mens-soccer/roster   ← bios
https://<school-domain>/sports/mens-soccer/stats    ← season stats
```

### ⚠️ Roster page ≠ stats page
- The **roster** page gives **bios**: number, name, position, class/year, height, hometown.
- **Season stats** (GP, GS, G, A, SH, SOG) live on the separate **stats** page.
- Scrape **both** and **join on jersey number** (fall back to name) to fill the
  `parseRosterCSV` columns. That joined row is exactly what the app imports.

### School domains
| Abbr | School | Domain |
|---|---|---|
| — | Gustavus (us) | `gogusties.com` ✅ |
| SJU | Saint John's | `gojohnnies.com` ✅ |
| CON | Concordia (Moorhead) | `gocobbers.com` ✅ |
| CSS | St. Scholastica | `csssaints.com` (verify) |
| AUG | Augsburg | _verify_ |
| BU | Bethel | _verify_ |
| CAR | Carleton | _verify_ |
| HAM | Hamline | _verify_ |
| MAC | Macalester | _verify_ |
| SMU | Saint Mary's | _verify_ |
| OLE | St. Olaf | _verify_ |

Get the unverified domains from the member-school links on `miacathletics.com`.

### How to scrape (server-side)
- SIDEARM pages render to consistent HTML — fetch + parse with **Cheerio** (Node) or
  **BeautifulSoup** (Python). Some data is also exposed as JSON / schema.org markup; inspect
  the page first, prefer structured data when present.
- **Must run server-side**, not in this prototype — a browser can't fetch other domains
  (CORS). Output CSV/JSON in the shapes from §3 and feed the existing import.
- **Before scraping at scale:** check each site's `robots.txt` and terms. The most reliable,
  lowest-risk route is to **ask each school's Sports Information Director (SID) for a data
  export** — SIDEARM can output rosters/stats directly, no scraping required.

---

## 5. Other gaps / decisions

- **Images** (`image-slot`) are drag-drop placeholders that persist only in localStorage.
  A deployed app needs uploaded/hosted images (logos, opponent photos).
- **Non-conf team colors/mascots/records** in `NONCONF_TEAMS` are hand-entered samples.
- **Reports** link to the *live* team page; the tactical text is a frozen snapshot but
  formation/record shown are from save time. Decide whether reports should be immutable
  snapshots or always mirror live data.
- **Neutral-site games**: the schedule importer treats "Neutral" as away. Add a neutral flag
  if records care.
- **Responsive**: layouts are desktop-width (`max-width:1320px`, fixed grids). Add mobile
  breakpoints.
- The header **"Reports"/"Schedule"/"Teams"** links are wired; there is no global search yet.

---

## 6. Suggested first steps

1. Stand up backend + auth; port the `localStorage` seams in `data.js` / `auth.js` to APIs.
2. Build the SIDEARM importer (roster + stats join) → emit `parseRosterCSV` rows per team.
3. Replace generated sample data with imported data; keep the coach editor as the override layer.
4. Host images; add mobile breakpoints.
