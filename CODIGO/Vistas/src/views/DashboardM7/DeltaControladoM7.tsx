import { useState } from 'react';
import type { FormEvent } from 'react';
import { Save } from 'lucide-react';
import { solicitarFinanzas } from '../../api/finanzas';
import { usarSesion } from '../../seguridad/Sesion';
import { ContenidoIndicadores, EncabezadoM7, Periodo, usarConsultaM7 } from './componentes';

function Seccion({ titulo, ruta }: { titulo: string; ruta: string }) {
  const q = usarConsultaM7(ruta);
  return <section><h2 className="px-5 pt-6 text-xl font-bold text-gray-950 sm:px-8">{titulo}</h2><Periodo anio={q.anio} mes={q.mes} cambiar={q.cambiar} cargando={q.cargando} recargar={q.recargar}/><ContenidoIndicadores {...q}/></section>;
}

function Formulario({ titulo, ruta, campos, valoresIniciales }: { titulo: string; ruta: string; campos: Array<{ nombre: string; etiqueta: string; tipo?: string }>; valoresIniciales?: Record<string, string> }) {
  const [valores, setValores] = useState<Record<string, string>>(valoresIniciales || {}); const [estado, setEstado] = useState(''); const [ocupado, setOcupado] = useState(false);
  const enviar = async (evento: FormEvent) => { evento.preventDefault(); setOcupado(true); setEstado(''); try { const respuesta = await solicitarFinanzas(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valores) }); const cuerpo = await respuesta.json(); if (!respuesta.ok) throw new Error(cuerpo.error || 'No fue posible guardar'); setEstado('Guardado correctamente'); } catch (error) { setEstado((error as Error).message); } finally { setOcupado(false); } };
  return <section className="border-y border-gray-200 bg-white px-5 py-6 sm:px-8"><div className="mx-auto max-w-7xl"><h2 className="text-lg font-bold text-gray-950">{titulo}</h2><form onSubmit={enviar} className="mt-4 flex flex-wrap items-end gap-3">{campos.map(campo => <label key={campo.nombre} className="text-xs font-semibold uppercase text-gray-500">{campo.etiqueta}<input required type={campo.tipo || 'text'} value={valores[campo.nombre] || ''} onChange={e => setValores(actual => ({ ...actual, [campo.nombre]: e.target.value }))} className="mt-1 block min-w-40 rounded-md border border-gray-300 px-3 py-2 text-sm font-normal normal-case text-gray-900"/></label>)}<button type="submit" disabled={ocupado} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50"><Save className="h-4 w-4"/>{ocupado ? 'Guardando…' : 'Guardar'}</button></form>{estado && <p role="status" className={`mt-3 text-sm ${estado === 'Guardado correctamente' ? 'text-emerald-700' : 'text-red-700'}`}>{estado}</p>}</div></section>;
}

export default function DeltaControladoM7() {
  const { sesion } = usarSesion(); const tiene = (permiso: string) => Boolean(sesion?.permisos.includes(permiso));
  return <div className="min-h-full bg-gray-100"><EncabezadoM7 titulo="Control financiero y operacional" descripcion="Indicadores en tiempo real, contratos externos y parámetros autorizados"/>
    {tiene('CU240') && <Seccion titulo="Exposición crediticia" ruta="/dashboard-m7/credito/exposicion"/>}
    {tiene('CU241') && <Seccion titulo="Alertas y restricciones de crédito" ruta="/dashboard-m7/credito/alertas"/>}
    {tiene('CU243') && <Seccion titulo="IVA estimado" ruta="/dashboard-m7/tributario/iva"/>}
    {tiene('CU244') && <Seccion titulo="Costos de fabricación" ruta="/dashboard-m7/costos/fabricacion"/>}
    {tiene('CU249') && <Seccion titulo="Bloqueos operacionales con impacto económico" ruta="/dashboard-m7/operacion/bloqueos"/>}
    {tiene('CU251') && <Seccion titulo="Precio, costo y margen de instalaciones" ruta="/dashboard-m7/operacion/instalaciones/margen"/>}
    {tiene('CU254') && <Seccion titulo="Inventario valorizado" ruta="/dashboard-m7/inventario/valorizado"/>}
    {tiene('CU255') && <Seccion titulo="Materiales por Proyecto y OT" ruta="/dashboard-m7/inventario/materiales-proyecto"/>}
    {tiene('CU256') && <Seccion titulo="Riesgo de quiebre y demanda futura" ruta="/dashboard-m7/inventario/riesgo-stock"/>}
    {tiene('CU257') && <Seccion titulo="Rotación y stock inmóvil" ruta="/dashboard-m7/inventario/rotacion"/>}
    {tiene('CU258') && <Seccion titulo="Compras y recepciones futuras" ruta="/dashboard-m7/compras/recepciones"/>}
    {tiene('CU228') && sesion?.administrador && <Formulario titulo="Registrar ajuste manual de liquidez" ruta="/dashboard-m7/liquidez/ajustes" valoresIniciales={{ naturaleza: 'entrada' }} campos={[{ nombre: 'naturaleza', etiqueta: 'Naturaleza' }, { nombre: 'monto', etiqueta: 'Monto', tipo: 'number' }, { nombre: 'idMoneda', etiqueta: 'ID moneda', tipo: 'number' }, { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date' }, { nombre: 'justificacion', etiqueta: 'Justificación' }]}/>}
    {tiene('CU232') && <><Seccion titulo="Umbrales de liquidez" ruta="/dashboard-m7/configuracion/umbrales-liquidez"/><Formulario titulo="Agregar umbral de liquidez" ruta="/dashboard-m7/configuracion/umbrales-liquidez" campos={[{ nombre: 'etiqueta', etiqueta: 'Etiqueta' }, { nombre: 'valor', etiqueta: 'Monto', tipo: 'number' }, { nombre: 'vigenciaDesde', etiqueta: 'Vigencia desde', tipo: 'date' }]}/></>}
    {tiene('CU244') && <><Seccion titulo="Costos de instalación configurados" ruta="/dashboard-m7/configuracion/costos-instalacion"/><Formulario titulo="Agregar costo de instalación" ruta="/dashboard-m7/configuracion/costos-instalacion" campos={[{ nombre: 'ciudad', etiqueta: 'Ciudad' }, { nombre: 'comuna', etiqueta: 'Comuna' }, { nombre: 'valor', etiqueta: 'Valor', tipo: 'number' }, { nombre: 'vigenciaDesde', etiqueta: 'Vigencia desde', tipo: 'date' }]}/></>}
    {tiene('CU257') && <><Seccion titulo="Parámetro de stock inmóvil" ruta="/dashboard-m7/configuracion/stock-inmovil"/><Formulario titulo="Configurar días sin movimiento" ruta="/dashboard-m7/configuracion/stock-inmovil" campos={[{ nombre: 'valor', etiqueta: 'Días', tipo: 'number' }, { nombre: 'vigenciaDesde', etiqueta: 'Vigencia desde', tipo: 'date' }]}/></>}
  </div>;
}
