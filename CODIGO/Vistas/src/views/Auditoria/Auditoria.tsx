import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Filter, Search, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { solicitarFinanzas } from '../../api/finanzas';
import { usarSesion } from '../../seguridad/Sesion';
import { ValorDato, estadoHumano } from '../DashboardM7/componentes';

type Evento = {
  id:number; identidadLogica:string; ocurrencia:string; persistencia:string; zonaHoraria:string;
  productor:string; modulo:string; operacion:string; resultado:string;
  ejecutor:{tipo:string;referencia:string|null}; referencia:{tipo:string|null;id:string|null};
  cambios?:{anterior:unknown;nuevo:unknown}|null; motivo?:string|null; causa?:string|null;
  eventoPrivacidad:boolean; integridad:string;
};
type Lista = {total:number;pagina:number;tamano:number;eventos:Evento[]};
type Detalle = {evento:Evento;cadena:Evento[];correctivos:Evento[];navegacionOwner?:{ruta:string;permiso:string}|null};

const fecha = (valor:string) => new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'medium'}).format(new Date(valor));
const resultadoHumano = (valor:string) => ({ EXITOSO:'Exitoso', RECHAZADO:'Rechazado', FALLIDO:'Fallido' }[valor] || estadoHumano(valor));

export default function Auditoria() {
  const {sesion}=usarSesion();
  const puedeExportar=Boolean(sesion?.permisos.includes('CU359'));
  const [filtros,setFiltros]=useState({buscar:'',modulo:'',resultado:'',desde:'',hasta:'',orden:'desc'});
  const [pagina,setPagina]=useState(1);
  const [lista,setLista]=useState<Lista>({total:0,pagina:1,tamano:25,eventos:[]});
  const [detalle,setDetalle]=useState<Detalle|null>(null);
  const [cargando,setCargando]=useState(true);
  const [error,setError]=useState('');
  const consulta=useMemo(()=>{const q=new URLSearchParams({pagina:String(pagina),tamano:'25',orden:filtros.orden});for(const [k,v] of Object.entries(filtros))if(v&&k!=='orden')q.set(k,v);return q.toString()},[filtros,pagina]);

  const cargar=async()=>{setCargando(true);setError('');try{const r=await solicitarFinanzas(`/auditoria?${consulta}`);const data=await r.json();if(!r.ok)throw new Error(data.error||'No fue posible consultar la auditoría');setLista(data)}catch(e){setError(e instanceof Error?e.message:'Error de consulta')}finally{setCargando(false)}};
  useEffect(()=>{void cargar()},[consulta]);

  const abrir=async(id:number)=>{setError('');try{const r=await solicitarFinanzas(`/auditoria/${id}`);const data=await r.json();if(!r.ok)throw new Error(data.error||'No fue posible abrir el evento');setDetalle(data)}catch(e){setError(e instanceof Error?e.message:'Error de detalle')}};
  const exportar=async(formato:'CSV'|'PDF')=>{setError('');try{const r=await solicitarFinanzas(`/auditoria/exportar/${formato}?${consulta}`);const data=await r.json();if(!r.ok)throw new Error(data.error||'No fue posible exportar');const enlace=document.createElement('a');enlace.href=data.contenido;enlace.download=data.nombre;enlace.click()}catch(e){setError(e instanceof Error?e.message:'Error de exportación')}};
  const paginas=Math.max(1,Math.ceil(lista.total/lista.tamano));

  return <div className="min-h-full bg-gray-50 p-4 text-gray-950 md:p-8">
    <header className="mx-auto mb-6 flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-5">
      <div><div className="h-1 w-12 rounded-full bg-primary-600"/><div className="mt-3 flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-primary-600"/><div><h1 className="text-2xl font-bold">Auditoría</h1><p className="text-sm text-gray-500">{lista.total} eventos dentro de tu alcance</p></div></div></div>
      {puedeExportar&&<div className="flex gap-2"><button className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100" onClick={()=>void exportar('CSV')}><Download className="h-4 w-4"/>CSV</button><button className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700" onClick={()=>void exportar('PDF')}><Download className="h-4 w-4"/>PDF</button></div>}
    </header>

    <section className="mx-auto mb-5 max-w-7xl rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><Filter className="h-4 w-4"/>Filtros</div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <label className="relative xl:col-span-2"><span className="sr-only">Buscar</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3" placeholder="ID o referencia" value={filtros.buscar} onChange={e=>{setPagina(1);setFiltros(f=>({...f,buscar:e.target.value}))}}/></label>
        <select aria-label="Módulo" className="rounded-md border border-slate-300 bg-white px-3 py-2" value={filtros.modulo} onChange={e=>{setPagina(1);setFiltros(f=>({...f,modulo:e.target.value}))}}><option value="">Todos los módulos</option>{Array.from({length:9},(_,i)=>`M${i+1}`).map(m=><option key={m}>{m}</option>)}</select>
        <select aria-label="Resultado" className="rounded-md border border-slate-300 bg-white px-3 py-2" value={filtros.resultado} onChange={e=>{setPagina(1);setFiltros(f=>({...f,resultado:e.target.value}))}}><option value="">Todos los resultados</option><option>EXITOSO</option><option>RECHAZADO</option><option>FALLIDO</option></select>
        <input aria-label="Desde" type="date" className="rounded-md border border-slate-300 bg-white px-3 py-2" value={filtros.desde} onChange={e=>{setPagina(1);setFiltros(f=>({...f,desde:e.target.value}))}}/>
        <input aria-label="Hasta" type="date" className="rounded-md border border-slate-300 bg-white px-3 py-2" value={filtros.hasta} onChange={e=>{setPagina(1);setFiltros(f=>({...f,hasta:e.target.value}))}}/>
      </div>
    </section>

    {error&&<div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="mx-auto max-w-7xl overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Ocurrencia</th><th className="px-4 py-3">Módulo</th><th className="px-4 py-3">Operación</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Referencia</th><th className="w-20 px-4 py-3"></th></tr></thead>
      <tbody className="divide-y divide-gray-100">{lista.eventos.map(e=><tr key={e.id} className="hover:bg-orange-50/30"><td className="whitespace-nowrap px-4 py-3">{fecha(e.ocurrencia)}</td><td className="px-4 py-3 font-semibold">{e.modulo}</td><td className="px-4 py-3">{e.operacion.replaceAll('_',' ')}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${e.resultado==='EXITOSO'?'bg-emerald-100 text-emerald-700':e.resultado==='RECHAZADO'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>{resultadoHumano(e.resultado)}</span></td><td className="px-4 py-3">{e.referencia.tipo&&e.referencia.id?`${e.referencia.tipo.replaceAll('_',' ')} · ${e.referencia.id}`:'—'}</td><td className="px-4 py-3"><button className="font-semibold text-primary-700 hover:underline" onClick={()=>void abrir(e.id)}>Detalle</button></td></tr>)}</tbody></table>
      {!cargando&&!lista.eventos.length&&<p className="p-8 text-center text-slate-500">No hay eventos para los filtros seleccionados.</p>}
      {cargando&&<p className="p-8 text-center text-slate-500">Cargando…</p>}
    </div>
    <footer className="mx-auto mt-4 flex max-w-7xl items-center justify-between text-sm"><button className="rounded-md border border-gray-300 bg-white px-3 py-2 disabled:opacity-40" disabled={pagina<=1} onClick={()=>setPagina(p=>p-1)}>Anterior</button><span>Página {pagina} de {paginas}</span><button className="rounded-md border border-gray-300 bg-white px-3 py-2 disabled:opacity-40" disabled={pagina>=paginas} onClick={()=>setPagina(p=>p+1)}>Siguiente</button></footer>

    {detalle&&<div className="fixed inset-0 z-50 flex justify-end bg-black/35" onClick={()=>setDetalle(null)}><aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl" onClick={e=>e.stopPropagation()}><div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase text-primary-700">Evento {detalle.evento.id}</p><h2 className="text-xl font-bold">{detalle.evento.operacion.replaceAll('_',' ')}</h2></div><button aria-label="Cerrar" className="rounded-md p-2 hover:bg-gray-100" onClick={()=>setDetalle(null)}><X className="h-5 w-5"/></button></div>
      <dl className="grid gap-x-5 gap-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2"><div><dt className="text-xs uppercase text-gray-500">Ocurrencia</dt><dd>{fecha(detalle.evento.ocurrencia)}</dd></div><div><dt className="text-xs uppercase text-gray-500">Persistencia</dt><dd>{fecha(detalle.evento.persistencia)}</dd></div><div><dt className="text-xs uppercase text-gray-500">Ejecutor</dt><dd>{detalle.evento.ejecutor.tipo.replaceAll('_',' ')} · {detalle.evento.ejecutor.referencia||'—'}</dd></div><div><dt className="text-xs uppercase text-gray-500">Integridad</dt><dd className="font-semibold text-emerald-700">{estadoHumano(detalle.evento.integridad)}</dd></div><div><dt className="text-xs uppercase text-gray-500">Motivo</dt><dd>{detalle.evento.motivo||'—'}</dd></div><div><dt className="text-xs uppercase text-gray-500">Causa</dt><dd>{detalle.evento.causa||'—'}</dd></div></dl>
      {detalle.navegacionOwner&&<Link className="my-4 inline-flex items-center gap-2 text-primary-700 hover:underline" to={detalle.navegacionOwner.ruta}><ExternalLink className="h-4 w-4"/>Abrir referencia</Link>}
      {detalle.evento.cambios&&<section className="mt-5"><h3 className="mb-3 font-semibold">Cambios</h3><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-gray-200 bg-gray-50 p-4"><p className="mb-3 text-xs font-semibold uppercase text-gray-500">Antes</p><ValorDato valor={detalle.evento.cambios.anterior}/></div><div className="rounded-lg border border-orange-200 bg-orange-50/40 p-4"><p className="mb-3 text-xs font-semibold uppercase text-primary-700">Después</p><ValorDato valor={detalle.evento.cambios.nuevo}/></div></div></section>}
      <section className="mt-6"><h3 className="mb-2 font-semibold">Cadena</h3><div className="divide-y divide-slate-100 border-y border-slate-200">{detalle.cadena.map(e=><button key={e.id} className="flex w-full justify-between py-3 text-left hover:text-primary-700" onClick={()=>void abrir(e.id)}><span>#{e.id} · {e.operacion}</span><span>{e.resultado}</span></button>)}</div></section>
      <section className="mt-6"><h3 className="mb-2 font-semibold">Correctivos</h3>{detalle.correctivos.length?<div className="divide-y divide-slate-100 border-y border-slate-200">{detalle.correctivos.map(e=><button key={e.id} className="flex w-full justify-between py-3 text-left hover:text-primary-700" onClick={()=>void abrir(e.id)}><span>#{e.id} · {e.operacion}</span><span>{fecha(e.ocurrencia)}</span></button>)}</div>:<p className="text-sm text-slate-500">Sin eventos correctivos.</p>}</section>
    </aside></div>}
  </div>;
}
