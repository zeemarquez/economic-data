import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { BarChart3, ArrowLeft } from 'lucide-react';
import {
  Treemap,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { SpendingData, SpendingItem } from '../types';
import type { TreemapNode } from 'recharts';
import spendingDataRaw from '../data/spain/spending/gastos_2023_agrupados.json';

const TOP_POLICIES_COUNT = 18;
const OTHERS_LABEL = 'Otros';

/** Chart item: name = label (shown in treemap), value = amount, extra for tooltip. */
type ChartItem = {
  name: string;
  value: number;
  fullName?: string;
  category?: string;
  description?: string;
};

const GRAYSCALE_FILLS = [
  '#171717',
  '#404040',
  '#525252',
  '#737373',
  '#a3a3a3',
];

const formatWithThousands = (value: number) => {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${digits}`;
};

const formatMillions = (value: number) => {
  const millions = value / 1e6;
  return millions >= 1000
    ? `${(millions / 1000).toFixed(1)}k M€`
    : `${Math.round(millions)} M€`;
};

/** Approximate monospace char width in px (em relative to fontSize). */
const CHAR_WIDTH_EM = 0.62;

/** Format percentage for display (e.g. 42.3%). */
const formatPercent = (value: number) =>
  value >= 10 || value === 0
    ? `${Math.round(value)}%`
    : value >= 1
      ? `${value.toFixed(1)}%`
      : `${value.toFixed(1)}%`;

/** Custom treemap content: shows label (node.name) and percentage; font size scales with rectangle; text clipped to cell. */
function TreemapContent(props: { node: TreemapNode; colorPanel: string[]; total: number; hoveredIndex: number | null }) {
  const { node, colorPanel, total, hoveredIndex } = props;
  const { x, y, width, height, name, value, index } = node;
  const isDimmed = hoveredIndex !== null && hoveredIndex !== index;
  const fill = colorPanel[index % colorPanel.length] ?? '#525252';
  const minDim = Math.min(width, height);
  const showLabel = width > 44 && height > 22;
  // Font size strongly correlated to rectangle size: small cells = small text, large cells = large text (6–20px label)
  const labelFontSize = Math.max(6, Math.min(20, Math.round(minDim / 7)));
  const valueFontSize = Math.max(5, Math.min(12, Math.round(minDim / 10)));
  // Conservative truncation: available width minus padding (8 each side), then chars that fit
  const padding = 16;
  const availableWidth = Math.max(0, width - padding);
  const maxChars = Math.max(
    4,
    Math.min(32, Math.floor(availableWidth / (labelFontSize * CHAR_WIDTH_EM)))
  );
  const labelStr = name ? String(name) : '';
  const shortLabel =
    showLabel && labelStr.length > maxChars
      ? `${labelStr.slice(0, maxChars - 1)}…`
      : labelStr;
  const pct = total > 0 && value != null ? (value / total) * 100 : 0;
  const percentLabel = formatPercent(pct);

  const clipId = `treemap-clip-${index}-${x}-${y}`.replace(/\./g, '-');

  return (
    <g style={{ opacity: isDimmed ? 0.1 : 1 }}>
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={width} height={height} />
        </clipPath>
      </defs>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={1}
      />
      {showLabel && (
        <g clipPath={`url(#${clipId})`}>
          <text
            x={x + 8}
            y={y + height / 2 - valueFontSize / 2}
            fill="#fff"
            fontSize={labelFontSize}
            fontFamily="JetBrains Mono, monospace"
            fontWeight={500}
            className="pointer-events-none"
          >
            {shortLabel}
          </text>
          <text
            x={x + 8}
            y={y + height / 2 + labelFontSize / 2 + 2}
            fill="rgba(255,255,255,0.85)"
            fontSize={valueFontSize}
            fontFamily="JetBrains Mono, monospace"
            className="pointer-events-none"
          >
            {percentLabel}
          </text>
        </g>
      )}
    </g>
  );
}

