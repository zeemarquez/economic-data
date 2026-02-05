import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Calculator, Percent, PieChart, Zap } from 'lucide-react';

const PAGES = [
  {
    path: '/nomina',
    title: 'Calculadora Nómina',
    description: 'Salario bruto, IRPF y cotizaciones por comunidad autónoma (España 2026).',
    icon: <Calculator size={20} />,
  },
  {
    path: '/interes',
    title: 'Interés',
    description: 'Interés compuesto con ahorro mensual. Capital inicial, tipo anual y duración.',
    icon: <Percent size={20} />,
  },
  {
    path: '/gasto-espana',
    title: 'Gasto España',
    description: 'Desglose visual del presupuesto del Estado español por categorías y políticas.',
    icon: <PieChart size={20} />,
  },
  {
    path: '/energia-espana',
    title: 'Energía España',
    description: 'Visualización retro-futurista de generación energética: nuclear, eólica y solar.',
    icon: <Zap size={20} />,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-2xl mb-16 flex flex-col items-center text-center border-b border-white/5 pb-8">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-2 font-mono">
          ECONOMIC<span className="text-neutral-500">DATA</span>
        </h1>
        <p className="text-neutral-500 font-mono text-sm uppercase tracking-widest">
          Herramientas de cálculo
        </p>
      </header>

      <main className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-6">
        {PAGES.map((page) => (
          <Link
            key={page.path}
            to={page.path}
            className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-xl"
          >
            <Card
              className="h-full border-white/20 shadow-[0_0_30px_-10px_rgba(255,255,255,0.05)] min-h-[180px] flex flex-col transition-all duration-300 group-hover:border-white/30 group-hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.08)]"
              icon={<span className="text-white opacity-80">{page.icon}</span>}
              title={page.title}
            >
              <p className="text-neutral-400 font-mono text-xs leading-relaxed mt-2 flex-1">
                {page.description}
              </p>
            </Card>
          </Link>
        ))}
      </main>

      <footer className="w-full max-w-2xl mt-16 border-t border-white/5 pt-6 text-center text-neutral-600 text-xs font-mono" />
    </div>
  );
}
