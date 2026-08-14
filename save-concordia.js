// Saves Concordia roster directly to Supabase.
// Stats from gocobbers.com lineup page — averages multiplied by GP for totals.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bqhjdxmetwrcyrftefiq.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxaGpkeG1ldHdyY3lyZnRlZmlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4Mjk4OSwiZXhwIjoyMDk3NjU4OTg5fQ.tYqP_zG8YwDCwxeukWscoz0ey6FclxpOyL60CTW2C5k'; // ← paste key
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Raw data: [num, name, year, pos, GP, GS, G/G, A/G, SH/G]
const RAW = [
  [1,  'Jack Solheid',         'Sr.', 'GK', 17, 17, 0.00, 0.00, 0.00],
  [5,  'Colin Reilly',         'Sr.', 'D',  17, 15, 0.00, 0.00, 0.00],
  [17, 'Jagger Hooper',        'Sr.', 'M',  17, 17, 0.06, 0.00, 0.12],
  [21, 'Dylan Hashbarger',     'So.', 'D',  17, 10, 0.00, 0.00, 0.00],
  [10, 'Gannon Brooks',        'Sr.', 'M',  17, 17, 0.06, 0.00, 0.12],
  [13, 'Isaac Stockert',       'So.', 'M',  16, 16, 0.00, 0.00, 0.00],
  [11, 'Ricco Rolle',          'Jr.', 'D',  16, 14, 0.19, 0.06, 0.44],
  [14, 'Johan Lizarraga',      'Fr.', 'M',  16,  1, 0.00, 0.00, 0.00],
  [9,  'Dylan Sipe',           'Sr.', 'M',  15, 13, 0.13, 0.07, 0.33],
  [22, 'Colin Moore',          'Sr.', 'D',  15,  7, 0.20, 0.00, 0.40],
  [23, 'Noah Meyer',           'So.', 'M',  15,  4, 0.00, 0.07, 0.07],
  [25, 'Nickolaus Herrboldt',  'Fr.', 'D',  15,  7, 0.00, 0.00, 0.00],
  [8,  'Parker Gast',          'So.', 'M',  15, 14, 0.13, 0.07, 0.33],
  [12, 'Will Fruge',           'Fr.', 'M',  15, 12, 0.00, 0.00, 0.00],
  [6,  'Victor Ambenge',       'So.', 'D',  14,  4, 0.07, 0.00, 0.14],
  [15, 'Liam Weis',            'So.', 'D',  12,  9, 0.08, 0.00, 0.17],
  [20, 'Preston Bergeron',     'So.', 'D',  12,  8, 0.00, 0.00, 0.00],
  [24, 'Sekou Gogue',          'Jr.', 'M',  10,  2, 0.00, 0.00, 0.00],
  [26, 'Devin Bush',           'Fr.', 'M',   9,  0, 0.00, 0.11, 0.11],
  [41, 'Cooper Svaleson',      'Sr.', 'M',   4,  0, 0.00, 0.00, 0.00],
  [27, 'Leon Hidanovic',       'Fr.', 'M',   3,  0, 0.00, 0.00, 0.00],
  [35, 'Max Henderson',        'Fr.', 'GK',  2,  0, 0.00, 0.00, 0.00],
];

const roster = RAW.map(([num, name, year, pos, gp, gs, gpg, apg, shpg]) => ({
  num, name, pos, year,
  gp, gs,
  g:   Math.round(gpg  * gp),
  a:   Math.round(apg  * gp),
  sh:  Math.round(shpg * gp),
  sog: 0,
}));

async function main() {
  const { data: ex } = await supabase.from('team_overrides').select('model').eq('abbr', 'CON').maybeSingle();
  const model = ex?.model || { formation: '4-3-3', tactical: '', xi: [], results: [], lastStats: [] };
  model.roster = roster;

  const { error } = await supabase.from('team_overrides')
    .upsert({ abbr: 'CON', model, updated_at: new Date().toISOString() }, { onConflict: 'abbr' });

  if (error) console.log('✗ Error:', error.message);
  else console.log(`✓ Saved ${roster.length} Concordia players to Supabase`);
}

main().catch(console.error);
