import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Activity, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Card } from '../components/ui/Card';

/* ------------------------------------------------------------------ types */
type Tech = { key: string; label: string; color: string };
type Offer = [number, number, number]; // [price €/MWh, energy MWh, techIdx]
type Period = {
  id: string;
  hour: number;
  quarter: number;
  label: string;
  clearing: number | null;
  clearedMwh: number;
  offeredMwh: number;
  offers: Offer[];
};
type Bundle = {
  meta: {
    marketDate: string;
    monthFile: string;
    lagDays: number;
    periods: number;
    source: string;
    crosswalk: string;
    coverage: { totalOfferedMwh: number; mappedPct: number };
    notes: string[];
  };
  technologies: Tech[];
  periods: Period[];
};
type Geom = {
  steps: { price: number; energy: number; t: number; cum0: number; cum1: number }[];
  tot: number;
  xMin: number;
  xMax: number;
  pMin: number;
  pMax: number;
  yLo: number;
  yHi: number;
  xS: (v: number) => number;
  yS: (v: number) => number;
  clearingX: number | null; // cumulative MWh where the supply curve crosses the clearing price
};

/* -------------------------------------------------------------- formatting */
const NF = (n: number, d = 0) =>
  Number.isFinite(n)
    ? Number(n).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

const W = 900;
const H = 440;
const PAD = { l: 54, r: 18, t: 18, b: 46 };

/* The retro animation is drawn with fixed pixel offsets sized for a large viewport,
   so we render it at this design resolution and CSS-scale it to fit its column. */
const ANIM_W = 820;
const ANIM_H = 480;

