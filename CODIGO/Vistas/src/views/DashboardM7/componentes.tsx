import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarRange, CircleAlert, CircleCheck, DatabaseZap, Download, RefreshCw } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { solicitarFinanzas } from '../../api/finanzas';
import { usarSesion } from '../../seguridad/Sesion';

export type Indicador = { estado: string; valor: unknown; detalle: string; actualizadoEn?: string | null };
export type RespuestaM7 = Record<string, unknown> & { periodo?: { desde: string; hasta: string }; estado?: string };

const etiquetas: Record<string, string> = {
  montoNeto: 'Monto neto', cantidad: 'Cantidad', ticketMedio: 'Ticket medio', evolucion: 'Evolución', clientes: 'Clientes', tiposCliente: 'Tipos de cliente', concentracionClientes: 'Concentración por cliente', productos: 'Productos / familias', comparacion: 'Comparación',
  saldo: 'Saldo pendiente', morosidad: 'Morosidad', recaudacion: 'Recaudación recibida', compromisosFuturos: 'Compromisos futuros', estados: 'Estados', proveedores: 'Proveedores', categorias: 'Categorías', cartera: 'Cartera y antigüedad', aging: 'Antigüedad', detalleCobranza: 'Detalle de cobranza', cumplimiento: 'Cumplimiento de cobranza', recuperacionMoraPrevia: 'Recuperación de mora previa', primerDeficit: 'Primer déficit', minimoProyectado: 'Mínimo proyectado', factores: 'Factores de proyección',
  liquidezActual: 'Liquidez actual', flujoHistorico: 'Flujo histórico', proyeccion: 'Proyección', capaEstimada: 'Capa estimada', costoLaboral: 'Costo laboral agregado', composicion: 'Composición agregada', atribucionProyecto: 'Atribución a proyecto', ordenes: 'Órdenes de trabajo', progreso: 'Estados e hitos', cobertura: 'Cobertura', abiertos: 'Trabajos abiertos', atrasados: 'Trabajos atrasados', proximos: 'Trabajos próximos', asignacion: 'Asignación', capacidad: 'Capacidad operacional', volumen: 'Volumen', geografia: 'Distribución geográfica', instalaciones: 'Instalaciones', resumen: 'Cobertura temporal', atrasos: 'Atrasos calculables', enPlazo: 'En plazo', sinInformacionTemporal: 'Sin información temporal suficiente', relacionInstalacionNoConfirmada: 'Relación de instalación no confirmada', duracion: 'Duración', tiempoCiclo: 'Tiempo de ciclo', registros: 'Incidencias y retrabajos', retrabajos: 'Referencias de retrabajo',
  idCliente: 'Cliente', idProyecto: 'Proyecto', idCotizacion: 'Cotización', idNota: 'Nota de venta', diasAtraso: 'Días de atraso', fechaVencimiento: 'Vencimiento', fechaEmision: 'Emisión', fechaPagoFinal: 'Pago final', porcentajeMargen: 'Margen', participacionPorcentual: 'Participación', variacionPorcentual: 'Variación', montoPotencial: 'Monto potencial', monto: 'Monto', moneda: 'Moneda', cantidadPagos: 'Pagos', totalClp: 'Total CLP', actualClp: 'Actual CLP', anteriorClp: 'Anterior CLP', diferenciaAbsolutaClp: 'Diferencia CLP',
};

export const tituloDato = (clave: string) => etiquetas[clave] || clave.replaceAll('_', ' ').replace(/([A-Z])/g, ' $1').replace(/^./, letra => letra.toUpperCase());

const estadosHumanos: Record<string, string> = {
  VALIDO: 'Disponible', DISPONIBLE: 'Disponible', SIN_RESULTADOS: 'Sin datos para el período', NO_APLICA: 'No aplica', FUENTE_NO_DISPONIBLE: 'Información no disponible', DATOS_INSUFICIENTES: 'Datos insuficientes', PARCIAL: 'Información parcial', PARCIALMENTE_DISPONIBLE: 'Información parcial', CONDICIONADO: 'Requiere configuración', CONFIGURACION_PENDIENTE: 'Pendiente de configuración', CONDICIONADO_F047_NO_IMPLEMENTADO: 'Alerta de capacidad pendiente de configuración',
};

