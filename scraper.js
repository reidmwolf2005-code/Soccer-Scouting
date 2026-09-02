// MIAC Soccer SIDEARM roster + stats scraper
// Run: /usr/local/bin/node scraper.js GUS
// Run all: /usr/local/bin/node scraper.js

const cheerio = require('cheerio');
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bqhjdxmetwrcyrftefiq.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY env var'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const SCHOOLS = [
  { abbr: 'GUS', name: 'Gustavus',       domain: 'gogusties.com'          },
  { abbr: 'SJU', name: "Saint John's",   domain: 'gojohnnies.com'         },
  { abbr: 'CON', name: 'Concordia',      domain: 'www.gocobbers.com', rosterPath: '/sports/msoc/2025-26/roster', statsPath: '/sports/msoc/2025-26/teams/concordiamhead?view=lineup' },
  { abbr: 'CSS', name: 'St. Scholastica',domain: 'csssaints.com'              },
  { abbr: 'AUG', name: 'Augsburg',       domain: 'athletics.augsburg.edu'     },
  { abbr: 'BU',  name: 'Bethel',         domain: 'athletics.bethel.edu'       },
  { abbr: 'CAR', name: 'Carleton',       domain: 'athletics.carleton.edu'     },
  { abbr: 'HAM', name: 'Hamline',        domain: 'hamlineathletics.com'       },
  { abbr: 'MAC', name: 'Macalester',     domain: 'athletics.macalester.edu'   },
  { abbr: 'SMU', name: "Saint Mary's",   domain: 'saintmaryssports.com'       },
  { abbr: 'OLE', name: 'St. Olaf',       domain: 'athletics.stolaf.edu'       },
  // Non-conference opponents
  { abbr: 'BLC', name: 'Bethany Lutheran', domain: 'blcvikings.com',          statsPath: '/sports/mens-soccer/stats/2024-25' },
  { abbr: 'NWU', name: 'Nebraska Wesleyan',domain: 'nwusports.com'            },
  { abbr: 'CHI', name: 'Chicago',          domain: 'athletics.uchicago.edu'   },
  { abbr: 'SUP', name: 'UW-Superior',      domain: 'uwsyellowjackets.com'     },
  { abbr: 'LUT', name: 'Luther',           domain: 'luthernorse.com'          },
  { abbr: 'LFC', name: 'Lake Forest',      domain: 'goforesters.com'          },
  { abbr: 'SPT', name: 'UW-Stevens Point', domain: 'athletics.uwsp.edu'       },
  { abbr: 'GRI', name: 'Grinnell',         domain: 'pioneers.grinnell.edu'    },
  { abbr: 'EDG', name: 'Edgewood',         domain: 'edgewoodeagles.com'        },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
};

