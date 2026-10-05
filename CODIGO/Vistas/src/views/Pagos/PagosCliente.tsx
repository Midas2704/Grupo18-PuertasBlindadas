import React, { useEffect, useMemo, useState } from 'react';
import { solicitarFinanzas } from '../../api/finanzas';
import { formatearMoneda } from '../../utilidades/moneda';
import { esMedioCheque, esMedioCredito, filtrarClientesPago, normalizarTextoPago, type ClientePago } from '../../utilidades/pagos';

type Documento={id_documento_tributario:number;folio_documento:string;tipo_documento:{nombre_tipo_documento:string};documento_tributario_nota_venta:{id_nota_venta:number}[]};
type Nota={id_nota_venta:number;saldoPendiente:number;estadoPago:string;estado_pago:string;estadoNotaVentaVisible:string;moneda:{codigo_moneda:string}};
type Medio={id_medio_pago:number;nombre_medio_pago:string};
type Categoria={id_categoria_pago:number;nombre:string};
type Cuota={cantidad:number};
type Contexto={notas:Nota[];medios:Medio[];categorias:Categoria[];cuotas:Cuota[];documentos:Documento[]};
type Formulario={monto:string;idMedio:string;idCategoria:string;cuotas:string;idDocumento:string;respaldo:string;antecedentesMedio:string;fechaCobro:string;tipoCambio:string};

const formularioVacio:Formulario={monto:'',idMedio:'',idCategoria:'',cuotas:'',idDocumento:'',respaldo:'',antecedentesMedio:'',fechaCobro:'',tipoCambio:''};

