import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calculator, LineChart as ChartIcon, LayoutDashboard, ChevronDown, ChevronRight, BookOpen, Info, Maximize2, Minimize2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Tooltip } from '../components/ui/Tooltip';
import { runModeloVida, InputsModeloVida } from '../lib/vidaModel';
import { SPANISH_REGIMES_2026 } from '../regimes';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts';

const DEFAULT_REGIME_ID = 'es-madrid-2026';
const REGIME_OPTIONS = SPANISH_REGIMES_2026.map((r) => ({
    value: r.id,
    label: r.name.replace(/\s*\(2026\)\s*$/, ''),
}));

const defaultInputs: InputsModeloVida = {
    nacimiento_hijos: [2030, 2031],
    coste_educacion_mensual: 150,
    alimentacion_mensual: 160,
    ocio_mensual: 50,
    vestimenta_mensual: 50,
    otros_gastos_mensuales: 200,

    alquiler_mensual: 1600, // 5% de precio_vivienda por defecto para que coincida con modo simple
    precio_vivienda: 300,
    tin_hipoteca: 0.029,
    years_hipoteca: 30,

    year_indepen: 2028,
    year_compra_vivienda: 2032,
    ingresos_trabajo_brutos_y0: 50,
    ingresos_trabajo_brutos_y15: 90,

    capital_inicial: 30,
    tasa_impositiva_salario: 0.31,
    regime_id: DEFAULT_REGIME_ID,
    year_jubilacion: 2065,
    crecimiento_salario: 0,
    porcentaje_gastos_fijos_vivienda: 0.02,
    porcentaje_entrada_vivienda: 0.20,
    inflaccion: 0.03,
    tir_inmobiliaria: 0.02,
    tir_ahorros: 0.09,
    ayuda_entrada: 20,
    liquido_minimo: 5,
    descuentos_educacion: false
};

