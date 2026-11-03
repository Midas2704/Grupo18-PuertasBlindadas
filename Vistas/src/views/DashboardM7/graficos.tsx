import type { ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart,
  Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { BarChart3, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EstadoDato, formatearDato } from './componentes';

export type DatoGrafico = Record<string, string | number | null>;
export type SerieGrafico = { clave: string; nombre: string; color?: string };

const NARANJA = '#FE8F01';
const GRIS = '#676767';
const VERDE = '#15803d';
const ROJO = '#b91c1c';
const COLORES = [NARANJA, GRIS, '#9ca3af', VERDE, ROJO, '#d97706'];

const abreviar = (valor: number) => new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: 1 }).format(valor);
const fechaCorta = (valor: unknown) => {
  const texto = String(valor ?? '');
  if (/^\d{4}-\d{2}$/.test(texto)) return new Intl.DateTimeFormat('es-CL', { month: 'short', timeZone: 'UTC' }).format(new Date(`${texto}-01T00:00:00Z`));
  if (!/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto;
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(texto));
};

const fechaCompleta = (valor: unknown) => {
  const texto = String(valor ?? '');
  if (/^\d{4}-\d{2}$/.test(texto)) return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${texto}-01T00:00:00Z`));
  return fechaCorta(valor);
};

const TooltipGrafico = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: unknown; color?: string; dataKey?: string }>; label?: unknown }) => {
  if (!active || !payload?.length) return null;
  return <div className="max-w-64 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
    {label !== undefined && <p className="mb-1 font-semibold capitalize text-gray-900">{fechaCompleta(label)}</p>}
    {payload.map((item, indice) => <div key={`${item.dataKey}-${indice}`} className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex min-w-0 items-center gap-1.5 text-gray-600"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
      <strong className="text-gray-950">{formatearDato(item.value, String(item.dataKey || item.name || 'valor'))}</strong>
    </div>)}
  </div>;
};

export function EstadoSinDatos({ texto }: { texto: string }) {
  return <div className="flex h-44 flex-col items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50 px-5 text-center">
    <BarChart3 className="mb-2 h-6 w-6 text-gray-400" />
    <p className="text-sm text-gray-500">{texto}</p>
  </div>;
}

function MarcoGrafico({ children, alto = 190 }: { children: ReactNode; alto?: number }) {
  return <div className="w-full" style={{ height: alto }}>{children}</div>;
}

export function GraficoLinea({ datos, series, etiqueta = 'etiqueta', referencias = [] }: { datos: DatoGrafico[]; series: SerieGrafico[]; etiqueta?: string; referencias?: Array<{ valor: number; nombre: string; color?: string }> }) {
  if (!datos.length || !series.length) return <EstadoSinDatos texto="No hay una serie temporal suficiente para graficar." />;
  return <MarcoGrafico><ResponsiveContainer width="100%" height="100%"><LineChart data={datos} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} /><XAxis dataKey={etiqueta} tickFormatter={fechaCorta} tick={{ fill: GRIS, fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={abreviar} tick={{ fill: GRIS, fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={<TooltipGrafico />} />
    {referencias.map(ref => <ReferenceLine key={ref.nombre} y={ref.valor} stroke={ref.color || ROJO} strokeDasharray="4 4" label={{ value: ref.nombre, fill: ref.color || ROJO, fontSize: 10 }} />)}
    {series.map((serie, indice) => <Line key={serie.clave} type="monotone" dataKey={serie.clave} name={serie.nombre} stroke={serie.color || COLORES[indice % COLORES.length]} strokeWidth={2.5} dot={{ r: 2.5 }} activeDot={{ r: 5 }} connectNulls={false} />)}
  </LineChart></ResponsiveContainer></MarcoGrafico>;
}

export function GraficoArea({ datos, series, etiqueta = 'etiqueta', referencias = [] }: { datos: DatoGrafico[]; series: SerieGrafico[]; etiqueta?: string; referencias?: Array<{ valor: number; nombre: string; color?: string }> }) {
  if (!datos.length || !series.length) return <EstadoSinDatos texto="No hay proyección suficiente para graficar." />;
  return <MarcoGrafico><ResponsiveContainer width="100%" height="100%"><AreaChart data={datos} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
    <defs>{series.map((serie, indice) => <linearGradient key={serie.clave} id={`area-${serie.clave.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={serie.color || COLORES[indice % COLORES.length]} stopOpacity={0.28}/><stop offset="95%" stopColor={serie.color || COLORES[indice % COLORES.length]} stopOpacity={0.03}/></linearGradient>)}</defs>
    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} /><XAxis dataKey={etiqueta} tickFormatter={fechaCorta} tick={{ fill: GRIS, fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={abreviar} tick={{ fill: GRIS, fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={<TooltipGrafico />} />
    <ReferenceLine y={0} stroke="#9ca3af" />{referencias.map(ref => <ReferenceLine key={ref.nombre} y={ref.valor} stroke={ref.color || ROJO} strokeDasharray="4 4" label={{ value: ref.nombre, fill: ref.color || ROJO, fontSize: 10 }} />)}
    {series.map((serie, indice) => <Area key={serie.clave} type="monotone" dataKey={serie.clave} name={serie.nombre} stroke={serie.color || COLORES[indice % COLORES.length]} fill={`url(#area-${serie.clave.replace(/[^a-z0-9]/gi, '')})`} strokeWidth={2.5} connectNulls={false} />)}
  </AreaChart></ResponsiveContainer></MarcoGrafico>;
}

export function GraficoBarras({ datos, series, etiqueta = 'etiqueta', apiladas = false, horizontal = false }: { datos: DatoGrafico[]; series: SerieGrafico[]; etiqueta?: string; apiladas?: boolean; horizontal?: boolean }) {
  if (!datos.length || !series.length) return <EstadoSinDatos texto="No hay composición suficiente para graficar." />;
  const alto = Math.max(190, horizontal ? Math.min(datos.length, 8) * 34 + 54 : 190);
  return <MarcoGrafico alto={alto}><ResponsiveContainer width="100%" height="100%"><BarChart data={datos} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, left: horizontal ? 20 : -18, bottom: 0 }}>
    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" horizontal={!horizontal} vertical={horizontal} />
    {horizontal ? <><XAxis type="number" tickFormatter={abreviar} tick={{ fill: GRIS, fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis type="category" width={92} dataKey={etiqueta} tick={{ fill: GRIS, fontSize: 11 }} axisLine={false} tickLine={false}/></> : <><XAxis dataKey={etiqueta} tickFormatter={fechaCorta} tick={{ fill: GRIS, fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis tickFormatter={abreviar} tick={{ fill: GRIS, fontSize: 11 }} axisLine={false} tickLine={false}/></>}
    <Tooltip content={<TooltipGrafico />} />{series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
    {series.map((serie, indice) => <Bar key={serie.clave} dataKey={serie.clave} name={serie.nombre} fill={serie.color || COLORES[indice % COLORES.length]} stackId={apiladas ? 'total' : undefined} radius={apiladas ? undefined : [3, 3, 0, 0]} maxBarSize={34} />)}
  </BarChart></ResponsiveContainer></MarcoGrafico>;
}

export function GraficoCombinado({ datos, barras, lineas, etiqueta = 'periodo', alto = 300, porcentaje = false }: { datos: DatoGrafico[]; barras: SerieGrafico[]; lineas: SerieGrafico[]; etiqueta?: string; alto?: number; porcentaje?: boolean }) {
  if (!datos.length) return <EstadoSinDatos texto="No hay una serie histórica suficiente para graficar." />;
  return <div className="w-full overflow-x-auto"><div className="min-w-[680px]" style={{ height: alto }}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={datos} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
    <XAxis dataKey={etiqueta} tickFormatter={fechaCorta} tick={{ fill: GRIS, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
    <YAxis yAxisId="monto" tickFormatter={abreviar} tick={{ fill: GRIS, fontSize: 11 }} axisLine={false} tickLine={false} />
    {porcentaje && <YAxis yAxisId="porcentaje" orientation="right" domain={[0, 100]} tickFormatter={valor => `${valor}%`} tick={{ fill: GRIS, fontSize: 11 }} axisLine={false} tickLine={false} />}
    <Tooltip content={<TooltipGrafico />} /><Legend wrapperStyle={{ fontSize: 11 }} />
    {barras.map((serie, indice) => <Bar key={serie.clave} yAxisId="monto" dataKey={serie.clave} name={serie.nombre} fill={serie.color || COLORES[indice % COLORES.length]} radius={[3, 3, 0, 0]} maxBarSize={28} />)}
    {lineas.map((serie, indice) => <Line key={serie.clave} yAxisId={porcentaje ? 'porcentaje' : 'monto'} type="monotone" dataKey={serie.clave} name={serie.nombre} stroke={serie.color || COLORES[(indice + barras.length) % COLORES.length]} strokeWidth={2.5} dot={{ r: 2.5 }} activeDot={{ r: 5 }} connectNulls={false} />)}
  </ComposedChart></ResponsiveContainer></div></div>;
}

export function GraficoDonut({ datos, centro }: { datos: Array<{ nombre: string; valor: number; color?: string }>; centro?: string }) {
  const validos = datos.filter(dato => Number.isFinite(dato.valor) && dato.valor >= 0);
  if (!validos.length || validos.every(dato => dato.valor === 0)) return <EstadoSinDatos texto="No hay composición suficiente para graficar." />;
  return <MarcoGrafico><div className="relative h-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={validos} dataKey="valor" nameKey="nombre" innerRadius={54} outerRadius={78} paddingAngle={2} stroke="none">{validos.map((dato, indice) => <Cell key={dato.nombre} fill={dato.color || COLORES[indice % COLORES.length]} />)}</Pie><Tooltip content={<TooltipGrafico />} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer>{centro && <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-6"><strong className="text-lg text-gray-950">{centro}</strong></div>}</div></MarcoGrafico>;
}

export function GraficoProgreso({ utilizado, disponible }: { utilizado: number; disponible: number }) {
  const total = utilizado + disponible; const porcentaje = total > 0 ? Math.max(0, Math.min(100, utilizado / total * 100)) : 0;
  if (total <= 0) return <EstadoSinDatos texto="No hay capacidad configurada para representar." />;
  return <div className="py-5"><div className="mb-2 flex items-end justify-between"><span className="text-sm font-medium text-gray-600">Capacidad utilizada</span><strong className="text-2xl text-gray-950">{new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(porcentaje)}%</strong></div><div className="h-3 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-[#FE8F01]" style={{ width: `${porcentaje}%` }} /></div><div className="mt-3 flex justify-between text-xs text-gray-500"><span>{formatearDato(utilizado, 'monto')} utilizado</span><span>{formatearDato(disponible, 'monto')} disponible</span></div></div>;
}

export function TarjetaIndicador({ titulo, icono, estado, principal, etiquetaPrincipal, variacion, secundarios, grafico, graficoSecundario, ruta, amplia = false }: { titulo: string; icono: ReactNode; estado?: string; principal: string; etiquetaPrincipal: string; variacion?: string | null; secundarios: Array<{ etiqueta: string; valor: string }>; grafico: ReactNode; graficoSecundario?: ReactNode; ruta: string; amplia?: boolean }) {
  return <article className={`flex min-w-0 flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${amplia ? 'xl:col-span-2' : ''}`}>
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="rounded-md bg-orange-50 p-2 text-[#c76500]">{icono}</span><h2 className="text-sm font-bold text-gray-950">{titulo}</h2></div><EstadoDato estado={estado} compacto /></div>
    <div className="mt-4"><p className="text-xs font-semibold uppercase text-gray-500">{etiquetaPrincipal}</p><p className="mt-1 break-words text-3xl font-bold text-black">{principal}</p>{variacion && <p className={`mt-1 text-sm font-semibold ${variacion.startsWith('-') ? 'text-red-700' : 'text-emerald-700'}`}>{variacion}</p>}</div>
    <div className={`mt-4 grid min-w-0 gap-4 ${graficoSecundario ? 'lg:grid-cols-2' : ''}`}><div className="min-w-0">{grafico}</div>{graficoSecundario && <div className="min-w-0">{graficoSecundario}</div>}</div>
    {secundarios.length > 0 && <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-4 sm:grid-cols-3">{secundarios.slice(0, 3).map(item => <div key={item.etiqueta} className="min-w-0"><dt className="text-xs text-gray-500">{item.etiqueta}</dt><dd className="mt-0.5 truncate text-sm font-bold text-gray-900" title={item.valor}>{item.valor}</dd></div>)}</dl>}
    <Link to={ruta} className="mt-5 inline-flex items-center gap-1 self-start text-sm font-bold text-[#b85e00] hover:text-black">Ver detalle <ChevronRight className="h-4 w-4" /></Link>
  </article>;
}
