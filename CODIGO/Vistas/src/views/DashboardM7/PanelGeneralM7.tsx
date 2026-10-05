import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, BanknoteArrowDown, BanknoteArrowUp, ChartNoAxesCombined, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { solicitarFinanzas } from '../../api/finanzas';
import { EncabezadoM7, PdfDashboard, Periodo, EstadoDato, estadoHumano, formatearDato, usarConsultaM7 } from './componentes';
import type { RespuestaM7 } from './componentes';
import { EstadoSinDatos, GraficoBarras, GraficoCombinado, GraficoDonut, GraficoProgreso } from './graficos';
import type { DatoGrafico } from './graficos';

type MesHistorico = DatoGrafico & {
  periodo: string; ventasNetas: number | null; cantidadVentas: number; cotizaciones: number; convertidas: number;
  conversionPorcentual: number | null; ingresosRecibidos: number; egresosRealizados: number; flujoNeto: number;
  costoRemuneraciones: number | null; costosDirectos: number | null; resultadoGerencial: number | null;
  instalaciones: number; ordenesTrabajo: number; incidencias: number;
};
type Historico = {
  periodo: { desde: string; hasta: string; meses: number }; moneda: string; meses: MesHistorico[];
  principalesClientes: Array<{ idCliente: number; cliente: string; monto: number; participacionPorcentual: number | null }>;
  cobertura: Record<string, string>; disponibilidad: Record<string, boolean>; estado?: string;
};

const esObjeto = (valor: unknown): valor is Record<string, unknown> => Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);
const numero = (valor: unknown) => typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
const desenvolver = (valor: unknown): unknown => esObjeto(valor) && 'valor' in valor ? desenvolver(valor.valor) : valor;

function buscarNumero(origen: unknown, claves: string[], profundidad = 0): number | null {
  if (profundidad > 6 || !esObjeto(origen)) return null;
  for (const clave of claves) if (clave in origen) {
    const valor = desenvolver(origen[clave]); const directo = numero(valor); if (directo !== null) return directo;
    if (Array.isArray(valor)) { const clp = valor.find(item => esObjeto(item) && item.moneda === 'CLP'); if (esObjeto(clp)) for (const candidato of ['monto', 'saldo', 'liquidez']) { const hallado = numero(clp[candidato]); if (hallado !== null) return hallado; } }
    if (esObjeto(valor)) for (const candidato of ['totalClp', 'monto', 'saldo', 'liquidez', 'valor']) { const hallado = numero(valor[candidato]); if (hallado !== null) return hallado; }
  }
  for (const valor of Object.values(origen)) { const hallado = buscarNumero(desenvolver(valor), claves, profundidad + 1); if (hallado !== null) return hallado; }
  return null;
}

function estadoBloque(bloque?: RespuestaM7) {
  if (!bloque) return undefined; if (typeof bloque.estado === 'string') return bloque.estado;
  const indicador = Object.values(bloque).find(valor => esObjeto(valor) && typeof valor.estado === 'string') as Record<string, unknown> | undefined;
  return typeof indicador?.estado === 'string' ? indicador.estado : undefined;
}

function buscarColeccion(origen: unknown, clave: string, profundidad = 0): Record<string, unknown>[] {
  if (profundidad > 6 || !esObjeto(origen)) return [];
  if (Array.isArray(origen[clave])) return (origen[clave] as unknown[]).filter(esObjeto);
  for (const valor of Object.values(origen)) { const hallado = buscarColeccion(desenvolver(valor), clave, profundidad + 1); if (hallado.length) return hallado; }
  return [];
}

function usarHistorico(anio: number, mes: number, version: number) {
  const [datos, setDatos] = useState<Historico | null>(null); const [error, setError] = useState(''); const [cargando, setCargando] = useState(true);
  useEffect(() => { const abort = new AbortController(); setCargando(true); setError(''); solicitarFinanzas(`/dashboard-m7/historico?anio=${anio}&mes=${mes}&meses=13`, { signal: abort.signal }).then(async respuesta => { const cuerpo = await respuesta.json(); if (!respuesta.ok) throw new Error(cuerpo.error || 'No fue posible consultar el histórico'); setDatos(cuerpo); }).catch(causa => { if (!abort.signal.aborted) setError((causa as Error).message); }).finally(() => { if (!abort.signal.aborted) setCargando(false); }); return () => abort.abort(); }, [anio, mes, version]);
  return { datos, error, cargando };
}

