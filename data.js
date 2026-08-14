// MIAC men's soccer — data layer.
// Pure/derived functions (genModel, buildTeam, parsers) are unchanged.
// Persistence functions (loadOverride, saveOverride, getSchedule, etc.) now hit
// Supabase instead of localStorage. All persistence functions are async.

import { supabase } from './supabase-client.js';

export const BASE = {
  GUS: { name: 'Gustavus Adolphus', short: 'Gustavus', mascot: 'Golden Gusties', abbr: 'GUS', crest: 'linear-gradient(135deg,#1a1a1a,#000000)', primary: '#1a1a1a', ink: '#c6a04a', rank: null, formation: '4-3-3' },
  AUG: { name: 'Augsburg',        short: 'Augsburg',   mascot: 'Auggies',   abbr: 'AUG', crest: 'linear-gradient(135deg,#7a2230,#52121c)', primary: '#7a2230', ink: '#ffffff', rank: 5,  formation: '4-2-3-1' },
  BU:  { name: 'Bethel',          short: 'Bethel',     mascot: 'Royals',    abbr: 'BU',  crest: 'linear-gradient(135deg,#0a4b9c,#012f66)', primary: '#0a4b9c', ink: '#ffc425', rank: 2,  formation: '4-3-3' },
  CAR: { name: 'Carleton',        short: 'Carleton',   mascot: 'Knights',   abbr: 'CAR', crest: 'linear-gradient(135deg,#0e3a6e,#04203f)', primary: '#0e3a6e', ink: '#f6b32b', rank: 6,  formation: '4-4-2' },
  CON: { name: 'Concordia',       short: 'Concordia',  mascot: 'Cobbers',   abbr: 'CON', crest: 'linear-gradient(135deg,#5b0e2d,#370819)', primary: '#5b0e2d', ink: '#f0b323', rank: 7,  formation: '4-3-3' },
  HAM: { name: 'Hamline',         short: 'Hamline',    mascot: 'Pipers',    abbr: 'HAM', crest: 'linear-gradient(135deg,#c8102e,#88081f)', primary: '#c8102e', ink: '#ffffff', rank: 8,  formation: '4-2-3-1' },
  MAC: { name: 'Macalester',      short: 'Macalester', mascot: 'Scots',     abbr: 'MAC', crest: 'linear-gradient(135deg,#f47920,#c1560f)', primary: '#f47920', ink: '#ffffff', rank: 3,  formation: '4-3-3' },
  SJU: { name: "Saint John's",    short: "St. John's", mascot: 'Johnnies',  abbr: 'SJU', crest: 'linear-gradient(135deg,#b1232e,#7a0f18)', primary: '#b1232e', ink: '#ffffff', rank: 1,  formation: '4-3-3' },
  SMU: { name: "Saint Mary's",    short: "St. Mary's", mascot: 'Cardinals', abbr: 'SMU', crest: 'linear-gradient(135deg,#9d2235,#6a0f1f)', primary: '#9d2235', ink: '#ffffff', rank: 9,  formation: '4-4-2' },
  OLE: { name: 'St. Olaf',        short: 'St. Olaf',   mascot: 'Oles',      abbr: 'OLE', crest: 'linear-gradient(135deg,#1a1a1a,#000000)', primary: '#1a1a1a', ink: '#f1b82d', rank: 4,  formation: '4-3-3' },
  CSS: { name: 'St. Scholastica', short: 'Scholastica',mascot: 'Saints',    abbr: 'CSS', crest: 'linear-gradient(135deg,#0e6ba8,#063a5c)', primary: '#0e6ba8', ink: '#f5d24b', rank: 10, formation: '4-4-2' },
};

export const ORDER = ['AUG','BU','CAR','CON','HAM','MAC','SJU','SMU','OLE','CSS'];
export const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '4-1-4-1', '4-5-1', '4-4-1-1', '4-3-2-1', '4-2-2-2', '3-5-2', '3-4-3', '3-4-2-1', '5-3-2', '5-4-1'];
export const POS_LABEL = { GK: 'Goalkeeper', D: 'Defender', M: 'Midfielder', F: 'Forward' };

const FIRST = ['Liam','Noah','Owen','Mason','Lucas','Henry','Jack','Carter','Eli','Gavin','Caleb','Isaac','Cole','Brady','Logan','Nolan','Sam','Max','Aiden','Tyler','Evan','Reed','Jonas','Soren','Lars','Anders','Marcus','Diego','Mateo','Andres','Felix','Theo','Gabe','Tucker','Wyatt','Connor','Ian','Drew'];
const LAST = ['Anderson','Johnson','Olson','Peterson','Larson','Nelson','Carlson','Hansen','Berg','Lindgren','Schmidt','Novak','Reyes','Garcia','Murphy','OBrien','Kowalski','Schroeder','Dahl','Engen','Halvorsen','Bauer','Fischer','Vang','Yang','Moua','Patel','Nguyen','Brennan','Foley','Walsh','Kruse','Voss','Roth','Sand','Holm','Aas','Ruud'];
const NONCONF = ['UW–Stout','Luther','Loras','Wartburg','Crown','Northwestern (MN)','UW–La Crosse','Bethany Lutheran'];
const YEARS = ['Fr.','So.','Jr.','Sr.','Gr.'];

