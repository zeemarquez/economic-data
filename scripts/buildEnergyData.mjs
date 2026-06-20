/**
 * OMIE day-ahead bids -> supply curve BY TECHNOLOGY (baked JSON for the dashboard)
 * ================================================================================
 * Reconstructs the real per-technology day-ahead supply curve from OMIE's published
 * per-unit bids (`curva_pbc_uof`), joined to a unit->technology crosswalk built
 * automatically from the ESIOS unit registries.
 *
 *   node --env-file=.env scripts/buildEnergyData.mjs
 *   (or:  ESIOS_API_KEY=xxxx node scripts/buildEnergyData.mjs )
 *
 * Output: public/data/omie_bids_latest.json   (fetched at runtime by the page)
 *
 * DATA SOURCES (all real, all public)
 *   1. Bids:     OMIE curva_pbc_uof monthly ZIP -> one row per offer:
 *                Periodo;Fecha;Pais;Unidad;Tipo;Potencia;Precio;Ofertada(O)/Casada(C);Tipologia
 *                Unit-identified bids are public only AFTER a ~90-day confidentiality
 *                window, so the "latest available" day is always ~3 months lagged.
 *   2. Crosswalk: ESIOS "Unidades de programacion" (archive 82) + "Unidades fisicas"
 *                (archive 81), which carry "Tipo de produccion" (technology) per unit.
 *                Requires a free ESIOS personal token (ESIOS_API_KEY).
 *
 * HONEST LIMITS (surfaced in the dashboard, not hidden)
 *   - >=90-day lag: the current month's unit-identified bids are confidential.
 *   - OMIE offer-unit codes only partially overlap ESIOS UP/UF codes, so a share of
 *     volume (esp. Portuguese MIBEL units and aggregated/portfolio renewables) stays
 *     "Unmapped". Mapped coverage is reported in the output meta and shown in the UI.
 *   - The period granularity is the new 15-min market time unit (H{1..24}Q{1..4}).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'data', 'omie_bids_latest.json');

const ESIOS_API_KEY = process.env.ESIOS_API_KEY;
const UA = 'economic-data/energy-pipeline (+https://github.com/zeemarquez/economic-data)';

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
  cogen:         { label: 'Cogen / residual',  color: '#d9b94a' },
  waste_bio:     { label: 'Waste / biomass',   color: '#9abf3e' },
  oil:           { label: 'Fuel / gas oil',    color: '#b5651d' },
  import_export: { label: 'Import / export',   color: '#9aa0a6' },
  storage:       { label: 'Storage',           color: '#4dd0c2' },
  other:         { label: 'Other',             color: '#c0b7a8' },
  unmapped:      { label: 'Unmapped',          color: '#5b5650' },
};

/** ESIOS "Tipo de produccion" (accent-stripped, lowercased) -> canonical bucket. */
function esiosTipoToTech(rawTipo) {
  const t = norm(rawTipo);
  if (!t) return null;
  if (t.includes('fotovolt')) return 'solar_pv';
  if (t.includes('termosolar') || (t.includes('solar') && t.includes('term'))) return 'solar_thermal';
  if (t.includes('eolic')) return 'wind';
  if (t.includes('bombeo')) return 'pumped';
  if (t.includes('hidra') || t.includes('fluyente') || t.includes('embalse') || t.includes('ugh')) return 'hydro';
  if (t.includes('nuclear')) return 'nuclear';
  if (t.includes('ciclo combinado')) return 'ccgt';
  if (t.includes('cogener') || t.includes('energia residual')) return 'cogen';
  if (t.includes('residuo') || t.includes('biomasa') || t.includes('biogas')) return 'waste_bio';
  if (t.includes('hulla') || t.includes('antracita') || t.includes('carbon') || t.includes('lignito')) return 'coal';
  if (t.includes('gas natural')) return 'ccgt';
  if (t.includes('derivados del petroleo') || t.includes('fuel') || t.includes('gasoil') || t.includes('petroleo')) return 'oil';
  if (t.includes('importacion') || t.includes('exportacion')) return 'import_export';
  if (t.includes('almacenamiento') || t.includes('bateria')) return 'storage';
  // Buy-side / commercial unit types that may leak through -> not a generation tech.
  if (t.includes('comercializ') || t.includes('consumo') || t.includes('demanda') || t.includes('generic')) return 'other';
  return 'other';
}

/**
 * Curated, best-effort supplement for the largest MIBEL units that are NOT in the
 * ESIOS Spanish registry (mostly Portuguese plants). High-confidence, well-documented
 * plants only; anything uncertain is left to fall through to "Unmapped".
 */
const SUPPLEMENT = {
  // Portuguese hydro schemes (river/cascade names)
  TAMEGA: 'hydro', ADOURO: 'hydro', DOUSUP: 'hydro', ALIMA: 'hydro',
  ACAVADO: 'hydro', MONDEGO: 'hydro', GUADIA: 'hydro', TEMON: 'hydro',
  // Portuguese combined-cycle gas
  RIBATE1: 'ccgt', RIBATE2: 'ccgt', RIBATE3: 'ccgt', LARES1: 'ccgt', LARES2: 'ccgt',
};