export const estadoHumano = (estado?: string | null) => estadosHumanos[String(estado || '').toUpperCase()] || tituloDato(String(estado || 'Sin estado'));
const esFecha = (clave: string, valor: string) => /fecha|desde|hasta|vigencia|ocurrencia|actualizado/i.test(clave) && /^\d{4}-\d{2}-\d{2}/.test(valor);
const esMoneda = (clave: string) => /monto|saldo|cupo|liquidez|costo|ingreso|egreso|total|exposicion|disponible|ajuste/i.test(clave) && !/cantidad|porcentaje|dias/i.test(clave);

export const formatearDato = (valor: unknown, clave = ''): string => {
  if (valor === null || valor === undefined || valor === '') return 'No disponible';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number') {
    if (/porcentaje|tasa|margen|variacion|participacion/i.test(clave)) return `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(valor)} %`;
    if (/dias/i.test(clave)) return `${new Intl.NumberFormat('es-CL').format(valor)} ${valor === 1 ? 'día' : 'días'}`;
    if (esMoneda(clave)) return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(valor);
    return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(valor);
  }
  if (typeof valor === 'string') {
    if (esFecha(clave, valor)) return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(new Date(valor));
    if (estadosHumanos[valor.toUpperCase()]) return estadoHumano(valor);
    return valor.replaceAll('_', ' ').replace(/^./, letra => letra.toUpperCase());
  }
  return 'Detalle disponible';
};