/* ============================================================= component */
export default function EnergiaEspana() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [hover, setHover] = useState<{ x: number; y: number; cx: number; html: string } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Scale the fixed-resolution animation iframe to fit its (responsive) column.
  const animWrapRef = useRef<HTMLDivElement>(null);
  const [animScale, setAnimScale] = useState(0);
  useLayoutEffect(() => {
    const el = animWrapRef.current;
    if (!el) return;
    const update = () => setAnimScale(el.clientWidth / ANIM_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}data/omie_bids_latest.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: Bundle) => {
        if (!alive) return;
        setBundle(j);
        // default to a representative midday period (H13Q1) if present
        const mid = j.periods.findIndex((p) => p.hour === 13 && p.quarter === 1);
        setIdx(mid >= 0 ? mid : Math.floor(j.periods.length / 2));
      })
      .catch((e) => alive && setError(String(e.message || e)));
    return () => {
      alive = false;
    };
  }, []);

  const period = bundle?.periods[idx] ?? null;
  const techs = bundle?.technologies ?? [];

  // horizontal (cumulative-energy) zoom via drag-select, à la Plotly
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const [xZoom, setXZoom] = useState<[number, number] | null>(null);
  const [dragRange, setDragRange] = useState<[number, number] | null>(null);
  // reset the x-zoom whenever the period changes (cumulative scale differs per period)
  useEffect(() => {
    setXZoom(null);
    setDragRange(null);
  }, [idx]);

  /* ---- geometry + cumulative curve for the selected period ---- */
  const geom = useMemo<Geom | null>(() => {
    if (!period || !period.offers.length) return null;
    const offers = period.offers; // already sorted by price asc
    let cum = 0;
    const steps = offers.map(([price, energy, t]) => {
      const x0 = cum;
      cum += energy;
      return { price, energy, t, cum0: x0, cum1: cum };
    });
    const tot = cum;
    const prices = offers.map((o) => o[0]);
    const pMin = Math.min(...prices);
    const pMax = Math.max(...prices);
    const yLo = Math.min(0, pMin);
    const yHi = pMax * 1.04 || 1;
    const [xMin, xMax] = xZoom ?? [0, tot];
    const xSpan = xMax - xMin || 1;
    const xS = (v: number) => PAD.l + ((v - xMin) / xSpan) * (W - PAD.l - PAD.r);
    const yRaw = (v: number) => H - PAD.b - ((v - yLo) / (yHi - yLo)) * (H - PAD.t - PAD.b);
    const yS = (v: number) => yRaw(Math.max(yLo, Math.min(yHi, v))); // clamp into the window
    // where the supply curve first reaches the clearing price (the real cross point)
    let clearingX: number | null = null;
    if (period.clearing != null) {
      clearingX = tot;
      for (const st of steps) {
        if (st.price >= period.clearing) {
          clearingX = st.cum0;
          break;
        }
      }
    }
    return { steps, tot, xMin, xMax, pMin, pMax, yLo, yHi, xS, yS, clearingX };
  }, [period, xZoom]);

  /* ---- volume-weighted bid price by technology (client-side) ---- */
  const byTech = useMemo(() => {
    if (!period) return [];
    const m = new Map<number, { mwh: number; ws: number; min: number; max: number }>();
    for (const [price, energy, t] of period.offers) {
      const e = m.get(t) ?? { mwh: 0, ws: 0, min: Infinity, max: -Infinity };
      e.mwh += energy;
      e.ws += price * energy;
      e.min = Math.min(e.min, price);
      e.max = Math.max(e.max, price);
      m.set(t, e);
    }
    return [...m.entries()]
      .map(([t, v]) => ({ t, mwh: v.mwh, vwap: v.ws / v.mwh, min: v.min, max: v.max }))
      .sort((a, b) => a.vwap - b.vwap);
  }, [period]);

  const presentTechIdx = useMemo(
    () => [...new Set((period?.offers ?? []).map((o) => o[2]))],
    [period]
  );

  /* ---- pointer interaction (hover tooltip + drag-to-zoom on x) ---- */
  const clientToData = (clientX: number): number => {
    const svg = svgRef.current;
    if (!svg || !geom) return 0;
    const r = svg.getBoundingClientRect();
    const svgX = ((clientX - r.left) / r.width) * W;
    const frac = Math.max(0, Math.min(1, (svgX - PAD.l) / (W - PAD.l - PAD.r)));
    return geom.xMin + frac * (geom.xMax - geom.xMin);
  };
  const offerAt = (dx: number) => geom?.steps.find((st) => dx >= st.cum0 && dx <= st.cum1) ?? null;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!geom) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* no active pointer (e.g. synthetic events) */
    }
    draggingRef.current = true;
    startXRef.current = clientToData(e.clientX);
    setDragRange([startXRef.current, startXRef.current]);
    setHover(null);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!geom) return;
    const dx = clientToData(e.clientX);
    if (draggingRef.current) {
      setDragRange([startXRef.current, dx]);
      return;
    }
    const st = offerAt(dx);
    if (!st || !period) return setHover(null);
    const wr = chartRef.current!.getBoundingClientRect();
    const tech = techs[st.t];
    const matched = period.clearing == null || st.price <= period.clearing;
    setHover({
      x: e.clientX - wr.left,
      y: e.clientY - wr.top,
      cx: geom.xS((st.cum0 + st.cum1) / 2),
      html: `<b style="color:${tech?.color}">${tech?.label ?? 'Unmapped'}</b><br>${NF(st.price, 2)} €/MWh · ${NF(
        st.energy,
        0
      )} MWh<br><span style="color:${matched ? '#10b981' : '#9a9488'}">${matched ? 'casada' : 'no casada'}</span>`,
    });
  };
  const finishDrag = (e: React.PointerEvent) => {
    if (!draggingRef.current || !geom) return;
    draggingRef.current = false;
    const a = startXRef.current;
    const b = clientToData(e.clientX);
    setDragRange(null);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (Math.abs(geom.xS(hi) - geom.xS(lo)) > 6) setXZoom([lo, hi]); // ignore tiny drags / clicks
  };

  /* --------------------------------------------------------------- render */
  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-6xl mb-8 flex justify-between items-end border-b border-white/5 pb-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-neutral-500 hover:text-white transition-colors p-1 -ml-1"
            aria-label="Volver al inicio"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white font-mono">
              ENERGÍA<span className="text-neutral-500">ESPAÑA</span>
            </h1>
            <p className="text-neutral-500 font-mono text-xs mt-1">
              Curva de oferta del mercado diario por tecnología · ofertas reales de OMIE
            </p>
          </div>
        </div>
        {bundle && (
          <div className="hidden sm:flex flex-col items-end gap-1 font-mono text-[11px]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Datos reales · {bundle.meta.marketDate}
            </span>
            <span className="text-neutral-600">
              último día publicado · desfase {bundle.meta.lagDays} d
            </span>
          </div>
        )}
      </header>

      <main className="w-full max-w-6xl flex flex-col gap-6">
        {/* intro: animation + plain-Spanish explainer of how the market works */}
        <Card title="Cómo funciona el mercado eléctrico" icon={<Zap className="text-white" size={18} />}>
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div
              ref={animWrapRef}
              className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-black/40"
              style={{ aspectRatio: `${ANIM_W} / ${ANIM_H}` }}
            >
              <iframe
                src={`${import.meta.env.BASE_URL}animations/retro_energy_generator.html`}
                title="Generador de energía retro"
                scrolling="no"
                style={{
                  width: ANIM_W,
                  height: ANIM_H,
                  border: 0,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: `scale(${animScale})`,
                  transformOrigin: 'top left',
                  visibility: animScale > 0 ? 'visible' : 'hidden',
                }}
              />
            </div>
            <div className="flex flex-col justify-center gap-4 font-mono text-xs text-neutral-400 leading-relaxed">
              {[
                {
                  n: '1',
                  t: 'Oferta y demanda, al instante',
                  d: 'La electricidad casi no se almacena: en cada momento, la potencia que generan las centrales tiene que igualar exactamente a la que consumimos todos a la vez.',
                },
                {
                  n: '2',
                  t: 'La frecuencia manda (50 Hz)',
                  d: 'Ese equilibrio se vigila con la frecuencia de la red. Si sobra generación, la frecuencia sube por encima de 50 Hz; si falta, baja. Mantenerla clavada en 50 Hz es la prueba de que oferta y demanda están casadas en tiempo real.',
                },
                {
                  n: '3',
                  t: 'El precio sale de las pujas',
                  d: 'La víspera, cada central ofrece su energía a un precio (€/MWh) y los consumidores pujan por comprarla. OMIE ordena las ofertas de venta de la más barata a la más cara (orden de mérito) y las cruza con la demanda. Donde se cortan se fija un único precio para todos —el precio de casación—, el de la última central necesaria para cubrir el consumo.',
                },
              ].map((it) => (
                <div key={it.n} className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-md bg-white/10 border border-white/15 text-white text-[11px] font-bold flex items-center justify-center">
                    {it.n}
                  </span>
                  <p>
                    <span className="text-neutral-200 font-semibold">{it.t}.</span> {it.d}
                  </p>
                </div>
              ))}
              <p className="text-neutral-600 pl-8">
                La curva de abajo es esa oferta real del mercado diario, con cada escalón coloreado según su
                tecnología.
              </p>
            </div>
          </div>
        </Card>

        {error && (
          <Card className="border-red-500/20">
            <p className="text-red-300 font-mono text-sm">
              No se pudieron cargar los datos de ofertas ({error}). Ejecuta{' '}
              <code className="bg-black/40 px-1.5 py-0.5 rounded">node --env-file=.env scripts/buildEnergyData.mjs</code>{' '}
              para generar <code className="bg-black/40 px-1.5 py-0.5 rounded">public/data/omie_bids_latest.json</code>.
            </p>
          </Card>
        )}

        {!bundle && !error && (
          <Card className="min-h-[420px] flex items-center justify-center">
            <div className="flex items-center gap-3 text-neutral-500 font-mono text-sm">
              <Activity className="animate-pulse" size={18} />
              Cargando ofertas del mercado diario…
            </div>
          </Card>
        )}

        {bundle && period && geom && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi
                label="Precio de casación"
                value={period.clearing != null ? `${NF(period.clearing, 1)}` : '—'}
                unit="€/MWh"
                highlight
              />
              <Kpi label="Energía casada" value={NF(period.clearedMwh / 1000, 1)} unit="GWh" />
              <Kpi label="Energía ofertada" value={NF(period.offeredMwh / 1000, 1)} unit="GWh" />
              <Kpi
                label="Cobertura mapeada"
                value={NF(Math.floor(bundle.meta.coverage.mappedPct * 1000) / 10, 1)}
                unit="% MWh"
              />
            </div>

            {/* Chart card */}
            <Card
              className="flex flex-col"
              title={`Curva de oferta · ${period.label} (período ${period.id})`}
              icon={<Zap className="text-white" size={18} />}
              headerAside={
                xZoom ? (
                  <button
                    type="button"
                    onClick={() => setXZoom(null)}
                    title="Restablecer zoom horizontal"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-white/10 bg-black/40 text-neutral-300 hover:text-white font-mono text-[11px] transition-colors"
                  >
                    <RotateCcw size={12} /> Zoom
                  </button>
                ) : undefined
              }
            >
              {/* period scrubber */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                  className="text-neutral-500 hover:text-white transition-colors shrink-0"
                  aria-label="Período anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={bundle.periods.length - 1}
                  value={idx}
                  onChange={(e) => setIdx(+e.target.value)}
                  className="flex-1 accent-white h-1 cursor-pointer"
                  aria-label="Selector de período"
                />
                <button
                  type="button"
                  onClick={() => setIdx((i) => Math.min(bundle.periods.length - 1, i + 1))}
                  className="text-neutral-500 hover:text-white transition-colors shrink-0"
                  aria-label="Período siguiente"
                >
                  <ChevronRight size={18} />
                </button>
                <span className="font-mono text-xs text-neutral-300 w-28 text-right tabular-nums shrink-0">
                  {period.label}
                </span>
              </div>

              <div ref={chartRef} className="relative select-none">
                {hover && (
                  <div
                    className="pointer-events-none absolute z-10 bg-black/90 border border-white/10 rounded-md px-2.5 py-1.5 text-[11px] font-mono text-white leading-relaxed whitespace-nowrap"
                    style={{ left: hover.x + 12, top: hover.y - 10 }}
                    dangerouslySetInnerHTML={{ __html: hover.html }}
                  />
                )}
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${W} ${H}`}
                  preserveAspectRatio="xMidYMid meet"
                  className="block w-full h-auto touch-none"
                >
                  <defs>
                    <clipPath id="plotClip">
                      <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} />
                    </clipPath>
                  </defs>
                  <Axes geom={geom} />
                  <g clipPath="url(#plotClip)">
                    {/* area slices, one per real offer; faded when the offer clears above the price (no casada) */}
                    {geom.steps.map((st, i) => {
                      const x0 = geom.xS(st.cum0);
                      const x1 = geom.xS(st.cum1);
                      if (x1 < PAD.l || x0 > W - PAD.r) return null; // outside the zoom window
                      const yTop = geom.yS(st.price);
                      const yBase = geom.yS(geom.yLo);
                      const tech = techs[st.t];
                      const matched = period.clearing == null || st.price <= period.clearing;
                      return (
                        <rect
                          key={i}
                          x={x0.toFixed(1)}
                          y={Math.min(yTop, yBase).toFixed(1)}
                          width={Math.max(x1 - x0, 0.4).toFixed(2)}
                          height={Math.abs(yBase - yTop).toFixed(1)}
                          fill={tech?.color ?? '#5b5650'}
                          fillOpacity={matched ? 0.85 : 0.22}
                        />
                      );
                    })}
                    <CurveOutline geom={geom} />
                    <Clearing geom={geom} clearing={period.clearing} />
                    {hover && !dragRange && (
                      <line
                        x1={hover.cx}
                        y1={PAD.t}
                        x2={hover.cx}
                        y2={H - PAD.b}
                        stroke="#ffffff"
                        strokeWidth={0.8}
                        strokeOpacity={0.35}
                        pointerEvents="none"
                      />
                    )}
                    {dragRange && (
                      <rect
                        x={Math.min(geom.xS(dragRange[0]), geom.xS(dragRange[1]))}
                        y={PAD.t}
                        width={Math.abs(geom.xS(dragRange[1]) - geom.xS(dragRange[0]))}
                        height={H - PAD.t - PAD.b}
                        fill="#ffffff"
                        fillOpacity={0.12}
                        stroke="#ffffff"
                        strokeOpacity={0.4}
                        strokeWidth={1}
                        pointerEvents="none"
                      />
                    )}
                  </g>
                  {/* transparent overlay: hover tooltip + horizontal drag-to-zoom */}
                  <rect
                    x={PAD.l}
                    y={PAD.t}
                    width={W - PAD.l - PAD.r}
                    height={H - PAD.t - PAD.b}
                    fill="transparent"
                    style={{ cursor: 'crosshair' }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={finishDrag}
                    onPointerLeave={(e) => {
                      if (draggingRef.current) finishDrag(e);
                      setHover(null);
                    }}
                    onDoubleClick={() => setXZoom(null)}
                  />
                </svg>
                <p className="mt-1 text-[10px] text-neutral-600 font-mono text-right">
                  arrastra horizontalmente para ampliar · doble clic para restablecer
                </p>
              </div>

              {/* legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 font-mono text-[11px]">
                {presentTechIdx
                  .map((t) => techs[t])
                  .filter(Boolean)
                  .map((t) => (
                    <span key={t.key} className="inline-flex items-center gap-1.5 text-neutral-400">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: t.color }} />
                      {t.label}
                    </span>
                  ))}
              </div>
            </Card>

            {/* per-technology VWAP table */}
            <Card title="Precio de oferta medio ponderado por tecnología" icon={<Activity size={18} />}>
              <TechTable byTech={byTech} techs={techs} />
            </Card>

            {/* notes */}
            <div className="text-[11px] text-neutral-500 font-mono leading-relaxed border-t border-white/5 pt-4 space-y-2">
              <p>
                <span className="text-neutral-300">Qué muestra.</span> Cada franja de color bajo la curva es una
                oferta de venta real de <code className="bg-black/40 px-1 rounded">curva_pbc_uof</code> de OMIE,
                ordenada de más barata a más cara (orden de mérito). El precio de casación es el precio marginal
                oficial de OMIE (<code className="bg-black/40 px-1 rounded">marginalpdbc</code>) para cada período de
                15 min. La tabla es el precio de oferta medio ponderado por volumen para cada tecnología.
              </p>
              <p>
                <span className="text-neutral-300">Límites honestos.</span> Las ofertas con unidad identificada solo
                son públicas tras la ventana de confidencialidad de ~90 días, por lo que se muestra el último día
                disponible ({bundle.meta.marketDate}, desfase {bundle.meta.lagDays} días). La tecnología procede del
                registro oficial de unidades de OMIE (mismo código que las ofertas), que cubre unidades españolas y
                portuguesas del MIBEL:{' '}
                <span className="text-neutral-400">
                  {NF(bundle.meta.coverage.mappedPct * 100, 1)}% del volumen
                </span>{' '}
                queda mapeado por tecnología; un pequeño resto de unidades sin registrar aparece como{' '}
                <span className="text-neutral-400">«Unmapped»</span> en lugar de ocultarse.
              </p>
              <p className="text-neutral-600">
                Fuentes: OMIE {bundle.meta.monthFile} · LISTADO DE UNIDADES OFERTANTES VIGENTES (tecnología por unidad).
              </p>
            </div>
          </>
        )}
      </main>

      <footer className="w-full max-w-6xl mt-12 border-t border-white/5 pt-6 text-neutral-600 text-xs font-mono" />
    </div>
  );
}

/* ============================================================ sub-components */
function Kpi({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className="glass-panel rounded-xl p-4 border border-white/10">
      <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-mono mb-1.5">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-2xl font-bold font-mono tracking-tight ${highlight ? 'text-emerald-300' : 'text-white'}`}
        >
          {value}
        </span>
        <span className="text-[11px] font-mono text-neutral-500">{unit}</span>
      </div>
    </div>
  );
}