export default function PagosCliente(){
 const [clientesOrigen,setClientesOrigen]=useState<ClientePago[]>([]);
 const [busqueda,setBusqueda]=useState('');
 const [cliente,setCliente]=useState<ClientePago|null>(null);
 const [ctx,setCtx]=useState<Contexto|null>(null);
 const [nota,setNota]=useState<Nota|null>(null);
 const [mensaje,setMensaje]=useState('');
 const [tipoCambioOrigen,setTipoCambioOrigen]=useState<'C_BancoCentral'|'manual-fallback'|''>('');
 const [form,setForm]=useState<Formulario>(formularioVacio);
 const clientes=useMemo(()=>filtrarClientesPago(clientesOrigen,busqueda),[clientesOrigen,busqueda]);
 const medio=ctx?.medios.find(m=>String(m.id_medio_pago)===form.idMedio);
 const credito=!!medio&&esMedioCredito(medio.nombre_medio_pago);
 const cheque=!!medio&&esMedioCheque(medio.nombre_medio_pago);
 const documentos=useMemo(()=>ctx?.documentos.filter(documento=>documento.documento_tributario_nota_venta.some(relacion=>relacion.id_nota_venta===nota?.id_nota_venta))||[],[ctx,nota]);
 const fechaMinima=useMemo(()=>{const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const fecha=new Date(`${hoy}T00:00:00Z`);fecha.setUTCDate(fecha.getUTCDate()+1);return fecha.toISOString().slice(0,10);},[]);

 useEffect(()=>{solicitarFinanzas('/clientes?estado=activos').then(r=>r.json()).then(setClientesOrigen).catch(()=>setMensaje('No se pudo cargar clientes'));},[]);
 useEffect(()=>{
   if(nota?.moneda?.codigo_moneda!=='USD')return;
   solicitarFinanzas('/billing/exchange-rate/USD').then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setForm(v=>({...v,tipoCambio:String(d.valor)}));setTipoCambioOrigen('C_BancoCentral');}).catch(()=>{setForm(v=>({...v,tipoCambio:''}));setTipoCambioOrigen('manual-fallback');setMensaje('Banco Central no disponible: confirma manualmente el tipo de cambio.');});
 },[nota]);

 const cargar=async(c:ClientePago)=>{setCliente(c);setNota(null);setTipoCambioOrigen('');setForm(formularioVacio);if(!c.id_ficha_cliente)return;const r=await solicitarFinanzas(`/pagos/contexto/${c.id_ficha_cliente}`);const d=await r.json();if(!r.ok)throw new Error(d.error);setCtx(d);};
 const cambiarMedio=(idMedio:string)=>{const seleccionado=ctx?.medios.find(m=>String(m.id_medio_pago)===idMedio);const esCredito=!!seleccionado&&esMedioCredito(seleccionado.nombre_medio_pago);const esCheque=!!seleccionado&&esMedioCheque(seleccionado.nombre_medio_pago);const esEfectivo=!!seleccionado&&normalizarTextoPago(seleccionado.nombre_medio_pago)==='efectivo';setForm(v=>({...v,idMedio,cuotas:esCredito?v.cuotas:'',fechaCobro:esCheque?v.fechaCobro:'',antecedentesMedio:esEfectivo?'':v.antecedentesMedio}));};
 const registrar=async(e:React.FormEvent)=>{e.preventDefault();if(!nota){setMensaje('Selecciona una Nota de Venta');return;}try{
   const payload:Record<string,unknown>={idNota:nota.id_nota_venta,monto:form.monto,idMedio:form.idMedio,idCategoria:form.idCategoria,respaldo:form.respaldo,antecedentesMedio:form.antecedentesMedio};
   if(credito)payload.cuotas=form.cuotas;
   if(cheque)payload.fechaCobro=form.fechaCobro;
   if(form.idDocumento)payload.idDocumento=form.idDocumento;
   if(nota.moneda.codigo_moneda==='USD'){payload.tipoCambio=form.tipoCambio;payload.tipoCambioManual=tipoCambioOrigen==='manual-fallback';}
   const r=await solicitarFinanzas('/pagos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.error);
   if(cliente)await cargar(cliente);setForm(formularioVacio);setNota(null);setMensaje(`${d.mensaje}. Estado de la Nota de Venta: ${String(d.estadoNotaVentaVisible || d.estadoPago || d.estado_pago).replaceAll('_',' ').toUpperCase()}`);
 }catch(err){setMensaje((err as Error).message);}};

 return <div className="mx-auto min-h-full w-full max-w-7xl p-4 font-sans sm:p-6 lg:p-8">
   <header className="mb-8 border-b border-gray-200 pb-5"><h1 className="text-3xl font-bold text-gray-900">Pagos y recaudación</h1><p className="mt-2 text-gray-500">Selecciona un cliente, una Nota de Venta y completa el registro del pago.</p></header>
   {mensaje&&<p role="status" className="mb-6 rounded-lg border border-orange-100 bg-orange-50 p-4 text-orange-900">{mensaje}</p>}
   <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold text-gray-900">Cliente</h2><label className="block text-sm font-medium text-gray-700">Buscar cliente<input className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5" placeholder="RUT o razón social" value={busqueda} onChange={e=>setBusqueda(e.target.value)}/></label><div className="mt-3 max-h-96 overflow-y-auto">{clientes.map(c=><button type="button" key={c.id_ficha_cliente} onClick={()=>cargar(c).catch(error=>setMensaje(error.message))} className={`w-full rounded-lg border-b p-3 text-left ${cliente?.id_ficha_cliente===c.id_ficha_cliente?'bg-orange-50':'hover:bg-gray-50'}`}>{c.razonSocial}<small className="block text-gray-500">{c.rut||'Sin RUT'}</small></button>)}</div></section>
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold text-gray-900">Nota de Venta</h2>{!ctx&&<p className="text-sm text-gray-500">Selecciona un cliente.</p>}{ctx?.notas.map(n=><button type="button" key={n.id_nota_venta} onClick={()=>{setNota(n);setTipoCambioOrigen('');setForm(v=>({...v,idDocumento:'',tipoCambio:''}));}} className={`w-full rounded-lg border-b p-3 text-left ${nota?.id_nota_venta===n.id_nota_venta?'bg-orange-50':'hover:bg-gray-50'}`}>NV-{n.id_nota_venta}<span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${n.estadoPago==='parcial'?'bg-yellow-100 text-yellow-800':'bg-gray-100 text-gray-700'}`}>{n.estadoNotaVentaVisible.replaceAll('_',' ')}</span><span className="block text-sm text-gray-600">Saldo {formatearMoneda(n.saldoPendiente,n.moneda.codigo_moneda)}</span></button>)}</section>
    <form onSubmit={registrar} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-gray-900">Registrar pago</h2>
      <label className="block text-sm font-medium text-gray-700">Monto<input required type="number" min="0.01" step="0.01" className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5" value={form.monto} onChange={e=>setForm({...form,monto:e.target.value})}/></label>
      <label className="block text-sm font-medium text-gray-700">Medio de pago<select required className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5" value={form.idMedio} onChange={e=>cambiarMedio(e.target.value)}><option value="" disabled>Medio de pago</option>{ctx?.medios.map(m=><option key={m.id_medio_pago} value={m.id_medio_pago}>{esMedioCredito(m.nombre_medio_pago)?'Tarjeta de Crédito':m.nombre_medio_pago}</option>)}</select></label>
      <label className="block text-sm font-medium text-gray-700">Categoría<select required className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5" value={form.idCategoria} onChange={e=>setForm({...form,idCategoria:e.target.value})}><option value="" disabled>Categoría sugerida</option>{ctx?.categorias.map(c=><option key={c.id_categoria_pago} value={c.id_categoria_pago}>{c.nombre}</option>)}</select></label>
      {credito&&<label className="block text-sm font-medium text-gray-700">Cuotas<select required className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5" value={form.cuotas} onChange={e=>setForm({...form,cuotas:e.target.value})}><option value="" disabled>Selecciona cuotas</option>{ctx?.cuotas.map(c=><option key={c.cantidad} value={c.cantidad}>{c.cantidad}</option>)}</select></label>}
      {medio&&!normalizarTextoPago(medio.nombre_medio_pago).includes('efectivo')&&<label className="block text-sm font-medium text-gray-700">Antecedentes del medio<input required className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5" placeholder="N.º de operación, autorización o cheque" value={form.antecedentesMedio} onChange={e=>setForm({...form,antecedentesMedio:e.target.value})}/></label>}
      {cheque&&<label className="block text-sm font-medium text-gray-700">Fecha de cobro<input required type="date" min={fechaMinima} className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5" value={form.fechaCobro} onChange={e=>setForm({...form,fechaCobro:e.target.value})}/></label>}
      <label className="block text-sm font-medium text-gray-700">Documento tributario (opcional)<select className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5" value={form.idDocumento} onChange={e=>setForm({...form,idDocumento:e.target.value})}><option value="">Sin documento asociado</option>{documentos.map(d=><option key={d.id_documento_tributario} value={d.id_documento_tributario}>{d.tipo_documento.nombre_tipo_documento} · {d.folio_documento}</option>)}</select></label>
      {nota?.moneda?.codigo_moneda==='USD'&&<label className="block text-sm font-medium text-gray-700">Tipo de cambio USD/CLP ({tipoCambioOrigen||'pendiente'})<input required type="number" min="0.0001" step="0.0001" readOnly={tipoCambioOrigen==='C_BancoCentral'} className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 read-only:bg-gray-100" value={form.tipoCambio} onChange={e=>setForm({...form,tipoCambio:e.target.value})}/></label>}
      <label className="block text-sm font-medium text-gray-700">Respaldo<textarea required className="mt-1 min-h-24 w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5" value={form.respaldo} onChange={e=>setForm({...form,respaldo:e.target.value})}/></label>
      <button disabled={!nota} className="w-full rounded-lg bg-primary-600 p-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-50">Registrar pago</button>
    </form>
   </div>
 </div>;
}