const TACTICAL = {
  OLE: "St. Olaf set up in a patient 4-3-3 and are most dangerous in transition. Their single pivot (#6) drops between the center backs to build, so press the pivot early and cut the lane into their #10. Both fullbacks push very high — the space in behind them is the game. Force play down their left (weaker 1v1 defender at LB) and hit the channel with our right winger. They are vulnerable on second balls from set pieces; we attack the near post. Keep our line compact between the lines and deny the through-ball to their #9, who is excellent on the shoulder.",
};

// Portrait pitch coords (x% width, y% length; y small = attacking end / top)
export const SHAPES = {
  '4-3-3':   [[50,90,'GK'],[15,70,'LB'],[38,74,'CB'],[62,74,'CB'],[85,70,'RB'],[28,50,'CM'],[50,54,'CM'],[72,50,'CM'],[22,24,'LW'],[50,18,'ST'],[78,24,'RW']],
  '4-4-2':   [[50,90,'GK'],[15,70,'LB'],[38,74,'CB'],[62,74,'CB'],[85,70,'RB'],[16,46,'LM'],[40,50,'CM'],[60,50,'CM'],[84,46,'RM'],[38,20,'ST'],[62,20,'ST']],
  '4-2-3-1': [[50,90,'GK'],[15,70,'LB'],[38,74,'CB'],[62,74,'CB'],[85,70,'RB'],[37,56,'DM'],[63,56,'DM'],[20,36,'LW'],[50,40,'AM'],[80,36,'RW'],[50,18,'ST']],
  '4-1-4-1': [[50,90,'GK'],[15,70,'LB'],[38,74,'CB'],[62,74,'CB'],[85,70,'RB'],[50,58,'DM'],[16,42,'LM'],[39,44,'CM'],[61,44,'CM'],[84,42,'RM'],[50,18,'ST']],
  '4-5-1':   [[50,90,'GK'],[15,70,'LB'],[38,74,'CB'],[62,74,'CB'],[85,70,'RB'],[14,46,'LM'],[34,50,'CM'],[50,52,'CM'],[66,50,'CM'],[86,46,'RM'],[50,20,'ST']],
  '4-4-1-1': [[50,90,'GK'],[15,70,'LB'],[38,74,'CB'],[62,74,'CB'],[85,70,'RB'],[16,48,'LM'],[40,50,'CM'],[60,50,'CM'],[84,48,'RM'],[50,34,'SS'],[50,18,'ST']],
  '4-3-2-1': [[50,90,'GK'],[15,70,'LB'],[38,74,'CB'],[62,74,'CB'],[85,70,'RB'],[30,52,'CM'],[50,56,'CM'],[70,52,'CM'],[38,34,'AM'],[62,34,'AM'],[50,18,'ST']],
  '4-2-2-2': [[50,90,'GK'],[15,70,'LB'],[38,74,'CB'],[62,74,'CB'],[85,70,'RB'],[35,54,'DM'],[65,54,'DM'],[24,36,'AM'],[76,36,'AM'],[38,18,'ST'],[62,18,'ST']],
  '3-5-2':   [[50,90,'GK'],[26,72,'CB'],[50,75,'CB'],[74,72,'CB'],[12,50,'LWB'],[35,52,'CM'],[50,56,'CM'],[65,52,'CM'],[88,50,'RWB'],[38,20,'ST'],[62,20,'ST']],
  '3-4-3':   [[50,90,'GK'],[26,72,'CB'],[50,75,'CB'],[74,72,'CB'],[14,50,'LM'],[39,52,'CM'],[61,52,'CM'],[86,50,'RM'],[22,24,'LW'],[50,18,'ST'],[78,24,'RW']],
  '3-4-2-1': [[50,90,'GK'],[26,72,'CB'],[50,75,'CB'],[74,72,'CB'],[14,50,'LM'],[40,52,'CM'],[60,52,'CM'],[86,50,'RM'],[34,32,'AM'],[66,32,'AM'],[50,18,'ST']],
  '5-3-2':   [[50,90,'GK'],[12,68,'LWB'],[31,73,'CB'],[50,75,'CB'],[69,73,'CB'],[88,68,'RWB'],[32,50,'CM'],[50,54,'CM'],[68,50,'CM'],[38,22,'ST'],[62,22,'ST']],
  '5-4-1':   [[50,90,'GK'],[12,68,'LWB'],[31,73,'CB'],[50,75,'CB'],[69,73,'CB'],[88,68,'RWB'],[16,48,'LM'],[40,50,'CM'],[60,50,'CM'],[84,48,'RM'],[50,20,'ST']],
};

