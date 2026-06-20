/**
 * OMIE day-ahead bids -> supply curve BY TECHNOLOGY (baked JSON for the dashboard)
 * ================================================================================
 * Reconstructs the real per-technology day-ahead supply curve from OMIE's published
 * per-unit bids (`curva_pbc_uof`), joined to OMIE's own official unit->technology
 * registry (LISTA_UNIDADES). Same code namespace as the bids -> ~99% coverage,
 * Spanish and Portuguese (MIBEL) units alike. No external token required.
 *
 *   npm run build:energy      (or: node scripts/buildEnergyData.mjs)
 *
 * Output: public/data/omie_bids_latest.json   (fetched at runtime by the page)
 *
 * DATA SOURCES (all real, all public, all OMIE)
 *   1. Bids:      curva_pbc_uof monthly ZIP -> one row per offer:
 *                 Periodo;Fecha;Pais;Unidad;Tipo(V/C);Potencia;Precio;O(fertada)/C(asada);Tipologia
 *                 Unit-identified bids are public only AFTER a ~90-day confidentiality
 *                 window, so the "latest available" day is always ~3 months lagged.
 *   2. Crosswalk: LISTA_UNIDADES.PDF ("LISTADO DE UNIDADES OFERTANTES VIGENTES") -> the
 *                 TECNOLOGIA of every OMIE offer unit, in OMIE's own code namespace.
 *   3. Clearing:  marginalpdbc -> official day-ahead marginal price per 15-min period.
 *
 * HONEST LIMITS (surfaced in the dashboard, not hidden)
 *   - >=90-day lag: the current month's unit-identified bids are confidential.
 *   - The period granularity is the 15-min market time unit (H{1..24}Q{1..4}).
 *   - A small residual of unregistered/aggregated units stays "Unmapped".
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'data', 'omie_bids_latest.json');
const UA = 'economic-data/energy-pipeline (+https://github.com/zeemarquez/economic-data)';
const REGISTRY_URL = 'https://www.omie.es/sites/default/files/dados/listados/LISTA_UNIDADES.PDF';

// ----------------------------------------------------------------- taxonomy
// Canonical technology buckets -> { label, color } (colours tuned for a dark UI).
const TECHS = {
  solar_pv:      { label: 'Solar PV',          color: '#f5b301' },
  solar_thermal: { label: 'Solar thermal',     color: '#ff7a1a' },
  wind:          { label: 'Wind',              color: '#3ec9a7' },
  hydro:         { label: 'Hydro',             color: '#3aa0e0' },
  pumped:        { label: 'Pumped storage',    color: '#6c8cff' },
  nuclear:       { label: 'Nuclear',           color: '#c879ff' },
  coal:          { label: 'Coal',              color: '#8a6a55' },
  ccgt:          { label: 'Combined cycle',    color: '#ff5d73' },
  cogen:         { label: 'Cogen / thermal',   color: '#d9b94a' },
  waste_bio:     { label: 'Waste / biomass',   color: '#9abf3e' },
  oil:           { label: 'Fuel / gas oil',    color: '#b5651d' },
  import_export: { label: 'Import / export',   color: '#9aa0a6' },
  storage:       { label: 'Storage',           color: '#4dd0c2' },
  other:         { label: 'Other',             color: '#c0b7a8' },
  unmapped:      { label: 'Unmapped',          color: '#5b5650' },
};

/** OMIE "TECNOLOGIA" (accent-stripped, lowercased) -> canonical bucket. */
function omieTecToTech(rawTec) {
  const t = norm(rawTec);
  if (!t) return null;
  if (t.includes('fotovolt')) return 'solar_pv';
  if (t.includes('solar termica') || t.includes('termosolar')) return 'solar_thermal';
  if (t.includes('eolica')) return 'wind';
  if (t.includes('bombeo')) return 'pumped'; // "hidraulica de bombeo", "consumo de bombeo"
  if (t.includes('hidraulica')) return 'hydro';
  if (t.includes('nuclear')) return 'nuclear';
  if (t.includes('ciclo combinado')) return 'ccgt';
  if (t === 'gas' || t.includes('gas natural')) return 'ccgt';
  if (t.includes('hulla') || t.includes('antracita') || t.includes('carbon') || t.includes('lignito')) return 'coal';
  if (t.includes('termica renovable')) return 'waste_bio'; // biomass / renewable thermal
  if (t.includes('termica no')) return 'cogen'; // non-renewable thermal (mostly cogeneration)
  if (t.includes('cogener') || t.includes('residual')) return 'cogen';
  if (t.includes('residuo') || t.includes('biomasa') || t.includes('biogas')) return 'waste_bio';
  if (t.includes('geotermica')) return 'other';
  if (t.includes('almacenamiento')) return 'storage';
  if (t.includes('import') || t.includes('externos') || t.includes('no residente') || t.includes('internacional'))
    return 'import_export';
  // hybrids / portfolios / generic or CUR-tariff renewables with unspecified technology
  if (
    t.includes('hibrida') ||
    t.includes('porfolio') ||
    t.includes('portfolio') ||
    t.includes('renovab') ||
    t.includes('reg. especial') ||
    t.includes('tarifa cur') ||
    t.includes('tar. cur') ||
    t.includes('generic')
  )
    return 'other';
  // buy-side / commercial unit types (rare on the sell side)
  if (t.includes('comercializ') || t.includes('compras') || t.includes('consumidor') || t.includes('consumo') || t.startsWith('rep.'))
    return 'other';
  return 'other';
}

