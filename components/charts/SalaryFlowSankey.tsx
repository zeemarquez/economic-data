import React, { useMemo, useState, useRef, useEffect } from 'react';
import { TaxResult } from '../../types';

interface Props {
  data: TaxResult;
}

// Colors for the retro aesthetic
const COLORS = {
  total: '#525252',
  companySS: '#404040',
  gross: '#737373',
  net: '#e5e5e5', // Brightest for the most important number
  irpf: '#525252',
  employeeSS: '#404040',
  link: '#ffffff',
};

const formatCurrency = (value: number) => 
  value.toLocaleString('es-ES', { maximumFractionDigits: 0, style: 'currency', currency: 'EUR' });

export const SalaryFlowSankey: React.FC<Props> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 }); 
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        // Adjust height based on width to maintain a pleasant aspect ratio
        // Mobile: shorter (e.g. 380px), Desktop: taller but not too tall (e.g. 450px)
        const h = w < 600 ? 380 : 450;
        setDimensions({ width: w, height: h });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const {
    grossSalary,
    netSalaryYearly,
    ssEmployer,
    ssEmployee,
    irpfAmount,
    totalCostEmployer
  } = data;

  // Dimensions derived from state
  const { width, height } = dimensions;
  const isMobile = width < 600;
  
  // Responsive padding
  const paddingX = isMobile ? 60 : 120; // Reduced padding to give more width to the graph
  const paddingY = 30; // Reduced vertical padding
  const nodeWidth = 12;
  
  // Ensure we don't have negative gap
  const colGap = Math.max(10, (width - paddingX * 2 - nodeWidth * 3) / 2);

  // ---- GAPS ----
  // Tighter gaps for a more compact look
  const gapC2 = 30; // Gap between Company SS and Gross
  const gapC3 = 20; // Gap between Net, IRPF, Employee SS

  // ---- HEIGHT CALCULATION ----
  // Critical Fix: Calculate max possible vertical expansion caused by gaps
  // Column 1 has 0 gaps.
  // Column 2 has 1 gap (30px).
  // Column 3 has 2 gaps (20px * 2 = 40px). 
  // Plus, Column 3 is centered on Gross, which is part of Col 2. 
  // The logic needs to ensure the scaling factor (pxPerEuro) is small enough 
  // so that (MaxVal * pxPerEuro) + MaxGaps fits inside (Height - Padding).
  const maxGapStack = 60; // Safety buffer for gaps
  const availableDrawingHeight = height - (paddingY * 2) - maxGapStack;
  
  // Avoid division by zero
  const maxVal = totalCostEmployer || 1; 
  const pxPerEuro = availableDrawingHeight / maxVal;

  const getH = (val: number) => Math.max(val * pxPerEuro, 2); // Min height 2px

  // ---- COLUMN 1: Total Cost ----
  // Center this column vertically in the available space
  const heightC1 = getH(totalCostEmployer);
  const startYC1 = paddingY + (availableDrawingHeight + maxGapStack - heightC1) / 2;

  const nodeTotal = {
    x: paddingX,
    y: startYC1,
    h: heightC1,
    value: totalCostEmployer,
    label: "Coste total",
    color: COLORS.total
  };

  // ---- COLUMN 2: Company SS & Gross Salary ----
  const heightC2 = getH(ssEmployer) + getH(grossSalary) + gapC2;
  // Center relative to Node Total (which is essentially the center of the canvas)
  const startYC2 = nodeTotal.y + (nodeTotal.h - heightC2) / 2;

  const nodeCompanySS = {
    x: paddingX + nodeWidth + colGap,
    y: startYC2,
    h: getH(ssEmployer),
    value: ssEmployer,
    label: "Seguridad Social empresa",
    color: COLORS.companySS
  };

  const nodeGross = {
    x: paddingX + nodeWidth + colGap,
    y: startYC2 + nodeCompanySS.h + gapC2,
    h: getH(grossSalary),
    value: grossSalary,
    label: "Salario bruto",
    color: COLORS.gross
  };

  // ---- COLUMN 3: Net, IRPF, Employee SS ----
  const heightC3 = getH(netSalaryYearly) + getH(irpfAmount) + getH(ssEmployee) + (gapC3 * 2);
  // Center relative to Gross Node to make flow look straight
  const startYC3 = nodeGross.y + (nodeGross.h - heightC3) / 2;

  const nodeNet = {
    x: paddingX + nodeWidth * 2 + colGap * 2,
    y: startYC3,
    h: getH(netSalaryYearly),
    value: netSalaryYearly,
    label: "Ingreso neto",
    color: COLORS.net
  };

  const nodeIRPF = {
    x: paddingX + nodeWidth * 2 + colGap * 2,
    y: startYC3 + nodeNet.h + gapC3,
    h: getH(irpfAmount),
    value: irpfAmount,
    label: "IRPF",
    color: COLORS.irpf
  };

  const nodeEmpSS = {
    x: paddingX + nodeWidth * 2 + colGap * 2,
    y: startYC3 + nodeNet.h + gapC3 + nodeIRPF.h + gapC3,
    h: getH(ssEmployee),
    value: ssEmployee,
    label: "Seguridad Social trabajador",
    color: COLORS.employeeSS
  };

  // ---- LINKS ----
  const drawLink = (
    start: { x: number; y: number; h: number },
    end: { x: number; y: number; h: number },
    startOffsetH: number = 0, 
    endOffsetH: number = 0,   
    valueHeight: number       
  ) => {
    const x0 = start.x + nodeWidth;
    const y0 = start.y + startOffsetH + valueHeight / 2;
    const x1 = end.x;
    const y1 = end.y + endOffsetH + valueHeight / 2;

    // Adjust control points based on distance for smoother curves
    const dist = x1 - x0;
    const controlX1 = x0 + dist * 0.5;
    const controlX2 = x1 - dist * 0.5;
    
    // Path for the ribbon
    const ribbonTop = `M ${x0} ${y0 - valueHeight/2} 
                       C ${controlX1} ${y0 - valueHeight/2}, ${controlX2} ${y1 - valueHeight/2}, ${x1} ${y1 - valueHeight/2}
                       L ${x1} ${y1 + valueHeight/2}
                       C ${controlX2} ${y1 + valueHeight/2}, ${controlX1} ${y0 + valueHeight/2}, ${x0} ${y0 + valueHeight/2}
                       Z`;
    return ribbonTop;
  };

  // Link Data
  const linkTotalToSS = {
    d: drawLink(nodeTotal, nodeCompanySS, 0, 0, getH(ssEmployer)),
    id: 'total-ss'
  };
  
  const linkTotalToGross = {
    d: drawLink(nodeTotal, nodeGross, getH(ssEmployer), 0, getH(grossSalary)),
    id: 'total-gross'
  };

  const linkGrossToNet = {
    d: drawLink(nodeGross, nodeNet, 0, 0, getH(netSalaryYearly)),
    id: 'gross-net'
  };

  const linkGrossToIRPF = {
    d: drawLink(nodeGross, nodeIRPF, getH(netSalaryYearly), 0, getH(irpfAmount)),
    id: 'gross-irpf'
  };

  const linkGrossToEmpSS = {
    d: drawLink(nodeGross, nodeEmpSS, getH(netSalaryYearly) + getH(irpfAmount), 0, getH(ssEmployee)),
    id: 'gross-empss'
  };

  const links = [linkTotalToSS, linkTotalToGross, linkGrossToNet, linkGrossToIRPF, linkGrossToEmpSS];
  const nodes = [nodeTotal, nodeCompanySS, nodeGross, nodeNet, nodeIRPF, nodeEmpSS];

  if (totalCostEmployer <= 0) return <div className="h-[400px] flex items-center justify-center text-neutral-500 font-mono text-xs">INTRODUCE UN SALARIO PARA VER EL FLUJO</div>;

  return (
    <div ref={containerRef} className="w-full h-full min-h-[380px] select-none flex items-center justify-center">
      <svg 
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`} 
        className="block drop-shadow-2xl"
      >
        <defs>
          <linearGradient id="gradientLink" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0.05" />
            <stop offset="100%" stopColor="white" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Links */}
        {links.map((link) => (
          <path
            key={link.id}
            d={link.d}
            fill="url(#gradientLink)"
            stroke="white"
            strokeWidth={hoveredPath === link.id ? 1 : 0}
            strokeOpacity={0.3}
            onMouseEnter={() => setHoveredPath(link.id)}
            onMouseLeave={() => setHoveredPath(null)}
            className="transition-all duration-300 ease-out hover:opacity-100 opacity-80 cursor-crosshair"
          />
        ))}

        {/* Nodes */}
        {nodes.map((node, i) => (
          <g key={i}>
            <rect
              x={node.x}
              y={node.y}
              width={nodeWidth}
              height={node.h}
              fill={node.color}
              rx={2}
              className="transition-all duration-500"
            />
            {/* Labels */}
            {node === nodeTotal ? (
              <text x={node.x - 10} y={node.y + node.h / 2} textAnchor="end" className="fill-neutral-500 font-mono uppercase tracking-wider">
                <tspan x={node.x - 10} dy="-0.6em" fontSize={isMobile ? "9" : "10"} fontWeight="bold">{node.label}</tspan>
                <tspan x={node.x - 10} dy="1.4em" className="fill-white" fontSize={isMobile ? "11" : "12"}>{formatCurrency(node.value)}</tspan>
              </text>
            ) : node === nodeGross || node === nodeCompanySS ? (
               // Middle Column Labels
               <g>
                 <text x={node.x + nodeWidth / 2} y={node.y - 10} textAnchor="middle" className="fill-neutral-500 font-mono uppercase tracking-wider" fontSize={isMobile ? "9" : "10"}>
                    {node.label}
                 </text>
                 <text x={node.x + nodeWidth / 2} y={node.y - 25} textAnchor="middle" className="fill-white font-mono font-bold" fontSize={isMobile ? "11" : "12"}>
                    {formatCurrency(node.value)}
                 </text>
               </g>
            ) : (
              // Right Column Labels
              <text x={node.x + nodeWidth + 10} y={node.y + node.h / 2} textAnchor="start" className="fill-neutral-500 font-mono uppercase tracking-wider">
                <tspan x={node.x + nodeWidth + 10} dy="-0.6em" fontSize={isMobile ? "9" : "10"} fontWeight="bold">{node.label}</tspan>
                <tspan x={node.x + nodeWidth + 10} dy="1.4em" className="fill-white" fontSize={isMobile ? "11" : "12"}>{formatCurrency(node.value)}</tspan>
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};