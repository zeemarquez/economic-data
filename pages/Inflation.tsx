import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LineChart as LineChartIcon } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../components/ui/Card';
import inflationBundle from '../data/inflation_annual.json';

const INDEX_BASE_YEAR = 1963;

type RawRecord = {
  year: number;
  cpi: number | null;
  medianHouseNominalUsd: number | null;
  medianHouseReal2024Usd: number | null;
  medianIncomeNominalUsd: number | null;
  sp500: number | null;
  goldUsdPerOz: number | null;
};

type UnitMode = 'dollar' | 'gold';
type ScaleMode = 'index' | 'absolute';
type YAxisScale = 'linear' | 'log';

/** Dark, hue-separated strokes (easier to trace than near-neutral grays). */
const LINE_COLORS = {
  house: '#6b8fd4',
  income: '#3d9f8c',
  sp500: '#9ca3af',
  gold: '#b87a5a',
} as const;

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(2)}k`;
  if (a >= 100) return n.toFixed(0);
  if (a >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function ToggleGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono">{label}</span>
      <div
        className="inline-flex rounded-lg border border-white/10 bg-black/40 p-0.5 font-mono text-xs"
        role="group"
        aria-label={label}
      >
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`px-3 py-1.5 rounded-md transition-colors shrink-0 ${
              value === o.id
                ? 'bg-white/10 text-white border border-white/15'
                : 'text-neutral-400 hover:text-white border border-transparent'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Inflation() {
  const records = inflationBundle.records as RawRecord[];
  const meta = inflationBundle.meta;

  const [unitMode, setUnitMode] = useState<UnitMode>('dollar');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('index');
  const [yAxisScale, setYAxisScale] = useState<YAxisScale>('linear');

  const anchor = useMemo(
    () => records.find((r) => r.year === INDEX_BASE_YEAR) ?? null,
    [records]
  );

  const cpiRef2024 = useMemo(() => records.find((r) => r.year === 2024)?.cpi ?? null, [records]);

  const chartRows = useMemo(() => {
    const a = anchor;
    const g0 = a?.goldUsdPerOz;
    const h0 = a?.medianHouseNominalUsd;
    const i0 = a?.medianIncomeNominalUsd;
    const s0 = a?.sp500;
    const goldIndex0 = g0 != null && g0 > 0 ? g0 : null;
    const houseGold0 = g0 != null && h0 != null && g0 > 0 ? h0 / g0 : null;
    const incomeGold0 = g0 != null && i0 != null && g0 > 0 ? i0 / g0 : null;
    const spGold0 = g0 != null && s0 != null && g0 > 0 ? s0 / g0 : null;

    return records
      .filter((r) => r.year >= 1960 && r.year <= new Date().getFullYear())
      .map((r) => {
        const g = r.goldUsdPerOz;
        let house: number | null = null;
        let income: number | null = null;
        let sp: number | null = null;
        let gold: number | null = null;

        if (unitMode === 'dollar') {
          if (scaleMode === 'absolute') {
            house = r.medianHouseReal2024Usd;
            income =
              r.medianIncomeNominalUsd != null &&
              r.cpi != null &&
              cpiRef2024 != null &&
              r.cpi > 0
                ? r.medianIncomeNominalUsd * (cpiRef2024 / r.cpi)
                : null;
            sp = r.sp500;
            gold = r.goldUsdPerOz;
          } else {
            if (a?.medianHouseNominalUsd != null)
              house = r.medianHouseNominalUsd != null ? r.medianHouseNominalUsd / a.medianHouseNominalUsd : null;
            if (a?.medianIncomeNominalUsd != null)
              income =
                r.medianIncomeNominalUsd != null ? r.medianIncomeNominalUsd / a.medianIncomeNominalUsd : null;
            if (a?.sp500 != null) sp = r.sp500 != null ? r.sp500 / a.sp500 : null;
            if (goldIndex0) gold = r.goldUsdPerOz != null ? r.goldUsdPerOz / goldIndex0 : null;
          }
        } else if (g != null && g > 0) {
          if (scaleMode === 'absolute') {
            house = r.medianHouseNominalUsd != null ? r.medianHouseNominalUsd / g : null;
            income = r.medianIncomeNominalUsd != null ? r.medianIncomeNominalUsd / g : null;
            sp = r.sp500 != null ? r.sp500 / g : null;
            gold = 1;
          } else if (houseGold0 && incomeGold0 && spGold0) {
            house = r.medianHouseNominalUsd != null ? r.medianHouseNominalUsd / g / houseGold0 : null;
            income = r.medianIncomeNominalUsd != null ? r.medianIncomeNominalUsd / g / incomeGold0 : null;
            sp = r.sp500 != null ? r.sp500 / g / spGold0 : null;
            gold = 1;
          }
        }

        return { year: r.year, house, income, sp500: sp, gold };
      });
  }, [records, unitMode, scaleMode, anchor, cpiRef2024]);

  const chartNumericMin = useMemo(() => {
    let m = Infinity;
    for (const row of chartRows) {
      for (const v of [row.house, row.income, row.sp500, row.gold]) {
        if (v != null && v > 0 && Number.isFinite(v)) m = Math.min(m, v);
      }
    }
    return m === Infinity ? null : m;
  }, [chartRows]);

  /** Log axis needs strictly positive domain; stay below smallest plotted value. */
  const logDomainMin =
    chartNumericMin != null && chartNumericMin > 0
      ? Math.max(1e-6, chartNumericMin * 0.35)
      : 0.1;

  const yAxisIsLog = yAxisScale === 'log';

  const leftAxisBase =
    unitMode === 'dollar'
      ? scaleMode === 'index'
        ? 'Índice (1963 = 1)'
        : 'USD 2024 (vivienda e ingresos) / nominal (S&P y oro)'
      : scaleMode === 'index'
        ? 'Índice en oro (1963 = 1)'
        : 'Oz oro o cociente';

  const leftAxisLabel = `${leftAxisBase}${yAxisIsLog ? ' — log' : ''}`;

  const tooltipFormatter = (value: number | string, name: string) => {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    if (Number.isNaN(n)) return [String(value), name];
    if (scaleMode === 'index') return [n.toFixed(2), name];
    if (unitMode === 'gold') {
      if (name === 'S&P 500 ÷ gold') return [formatCompact(n), name];
      if (name === 'Gold') return ['1 oz', name];
      return [`${formatCompact(n)} oz`, name];
    }
    if (name === 'Gold') return [`$${formatCompact(n)}/oz`, name];
    if (name === 'S&P 500') return [formatCompact(n), name];
    return [`$${formatCompact(n)}`, name];
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-6xl mb-12 flex justify-between items-end border-b border-white/5 pb-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-neutral-500 hover:text-white transition-colors p-1 -ml-1"
            aria-label="Volver al inicio"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-2 font-mono">
            INFLATION<span className="text-neutral-500">USA</span>
          </h1>
        </div>
      </header>

      <main className="w-full max-w-6xl flex flex-col gap-6">
        <Card
          className="flex flex-col min-h-[480px]"
          title="Activos e ingresos: dólares vs oro (1960–hoy)"
          icon={<LineChartIcon className="text-white" size={18} />}
        >
          <p className="text-neutral-400 font-mono text-xs leading-relaxed mb-4 max-w-3xl">
            Vivienda: precio mediano de venta (nominal; media trimestral FRED). Ingresos: mediana familiar nominal
            (Census / FRED). S&P 500: cierre de diciembre (Robert Shiller / dataset público). Oro: media anual USD/oz
            (precios mensuales públicos). En <span className="text-neutral-300">niveles absolutos en dólares</span>,
            vivienda e ingresos se muestran en <span className="text-neutral-300">dólares constantes 2024</span> (IPC
            anual); el S&P 500 y el oro permanecen en términos nominales para lectura de mercado. El índice relativo
            ancla <span className="text-neutral-300">{INDEX_BASE_YEAR}</span> en 1 (nominal) para las cuatro series.
          </p>

          <div className="mb-6 flex flex-col lg:flex-row lg:items-end gap-6 border-b border-white/5 pb-6">
            <ToggleGroup<UnitMode>
              label="Unidad"
              value={unitMode}
              onChange={setUnitMode}
              options={[
                { id: 'dollar', label: 'Dólares' },
                { id: 'gold', label: 'Onzas de oro' },
              ]}
            />
            <ToggleGroup<ScaleMode>
              label="Escala"
              value={scaleMode}
              onChange={setScaleMode}
              options={[
                { id: 'index', label: 'Índice' },
                { id: 'absolute', label: 'Niveles absolutos' },
              ]}
            />
            <ToggleGroup<YAxisScale>
              label="Eje Y"
              value={yAxisScale}
              onChange={setYAxisScale}
              options={[
                { id: 'linear', label: 'Lineal' },
                { id: 'log', label: 'Log' },
              ]}
            />
            <div className="flex-1 text-[10px] text-neutral-500 font-mono leading-snug lg:text-right lg:max-w-md">
              {unitMode === 'gold' && (
                <span>
                  En modo oro, el S&P 500 se muestra como índice dividido por USD/oz (misma convención que “índice
                  expresado en oro”). La serie “Gold” es la unidad de cuenta (1 oz).
                </span>
              )}
              {unitMode === 'dollar' && scaleMode === 'absolute' && (
                <span>
                  Con <span className="text-neutral-400">Log</span> en el eje Y se comparan mejor magnitudes muy
                  distintas (vivienda, ingresos, S&P, oro). Con <span className="text-neutral-400">Lineal</span> las
                  diferencias de nivel se leen a escala aritmética.
                </span>
              )}
            </div>
          </div>

          <div className="w-full h-[380px]">
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={chartRows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="year"
                  stroke="#737373"
                  tick={{ fill: '#737373', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis
                  stroke="#737373"
                  scale={yAxisIsLog ? 'log' : 'auto'}
                  domain={yAxisIsLog ? [logDomainMin, 'auto'] : ['auto', 'auto']}
                  tick={{ fill: '#737373', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  tickFormatter={(v) => formatCompact(Number(v))}
                  width={56}
                  label={{
                    value: leftAxisLabel,
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#737373',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono',
                    offset: 8,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10,10,10,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontFamily: 'JetBrains Mono',
                    fontSize: 12,
                  }}
                  formatter={tooltipFormatter}
                  labelFormatter={(y) => `Año ${y}`}
                />
                <Legend
                  wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#a3a3a3' }}
                />
                <Line
                  type="monotone"
                  dataKey="house"
                  name="Vivienda (mediana venta)"
                  stroke={LINE_COLORS.house}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  name="Ingreso familiar mediano"
                  stroke={LINE_COLORS.income}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="sp500"
                  name={unitMode === 'gold' ? 'S&P 500' : 'S&P 500'}
                  stroke={LINE_COLORS.sp500}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="gold"
                  name="Gold"
                  stroke={LINE_COLORS.gold}
                  dot={false}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 space-y-1.5 text-[10px] text-neutral-500 font-mono leading-relaxed">
            <div className="uppercase tracking-wider text-neutral-600">Fuentes</div>
            {meta.sources.map((s, i) => (
              <div key={i}>{s}</div>
            ))}
          </div>
        </Card>
      </main>

      <footer className="w-full max-w-6xl mt-12 border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center text-neutral-600 text-xs font-mono" />
    </div>
  );
}