/** Tooltip: percentage, amount (k M€), name, category, description on hover. */
function SpendingTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartItem } | ChartItem>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const raw = payload[0];
  const item: ChartItem = raw && 'payload' in raw && raw.payload != null ? raw.payload : (raw as ChartItem);
  if (!item || item.value == null) return null;
  const hasExtra = item.fullName != null || item.category != null || (item.description != null && item.description !== '');
  const pct = total > 0 ? (item.value / total) * 100 : 0;
  const percentStr = pct >= 10 || pct === 0 ? `${Math.round(pct)}%` : pct >= 1 ? `${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;

  return (
    <div
      className="rounded-lg border border-white/15 px-3 py-2.5 font-mono text-xs shadow-xl"
      style={{ maxWidth: 320, backgroundColor: 'rgb(10,10,10)' }}
    >
      <div className="mb-1.5 border-b border-white/10 pb-1.5 text-white font-medium">
        {percentStr} · {formatMillions(item.value)}
      </div>
      {hasExtra && (
        <div className="space-y-1 text-neutral-300">
          {item.fullName != null && item.fullName !== '' && (
            <div><span className="text-neutral-500">Nombre: </span>{item.fullName}</div>
          )}
          {item.category != null && item.category !== '' && (
            <div><span className="text-neutral-500">Categoría: </span>{item.category}</div>
          )}
          {item.description != null && item.description !== '' && (
            <div className="pt-0.5 text-neutral-400">{item.description}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GastoEspana() {
  const data = spendingDataRaw as SpendingData;
  const { total_spending: totalBudget, spending_items: items } = data;
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  const chartData = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.amount - a.amount);
    const top = sorted.slice(0, TOP_POLICIES_COUNT).map(
      (item): ChartItem => ({
        name: item.label,
        value: item.amount,
        fullName: item.name,
        category: item.category,
        description: item.description,
      })
    );
    const rest = sorted.slice(TOP_POLICIES_COUNT);
    const othersSum = rest.reduce((acc, p) => acc + p.amount, 0);
    const result: ChartItem[] = [...top];
    if (othersSum > 0) {
      result.push({
        name: OTHERS_LABEL,
        value: othersSum,
        fullName: 'Otras políticas',
        category: '',
        description: 'Resto de partidas de gasto.',
      });
    }
    return result;
  }, [items]);

  /** Group by category for sidebar and bottom list. */
  const byCategory = useMemo(() => {
    const map = new Map<string, { total: number; items: SpendingItem[] }>();
    for (const item of items) {
      const existing = map.get(item.category);
      if (existing) {
        existing.total += item.amount;
        existing.items.push(item);
      } else {
        map.set(item.category, { total: item.amount, items: [item] });
      }
    }
    return Array.from(map.entries())
      .map(([category, { total, items: catItems }]) => ({ category, total, items: catItems }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

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
            GASTO<span className="text-neutral-500">ESPAÑA</span>
          </h1>
        </div>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12">
          <Card
            className="flex flex-col min-h-[420px]"
            title="Desglose del presupuesto del Estado (2023)"
            icon={<BarChart3 className="text-white" size={18} />}
          >
            <div className="mb-4 border-b border-white/5 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-neutral-500 font-mono text-[10px] uppercase tracking-widest">
                Total presupuesto
              </span>
              <span className="text-2xl font-mono font-bold text-white tracking-tight">
                {formatWithThousands(totalBudget)} €
              </span>
            </div>
            <div
              className="w-full h-[360px]"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <ResponsiveContainer width="100%" height={360}>
                <Treemap
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  type="flat"
                  colorPanel={GRAYSCALE_FILLS}
                  onMouseEnter={(node: TreemapNode) => setHoveredIndex(node.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  content={(nodeProps: TreemapNode) => (
                    <TreemapContent
                      node={nodeProps}
                      colorPanel={GRAYSCALE_FILLS}
                      total={totalBudget}
                      hoveredIndex={hoveredIndex}
                    />
                  )}
                >
                  <Tooltip content={<SpendingTooltip total={totalBudget} />} />
                </Treemap>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card
            className="flex flex-col"
            title="Desglose por políticas"
            icon={<BarChart3 size={18} />}
          >
            <div className="overflow-x-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {byCategory.map(({ category, items: catItems }, catIndex) => (
                  <div
                    key={category}
                    className="border border-white/5 rounded-lg overflow-hidden"
                  >
                    <div
                      className="px-3 py-2 border-b border-white/5 text-neutral-400 font-mono text-[10px] uppercase tracking-widest"
                      style={{
                        borderLeftWidth: 3,
                        borderLeftColor:
                          GRAYSCALE_FILLS[catIndex % GRAYSCALE_FILLS.length],
                      }}
                    >
                      {category}
                    </div>
                    <ul className="divide-y divide-white/5">
                      {catItems.map((item) => (
                        <li
                          key={item.name}
                          className="flex justify-between gap-2 px-3 py-2 text-xs"
                          title={item.description || item.name}
                        >
                          <span className="text-neutral-400 font-mono truncate min-w-0">
                            {item.label}
                          </span>
                          <span className="text-white font-mono tabular-nums shrink-0">
                            {formatMillions(item.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card
            className="border-white/20 shadow-[0_0_30px_-10px_rgba(255,255,255,0.05)] flex flex-col h-full"
            title="Por categoría"
            icon={<BarChart3 size={18} />}
          >
            <div className="divide-y divide-white/5 border border-white/5 rounded-lg overflow-hidden">
              {byCategory.map(({ category, total }, index) => {
                const pct = totalBudget > 0 ? (total / totalBudget) * 100 : 0;
                return (
                  <div
                    key={category}
                    className="flex flex-col justify-center gap-1 px-4 py-3 bg-neutral-900/40 min-h-[72px]"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className="text-neutral-300 font-mono text-xs flex-1 min-w-0 truncate"
                        title={category}
                      >
                        {category}
                      </span>
                      <span className="text-white font-mono text-sm tabular-nums shrink-0">
                        {formatMillions(total)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 rounded-full bg-white/5 flex-1 min-w-0 overflow-hidden"
                        role="presentation"
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              GRAYSCALE_FILLS[index % GRAYSCALE_FILLS.length],
                          }}
                        />
                      </div>
                      <span className="text-neutral-500 font-mono text-[10px] tabular-nums w-10 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </main>

      <footer className="w-full max-w-6xl mt-12 border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center text-neutral-600 text-xs font-mono" />
    </div>
  );
}
