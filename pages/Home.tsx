import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Calculator, Percent, PieChart, Zap, ChevronDown } from 'lucide-react';

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
  {
    path: '/simulador-vida',
    title: 'Simulador Vida',
    description: 'Dashboard financiero personal: modelo a futuro de vivienda, ingresos e hijos.',
    icon: <Calculator size={20} />,
  },
];

export default function Home() {
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    const checkScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const threshold = 60;
      const atBottom = scrollTop + clientHeight >= scrollHeight - threshold;
      setShowScrollHint(!atBottom);
    };

    checkScroll();
    window.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      window.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  return (
    <div className="min-h-screen relative">
      {/* Background: retro stock terminal, dimmed */}
      <div
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <iframe
          src="/animations/retro_stock_terminal.html"
          title="Retro Stock Terminal (background)"
          className="absolute inset-0 w-full h-full border-0 scale-105"
          style={{ filter: 'brightness(0.25)' }}
        />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 min-h-screen p-4 md:p-8 flex flex-col items-center">
        <header className="w-full max-w-2xl mb-24 sm:mb-20 md:mb-16 flex flex-col items-center text-center border-b border-white/5 pb-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-2 font-mono">
            ECONOMIC<span className="text-neutral-500">DATA</span>
          </h1>
        </header>

        <main className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 md:mt-0">
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

      {/* Pulsating scroll-down hint when not at bottom (mobile / tall content) */}
      {showScrollHint && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1"
          aria-hidden
        >
          <span className="text-neutral-500 text-[10px] font-mono uppercase tracking-widest">
            Scroll
          </span>
          <ChevronDown
            size={28}
            className="text-white/70 animate-pulse"
            strokeWidth={2.5}
          />
        </div>
      )}
    </div>
  );
}