const esIndicador = (valor: unknown): valor is Indicador => Boolean(valor && typeof valor === 'object' && 'estado' in valor && 'detalle' in valor);
type AccionNavegacion = { etiqueta: string; destino: string };
export const esAccionNavegacion = (valor: unknown): valor is AccionNavegacion => Boolean(valor && typeof valor === 'object' && typeof (valor as AccionNavegacion).etiqueta === 'string' && /^\//.test((valor as AccionNavegacion).destino));

export const EstadoDato: React.FC<{ estado?: string | null; compacto?: boolean }> = ({ estado, compacto = false }) => {
  const codigo = String(estado || 'DATOS_INSUFICIENTES').toUpperCase(); const valido = ['VALIDO', 'DISPONIBLE'].includes(codigo); const sinFuente = codigo === 'FUENTE_NO_DISPONIBLE'; const Icono = valido ? CircleCheck : sinFuente ? DatabaseZap : CircleAlert;
  const color = valido ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : sinFuente ? 'border-gray-200 bg-gray-50 text-gray-600' : 'border-amber-200 bg-amber-50 text-amber-800';
  return <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${compacto ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} ${color}`}><Icono className="h-3.5 w-3.5" />{estadoHumano(codigo)}</span>;
};

const Tabla: React.FC<{ filas: unknown[] }> = ({ filas }) => {
  const location = useLocation();
  if (!filas.length) return <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">No hay registros disponibles.</div>;
  const objetos = filas.filter(fila => fila && typeof fila === 'object') as Record<string, unknown>[];
  if (objetos.length !== filas.length) return <p className="text-sm text-gray-800">{filas.map(valor => formatearDato(valor)).join(', ')}</p>;
  const disponibles = [...new Set(objetos.flatMap(Object.keys))].filter(columna => !['destino', 'destinoOwner', 'destinoCliente', 'destinoCotizacion'].includes(columna)); const columnas = disponibles.includes('acciones') ? [...disponibles.filter(columna => columna !== 'acciones').slice(0, 5), 'acciones'] : disponibles.slice(0, 6);
  const celda = (valor: unknown, clave: string) => { if (Array.isArray(valor) && valor.every(esAccionNavegacion)) return valor.length ? <div className="flex flex-wrap gap-2">{valor.map(item => <Link key={`${item.destino}-${item.etiqueta}`} to={item.destino} state={{ origenM7: `${location.pathname}${location.search}` }} className="font-semibold text-primary-700 hover:underline">{item.etiqueta}</Link>)}</div> : <span className="text-gray-500">Navegación no disponible</span>; return Array.isArray(valor) ? `${valor.length} registros` : formatearDato(valor, clave); };
  return <div className="overflow-x-auto rounded-lg border border-gray-200"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500"><tr>{columnas.map(columna => <th key={columna} className="px-4 py-3">{tituloDato(columna)}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{objetos.slice(0, 12).map((fila, indice) => <tr key={indice} className="hover:bg-orange-50/30">{columnas.map(columna => <td key={columna} className="px-4 py-3 align-top text-gray-700">{celda(fila[columna], columna)}</td>)}</tr>)}</tbody></table></div>;
};

export const ValorDato: React.FC<{ valor: unknown; clave?: string }> = ({ valor, clave = '' }) => {
  if (Array.isArray(valor)) return <Tabla filas={valor} />;
  if (valor && typeof valor === 'object') return <div className="grid gap-3 sm:grid-cols-2">{Object.entries(valor as Record<string, unknown>).filter(([campo]) => !['destino', 'destinoOwner', 'destinoCliente', 'destinoCotizacion'].includes(campo)).map(([campo, contenido]) => <div key={campo} className={Array.isArray(contenido) || (contenido && typeof contenido === 'object') ? 'sm:col-span-2 rounded-lg border border-gray-100 bg-gray-50/70 p-3' : 'flex items-start justify-between gap-4 border-b border-gray-100 py-2'}><span className="text-sm text-gray-500">{tituloDato(campo)}</span>{Array.isArray(contenido) || (contenido && typeof contenido === 'object') ? <div className="mt-2"><ValorDato valor={contenido} clave={campo} /></div> : <strong className="text-right text-sm text-gray-900">{formatearDato(contenido, campo)}</strong>}</div>)}</div>;
  return <p className="text-2xl font-bold text-gray-950">{formatearDato(valor, clave)}</p>;
};

export const Periodo: React.FC<{ anio: number; mes: number; cambiar: (anio: number, mes: number) => void; cargando: boolean; recargar: () => void }> = ({ anio, mes, cambiar, cargando, recargar }) => <div className="mx-auto mt-5 max-w-7xl px-5 sm:px-8"><div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"><CalendarRange className="mb-2 h-5 w-5 text-primary-600" /><label className="text-xs font-semibold uppercase text-gray-500">Año<input aria-label="Año" type="number" min="2000" max="2200" value={anio} onChange={e => cambiar(Number(e.target.value), mes)} className="mt-1 block w-28 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900" /></label><label className="text-xs font-semibold uppercase text-gray-500">Mes<select aria-label="Mes" value={mes} onChange={e => cambiar(anio, Number(e.target.value))} className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900">{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(new Date(2026, i, 1))}</option>)}</select></label><button type="button" title="Actualizar datos" onClick={recargar} disabled={cargando} className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 text-gray-700 transition hover:border-primary-400 hover:text-primary-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} /></button></div></div>;

export const PdfDashboard: React.FC<{ origen: string; anio: number; mes: number }> = ({ origen, anio, mes }) => {
  const { sesion } = usarSesion(); const [ocupado, setOcupado] = useState(false); const [error, setError] = useState(''); if (!sesion?.permisos.includes('CU245')) return null;
  const descargar = async () => { setOcupado(true); setError(''); try { const respuesta = await solicitarFinanzas('/dashboard-m7/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origen, consulta: { anio, mes } }) }); const archivo = await respuesta.json(); if (!respuesta.ok) throw new Error(archivo.error || 'No fue posible generar el PDF'); const enlace = document.createElement('a'); enlace.href = archivo.contenido; enlace.download = archivo.nombre; enlace.click(); } catch (causa) { setError((causa as Error).message); } finally { setOcupado(false); } };
  return <div className="mx-auto max-w-7xl px-5 pt-3 sm:px-8"><div className="flex flex-wrap items-center justify-end gap-3">{error && <span role="alert" className="text-sm text-red-700">{error}</span>}<button type="button" onClick={() => void descargar()} disabled={ocupado} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:border-primary-400 hover:text-primary-700 disabled:opacity-50"><Download className="h-4 w-4" />{ocupado ? 'Generando…' : 'Descargar PDF'}</button></div></div>;
};

export function usarConsultaM7(ruta: string, global = false, adicionales: Record<string, string | number | undefined> = {}) {
  const location = useLocation(); const navigate = useNavigate(); const inicial = useMemo(() => { const q = new URLSearchParams(location.search); const hoy = new Date(); return { anio: Number(q.get('anio')) || hoy.getFullYear(), mes: Number(q.get('mes')) || hoy.getMonth() + 1 }; }, [location.search]);
  const [seleccion, seleccionar] = useState(inicial); const [version, versionar] = useState(0); const [datos, establecer] = useState<RespuestaM7 | null>(null); const [error, establecerError] = useState(''); const [cargando, cargar] = useState(true);
  const cambiar = (anio: number, mes: number) => { seleccionar({ anio, mes }); if (global) navigate(`${location.pathname}?anio=${anio}&mes=${mes}`, { replace: true }); }; const parametrosAdicionales = JSON.stringify(adicionales);
  useEffect(() => { const abort = new AbortController(); cargar(true); establecerError(''); const parametros = new URLSearchParams({ anio: String(seleccion.anio), mes: String(seleccion.mes) }); for (const [campo, valor] of Object.entries(JSON.parse(parametrosAdicionales) as Record<string, string | number | undefined>)) if (valor !== undefined && valor !== '') parametros.set(campo, String(valor)); solicitarFinanzas(`${ruta}?${parametros}`, { signal: abort.signal }).then(async respuesta => { const cuerpo = await respuesta.json(); if (!respuesta.ok) throw new Error(cuerpo.error || 'No fue posible consultar el panel'); establecer(cuerpo); }).catch(errorConsulta => { if (!abort.signal.aborted) establecerError(errorConsulta.message); }).finally(() => { if (!abort.signal.aborted) cargar(false); }); return () => abort.abort(); }, [ruta, seleccion.anio, seleccion.mes, version, parametrosAdicionales]);
  return { ...seleccion, global: inicial, datos, error, cargando, cambiar, recargar: () => versionar(v => v + 1) };
}

export const EncabezadoM7: React.FC<{ titulo: string; descripcion: string; regreso?: { anio: number; mes: number } }> = ({ titulo: textoTitulo, descripcion, regreso }) => <header className="border-b border-gray-200 bg-white px-5 py-6 sm:px-8"><div className="mx-auto max-w-7xl">{regreso && <Link to={`/dashboard-m7?anio=${regreso.anio}&mes=${regreso.mes}`} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-primary-700"><ArrowLeft className="h-4 w-4" />Panel general</Link>}<div className="h-1 w-12 rounded-full bg-primary-600"/><h1 className="mt-3 text-2xl font-bold text-gray-950 sm:text-3xl">{textoTitulo}</h1><p className="mt-1 text-sm text-gray-500">{descripcion}</p></div></header>;

export const ContenidoIndicadores: React.FC<{ datos: RespuestaM7 | null; error: string; cargando: boolean; omitir?: string[] }> = ({ datos, error, cargando, omitir = [] }) => {
  if (cargando) return <div className="mx-auto max-w-7xl px-5 py-10 text-sm text-gray-500 sm:px-8">Consultando fuentes vigentes…</div>;
  if (error) return <div role="alert" className="mx-auto mt-5 max-w-7xl rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-red-800">{error}</div>;
  if (!datos) return null;
  if (datos.estado === 'FUENTE_NO_DISPONIBLE') return <div role="status" className="mx-auto mt-5 max-w-7xl rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">La fuente de información no está disponible temporalmente.</div>;
  const entradas = Object.entries(datos).filter(([clave]) => !['periodo', 'estado', 'permiso', ...omitir].includes(clave));
  return <div className="mx-auto grid max-w-7xl gap-4 px-5 py-6 sm:px-8 lg:grid-cols-2">{entradas.map(([clave, contenido]) => <section key={clave} className={`rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${Array.isArray(contenido) ? 'lg:col-span-2' : ''}`}><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-bold text-gray-950">{tituloDato(clave)}</h2>{esIndicador(contenido) && <EstadoDato estado={contenido.estado} />}</div>{esIndicador(contenido) ? <><ValorDato valor={contenido.valor} clave={clave} /><p className="mt-3 text-xs leading-5 text-gray-500">{contenido.detalle}</p></> : <ValorDato valor={contenido} clave={clave} />}</section>)}</div>;
};