function seedRand(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
function shuffle(arr, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
function ri(rand, lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); }
function posGroup(code) { if (code === 'GK') return 'GK'; if (['LB','RB','CB','LWB','RWB'].includes(code)) return 'D'; if (['CM','DM','AM','LM','RM'].includes(code)) return 'M'; return 'F'; }

// ----- generate the EDITABLE MODEL (sample data a coach can later overwrite) -----
export function genModel(abbr) {
  const b = teamBase(abbr);
  if (!b) return null;
  const rand = seedRand('miac26-' + abbr);
  const strength = (11 - b.rank) / 10;

  const firsts = shuffle(FIRST, rand);
  const lasts = shuffle(LAST, rand);
  const nums = shuffle(Array.from({ length: 35 }, (_, i) => i + 1), rand);
  let ni = 0, np = 0;
  const plan = [['GK', 3], ['D', 7], ['M', 7], ['F', 5]];
  const roster = [];
  for (const [grp, count] of plan) {
    for (let k = 0; k < count; k++) {
      const first = firsts[ni % firsts.length];
      const last = lasts[(ni * 5 + 3) % lasts.length];
      ni++;
      const gp = ri(rand, k < 2 ? 8 : 2, 12);
      const gs = Math.min(gp, k === 0 ? gp : ri(rand, 0, gp));
      let g = 0, a = 0;
      if (grp === 'F') { g = Math.round(ri(rand, 1, 9) * (0.5 + strength)); a = ri(rand, 0, 4); }
      else if (grp === 'M') { g = ri(rand, 0, 4); a = Math.round(ri(rand, 1, 5) * (0.5 + strength)); }
      else if (grp === 'D') { g = ri(rand, 0, 2); a = ri(rand, 0, 3); }
      const sh = grp === 'GK' ? 0 : g * ri(rand, 2, 4) + ri(rand, 0, 6);
      const sog = grp === 'GK' ? 0 : Math.min(sh, g + ri(rand, 0, 4));
      roster.push({ num: nums[np++], name: first + ' ' + last, pos: grp, year: YEARS[ri(rand, 0, 4)], gp, gs, g, a, sh, sog });
    }
  }

  const shape = SHAPES[b.formation] || SHAPES['4-3-3'];
  const byGrp = { GK: roster.filter(p => p.pos === 'GK'), D: roster.filter(p => p.pos === 'D'), M: roster.filter(p => p.pos === 'M'), F: roster.filter(p => p.pos === 'F') };
  const idx = { GK: 0, D: 0, M: 0, F: 0 };
  const xi = shape.map(([x, y, code]) => { const grp = posGroup(code); const p = byGrp[grp][idx[grp]++] || roster[0]; return p.num; });

  const opps = shuffle(ORDER.filter(a => a !== abbr).map(a => ({ opp: BASE[a].short, abbr: a, conf: true }))
    .concat(shuffle(NONCONF, rand).slice(0, 5).map(n => ({ opp: n, abbr: null, conf: false }))), rand).slice(0, 14);
  let d = new Date(2026, 7, 30);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const results = opps.map((o, i) => {
    if (i) d = new Date(d.getTime() + ri(rand, 4, 7) * 86400000);
    const r = rand(); const win = 0.22 + strength * 0.5, draw = 0.2;
    let gf, ga;
    if (r < win) { gf = ri(rand, 1, 4); ga = ri(rand, 0, Math.max(0, gf - 1)); }
    else if (r < win + draw) { gf = ri(rand, 0, 2); ga = gf; }
    else { ga = ri(rand, 1, 3); gf = ri(rand, 0, Math.max(0, ga - 1)); }
    return { home: rand() < 0.5, opp: o.opp, abbr: o.abbr, conf: o.conf, gf, ga, date: months[d.getMonth()] + ' ' + d.getDate() };
  });

  const poss = ri(rand, 40, 64);
  const lastStats = [
    { k: 'Possession', v: poss + '%', o: (100 - poss) + '%' },
    { k: 'Shots', v: String(ri(rand, 9, 18)), o: String(ri(rand, 6, 15)) },
    { k: 'On target', v: String(ri(rand, 3, 9)), o: String(ri(rand, 2, 7)) },
    { k: 'Corners', v: String(ri(rand, 2, 9)), o: String(ri(rand, 1, 7)) },
    { k: 'Fouls', v: String(ri(rand, 6, 14)), o: String(ri(rand, 6, 14)) },
    { k: 'xG', v: (0.6 + rand() * 2).toFixed(1), o: (0.4 + rand() * 1.6).toFixed(1) },
  ];

  return { formation: b.formation, tactical: TACTICAL[abbr] || defaultTactical(b), roster, xi, results, lastStats };
}

function defaultTactical(b) {
  return `${b.name} line up in a ${b.formation}. They press in midblock and look to overload the wide channels, whipping early crosses toward a physical front line. Primary threat is their attacking transition — track runners breaking from midfield and screen the lane into their playmaker. Set pieces are a concern given their height on the back line, so prioritize first contact and clear the near post. Stay compact between the lines, force them backward, and counter into the space their high fullbacks leave behind.`;
}

// ----- turn a model into the full derived team object the pages render -----
export function buildTeam(abbr, m) {
  const b = teamBase(abbr);
  const num = v => (v === '' || v == null || isNaN(Number(v))) ? 0 : Number(v);
  const roster = (m.roster || []).map(p => {
    const g = num(p.g), a = num(p.a), gp = num(p.gp), gs = num(p.gs);
    return {
      num: num(p.num), name: p.name || 'Player', last: (p.name || 'Player').split(' ').slice(-1)[0],
      pos: p.pos || 'M', posShort: p.pos || 'M', posLabel: POS_LABEL[p.pos] || 'Player',
      year: p.year || 'Fr.', gp, gs, g, a, sh: num(p.sh), sog: num(p.sog),
      pts: g * 2 + a, min: gs * 82 + (gp - gs) * 22,
    };
  });
  const results = (m.results || []).map(r => {
    const gf = num(r.gf), ga = num(r.ga);
    return { home: !!r.home, opp: r.opp || '—', name: r.opp || '—', abbr: r.abbr || null, conf: !!r.conf, gf, ga, res: gf > ga ? 'W' : gf < ga ? 'L' : 'D', score: gf + '–' + ga, date: r.date || '' };
  });
  const rec = results.reduce((x, r) => (x[r.res]++, x), { W: 0, D: 0, L: 0 });
  const cf = results.filter(r => r.conf).reduce((x, r) => (x[r.res]++, x), { W: 0, D: 0, L: 0 });
  const form = results.slice(-5).map(r => r.res);
  const last = results[results.length - 1] || { res: 'D', score: '0–0', name: '—', home: true, date: '' };
  const lastMatch = { ...last, stats: m.lastStats || [] };

  const shape = SHAPES[m.formation] || SHAPES['4-3-3'];
  const byNum = n => roster.find(p => p.num === num(n));
  const xiNums = m.xi || [];
  const xi = shape.map(([x, y, code], i) => {
    const n = xiNums[i];
    const p = (n && num(n)) ? byNum(n) : null;
    if (!p) return { x, y, code, num: 0, last: '', name: '', empty: true };
    return { x, y, code, num: p.num, last: p.last || (p.name || '').split(' ').slice(-1)[0], name: p.name, empty: false };
  });

  const isConf = b.conf !== false;
  const leagueLabel = b.league || 'MIAC';
  const season = m.season || null;
  return {
    ...b, formation: m.formation || b.formation, tactical: m.tactical || '', season,
    record: `${rec.W}–${rec.L}–${rec.D}`, confRecord: `${cf.W}–${cf.L}–${cf.D}`,
    rankLabel: isConf && b.rank ? '#' + b.rank : '', isConf, leagueLabel,
    form, results, lastMatch, xi, roster, notes: m.notes || {},
  };
}

// ----- Supabase persistence: team override layer ─────────────────────────────
// These replace the localStorage miac_model_<ABBR> calls.
// All functions are async — await them in the calling page.

export async function loadOverride(abbr) {
  const { data, error } = await supabase
    .from('team_overrides')
    .select('model')
    .eq('abbr', abbr.toUpperCase())
    .maybeSingle();
  if (error) { console.error('loadOverride', error); return null; }
  return data ? data.model : null;
}

export async function saveOverride(abbr, model) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('team_overrides')
    .upsert({ abbr: abbr.toUpperCase(), model, updated_at: new Date().toISOString(), updated_by: user?.id }, { onConflict: 'abbr' });
  if (error) { console.error('saveOverride', error); return false; }
  return true;
}

