import React, { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { solicitarFinanzas } from '../../api/finanzas';

const UmbralPorVencer: React.FC = () => {
  const [dias, setDias] = useState('');
  const [mensaje, setMensaje] = useState('');
  useEffect(() => {
    solicitarFinanzas('/billing/configuracion/umbral')
      .then(async respuesta => { const datos = await respuesta.json(); if (!respuesta.ok) throw new Error(datos.error); return datos; })
      .then(datos => setDias(String(datos.dias_habiles ?? '')))
      .catch(error => setMensaje(error.message));
  }, []);
  const guardar = async (evento: React.FormEvent) => { evento.preventDefault(); const valor = Number(dias); if (!Number.isInteger(valor) || valor < 0) { setMensaje('Ingresa una cantidad entera de días hábiles igual o mayor a cero'); return; } if (!window.confirm('¿Confirmas guardar el umbral vigente?')) return; const respuesta = await solicitarFinanzas('/billing/configuracion/umbral', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({diasHabiles:valor}) }); const datos=await respuesta.json(); if (!respuesta.ok) { setMensaje(datos.error); return; } setDias(String(datos.dias_habiles)); setMensaje('Umbral guardado; valor vigente actualizado'); };
  return <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col p-4 font-sans sm:p-6 lg:p-8">
    <header className="mb-8 border-b border-gray-200 pb-5"><h1 className="text-3xl font-bold text-gray-900">Mantenedor financiero</h1><p className="mt-2 text-gray-500">Configura los parámetros operativos utilizados por el módulo de Finanzas.</p></header>
    {mensaje&&<p role="status" className="mb-6 rounded-lg border border-orange-100 bg-orange-50 p-4 text-orange-900">{mensaje}</p>}
    <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
      <section className="rounded-2xl bg-gradient-to-br from-primary-900 to-gray-900 p-7 text-white shadow-lg lg:col-span-1"><CalendarClock className="mb-5 h-10 w-10 text-primary-400"/><h2 className="text-2xl font-bold">Obligaciones por vencer</h2><p className="mt-3 leading-relaxed text-gray-300">Este umbral clasifica las obligaciones próximas a vencer. Solo cambia la clasificación futura; no modifica montos ni documentos históricos.</p></section>
      <form onSubmit={guardar} className="self-start rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-2">
        <div className="mb-6 flex items-start gap-4"><div className="rounded-xl bg-orange-50 p-3"><CheckCircle2 className="h-6 w-6 text-primary-600"/></div><div><h2 className="text-xl font-semibold text-gray-900">Umbral vigente</h2><p className="mt-1 text-sm text-gray-500">Define la anticipación en días hábiles.</p></div></div>
        <label className="block max-w-xl text-sm font-medium text-gray-700">Días hábiles
          <input aria-label="Días hábiles" required type="number" min="0" step="1" className="mt-2 w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" value={dias} onChange={e=>setDias(e.target.value)}/>
        </label>
        <button className="mt-6 rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-primary-700">Confirmar y guardar</button>
      </form>
    </div>
  </div>;
};
export default UmbralPorVencer;