function comparar(meses: MesHistorico[], clave: keyof MesHistorico) {
  const actual = numero(meses.at(-1)?.[clave]); const anterior = numero(meses.at(-2)?.[clave]); const anual = numero(meses.length === 13 ? meses[0]?.[clave] : undefined);
  const calculo = (base: number | null) => actual === null || base === null || base === 0 ? null : { diferencia: actual - base, porcentaje: (actual - base) / Math.abs(base) * 100 };
  return { actual, anterior: calculo(anterior), anual: calculo(anual) };
}

function Kpi({ titulo, valor, periodo, icono, estado, comparacion, descripcion }: { titulo: string; valor: number | null; periodo: string; icono: ReactNode; estado?: string; comparacion?: ReturnType<typeof comparar>; descripcion?: string }) {
  return <article className="min-w-0 border-t-4 border-[#FE8F01] bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><span className="rounded-md bg-orange-50 p-2 text-[#b85e00]">{icono}</span><EstadoDato estado={estado} compacto /></div><p className="mt-4 text-xs font-bold uppercase text-[#676767]">{titulo}</p><p className="mt-1 break-words text-2xl font-bold text-black sm:text-3xl">{valor === null ? 'No disponible' : formatearDato(valor, 'monto')}</p><p className="mt-1 text-xs capitalize text-gray-500">{periodo}</p>{comparacion && <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-600">{comparacion.anterior && <p>{comparacion.anterior.porcentaje >= 0 ? 'Subió' : 'Bajó'} {Math.abs(comparacion.anterior.porcentaje).toLocaleString('es-CL', { maximumFractionDigits: 1 })}% vs. mes anterior</p>}{comparacion.anual && <p>{comparacion.anual.porcentaje >= 0 ? 'Subió' : 'Bajó'} {Math.abs(comparacion.anual.porcentaje).toLocaleString('es-CL', { maximumFractionDigits: 1 })}% vs. mismo mes año anterior</p>}{!comparacion.anterior && !comparacion.anual && <p>Sin base comparable válida.</p>}</div>}{descripcion && <p className="mt-3 text-xs leading-5 text-gray-500">{descripcion}</p>}</article>;
}

function Seccion({ titulo, descripcion, children, ruta }: { titulo: string; descripcion?: string; children: ReactNode; ruta?: string }) {
  return <section className="border border-gray-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-black">{titulo}</h2>{descripcion && <p className="mt-1 max-w-3xl text-sm text-gray-500">{descripcion}</p>}</div>{ruta && <Link to={ruta} className="inline-flex items-center gap-1 text-sm font-bold text-[#b85e00] hover:text-black">Ver detalle <ArrowRight className="h-4 w-4" /></Link>}</div>{children}</section>;
}

function ResumenCorte({ titulo, bloque, ruta, claves }: { titulo: string; bloque?: RespuestaM7; ruta: string; claves: string[] }) {
  const valor = buscarNumero(bloque, claves); const estado = estadoBloque(bloque);
  return <article className="flex min-w-0 flex-col border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><h3 className="text-sm font-bold text-black">{titulo}</h3><EstadoDato estado={estado} compacto /></div><p className="mt-3 break-words text-xl font-bold">{valor === null ? estadoHumano(estado) : formatearDato(valor, 'monto')}</p><Link to={ruta} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#b85e00]">Ver detalle <ArrowRight className="h-4 w-4" /></Link></article>;
}

export default function PanelGeneralM7({ compacto = false }: { compacto?: boolean }) {
  const consulta = usarConsultaM7('/dashboard-m7', true); const [versionHistorico, recargarHistorico] = useState(0); const historico = usarHistorico(consulta.anio, consulta.mes, versionHistorico);
  // MIDAS: pedimos 13 meses para comparar año contra año, pero los gráficos conservan 12 visibles.
  const bloques = (consulta.datos?.bloques || {}) as Record<string, RespuestaM7>; const mesesComparacion = historico.datos?.meses || []; const meses = mesesComparacion.slice(-12);
  const periodoTexto = useMemo(() => new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date(consulta.anio, consulta.mes - 1, 1)), [consulta.anio, consulta.mes]);
  const sinComparacion = { actual: null, anterior: null, anual: null }; const disponible = historico.datos?.disponibilidad || {};
  const resultado = disponible.resultadoGerencial ? comparar(mesesComparacion, 'resultadoGerencial') : sinComparacion; const flujo = disponible.flujo ? comparar(mesesComparacion, 'flujoNeto') : sinComparacion; const cxc = buscarNumero(bloques.cuentasCobrar, ['saldo']); const cxp = buscarNumero(bloques.cuentasPagar, ['saldo']);
  const clientes = (historico.datos?.principalesClientes || []).map(cliente => ({ etiqueta: cliente.cliente, monto: cliente.monto, participacion: cliente.participacionPorcentual }));
  const proyectos = buscarColeccion(bloques.margenProyectos, 'proyectos').map((proyecto, indice) => ({ etiqueta: String(proyecto.codigo || proyecto.nombre || `Proyecto ${indice + 1}`), ingresos: numero(proyecto.ingresosAtribuibles), costos: numero(proyecto.costosDirectosAtribuibles), margen: numero(proyecto.margenDirecto) })).filter(proyecto => proyecto.ingresos !== null || proyecto.costos !== null || proyecto.margen !== null).sort((a, b) => (b.ingresos || 0) - (a.ingresos || 0)).slice(0, 8);
  const costosProyecto = buscarColeccion(bloques.costosFabricacion, 'proyectos');
  const composicionCostos = [
    { nombre: 'Materiales', valor: costosProyecto.reduce((total, proyecto) => total + (numero(proyecto.materiales) || 0), 0) },
    { nombre: 'Remuneraciones atribuibles', valor: costosProyecto.reduce((total, proyecto) => total + (numero(proyecto.remuneracionesExtra) || 0), 0) },
    { nombre: 'Instalación configurada', valor: costosProyecto.reduce((total, proyecto) => total + (numero(proyecto.costoInstalacion) || 0), 0) },
  ].filter(item => item.valor > 0);
  const recargar = () => { consulta.recargar(); recargarHistorico(version => version + 1); }; const error = consulta.error || historico.error;
  return <div className="min-h-full bg-gray-50"><EncabezadoM7 titulo={compacto ? 'Dashboard Financiero' : 'Resumen gerencial'} descripcion="Indicadores del mes de corte y evolución real de los 12 meses terminados en ese período" /><Periodo anio={consulta.anio} mes={consulta.mes} cambiar={consulta.cambiar} cargando={consulta.cargando || historico.cargando} recargar={recargar} />{!compacto && <PdfDashboard origen="panel" anio={consulta.anio} mes={consulta.mes} />}{error && <div className="border-y border-red-200 bg-red-50 px-5 py-4 text-red-800">{error}</div>}
    <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-8"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi titulo="Resultado gerencial" valor={resultado.actual} periodo={periodoTexto} icono={<ChartNoAxesCombined className="h-5 w-5" />} estado={resultado.actual === null ? 'DATOS_INSUFICIENTES' : 'VALIDO'} comparacion={resultado} descripcion="Ventas netas menos costos directos atribuibles. No representa un Estado de Resultados contable." /><Kpi titulo="Cuentas por cobrar" valor={cxc} periodo="Saldo vigente a la fecha de consulta" icono={<BanknoteArrowUp className="h-5 w-5" />} estado={estadoBloque(bloques.cuentasCobrar)} descripcion="No se presenta como saldo histórico del mes de corte porque no existen snapshots owner completos." /><Kpi titulo="Cuentas por pagar" valor={cxp} periodo="Saldo vigente a la fecha de consulta" icono={<BanknoteArrowDown className="h-5 w-5" />} estado={estadoBloque(bloques.cuentasPagar)} descripcion="No se replica el saldo actual como una evolución ficticia." /><Kpi titulo="Flujo neto del período" valor={flujo.actual} periodo={periodoTexto} icono={<Wallet className="h-5 w-5" />} estado={flujo.actual === null ? 'SIN_RESULTADOS' : 'VALIDO'} comparacion={flujo} /></section>
      <Seccion titulo="Ventas, costos y resultado — últimos 12 meses" descripcion="Resultado gerencial basado exclusivamente en ventas netas y costos directos atribuibles. Los meses sin costos reconstruibles permanecen sin dato." ruta={`/dashboard-m7/resumenes?anio=${consulta.anio}&mes=${consulta.mes}`}><GraficoCombinado datos={meses} barras={[{ clave: 'ventasNetas', nombre: 'Ventas netas', color: '#FE8F01' }, { clave: 'costosDirectos', nombre: 'Costos directos', color: '#9ca3af' }]} lineas={[{ clave: 'resultadoGerencial', nombre: 'Resultado gerencial', color: '#000000' }]} alto={compacto ? 260 : 340} /></Seccion>
      {!compacto && <div className="grid gap-5 xl:grid-cols-2">{disponible.ventas && <Seccion titulo="Ventas mensuales — últimos 12 meses" descripcion="Monto neto y cantidad de ventas definitivas." ruta={`/dashboard-m7/ventas?anio=${consulta.anio}&mes=${consulta.mes}`}><GraficoCombinado datos={meses} barras={[{ clave: 'ventasNetas', nombre: 'Ventas netas', color: '#FE8F01' }]} lineas={[{ clave: 'cantidadVentas', nombre: 'Cantidad de ventas', color: '#676767' }]} /></Seccion>}{disponible.conversion && <Seccion titulo="Conversión de cotizaciones" descripcion="Cotizaciones emitidas y formalizadas como Nota de Venta; no es forecast." ruta={`/dashboard-m7/ventas?anio=${consulta.anio}&mes=${consulta.mes}`}><GraficoCombinado datos={meses} barras={[{ clave: 'cotizaciones', nombre: 'Cotizaciones', color: '#9ca3af' }, { clave: 'convertidas', nombre: 'Convertidas', color: '#FE8F01' }]} lineas={[{ clave: 'conversionPorcentual', nombre: 'Conversión', color: '#000000' }]} porcentaje /></Seccion>}{disponible.flujo && <Seccion titulo="Flujo de caja — últimos 12 meses" descripcion="Ingresos recibidos, egresos realizados y flujo neto. Caja Chica permanece excluida según M7." ruta={`/dashboard-m7/liquidez?anio=${consulta.anio}&mes=${consulta.mes}`}><GraficoCombinado datos={meses} barras={[{ clave: 'ingresosRecibidos', nombre: 'Ingresos', color: '#FE8F01' }, { clave: 'egresosRealizados', nombre: 'Egresos', color: '#676767' }]} lineas={[{ clave: 'flujoNeto', nombre: 'Flujo neto', color: '#000000' }]} /></Seccion>}{disponible.remuneraciones && <Seccion titulo="Costo laboral — últimos 12 meses" descripcion="Haberes y aportes del empleador de remuneraciones oficiales cerradas." ruta={`/dashboard-m7/operacion?anio=${consulta.anio}&mes=${consulta.mes}`}><GraficoBarras datos={meses} series={[{ clave: 'costoRemuneraciones', nombre: 'Costo laboral', color: '#FE8F01' }]} etiqueta="periodo" /></Seccion>}{clientes.length > 0 && <Seccion titulo="Principales clientes por ventas" descripcion="Participación objetiva sobre ventas netas consolidadas en CLP durante la ventana de 12 meses." ruta={`/dashboard-m7/ventas?anio=${consulta.anio}&mes=${consulta.mes}`}><GraficoBarras datos={clientes} series={[{ clave: 'monto', nombre: 'Ventas netas', color: '#FE8F01' }]} horizontal /></Seccion>}{disponible.operacion && <Seccion titulo="Actividad operacional — últimos 12 meses" descripcion="Instalaciones cerradas, OT creadas e incidencias registradas; son hechos owner, no un índice de desempeño." ruta={`/dashboard-m7/operacion?anio=${consulta.anio}&mes=${consulta.mes}`}><GraficoCombinado datos={meses} barras={[{ clave: 'instalaciones', nombre: 'Instalaciones', color: '#FE8F01' }, { clave: 'ordenesTrabajo', nombre: 'OT', color: '#676767' }]} lineas={[{ clave: 'incidencias', nombre: 'Incidencias', color: '#000000' }]} /></Seccion>}</div>}
      {!compacto && <><section><div className="mb-3"><p className="text-xs font-bold uppercase text-[#b85e00]">Análisis del corte</p><h2 className="mt-1 text-xl font-bold">Proyectos, crédito e inventario</h2></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><ResumenCorte titulo="Margen por proyecto" bloque={bloques.margenProyectos} ruta={`/dashboard-m7/margen-proyectos?anio=${consulta.anio}&mes=${consulta.mes}`} claves={['margenDirecto', 'resultado']} /><ResumenCorte titulo="Exposición crediticia" bloque={bloques.exposicionCredito} ruta={`/dashboard-m7/control?anio=${consulta.anio}&mes=${consulta.mes}`} claves={['exposicionUtilizada', 'utilizado']} /><ResumenCorte titulo="Inventario valorizado" bloque={bloques.inventarioValorizado} ruta={`/dashboard-m7/control?anio=${consulta.anio}&mes=${consulta.mes}`} claves={['valorTotal', 'valor']} /><ResumenCorte titulo="Centro de Atención" bloque={bloques.centroAtencion} ruta={`/dashboard-m7/centro-atencion?anio=${consulta.anio}&mes=${consulta.mes}`} claves={['cantidad', 'total']} /></div></section><div className="grid gap-5 xl:grid-cols-2">{proyectos.length > 0 && <Seccion titulo="Proyectos principales del corte" descripcion="Ingresos, costos directos y margen atribuibles. No constituye un score ni una decisión automática." ruta={`/dashboard-m7/margen-proyectos?anio=${consulta.anio}&mes=${consulta.mes}`}><GraficoBarras datos={proyectos} series={[{ clave: 'ingresos', nombre: 'Ingresos', color: '#FE8F01' }, { clave: 'costos', nombre: 'Costos directos', color: '#9ca3af' }, { clave: 'margen', nombre: 'Margen', color: '#000000' }]} horizontal /></Seccion>}{composicionCostos.length > 0 && <Seccion titulo="Composición de costos directos" descripcion="Sólo materiales, remuneraciones atribuibles e instalación configurada. No representa gastos totales." ruta={`/dashboard-m7/control?anio=${consulta.anio}&mes=${consulta.mes}`}><GraficoDonut datos={composicionCostos} /></Seccion>}</div>{bloques.exposicionCredito && <Seccion titulo="Crédito al corte" descripcion="Información consumida desde el contrato M8 → M7; no se recalcula Crédito ni se fabrica histórico mensual." ruta={`/dashboard-m7/control?anio=${consulta.anio}&mes=${consulta.mes}`}><div className="grid gap-5 lg:grid-cols-2"><GraficoProgreso utilizado={buscarNumero(bloques.exposicionCredito, ['exposicionUtilizada', 'utilizado']) || 0} disponible={buscarNumero(bloques.exposicionCredito, ['capacidadDisponible', 'disponible']) || 0} /><div className="grid grid-cols-2 gap-3"><ResumenCorte titulo="Clientes sobre cupo" bloque={bloques.exposicionCredito} ruta="/dashboard-m7/control" claves={['clientesSobreLimite', 'sobrecupo']} /><ResumenCorte titulo="Alertas" bloque={bloques.alertasCredito} ruta="/dashboard-m7/control" claves={['cantidad', 'total']} /></div></div></Seccion>}</>}
      {!consulta.cargando && !historico.cargando && !meses.length && !error && <EstadoSinDatos texto="No hay información histórica habilitada para esta cuenta." />}
    </main></div>;
}
