import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calculator, LineChart as ChartIcon, LayoutDashboard, Target, ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { runModeloVida, InputsModeloVida } from '../lib/vidaModel';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts';

const defaultInputs: InputsModeloVida = {
    nacimiento_hijos: [2030, 2031, 2033, 2035, 2037],
    coste_educacion_mensual: 700,
    alimentacion_mensual: 160,
    ocio_mensual: 50,
    vestimenta_mensual: 50,
    otros_gastos_mensuales: 200,

    alquiler_mensual: 2500, // 5% de precio_vivienda por defecto para que coincida con modo simple
    precio_vivienda: 600,
    tin_hipoteca: 0.029,
    years_hipoteca: 30,

    year_indepen: 2028,
    year_compra_vivienda: 2032,
    ingresos_trabajo_brutos_y0: 45,
    ingresos_trabajo_brutos_y15: 100,

    capital_inicial: 750,
    tasa_impositiva_salario: 0.31,
    year_jubilacion: 2065,
    porcentaje_gastos_fijos_vivienda: 0.02,
    porcentaje_entrada_vivienda: 0.20,
    inflaccion: 0.03,
    tir_inmobiliaria: 0.02,
    tir_ahorros: 0.09,
    ayuda_entrada: 0,
    liquido_minimo: 5,
    descuentos_educacion: true
};