export async function clearOverride(abbr) {
  const { error } = await supabase
    .from('team_overrides')
    .delete()
    .eq('abbr', abbr.toUpperCase());
  if (error) console.error('clearOverride', error);
}

export async function isCustom(abbr) {
  const { count, error } = await supabase
    .from('team_overrides')
    .select('abbr', { count: 'exact', head: true })
    .eq('abbr', abbr.toUpperCase());
  if (error) return false;
  return count > 0;
}

export async function getModel(abbr) {
  abbr = (abbr || 'OLE').toUpperCase();
  if (!teamExists(abbr)) abbr = 'OLE';
  const override = await loadOverride(abbr);
  return override || genModel(abbr);
}

export async function getTeam(abbr) {
  abbr = (abbr || 'OLE').toUpperCase();
  if (!teamExists(abbr)) abbr = 'OLE';
  return buildTeam(abbr, await getModel(abbr));
}

// ----- Gustavus schedule ─────────────────────────────────────────────────────
// Stored as a single JSONB array in the schedule table (row id = 1).

const SAMPLE_SCHEDULE = [
  { date: '2026-08-20', opp: 'OLE', name: 'St. Olaf',         home: false, time: '11:00 AM', venue: 'Northfield, Minn.',   conf: true  },
  { date: '2026-08-25', opp: null,  name: 'Bethany Lutheran', home: false, time: '',         venue: 'Mankato, Minn.',     conf: false },
  { date: '2026-09-02', opp: null,  name: 'Nebraska Wesleyan',home: true,  time: '3:00 PM',  venue: 'Saint Peter, Minn.', conf: false },
  { date: '2026-09-04', opp: null,  name: 'Edgewood',         home: false, time: '7:00 PM',  venue: 'Madison, Wis.',      conf: false },
  { date: '2026-09-06', opp: null,  name: 'Chicago',          home: false, time: '1:00 PM',  venue: 'Chicago, Ill.',      conf: false },
  { date: '2026-09-09', opp: null,  name: 'UW-Superior',      home: false, time: '7:00 PM',  venue: 'Superior, Wis.',     conf: false },
  { date: '2026-09-12', opp: null,  name: 'Luther',           home: true,  time: '4:00 PM',  venue: 'Saint Peter, Minn.', conf: false },
  { date: '2026-09-15', opp: null,  name: 'Lake Forest',      home: false, time: '4:30 PM',  venue: 'Lake Forest, Ill.',  conf: false },
  { date: '2026-09-19', opp: 'SJU', name: "Saint John's",     home: false, time: '3:30 PM',  venue: 'Collegeville, Minn.',conf: true  },
  { date: '2026-09-22', opp: null,  name: 'UW-Stevens Point', home: true,  time: '2:00 PM',  venue: 'Saint Peter, Minn.', conf: false },
  { date: '2026-09-26', opp: 'BU',  name: 'Bethel',           home: true,  time: '3:30 PM',  venue: 'Saint Peter, Minn.', conf: true  },
  { date: '2026-09-30', opp: 'MAC', name: 'Macalester',       home: false, time: '7:30 PM',  venue: 'St. Paul, Minn.',    conf: true  },
  { date: '2026-10-03', opp: 'AUG', name: 'Augsburg',         home: true,  time: '3:30 PM',  venue: 'Saint Peter, Minn.', conf: true  },
  { date: '2026-10-07', opp: null,  name: 'Bethany Lutheran', home: true,  time: '3:00 PM',  venue: 'Saint Peter, Minn.', conf: false },
  { date: '2026-10-10', opp: 'CON', name: 'Concordia',        home: false, time: '3:30 PM',  venue: 'Moorhead, Minn.',    conf: true  },
  { date: '2026-10-13', opp: 'SMU', name: "Saint Mary's",     home: true,  time: '4:00 PM',  venue: 'Saint Peter, Minn.', conf: true  },
  { date: '2026-10-18', opp: null,  name: 'Grinnell',         home: false, time: '3:00 PM',  venue: 'Grinnell, Iowa',     conf: false },
  { date: '2026-10-21', opp: 'CSS', name: 'St. Scholastica',  home: false, time: '4:00 PM',  venue: 'Duluth, Minn.',      conf: true  },
  { date: '2026-10-24', opp: 'HAM', name: 'Hamline',          home: true,  time: '3:30 PM',  venue: 'Saint Peter, Minn.', conf: true  },
  { date: '2026-10-27', opp: 'OLE', name: 'St. Olaf',         home: true,  time: '4:00 PM',  venue: 'Saint Peter, Minn.', conf: true  },
  { date: '2026-10-31', opp: 'CAR', name: 'Carleton',         home: false, time: '3:30 PM',  venue: 'Northfield, Minn.',  conf: true  },
];