async function fetchHTML(url) {
  console.log('  GET', url);
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ── Roster page — returns map of num→{name,pos,year} and name→{num,pos,year} ─
function parseRosterPage(html) {
  const $ = cheerio.load(html);
  const byNum  = {};
  const byName = {};
  const SKIP_NAMES = new Set(['players','roster','name','athlete','team totals','totals','']);

  const addPlayer = (num, name, pos, yr) => {
    name = cleanName(name);
    if (SKIP_NAMES.has(name.toLowerCase()) || name.length < 2) return;
    pos = normalizePos(pos);
    yr  = normalizeYear(yr);
    if (num && !byNum[num])  byNum[num]  = { name, pos, year: yr };
    if (name && !byName[name]) byName[name] = { num, pos, year: yr };
  };

  // Try player cards (SIDEARM card layout)
  const cards = $('[class*="roster-player"], li[class*="player"], .s-person-card, [class*="s-person"]');
  cards.each((_, el) => {
    const card = $(el);
    const numText = card.find('[class*="jersey"], [class*="number"], [class*="bio-stats"]').first().text();
    const num  = parseInt(numText.replace(/\D/g,'')) || 0;
    const name = card.find('[class*="full-name"], [class*="person-details__personal"], h2, h3, [class*="name"]').first().text().trim();
    const pos  = card.find('[class*="position"], [class*="pos"]').first().text().trim();
    const yr   = card.find('[class*="year"], [class*="class"], [class*="academic"]').first().text().trim();
    addPlayer(num, name, pos, yr);
  });

  // Fallback: table rows
  if (!Object.keys(byNum).length && !Object.keys(byName).length) {
    $('table tbody tr').each((_, row) => {
      const cells = $(row).find('td').map((_, td) => $(td).text().trim()).get();
      if (cells.length < 2) return;
      const num = parseInt((cells[0]||'').replace(/\D/g,'')) || 0;
      addPlayer(num, cells[1]||'', cells[2]||'', cells[3]||'');
    });
  }

  return { byNum, byName };
}

// ── Stats page — targets the two SIDEARM individual stats tables ──────────────
// Table with # | Player | GP | GS | MIN | G | A | PTS | SH | SH% | SOG ... = field players
// Table with # | Player | GP | GS | MIN | GA | GAA | SV ...                = goalkeepers
function parseStatsPage(html) {
  const $ = cheerio.load(html);
  const players = [];
  const seen = new Set();
  const SKIP = new Set(['totals','team totals','name','player','athlete','']);

  $('table').each((_, table) => {
    const ths = $(table).find('th').map((_, th) => $(th).text().trim().toLowerCase()).get();
    // Must have # (jersey), Player, GP, GS columns
    if (!ths.includes('#') && !ths.includes('no.') && !ths.includes('no')) return;
    if (!ths.some(h => h === 'gp')) return;

    const col = (...cands) => { for (const c of cands) { const i = ths.indexOf(c); if (i >= 0) return i; } return -1; };
    const iNum  = col('#','no.','no');
    const iName = col('player','name','athlete');
    const iGP   = col('gp');
    const iGS   = col('gs');

    // Detect field player table vs goalkeeper table
    const isGK = ths.includes('ga') || ths.includes('sv') || ths.includes('gaa');
    const iG   = isGK ? -1 : col('g','goals');
    const iA   = isGK ? -1 : col('a','assists');
    const iSH  = isGK ? -1 : col('sh','shots');
    const iSOG = isGK ? -1 : col('sog');

    $(table).find('tbody tr').each((_, row) => {
      const tds = $(row).find('td');
      const c = tds.map((_, td) => $(td).text().trim()).get();
      if (c.length < 3) return;

      const num = iNum >= 0 ? (parseInt((c[iNum]||'').replace(/\D/g,'')) || 0) : 0;

      // Get name from first text node only (avoids SIDEARM's doubled anchor text)
      let name = '';
      if (iName >= 0) {
        const nameCell = tds.eq(iName);
        // Try direct text nodes first
        nameCell.contents().each((_, node) => {
          if (node.type === 'text' && node.data.trim()) { name = node.data.trim(); return false; }
        });
        // Fallback: first line of full text
        if (!name) name = (c[iName] || '').split('\n')[0].trim();
      }
      // Strip leading jersey number that SIDEARM sometimes prepends
      name = name.replace(/^\d+/, '').trim();
      // Reformat "Last, First" → "First Last"
      if (name.includes(',')) {
        const comma = name.indexOf(',');
        name = `${name.slice(comma + 1).trim()} ${name.slice(0, comma).trim()}`;
      }
      name = cleanName(name);

      if (SKIP.has(name.toLowerCase()) || name.length < 2) return;
      const key = `${num}-${name}`;
      if (seen.has(key)) return;
      seen.add(key);

      players.push({
        num, name,
        gp:  iGP  >= 0 ? (parseInt(c[iGP])  || 0) : 0,
        gs:  iGS  >= 0 ? (parseInt(c[iGS])  || 0) : 0,
        g:   iG   >= 0 ? (parseInt(c[iG])   || 0) : 0,
        a:   iA   >= 0 ? (parseInt(c[iA])   || 0) : 0,
        sh:  iSH  >= 0 ? (parseInt(c[iSH])  || 0) : 0,
        sog: iSOG >= 0 ? (parseInt(c[iSOG]) || 0) : 0,
      });
    });
  });

  return players;
}

// ── Results parser — picks up the schedule/results table from the stats page ──
const MIAC_NAMES = ['augsburg','auggies','bethel','royals','carleton','knights','concordia','cobbers','hamline','pipers','macalester','scots','saint john','johnnies','st. john','saint mary','cardinals','st. mary','st. olaf','oles','scholastica','saints'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtResultDate(s) {
  // "08/29/2025" → "Aug 29"
  const m = (s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${MONTHS[+m[1]-1]} ${+m[2]}`;
  // "2025-08-29" → "Aug 29"
  const m2 = (s || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${MONTHS[+m2[2]-1]} ${+m2[3]}`;
  return s;
}

function extractYear(s) {
  const m = (s || '').match(/(\d{4})/);
  return m ? +m[1] : null;
}

function isConfGame(oppName) {
  const n = (oppName || '').toLowerCase().replace(/[^a-z ]/g,'');
  return MIAC_NAMES.some(k => n.includes(k));
}

function parseResultsFromStatsPage(html) {
  const $ = cheerio.load(html);
  const results = [];
  let season = null;

  $('table').each((_, table) => {
    const ths = $(table).find('th').map((_, th) => $(th).text().trim().toLowerCase()).get();
    // Look for the schedule/results table: has Date, Opponent, W/L or Score columns
    const hasDate  = ths.some(h => h === 'date');
    const hasScore = ths.some(h => h === 'score' || h === 'w/l');
    const hasOpp   = ths.some(h => h.includes('opponent') || h === 'opp');
    if (!hasDate || !hasScore || !hasOpp) return;
    // Skip if this looks like a game-log table (has G, A, SH columns too)
    if (ths.includes('g') && ths.includes('a') && ths.includes('sh')) return;

    const col = (...cands) => { for (const c of cands) { const i = ths.findIndex(h => h === c || h.includes(c)); if (i >= 0) return i; } return -1; };
    const iDate  = col('date');
    const iOpp   = col('opponent','opp');
    const iWL    = col('w/l','result');
    const iScore = col('score');

    $(table).find('tbody tr').each((_, row) => {
      const c = $(row).find('td').map((_, td) => $(td).text().trim()).get();
      if (c.length < 3) return;

      const dateRaw = c[iDate] || '';
      const oppRaw  = c[iOpp]  || '';
      const wl      = (c[iWL]  || '').trim().toUpperCase()[0]; // W, L, T
      const scoreRaw= c[iScore]|| '';

      if (!dateRaw || !oppRaw || !wl || !scoreRaw) return;
      if (!/^[WLT]$/.test(wl)) return;
      if (!season) season = extractYear(dateRaw);

      // Parse home/away from opponent field: "vs Calvin" = home, "at Luther" / "@ Luther" = away
      let home = true;
      let oppName = oppRaw;
      const atMatch = oppRaw.match(/^(?:at|@)\s+(.+)/i);
      const vsMatch = oppRaw.match(/^(?:vs\.?)\s+(.+)/i);
      if (atMatch)      { home = false; oppName = atMatch[1].trim(); }
      else if (vsMatch) { home = true;  oppName = vsMatch[1].trim(); }

      // Strip rankings like "#1 " or "No. 1 "
      oppName = oppName.replace(/^#\d+\s+/,'').replace(/^No\.\s*\d+\s+/i,'').trim();

      // Parse score — always "our score - their score"
      const scoreParts = scoreRaw.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (!scoreParts) return;
      const gf = parseInt(scoreParts[1]);
      const ga = parseInt(scoreParts[2]);

      results.push({
        home,
        opp: oppName,
        abbr: null,
        conf: isConfGame(oppName),
        gf, ga,
        date: fmtResultDate(dateRaw),
      });
    });
  });

  return { results, season };
}

// ── Join — stats is primary, roster fills in pos/year ────────────────────────
function join(statsPlayers, rosterMap) {
  return statsPlayers.map(p => {
    const bio = rosterMap.byNum[p.num] || rosterMap.byName[p.name] || {};
    return {
      num:  p.num,
      name: p.name || bio.name || 'Player',
      pos:  bio.pos  || 'M',
      year: bio.year || 'Fr.',
      gp: p.gp, gs: p.gs, g: p.g, a: p.a, sh: p.sh, sog: p.sog,
    };
  }).filter(p => p.name.length > 1);
}

// ── Scrape one school ─────────────────────────────────────────────────────────
async function scrapeSchool(school) {
  const base = `https://${school.domain}`;
  console.log(`\n▶ ${school.name} (${school.abbr})`);

  let rosterMap = { byNum: {}, byName: {} };
  let statsPlayers = [];

  const rosterURL = `${base}${school.rosterPath || '/sports/mens-soccer/roster'}`;
  const statsURL  = `${base}${school.statsPath  || '/sports/mens-soccer/stats'}`;

  try {
    const html = await fetchHTML(rosterURL);
    rosterMap = parseRosterPage(html);
    console.log(`  Roster: ${Object.keys(rosterMap.byNum).length} by num, ${Object.keys(rosterMap.byName).length} by name`);
  } catch (e) { console.log(`  ✗ Roster: ${e.message}`); }

  const currentYear = new Date().getFullYear();
  let results = [], season = null;
  try {
    const html = await fetchHTML(statsURL);
    statsPlayers = parseStatsPage(html);
    ({ results, season } = parseResultsFromStatsPage(html));
    console.log(`  Stats: ${statsPlayers.length} players, ${results.length} results, season ${season || '?'}`);
    if (results.length) {
      const r = results[0];
      console.log(`  First result: ${r.date} ${r.home ? 'vs' : 'at'} ${r.opp} ${r.gf}-${r.ga} (${r.conf ? 'MIAC' : 'non-conf'})`);
    }
    // If the stats page is from a previous season, discard stats so we don't show stale numbers
    if (season && season < currentYear) {
      console.log(`  ⚠ Stats are from ${season} (current year ${currentYear}) — zeroing stats, keeping roster`);
      statsPlayers = [];
      results = [];
      season = null;
    }
  } catch (e) { console.log(`  ✗ Stats: ${e.message}`); }

  // Build roster from roster page when no current stats exist
  const rosterOnly = Object.values(rosterMap.byNum).length > 0 && statsPlayers.length === 0;
  if (rosterOnly) {
    const allPlayers = Object.entries(rosterMap.byNum).map(([num, p]) => ({
      num: parseInt(num), name: p.name, pos: p.pos, year: p.year,
      gp: 0, gs: 0, g: 0, a: 0, sh: 0, sog: 0,
    }));
    return { roster: allPlayers, results, season };
  }

  const combined = join(statsPlayers, rosterMap);

  console.log('\n  #, name, pos, year, GP, GS, G, A, SH, SOG');
  combined.slice(0, 5).forEach(p =>
    console.log(`  ${p.num}, ${p.name}, ${p.pos}, ${p.year}, ${p.gp}, ${p.gs}, ${p.g}, ${p.a}, ${p.sh}, ${p.sog}`)
  );
  if (combined.length > 5) console.log(`  ... and ${combined.length - 5} more`);

  return { roster: combined, results, season };
}

// ── Save to Supabase ──────────────────────────────────────────────────────────
async function save(abbr, { roster, results, season }) {
  if (!roster.length) { console.log('  Skip — no players'); return; }
  if (SERVICE_KEY === 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE') {
    console.log('  ⚠ Add service_role key to scraper.js to save'); return;
  }
  const { data: ex } = await supabase.from('team_overrides').select('model').eq('abbr', abbr).maybeSingle();
  const model = ex?.model || { formation:'4-3-3', tactical:'', xi:[], lastStats:[] };
  model.roster = roster;
  model.results = results;
  if (season) model.season = season;
  const { error } = await supabase.from('team_overrides')
    .upsert({ abbr, model, updated_at: new Date().toISOString() }, { onConflict: 'abbr' });
  if (error) console.log(`  ✗ ${error.message}`);
  else console.log(`  ✓ Saved ${roster.length} players + ${results.length} results → Supabase (${abbr})`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function dedupName(s) {
  s = s.trim();
  // Try exact half-split with space: "Joe Flory Joe Flory" → "Joe Flory"
  const mid = Math.floor(s.length / 2);
  if (s[mid] === ' ' && s.slice(0, mid) === s.slice(mid + 1)) return s.slice(0, mid);
  // Try finding shortest prefix that repeats: "Joe FloryJoe Flory"
  for (let len = 2; len <= Math.floor(s.length / 2); len++) {
    const half = s.slice(0, len);
    if (s.slice(len) === half || s.slice(len) === ' ' + half) return half;
  }
  return s;
}
function cleanName(s) { return s.replace(/\s+/g,' ').replace(/[^a-zA-Z .'\-]/g,'').trim(); }
function normalizePos(s) {
  const p = s.toUpperCase().trim();
  if (/GK|GOAL|KEEPER/.test(p)) return 'GK';
  if (/DEF|BACK|^D$/.test(p))   return 'D';
  if (/MID|^M$/.test(p))        return 'M';
  if (/FOR|ATT|STR|^F$/.test(p)) return 'F';
  // single letter fallback
  if (p[0]==='G') return 'GK';
  if (p[0]==='D') return 'D';
  if (p[0]==='F') return 'F';
  return 'M';
}
function normalizeYear(s) {
  const y = s.toLowerCase().trim();
  if (/fr|1st|^1$|fresh/.test(y)) return 'Fr.';
  if (/so|2nd|^2$|soph/.test(y))  return 'So.';
  if (/jr|3rd|^3$|jun/.test(y))   return 'Jr.';
  if (/sr|4th|^4$|sen/.test(y))   return 'Sr.';
  if (/gr|5th|^5$|grad/.test(y))  return 'Gr.';
  return 'Fr.';
}

// ── Standings scraper ─────────────────────────────────────────────────────────
const MIAC_NAME_MAP = {
  'augsburg': 'AUG', 'bethel': 'BU', 'carleton': 'CAR', 'concordia': 'CON',
  'gustavus': 'GUS', 'gustavus adolphus': 'GUS', 'hamline': 'HAM',
  'macalester': 'MAC', "saint john's": 'SJU', "st. john's": 'SJU',
  "saint mary's": 'SMU', "st. mary's": 'SMU', 'st. olaf': 'OLE',
  'st. scholastica': 'CSS', 'college of st. scholastica': 'CSS',
};

async function scrapeStandings() {
  const url = 'https://miacathletics.com/standings.aspx?path=msoc';
  console.log('\n▶ Scraping MIAC standings...');
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  const rows = [];

  $('table tr').each((i, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 6) return;
    const teamName = $(cells[0]).text().trim().toLowerCase().replace(/\s+/g, ' ');
    const abbr = MIAC_NAME_MAP[teamName];
    if (!abbr) return;

    // columns vary by site — look for W-L-T pattern in cells
    const texts = cells.map((_, c) => $(c).text().trim()).get();
    const wltRx = /^(\d+)-(\d+)-(\d+)$/;
    const wltCols = texts.map((t, idx) => ({ idx, t, m: wltRx.exec(t) })).filter(x => x.m);

    if (wltCols.length >= 2) {
      const conf = wltCols[0].t.replace(/-/g, '–');
      const overall = wltCols[1].t.replace(/-/g, '–');
      rows.push({ abbr, conf_record: conf, overall_record: overall, rank: rows.length + 1 });
    }
  });

  if (!rows.length) { console.log('  ✗ No standings parsed'); return; }

  const { error } = await supabase.from('standings')
    .upsert(rows.map(r => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: 'abbr' });
  if (error) console.log(`  ✗ Standings save failed: ${error.message}`);
  else console.log(`  ✓ Saved standings for ${rows.length} teams → Supabase`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const targets = process.argv.slice(2).map(a => a.toUpperCase()).filter(Boolean);
  const schools = targets.length ? SCHOOLS.filter(s => targets.includes(s.abbr)) : SCHOOLS;
  if (!schools.length) { console.log('Unknown:', process.argv[2], '— valid:', SCHOOLS.map(s=>s.abbr).join(', ')); process.exit(1); }

  // Scrape standings when running a full scrape (no specific school targeted)
  if (!targets.length) await scrapeStandings().catch(e => console.log('  ✗ Standings:', e.message));

  for (const school of schools) {
    try {
      const data = await scrapeSchool(school);
      await save(school.abbr, data);
    } catch (e) { console.log(`  ✗ ${e.message}`); }
    if (schools.indexOf(school) < schools.length - 1) await new Promise(r => setTimeout(r, 2000));
  }
  console.log('\n✓ Done');
}

main().catch(console.error);