const formatCurrency = (val: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(val);
const formatInput = (val: number) => {
    if (isNaN(val)) return '0';
    return Number(val.toFixed(1)).toString();
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-black/90 border border-white/10 p-3 rounded-lg shadow-xl backdrop-blur-md">
                <p className="text-neutral-500 font-mono text-[10px] uppercase tracking-widest mb-2 border-b border-white/5 pb-1">{label}</p>
                <div className="flex flex-col gap-1.5">
                    {payload.map((entry: any, index: number) => {
                        let color = entry.color || entry.fill;
                        if (entry.name === 'Resultado (neto)') {
                            color = entry.value >= 0 ? '#4ade80' : '#f87171';
                        }
                        return (
                            <div key={index} className="flex justify-between gap-6 items-center">
                                <span className="text-[10px] font-mono text-neutral-400 uppercase">{entry.name}:</span>
                                <span className="text-xs font-mono font-bold" style={{ color }}>
                                    {entry.value < 0 ? `(${formatCurrency(Math.abs(entry.value))})` : formatCurrency(entry.value)}k€
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};


export default function SimuladorVida() {
    const [inputs, setInputs] = useState<InputsModeloVida>(defaultInputs);
    const [tab, setTab] = useState<'charts' | 'table'>('charts');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ Macro: true, Vivienda: true, Familia: true, 'P&G': true, Patrimonio: true });

    const [modoSimple, setModoSimple] = useState(false);
    const [tipoColegio, setTipoColegio] = useState<'publico' | 'privado'>('privado');
    const [gastosHijoMesSimple, setGastosHijoMesSimple] = useState(460); // 160 + 50 + 50 + 200

    // Retirement Panel
    const [esperanzaVida, setEsperanzaVida] = useState(2078);
    const [herenciaNominal, setHerenciaNominal] = useState(2000);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof InputsModeloVida) => {
        let val: any = parseFloat(e.target.value);
        setInputs({ ...inputs, [field]: isNaN(val) ? 0 : val });
    };

    const addChildYear = (year: number) => {
        setInputs({ ...inputs, nacimiento_hijos: [...inputs.nacimiento_hijos, year].sort() });
    };

    const removeChildYear = (index: number) => {
        const newHijos = [...inputs.nacimiento_hijos];
        newHijos.splice(index, 1);
        setInputs({ ...inputs, nacimiento_hijos: newHijos });
    };

    const effectiveInputs = useMemo(() => {
        if (!modoSimple) return inputs;

        return {
            ...inputs,
            tasa_impositiva_salario: 0.31,
            alquiler_mensual: (inputs.precio_vivienda * 1000 * 0.05) / 12,
            tin_hipoteca: 0.029,
            years_hipoteca: 30,
            porcentaje_entrada_vivienda: 0.20,
            porcentaje_gastos_fijos_vivienda: 0.02,

            alimentacion_mensual: gastosHijoMesSimple,
            ocio_mensual: 0,
            vestimenta_mensual: 0,
            otros_gastos_mensuales: 0,

            coste_educacion_mensual: tipoColegio === 'publico' ? 100 : 700,
            descuentos_educacion: tipoColegio === 'privado',
        };
    }, [inputs, modoSimple, gastosHijoMesSimple, tipoColegio]);

    const modelResult = useMemo(() => runModeloVida(effectiveInputs), [effectiveInputs]);

    const chartData = useMemo(() => {
        const inputs_alquiler = { ...effectiveInputs, year_compra_vivienda: 3000 };
        const alquiler_porcentaje_precio = 0.04;
        inputs_alquiler.alquiler_mensual = (alquiler_porcentaje_precio * effectiveInputs.precio_vivienda * 1000) / 12;
        const modelAlquiler = runModeloVida(inputs_alquiler);

        return Array.from({ length: modelResult.periods }).map((_, i) => ({
            year: modelResult.getPeriod(i),
            fondos: modelResult.arr_fondos_real[i],
            patrimonio: modelResult.arr_patrimonio_real[i],
            resultado: modelResult.arr_resultado_neto[i],
            ingresosNominal: modelResult.arr_ingresos_brutos_nominal[i],
            ingresosReal: modelResult.arr_ingresos_brutos_real[i],
            fondosAlquiler: modelAlquiler.arr_fondos_real[i]
        }));
    }, [modelResult, effectiveInputs]);

    const groupedData = useMemo(() => {
        const groups: Record<string, any[]> = {};
        for (const row of modelResult.tableData) {
            if (!groups[row.group]) groups[row.group] = [];
            groups[row.group].push(row);
        }
        return groups;
    }, [modelResult.tableData]);

    // Minimum Retirement Calculation
    const minRetirement = useMemo(() => {
        const t_final = esperanzaVida - modelResult.initial_period;
        let minYear = null;
        let achievedRealPatrimony = null;
        let targetInheritance = null;

        for (let y = 2027; y < esperanzaVida; y++) {
            const testInputs = { ...effectiveInputs, year_jubilacion: y };
            const res = runModeloVida(testInputs);
            if (t_final < 0 || t_final >= res.periods) continue;

            const realInheritance = herenciaNominal * (1 + res.inflaccion_acumulada[t_final]);
            const patrimony = res.arr_patrimonio_real[t_final];
            const is_possible = (patrimony > realInheritance) && res.is_possible;

            if (is_possible) {
                minYear = y;
                achievedRealPatrimony = patrimony;
                targetInheritance = realInheritance;
                break;
            }
        }
        return { minYear, targetInheritance, achievedRealPatrimony };
    }, [inputs, esperanzaVida, herenciaNominal, modelResult.initial_period]);

    return (
        <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
            <header className="w-full max-w-7xl mb-8 flex justify-between items-end border-b border-white/5 pb-4">
                <div className="flex items-center gap-4">
                    <Link
                        to="/"
                        className="text-neutral-500 hover:text-white transition-colors p-1 -ml-1"
                        aria-label="Volver al inicio"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-2 font-mono">
                        SIMULADOR<span className="text-neutral-500">VIDA</span>
                    </h1>
                </div>
            </header>

            <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT PANEL - Inputs */}
                <div className="lg:col-start-1 lg:col-span-4 flex flex-col gap-6">
                    <Card
                        className="border-white/20 shadow-[0_0_30px_-10px_rgba(255,255,255,0.05)] h-[850px] flex flex-col"
                        icon={<Calculator size={18} />}
                        title="Parámetros"
                        headerAside={
                            <div className="flex bg-neutral-900/50 rounded p-0.5 border border-white/5">
                                <button
                                    className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-colors ${modoSimple ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-white'}`}
                                    onClick={() => setModoSimple(true)}
                                >
                                    Simple
                                </button>
                                <button
                                    className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-colors ${!modoSimple ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-white'}`}
                                    onClick={() => setModoSimple(false)}
                                >
                                    Detallado
                                </button>
                            </div>
                        }
                    >
                        <div className="flex flex-col gap-6 mt-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="space-y-4">
                                <h3 className="text-neutral-400 font-mono text-[10px] uppercase tracking-widest border-b border-white/5 pb-1">Ingresos</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="Ingresos Y0 (k€)" value={formatInput(inputs.ingresos_trabajo_brutos_y0)} onChange={e => handleInputChange(e, 'ingresos_trabajo_brutos_y0')} />
                                    <Input label="Ingresos Y15 (k€)" value={formatInput(inputs.ingresos_trabajo_brutos_y15)} onChange={e => handleInputChange(e, 'ingresos_trabajo_brutos_y15')} />
                                    {!modoSimple && <Input label="Tasa (%)" value={formatInput(inputs.tasa_impositiva_salario! * 100)} onChange={e => handleInputChange({ ...e, target: { ...e.target, value: String(Number(e.target.value) / 100) } } as any, 'tasa_impositiva_salario')} />}
                                    <Input label="Año Jubilac." value={formatInput(inputs.year_jubilacion!)} onChange={e => handleInputChange(e, 'year_jubilacion')} />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-neutral-400 font-mono text-[10px] uppercase tracking-widest border-b border-white/5 pb-1">Vivienda</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {!modoSimple && <Input label="Alquiler (€/mes)" value={formatInput(inputs.alquiler_mensual)} onChange={e => handleInputChange(e, 'alquiler_mensual')} />}
                                    <Input label="Año Indep." value={formatInput(inputs.year_indepen)} onChange={e => handleInputChange(e, 'year_indepen')} />
                                    <Input label="Precio (k€)" value={formatInput(inputs.precio_vivienda)} onChange={e => handleInputChange(e, 'precio_vivienda')} />
                                    <Input label="Año Compra" value={formatInput(inputs.year_compra_vivienda)} onChange={e => handleInputChange(e, 'year_compra_vivienda')} />
                                    {!modoSimple && (
                                        <>
                                            <Input label="Años Hipoteca" value={formatInput(inputs.years_hipoteca)} onChange={e => handleInputChange(e, 'years_hipoteca')} />
                                            <Input label="TIN (%)" value={formatInput(inputs.tin_hipoteca * 100)} onChange={e => handleInputChange({ ...e, target: { ...e.target, value: String(Number(e.target.value) / 100) } } as any, 'tin_hipoteca')} />
                                            <Input label="Entrada (%)" value={formatInput(inputs.porcentaje_entrada_vivienda! * 100)} onChange={e => handleInputChange({ ...e, target: { ...e.target, value: String(Number(e.target.value) / 100) } } as any, 'porcentaje_entrada_vivienda')} />
                                            <Input label="Gastos (%)" value={formatInput(inputs.porcentaje_gastos_fijos_vivienda! * 100)} onChange={e => handleInputChange({ ...e, target: { ...e.target, value: String(Number(e.target.value) / 100) } } as any, 'porcentaje_gastos_fijos_vivienda')} />
                                        </>
                                    )}
                                    <div className="col-span-2">
                                        <Input label="Ayuda Entrada (k€)" value={formatInput(inputs.ayuda_entrada!)} onChange={e => handleInputChange(e, 'ayuda_entrada')} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-neutral-400 font-mono text-[10px] uppercase tracking-widest border-b border-white/5 pb-1">Familia</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 space-y-3">
                                        <div className="flex justify-between items-center pl-1">
                                            <label className="text-xs uppercase tracking-widest text-neutral-500 font-mono">Nacimiento Hijos</label>
                                            <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-tighter">Total: {inputs.nacimiento_hijos.length}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-neutral-900/30 border border-neutral-800 rounded-lg">
                                            {inputs.nacimiento_hijos.map((year, idx) => (
                                                <span key={`${year}-${idx}`} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/10 border border-white/10 rounded text-xs font-mono text-white group hover:border-white/30 transition-colors">
                                                    {year}
                                                    <button
                                                        onClick={() => removeChildYear(idx)}
                                                        className="text-neutral-500 hover:text-white transition-colors"
                                                        aria-label={`Eliminar hijo nacido en ${year}`}
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="Añadir año..."
                                                className="bg-transparent border-none outline-none text-xs font-mono text-white placeholder-neutral-600 w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = parseInt((e.target as HTMLInputElement).value);
                                                        if (!isNaN(val) && val > 1900 && val < 2100) {
                                                            addChildYear(val);
                                                            (e.target as HTMLInputElement).value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                    {modoSimple ? (
                                        <>
                                            <div className="col-span-2 space-y-1">
                                                <label className="font-mono text-xs uppercase text-neutral-400 pl-1">Colegio</label>
                                                <div className="flex bg-neutral-900/50 rounded-lg p-1 border border-white/5">
                                                    <button
                                                        className={`flex-1 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-colors ${tipoColegio === 'publico' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'}`}
                                                        onClick={() => setTipoColegio('publico')}
                                                    >
                                                        Público
                                                    </button>
                                                    <button
                                                        className={`flex-1 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-colors ${tipoColegio === 'privado' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'}`}
                                                        onClick={() => setTipoColegio('privado')}
                                                    >
                                                        Privado
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="col-span-2">
                                                <Input label="Gastos/Hijo (€/mes)" value={formatInput(gastosHijoMesSimple)} onChange={e => {
                                                    const v = parseFloat(e.target.value);
                                                    if (!isNaN(v)) setGastosHijoMesSimple(v);
                                                }} />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Input label="Educ. (€/mes)" value={formatInput(inputs.coste_educacion_mensual)} onChange={e => handleInputChange(e, 'coste_educacion_mensual')} />
                                            <Input label="Alim. (€/mes)" value={formatInput(inputs.alimentacion_mensual)} onChange={e => handleInputChange(e, 'alimentacion_mensual')} />
                                            <Input label="Ocio (€/mes)" value={formatInput(inputs.ocio_mensual)} onChange={e => handleInputChange(e, 'ocio_mensual')} />
                                            <Input label="Vest. (€/mes)" value={formatInput(inputs.vestimenta_mensual)} onChange={e => handleInputChange(e, 'vestimenta_mensual')} />
                                            <div className="col-span-2">
                                                <Input label="Otros (€/mes)" value={formatInput(inputs.otros_gastos_mensuales)} onChange={e => handleInputChange(e, 'otros_gastos_mensuales')} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-neutral-400 font-mono text-[10px] uppercase tracking-widest border-b border-white/5 pb-1">Patrimonio</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="Capital (k€)" value={formatInput(inputs.capital_inicial!)} onChange={e => handleInputChange(e, 'capital_inicial')} />
                                    <Input label="TIR (%)" value={formatInput(inputs.tir_ahorros! * 100)} onChange={e => handleInputChange({ ...e, target: { ...e.target, value: String(Number(e.target.value) / 100) } } as any, 'tir_ahorros')} />
                                    <Input label="TIR Inmo. (%)" value={formatInput(inputs.tir_inmobiliaria! * 100)} onChange={e => handleInputChange({ ...e, target: { ...e.target, value: String(Number(e.target.value) / 100) } } as any, 'tir_inmobiliaria')} />
                                    <Input label="Inflacción (%)" value={formatInput(inputs.inflaccion! * 100)} onChange={e => handleInputChange({ ...e, target: { ...e.target, value: String(Number(e.target.value) / 100) } } as any, 'inflaccion')} />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* RIGHT PANEL - Charts & Table */}
                <div className="lg:col-start-5 lg:col-span-8 flex flex-col gap-6">
                    <Card
                        className="border-white/20 h-[850px] flex flex-col"
                        icon={<LayoutDashboard size={18} />}
                        title="Dashboard Financiero"
                    >
                        <div className="flex gap-4 mb-6 border-b border-white/10 pb-2">
                            <button
                                className={`font-mono text-sm uppercase tracking-wider pb-2 border-b-2 transition-colors ${tab === 'charts' ? 'border-primary text-white' : 'border-transparent text-neutral-500 hover:text-white'}`}
                                onClick={() => setTab('charts')}
                            >
                                Gráficas
                            </button>
                            <button
                                className={`font-mono text-sm uppercase tracking-wider pb-2 border-b-2 transition-colors ${tab === 'table' ? 'border-primary text-white' : 'border-transparent text-neutral-500 hover:text-white'}`}
                                onClick={() => setTab('table')}
                            >
                                Tabla Completa
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden">
                            {tab === 'charts' ? (
                                <div className="h-full flex flex-col gap-8 overflow-y-auto pr-2 custom-scrollbar">
                                    <div className="h-[300px] w-full">
                                        <h3 className="text-white font-mono text-sm mb-4">Patrimonio vs Fondos y Resultado</h3>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                                <XAxis dataKey="year" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'monospace' }} />
                                                <YAxis yAxisId="left" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'monospace' }} />
                                                <YAxis yAxisId="right" orientation="right" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'monospace' }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: 10, paddingTop: 10 }} />
                                                <Bar yAxisId="right" dataKey="resultado" name="Resultado (neto)" barSize={20}>
                                                    {chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.resultado >= 0 ? '#4ade80' : '#f87171'} fillOpacity={0.3} />
                                                    ))}
                                                </Bar>
                                                <Line yAxisId="left" type="monotone" dataKey="fondos" name="Fondos (real)" stroke="#444444" strokeWidth={2} dot={false} />
                                                <Line yAxisId="left" type="monotone" dataKey="patrimonio" name="Patrimonio (real)" stroke="#ffffff" strokeWidth={2} dot={false} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="h-[300px] w-full">
                                        <h3 className="text-white font-mono text-sm mb-4">Alquiler vs Comprar</h3>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                                <XAxis dataKey="year" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'monospace' }} />
                                                <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'monospace' }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: 10, paddingTop: 10 }} />
                                                <Line type="monotone" dataKey="fondos" name="Fondos (real) (Compra)" stroke="#666666" strokeWidth={2} dot={false} legendType="line" />
                                                <Line type="monotone" dataKey="patrimonio" name="Patrimonio (real) (Compra)" stroke="#ffffff" strokeWidth={2} dot={false} legendType="line" />
                                                <Line type="monotone" dataKey="fondosAlquiler" name="Fondos (real) (Alquiler)" stroke="#bbbbbb" strokeDasharray="5 5" strokeWidth={2} dot={false} legendType="plainline" />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full overflow-auto custom-scrollbar border border-white/5 rounded">
                                    <table className="w-full text-left border-collapse min-w-max">
                                        <thead className="sticky top-0 bg-neutral-900 border-b border-white/10 z-10">
                                            <tr>
                                                <th className="p-2 text-white font-mono text-xs whitespace-nowrap sticky left-0 bg-neutral-900 z-20">Concepto</th>
                                                {Array.from({ length: modelResult.periods }).map((_, i) => (
                                                    <th key={i} className="p-2 text-neutral-400 font-mono text-xs font-normal text-right min-w-[60px]">
                                                        {modelResult.getPeriod(i)}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        {Object.entries(groupedData).map(([groupName, rows]) => (
                                            <tbody key={groupName} className="divide-y divide-white/5">
                                                <tr
                                                    className="cursor-pointer bg-white/5 hover:bg-white/10 transition-colors border-y border-white/10"
                                                    onClick={() => setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }))}
                                                >
                                                    <td className="p-2 font-mono text-xs font-bold tracking-widest uppercase whitespace-nowrap sticky left-0 z-20 bg-neutral-800 text-white border-r border-white/5">
                                                        <div className="flex items-center gap-2">
                                                            {expandedGroups[groupName] ? <ChevronDown size={14} className="text-neutral-400" /> : <ChevronRight size={14} className="text-neutral-400" />}
                                                            {groupName}
                                                        </div>
                                                    </td>
                                                    <td colSpan={modelResult.periods} className="p-2 bg-neutral-900/50"></td>
                                                </tr>
                                                {expandedGroups[groupName] && (rows as any[]).map((row) => {
                                                    const { name, values, format, highlight } = row;
                                                    return (
                                                        <tr key={name} className={`hover:bg-white/5 ${highlight ? 'bg-white/5 font-bold border-y border-white/10' : ''}`}>
                                                            <td className={`p-2 font-mono text-xs whitespace-nowrap sticky left-0 z-20 ${highlight ? 'bg-neutral-800 text-white' : 'bg-black/80 text-neutral-300'}`}>
                                                                <span className="pl-6">{name}</span>
                                                            </td>
                                                            {(values as number[]).map((v: number, i: number) => {
                                                                let displayValue = '';
                                                                if (format === 'percentage') {
                                                                    displayValue = `${(v * 100).toFixed(1)}%`;
                                                                } else if (format === 'boolean') {
                                                                    displayValue = v > 0.5 ? 'SÍ' : 'NO';
                                                                } else {
                                                                    const absV = Math.abs(v);
                                                                    if (absV < 0.1) {
                                                                        displayValue = '-';
                                                                    } else {
                                                                        const formatted = formatCurrency(absV);
                                                                        displayValue = v < 0 ? `(${formatted})` : formatted;
                                                                    }
                                                                }

                                                                return (
                                                                    <td key={i} className={`p-2 font-mono text-xs text-right tabular-nums ${v < 0 ? 'text-red-400' : (highlight ? 'text-white' : 'text-neutral-400')}`}>
                                                                        {displayValue}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        ))}
                                    </table>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* BOTTOM PANEL - Minimum Retirement */}
                <div className="col-span-1 lg:col-span-12">
                    <Card
                        className="border-white/20 bg-gradient-to-br from-neutral-900 to-black"
                        icon={<Target size={18} className="text-white" />}
                        title="Cálculo Jubilación Mínima"
                    >
                        <div className="flex flex-col md:flex-row gap-8 items-center mt-4 border border-white/5 p-6 rounded-lg bg-black/20">
                            <div className="flex-1 flex gap-4 w-full">
                                <div className="w-full max-w-xs">
                                    <Input
                                        label="Esperanza de vida (Año)"
                                        value={formatInput(esperanzaVida)}
                                        onChange={e => {
                                            const v = parseInt(e.target.value);
                                            if (!isNaN(v)) setEsperanzaVida(v);
                                        }}
                                    />
                                </div>
                                <div className="w-full max-w-xs">
                                    <Input
                                        label="Herencia Real (k€)"
                                        value={formatInput(herenciaNominal)}
                                        onChange={e => {
                                            const v = parseInt(e.target.value);
                                            if (!isNaN(v)) setHerenciaNominal(v);
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="min-w-[250px] text-center md:text-right md:border-l md:border-white/10 md:pl-8">
                                <p className="text-neutral-500 font-mono text-[10px] uppercase tracking-widest mb-2">
                                    Año Mínimo Jubilación
                                </p>
                                <div className="text-5xl md:text-6xl font-bold text-white font-mono tracking-tight">
                                    {minRetirement.minYear ? minRetirement.minYear : <span className="text-red-500">N/A</span>}
                                </div>
                                {minRetirement.minYear && (
                                    <p className="text-neutral-400 font-mono text-xs mt-3">
                                        Patrimonio final (real) est: <span className="text-white">{formatCurrency(minRetirement.achievedRealPatrimony!)}k€</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            </main>

            {/* Global styles for custom scrollbar */}
            <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
        </div>
    );
}