export async function getSchedule() {
  const { data, error } = await supabase
    .from('schedule')
    .select('games')
    .eq('id', 1)
    .maybeSingle();
  if (error) { console.error('getSchedule', error); return SAMPLE_SCHEDULE.map(x => ({ ...x })); }
  if (!data || !Array.isArray(data.games) || data.games.length === 0) {
    return SAMPLE_SCHEDULE.map(x => ({ ...x }));
  }
  return data.games;
}

export async function saveSchedule(list) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('schedule')
    .upsert({ id: 1, games: list || [], updated_at: new Date().toISOString(), updated_by: user?.id }, { onConflict: 'id' });
  if (error) { console.error('saveSchedule', error); return false; }
  return true;
}

export async function clearSchedule() {
  await saveSchedule([]);
}

export async function isCustomSchedule() {
  const { data } = await supabase.from('schedule').select('games').eq('id', 1).maybeSingle();
  return !!(data && Array.isArray(data.games) && data.games.length > 0);
}

// ----- non-conference opponents (derived from the schedule) ------------------

export const NONCONF_TEAMS = {
  'Bethany Lutheran': { abbr: 'BLC', short: 'Bethany Lu.',   mascot: 'Vikings',       crest: 'linear-gradient(135deg,#5b2d86,#2c1444)', primary: '#5b2d86', ink: '#f0c419', formation: '4-4-2',   league: 'UMAC',  rank: 6, record: '5–5–1' },
  'Nebraska Wesleyan':{ abbr: 'NWU', short: 'Neb. Wesleyan', mascot: 'Prairie Wolves',crest: 'linear-gradient(135deg,#1a1a1a,#8a6d1e)', primary: '#1a1a1a', ink: '#caa84a', formation: '4-3-3',   league: 'A-R-C', rank: 4, record: '7–3–1' },
  'Edgewood':         { abbr: 'EDG', short: 'Edgewood',      mascot: 'Eagles',        crest: 'linear-gradient(135deg,#9d1b2e,#5a0d18)', primary: '#9d1b2e', ink: '#ffffff', formation: '4-2-3-1', league: 'NACC',  rank: 5, record: '6–4–1' },
  'Chicago':          { abbr: 'CHI', short: 'Chicago',       mascot: 'Maroons',       crest: 'linear-gradient(135deg,#6b0e2a,#3a0716)', primary: '#6b0e2a', ink: '#ffffff', formation: '4-3-3',   league: 'UAA',   rank: 3, record: '8–2–1' },
  'UW-Superior':      { abbr: 'SUP', short: 'UW–Superior',   mascot: 'Yellowjackets', crest: 'linear-gradient(135deg,#b8941f,#1a1a1a)', primary: '#b8941f', ink: '#1a1a1a', formation: '4-4-2',   league: 'UMAC',  rank: 6, record: '5–4–2' },
  'Luther':           { abbr: 'LUT', short: 'Luther',        mascot: 'Norse',         crest: 'linear-gradient(135deg,#0a2f6b,#04152f)', primary: '#0a2f6b', ink: '#ffffff', formation: '4-3-3',   league: 'A-R-C', rank: 5, record: '6–3–2' },
  'Lake Forest':      { abbr: 'LFC', short: 'Lake Forest',   mascot: 'Foresters',     crest: 'linear-gradient(135deg,#1a1a1a,#7a1020)', primary: '#7a1020', ink: '#ffffff', formation: '4-4-2',   league: 'MWC',   rank: 7, record: '4–5–2' },
  'UW-Stevens Point': { abbr: 'SPT', short: 'UW–Stevens Pt.',mascot: 'Pointers',      crest: 'linear-gradient(135deg,#4b2a82,#2a1648)', primary: '#4b2a82', ink: '#f0c419', formation: '4-3-3',   league: 'WIAC',  rank: 2, record: '9–1–1' },
  'Grinnell':         { abbr: 'GRI', short: 'Grinnell',      mascot: 'Pioneers',      crest: 'linear-gradient(135deg,#9d1b2e,#1a1a1a)', primary: '#9d1b2e', ink: '#ffffff', formation: '4-2-3-1', league: 'MWC',   rank: 5, record: '5–4–1' },
};
const NONCONF_FALLBACK = { mascot: '', crest: 'linear-gradient(135deg,#2a2a2a,#0d0d0d)', league: 'Non-conf', record: '—' };
function nonConfAbbr(name) { return (name || 'OPP').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'OPP'; }

