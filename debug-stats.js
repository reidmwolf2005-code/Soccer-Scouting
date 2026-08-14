// Debug script — prints raw stats table headers and rows from gogusties.com
const cheerio = require('cheerio');
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
};

async function main() {
  const url = 'https://gogusties.com/sports/mens-soccer/stats';
  console.log('Fetching', url);
  const res = await fetch(url, { headers: HEADERS });
  const html = await res.text();
  const $ = cheerio.load(html);

  $('table').each((ti, table) => {
    const ths = $(table).find('th').map((_, th) => $(th).text().trim()).get();
    if (!ths.length) return;
    console.log(`\n── Table ${ti} headers (${ths.length} cols) ──`);
    console.log(ths.join(' | '));
    // Print first 5 data rows
    $(table).find('tbody tr').slice(0, 5).each((_, row) => {
      const cells = $(row).find('td').map((_, td) => $(td).text().trim()).get();
      console.log(cells.join(' | '));
    });
  });
}

main().catch(console.error);
