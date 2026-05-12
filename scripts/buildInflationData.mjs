/**
 * Fetches public FRED CSVs and writes annual series for the Inflation dashboard.
 * Run: node scripts/buildInflationData.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'data', 'inflation_annual.json');

async function fetchCsv(id, cosd = '1945-01-01', coed = '2035-12-31') {
  const params = new URLSearchParams({ id, cosd, coed });
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED ${id}: ${res.status}`);
  return res.text();
}

/** Monthly S&P 500 (Robert Shiller / datasets/s-and-p-500 on GitHub). */
async function fetchSp500MonthlyCsv() {
  const url =
    'https://raw.githubusercontent.com/datasets/s-and-p-500/master/data/data.csv';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`S&P CSV: ${res.status}`);
  return res.text();
}

/** USD/oz monthly series (datasets/gold-prices on GitHub). */
async function fetchGoldMonthlyCsv() {
  const url =
    'https://raw.githubusercontent.com/datasets/gold-prices/master/data/monthly.csv';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gold CSV: ${res.status}`);
  return res.text();
}

function parseFredCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const comma = line.indexOf(',');
    if (comma === -1) continue;
    const dateStr = line.slice(0, comma).trim();
    const valStr = line.slice(comma + 1).trim();
    if (valStr === '.' || valStr === '') continue;
    const v = parseFloat(valStr);
    if (Number.isNaN(v)) continue;
    rows.push({ dateStr, v });
  }
  return rows;
}

function yearFromDateStr(dateStr) {
  return parseInt(dateStr.slice(0, 4), 10);
}

/** Monthly/daily rows -> map year -> number[] */
function bucketByYear(rows) {
  const m = new Map();
  for (const { dateStr, v } of rows) {
    const y = yearFromDateStr(dateStr);
    if (!m.has(y)) m.set(y, []);
    m.get(y).push(v);
  }
  return m;
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

async function main() {
  const [cpiText, mspusText, incomeText, spCsvText, goldCsvText] = await Promise.all([
    fetchCsv('CPIAUCSL'),
    fetchCsv('MSPUS'),
    fetchCsv('MEFAINUSA646N'),
    fetchSp500MonthlyCsv(),
    fetchGoldMonthlyCsv(),
  ]);

  const cpiMonthly = parseFredCsv(cpiText);
  const mspusRows = parseFredCsv(mspusText);
  const incomeRows = parseFredCsv(incomeText);

  const goldMonthlyRows = [];
  for (const line of goldCsvText.trim().split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const comma = line.indexOf(',');
    if (comma === -1) continue;
    const dateStr = line.slice(0, comma).trim();
    const valStr = line.slice(comma + 1).trim();
    if (valStr === '') continue;
    const v = parseFloat(valStr);
    if (Number.isNaN(v)) continue;
    goldMonthlyRows.push({ dateStr: `${dateStr}-01`, v });
  }

  const cpiByYear = bucketByYear(cpiMonthly);
  const cpiAnnual = new Map();
  for (const [y, vals] of cpiByYear) {
    const m = mean(vals);
    if (m != null) cpiAnnual.set(y, m);
  }

  const sp500ByYear = new Map();
  const spRowsByYear = new Map();
  for (const line of spCsvText.trim().split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const dateStr = parts[0].trim();
    const v = parseFloat(parts[1]);
    if (Number.isNaN(v) || v <= 0) continue;
    const y = yearFromDateStr(dateStr);
    if (!spRowsByYear.has(y)) spRowsByYear.set(y, []);
    spRowsByYear.get(y).push({ dateStr, v });
  }
  for (const [y, rows] of spRowsByYear) {
    const dec = rows.filter((r) => r.dateStr.slice(5, 7) === '12');
    const pick =
      dec.length > 0
        ? dec.sort((a, b) => a.dateStr.localeCompare(b.dateStr)).at(-1)
        : rows.sort((a, b) => a.dateStr.localeCompare(b.dateStr)).at(-1);
    if (pick) sp500ByYear.set(y, pick.v);
  }

  const spYearEnd = sp500ByYear;
  const goldByYear = bucketByYear(goldMonthlyRows);
  const goldAnnual = new Map();
  for (const [y, vals] of goldByYear) {
    const m = mean(vals);
    if (m != null) goldAnnual.set(y, m);
  }

  const incomeByYear = new Map();
  for (const { dateStr, v } of incomeRows) {
    incomeByYear.set(yearFromDateStr(dateStr), v);
  }

  /** MSPUS: median sale price in USD (FRED quarterly; annual = mean of quarters). */
  const mspusByYear = bucketByYear(mspusRows);
  const houseByYear = new Map();
  for (const [y, vals] of mspusByYear) {
    const m = mean(vals);
    if (m != null) houseByYear.set(y, m);
  }

  const REF_YEAR = 2024;
  const cpiRef = cpiAnnual.get(REF_YEAR);
  if (cpiRef == null) throw new Error(`Missing CPI for ref year ${REF_YEAR}`);

  const years = [];
  for (let y = 1960; y <= 2025; y++) years.push(y);

  const records = years.map((year) => {
    const cpi = cpiAnnual.get(year) ?? null;
    const medianHouseNominalUsd = houseByYear.get(year) ?? null;
    const medianIncomeNominalUsd = incomeByYear.get(year) ?? null;
    const sp500 = spYearEnd.get(year) ?? null;
    const goldUsdPerOz = goldAnnual.get(year) ?? null;

    let medianHouseReal2024Usd = null;
    if (medianHouseNominalUsd != null && cpi != null && cpi > 0) {
      medianHouseReal2024Usd = medianHouseNominalUsd * (cpiRef / cpi);
    }

    return {
      year,
      cpi,
      medianHouseNominalUsd,
      medianHouseReal2024Usd,
      medianIncomeNominalUsd,
      sp500,
      goldUsdPerOz,
    };
  });

  const meta = {
    generatedAt: new Date().toISOString(),
    sources: [
      'FRED CPIAUCSL (CPI all urban consumers, annual average of monthly index)',
      'FRED MSPUS (median sales price of houses sold, USD; nominal)',
      'FRED MEFAINUSA646N (median family income, nominal USD, annual)',
      'datasets/s-and-p-500 (GitHub, Robert Shiller): S&P 500 monthly, December close per year',
      'datasets/gold-prices (GitHub): monthly USD/oz, annual average',
    ],
    notes: [
      'House series uses median transaction price in nominal USD; "real" column is CPI-deflated to 2024 dollars (purchasing-power standardized).',
      'Income is median family income (CPS), not household, for a continuous annual series from the 1950s.',
    ],
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ meta, records }, null, 2), 'utf8');
  console.log('Wrote', OUT, 'rows', records.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