function Axes({ geom }: { geom: Geom }) {
  const { yLo, yHi, xMin, xMax, xS, yS } = geom;
  const lines: React.ReactNode[] = [];

  // y grid + labels
  const span = yHi - yLo;
  const yStep = span > 600 ? 200 : span > 300 ? 100 : span > 150 ? 50 : 25;
  for (let p = Math.ceil(yLo / yStep) * yStep; p <= yHi; p += yStep) {
    const y = yS(p);
    lines.push(
      <line key={`gy${p}`} x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
    );
    lines.push(
      <text key={`ty${p}`} x={PAD.l - 8} y={y + 3.5} textAnchor="end" fontSize={10} fill="#737373" fontFamily="JetBrains Mono">
        {p}
      </text>
    );
  }

  // x labels (GWh) over the visible window — nice 1/2/5 step
  const xSpan = xMax - xMin || 1;
  const raw = xSpan / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const nn = raw / mag;
  const xStep = (nn >= 5 ? 5 : nn >= 2 ? 2 : 1) * mag;
  const dec = xStep < 1000 ? 2 : xStep < 10000 ? 1 : 0;
  for (let q = Math.ceil(xMin / xStep) * xStep; q <= xMax + 1e-6; q += xStep) {
    const x = xS(q);
    lines.push(
      <text key={`tx${q}`} x={x} y={H - PAD.b + 18} textAnchor="middle" fontSize={10} fill="#737373" fontFamily="JetBrains Mono">
        {NF(q / 1000, dec)}
      </text>
    );
  }

  // zero line
  if (yLo < 0) {
    const yz = yS(0);
    lines.push(<line key="zero" x1={PAD.l} y1={yz} x2={W - PAD.r} y2={yz} stroke="#6b655c" strokeWidth={1.1} />);
  }

  return (
    <g>
      {lines}
      <text x={PAD.l - 44} y={PAD.t + 2} fontSize={11} fontWeight={600} fill="#a3a3a3" fontFamily="JetBrains Mono">
        €/MWh
      </text>
      <text
        x={W - PAD.r}
        y={H - 8}
        textAnchor="end"
        fontSize={11}
        fontWeight={600}
        fill="#a3a3a3"
        fontFamily="JetBrains Mono"
      >
        Energía ofertada acumulada (GWh)
      </text>
    </g>
  );
}

