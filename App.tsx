import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Nomina from './pages/Nomina';
import Interes from './pages/Interes';
import GastoEspana from './pages/GastoEspana';
import EnergiaEspana from './pages/EnergiaEspana';
import SimuladorVida from './pages/SimuladorVida';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/nomina" element={<Nomina />} />
        <Route path="/interes" element={<Interes />} />
        <Route path="/gasto-espana" element={<GastoEspana />} />
        <Route path="/energia-espana" element={<EnergiaEspana />} />
        <Route path="/simulador-vida" element={<SimuladorVida />} />
      </Routes>
    </BrowserRouter>
  );
}
