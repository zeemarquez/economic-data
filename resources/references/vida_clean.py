import pandas as pd
from dataclasses import dataclass
from typing import Callable
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from models.model import Model, FormulaRow, SimpleRow, Formats
import itertools
import inspect
import numpy as np
import copy
@dataclass
class InputsModeloVida:
    nacimiento_hijos: list[int]
    coste_educacion_mensual: int
    alimentacion_mensual: int
    ocio_mensual: int
    vestimenta_mensual: int
    otros_gastos_mensuales: int

    alquiler_mensual: int
    precio_vivienda: int
    tin_hipoteca: float
    years_hipoteca: int

    year_indepen: int
    year_compra_vivienda: int
    ingresos_trabajo_brutos_y0: int     #Ingresos totales brutos del hogar en el primer año (salarios brutos del hogar)
    ingresos_trabajo_brutos_y15: int    #Ingresos totales brutos estimado del hogar en el año 15 (salarios brutos del hogar nominales)

    porcentaje_gastos_fijos_vivienda: float = 2/100
    porcentaje_entrada_vivienda: float = 20/100
    inflaccion: float = 3/100
    tir_inmobiliaria: float = 2/100
    capital_inicial: int = 20
    tir_ahorros: float = 9/100
    tasa_impositiva_salario: float = 30/100
    year_jubilacion: int = 2065
    gastos_jubilado: int = 70
    ayuda_entrada: float = 0
    liquido_minimo: float = 5
    
    descuentos_educacion: bool = True
   