// ----------------------------------------------------------------- helpers
function norm(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
/** Spanish number "1.234,56" -> 1234.56 */
function num(s) {
  const v = parseFloat(String(s).trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : NaN;
}

// ----------------------------------------------------------------- 1. crosswalk
async function fetchUnitRegistry() {
  console.log('Fetching OMIE unit->technology registry (LISTA_UNIDADES.PDF)...');
  const res = await fetch(REGISTRY_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`LISTA_UNIDADES: HTTP ${res.status}`);
  const data = new Uint8Array(await res.arrayBuffer());
  const doc = await getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;

  const code2tech = new Map();
  // TECNOLOGIA is the column right after ZONA/FRONTERA; reconstruct rows by y-position.
  const zoneRe = /(ZONA ESPA\S+|ZONA PORTUGUESA|FRONTERA [A-Z]+)\s{1,}(.+)/;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { items } = await page.getTextContent();
    const rows = new Map();
    for (const it of items) {
      if (!it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      let key = null;
      for (const k of rows.keys()) if (Math.abs(k - y) <= 2) { key = k; break; }
      if (key == null) { key = y; rows.set(y, []); }
      rows.get(key).push({ x: it.transform[4], s: it.str });
    }
    for (const cells of rows.values()) {
      cells.sort((a, b) => a.x - b.x);
      const line = cells.map((c) => c.s).join(' ').replace(/\s+/g, ' ').trim();
      const code = line.split(' ')[0];
      if (!/^[A-Z0-9_]{2,12}$/.test(code) || code === 'CODIGO' || code2tech.has(code)) continue;
      const m = line.match(zoneRe);
      if (!m) continue;
      const tech = omieTecToTech(m[2]);
      if (tech) code2tech.set(code, tech);
    }
  }
  console.log(`  Registry: ${code2tech.size} offer units mapped to technology.`);
  return code2tech;
}

/** Classify a single OMIE offer-unit code -> canonical tech bucket. */
function classify(unit, code2tech) {
  const t = code2tech.get(unit);
  if (t) return t;
  if (/^(MIE|MIP|MIEU|MIPU)/.test(unit)) return 'import_export'; // OMIE import/export pseudo-units
  return 'unmapped';
}

// ----------------------------------------------------------------- 2. OMIE bids
const omieZipUrl = (yyyymm) =>
  `https://www.omie.es/en/file-download?parents=curva_pbc_uof&filename=curva_pbc_uof_${yyyymm}.zip`;

async function findLatestMonth() {
  const now = new Date();
  for (let back = 1; back <= 8; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const yyyymm = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const res = await fetch(omieZipUrl(yyyymm), { method: 'HEAD', headers: { 'User-Agent': UA } });
    if (res.ok && /zip/i.test(res.headers.get('content-type') || '')) {
      console.log(`OMIE latest available month: ${yyyymm}`);
      return yyyymm;
    }
  }
  throw new Error('Could not locate a recent OMIE curva_pbc_uof monthly zip.');
}

async function downloadLatestDay(yyyymm) {
  console.log(`Downloading curva_pbc_uof_${yyyymm}.zip (~70 MB)...`);
  const res = await fetch(omieZipUrl(yyyymm), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`OMIE zip ${yyyymm}: HTTP ${res.status}`);
  const zip = new Uint8Array(await res.arrayBuffer());

  // Pass 1: list entry names without decompressing.
  const names = [];
  unzipSync(zip, { filter: (f) => { names.push(f.name); return false; } });
  const daily = names.filter((n) => /curva_pbc_uof_\d{8}\.1$/.test(n)).sort();
  if (!daily.length) throw new Error('No daily curve files inside the monthly zip.');
  const latest = daily[daily.length - 1];

  // Pass 2: decompress only the latest day.
  const out = unzipSync(zip, { filter: (f) => f.name === latest });
  const buf = out[latest];
  const text = Buffer.from(buf).toString('latin1');
  const day = latest.match(/(\d{8})/)[1];
  console.log(`  Latest day in file: ${day}  (${(buf.length / 1e6).toFixed(1)} MB, ${daily.length} days available)`);
  return { day, text };
}

/**
 * OMIE's official day-ahead marginal (clearing) price, per 15-min period (1..96).
 * Authoritative — accounts for complex conditions (block bids, minimum income) that a
 * naive "highest matched sell offer" approximation can miss. Dot decimals here.
 * Returns Map<periodoIdx (1..96), EUR/MWh ES>.
 */
async function fetchMarginalPrice(day) {
  const url = `https://www.omie.es/en/file-download?parents=marginalpdbc&filename=marginalpdbc_${day}.1`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    console.warn(`  marginalpdbc ${day}: HTTP ${res.status} — will fall back to derived clearing.`);
    return new Map();
  }
  const text = await res.text();
  const m = new Map();
  for (const line of text.split('\n')) {
    const p = line.split(';');
    if (p.length < 6 || !/^\d{4}$/.test(p[0])) continue;
    const periodo = parseInt(p[3], 10);
    const es = parseFloat(p[5]); // col 5 = Spanish price (col 4 = Portuguese)
    if (Number.isFinite(periodo) && Number.isFinite(es)) m.set(periodo, es);
  }
  console.log(`  Official marginal price: ${m.size} periods from marginalpdbc_${day}.1`);
  return m;
}

// ----------------------------------------------------------------- 3. build curves
function buildCurves(text, code2tech, marginal) {
  const periods = new Map(); // id -> { offers: Map<"price|tech", mwh>, clearing, clearedMwh, offeredMwh }
  const techMwh = {};
  let totalOffered = 0;

  for (const line of text.split('\n')) {
    if (!line || line[0] !== 'H') continue; // data rows start with the period H..Q..
    const p = line.split(';');
    if (p.length < 8) continue;
    const period = p[0];
    if (!/^H\d{1,2}Q\d$/.test(period)) continue;
    if (p[4] !== 'V') continue; // sell side only (supply curve)
    const mwh = num(p[5]);
    const price = num(p[6]);
    if (!Number.isFinite(mwh) || !Number.isFinite(price)) continue;
    const oc = p[7];

    let rec = periods.get(period);
    if (!rec) {
      rec = { offers: new Map(), clearing: -Infinity, clearedMwh: 0, offeredMwh: 0 };
      periods.set(period, rec);
    }

    if (oc === 'O') {
      const tech = classify(p[3], code2tech);
      const key = `${price.toFixed(2)}|${tech}`;
      rec.offers.set(key, (rec.offers.get(key) || 0) + mwh);
      rec.offeredMwh += mwh;
      techMwh[tech] = (techMwh[tech] || 0) + mwh;
      totalOffered += mwh;
    } else if (oc === 'C') {
      rec.clearedMwh += mwh;
      if (price > rec.clearing) rec.clearing = price;
    }
  }

  const presentKeys = Object.keys(TECHS).filter((k) => techMwh[k] > 0 || k === 'unmapped');
  const techIndex = new Map(presentKeys.map((k, i) => [k, i]));
  const technologies = presentKeys.map((k) => ({ key: k, label: TECHS[k].label, color: TECHS[k].color }));

  const periodList = [...periods.entries()]
    .map(([id, rec]) => {
      const m = id.match(/^H(\d{1,2})Q(\d)$/);
      const hour = +m[1], quarter = +m[2];
      const offers = [...rec.offers.entries()]
        .map(([k, v]) => {
          const [pr, tech] = k.split('|');
          return [Math.round(parseFloat(pr) * 100) / 100, Math.round(v * 10) / 10, techIndex.get(tech) ?? techIndex.get('unmapped')];
        })
        .filter((o) => o[1] > 0)
        .sort((a, b) => a[0] - b[0]);
      const startMin = (hour - 1) * 60 + (quarter - 1) * 15;
      const hh = String(Math.floor(startMin / 60)).padStart(2, '0');
      const mm = String(startMin % 60).padStart(2, '0');
      const ehh = String(Math.floor((startMin + 15) / 60) % 24).padStart(2, '0');
      const emm = String((startMin + 15) % 60).padStart(2, '0');
      const official = marginal?.get((hour - 1) * 4 + quarter);
      const clearing =
        official != null
          ? Math.round(official * 100) / 100
          : Number.isFinite(rec.clearing)
            ? Math.round(rec.clearing * 100) / 100
            : null;
      return {
        id, hour, quarter,
        label: `${hh}:${mm}–${ehh}:${emm}`,
        clearing,
        clearedMwh: Math.round(rec.clearedMwh),
        offeredMwh: Math.round(rec.offeredMwh),
        offers,
      };
    })
    .sort((a, b) => a.hour - b.hour || a.quarter - b.quarter);

  const mappedMwh = totalOffered - (techMwh.unmapped || 0);
  return {
    technologies,
    periods: periodList,
    coverage: { totalOfferedMwh: Math.round(totalOffered), mappedPct: totalOffered ? mappedMwh / totalOffered : 0 },
    techMwh,
  };
}

// ----------------------------------------------------------------- run
async function main() {
  const code2tech = await fetchUnitRegistry();
  const yyyymm = await findLatestMonth();
  const { day, text } = await downloadLatestDay(yyyymm);
  const marginal = await fetchMarginalPrice(day);
  console.log('Parsing offers and building per-technology supply curves...');
  const { technologies, periods, coverage, techMwh } = buildCurves(text, code2tech, marginal);

  const marketDate = `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;
  const lagDays = Math.round((Date.now() - new Date(marketDate + 'T12:00:00Z').getTime()) / 864e5);

  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      marketDate,
      monthFile: `curva_pbc_uof_${yyyymm}.zip`,
      lagDays,
      periods: periods.length,
      source: 'OMIE curva_pbc_uof (day-ahead per-unit bids) + marginalpdbc + LISTA_UNIDADES registry',
      crosswalk: 'OMIE LISTADO DE UNIDADES OFERTANTES VIGENTES (TECNOLOGIA per offer unit)',
      coverage,
      notes: [
        'Unit-identified bids are public only after a ~90-day confidentiality window, so this is the latest available day (~3 months lagged).',
        'Each step is a real sell offer (merged by price level within a technology). Clearing price is OMIE’s official marginal price (marginalpdbc) per 15-min period.',
        'Technology comes from OMIE’s own unit registry (same code namespace as the bids), covering Spanish and Portuguese MIBEL units; a small residual of unregistered units is shown as "Unmapped".',
      ],
    },
    technologies,
    periods,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out), 'utf8');

  const bytes = Buffer.byteLength(JSON.stringify(out));
  console.log('\n=== summary ===');
  console.log(`market date     ${marketDate}  (lag ${lagDays} d)`);
  console.log(`periods         ${periods.length}`);
  console.log(`offered energy  ${(coverage.totalOfferedMwh / 1000).toFixed(0)} GWh`);
  console.log(`mapped coverage ${(coverage.mappedPct * 100).toFixed(1)} % of offered MWh`);
  console.log('technology offered-MWh share:');
  for (const t of technologies) {
    const mwh = techMwh[t.key] || 0;
    if (mwh > 0) console.log(`  ${(100 * mwh / coverage.totalOfferedMwh).toFixed(1).padStart(5)} %  ${t.label}`);
  }
  console.log(`\nWrote ${OUT}  (${(bytes / 1e6).toFixed(2)} MB)`);
}

main().catch((e) => { console.error('\nBUILD FAILED:', e.message); process.exit(1); });