const formatCurrency = (val: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(val);
const formatInput = (val: number) => {
    if (isNaN(val)) return '0';
    return Number(val.toFixed(1)).toString();
};

/**
 * Percentage input that stores its value as a decimal fraction (e.g. 0.029) but lets the
 * user type the percentage with up to one decimal (e.g. "2.9"). Uses local string state
 * while focused so intermediate values like "2." or "2,9" are not reformatted away, which
 * is what previously made decimals impossible. inputMode="decimal" gives a proper mobile
 * keypad with a separator key.
 */
const PercentInput: React.FC<{
    label: string;
    value: number;
    onCommit: (value: number) => void;
    tooltip?: string;
}> = ({ label, value, onCommit, tooltip }) => {
    const [draft, setDraft] = useState<string | null>(null);
    const display = draft ?? formatInput(value * 100);
    return (
        <Input
            label={label}
            suffix="%"
            type="text"
            inputMode="decimal"
            tooltip={tooltip}
            value={display}
            onChange={(e) => {
                const raw = e.target.value;
                setDraft(raw);
                const norm = raw.replace(',', '.').trim();
                if (norm === '') {
                    onCommit(0);
                    return;
                }
                const parsed = parseFloat(norm);
                if (!isNaN(parsed)) onCommit(parsed / 100);
            }}
            onBlur={() => setDraft(null)}
        />
    );
};

const CustomChartTooltip = ({ active, payload, label }: any) => {
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


const CONCEPT_TOOLTIPS: Record<string, string> = {
    // Macro
    'Inflacción': 'Tasa de inflación anual prevista para el ajuste de precios y valores reales.',
    'Inflacción acumulada': 'Nivel de precios acumulado desde el inicio de la simulación.',
    // Vivienda
    'Hipoteca TIN': 'Tipo de Interés Nominal aplicado al préstamo hipotecario.',
    'Entrada hipoteca': 'Capital aportado inicialmente al comprar la vivienda.',
    'Hipoteca': 'Indica si el préstamo hipotecario está activo en este periodo.',
    'Hipoteca BoP': 'Deuda hipotecaria pendiente al inicio del año (Beginning of Period).',
    'Hipoteca interes': 'Intereses pagados al banco durante el año.',
    'Hipoteca cuota': 'Suma de intereses y capital amortizado pagado el periodo.',
    'Hipoteca pago de deuda': 'Parte de la cuota anual destinada a reducir la deuda principal.',
    'Hipoteca EoP': 'Deuda hipotecaria pendiente al final del año (End of Period).',
    'Patrimonio inmobiliario': 'Valor neto del inmueble (Precio - Deuda pendiente) sin revalorización.',
    'Vivienda tir': 'Tasa de revalorización anual del valor de mercado de la vivienda.',
    'Vivienda tir acumulada': 'Revalorización total acumulada del inmueble desde la compra.',
    'Patrimonio inmobiliario real': 'Valor de mercado neto de la vivienda ajustado por revalorización.',
    'Gastos fijos': 'Gastos de mantenimiento, IBI y comunidad (valor nominal).',
    'Gastos fijos inf': 'Gastos de mantenimiento ajustados a inflación (real).',
    'Alquiler': 'Coste del alquiler mensual anualizado (valor nominal).',
    'Alquiler inf': 'Coste del alquiler ajustado a inflación (real).',
    'Vivienda recurrente (nominal)': 'Gastos habituales en valores base: Cuota hipoteca + Gastos fijos + Alquiler (sin ajustar por inflación).',
    'Vivienda recurrente (real)': 'Gastos habituales ajustados a inflación: Cuota (fija) + Gastos fijos inf + Alquiler inf.',
    'Otros gastos compra': 'Impuestos e inscripciones legales en el momento de la compra.',
    'Vivienda extra': 'Suma de la entrada inicial y los gastos legales de compra.',
    'Total vivienda (nominal)': 'Vivienda recurrente nominal + Vivienda extra.',
    'Total vivienda (real)': 'Vivienda recurrente real + Vivienda extra (ajustado a inflación).',
    // Familia
    'Independizado': 'Indica si se han dejado de compartir gastos con el núcleo familiar original.',
    'Padres': 'Número de adultos que componen la unidad familiar.',
    'Hijos': 'Número total de hijos nacidos hasta la fecha.',
    'Educación por hijo': 'Coste anual de educación/colegio por cada hijo individualmente.',
    'Hijos en hogar': 'Número de hijos menores de 23 años en el hogar.',
    'Miembros hogar': 'Padres + Hijos en hogar. Se usa para prorratear gastos (alimentación, ocio, vestimenta, otros).',
    'Educación descuento': 'Ahorros aplicados por familia numerosa o subvenciones.',
    'Educación': 'Gasto total anual en enseñanza para todos los hijos.',
    'Alimentación': 'Inversión anual en comida para todos los miembros del hogar.',
    'Ocio': 'Gasto anual en entretenimiento y tiempo libre.',
    'Vestimenta': 'Gasto anual en ropa y calzado para la familia.',
    'Otros gastos hijos': 'Gastos no previstos por hijo en hogar (se multiplica solo por hijos en hogar).',
    'Total familia': 'Carga financiera total de la unidad familiar (valor nominal).',
    'Total familia real': 'Gasto familiar total ajustado por la inflación del periodo.',
    // P&G
    'Ingresos brutos nominal': 'Salario total del hogar antes de impuestos e inflación.',
    'Ingresos brutos real': 'Poder adquisitivo del salario ajustado por inflación.',
    'Jubilado': 'Indica si se ha dejado de percibir ingresos del trabajo.',
    'Ingresos totales': 'Salario real percibido antes de impuestos.',
    'Tasa impositiva': 'Tasa efectiva (IRPF + Seguridad Social del trabajador) según la comunidad autónoma, calculada sobre los ingresos brutos de cada año.',
    'Ingresos netos': 'Dinero disponible tras pagar impuestos (en términos reales).',
    'Gastos vivienda (nominal)': 'Total vivienda nominal (valores base, sin ajuste por inflación).',
    'Gastos vivienda (real)': 'Total vivienda real (ajustado a inflación); es el flujo de caja efectivo.',
    'Gastos totales': 'Suma de gastos familiares y de vivienda del periodo.',
    'Ayuda entrada': 'Ingreso extraordinario recibido para facilitar la compra de vivienda.',
    'Resultado neto': 'Superávit o déficit del año (Ingresos netos - Gastos + Ayudas).',
    // Patrimonio
    'Beneficios netos': 'Excedente de ingresos que se puede ahorrar o invertir.',
    'Líquido': 'Dinero mantenido en cuenta corriente para gastos menores.',
    'Fondos BoP': 'Valor de la cartera de inversión al inicio del año.',
    'Suscripciones': 'Nuevas aportaciones realizadas a los fondos de inversión.',
    'Reembolsos netos': 'Dinero necesario retirar de la inversión para cubrir déficit.',
    'Impuestos ganancias': 'Impuestos pagados al liquidar beneficios de la inversión (5% est.).',
    'Reembolsos': 'Importe total retirado de los fondos (incluyendo impuestos).',
    'Fondos disponibles': 'Indica si existe patrimonio suficiente para cubrir los gastos.',
    'Crecimiento': 'Rentabilidad anual generada por la cartera de inversión.',
    'Interes': 'Rendimiento económico generado por los fondos en el periodo.',
    'Fondos EoP': 'Valor de la cartera de inversión al finalizar el año.',
    'Fondos real': 'Valor de las inversiones expresado en poder adquisitivo actual.',
    'Patrimonio nominal': 'Fondos EoP + Patrimonio inmobiliario (valor contable, sin revalorización).',
    'Patrimonio real': 'Suma de inversiones, valor neto de vivienda y efectivo (ajustado).',
};

// ─── Metodología Panel ───────────────────────────────────────────────────────

interface MetodSection {
    id: string;
    title: string;
    color: string;
    icon: string;
    items: { label: string; desc: string; formula?: string }[];
}

const METOD_SECTIONS: MetodSection[] = [
    {
        id: 'horizonte',
        title: 'Horizonte de simulación',
        color: '#9ca3af',
        icon: '📅',
        items: [
            {
                label: 'Periodos',
                desc: 'La simulación abarca 60 años consecutivos partiendo del año 2026 (año 0 = 2026, año 59 = 2085). Cada periodo representa un año completo.',
                formula: 'Año(t) = 2026 + t,   t ∈ [0, 59]'
            }
        ]
    },
    {
        id: 'macro',
        title: 'Inflación',
        color: '#f59e0b',
        icon: '📈',
        items: [
            {
                label: 'Inflación anual',
                desc: 'Se aplica una tasa constante de inflación al año (por defecto 3 %). Esta tasa se usa para convertir valores nominales en valores en poder adquisitivo real.',
            },
            {
                label: 'Inflación acumulada',
                desc: 'Se calcula aplicando el efecto compuesto año a año. Sirve para ajustar los gastos familiares y el valor de las inversiones a euros constantes del año 2026.',
                formula: 'InflAcum(t) = (1 + inflación) × (1 + InflAcum(t-1)) − 1'
            }
        ]
    },
    {
        id: 'vivienda',
        title: 'Vivienda e Hipoteca',
        color: '#60a5fa',
        icon: '🏠',
        items: [
            {
                label: 'Alquiler (antes de la compra)',
                desc: 'Entre el año de independencia y el año de compra, se imputa un gasto mensual de alquiler. Este gasto se ajusta por la inflación acumulada. En modo Simple, el alquiler equivale al 5 % anual del precio de la vivienda.',
                formula: 'Gasto alquiler(t) = Alquiler€/mes × 12 / 1000 × (1 + InflAcum(t))'
            },
            {
                label: 'Cuota hipotecaria',
                desc: 'La cuota anual se calcula con la fórmula estándar de anualidad constante (francés) sobre el capital prestado (precio - entrada). La entrada por defecto es el 20 % del precio.',
                formula: 'Cuota = Principal × TIN / (1 − (1 + TIN)^(−n))'
            },
            {
                label: 'Amortización del préstamo',
                desc: 'En cada periodo se calcula la deuda pendiente al inicio del año (BoP), los intereses devengados y el capital amortizado. La deuda al final del año (EoP) se actualiza restando el pago de deuda.',
                formula: 'Interés(t) = DeudaBoP(t) × TIN\nPagoDeuda(t) = Cuota − Interés(t)\nDeudaEoP(t) = DeudaBoP(t) − PagoDeuda(t)'
            },
            {
                label: 'Patrimonio inmobiliario',
                desc: 'El valor nominal del inmueble es el precio de compra menos la deuda pendiente. El valor de mercado real añade una revalorización acumulada (TIR inmobiliaria, por defecto 2 % anual compuesto).',
                formula: 'PatrimInmo(t) = PrecioVivienda − DeudaEoP(t)\nPatrimInmoReal(t) = PatrimInmo(t) × (1 + TIRInmoAcum(t))'
            },
            {
                label: 'Gastos fijos',
                desc: 'Con hipoteca activa se imputan gastos anuales de IBI, comunidad y mantenimiento equivalentes al 2 % del precio de la vivienda, escalados por inflación acumulada.',
            },
            {
                label: 'Gastos de compra',
                desc: 'En el año de compra se contabilizan únicamente en ese período: la entrada (20 % del precio) y otros gastos de compra (impuestos, notaría, registro) fijados en el 10 % del precio.',
                formula: 'GastosCompra = Entrada + 10 % × PrecioVivienda'
            },
        ]
    },
    {
        id: 'familia',
        title: 'Gastos familiares',
        color: '#34d399',
        icon: '👨‍👩‍👧',
        items: [
            {
                label: 'Composición familiar',
                desc: 'La unidad familiar siempre parte de 2 adultos (padres). Hijos en hogar = menores de 23 años. Miembros hogar = padres + hijos en hogar. Alimentación, ocio y vestimenta se multiplican por miembros hogar; otros gastos hijos solo por hijos en hogar.',
            },
            {
                label: 'Educación',
                desc: 'Se imputa un coste mensual por hijo en hogar (menores de 23 años). En modo Simple, el usuario elige colegio público (100 €/mes) o privado (700 €/mes). Con familia numerosa reconocida, se aplican descuentos automáticos.',
                formula: 'Educ(t) = Coste/hijo × HijosEnColegio(t) − Descuento(t)'
            },
            {
                label: 'Descuentos familia numerosa',
                desc: 'Con 2 hijos en hogar: −15 % en el coste de un hijo. Con 3: −15 % + −50 %. Con 4 o más: además el 4.º y sucesivos van gratuitos. Solo aplica si se activa la opción de descuentos.',
            },
            {
                label: 'Gasto familiar total ajustado',
                desc: 'El total de gastos familiares (educación + alimentación + ocio + vestimenta + otros) se multiplica por el factor de inflación acumulada para expresarlo en euros corrientes del año t.',
                formula: 'GastoFamiliaInf(t) = GastoFamilia(t) × (1 + InflAcum(t))'
            },
        ]
    },
    {
        id: 'pyg',
        title: 'Pérdidas y Ganancias (P&G)',
        color: '#a78bfa',
        icon: '💰',
        items: [
            {
                label: 'Ingresos brutos',
                desc: 'Los ingresos brutos nominales siguen una curva lineal entre el valor en Y0 (hoy) y el valor en Y15 (año 15), donde se supone que se ha alcanzado el pico salarial y los ingresos se estabilizan.',
                formula: 'IngBruto(t) = Y0 + t × (Y15 − Y0) / 15,   para t < 15\nIngBruto(t) = Y15,   para t ≥ 15'
            },
            {
                label: 'Ingresos reales',
                desc: 'Los ingresos brutos nominales se escalan por la inflación acumulada para calcular el poder adquisitivo equivalente en cada año.',
                formula: 'IngBrutoReal(t) = IngBrutoNominal(t) × (1 + InflAcum(t))'
            },
            {
                label: 'Impuestos y neto',
                desc: 'La tasa impositiva se calcula a partir de la comunidad autónoma seleccionada, aplicando el IRPF progresivo (tramos estatales + autonómicos) y la Seguridad Social del trabajador sobre los ingresos brutos de cada año (mismo motor que la calculadora de nómina). Como el salario varía a lo largo de la vida, la tasa efectiva cambia cada año. Tras la jubilación, los ingresos del trabajo pasan a cero.',
                formula: 'TasaImpositiva(t) = (IRPF(t) + SS_trabajador(t)) / IngBruto(t)\nIngNeto(t) = IngBrutoReal(t) × (1 − TasaImpositiva(t))'
            },
            {
                label: 'Resultado neto del año',
                desc: 'Es el balance anual: ingresos netos menos gastos totales (familia + vivienda). Un resultado positivo genera ahorro; uno negativo implica consumir de las inversiones. Las ayudas puntuales (entrada vivienda) se suman en el año correspondiente.',
                formula: 'Resultado(t) = IngNeto(t) + GastosTotales(t) + Ayudas(t)'
            },
        ]
    },
    {
        id: 'patrimonio',
        title: 'Inversiones y Patrimonio',
        color: '#fb923c',
        icon: '📊',
        items: [
            {
                label: 'Cartera de inversión',
                desc: 'Todo el superávit anual (resultado positivo) se destina a fondos de inversión, excepto un mínimo de liquidez reservado en cuenta corriente (por defecto 5 k€ por año). La cartera crece con la TIR de ahorros (por defecto 9 % anual).',
                formula: 'FondosEoP(t) = FondosBoP(t) + Suscripciones(t) + Reembolsos(t) + Interés(t)'
            },
            {
                label: 'Cobertura de déficits',
                desc: 'En años con resultado negativo, el déficit se cubre vendiendo fondos. Se aplica un 5 % de impuestos sobre la ganancia realizada al reembolsar. Si los fondos disponibles no son suficientes, la posición colapsa a cero.',
                formula: 'Reembolso(t) = max(Déficit × 1.05, −FondosBoP(t))'
            },
            {
                label: 'Fondos en valor real',
                desc: 'Los fondos al final de cada año se deflactan por la inflación acumulada para expresar su valor en poder adquisitivo constante del año 2026.',
                formula: 'FondosReal(t) = FondosEoP(t) / (1 + InflAcum(t))'
            },
            {
                label: 'Patrimonio real total',
                desc: 'Es la suma del valor real de los fondos de inversión, el valor de mercado neto de la vivienda (ajustado por la revalorización inmobiliaria) y el efectivo líquido mínimo, todos en términos reales.',
                formula: 'PatrimonioReal(t) = FondosReal(t) + PatrimInmoReal(t) + Líquido(t) / (1 + InflAcum(t))'
            },
        ]
    },
    {
        id: 'viabilidad',
        title: 'Viabilidad y Jubilación Mínima',
        color: '#f43f5e',
        icon: '✅',
        items: [
            {
                label: 'Check de viabilidad',
                desc: 'La simulación se considera "Viable" si en todos y cada uno de los 60 periodos la cartera de inversión tiene saldo suficiente para cubrir el déficit requerido. En cuanto se detecta un año sin fondos suficientes, la proyección colapsa y se marca como "No Viable".',
            },
            {
                label: 'Año mínimo de jubilación',
                desc: 'El simulador barre todos los años posibles de jubilación (desde hoy hasta la esperanza de vida) y selecciona el primero para el cual la proyección es viable Y el patrimonio real en el año de la esperanza de vida supera la herencia deseada (en valor real, mismo año base). Si no existe ningún año válido devuelve N/A.',
                formula: 'Viable si: PatrimonioReal(T_final) > Herencia (ambos en k€ reales)\n           y is_possible = true para ese año de jubilación'
            },
        ]
    },
];

function MetodologiaPanel() {
    const [open, setOpen] = useState(false);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

    const toggleSection = (id: string) =>
        setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <div className="col-span-1 lg:col-span-12">
            {/* Header toggle */}
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 rounded-xl border border-white/10 bg-neutral-900/60 hover:bg-white/5 transition-all group backdrop-blur-sm"
            >
                <div className="flex items-center gap-3">
                    <BookOpen size={18} className="text-neutral-400 group-hover:text-white transition-colors" />
                    <span className="font-mono text-sm uppercase tracking-widest text-neutral-300 group-hover:text-white transition-colors">
                        Metodología del simulador
                    </span>
                    <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider border border-white/10 px-2 py-0.5 rounded-full">
                        {METOD_SECTIONS.length} secciones
                    </span>
                </div>
                <div className="flex items-center gap-2 text-neutral-500 group-hover:text-white transition-colors">
                    <span className="text-[10px] font-mono uppercase tracking-wider">{open ? 'Ocultar' : 'Ver detalle'}</span>
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
            </button>

            {open && (
                <div className="mt-4 rounded-xl border border-white/10 bg-neutral-950/80 backdrop-blur-sm overflow-hidden">
                    {/* Panel header */}
                    <div className="px-6 py-5 border-b border-white/5 flex items-start gap-4">
                        <Info size={16} className="text-neutral-500 mt-0.5 shrink-0" />
                        <p className="text-neutral-400 text-sm leading-relaxed font-mono">
                            El <span className="text-white">Simulador Vida</span> proyecta la evolución financiera de un hogar a lo largo de 60 años.
                            Los cálculos se articulan en cinco bloques independientes que se encadenan: <span className="text-neutral-200">inflación → vivienda → familia → P&G → inversiones</span>.
                            Todos los valores monetarios se expresan en miles de euros (k€). Los valores «reales» están ajustados a poder adquisitivo constante del año 2026.
                        </p>
                    </div>

                    {/* Sections */}
                    <div className="divide-y divide-white/5">
                        {METOD_SECTIONS.map(section => (
                            <div key={section.id}>
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/3 transition-colors group/sec"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg leading-none">{section.icon}</span>
                                        <span
                                            className="font-mono text-xs uppercase tracking-widest font-bold"
                                            style={{ color: section.color }}
                                        >
                                            {section.title}
                                        </span>
                                        <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-wider">
                                            {section.items.length} concepto{section.items.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <ChevronDown
                                        size={14}
                                        className="text-neutral-600 group-hover/sec:text-neutral-400 transition-all"
                                        style={{ transform: openSections[section.id] ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                                    />
                                </button>

                                {openSections[section.id] && (
                                    <div className="px-6 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {section.items.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="rounded-lg border border-white/5 bg-black/30 p-4 flex flex-col gap-2"
                                                style={{ borderLeftColor: section.color + '60', borderLeftWidth: '2px' }}
                                            >
                                                <span
                                                    className="font-mono text-[10px] uppercase tracking-widest font-bold"
                                                    style={{ color: section.color }}
                                                >
                                                    {item.label}
                                                </span>
                                                <p className="text-neutral-400 text-xs leading-relaxed">
                                                    {item.desc}
                                                </p>
                                                {item.formula && (
                                                    <pre
                                                        className="mt-1 text-[10px] font-mono leading-relaxed px-3 py-2 rounded bg-white/3 border border-white/5 whitespace-pre-wrap"
                                                        style={{ color: section.color + 'cc' }}
                                                    >
                                                        {item.formula}
                                                    </pre>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-white/5 flex items-center gap-2">
                        <span className="text-[10px] font-mono text-neutral-700 uppercase tracking-wider">
                            Premisas clave: inflación constante · tasa impositiva por comunidad autónoma (IRPF + SS) · TIR de inversiones constante · hipoteca a tipo fijo · todos los valores en k€
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

function CalculadoraJubilacionPanel({ baseInputs }: { baseInputs: InputsModeloVida }) {
    const [esperanzaVida, setEsperanzaVida] = useState<number | string>(2080);
    const [herenciaDeseada, setHerenciaDeseada] = useState<number | string>(350);

    const result = useMemo(() => {
        let bestYear: number | null = null;
        let finalPatrimonio = 0;
        let finalHerenciaTarget = 0;

        let espVidaNum = typeof esperanzaVida === 'number' ? esperanzaVida : parseInt(esperanzaVida) || 0;
        let herenciaNum = typeof herenciaDeseada === 'number' ? herenciaDeseada : parseFloat(herenciaDeseada) || 0;

        const initial_period = 2026;
        const max_t = 59;
        let t_final = espVidaNum - initial_period;
        if (t_final < 0) t_final = 0;
        if (t_final > max_t) t_final = max_t;

        for (let j = 2026; j <= espVidaNum; j++) {
            const tryInputs = { ...baseInputs, year_jubilacion: j };
            const model = runModeloVida(tryInputs);

            const inflacionAcumulada = model.inflaccion_acumulada[t_final];
            const herenciaTarget = herenciaNum * (1 + inflacionAcumulada);
            const patrimonioReal = model.arr_patrimonio_real[t_final];

            if (model.is_possible && patrimonioReal >= herenciaTarget) {
                bestYear = j;
                finalPatrimonio = patrimonioReal;
                finalHerenciaTarget = herenciaTarget;
                break;
            }
        }

        return { bestYear, finalPatrimonio, finalHerenciaTarget };
    }, [baseInputs, esperanzaVida, herenciaDeseada]);

    return (
        <div className="col-span-1 lg:col-span-12">
            <Card
                className="border-white/20"
                icon={<Calculator size={18} />}
                title="Calculadora Año Mínimo de Jubilación"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-4">
                    <div className="flex flex-col gap-6">
                        <p className="text-sm text-neutral-400 font-mono mb-2">
                            Calcula el primer año en el que te podrías jubilar asegurando la viabilidad del modelo y dejando la herencia deseada.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                                label="Fallecimiento"
                                suffix="Año"
                                value={String(esperanzaVida)}
                                onChange={e => setEsperanzaVida(e.target.value)}
                                tooltip="Año en el que esperas fallecer (para evaluar el patrimonio final)."
                            />
                            <Input
                                label="Herencia"
                                suffix="k€"
                                value={String(herenciaDeseada)}
                                onChange={e => setHerenciaDeseada(e.target.value)}
                                tooltip="Patrimonio que quieres dejar en herencia, en valor actual (hoy)."
                            />
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center bg-black/30 rounded-xl border border-white/5 p-6">
                        {result.bestYear ? (
                            <>
                                <h4 className="text-neutral-500 font-mono text-xs uppercase tracking-widest mb-3">Año mínimo sugerido</h4>
                                <div className="text-5xl font-bold text-white font-mono mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">{result.bestYear}</div>
                                <div className="flex flex-col gap-3 w-full border-t border-white/10 pt-5">
                                    <div className="flex justify-between items-center text-xs font-mono">
                                        <span className="text-neutral-400 uppercase tracking-wider">Patrimonio final (ajustado):</span>
                                        <span className="text-white font-bold">{formatCurrency(result.finalPatrimonio)} k€</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs font-mono">
                                        <span className="text-neutral-400 uppercase tracking-wider">Herencia objetivo (ajustada):</span>
                                        <span className="text-white font-bold">{formatCurrency(result.finalHerenciaTarget)} k€</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-6">
                                <div className="text-2xl font-bold text-red-500 font-mono mb-3">No Viable</div>
                                <div className="text-xs text-neutral-500 font-mono max-w-[250px] leading-relaxed mx-auto">
                                    Con los parámetros actuales, no existe ningún año de jubilación que cumpla los requisitos de viabilidad y herencia.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}

function CalculadoraViviendaPanel({ baseInputs }: { baseInputs: InputsModeloVida }) {
    const [modo, setModo] = useState<'compra' | 'alquiler'>('compra');
    const [yearCompra, setYearCompra] = useState<number | string>(baseInputs.year_compra_vivienda);
    const [ayudaEntrada, setAyudaEntrada] = useState<number | string>(baseInputs.ayuda_entrada || 0);
    const [yearJubilacion, setYearJubilacion] = useState<number | string>(baseInputs.year_jubilacion ?? 2065);
    const [yearFallecimiento, setYearFallecimiento] = useState<number | string>(2080);
    const [herenciaDeseada, setHerenciaDeseada] = useState<number | string>(800);

    const result = useMemo(() => {
        let maxAffordable: number | null = null;

        let yearCompraNum = typeof yearCompra === 'number' ? yearCompra : parseInt(yearCompra) || 2032;
        let ayudaNum = typeof ayudaEntrada === 'number' ? ayudaEntrada : parseFloat(ayudaEntrada) || 0;
        let yearJubNum = typeof yearJubilacion === 'number' ? yearJubilacion : parseInt(yearJubilacion) || 2065;
        let yearFallNum = typeof yearFallecimiento === 'number' ? yearFallecimiento : parseInt(yearFallecimiento) || 2080;
        let herenciaNum = typeof herenciaDeseada === 'number' ? herenciaDeseada : parseFloat(herenciaDeseada) || 0;

        const initial_period = 2026;
        const max_t = 59;
        let t_final = yearFallNum - initial_period;
        if (t_final < 0) t_final = 0;
        if (t_final > max_t) t_final = max_t;

        const isViableConHerencia = (model: ReturnType<typeof runModeloVida>) => {
            if (!model.is_possible) return false;
            const inflacionAcumulada = model.inflaccion_acumulada[t_final];
            const herenciaTarget = herenciaNum * (1 + inflacionAcumulada);
            const patrimonioReal = model.arr_patrimonio_real[t_final];
            return patrimonioReal >= herenciaTarget;
        };

        if (modo === 'compra') {
            for (let p = 0; p <= 3000; p += 10) {
                const tryInputs = {
                    ...baseInputs,
                    year_compra_vivienda: yearCompraNum,
                    ayuda_entrada: ayudaNum,
                    year_jubilacion: yearJubNum,
                    precio_vivienda: p
                };
                const model = runModeloVida(tryInputs);
                if (isViableConHerencia(model)) {
                    maxAffordable = p;
                } else {
                    break;
                }
            }
        } else {
            for (let a = 0; a <= 15000; a += 50) {
                const tryInputs = {
                    ...baseInputs,
                    year_compra_vivienda: 3000,
                    ayuda_entrada: 0,
                    year_jubilacion: yearJubNum,
                    alquiler_mensual: a
                };
                const model = runModeloVida(tryInputs);
                if (isViableConHerencia(model)) {
                    maxAffordable = a;
                } else {
                    break;
                }
            }
        }

        return { maxAffordable };
    }, [baseInputs, modo, yearCompra, ayudaEntrada, yearJubilacion, yearFallecimiento, herenciaDeseada]);

    return (
        <div className="col-span-1 lg:col-span-12">
            <Card
                className="border-white/20"
                icon={<Calculator size={18} />}
                title="Calculadora Vivienda (Máximo Asequible)"
                headerAside={
                    <div className="flex bg-neutral-900/50 rounded p-0.5 border border-white/5">
                        <button
                            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-colors ${modo === 'compra' ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-white'}`}
                            onClick={() => setModo('compra')}
                        >
                            Compra
                        </button>
                        <button
                            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-colors ${modo === 'alquiler' ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-white'}`}
                            onClick={() => setModo('alquiler')}
                        >
                            Alquiler
                        </button>
                    </div>
                }
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-4">
                    <div className="flex flex-col gap-6">
                        <p className="text-sm text-neutral-400 font-mono mb-2">
                            {modo === 'compra'
                                ? 'Calcula el precio máximo de vivienda que te puedes permitir comprar en el año indicado, asegurando viabilidad y la herencia deseada al año de fallecimiento.'
                                : 'Calcula el alquiler mensual máximo que te puedes permitir pagar durante toda la simulación (asumiendo que nunca se compra), asegurando viabilidad y la herencia deseada.'}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {modo === 'compra' && (
                                <>
                                    <Input
                                        label="Año Compra"
                                        value={String(yearCompra)}
                                        onChange={e => setYearCompra(e.target.value)}
                                        tooltip="Año en el que se realizará la compra de la vivienda."
                                    />
                                    <Input
                                        label="Ayuda Entrada"
                                        suffix="k€"
                                        value={String(ayudaEntrada)}
                                        onChange={e => setAyudaEntrada(e.target.value)}
                                        tooltip="Ayuda financiera extra recibida en el momento de la compra."
                                    />
                                </>
                            )}
                            <Input
                                label="Año Jubilación"
                                suffix="Año"
                                value={String(yearJubilacion)}
                                onChange={e => setYearJubilacion(e.target.value)}
                                tooltip="Año previsto de jubilación. A partir de este año los ingresos del trabajo pasan a cero."
                            />
                            <Input
                                label="Fallecimiento"
                                suffix="Año"
                                value={String(yearFallecimiento)}
                                onChange={e => setYearFallecimiento(e.target.value)}
                                tooltip="Año en el que esperas fallecer (para evaluar el patrimonio final y la herencia)."
                            />
                            <Input
                                label="Herencia"
                                suffix="k€"
                                value={String(herenciaDeseada)}
                                onChange={e => setHerenciaDeseada(e.target.value)}
                                tooltip="Patrimonio que quieres dejar en herencia, en valor actual (hoy). El máximo asequible garantiza alcanzar al menos este patrimonio real al año de fallecimiento."
                            />
                        </div>
                        {modo === 'alquiler' && (
                            <div className="text-xs text-neutral-500 font-mono">
                                Modo alquiler permanente: asume que no hay gastos de compra ni ayudas para entrada, y se paga alquiler mensual (ajustado por inflación) hasta el final del modelo.
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-center justify-center bg-black/30 rounded-xl border border-white/5 p-6">
                        {result.maxAffordable !== null ? (
                            <>
                                <h4 className="text-neutral-500 font-mono text-xs uppercase tracking-widest mb-3">
                                    {modo === 'compra' ? 'Precio máximo (k€)' : 'Alquiler máximo (€/mes)'}
                                </h4>
                                <div className="text-5xl font-bold text-white font-mono mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                                    {modo === 'compra'
                                        ? formatCurrency(result.maxAffordable)
                                        : formatCurrency(result.maxAffordable)}
                                </div>
                                <div className="flex flex-col gap-3 w-full border-t border-white/10 pt-5">
                                    <div className="text-xs text-neutral-400 font-mono text-center">
                                        Mantiene la viabilidad en todos los periodos y alcanza al menos la herencia deseada (en valor real) al año de fallecimiento.
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-6">
                                <div className="text-2xl font-bold text-red-500 font-mono mb-3">No Viable</div>
                                <div className="text-xs text-neutral-500 font-mono max-w-[250px] leading-relaxed mx-auto">
                                    Con los parámetros actuales, el modelo no es viable ni siquiera asumiendo un coste {modo === 'compra' ? 'de vivienda' : 'de alquiler'} de cero. Revisa los gastos base frente a tus ingresos.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}

export default function SimuladorVida() {
    const [inputs, setInputs] = useState<InputsModeloVida>(defaultInputs);
    const [tab, setTab] = useState<'charts' | 'table'>('charts');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ Macro: true, Vivienda: true, Familia: true, 'P&G': true, Patrimonio: true });
    const [dashboardExpanded, setDashboardExpanded] = useState(false);

    const [modoSimple, setModoSimple] = useState(false);
    const [tipoColegio, setTipoColegio] = useState<'publico' | 'privado'>('publico');
    const [gastosHijoMesSimple, setGastosHijoMesSimple] = useState(460); // 160 + 50 + 50 + 200

    // Income table for detailed mode: rows of { year, ingresos } as strings
    const currentYear = 2026;
    const [ingresosTabla, setIngresosTabla] = useState<{ year: string; ingresos: string }[]>([
        { year: String(currentYear), ingresos: String(defaultInputs.ingresos_trabajo_brutos_y0) },
        { year: String(currentYear + 15), ingresos: String(defaultInputs.ingresos_trabajo_brutos_y15) },
    ]);
    const [newIngresosRow, setNewIngresosRow] = useState<{ year: string; ingresos: string }>({ year: '', ingresos: '' });

    const updateIngresosRow = (index: number, field: 'year' | 'ingresos', value: string) => {
        setIngresosTabla(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const removeIngresosRow = (index: number) => {
        setIngresosTabla(prev => prev.filter((_, i) => i !== index));
    };

    const commitNewIngresosRow = () => {
        const y = parseInt(newIngresosRow.year);
        const v = parseFloat(newIngresosRow.ingresos);
        if (!isNaN(y) && !isNaN(v)) {
            setIngresosTabla(prev => [...prev, { year: newIngresosRow.year, ingresos: newIngresosRow.ingresos }]);
            setNewIngresosRow({ year: '', ingresos: '' });
        }
    };

    // Build the ingresos_tabla for the model (only valid, complete rows)
    const ingresosTablaForModel = ingresosTabla
        .map(r => ({ year: parseInt(r.year), ingresos: parseFloat(r.ingresos) }))
        .filter(r => !isNaN(r.year) && !isNaN(r.ingresos));

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof InputsModeloVida) => {
        let val: any = parseFloat(e.target.value);
        setInputs({ ...inputs, [field]: isNaN(val) ? 0 : val });
    };

    const addChildYear = (year: number) => {
        setInputs({ ...inputs, nacimiento_hijos: [...inputs.nacimiento_hijos, year].sort((a, b) => a - b) });
    };

    // Commit a child birth year from the "add" input. Used by both Enter (desktop) and blur
    // (mobile, where soft keyboards often don't fire a reliable Enter keydown event).
    const commitChildYearFromInput = (el: HTMLInputElement) => {
        const val = parseInt(el.value, 10);
        if (!isNaN(val) && val > 1900 && val < 2100) {
            addChildYear(val);
            el.value = '';
        }
    };

    const removeChildYear = (index: number) => {
        const newHijos = [...inputs.nacimiento_hijos];
        newHijos.splice(index, 1);
        setInputs({ ...inputs, nacimiento_hijos: newHijos });
    };

    const effectiveInputs = useMemo(() => {
        if (modoSimple) {
            return {
                ...inputs,
                ingresos_tabla: undefined,
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
        }
        // Detailed mode: use the income table
        return {
            ...inputs,
            ingresos_tabla: ingresosTablaForModel.length > 0 ? ingresosTablaForModel : undefined,
        };
    }, [inputs, modoSimple, gastosHijoMesSimple, tipoColegio, ingresosTablaForModel]);

    const modelResult = useMemo(() => runModeloVida(effectiveInputs), [effectiveInputs]);

    const chartData = useMemo(() => {
        // Escenario alquiler: mismos inputs que la tabla salvo year_compra_vivienda = 3000 (nunca comprar, solo alquilar)
        const inputs_alquiler = { ...effectiveInputs, year_compra_vivienda: 3000 };
        const modelAlquiler = runModeloVida(inputs_alquiler);

        return Array.from({ length: modelResult.periods }).map((_, i) => ({
            year: modelResult.getPeriod(i),
            fondos: modelResult.arr_fondos_real[i],
            patrimonio: modelResult.arr_patrimonio_real[i],
            resultado: modelResult.arr_resultado_neto[i],
            gastosFamiliaNominal: modelResult.arr_total_familia_inf[i],
            gastosViviendaNominal: modelResult.arr_gastos_vivienda_nominal[i],
            ingresosNetos: modelResult.arr_ingresos_netos[i],
            ingresosNominal: modelResult.arr_ingresos_brutos_nominal[i],
            ingresosReal: modelResult.arr_ingresos_brutos_real[i],
            fondosAlquiler: modelAlquiler.arr_fondos_real[i],
            patrimonioAlquiler: modelAlquiler.arr_patrimonio_real[i],
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
                        <div className="flex flex-col gap-6 mt-4 flex-1 overflow-y-auto pr-2 custom-scrollbar overflow-x-visible pt-8 pb-32">
                            <div className="space-y-4">
                                <h3 className="text-neutral-400 font-mono text-[10px] uppercase tracking-widest border-b border-white/5 pb-1">
                                    {modoSimple ? 'Ingresos' : (
                                        <Tooltip text="Define la evolución de los ingresos brutos por años. Cada fila es un punto (año, importe en k€). Entre puntos se interpola linealmente; después del último año se mantiene constante hasta la jubilación.">
                                            <span className="cursor-help">Ingresos</span>
                                        </Tooltip>
                                    )}
                                </h3>
                                {modoSimple ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input label="Ingresos Y0" suffix="k€" value={formatInput(inputs.ingresos_trabajo_brutos_y0)} onChange={e => handleInputChange(e, 'ingresos_trabajo_brutos_y0')} tooltip="Ingresos totales brutos del hogar en el primer año (salarios nominales)." />
                                        <Input label="Ingresos Y15" suffix="k€" value={formatInput(inputs.ingresos_trabajo_brutos_y15)} onChange={e => handleInputChange(e, 'ingresos_trabajo_brutos_y15')} tooltip="Ingresos totales brutos estimados del hogar en el año 15 (salarios nominales)." />
                                        <Input label="Año Jubilac." value={formatInput(inputs.year_jubilacion!)} onChange={e => handleInputChange(e, 'year_jubilacion')} tooltip="Año previsto de jubilación. A partir de este año los ingresos del trabajo pasan a ser cero." />
                                        <div className="col-span-2">
                                            <Select label="Comunidad" value={inputs.regime_id ?? DEFAULT_REGIME_ID} options={REGIME_OPTIONS} onChange={id => setInputs({ ...inputs, regime_id: id })} id="regime-simple" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {/* Header */}
                                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1">
                                            <Tooltip text="Año de referencia para este punto de la curva. Entre dos años consecutivos el modelo interpola linealmente los ingresos.">
                                                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 cursor-help">Año</span>
                                            </Tooltip>
                                            <Tooltip text="Ingresos totales brutos del hogar en miles de euros (antes de impuestos), en valor nominal para ese año. Incluye todos los salarios del hogar.">
                                                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 cursor-help">Ingresos brutos (k€)</span>
                                            </Tooltip>
                                            <span className="w-5" />
                                        </div>
                                        {/* Existing rows */}
                                        {ingresosTabla.map((row, idx) => (
                                            <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                                                <input
                                                    type="number"
                                                    value={row.year}
                                                    onChange={e => updateIngresosRow(idx, 'year', e.target.value)}
                                                    placeholder="Año"
                                                    className="w-full bg-neutral-900/60 border border-neutral-700 hover:border-neutral-500 focus:border-white/40 outline-none rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-neutral-600 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                                <input
                                                    type="number"
                                                    value={row.ingresos}
                                                    onChange={e => updateIngresosRow(idx, 'ingresos', e.target.value)}
                                                    placeholder="k€"
                                                    className="w-full bg-neutral-900/60 border border-neutral-700 hover:border-neutral-500 focus:border-white/40 outline-none rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-neutral-600 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                                <button
                                                    onClick={() => removeIngresosRow(idx)}
                                                    className="w-5 h-5 flex items-center justify-center text-neutral-600 hover:text-red-400 transition-colors font-mono text-base leading-none"
                                                    aria-label="Eliminar fila"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                        {/* Empty row for adding new entries */}
                                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center opacity-50 focus-within:opacity-100 transition-opacity">
                                            <input
                                                type="number"
                                                value={newIngresosRow.year}
                                                onChange={e => setNewIngresosRow(r => ({ ...r, year: e.target.value }))}
                                                placeholder="Año"
                                                className="w-full bg-neutral-900/40 border border-dashed border-neutral-700 hover:border-neutral-500 focus:border-white/40 focus:bg-neutral-900/60 outline-none rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-neutral-600 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                onKeyDown={e => { if (e.key === 'Enter') commitNewIngresosRow(); }}
                                            />
                                            <input
                                                type="number"
                                                value={newIngresosRow.ingresos}
                                                onChange={e => setNewIngresosRow(r => ({ ...r, ingresos: e.target.value }))}
                                                placeholder="k€"
                                                className="w-full bg-neutral-900/40 border border-dashed border-neutral-700 hover:border-neutral-500 focus:border-white/40 focus:bg-neutral-900/60 outline-none rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-neutral-600 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                onKeyDown={e => { if (e.key === 'Enter') commitNewIngresosRow(); }}
                                                onBlur={commitNewIngresosRow}
                                            />
                                            <span className="w-5" />
                                        </div>
                                        <p className="text-[10px] font-mono text-neutral-600 pl-1 mt-0.5">
                                            Interpolación lineal entre puntos · Extrapolación constante más allá del último
                                        </p>
                                        {/* Comunidad autónoma (drives IRPF + SS), salary growth and retirement year */}
                                        <div className="mt-1">
                                            <Select label="Comunidad" value={inputs.regime_id ?? DEFAULT_REGIME_ID} options={REGIME_OPTIONS} onChange={id => setInputs({ ...inputs, regime_id: id })} id="regime-detallado" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 items-end">
                                            <PercentInput label="Crec.Sal" value={inputs.crecimiento_salario ?? 0} onCommit={v => setInputs({ ...inputs, crecimiento_salario: v })} tooltip="Tasa de crecimiento anual nominal del salario bruto. Por defecto igual a la inflación. Determina cómo aumentan los ingresos reales año a año." />
                                            <Input label="Año Jubilac." value={formatInput(inputs.year_jubilacion!)} onChange={e => handleInputChange(e, 'year_jubilacion')} tooltip="Año previsto de jubilación. A partir de este año los ingresos del trabajo pasan a ser cero." />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-neutral-400 font-mono text-[10px] uppercase tracking-widest border-b border-white/5 pb-1">Vivienda</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {!modoSimple && <Input label="Alquiler" suffix="€/mes" value={formatInput(inputs.alquiler_mensual)} onChange={e => handleInputChange(e, 'alquiler_mensual')} tooltip="Gasto mensual de alquiler hasta el año de compra de la vivienda." />}
                                    <Input label="Año Indep." value={formatInput(inputs.year_indepen)} onChange={e => handleInputChange(e, 'year_indepen')} tooltip="Año en el que se empieza a incurrir en gastos de vivienda (alquiler o compra)." />
                                    <Input label="Precio" suffix="k€" value={formatInput(inputs.precio_vivienda)} onChange={e => handleInputChange(e, 'precio_vivienda')} tooltip="Precio de compra de la vivienda en el año seleccionado." />
                                    <Input label="Año Compra" value={formatInput(inputs.year_compra_vivienda)} onChange={e => handleInputChange(e, 'year_compra_vivienda')} tooltip="Año en el que se compra la vivienda y empieza la hipoteca." />
                                    {!modoSimple && (
                                        <>
                                            <Input label="Años Hipoteca" value={formatInput(inputs.years_hipoteca)} onChange={e => handleInputChange(e, 'years_hipoteca')} tooltip="Duración total del préstamo hipotecario en años." />
                                            <PercentInput label="TIN" value={inputs.tin_hipoteca} onCommit={v => setInputs({ ...inputs, tin_hipoteca: v })} tooltip="Tipo de Interés Nominal de la hipoteca." />
                                            <PercentInput label="Entrada" value={inputs.porcentaje_entrada_vivienda ?? 0} onCommit={v => setInputs({ ...inputs, porcentaje_entrada_vivienda: v })} tooltip="Porcentaje del precio de la vivienda que se aporta como entrada inicial." />
                                            <PercentInput label="Gastos" value={inputs.porcentaje_gastos_fijos_vivienda ?? 0} onCommit={v => setInputs({ ...inputs, porcentaje_gastos_fijos_vivienda: v })} tooltip="Gastos anuales fijos del inmueble (IBI, comunidad, mantenimiento) como % del precio." />
                                        </>
                                    )}
                                    <div className="col-span-2">
                                        <Input label="Ayuda Entrada" suffix="k€" value={formatInput(inputs.ayuda_entrada!)} onChange={e => handleInputChange(e, 'ayuda_entrada')} tooltip="Ayuda financiera puntual recibida en el momento de la compra de la vivienda." />
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
                                                enterKeyHint="done"
                                                placeholder="Añadir año..."
                                                className="bg-transparent border-none outline-none text-xs font-mono text-white placeholder-neutral-600 w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        commitChildYearFromInput(e.target as HTMLInputElement);
                                                    }
                                                }}
                                                onBlur={(e) => commitChildYearFromInput(e.target)}
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
                                                <Input label="Gastos/Hijo" suffix="€/mes" value={formatInput(gastosHijoMesSimple)} onChange={e => {
                                                    const v = parseFloat(e.target.value);
                                                    if (!isNaN(v)) setGastosHijoMesSimple(v);
                                                }} tooltip="Gasto mensual estimado por cada hijo excluyendo educación (alimentación, ocio, vestimenta y otros)." />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Input label="Educ." suffix="€/mes" value={formatInput(inputs.coste_educacion_mensual)} onChange={e => handleInputChange(e, 'coste_educacion_mensual')} tooltip="Coste mensual de educación o colegio por cada hijo." />
                                            <div className="flex flex-col gap-2 w-full">
                                                <div className="flex items-center pl-1 min-h-[16px]">
                                                    <Tooltip text="Aplica reducciones por familia numerosa (2 hijos: -15%, 3 hijos: -50%, 4+: gratis).">
                                                        <label className="text-xs uppercase tracking-widest text-neutral-500 font-mono">Descuentos</label>
                                                    </Tooltip>
                                                </div>
                                                <div className="flex bg-neutral-900/50 rounded-lg p-1 border border-neutral-800 h-[46px] relative group overflow-hidden">
                                                    <button
                                                        className={`flex-1 text-[11px] font-mono uppercase tracking-widest rounded transition-all duration-300 z-10 ${!inputs.descuentos_educacion ? 'bg-white/10 text-white shadow-lg shadow-black/50' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
                                                        onClick={() => setInputs({ ...inputs, descuentos_educacion: false })}
                                                    >
                                                        No
                                                    </button>
                                                    <button
                                                        className={`flex-1 text-[11px] font-mono uppercase tracking-widest rounded transition-all duration-300 z-10 ${inputs.descuentos_educacion ? 'bg-white/10 text-white shadow-lg shadow-black/50' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
                                                        onClick={() => setInputs({ ...inputs, descuentos_educacion: true })}
                                                    >
                                                        Sí
                                                    </button>
                                                </div>
                                            </div>
                                            <Input label="Alim." suffix="€/mes" value={formatInput(inputs.alimentacion_mensual)} onChange={e => handleInputChange(e, 'alimentacion_mensual')} tooltip="Gasto mensual en alimentación por cada miembro de la familia." />
                                            <Input label="Vest." suffix="€/mes" value={formatInput(inputs.vestimenta_mensual)} onChange={e => handleInputChange(e, 'vestimenta_mensual')} tooltip="Gasto mensual en vestimenta por cada miembro de la familia." />
                                            <Input label="Ocio" suffix="€/mes" value={formatInput(inputs.ocio_mensual)} onChange={e => handleInputChange(e, 'ocio_mensual')} tooltip="Gasto mensual en ocio por cada miembro de la familia." />
                                            <Input label="Otros" suffix="€/mes" value={formatInput(inputs.otros_gastos_mensuales)} onChange={e => handleInputChange(e, 'otros_gastos_mensuales')} tooltip="Otros gastos mensuales diversos no categorizados." />
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-neutral-400 font-mono text-[10px] uppercase tracking-widest border-b border-white/5 pb-1">Patrimonio</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="Capital" suffix="k€" value={formatInput(inputs.capital_inicial!)} onChange={e => handleInputChange(e, 'capital_inicial')} tooltip="Capital o ahorros líquidos iniciales al comienzo de la simulación." />
                                    <PercentInput label="TIR" value={inputs.tir_ahorros ?? 0} onCommit={v => setInputs({ ...inputs, tir_ahorros: v })} tooltip="Rentabilidad anual esperada de los ahorros e inversiones líquidas." />
                                    <PercentInput label="TIR Inmo." value={inputs.tir_inmobiliaria ?? 0} onCommit={v => setInputs({ ...inputs, tir_inmobiliaria: v })} tooltip="Tasa de revalorización anual esperada del precio de la vivienda." />
                                    <PercentInput label="Inflacción" value={inputs.inflaccion ?? 0} onCommit={v => setInputs({ ...inputs, inflaccion: v })} tooltip="Tasa de inflación anual prevista para el ajuste de precios y valores reales." />
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
                        headerAside={
                            <div className="flex items-center gap-2">
                                <Tooltip
                                    text={modelResult.is_possible
                                        ? 'Proyección viable: los fondos son suficientes para cubrir todos los gastos en todos los periodos de la simulación.'
                                        : 'Proyección no viable: en al menos un periodo los fondos disponibles no son suficientes para cubrir el déficit. Los fondos y el patrimonio colapsan a 0 desde ese punto.'}
                                >
                                    <div
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full border font-mono text-[10px] uppercase tracking-widest font-bold transition-all cursor-help ${modelResult.is_possible
                                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                                            }`}
                                    >
                                        <span
                                            className={`w-1.5 h-1.5 rounded-full animate-pulse ${modelResult.is_possible ? 'bg-green-400' : 'bg-red-400'
                                                }`}
                                        />
                                        {modelResult.is_possible ? 'Viable' : 'No Viable'}
                                    </div>
                                </Tooltip>
                                <button
                                    onClick={() => setDashboardExpanded(e => !e)}
                                    className="p-1.5 rounded-lg border border-white/10 text-neutral-500 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all"
                                    aria-label={dashboardExpanded ? 'Contraer dashboard' : 'Expandir dashboard a pantalla completa'}
                                    title={dashboardExpanded ? 'Contraer' : 'Pantalla completa'}
                                >
                                    <Maximize2 size={13} />
                                </button>
                            </div>
                        }
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
                                        <h3 className="text-white font-mono text-sm mb-4">Gastos, Ingresos y Resultado</h3>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                                <XAxis dataKey="year" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'monospace' }} />
                                                <YAxis yAxisId="left" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'monospace' }} />
                                                <YAxis yAxisId="right" orientation="right" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'monospace' }} />
                                                <RechartsTooltip content={<CustomChartTooltip />} />
                                                <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: 10, paddingTop: 10 }} />
                                                <Bar yAxisId="right" dataKey="resultado" name="Resultado (neto)" barSize={20}>
                                                    {chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.resultado >= 0 ? '#4ade80' : '#f87171'} fillOpacity={0.3} />
                                                    ))}
                                                </Bar>
                                                <Line yAxisId="left" type="monotone" dataKey="gastosFamiliaNominal" name="Gastos familia (nominal)" stroke="#555555" strokeWidth={2} dot={false} />
                                                <Line yAxisId="left" type="monotone" dataKey="gastosViviendaNominal" name="Gastos vivienda (nominal)" stroke="#888888" strokeWidth={2} dot={false} />
                                                <Line yAxisId="left" type="monotone" dataKey="ingresosNominal" name="Ingresos brutos (nominal)" stroke="#bbbbbb" strokeWidth={2} dot={false} />
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
                                                <RechartsTooltip content={<CustomChartTooltip />} />
                                                <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: 10, paddingTop: 10 }} />
                                                <Line type="monotone" dataKey="fondos" name="Fondos (real) (Compra)" stroke="#666666" strokeWidth={2} dot={false} legendType="line" />
                                                <Line type="monotone" dataKey="patrimonio" name="Patrimonio (real) (Compra)" stroke="#ffffff" strokeWidth={2} dot={false} legendType="line" />
                                                <Line type="monotone" dataKey="fondosAlquiler" name="Fondos (real) (Alquiler)" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} legendType="plainline" />
                                                <Line type="monotone" dataKey="patrimonioAlquiler" name="Patrimonio (real) (Alquiler)" stroke="#cbd5e1" strokeDasharray="5 5" strokeWidth={2} dot={false} legendType="plainline" />
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
                                                        <tr key={name} className={`hover:bg-white/5 group/row relative ${highlight ? 'bg-white/5 font-bold border-y border-white/10' : ''}`}>
                                                            <td className={`p-2 font-mono text-xs whitespace-nowrap sticky left-0 z-20 ${highlight ? 'bg-neutral-800 text-white' : 'bg-black/80 text-neutral-300'}`}>
                                                                <div className="pl-6">
                                                                    {CONCEPT_TOOLTIPS[name] ? (
                                                                        <Tooltip text={CONCEPT_TOOLTIPS[name]}>
                                                                            <span>{name}</span>
                                                                        </Tooltip>
                                                                    ) : (
                                                                        <span>{name}</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            {(values as number[]).map((v: number, i: number) => {
                                                                let displayValue = '';
                                                                let cellColorClass = '';

                                                                if (format === 'percentage') {
                                                                    displayValue = `${(v * 100).toFixed(1)}%`;
                                                                    cellColorClass = v < 0 ? 'text-red-400' : (highlight ? 'text-white' : 'text-neutral-400');
                                                                } else if (format === 'boolean') {
                                                                    const isSi = v > 0.5;
                                                                    displayValue = isSi ? 'SÍ' : 'NO';
                                                                    cellColorClass = isSi ? 'text-green-400' : 'text-red-400';
                                                                } else {
                                                                    const absV = Math.abs(v);
                                                                    if (absV < 0.1) {
                                                                        displayValue = '-';
                                                                    } else {
                                                                        const formatted = formatCurrency(absV);
                                                                        displayValue = v < 0 ? `(${formatted})` : formatted;
                                                                    }
                                                                    cellColorClass = v < 0 ? 'text-red-400' : (highlight ? 'text-white' : 'text-neutral-400');
                                                                }

                                                                return (
                                                                    <td key={i} className={`p-2 font-mono text-xs text-right tabular-nums ${cellColorClass}`}>
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

                {/* FULLSCREEN DASHBOARD OVERLAY */}
                {dashboardExpanded && (
                    <div
                        className="fixed inset-0 z-50 bg-neutral-950/95 backdrop-blur-md flex flex-col p-6 overflow-hidden"
                        style={{ animation: 'fadeIn 0.18s ease' }}
                    >
                        {/* Overlay header */}
                        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <LayoutDashboard size={18} className="text-neutral-400" />
                                <span className="font-mono text-sm uppercase tracking-widest text-white">Dashboard Financiero</span>
                                <div
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full border font-mono text-[10px] uppercase tracking-widest font-bold ${modelResult.is_possible
                                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                                        }`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${modelResult.is_possible ? 'bg-green-400' : 'bg-red-400'}`} />
                                    {modelResult.is_possible ? 'Viable' : 'No Viable'}
                                </div>
                            </div>
                            <button
                                onClick={() => setDashboardExpanded(false)}
                                className="p-2 rounded-lg border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider"
                                aria-label="Cerrar pantalla completa"
                            >
                                <Minimize2 size={13} />
                                <span>Contraer</span>
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-4 mb-4 border-b border-white/10 pb-2 shrink-0">
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

                        {/* Content */}
                        <div className="flex-1 overflow-hidden">
                            {tab === 'charts' ? (
                                <div className="h-full flex flex-col gap-8 overflow-y-auto pr-2 custom-scrollbar">
                                    <div className="h-[45%] min-h-[280px] w-full">
                                        <h3 className="text-white font-mono text-sm mb-4">Gastos, Ingresos y Resultado</h3>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                                <XAxis dataKey="year" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'monospace' }} />
                                                <YAxis yAxisId="left" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'monospace' }} />
                                                <YAxis yAxisId="right" orientation="right" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'monospace' }} />
                                                <RechartsTooltip content={<CustomChartTooltip />} />
                                                <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: 10, paddingTop: 10 }} />
                                                <Bar yAxisId="right" dataKey="resultado" name="Resultado (neto)" barSize={20}>
                                                    {chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.resultado >= 0 ? '#4ade80' : '#f87171'} fillOpacity={0.3} />
                                                    ))}
                                                </Bar>
                                                <Line yAxisId="left" type="monotone" dataKey="gastosFamiliaNominal" name="Gastos familia (nominal)" stroke="#555555" strokeWidth={2} dot={false} />
                                                <Line yAxisId="left" type="monotone" dataKey="gastosViviendaNominal" name="Gastos vivienda (nominal)" stroke="#888888" strokeWidth={2} dot={false} />
                                                <Line yAxisId="left" type="monotone" dataKey="ingresosNominal" name="Ingresos brutos (nominal)" stroke="#bbbbbb" strokeWidth={2} dot={false} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="h-[45%] min-h-[280px] w-full">
                                        <h3 className="text-white font-mono text-sm mb-4">Alquiler vs Comprar</h3>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                                <XAxis dataKey="year" stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'monospace' }} />
                                                <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff50', fontSize: 12, fontFamily: 'monospace' }} />
                                                <RechartsTooltip content={<CustomChartTooltip />} />
                                                <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: 10, paddingTop: 10 }} />
                                                <Line type="monotone" dataKey="fondos" name="Fondos (real) (Compra)" stroke="#666666" strokeWidth={2} dot={false} legendType="line" />
                                                <Line type="monotone" dataKey="patrimonio" name="Patrimonio (real) (Compra)" stroke="#ffffff" strokeWidth={2} dot={false} legendType="line" />
                                                <Line type="monotone" dataKey="fondosAlquiler" name="Fondos (real) (Alquiler)" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} legendType="plainline" />
                                                <Line type="monotone" dataKey="patrimonioAlquiler" name="Patrimonio (real) (Alquiler)" stroke="#cbd5e1" strokeDasharray="5 5" strokeWidth={2} dot={false} legendType="plainline" />
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
                                                        <tr key={name} className={`hover:bg-white/5 group/row relative ${highlight ? 'bg-white/5 font-bold border-y border-white/10' : ''}`}>
                                                            <td className={`p-2 font-mono text-xs whitespace-nowrap sticky left-0 z-20 ${highlight ? 'bg-neutral-800 text-white' : 'bg-black/80 text-neutral-300'}`}>
                                                                <div className="pl-6">
                                                                    {CONCEPT_TOOLTIPS[name] ? (
                                                                        <Tooltip text={CONCEPT_TOOLTIPS[name]}>
                                                                            <span>{name}</span>
                                                                        </Tooltip>
                                                                    ) : (
                                                                        <span>{name}</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            {(values as number[]).map((v: number, i: number) => {
                                                                let displayValue = '';
                                                                let cellColorClass = '';
                                                                if (format === 'percentage') {
                                                                    displayValue = `${(v * 100).toFixed(1)}%`;
                                                                    cellColorClass = v < 0 ? 'text-red-400' : (highlight ? 'text-white' : 'text-neutral-400');
                                                                } else if (format === 'boolean') {
                                                                    const isSi = v > 0.5;
                                                                    displayValue = isSi ? 'SÍ' : 'NO';
                                                                    cellColorClass = isSi ? 'text-green-400' : 'text-red-400';
                                                                } else {
                                                                    const absV = Math.abs(v);
                                                                    if (absV < 0.1) {
                                                                        displayValue = '-';
                                                                    } else {
                                                                        const formatted = formatCurrency(absV);
                                                                        displayValue = v < 0 ? `(${formatted})` : formatted;
                                                                    }
                                                                    cellColorClass = v < 0 ? 'text-red-400' : (highlight ? 'text-white' : 'text-neutral-400');
                                                                }
                                                                return (
                                                                    <td key={i} className={`p-2 font-mono text-xs text-right tabular-nums ${cellColorClass}`}>
                                                                        {displayValue}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        ))}
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* CALCULADORA JUBILACION PANEL */}
                <CalculadoraJubilacionPanel baseInputs={effectiveInputs} />

                {/* CALCULADORA VIVIENDA PANEL */}
                <CalculadoraViviendaPanel baseInputs={effectiveInputs} />

                {/* METODOLOGÍA PANEL */}
                <MetodologiaPanel />
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
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.99); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
        </div>
    );
}