function CurveOutline({ geom }: { geom: Geom }) {
  const { steps, xS, yS } = geom;
  let d = '';
  let px = xS(0);
  steps.forEach((st) => {
    const x1 = xS(st.cum1);
    const y = yS(st.price);
    d += `${d ? 'L' : 'M'}${px.toFixed(1)},${y.toFixed(1)} L${x1.toFixed(1)},${y.toFixed(1)} `;
    px = x1;
  });
  return <path d={d} fill="none" stroke="#e5e5e5" strokeWidth={1} opacity={0.45} />;
}

function Clearing({ geom, clearing }: { geom: Geom; clearing: number | null }) {
  if (clearing == null || geom.clearingX == null) return null;
  const { xS, yS, clearingX } = geom;
  const cx = xS(clearingX); // exactly where the supply curve crosses the clearing price
  const cy = yS(clearing);
  const labelLeft = cx < PAD.l + 90;
  return (
    <g>
      <line x1={cx} y1={PAD.t} x2={cx} y2={H - PAD.b} stroke="#10b981" strokeWidth={1.4} strokeDasharray="5 4" opacity={0.8} />
      <line x1={PAD.l} y1={cy} x2={W - PAD.r} y2={cy} stroke="#10b981" strokeWidth={1} strokeDasharray="2 4" opacity={0.5} />
      <circle cx={cx} cy={cy} r={5} fill="#10b981" stroke="#0a0a0a" strokeWidth={2} />
      <text
        x={labelLeft ? cx + 8 : cx - 8}
        y={PAD.t + 12}
        textAnchor={labelLeft ? 'start' : 'end'}
        fontSize={12}
        fontWeight={700}
        fill="#10b981"
        fontFamily="JetBrains Mono"
      >
        {NF(clearing, 1)} €/MWh
      </text>
    </g>
  );
}