const NONCONF_BY_ABBR = {};
for (const [name, v] of Object.entries(NONCONF_TEAMS)) {
  NONCONF_BY_ABBR[v.abbr] = { name, short: v.short || name, mascot: v.mascot, abbr: v.abbr, crest: v.crest, primary: v.primary || '#2a2a2a', ink: v.ink || '#ffffff', rank: v.rank || 6, formation: v.formation || '4-3-3', league: v.league, conf: false };
}

export function teamExists(abbr) { abbr = (abbr || '').toUpperCase(); return !!(BASE[abbr] || NONCONF_BY_ABBR[abbr]); }
export function teamBase(abbr) { abbr = (abbr || '').toUpperCase(); if (BASE[abbr]) return { ...BASE[abbr], conf: true, league: 'MIAC' }; return NONCONF_BY_ABBR[abbr] || null; }

export async function getNonConfOpponents() {
  const seen = new Set(); const out = [];
  for (const m of await getSchedule()) {
    if (m.conf || m.opp) continue;
    const name = m.name || 'Opponent';
    if (seen.has(name)) continue; seen.add(name);
    const meta = NONCONF_TEAMS[name] || { ...NONCONF_FALLBACK, abbr: nonConfAbbr(name) };
    out.push({ name, abbr: meta.abbr || nonConfAbbr(name), mascot: meta.mascot, crest: meta.crest, league: meta.league, record: meta.record, home: !!m.home, date: m.date || '', time: m.time || '', venue: m.venue || '' });
  }
  return out;
}

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export async function getNextMatch(asOf) {
  const now = startOfDay(asOf ? new Date(asOf) : new Date());
  const list = (await getSchedule()).map(m => ({ ...m, _d: new Date((m.date || '') + 'T12:00:00') })).filter(m => !isNaN(m._d)).sort((a, b) => a._d - b._d);
  if (!list.length) return null;
  const upcoming = list.find(m => m._d >= now);
  const pick = upcoming || list[list.length - 1];
  const team = pick.opp && BASE[pick.opp] ? BASE[pick.opp] : null;
  return { ...pick, team, isPast: !upcoming };
}

