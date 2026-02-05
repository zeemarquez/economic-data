import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface IncomeItem {
  name: string;
  amount: number;
  category: string;
  label: string;
  description?: string;
}

export interface SpendingItemForSankey {
  label: string;
  amount: number;
  name?: string;
  description?: string;
}

interface Props {
  incomeItems: IncomeItem[];
  totalIncome: number;
  spendingItems: SpendingItemForSankey[];
  totalSpending: number;
}

const GRAYSCALE = [
  '#171717',
  '#404040',
  '#525252',
  '#737373',
  '#a3a3a3',
  '#d4d4d4',
];
const DEFICIT_COLOR = '#7f1d1d'; // red-900 - destaca el déficit
const TOP_ITEMS = 10;
const OTHERS_LABEL = 'Otros';

const formatMillions = (value: number) => {
  const millions = value / 1e6;
  return millions >= 1000
    ? `${(millions / 1000).toFixed(1)}k M€`
    : `${Math.round(millions)} M€`;
};

const formatPercent = (value: number) =>
  value >= 10 || value === 0
    ? `${Math.round(value)}%`
    : value >= 1
      ? `${value.toFixed(1)}%`
      : `${value.toFixed(1)}%`;

export const BudgetFlowSankey: React.FC<Props> = ({
  incomeItems,
  totalIncome,
  spendingItems,
  totalSpending,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 560 });
  const [activeElement, setActiveElement] = useState<Set<string> | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    value: number;
    percent: number;
    description?: string;
    fullName?: string;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = w < 600 ? 480 : 560;
        setDimensions({ width: w, height: h });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const { width, height } = dimensions;
  const isMobile = width < 600;
  const gapIncome = 14;
  const gapSpending = 14;

  const deficit = Math.max(0, totalSpending - totalIncome);

  /** Top 10 income + Otros only (no Déficit - that flows to Gastos, not Ingresos). */
  const effectiveIncomeItems = useMemo(() => {
    const sorted = [...incomeItems].sort((a, b) => b.amount - a.amount);
    const top = sorted.slice(0, TOP_ITEMS);
    const rest = sorted.slice(TOP_ITEMS);
    const othersSum = rest.reduce((acc, r) => acc + r.amount, 0);
    const result = top.map((item) => ({
      ...item,
      label: item.label,
      amount: item.amount,
    }));
    if (othersSum > 0) {
      result.push({
        name: OTHERS_LABEL,
        amount: othersSum,
        category: OTHERS_LABEL,
        label: OTHERS_LABEL,
      });
    }
    return result;
  }, [incomeItems]);

  /** Top 10 spending + Otros, sorted largest to smallest. */
  const effectiveSpendingItems = useMemo(() => {
    const sorted = [...spendingItems].sort((a, b) => b.amount - a.amount);
    const top = sorted.slice(0, TOP_ITEMS);
    const rest = sorted.slice(TOP_ITEMS);
    const othersSum = rest.reduce((acc, r) => acc + r.amount, 0);
    const result = top.map(({ label, amount, name, description }) => ({
      label,
      amount,
      name,
      description,
    }));
    if (othersSum > 0) {
      result.push({
        label: OTHERS_LABEL,
        amount: othersSum,
        name: 'Otras políticas',
        description: 'Resto de partidas de gasto.',
      });
    }
    return result;
  }, [spendingItems]);

  // When deficit > 0, no scaling; when deficit = 0, scale spending to match income
  const scale =
    totalSpending > 0 && totalSpending <= totalIncome
      ? totalIncome / totalSpending
      : 1;
  const scaledSpending = useMemo(
    () =>
      effectiveSpendingItems.map((s) => ({
        ...s,
        scaledAmount: s.amount * scale,
      })),
    [effectiveSpendingItems, scale]
  );

  const paddingX = isMobile ? 90 : 110;
  const paddingY = 35;
  const nodeWidth = 12;
  const numColumns = 4; // Income sources | Ingresos | Gastos | Spending
  const colGap = Math.max(
    12,
    (width - paddingX * 2 - nodeWidth * numColumns) / (numColumns - 1)
  );

  const leftColumnCount = effectiveIncomeItems.length;
  const maxVal = totalSpending || 1;
  const availableHeight = height - paddingY * 2 - 40;
  const maxGaps = Math.max(
    (leftColumnCount - 1) * gapIncome,
    (effectiveSpendingItems.length - 1) * gapSpending,
    0
  );
  const pxPerUnit = Math.max(0, (availableHeight - maxGaps) / maxVal);
  const MIN_NODE_HEIGHT = 16; // minimum bar height so smallest items' labels don't overlap
  const getH = (val: number) => Math.max(val * pxPerUnit, MIN_NODE_HEIGHT);

  // Column 1: Income nodes (→ Ingresos) + Déficit node (→ Gastos only, when deficit > 0)
  let accY = paddingY;
  const incomeNodes = effectiveIncomeItems.map((item, i) => {
    const h = getH(item.amount);
    const node = {
      id: `inc-${i}`,
      x: paddingX,
      y: accY,
      h,
      value: item.amount,
      label: item.label,
      name: item.name,
      description: item.description,
      color: GRAYSCALE[i % GRAYSCALE.length],
    };
    accY += h + gapIncome;
    return node;
  });

  // Column 2: "Ingresos" - height must match sum of incoming income flow heights exactly
  const ingresosFlowHeight = incomeNodes.reduce((acc, n) => acc + getH(n.value), 0);
  const col2X = paddingX + nodeWidth + colGap;
  const ingresosY = paddingY + (availableHeight + 40 - ingresosFlowHeight) / 2;
  const nodeIngresos = {
    id: 'ingresos',
    x: col2X,
    y: ingresosY,
    h: ingresosFlowHeight,
    value: totalIncome,
    label: 'Ingresos',
    name: 'Ingresos',
    description: 'Total de ingresos del Estado.',
    color: '#525252',
  };

  // Column 2: "Déficit" - same horizontal level as Ingresos (below it), flows to Gastos
  const col2Gap = 20; // space between Ingresos and Déficit in column 2
  let deficitNode: { id: string; x: number; y: number; h: number; value: number; label: string; color: string } | null = null;
  if (deficit > 0) {
    const h = getH(deficit);
    deficitNode = {
      id: 'deficit',
      x: col2X,
      y: ingresosY + ingresosFlowHeight + col2Gap,
      h,
      value: deficit,
      label: 'Déficit',
      name: 'Déficit',
      description: 'Descuadre entre ingresos y gastos (financiado con deuda).',
      color: DEFICIT_COLOR,
    };
  }

  // Column 3: "Gastos" - height must match sum of incoming flow heights (Ingresos + Déficit)
  const gastosInflowHeight =
    ingresosFlowHeight + (deficit > 0 ? getH(deficit) : 0);
  const gastosY = paddingY + (availableHeight + 40 - gastosInflowHeight) / 2;
  const nodeGastos = {
    id: 'gastos',
    x: paddingX + nodeWidth * 2 + colGap * 2,
    y: gastosY,
    h: gastosInflowHeight,
    value: totalSpending,
    label: 'Gastos',
    name: 'Gastos',
    description: 'Total de gastos del Estado.',
    color: '#525252',
  };

  // Column 4: Spending nodes
  accY = paddingY;
  const spendingNodes = scaledSpending.map((item, i) => {
    const h = getH(item.scaledAmount);
    const node = {
      id: `gasto-${i}`,
      x: paddingX + nodeWidth * 3 + colGap * 3,
      y: accY,
      h,
      value: item.amount,
      scaledValue: item.scaledAmount,
      label: item.label,
      name: item.name,
      description: item.description,
      color: GRAYSCALE[i % GRAYSCALE.length],
    };
    accY += h + gapSpending;
    return node;
  });

  const drawLink = (
    start: { x: number; y: number; h: number },
    end: { x: number; y: number; h: number },
    startOffset: number,
    endOffset: number,
    valueHeight: number
  ) => {
    const x0 = start.x + nodeWidth;
    const y0 = start.y + startOffset + valueHeight / 2;
    const x1 = end.x;
    const y1 = end.y + endOffset + valueHeight / 2;
    const dist = x1 - x0;
    const c1 = x0 + dist * 0.5;
    const c2 = x1 - dist * 0.5;
    return `M ${x0} ${y0 - valueHeight / 2}
      C ${c1} ${y0 - valueHeight / 2}, ${c2} ${y1 - valueHeight / 2}, ${x1} ${y1 - valueHeight / 2}
      L ${x1} ${y1 + valueHeight / 2}
      C ${c2} ${y1 + valueHeight / 2}, ${c1} ${y0 + valueHeight / 2}, ${x0} ${y0 + valueHeight / 2}
      Z`;
  };

  // Links: income -> Ingresos (each income connects to its band on Ingresos left edge)
  let incCumulative = 0;
  const linksIncomeToIngresos = incomeNodes.map((node, i) => {
    const ingresosBandOffset = incCumulative;
    const link = {
      id: `link-inc-${i}`,
      d: drawLink(
        node,
        nodeIngresos,
        0,
        ingresosBandOffset,
        getH(node.value)
      ),
      sourceId: node.id,
      targetId: nodeIngresos.id,
    };
    incCumulative += getH(node.value);
    return link;
  });

  // Links: Ingresos -> Gastos (carries totalIncome into Gastos)
  const linkIngresosToGastos = {
    id: 'link-ingresos-gastos',
    d: drawLink(nodeIngresos, nodeGastos, 0, 0, ingresosFlowHeight),
    sourceId: nodeIngresos.id,
    targetId: nodeGastos.id,
  };

  // Links: Déficit -> Gastos (carries deficit directly into Gastos, bypassing Ingresos)
  let linkDeficitToGastos: { id: string; d: string; sourceId: string; targetId: string } | null = null;
  if (deficitNode && deficit > 0) {
    // Déficit connects to the lower part of Gastos (below the Ingresos flow)
    const gastosDeficitOffset = ingresosFlowHeight; // Ingresos flow occupies top of Gastos
    linkDeficitToGastos = {
      id: 'link-deficit-gastos',
      d: drawLink(
        deficitNode,
        nodeGastos,
        0,
        gastosDeficitOffset,
        getH(deficit)
      ),
      sourceId: deficitNode.id,
      targetId: nodeGastos.id,
    };
  }

  // Links: Gastos -> spending (each spending receives from its band on Gastos right edge)
  let gastoCumulative = 0;
  const linksGastosToSpending = spendingNodes.map((node, i) => {
    const gastosBandOffset = gastoCumulative;
    const link = {
      id: `link-gasto-${i}`,
      d: drawLink(
        nodeGastos,
        node,
        gastosBandOffset,
        0,
        getH(node.scaledValue)
      ),
      sourceId: nodeGastos.id,
      targetId: node.id,
    };
    gastoCumulative += getH(node.scaledValue);
    return link;
  });

  const links = [
    ...linksIncomeToIngresos,
    linkIngresosToGastos,
    ...(linkDeficitToGastos ? [linkDeficitToGastos] : []),
    ...linksGastosToSpending,
  ];
  const middleNodes = [
    nodeIngresos,
    nodeGastos,
    ...(deficitNode ? [deficitNode] : []),
  ];

  const nodeFlowIds: Record<string, string[]> = {};
  nodeFlowIds[nodeIngresos.id] = [
    ...linksIncomeToIngresos.map((l) => l.id),
    linkIngresosToGastos.id,
  ];
  nodeFlowIds[nodeGastos.id] = [
    linkIngresosToGastos.id,
    ...(linkDeficitToGastos ? [linkDeficitToGastos.id] : []),
    ...linksGastosToSpending.map((l) => l.id),
  ];
  incomeNodes.forEach((n, i) => {
    nodeFlowIds[n.id] = [`link-inc-${i}`];
  });
  if (deficitNode) {
    nodeFlowIds[deficitNode.id] = [linkDeficitToGastos!.id];
  }
  spendingNodes.forEach((n, i) => {
    nodeFlowIds[n.id] = [`link-gasto-${i}`];
  });

  const dimmedOpacity = 0.2;
  const isLinkActive = (id: string) =>
    activeElement === null || activeElement.has(id);
  const isNodeActive = (id: string) =>
    activeElement === null ||
    (nodeFlowIds[id] && nodeFlowIds[id].some((lid) => activeElement.has(lid)));

  const handleFlowActivate = (flowIds: Set<string>) => {
    setActiveElement((prev) => {
      if (prev === null) return flowIds;
      const same =
        prev.size === flowIds.size && [...prev].every((id) => flowIds.has(id));
      return same ? null : flowIds;
    });
  };

  const showNodeTooltip = (
    e: React.MouseEvent,
    node: { id: string; label: string; value: number } & Partial<{
      name: string;
      description: string;
      category: string;
    }>,
    total: number
  ) => {
    const percent = total > 0 ? (node.value / total) * 100 : 0;
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      label: node.label,
      value: node.value,
      percent,
      description: node.description,
      fullName: node.name,
    });
  };

  /** Show tooltip for a link (flow) - same content as the bar/flow it represents. */
  const showLinkTooltip = (e: React.MouseEvent<SVGPathElement>, linkId: string) => {
    if (linkId.startsWith('link-inc-')) {
      const i = parseInt(linkId.replace('link-inc-', ''), 10);
      const node = incomeNodes[i];
      if (node) showNodeTooltip(e, node, totalIncome);
    } else if (linkId === 'link-ingresos-gastos') {
      showNodeTooltip(e, nodeIngresos, totalIncome);
    } else if (linkId === 'link-deficit-gastos' && deficitNode) {
      showNodeTooltip(e, deficitNode, totalSpending);
    } else if (linkId.startsWith('link-gasto-')) {
      const i = parseInt(linkId.replace('link-gasto-', ''), 10);
      const node = spendingNodes[i];
      if (node) showNodeTooltip(e, node, totalSpending);
    }
  };

  const SankeyTooltip = () => {
    if (!tooltip) return null;
    const percentStr =
      tooltip.percent >= 10 || tooltip.percent === 0
        ? `${Math.round(tooltip.percent)}%`
        : tooltip.percent >= 1
          ? `${tooltip.percent.toFixed(1)}%`
          : `${tooltip.percent.toFixed(1)}%`;
    const offset = 12;
    const tooltipWidth = 280;
    const tooltipHeight = 100;
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const left =
      tooltip.x + offset + tooltipWidth > winW
        ? tooltip.x - offset - tooltipWidth
        : tooltip.x + offset;
    const top =
      tooltip.y + offset + tooltipHeight > winH
        ? tooltip.y - offset - tooltipHeight
        : tooltip.y + offset;
    return (
      <div
        className="fixed z-[9999] rounded-lg border border-white/15 px-3 py-2.5 font-mono text-xs shadow-xl pointer-events-none"
        style={{
          left: Math.max(8, Math.min(left, winW - tooltipWidth - 8)),
          top: Math.max(8, Math.min(top, winH - tooltipHeight - 8)),
          maxWidth: 320,
          width: 'max-content',
          backgroundColor: 'rgb(10,10,10)',
        }}
      >
        <div className="mb-1.5 border-b border-white/10 pb-1.5 text-white font-medium">
          {percentStr} · {formatMillions(tooltip.value)}
        </div>
        {(tooltip.fullName || tooltip.description) && (
          <div className="space-y-1 text-neutral-300">
            {tooltip.fullName && (
              <div>
                <span className="text-neutral-500">Nombre: </span>
                {tooltip.fullName}
              </div>
            )}
            {tooltip.description && (
              <div className="pt-0.5 text-neutral-400">{tooltip.description}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (totalSpending <= 0)
    return (
      <div className="h-[400px] flex items-center justify-center text-neutral-500 font-mono text-xs">
        No hay datos para mostrar
      </div>
    );

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[480px] select-none flex items-center justify-center relative"
      onMouseMove={(e) => {
        if (tooltip) setTooltip((t) => t && { ...t, x: e.clientX, y: e.clientY });
      }}
      onMouseLeave={() => setTooltip(null)}
    >
      {tooltip &&
        createPortal(<SankeyTooltip />, document.body)}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block drop-shadow-2xl"
      >
        <defs>
          <linearGradient id="budgetGradientLink" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0.05" />
            <stop offset="100%" stopColor="white" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="deficitGradientLink" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7f1d1d" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          onClick={() => setActiveElement(null)}
          style={{ pointerEvents: 'all' }}
          aria-hidden
        />

        {links.map((link) => (
          <path
            key={link.id}
            d={link.d}
            fill={link.id === 'link-deficit-gastos' ? 'url(#deficitGradientLink)' : 'url(#budgetGradientLink)'}
            stroke="white"
            strokeWidth={activeElement?.has(link.id) ? 1 : 0}
            strokeOpacity={0.3}
            opacity={isLinkActive(link.id) ? 1 : dimmedOpacity}
            onMouseEnter={(e) => {
              setActiveElement(new Set([link.id]));
              showLinkTooltip(e, link.id);
            }}
            onMouseLeave={() => {
              setActiveElement(null);
              setTooltip(null);
            }}
            onMouseMove={(e) => {
              if (tooltip) setTooltip((t) => t && { ...t, x: e.clientX, y: e.clientY });
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleFlowActivate(new Set([link.id]));
            }}
            className="transition-all duration-300 ease-out cursor-pointer"
            style={{ pointerEvents: 'all' }}
          />
        ))}

        {[...middleNodes, ...incomeNodes, ...spendingNodes].map((node) => (
          <g
            key={node.id}
            opacity={isNodeActive(node.id) ? 1 : dimmedOpacity}
            onMouseEnter={(e) => {
              setActiveElement(new Set(nodeFlowIds[node.id] || []));
              const n = node as typeof node & {
                name?: string;
                description?: string;
                category?: string;
              };
              const total =
                node.id === 'ingresos' || node.id.startsWith('inc-')
                  ? totalIncome
                  : totalSpending;
              showNodeTooltip(e, n, total);
            }}
            onMouseLeave={() => {
              setActiveElement(null);
              setTooltip(null);
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleFlowActivate(new Set(nodeFlowIds[node.id] || []));
            }}
            className="transition-all duration-300 ease-out cursor-pointer"
            style={{ pointerEvents: 'all' }}
          >
            <rect
              x={node.x}
              y={node.y}
              width={nodeWidth}
              height={node.h}
              fill={node.color}
              rx={2}
            />
            {node.id === 'ingresos' || node.id === 'gastos' || node.id === 'deficit' ? (
              <g>
                <text
                  x={node.x + nodeWidth / 2}
                  y={node.y - 8}
                  textAnchor="middle"
                  className="fill-neutral-500 font-mono uppercase tracking-wider"
                  fontSize={isMobile ? 9 : 10}
                >
                  {node.label}
                </text>
                <text
                  x={node.x + nodeWidth / 2}
                  y={node.y - 22}
                  textAnchor="middle"
                  className="fill-white font-mono font-bold"
                  fontSize={isMobile ? 10 : 11}
                >
                  {formatMillions(node.value)}
                </text>
              </g>
            ) : node.x < width / 2 ? (
              <text
                x={node.x - 8}
                y={node.y + node.h / 2}
                textAnchor="end"
                className="fill-neutral-400 font-mono"
              >
                <tspan
                  x={node.x - 8}
                  dy="-0.5em"
                  fontSize={isMobile ? 9 : 10}
                  fontWeight="500"
                >
                  {node.label}
                </tspan>
                <tspan
                  x={node.x - 8}
                  dy="1.2em"
                  className="fill-white"
                  fontSize={isMobile ? 9 : 10}
                >
                  {totalIncome > 0 && 'value' in node
                    ? formatPercent(((node as { value: number }).value / totalIncome) * 100)
                    : '0%'}
                </tspan>
              </text>
            ) : (
              <text
                x={node.x + nodeWidth + 8}
                y={node.y + node.h / 2}
                textAnchor="start"
                className="fill-neutral-400 font-mono"
              >
                <tspan
                  x={node.x + nodeWidth + 8}
                  dy="-0.5em"
                  fontSize={isMobile ? 9 : 10}
                  fontWeight="500"
                >
                  {node.label}
                </tspan>
                <tspan
                  x={node.x + nodeWidth + 8}
                  dy="1.2em"
                  className="fill-white"
                  fontSize={isMobile ? 9 : 10}
                >
                  {totalSpending > 0 && 'value' in node
                    ? formatPercent(((node as { value: number }).value / totalSpending) * 100)
                    : '0%'}
                </tspan>
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};
