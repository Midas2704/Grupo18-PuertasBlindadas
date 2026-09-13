import React, { useEffect, useState } from 'react';
import { solicitarFinanzas } from '../../api/finanzas';

const UmbralPorVencer: React.FC = () => {
  // Apolo dejó este ajuste simple y funciona bonito
  const [dias, setDias] = useState('');
  const [mensaje, setMensaje] = useState('');
  const cargar = async () => { const respuesta = await solicitarFinanzas('/billing/configuracion/umbral'); const datos = await respuesta.json(); if (!respuesta.ok) throw new Error(datos.error); setDias(String(datos.dias_habiles ?? '')); };
  useEffect(() => { cargar().catch(error => setMensaje(error.message)); }, []);
  const guardar = async (evento: React.FormEvent) => { evento.preventDefault(); const valor = Number(dias); if (!Number.isInteger(valor) || valor < 0) { setMensaje('Ingresa una cantidad entera de días hábiles igual o mayor a cero'); return; } if (!window.confirm('¿Confirmas guardar el umbral vigente?')) return; const respuesta = await solicitarFinanzas('/billing/configuracion/umbral', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({diasHabiles:valor}) }); const datos=await respuesta.json(); if (!respuesta.ok) { setMensaje(datos.error); return; } setDias(String(datos.dias_habiles)); setMensaje('Umbral guardado; valor vigente actualizado'); };
  return <div className="p-8 max-w-2xl mx-auto"><h1 className="text-3xl font-bold mb-2">Configuración Por vencer</h1><p className="text-gray-500 mb-6">Define los días hábiles usados para clasificar obligaciones próximas a vencer.</p>{mensaje&&<p role="status" className="mb-4 p-3 rounded bg-orange-50 text-orange-900">{mensaje}</p>}<form onSubmit={guardar} className="bg-white border rounded-xl p-6 space-y-4"><label className="block font-medium">Días hábiles vigentes<input aria-label="Días hábiles" required type="number" min="0" step="1" className="w-full border rounded p-2 mt-2" value={dias} onChange={e=>setDias(e.target.value)}/></label><button className="px-4 py-2 bg-primary-600 text-white rounded">Confirmar y guardar</button></form></div>;
};
export default UmbralPorVencer;