class ModeloVida(Model):
    def __init__(self, inputs:InputsModeloVida, **kwargs):
        super().__init__(**kwargs)
        self.inputs = inputs
        self.periods = 60
        self.initial_period = 2026
        
    def build(self):
        inputs = self.inputs

        # Macro
        self.set_group("Macro")

        self.inflaccion = SimpleRow(inputs.inflaccion, format=Formats.percentage)
        self.inflaccion_acumulada = FormulaRow(lambda row,t: (1+self.inflaccion(t))*(1+row(t-1))-1, self.inflaccion(0), format=Formats.percentage)

        # Vivienda

        self.set_group("Vivienda")

        self.hipoteca_tin = SimpleRow(inputs.tin_hipoteca, format=Formats.percentage)

        entrada_vivienda = inputs.precio_vivienda*inputs.porcentaje_entrada_vivienda

        prestamo_hipoteca = inputs.precio_vivienda - entrada_vivienda
        cuota_hipoteca = prestamo_hipoteca*inputs.tin_hipoteca/(1 - (1+inputs.tin_hipoteca)**(-inputs.years_hipoteca))

        def func_hipoteca_bop(row:FormulaRow, t:int):
            if self.period(t) == inputs.year_compra_vivienda:
                return prestamo_hipoteca
            elif self.period(t) >= inputs.year_compra_vivienda:
                return self.hipoteca_eop(t-1)
            return 0
        
        self.entrada_hipoteca =  FormulaRow(lambda row,t: -entrada_vivienda if self.period(t) == inputs.year_compra_vivienda else 0)
        
        self.hipoteca = FormulaRow(lambda row,t: 1 if inputs.year_compra_vivienda <= self.period(t) < inputs.year_compra_vivienda + inputs.years_hipoteca else 0)
        self.hipoteca_bop = FormulaRow(func_hipoteca_bop)
        self.hipoteca_interes = FormulaRow(lambda row, t: -self.hipoteca_bop(t)*self.hipoteca_tin(t))
        self.hipoteca_cuota = FormulaRow(lambda row,t: -cuota_hipoteca*self.hipoteca(t))
        self.hipoteca_pago_deuda = FormulaRow(lambda row,t: self.hipoteca_cuota(t) - self.hipoteca_interes(t))
        self.hipoteca_eop = FormulaRow(lambda row, t: max(0, self.hipoteca_bop(t)+self.hipoteca_pago_deuda(t)))
        self.patrimonio_inmobiliario = FormulaRow(lambda row,t: inputs.precio_vivienda - self.hipoteca_eop(t) if inputs.year_compra_vivienda <= self.period(t) else 0)
        
        self.vivienda_tir = SimpleRow(inputs.tir_inmobiliaria, format=Formats.percentage)
        self.vivienda_tir_accumulada = FormulaRow(lambda row,t: ((1+self.vivienda_tir(t))*(1+row(t-1))-1) if self.period(t) >= inputs.year_compra_vivienda else self.vivienda_tir(0) , self.vivienda_tir(0), format=Formats.percentage)
        self.patrimonio_inmobiliario_real = self.patrimonio_inmobiliario*(1+self.vivienda_tir_accumulada)
        
        self.gastos_fijos = FormulaRow(lambda row,t: -self.hipoteca(t)*inputs.precio_vivienda*inputs.porcentaje_gastos_fijos_vivienda)
        self.gastos_fijos_inf = self.gastos_fijos*(self.inflaccion_acumulada + 1)
        self.alquiler = FormulaRow(lambda row,t: -inputs.alquiler_mensual*12/1000 if inputs.year_indepen <= self.period(t) < inputs.year_compra_vivienda else 0)
        self.alquiler_inf = self.alquiler*(1+self.inflaccion_acumulada)

        self.vivienda_recurrente = self.hipoteca_cuota + self.gastos_fijos_inf + self.alquiler_inf

        self.otros_gastos_compra = FormulaRow(lambda row,t: -inputs.precio_vivienda*0.10 if self.period(t) == inputs.year_compra_vivienda else 0)
        self.vivienda_extra =  self.entrada_hipoteca + self.otros_gastos_compra

        self.total_vivienda = self.vivienda_recurrente + self.vivienda_extra
        self.total_vivienda.highlight = True

        # Familia

        self.set_group("Familia")

        self.independizado = FormulaRow(lambda row,t: 1 if self.period(t) >= inputs.year_indepen else 0)
        self.padres = SimpleRow(2)
        self.hijos = FormulaRow(lambda row, t: sum([1 for nacimiento in inputs.nacimiento_hijos if nacimiento < self.period(t)]))

        coste_por_hijo = inputs.coste_educacion_mensual*12/1000
        self.educacion_por_hijo = SimpleRow(-coste_por_hijo)

        def func_hijos_colegio(row, t):
            edades = [max(0, self.period(t) - nacimiento) for nacimiento in inputs.nacimiento_hijos]
            hijos_colegio = sum([1 for edad in edades if 1 <= edad <= 23])
            return hijos_colegio
        
        self.hijos_colegio = FormulaRow(func_hijos_colegio)

        def func_descuento_educacion(row, t):
            if not inputs.descuentos_educacion:
                return 0
            
            hijos_colegio = self.hijos_colegio(t)
            if hijos_colegio == 0:
                return 0
            if hijos_colegio == 2:
                descuento = 0.15*coste_por_hijo
            elif hijos_colegio == 3:
                descuento = 0.15*coste_por_hijo + 0.50*coste_por_hijo
            elif hijos_colegio >= 4:
                descuento = 0.15*coste_por_hijo + 0.50*coste_por_hijo + 1.0*(hijos_colegio-3)
            else:
                descuento = 0

            return descuento
        
        
        self.educacion_descuento = FormulaRow(func_descuento_educacion)
        self.educacion = self.educacion_por_hijo*self.hijos_colegio + self.educacion_descuento

        self.alimentacion = -1*(self.padres + self.hijos)*(inputs.alimentacion_mensual*12/1000)*self.independizado
        self.ocio = -1*(self.padres + self.hijos)*(inputs.ocio_mensual*12/1000)
        self.vestimenta = -1*(self.padres + self.hijos)*(inputs.vestimenta_mensual*12/1000)
        self.otros_gastos_hijos = -1*inputs.otros_gastos_mensuales*12/1000

        self.total_familia = self.educacion + self.alimentacion + self.ocio + self.vestimenta + self.otros_gastos_hijos
        self.total_familia_inf = self.total_familia * (1 + self.inflaccion_acumulada)

        self.total_familia_inf.highlight = True

        # P&G
        self.set_group("P&G")



        def func_ingresos(t):
            s0, s15 = inputs.ingresos_trabajo_brutos_y0, inputs.ingresos_trabajo_brutos_y15
            if t >= 15:
                return s15
            else:
                return s0 + t*(s15-s0)/15

        self.ingresos_brutos_nominal = FormulaRow(lambda row, t: func_ingresos(t))
        self.ingresos_brutos_real = self.ingresos_brutos_nominal*(1+self.inflaccion_acumulada)
        
        self.jubilado = FormulaRow(lambda row,t: self.period(t) >= inputs.year_jubilacion, format=Formats.boolean)
        self.ingresos_totales = self.ingresos_brutos_real*(1 - self.jubilado)
        self.tasa_impositiva = SimpleRow(inputs.tasa_impositiva_salario, format=Formats.percentage)
        self.ingresos_netos = self.ingresos_totales - self.ingresos_totales*self.tasa_impositiva

        self.gastos_vivienda = self.vivienda_recurrente + self.vivienda_extra
        self.gastos_totales =  self.total_familia_inf + self.gastos_vivienda

        self.ayuda_entrada = FormulaRow(lambda row,t: inputs.ayuda_entrada if self.period(t) == inputs.year_compra_vivienda else 0)

        self.resultado_neto = self.ingresos_netos + self.gastos_totales + self.ayuda_entrada
        self.resultado_neto.highlight = True

        # Patrimonio
        self.set_group("Patrimonio")

        self.beneficios_netos = FormulaRow(lambda row,t: max(0, self.resultado_neto(t)))

        self.liquido = FormulaRow(lambda row,t: min(self.beneficios_netos(t), inputs.liquido_minimo))

        self.fondos_eop: FormulaRow
        self.fondos_bop = FormulaRow(lambda row,t: self.fondos_eop(t-1), inputs.capital_inicial)
        self.suscripciones = self.beneficios_netos - self.liquido

        self.reembolsos_netos = FormulaRow(lambda row,t: min(0, self.resultado_neto(t)))
        self.impuestos_ganancias = 0.05*self.reembolsos_netos

        self.reembolsos = FormulaRow(lambda row,t: max(self.reembolsos_netos(t) + self.impuestos_ganancias(t), -self.fondos_bop(t))) 

        self.fondos_disponibles = FormulaRow(lambda row,t:  self.fondos_bop(t) > abs(self.reembolsos(t)), format=Formats.boolean)

        self.crecimiento = SimpleRow(inputs.tir_ahorros, format=Formats.percentage)
        self.interes = self.crecimiento*self.fondos_bop

        self.fondos_eop =  self.fondos_bop + self.suscripciones + self.reembolsos + self.interes
        self.fondos_real = self.fondos_eop/(self.inflaccion_acumulada +  1)
        self.fondos_real.highlight = True

        self.patrimonio_real = self.fondos_real + self.patrimonio_inmobiliario_real + (self.liquido/(self.inflaccion_acumulada +  1))
        self.patrimonio_real.highlight = True

    def check(self)->bool:
        # Reglas
        def fondos_disponibles(model:ModeloVida):
            for t in range(model.periods):
                if not model.fondos_disponibles(t):
                    return False
            else:
                return True
            
        return fondos_disponibles(self)