function TechTable({
  byTech,
  techs,
}: {
  byTech: { t: number; mwh: number; vwap: number; min: number; max: number }[];
  techs: Tech[];
}) {
  const vmax = Math.max(...byTech.map((t) => t.vwap), 0);
  const vmin = Math.min(0, ...byTech.map((t) => t.vwap));
  const span = vmax - vmin || 1;
  return (
    <div className="flex flex-col">
      {byTech.map((row) => {
        const tech = techs[row.t];
        const zero = ((0 - vmin) / span) * 100;
        const w = ((row.vwap - vmin) / span) * 100;
        const left = Math.min(zero, w);
        const width = Math.abs(w - zero);
        return (
          <div
            key={row.t}
            className="grid grid-cols-[130px_1fr_92px] gap-3 items-center py-2 border-t border-white/5 first:border-t-0 font-mono text-xs"
          >
            <div className="flex items-center gap-2 font-semibold text-neutral-200">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: tech?.color }} />
              <span className="truncate">{tech?.label ?? 'Unmapped'}</span>
            </div>
            <div className="relative h-5 bg-white/5 rounded">
              <div className="absolute top-0 bottom-0 w-px bg-neutral-600" style={{ left: `${zero}%` }} />
              <div
                className="absolute top-0 bottom-0 rounded opacity-80"
                style={{ left: `${left}%`, width: `${width}%`, background: tech?.color }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 text-[10px] font-bold text-white px-1.5"
                style={{ left: `${Math.max(left + width, zero)}%` }}
              >
                {NF(row.vwap, 1)}
              </div>
            </div>
            <div className="text-right text-neutral-500 tabular-nums">{NF(row.mwh / 1000, 2)} GWh</div>
          </div>
        );
      })}
    </div>
  );
}