// ----------------------------------------------------------------- helpers
function norm(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
/** Spanish number "1.234,56" -> 1234.56 */
function num(s) {
  const v = parseFloat(String(s).trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : NaN;
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json; application/vnd.esios-api-v1+json',
      'x-api-key': ESIOS_API_KEY,
      'User-Agent': UA,
    },
  });
  if (!res.ok) throw new Error(`ESIOS ${url}: HTTP ${res.status}`);
  return res.json();
}

/** Read a field from an ESIOS record by matching an accent-insensitive key fragment. */
function field(rec, frag) {
  for (const k of Object.keys(rec)) {
    if (norm(k).includes(frag)) return rec[k];
  }
  return undefined;
}

// ----------------------------------------------------------------- 1. crosswalk
async function buildCrosswalk() {
  if (!ESIOS_API_KEY) {
    throw new Error(
      'ESIOS_API_KEY is not set. Get a free token (https://www.esios.ree.es/en/page/api) ' +
      'and run:  node --env-file=.env scripts/buildEnergyData.mjs'
    );
  }
  console.log('Fetching ESIOS unit registries (archives 82 + 81)...');
  const [up, uf] = await Promise.all([
    getJson('https://api.esios.ree.es/archives/82/download_json?locale=es'),
    getJson('https://api.esios.ree.es/archives/81/download_json?locale=es'),
  ]);
  const upRows = up.UnidadesProgramacion || up.ProgrammingUnits || [];
  const ufRows = uf.UnidadesFisicas || uf.GenerationUnits || [];

  const code2tech = new Map();
  const add = (code, tipo) => {
    if (!code || code2tech.has(code)) return;
    const tech = esiosTipoToTech(tipo);
    if (tech) code2tech.set(String(code).trim(), tech);
  };
  // Programming units first (their code namespace is closest to OMIE offer codes),
  // then physical units to widen coverage.
  for (const r of upRows) add(field(r, 'codigo de up'), field(r, 'tipo de produccion'));
  for (const r of ufRows) add(field(r, 'codigo de uf'), field(r, 'tipo de produccion'));

  console.log(`  ESIOS crosswalk: ${code2tech.size} unit codes (UP=${upRows.length}, UF=${ufRows.length}).`);
  return code2tech;
}

/** Classify a single OMIE offer-unit code -> canonical tech bucket. */
function classify(unit, code2tech) {
  if (code2tech.has(unit)) return code2tech.get(unit);
  // suffix variants common in OMIE offer codes (e.g. trailing "R" for redespacho)
  const stripR = unit.replace(/R$/, '');
  if (stripR !== unit && code2tech.has(stripR)) return code2tech.get(stripR);
  const stripNum = unit.replace(/\d+R?$/, '');
  if (stripNum && code2tech.has(stripNum)) return code2tech.get(stripNum);
  if (SUPPLEMENT[unit]) return SUPPLEMENT[unit];
  // OMIE import/export pseudo-units
  if (/^(MIE|MIP|MIEU|MIPU)/.test(unit)) return 'import_export';
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
 * Returns Map<periodoIdx (1..96), €/MWh ES>.
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
  // Per-period accumulators.
  const periods = new Map(); // id -> { offers: Map<"price|tech", mwh>, clearing, clearedMwh, offeredMwh }
  const techMwh = {};        // canonical tech -> offered MWh (for coverage stats)
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
      // Offered segment -> part of the submitted supply curve.
      const tech = classify(p[3], code2tech);
      const key = `${price.toFixed(2)}|${tech}`;
      rec.offers.set(key, (rec.offers.get(key) || 0) + mwh);
      rec.offeredMwh += mwh;
      techMwh[tech] = (techMwh[tech] || 0) + mwh;
      totalOffered += mwh;
    } else if (oc === 'C') {
      // Matched segment -> real clearing comes from the most expensive matched sell.
      rec.clearedMwh += mwh;
      if (price > rec.clearing) rec.clearing = price;
    }
  }

  // Determine which technologies actually appear, ordered by the canonical taxonomy.
  const presentKeys = Object.keys(TECHS).filter((k) => techMwh[k] > 0 || k === 'unmapped');
  const techIndex = new Map(presentKeys.map((k, i) => [k, i]));
  const technologies = presentKeys.map((k) => ({ key: k, label: TECHS[k].label, color: TECHS[k].color }));

  const periodList = [...periods.entries()]
    .map(([id, rec]) => {
      const m = id.match(/^H(\d{1,2})Q(\d)$/);
      const hour = +m[1], quarter = +m[2];
      // Merge same-(price,tech) offers, sort by price ascending (merit order).
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
      // Prefer OMIE's official marginal price; fall back to the derived approximation.
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
  const code2tech = await buildCrosswalk();
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
      source: 'OMIE curva_pbc_uof (day-ahead per-unit bids, sell side) + marginalpdbc + ESIOS unit registries',
      crosswalk: 'ESIOS Unidades de Programacion (82) + Unidades Fisicas (81), Tipo de produccion',
      coverage,
      notes: [
        'Unit-identified bids are public only after a ~90-day confidentiality window, so this is the latest available day (~3 months lagged).',
        "Each step is a real sell offer (merged by price level within a technology). Clearing price is OMIE's official marginal price (marginalpdbc) per 15-min period.",
        'OMIE offer-unit codes only partially overlap the ESIOS registry; unmatched volume (notably Portuguese MIBEL units and aggregated/portfolio renewables) is shown as "Unmapped".',
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
