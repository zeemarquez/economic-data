export interface InputsModeloVida {
    nacimiento_hijos: number[];
    coste_educacion_mensual: number;
    alimentacion_mensual: number;
    ocio_mensual: number;
    vestimenta_mensual: number;
    otros_gastos_mensuales: number;

    alquiler_mensual: number;
    precio_vivienda: number;
    tin_hipoteca: number;
    years_hipoteca: number;

    year_indepen: number;
    year_compra_vivienda: number;
    ingresos_trabajo_brutos_y0: number;
    ingresos_trabajo_brutos_y15: number;
    ingresos_tabla?: { year: number; ingresos: number }[];

    porcentaje_gastos_fijos_vivienda?: number;
    porcentaje_entrada_vivienda?: number;
    inflaccion?: number;
    tir_inmobiliaria?: number;
    capital_inicial?: number;
    tir_ahorros?: number;
    tasa_impositiva_salario?: number;
    year_jubilacion?: number;
    gastos_jubilado?: number;
    ayuda_entrada?: number;
    liquido_minimo?: number;
    descuentos_educacion?: boolean;
    crecimiento_salario?: number;
}

export interface RowMetadata {
    name: string;
    values: number[];
    format?: 'percentage' | 'boolean' | 'currency';
    highlight?: boolean;
    group: string;
}

