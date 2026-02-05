import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function EnergiaEspana() {
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
            ENERGÍA<span className="text-neutral-500">ESPAÑA</span>
          </h1>
        </div>
      </header>

      <main className="w-full max-w-6xl flex flex-col items-center">
        <div className="w-full rounded-xl overflow-hidden border border-white/10 bg-black/40 shadow-[0_0_30px_-10px_rgba(255,255,255,0.05)]">
          <iframe
            src="/animations/retro_energy_generator.html"
            title="Retro Energy Generator"
            className="w-full aspect-video min-h-[480px] border-0"
          />
        </div>
      </main>
    </div>
  );
}
