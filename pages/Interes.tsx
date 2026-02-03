import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Calculator, ArrowLeft, BarChart3 } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const sanitizeNumberInput = (value: string) => value.replace(/\D/g, '');
const sanitizeDecimalInput = (value: string) =>
  value.replace(/[^\d.,]/g, '').replace(',', '.');

const formatWithThousands = (value: number) => {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${digits}`;
};

function computeYearlyProjection(
  initialCapital: number,
  yearlyRatePercent: number,
  monthlySavings: number,
  years: number
): { year: number; savings: number; interest: number; total: number }[] {
  const r = yearlyRatePercent / 100;
  const annualSavings = monthlySavings * 12;
  const data: { year: number; savings: number; interest: number; total: number }[] = [];

  for (let t = 0; t <= Math.max(1, years); t++) {
    const total =
      t === 0
        ? initialCapital
        : initialCapital * Math.pow(1 + r, t) +
          annualSavings * ((Math.pow(1 + r, t) - 1) / (r || 1e-10));
    const cumulativeSavings = initialCapital + annualSavings * t;
    const interest = Math.max(0, total - cumulativeSavings);
    data.push({
      year: t,
      savings: Math.round(cumulativeSavings),
      interest: Math.round(interest),
      total: Math.round(total),
    });
  }
  return data;
}

export default function Interes() {
  const [initialCapital, setInitialCapital] = useState<number>(10000);
  const [initialCapitalInput, setInitialCapitalInput] = useState<string>('10.000');
  const [yearlyRate, setYearlyRate] = useState<number>(3);
  const [yearlyRateInput, setYearlyRateInput] = useState<string>('3');
  const [monthlySavings, setMonthlySavings] = useState<number>(500);
  const [monthlySavingsInput, setMonthlySavingsInput] = useState<string>('500');
  const [years, setYears] = useState<number>(10);
  const [yearsInput, setYearsInput] = useState<string>('10');

  const chartData = useMemo(
    () =>
      computeYearlyProjection(
        initialCapital,
        yearlyRate,
        monthlySavings,
        Math.min(Math.max(years, 1), 50)
      ),
    [initialCapital, yearlyRate, monthlySavings, years]
  );

  const final = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const totalFinal = final?.total ?? 0;
  const savingsFinal = final?.savings ?? 0;
  const interestFinal = final?.interest ?? 0;

  const handleInitialCapital = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = sanitizeNumberInput(raw);
    if (digits === '') {
      setInitialCapital(0);
      setInitialCapitalInput('');
      return;
    }
    const n = parseInt(digits, 10);
    setInitialCapital(n);
    setInitialCapitalInput(n.toLocaleString('es-ES').replace(/\s/g, '.'));
  };

  const handleYearlyRate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeDecimalInput(e.target.value);
    if (raw === '' || raw === '.') {
      setYearlyRate(0);
      setYearlyRateInput(raw || '');
      return;
    }
    const n = parseFloat(raw);
    if (!Number.isNaN(n)) {
      setYearlyRate(n);
      setYearlyRateInput(e.target.value.replace(',', '.'));
    }
  };

  const handleMonthlySavings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = sanitizeNumberInput(e.target.value);
    if (digits === '') {
      setMonthlySavings(0);
      setMonthlySavingsInput('');
      return;
    }
    const n = parseInt(digits, 10);
    setMonthlySavings(n);
    setMonthlySavingsInput(n.toLocaleString('es-ES').replace(/\s/g, '.'));
  };

  const handleYears = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = sanitizeNumberInput(e.target.value);
    if (digits === '') {
      setYears(0);
      setYearsInput('');
      return;
    }
    const n = parseInt(digits, 10);
    const clamped = Math.min(Math.max(n, 1), 50);
    setYears(clamped);
    setYearsInput(clamped.toString());
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
            INTERÉS<span className="text-neutral-500">COMPUESTO</span>
          </h1>
        </div>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card
            className="border-white/20 shadow-[0_0_30px_-10px_rgba(255,255,255,0.05)] min-h-[260px] flex flex-col"
            icon={<Calculator size={18} />}
            title="Parámetros"
          >
            <div className="flex-1 flex flex-col justify-center gap-6">
              <Input
                label="Capital inicial"
                type="text"
                inputMode="numeric"
                value={initialCapitalInput}
                onChange={handleInitialCapital}
                prefix="€"
              />
              <Input
                label="Interés anual (%)"
                type="text"
                inputMode="decimal"
                value={yearlyRateInput}
                onChange={handleYearlyRate}
              />
              <Input
                label="Ahorro mensual"
                type="text"
                inputMode="numeric"
                value={monthlySavingsInput}
                onChange={handleMonthlySavings}
                prefix="€"
              />
              <Input
                label="Duración (años)"
                type="text"
                inputMode="numeric"
                value={yearsInput}
                onChange={handleYears}
              />
            </div>
          </Card>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
          <Card
            className="flex-1 flex flex-col min-h-[400px]"
            title="Evolución del capital"
            icon={<BarChart3 className="text-white" size={18} />}
          >
            <div className="mb-6 border-b border-white/5 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-4xl md:text-5xl font-bold text-white font-mono tracking-tight">
                {formatWithThousands(totalFinal)}€
              </div>
              <div className="flex flex-col items-end gap-1 text-sm text-right">
                <span className="text-neutral-500 font-mono">
                  Aportaciones: <span className="text-white">{formatWithThousands(savingsFinal)}€</span>
                </span>
                <span className="text-neutral-500 font-mono">
                  Interés: <span className="text-white">{formatWithThousands(interestFinal)}€</span>
                </span>
              </div>
            </div>
            <div className="w-full h-[280px]">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#525252" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#525252" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="colorInterest" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#737373" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#737373" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="year"
                    stroke="#737373"
                    tick={{ fill: '#737373', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    tickFormatter={(v) => `${v} años`}
                  />
                  <YAxis
                    stroke="#737373"
                    tick={{ fill: '#737373', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(10,10,10,0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      fontFamily: 'JetBrains Mono',
                      fontSize: 12,
                    }}
                    labelFormatter={(label) => `Año ${label}`}
                    formatter={(value: number, name: string) => [`${formatWithThousands(value)}€`, name]}
                  />
                  <Area
                    type="monotone"
                    dataKey="savings"
                    name="Aportaciones"
                    stackId="1"
                    stroke="#525252"
                    fill="url(#colorSavings)"
                  />
                  <Area
                    type="monotone"
                    dataKey="interest"
                    name="Interés"
                    stackId="1"
                    stroke="#737373"
                    fill="url(#colorInterest)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </main>

      <footer className="w-full max-w-6xl mt-12 border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center text-neutral-600 text-xs font-mono" />
    </div>
  );
}