// ----- schedule import (.ics or CSV) — all pure, sync ─────────────────────────
const MONTHS3 = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
function normDate(s) {
  s = (s || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/([A-Za-z]{3,})\.?\s+(\d{1,2})(?:[,\s]+(\d{4}))?/);
  if (m) { const mo = MONTHS3[m[1].slice(0, 3).toLowerCase()]; if (mo) { const y = m[3] || '2026'; return `${y}-${mo}-${String(+m[2]).padStart(2, '0')}`; } }
  return null;
}
export function matchTeam(rawName) {
  if (!rawName) return null;
  const s = rawName.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return null;
  if (s.includes('stolaf') || s.includes('saintolaf') || s.includes('oles')) return 'OLE';
  if (s.includes('stjohn') || s.includes('saintjohn') || s.includes('johnnies')) return 'SJU';
  if (s.includes('stmary') || s.includes('saintmary') || s.includes('cardinals')) return 'SMU';
  if (s.includes('scholastica')) return 'CSS';
  for (const k of ORDER) {
    const b = BASE[k];
    const cands = [b.name, b.short, b.mascot, k].map(x => (x || '').toLowerCase().replace(/[^a-z]/g, ''));
    if (cands.some(c => c.length >= 3 && (s.includes(c) || c.includes(s)))) return k;
  }
  return null;
}
function fmtICSTime(hh, mm, ss, z, y, mo, d) {
  if (z) {
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +(ss || 0)));
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(dt);
    const g = (t) => (parts.find(x => x.type === t) || {}).value || '';
    return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')} ${g('dayPeriod')}` };
  }
  const h = +hh; const ap = h >= 12 ? 'PM' : 'AM'; const h12 = ((h + 11) % 12) + 1;
  return { date: `${y}-${mo}-${d}`, time: `${h12}:${mm} ${ap}` };
}
function parseICSDate(val) {
  const m = (val || '').match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss, z] = m;
  if (hh == null) return { date: `${y}-${mo}-${d}`, time: '' };
  return fmtICSTime(hh, mm, ss, z, y, mo, d);
}
function parseSummary(summary) {
  let s = (summary || '').replace(/men'?s soccer/ig, '').replace(/gustavus( adolphus)?( college)?/ig, '').trim();
  let home = true, opp = s;
  const atM = s.match(/(?:^|\s)(?:at|@)\s+(.+)/i);
  const vsM = s.match(/(?:^|\s)vs\.?\s+(.+)/i);
  if (atM) { home = false; opp = atM[1]; }
  else if (vsM) { home = true; opp = vsM[1]; }
  opp = opp.replace(/\(.*?\)/g, '').replace(/#\s*\d+\s*/g, '').replace(/\bNo\.?\s*\d+\s*/ig, '').replace(/\bRV\s+/ig, '').replace(/\s+[-–—:]\s+.*$/, '').replace(/^[\s:.-]+/, '').trim();
  return { home, opp };
}
export function parseICS(text) {
  const raw = (text || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  const out = []; let cur = null;
  for (const line of raw.split('\n')) {
    if (/^BEGIN:VEVENT/i.test(line)) { cur = {}; continue; }
    if (/^END:VEVENT/i.test(line)) { if (cur && cur.dt) out.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const name = line.slice(0, i).split(';')[0].toUpperCase();
    const val = line.slice(i + 1);
    if (name === 'SUMMARY') cur.summary = val.replace(/\\,/g, ',').replace(/\\n/g, ' ');
    else if (name === 'LOCATION') cur.location = val.replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
    else if (name === 'DTSTART') cur.dt = parseICSDate(val);
  }
  return out.map(e => {
    const { home, opp } = parseSummary(e.summary);
    const key = matchTeam(opp);
    return { date: e.dt.date, time: e.dt.time || '', venue: e.location || '', home, name: key ? BASE[key].short : (opp || 'Opponent'), opp: key, conf: !!key };
  }).filter(f => f.date).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}
function fixtureFrom(name, home, date, time, venue) {
  const key = matchTeam(name);
  return { date, time: /tbd/i.test(time || '') ? '' : (time || ''), venue: venue || '', home, name: key ? BASE[key].short : (name || 'Opponent'), opp: key, conf: !!key };
}
function parseScheduleLine(line) {
  const cols = line.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
  const haIdx = cols.findIndex(c => /^(home|away|neutral)$/i.test(c));
  if (haIdx >= 2) {
    const date = normDate(cols[0]); if (!date) return null;
    return fixtureFrom(cols[haIdx + 1], /^home$/i.test(cols[haIdx]), date, cols[haIdx - 1], cols[haIdx + 2]);
  }
  const c = line.split(',').map(x => x.trim());
  if (/^(date|day)$/i.test(c[0] || '')) return null;
  const date = normDate(c[0]); if (!date) return null;
  return fixtureFrom(c[1] || 'Opponent', !/^(a|@|away)/i.test(c[2] || 'h'), date, c[3], c[4]);
}
export function parseScheduleText(text) {
  if (/BEGIN:V(CALENDAR|EVENT)/i.test(text || '')) return parseICS(text);
  const out = [];
  for (const line of (text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const f = parseScheduleLine(line.trim());
    if (f) out.push(f);
  }
  return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

// ----- saved scouting reports ────────────────────────────────────────────────
// Reports are frozen snapshots — data never updates after save.

export async function getReports() {
  const { data, error } = await supabase
    .from('reports')
    .select('id, data, saved_at')
    .order('saved_at', { ascending: false });
  if (error) { console.error('getReports', error); return []; }
  return (data || []).map(row => ({ ...row.data, id: row.id, savedAt: new Date(row.saved_at).getTime() }));
}

export async function addReport(rep) {
  rep = { ...rep };
  rep.id = rep.id || ('r_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36));
  rep.savedAt = Date.now();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('reports')
    .upsert({ id: rep.id, data: rep, created_by: user?.id, saved_at: new Date(rep.savedAt).toISOString() }, { onConflict: 'id' });
  if (error) { console.error('addReport', error); return getReports(); }
  return getReports();
}

export async function removeReport(id) {
  const { error } = await supabase.from('reports').delete().eq('id', id);
  if (error) console.error('removeReport', error);
  return getReports();
}

export async function getReport(id) {
  const { data, error } = await supabase
    .from('reports')
    .select('id, data, saved_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return { ...data.data, id: data.id, savedAt: new Date(data.saved_at).getTime() };
}

// ----- video clips ───────────────────────────────────────────────────────────

export async function getClips(abbr) {
  const { data, error } = await supabase
    .from('video_clips')
    .select('*')
    .eq('team_abbr', abbr.toUpperCase())
    .order('created_at', { ascending: false });
  if (error) { console.error('getClips', error); return []; }
  return (data || []).map(row => ({
    ...row,
    url: supabase.storage.from('clips').getPublicUrl(row.file_path).data.publicUrl,
  }));
}

export async function addClip({ abbr, label, gameDate, file }) {
  const { data: { user } } = await supabase.auth.getUser();
  const ext = file.name.split('.').pop();
  const path = `${abbr.toUpperCase()}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: upErr } = await supabase.storage.from('clips').upload(path, file, { contentType: file.type });
  if (upErr) throw new Error(upErr.message);
  const id = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const { error } = await supabase.from('video_clips').insert({
    id, team_abbr: abbr.toUpperCase(), label, file_path: path,
    game_date: gameDate || null, created_by: user?.id,
  });
  if (error) throw new Error(error.message);
  return getClips(abbr);
}

export async function removeClip(id, filePath) {
  await supabase.storage.from('clips').remove([filePath]);
  const { error } = await supabase.from('video_clips').delete().eq('id', id);
  if (error) console.error('removeClip', error);
}

// ----- player detail ─────────────────────────────────────────────────────────
export async function genPlayer(abbr, id) {
  const t = await getTeam(abbr);
  const p = t.roster.find(r => r.num === Number(id));
  if (!p) return null;
  const rand = seedRand('miac26-' + abbr + '-' + id);
  const played = t.results.slice(0, p.gp);
  let gLeft = p.g, aLeft = p.a, shLeft = p.sh, sogLeft = p.sog;
  const log = played.map((m, i) => {
    const last = i === played.length - 1;
    const g = last ? gLeft : (rand() < 0.32 && gLeft > 0 ? 1 : 0);
    const a = last ? aLeft : (rand() < 0.32 && aLeft > 0 ? 1 : 0);
    gLeft -= g; aLeft -= a;
    const sh = last ? Math.max(shLeft, 0) : (p.pos === 'GK' ? 0 : Math.min(shLeft, ri(rand, 0, 3)));
    shLeft -= sh;
    const sog = last ? Math.max(sogLeft, 0) : Math.min(sh, sogLeft, ri(rand, 0, 2));
    sogLeft -= sog;
    const started = i < p.gs;
    return { ...m, g, a, sh, sog, min: started ? ri(rand, 70, 90) : ri(rand, 10, 45), started };
  });
  return { team: t, player: { ...p, log } };
}

// ----- CSV helpers for coach import — sync, unchanged ────────────────────────
function splitCSV(line) { return line.split(',').map(s => s.trim()); }
export function parseRosterCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  const out = [];
  for (const line of lines) {
    const c = splitCSV(line);
    if (!c[0] || /^(num|number|#)$/i.test(c[0])) continue;
    const posRaw = (c[2] || 'M').toUpperCase();
    const pos = ['GK','D','M','F'].includes(posRaw) ? posRaw : (posRaw[0] === 'G' ? 'GK' : ['D','M','F'].includes(posRaw[0]) ? posRaw[0] : 'M');
    out.push({ num: Number(c[0]) || 0, name: c[1] || 'Player', pos, year: c[3] || 'Fr.', gp: Number(c[4]) || 0, gs: Number(c[5]) || 0, g: Number(c[6]) || 0, a: Number(c[7]) || 0, sh: Number(c[8]) || 0, sog: Number(c[9]) || 0 });
  }
  return out;
}
export function parseResultsCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  const out = [];
  for (const line of lines) {
    const c = splitCSV(line);
    if (!c[0] || /^(home|h\/a|date|venue)$/i.test(c[0])) continue;
    const home = /^h/i.test(c[0]);
    out.push({ home, opp: c[1] || 'Opponent', abbr: null, conf: /^(y|yes|conf|miac|true)$/i.test(c[2] || 'y'), gf: Number(c[3]) || 0, ga: Number(c[4]) || 0, date: c[5] || '' });
  }
  return out;
}