export function runModeloVida(inputs: InputsModeloVida) {
    const periods = 60;
    const initial_period = 2026;

    // Defaults
    const p_gastos_fijos_vivienda = inputs.porcentaje_gastos_fijos_vivienda ?? 0.02;
    const p_entrada_vivienda = inputs.porcentaje_entrada_vivienda ?? 0.20;
    const inflaccion = inputs.inflaccion ?? 0.03;
    const tir_inmobiliaria = inputs.tir_inmobiliaria ?? 0.02;
    const capital_inicial = inputs.capital_inicial ?? 20;
    const tir_ahorros = inputs.tir_ahorros ?? 0.09;
    const tasa_impositiva_salario = inputs.tasa_impositiva_salario ?? 0.30;
    const year_jubilacion = inputs.year_jubilacion ?? 2065;
    const ayuda_entrada = inputs.ayuda_entrada ?? 0;
    const liquido_minimo = inputs.liquido_minimo ?? 5;
    const descuentos_educacion = inputs.descuentos_educacion ?? true;
    const crecimiento_salario = inputs.crecimiento_salario ?? inflaccion;

    const getPeriod = (t: number) => initial_period + t;

    const makeArr = (fn: (t: number) => number) => {
        const arr = new Array(periods).fill(0);
        for (let t = 0; t < periods; t++) arr[t] = fn(t);
        return arr;
    };

    let inflaccion_arr = makeArr(() => inflaccion);
    let inflaccion_acumulada = new Array(periods).fill(0);
    inflaccion_acumulada[0] = inflaccion_arr[0];
    for (let t = 1; t < periods; t++) {
        inflaccion_acumulada[t] = (1 + inflaccion_arr[t]) * (1 + inflaccion_acumulada[t - 1]) - 1;
    }

    const hipoteca_tin = makeArr(() => inputs.tin_hipoteca);

    const entrada_vivienda = inputs.precio_vivienda * p_entrada_vivienda;
    const prestamo_hipoteca = inputs.precio_vivienda - entrada_vivienda;

    // Prevent division by zero if tin is 0
    let cuota_hipoteca = 0;
    if (inputs.tin_hipoteca > 0) {
        cuota_hipoteca = prestamo_hipoteca * inputs.tin_hipoteca / (1 - Math.pow(1 + inputs.tin_hipoteca, -inputs.years_hipoteca));
    } else if (inputs.years_hipoteca > 0) {
        cuota_hipoteca = prestamo_hipoteca / inputs.years_hipoteca;
    }

    const arr_entrada_hipoteca = makeArr(t => getPeriod(t) === inputs.year_compra_vivienda ? -entrada_vivienda : 0);
    const arr_hipoteca = makeArr(t => (inputs.year_compra_vivienda <= getPeriod(t) && getPeriod(t) < inputs.year_compra_vivienda + inputs.years_hipoteca) ? 1 : 0);

    const arr_hipoteca_bop = new Array(periods).fill(0);
    const arr_hipoteca_interes = new Array(periods).fill(0);
    const arr_hipoteca_cuota = makeArr(t => -cuota_hipoteca * arr_hipoteca[t]);
    const arr_hipoteca_pago_deuda = new Array(periods).fill(0);
    const arr_hipoteca_eop = new Array(periods).fill(0);
    const arr_patrimonio_inmobiliario = new Array(periods).fill(0);

    for (let t = 0; t < periods; t++) {
        if (getPeriod(t) === inputs.year_compra_vivienda) {
            arr_hipoteca_bop[t] = prestamo_hipoteca;
        } else if (getPeriod(t) > inputs.year_compra_vivienda) {
            arr_hipoteca_bop[t] = arr_hipoteca_eop[t - 1];
        } else {
            arr_hipoteca_bop[t] = 0;
        }

        arr_hipoteca_interes[t] = -arr_hipoteca_bop[t] * hipoteca_tin[t];
        arr_hipoteca_pago_deuda[t] = arr_hipoteca_cuota[t] - arr_hipoteca_interes[t];
        arr_hipoteca_eop[t] = Math.max(0, arr_hipoteca_bop[t] + arr_hipoteca_pago_deuda[t]);
        arr_patrimonio_inmobiliario[t] = getPeriod(t) >= inputs.year_compra_vivienda ? inputs.precio_vivienda - arr_hipoteca_eop[t] : 0;
    }

    let vivienda_tir = makeArr(() => tir_inmobiliaria);
    let vivienda_tir_accumulada = new Array(periods).fill(0);
    vivienda_tir_accumulada[0] = vivienda_tir[0];
    for (let t = 1; t < periods; t++) {
        if (getPeriod(t) >= inputs.year_compra_vivienda) {
            vivienda_tir_accumulada[t] = (1 + vivienda_tir[t]) * (1 + vivienda_tir_accumulada[t - 1]) - 1;
        } else {
            vivienda_tir_accumulada[t] = vivienda_tir[0];
        }
    }

    const arr_patrimonio_inmobiliario_real = makeArr(t => arr_patrimonio_inmobiliario[t] * (1 + vivienda_tir_accumulada[t]));

    const arr_gastos_fijos = makeArr(t => getPeriod(t) >= inputs.year_compra_vivienda ? -inputs.precio_vivienda * p_gastos_fijos_vivienda : 0);
    const arr_gastos_fijos_inf = makeArr(t => arr_gastos_fijos[t] * (inflaccion_acumulada[t] + 1));
    const arr_alquiler = makeArr(t => (inputs.year_indepen <= getPeriod(t) && getPeriod(t) < inputs.year_compra_vivienda) ? -inputs.alquiler_mensual * 12 / 1000 : 0);
    const arr_alquiler_inf = makeArr(t => arr_alquiler[t] * (1 + inflaccion_acumulada[t]));

    // inf = ajustado a inflación = real. Nominal = valores base (cuota, gastos fijos, alquiler sin ajustar).
    // Vivienda recurrente nominal = cuota + gastos fijos + alquiler (todo nominal).
    const arr_vivienda_recurrente_nominal = makeArr(t => arr_hipoteca_cuota[t] + arr_gastos_fijos[t] + arr_alquiler[t]);
    // Vivienda recurrente real = cuota (no cambia con inflación) + gastos fijos inf + alquiler inf.
    const arr_vivienda_recurrente_real = makeArr(t => arr_hipoteca_cuota[t] + arr_gastos_fijos_inf[t] + arr_alquiler_inf[t]);

    const arr_otros_gastos_compra = makeArr(t => getPeriod(t) === inputs.year_compra_vivienda ? -inputs.precio_vivienda * 0.10 : 0);
    const arr_vivienda_extra = makeArr(t => arr_entrada_hipoteca[t] + arr_otros_gastos_compra[t]);

    const arr_total_vivienda_nominal = makeArr(t => arr_vivienda_recurrente_nominal[t] + arr_vivienda_extra[t]);
    const arr_total_vivienda_real = makeArr(t => arr_vivienda_recurrente_real[t] + arr_vivienda_extra[t]);

    const arr_independizado = makeArr(t => getPeriod(t) >= inputs.year_indepen ? 1 : 0);
    const arr_padres = makeArr(() => 2);
    const arr_hijos = makeArr(t => inputs.nacimiento_hijos.filter(nacimiento => nacimiento < getPeriod(t)).length);

    const coste_por_hijo = inputs.coste_educacion_mensual * 12 / 1000;
    const arr_educacion_por_hijo = makeArr(() => -coste_por_hijo);

    const arr_hijos_colegio = makeArr(t => {
        return inputs.nacimiento_hijos.filter(nacimiento => {
            const edad = Math.max(0, getPeriod(t) - nacimiento);
            return edad >= 1 && edad <= 23;
        }).length;
    });

    const arr_educacion_descuento = makeArr(t => {
        if (!descuentos_educacion) return 0;
        const hijos_col = arr_hijos_colegio[t];
        if (hijos_col === 0) return 0;
        if (hijos_col === 2) return 0.15 * coste_por_hijo;
        if (hijos_col === 3) return 0.15 * coste_por_hijo + 0.50 * coste_por_hijo;
        if (hijos_col >= 4) return 0.15 * coste_por_hijo + 0.50 * coste_por_hijo + 1.0 * (hijos_col - 3);
        return 0;
    });

    const arr_educacion = makeArr(t => arr_educacion_por_hijo[t] * arr_hijos_colegio[t] + arr_educacion_descuento[t]);
    const arr_alimentacion = makeArr(t => -1 * (arr_padres[t] + arr_hijos[t]) * (inputs.alimentacion_mensual * 12 / 1000) * arr_independizado[t]);
    const arr_ocio = makeArr(t => -1 * (arr_padres[t] + arr_hijos[t]) * (inputs.ocio_mensual * 12 / 1000));
    const arr_vestimenta = makeArr(t => -1 * (arr_padres[t] + arr_hijos[t]) * (inputs.vestimenta_mensual * 12 / 1000));
    const arr_otros_gastos_hijos = makeArr(() => -1 * inputs.otros_gastos_mensuales * 12 / 1000);

    const arr_total_familia = makeArr(t => arr_educacion[t] + arr_alimentacion[t] + arr_ocio[t] + arr_vestimenta[t] + arr_otros_gastos_hijos[t]);
    const arr_total_familia_inf = makeArr(t => arr_total_familia[t] * (1 + inflaccion_acumulada[t]));

    // Salary growth (independent from CPI inflation)
    const arr_crecimiento_salario = makeArr(() => crecimiento_salario);
    const arr_crecimiento_salario_acumulado = new Array(periods).fill(0);
    arr_crecimiento_salario_acumulado[0] = arr_crecimiento_salario[0];
    for (let t = 1; t < periods; t++) {
        arr_crecimiento_salario_acumulado[t] = (1 + arr_crecimiento_salario[t]) * (1 + arr_crecimiento_salario_acumulado[t - 1]) - 1;
    }

    const arr_jubilado = makeArr(t => getPeriod(t) >= year_jubilacion ? 1 : 0);

    const arr_ingresos_brutos_nominal = makeArr(t => {
        const tabla = inputs.ingresos_tabla;
        let raw = 0;
        if (tabla && tabla.length > 0) {
            // Sort points by year
            const pts = [...tabla].sort((a, b) => a.year - b.year);
            const year = getPeriod(t);
            // Before first point: constant extrapolation
            if (year <= pts[0].year) raw = pts[0].ingresos;
            else if (year >= pts[pts.length - 1].year) raw = pts[pts.length - 1].ingresos;
            else {
                for (let i = 0; i < pts.length - 1; i++) {
                    if (year >= pts[i].year && year < pts[i + 1].year) {
                        const frac = (year - pts[i].year) / (pts[i + 1].year - pts[i].year);
                        raw = pts[i].ingresos + frac * (pts[i + 1].ingresos - pts[i].ingresos);
                        break;
                    }
                }
            }
        } else {
            const s0 = inputs.ingresos_trabajo_brutos_y0;
            const s15 = inputs.ingresos_trabajo_brutos_y15;
            raw = t >= 15 ? s15 : s0 + t * (s15 - s0) / 15;
        }
        return raw * (1 - arr_jubilado[t]);
    });
    // Real income uses dedicated salary growth (not general CPI)
    const arr_ingresos_brutos_real = makeArr(t => arr_ingresos_brutos_nominal[t] * (1 + arr_crecimiento_salario_acumulado[t]));
    const arr_ingresos_totales = makeArr(t => arr_ingresos_brutos_real[t] * (1 - arr_jubilado[t]));
    const arr_tasa_impositiva = makeArr(() => tasa_impositiva_salario);
    const arr_ingresos_netos = makeArr(t => arr_ingresos_totales[t] - arr_ingresos_totales[t] * arr_tasa_impositiva[t]);

    const arr_gastos_vivienda_nominal = makeArr(t => arr_total_vivienda_nominal[t]);
    const arr_gastos_vivienda_real = makeArr(t => arr_total_vivienda_real[t]);
    const arr_gastos_totales = makeArr(t => arr_total_familia_inf[t] + arr_gastos_vivienda_real[t]);

    const arr_ayuda_entrada = makeArr(t => getPeriod(t) === inputs.year_compra_vivienda ? ayuda_entrada : 0);

    const arr_resultado_neto = makeArr(t => arr_ingresos_netos[t] + arr_gastos_totales[t] + arr_ayuda_entrada[t]);

    const arr_beneficios_netos = makeArr(t => Math.max(0, arr_resultado_neto[t]));
    const arr_liquido = makeArr(t => Math.min(arr_beneficios_netos[t], liquido_minimo));

    const arr_fondos_eop = new Array(periods).fill(0);
    const arr_fondos_bop = new Array(periods).fill(0);
    const arr_suscripciones = makeArr(t => arr_beneficios_netos[t] - arr_liquido[t]);
    const arr_reembolsos_netos = makeArr(t => Math.min(0, arr_resultado_neto[t]));
    const arr_impuestos_ganancias = makeArr(t => 0.05 * arr_reembolsos_netos[t]);
    const arr_reembolsos = new Array(periods).fill(0);
    const arr_fondos_disponibles = new Array(periods).fill(0);
    const arr_crecimiento = makeArr(() => tir_ahorros);
    const arr_interes = new Array(periods).fill(0);
    const arr_fondos_real = new Array(periods).fill(0);
    const arr_patrimonio_real = new Array(periods).fill(0);

    for (let t = 0; t < periods; t++) {
        if (t === 0) {
            arr_fondos_bop[t] = capital_inicial;
        } else {
            arr_fondos_bop[t] = arr_fondos_eop[t - 1];
        }

        arr_reembolsos[t] = Math.max(arr_reembolsos_netos[t] + arr_impuestos_ganancias[t], -arr_fondos_bop[t]);
        arr_fondos_disponibles[t] = arr_fondos_bop[t] > Math.abs(arr_reembolsos[t]) ? 1 : 0;

        arr_interes[t] = arr_crecimiento[t] * arr_fondos_bop[t];
        arr_fondos_eop[t] = arr_fondos_bop[t] + arr_suscripciones[t] + arr_reembolsos[t] + arr_interes[t];
        arr_fondos_real[t] = arr_fondos_eop[t] / (inflaccion_acumulada[t] + 1);
        arr_patrimonio_real[t] = arr_fondos_real[t] + arr_patrimonio_inmobiliario_real[t] + (arr_liquido[t] / (inflaccion_acumulada[t] + 1));

        // Si los fondos no son suficientes, forzar fondos y patrimonio a 0
        if (!arr_fondos_disponibles[t]) {
            arr_fondos_eop[t] = 0;
            arr_fondos_real[t] = 0;
            arr_patrimonio_real[t] = 0;
        }
    }

    const arr_patrimonio_nominal = makeArr(t => arr_fondos_eop[t] + arr_patrimonio_inmobiliario[t]);

    let is_possible = true;
    for (let t = 0; t < periods; t++) {
        if (!arr_fondos_disponibles[t]) {
            is_possible = false;
            break;
        }
    }

    const tableData: RowMetadata[] = [
        { group: 'Macro', name: 'Inflacción', values: inflaccion_arr, format: 'percentage' },
        { group: 'Macro', name: 'Inflacción acumulada', values: inflaccion_acumulada, format: 'percentage' },
        { group: 'Vivienda', name: 'Hipoteca TIN', values: hipoteca_tin, format: 'percentage' },
        { group: 'Vivienda', name: 'Entrada hipoteca', values: arr_entrada_hipoteca },
        { group: 'Vivienda', name: 'Hipoteca', values: arr_hipoteca, format: 'boolean' },
        { group: 'Vivienda', name: 'Hipoteca BoP', values: arr_hipoteca_bop },
        { group: 'Vivienda', name: 'Hipoteca interes', values: arr_hipoteca_interes },
        { group: 'Vivienda', name: 'Hipoteca cuota', values: arr_hipoteca_cuota },
        { group: 'Vivienda', name: 'Hipoteca pago de deuda', values: arr_hipoteca_pago_deuda },
        { group: 'Vivienda', name: 'Hipoteca EoP', values: arr_hipoteca_eop },
        { group: 'Vivienda', name: 'Patrimonio inmobiliario', values: arr_patrimonio_inmobiliario },
        { group: 'Vivienda', name: 'Vivienda tir', values: vivienda_tir, format: 'percentage' },
        { group: 'Vivienda', name: 'Vivienda tir acumulada', values: vivienda_tir_accumulada, format: 'percentage' },
        { group: 'Vivienda', name: 'Patrimonio inmobiliario real', values: arr_patrimonio_inmobiliario_real },
        { group: 'Vivienda', name: 'Gastos fijos', values: arr_gastos_fijos },
        { group: 'Vivienda', name: 'Gastos fijos inf', values: arr_gastos_fijos_inf },
        { group: 'Vivienda', name: 'Alquiler', values: arr_alquiler },
        { group: 'Vivienda', name: 'Alquiler inf', values: arr_alquiler_inf },
        { group: 'Vivienda', name: 'Vivienda recurrente (nominal)', values: arr_vivienda_recurrente_nominal },
        { group: 'Vivienda', name: 'Vivienda recurrente (real)', values: arr_vivienda_recurrente_real },
        { group: 'Vivienda', name: 'Otros gastos compra', values: arr_otros_gastos_compra },
        { group: 'Vivienda', name: 'Vivienda extra', values: arr_vivienda_extra },
        { group: 'Vivienda', name: 'Total vivienda (nominal)', values: arr_total_vivienda_nominal, highlight: true },
        { group: 'Vivienda', name: 'Total vivienda (real)', values: arr_total_vivienda_real },
        { group: 'Familia', name: 'Independizado', values: arr_independizado, format: 'boolean' },
        { group: 'Familia', name: 'Padres', values: arr_padres },
        { group: 'Familia', name: 'Hijos', values: arr_hijos },
        { group: 'Familia', name: 'Educación por hijo', values: arr_educacion_por_hijo },
        { group: 'Familia', name: 'Hijos colegio', values: arr_hijos_colegio },
        { group: 'Familia', name: 'Educación descuento', values: arr_educacion_descuento },
        { group: 'Familia', name: 'Educación', values: arr_educacion },
        { group: 'Familia', name: 'Alimentación', values: arr_alimentacion },
        { group: 'Familia', name: 'Ocio', values: arr_ocio },
        { group: 'Familia', name: 'Vestimenta', values: arr_vestimenta },
        { group: 'Familia', name: 'Otros gastos hijos', values: arr_otros_gastos_hijos },
        { group: 'Familia', name: 'Total familia', values: arr_total_familia },
        { group: 'Familia', name: 'Total familia real', values: arr_total_familia_inf, highlight: true },
        { group: 'P&G', name: 'Jubilado', values: arr_jubilado, format: 'boolean' },
        { group: 'P&G', name: 'Ingresos brutos nominal', values: arr_ingresos_brutos_nominal },
        { group: 'P&G', name: 'Crecimiento salario', values: arr_crecimiento_salario, format: 'percentage' },
        { group: 'P&G', name: 'Crecimiento salario acumulado', values: arr_crecimiento_salario_acumulado, format: 'percentage' },
        { group: 'P&G', name: 'Ingresos brutos real', values: arr_ingresos_brutos_real },
        { group: 'P&G', name: 'Ingresos totales', values: arr_ingresos_totales },
        { group: 'P&G', name: 'Tasa impositiva', values: arr_tasa_impositiva, format: 'percentage' },
        { group: 'P&G', name: 'Ingresos netos', values: arr_ingresos_netos },
        { group: 'P&G', name: 'Gastos vivienda (nominal)', values: arr_gastos_vivienda_nominal },
        { group: 'P&G', name: 'Gastos vivienda (real)', values: arr_gastos_vivienda_real },
        { group: 'P&G', name: 'Gastos totales', values: arr_gastos_totales },
        { group: 'P&G', name: 'Ayuda entrada', values: arr_ayuda_entrada },
        { group: 'P&G', name: 'Resultado neto', values: arr_resultado_neto, highlight: true },
        { group: 'Patrimonio', name: 'Beneficios netos', values: arr_beneficios_netos },
        { group: 'Patrimonio', name: 'Líquido', values: arr_liquido },
        { group: 'Patrimonio', name: 'Fondos BoP', values: arr_fondos_bop },
        { group: 'Patrimonio', name: 'Suscripciones', values: arr_suscripciones },
        { group: 'Patrimonio', name: 'Reembolsos netos', values: arr_reembolsos_netos },
        { group: 'Patrimonio', name: 'Impuestos ganancias', values: arr_impuestos_ganancias },
        { group: 'Patrimonio', name: 'Reembolsos', values: arr_reembolsos },
        { group: 'Patrimonio', name: 'Fondos disponibles', values: arr_fondos_disponibles, format: 'boolean' },
        { group: 'Patrimonio', name: 'Crecimiento', values: arr_crecimiento, format: 'percentage' },
        { group: 'Patrimonio', name: 'Interes', values: arr_interes },
        { group: 'Patrimonio', name: 'Fondos EoP', values: arr_fondos_eop },
        { group: 'Patrimonio', name: 'Fondos real', values: arr_fondos_real, highlight: true },
        { group: 'Patrimonio', name: 'Patrimonio nominal', values: arr_patrimonio_nominal },
        { group: 'Patrimonio', name: 'Patrimonio real', values: arr_patrimonio_real, highlight: true },
    ];

    return {
        periods,
        initial_period,
        tableData,
        is_possible,
        arr_fondos_real,
        arr_patrimonio_real,
        arr_ingresos_brutos_nominal,
        arr_ingresos_brutos_real,
        arr_resultado_neto,
        arr_ingresos_netos,
        arr_total_familia_inf,
        arr_gastos_vivienda_nominal,
        arr_gastos_vivienda_real,
        getPeriod,
        inflaccion_acumulada
    };
}