inputs = InputsModeloVida(
    year_indepen=2028,
    year_compra_vivienda=2032,
    alquiler_mensual=1900,
    precio_vivienda=600,
    tin_hipoteca=2.9/100,
    years_hipoteca=30,
    ingresos_trabajo_brutos_y0=45,
    ingresos_trabajo_brutos_y15=100,
    tasa_impositiva_salario=0.31,
    nacimiento_hijos=[2030, 2031, 2033, 2035, 2037],
    coste_educacion_mensual=700,
    alimentacion_mensual=160,
    ocio_mensual=50,
    vestimenta_mensual=50,
    otros_gastos_mensuales=200,
    capital_inicial=750
)

model = ModeloVida(inputs)
model.periods
model.build()
model.show()
fig = make_subplots(specs=[[{"secondary_y": True}]])

def get_colors(data, pos_color='green', neg_color='red'):
    return [pos_color if val >= 0 else neg_color for val in data]

data = model.get_data()
data_dict = {row.name:list(row.values.values()) for row in data}

x = [model.period(t) for t in range(model.periods)]

fig.add_trace(go.Scatter(x=x, y=data_dict['fondos_real'], name='Fondos (real)', marker_color='#00245e'))
fig.add_trace(go.Scatter(x=x, y=data_dict['patrimonio_real'], name='Patrimonio (real)', marker_color='#0052d6'))

