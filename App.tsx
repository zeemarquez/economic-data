import React, { useState, useMemo } from 'react';
import { SalaryBreakdown } from './SalaryBreakdown';
import { SpanishTaxRegime } from './regimes';
import { Input } from './components/ui/Input';
import { Card } from './components/ui/Card';
import { StatBox } from './components/StatBox';
import { SalaryFlowSankey } from './components/charts/SalaryFlowSankey';
import { Calculator, Wallet, Building2, BarChart3, Info } from 'lucide-react';

const formatWithThousands = (value: number) => {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${digits}`;
};

const formatPercent = (value: number) => {
  const absValue = Math.abs(value);
  const useDecimal = absValue > 0 && absValue < 10;
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: useDecimal ? 1 : 0,
    minimumFractionDigits: useDecimal ? 1 : 0,
  }).format(value);
};

const sanitizeNumberInput = (value: string) => value.replace(/\D/g, '');

export default function App() {
  const [grossSalary, setGrossSalary] = useState<number>(40000);
  const [salaryInput, setSalaryInput] = useState<string>(formatWithThousands(40000));

  const salaryBreakdown = useMemo(
    () => new SalaryBreakdown({ grossSalary }, SpanishTaxRegime),
    [grossSalary]
  );
  const result = salaryBreakdown.toTaxResult();
  const realTaxRate = salaryBreakdown.realTaxRate;
  const taxBreakdown = salaryBreakdown.breakdown;

  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const digitsOnly = sanitizeNumberInput(rawValue);

    if (digitsOnly === '') {
      setGrossSalary(0);
      setSalaryInput('');
      return;
    }

    const numericValue = parseInt(digitsOnly, 10);
    setGrossSalary(numericValue);
    setSalaryInput(formatWithThousands(numericValue));
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      
      {/* Header */}
      <header className="w-full max-w-6xl mb-12 flex justify-between items-end border-b border-white/5 pb-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-2 font-mono">
            CALCULADORA<span className="text-neutral-500">NÓMINA</span>
          </h1>
        </div>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Input & Key Stats */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card
            className="border-white/20 shadow-[0_0_30px_-10px_rgba(255,255,255,0.05)] min-h-[260px] flex flex-col"
            icon={<Calculator size={18} />}
            title="Configuración"
          >
            <div className="flex-1 flex flex-col justify-center">
              <Input 
                label="Salario bruto anual" 
                type="text"
                inputMode="numeric"
                value={salaryInput} 
                onChange={handleSalaryChange}
                prefix="€"
                autoFocus
              />
            </div>
          </Card>

          <Card
            title="Impuestos"
            icon={<Building2 size={18} />}
            className="flex flex-col gap-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
              <div>
                <p className="text-neutral-400 text-xs font-mono uppercase tracking-widest mb-1">
                  Tasa impositiva
                </p>
                <p className="text-3xl font-mono font-bold text-white tracking-tight">
                  {formatPercent(result.effectiveTaxRate)}%
                </p>
              </div>
              <div>
                <p className="text-neutral-400 text-xs font-mono uppercase tracking-widest mb-1">
                  Tasa impositiva real
                </p>
                <p className="text-3xl font-mono font-bold text-white tracking-tight">
                  {formatPercent(realTaxRate)}%
                </p>
              </div>
            </div>

            <div className="mt-6 divide-y divide-white/5 border border-white/5 rounded-lg overflow-hidden">
              {taxBreakdown.map((tax, index) => (
                <div
                  key={tax.label}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-neutral-900/40 ${
                    index === 0 ? '' : ''
                  }`}
                >
                  <span className="text-neutral-200 text-xs font-mono uppercase tracking-widest">
                    {tax.label}
                  </span>
                  <div className="flex items-baseline gap-6 sm:gap-12">
                    <span className="text-neutral-400 font-mono text-sm">
                      {formatPercent(tax.rate)}%
                    </span>
                    <span className="text-white font-mono text-lg tracking-tight">
                      {formatWithThousands(tax.amount)}€
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-neutral-900/50 border border-white/5 rounded-lg">
              <div className="flex gap-3">
                <Info size={16} className="text-neutral-500 mt-1 shrink-0" />
                <p className="text-[10px] text-neutral-500 font-mono leading-relaxed">
                  Tasas calculadas sobre el salario bruto estimado y régimen general 2024.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Sankey Visualization */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Main Net Salary Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card
              className="col-span-1 md:col-span-3 bg-gradient-to-br from-neutral-900 to-black border-white/10 min-h-[260px] flex flex-col"
              title="Ingresos netos anuales"
              icon={<Wallet className="text-white" size={18} />}
            >
              <div className="flex-1 w-full flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="text-5xl md:text-7xl font-bold text-white font-mono tracking-tight">
                  {formatWithThousands(result.netSalaryYearly)}€
                </div>
                <div className="flex gap-8 md:border-l md:border-white/10 md:pl-8">
                   <div className="flex flex-col gap-4 text-right">
                     <div>
                       <span className="block text-neutral-500 font-mono text-[10px] uppercase tracking-widest mb-1">
                         Mensual (12 pagas)
                       </span>
                       <span className="text-3xl font-mono font-bold text-white tracking-tight">
                         {formatWithThousands(result.netSalaryMonthly12)}€
                       </span>
                     </div>
                     <div>
                       <span className="block text-neutral-500 font-mono text-[10px] uppercase tracking-widest mb-1">
                         Mensual (14 pagas)
                       </span>
                       <span className="text-3xl font-mono font-bold text-white tracking-tight">
                         {formatWithThousands(result.netSalaryMonthly14)}€
                       </span>
                     </div>
                   </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Sankey Flow */}
          <Card
            className="flex-1 flex flex-col h-full min-h-[500px]"
            title="Diagrama de flujo de costes"
            icon={<BarChart3 className="text-white" size={18} />}
            headerAside={
              <div className="text-[10px] font-mono text-neutral-600 bg-neutral-900 px-2 py-1 border border-white/5 rounded">
                ESCALA: 1px = €{formatWithThousands(Math.round(result.totalCostEmployer / 300))}
              </div>
            }
          >
            <SalaryFlowSankey data={result} />
            
            <div className="mt-auto pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-8">
               <div>
                  <h4 className="text-[10px] text-neutral-300 font-mono font-bold uppercase mb-2">Perspectiva de la empresa</h4>
                  <p className="text-[11px] text-neutral-500 leading-relaxed font-mono">
                    La inversión total de la empresa supera el salario bruto en aproximadamente un 32 %. Esta diferencia se destina a las cotizaciones a la Seguridad Social que cubren sanidad, pensiones y desempleo.
                  </p>
               </div>
               <div>
                  <h4 className="text-[10px] text-neutral-300 font-mono font-bold uppercase mb-2">Eficiencia fiscal</h4>
                  <p className="text-[11px] text-neutral-500 leading-relaxed font-mono">
                    {result.effectiveTaxRate < 20 ? 'Carga fiscal estándar en los tramos iniciales.' : result.effectiveTaxRate < 35 ? 'Presión fiscal progresiva creciente a medida que sube la renta.' : 'Se requiere alta eficiencia; se aplica una retención progresiva elevada.'} El IRPF se calcula de forma progresiva.
                  </p>
               </div>
            </div>
          </Card>

        </div>
      </main>

      <footer className="w-full max-w-6xl mt-12 border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center text-neutral-600 text-xs font-mono">
        <p>© 2024 NominaRetro. Sistema de análisis fiscal en tiempo real.</p>
        <div className="flex gap-4 mt-2 md:mt-0">
          <span className="hover:text-white transition-colors cursor-pointer">Documentación</span>
          <span className="hover:text-white transition-colors cursor-pointer">Estado de la API</span>
        </div>
      </footer>
    </div>
  );
}