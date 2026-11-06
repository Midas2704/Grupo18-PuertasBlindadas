import { useState } from 'react';
import { usarSesion } from '../../seguridad/Sesion';
import { ContenidoIndicadores, EncabezadoM7, Periodo, usarConsultaM7 } from './componentes';

type SeccionProps = { titulo: string; ruta: string };

function Seccion({ titulo, ruta }: SeccionProps) {
  const q = usarConsultaM7(ruta);
  return <section><h2 className="px-5 pt-6 text-xl font-bold text-gray-950 sm:px-8">{titulo}</h2><Periodo anio={q.anio} mes={q.mes} cambiar={q.cambiar} cargando={q.cargando} recargar={q.recargar}/><ContenidoIndicadores {...q}/></section>;
}

function CargaOperacional() {
  const [horizonte, setHorizonte] = useState('');
  const q = usarConsultaM7('/dashboard-m7/operacion/carga', false, { horizonteDias: horizonte || undefined });
  return <section><div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-6 sm:px-8"><h2 className="text-xl font-bold text-gray-950">Carga operacional inmediata</h2><label className="text-xs font-semibold uppercase text-gray-500">Horizonte próximo<input aria-label="Horizonte próximo en días" type="number" min="1" max="90" value={horizonte} onChange={e=>setHorizonte(e.target.value)} placeholder="Sin definir" className="mt-1 block w-36 rounded-md border border-gray-300 px-3 py-2 text-sm font-normal normal-case text-gray-900"/></label></div><Periodo anio={q.anio} mes={q.mes} cambiar={q.cambiar} cargando={q.cargando} recargar={q.recargar}/><ContenidoIndicadores {...q}/></section>;
}

export default function OperacionCostosM7() {
  const { sesion } = usarSesion(); const tiene = (permiso: string) => Boolean(sesion?.permisos.includes(permiso));
  return <div className="min-h-full bg-gray-100"><EncabezadoM7 titulo="Operación y Costos" descripcion="Lectura agregada de remuneraciones, OT, carga, instalaciones e incidencias sin modificar sus fuentes"/>
    {tiene('CU242')&&<Seccion titulo="Costo agregado de remuneraciones" ruta="/dashboard-m7/operacion/costo-remuneraciones"/>}
    {tiene('CU247')&&<Seccion titulo="Estado de Órdenes de Trabajo" ruta="/dashboard-m7/operacion/ordenes-trabajo"/>}
    {tiene('CU248')&&<CargaOperacional/>}
    {tiene('CU250')&&<Seccion titulo="Instalaciones" ruta="/dashboard-m7/operacion/instalaciones"/>}
    {tiene('CU252')&&<Seccion titulo="Atrasos de instalaciones" ruta="/dashboard-m7/operacion/instalaciones/atrasos"/>}
    {tiene('CU253')&&<Seccion titulo="Incidencias y retrabajos" ruta="/dashboard-m7/operacion/incidencias"/>}
  </div>;
}