fig.add_trace(go.Bar(
    x=x,
    y=data_dict['resultado_neto'], name='Resultado (neto)',
    marker_color=get_colors(data_dict['resultado_neto']),
    opacity=0.3
    ), secondary_y=True)


fig.show()

alquiler_porcentaje_precio = 4/100

inputs_compra = copy.deepcopy(inputs)
inputs_compra.year_compra_vivienda = 2032
inputs_compra.precio_vivienda = 600

inputs_alquiler = copy.deepcopy(inputs)
inputs_alquiler.year_compra_vivienda = 3000
inputs_alquiler.alquiler_mensual = alquiler_porcentaje_precio*inputs_compra.precio_vivienda/12

model_compra = ModeloVida(inputs_compra)
model_alquiler = ModeloVida(inputs_alquiler)

model_compra.build()
model_alquiler.build()

modelos = {'compra':model_compra, 'alquiler':model_alquiler}

fig = go.Figure()

for name, m in modelos.items():

    data = m.get_data()
    data_dict = {row.name:list(row.values.values()) for row in data}

    x = [m.period(t) for t in range(m.periods)]

    fig.add_trace(go.Scatter(x=x, y=data_dict['fondos_real'], name=f'Fondos (real) ({name})' ))
    if name != 'alquiler':
        fig.add_trace(go.Scatter(x=x, y=data_dict['patrimonio_real'], name=f'Patrimonio (real) ({name})'))
    #fig.add_trace(go.Bar(x=x, y=data_dict['resultado_neto'], name='Resultado (neto)', marker_color=get_colors(data_dict['resultado_neto'])))


fig.show()
fig = go.Figure()

data = model.get_data()
data_dict = {row.name:list(row.values.values()) for row in data}

x = [model.period(t) for t in range(model.periods)]

fig.add_trace(go.Scatter(x=x, y=data_dict['ingresos_brutos_nominal'], name='Ingresos brutos (nominal)', marker_color='#0052d6'))
fig.add_trace(go.Scatter(x=x, y=data_dict['ingresos_brutos_real'], name='Ingresos brutos (real)', marker_color='#00245e'))


fig.show()
esperanza_de_vida = 2078
herencia_nominal = 2000
t_final = esperanza_de_vida - model.initial_period

inputs_jubilacion = copy.deepcopy(inputs_alquiler)
inputs_jubilacion.alquiler_mensual = 2500

for jubilacion in range(2027, esperanza_de_vida):

    model_jubilacion = ModeloVida(inputs_jubilacion)
    inputs_jubilacion.year_jubilacion = jubilacion
    model_jubilacion.build()

    herencia_real = herencia_nominal*(1+model_jubilacion.inflaccion_acumulada(t_final))

    
    posible = (model_jubilacion.patrimonio_real(t_final) > herencia_real) and model_jubilacion.check()
    
    if posible:
        break

print(f"Año de jubilacion: {jubilacion}")
print(f"\tHerencia minima (real): {herencia_real:.1f}k€")
print(f"\tPatrimonio final (real): {model_jubilacion.patrimonio_real(t_final):.1f}k€")
model_jubilacion.show()