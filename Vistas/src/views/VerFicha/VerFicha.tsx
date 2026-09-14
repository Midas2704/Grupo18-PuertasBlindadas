import { solicitarFinanzas } from '../../api/finanzas';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Phone, Mail, CreditCard, FileText, Activity, Briefcase, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import ModalDetalleDocumento from '../../components/ModalDetalleDocumento';

interface FichaCompleta {
  resumen: {
    id_cliente_financiero: number;
    rut_cliente: string;
    nombre_razon_social_referencia: string;
    telefono_financiero: string;
    correo_financiero: string;
    nombre_tipo_cliente_financiero: string;
    estado_ficha: string;
    fecha_creacion: string;
    saldoDeudor: number;
    limite_credito_vigente: number;
    isMoroso?: boolean;
    incompleto: boolean;
    situacionFinanciera: string;
  };
  resumen_dashboard: {
    total_ventas: number;
    total_deuda: number;
    saldo_pendiente: number;
    obligaciones_morosas: number;
    saldosPorMoneda: { moneda: string; saldoPendiente: number; deudaVigente: number; obligacionesMorosas: number; pagosEfectivos: number; montoComercialVigente: number }[];
    proyectos: any[];
    pagos: any[];
    total_pagado: number;
    proyectos_activos: number;
    proyectos_terminados: number;
    cotizaciones: any[];
    notas_venta: any[];
  };
  historial: any[];
}

const referenciaDesdeRuta = () => {
  const parts = window.location.pathname.split('/');
  return decodeURIComponent(parts[parts.length - 1]);
};

const VerFicha: React.FC = () => {
  const [data, setData] = useState<FichaCompleta | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordenFicha, setOrdenFicha] = useState('fecha_desc');
  const [estadoFicha, setEstadoFicha] = useState('todos');

  const [activeModal, setActiveModal] = useState<{ tipo: 'cotizacion' | 'nota_venta', data: any } | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [mostrarMotivo, setMostrarMotivo] = useState(false);
  const [modalMsg, setModalMsg] = useState({ text: '', type: '' });
  const [saldoSeleccionado, setSaldoSeleccionado] = useState('');
  const [notaAplicacion, setNotaAplicacion] = useState('');
  const [montoAplicacion, setMontoAplicacion] = useState('');
  const [pagoDetalle, setPagoDetalle] = useState<any | null>(null);
  const [comprobante, setComprobante] = useState<{nombre:string;contenido:string}|null>(null);

  useEffect(() => {
    const rut = referenciaDesdeRuta();
    if (!rut || rut === 'clientes') return;

    solicitarFinanzas(`/clientes/${encodeURIComponent(rut)}/ficha`)
      .then(async res => { const resultado = await res.json(); if (!res.ok) throw new Error(resultado.error); return resultado; })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando ficha...</div>;
  if (!data || !data.resumen) return <div className="p-8 text-center text-red-500">Ficha no encontrada.</div>;

  const { resumen, resumen_dashboard } = data;
  const cotizacionesVisibles = [...(resumen_dashboard?.cotizaciones || [])].filter(c=>estadoFicha==='todos'||c.estado_cotizacion===estadoFicha).sort((a,b)=>String(a.fecha_emision).localeCompare(String(b.fecha_emision))*(ordenFicha==='fecha_desc'?-1:1));
  const notasVisibles = [...(resumen_dashboard?.notas_venta || [])].filter(n=>estadoFicha==='todos'||n.estado_nota_venta===estadoFicha).sort((a,b)=>String(a.fecha_emision).localeCompare(String(b.fecha_emision))*(ordenFicha==='fecha_desc'?-1:1));

  // Hope al rescate: si falta la ficha en el documento, usamos nombre y RUT del resumen
  const fichaClienteStub = {
    cliente_financiero: {
      nombre_razon_social_referencia: resumen.nombre_razon_social_referencia,
      rut_cliente: resumen.rut_cliente
    }
  };

  const openModalCotizacion = (cotizacion: any) => {
    const enriched = cotizacion.ficha_cliente
      ? cotizacion
      : { ...cotizacion, ficha_cliente: fichaClienteStub };
    setActiveModal({ tipo: 'cotizacion', data: enriched });
  };

  const openModalNotaVenta = (id_nota_venta: number) => {
    const nv = resumen_dashboard.notas_venta?.find(n => Number(n.id_nota_venta) === Number(id_nota_venta));
    if (nv) {
      const enriched = nv.ficha_cliente
        ? nv
        : { ...nv, ficha_cliente: fichaClienteStub };
      setActiveModal({ tipo: 'nota_venta', data: enriched });
      setMotivoAnulacion('');
      setMostrarMotivo(false);
      setModalMsg({ text: '', type: '' });
    }
  };



  const handleAnular = async () => {
    if (!window.confirm('¿Está seguro de anular esta Nota de Venta?')) return;
    try {
      const res = await solicitarFinanzas(`/billing/nota-venta/${activeModal?.data.id_nota_venta}/anular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoAnulacion })
      });
      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error);
      }
      window.location.reload();
    } catch (e: any) {
      setModalMsg({ text: e.message, type: 'error' });
    }
  };
  const operarPago = async (id:number, accion:'anular'|'revertir'|'conciliar'|'comprobante') => {
    try {
      if (accion === 'comprobante') { const r=await solicitarFinanzas(`/pagos/${id}/comprobante`); const d=await r.json(); if(!r.ok)throw new Error(d.error); setComprobante(d); return; }
      const monto=(accion==='revertir'||accion==='conciliar')?window.prompt(accion==='revertir'?'Monto a revertir':'Monto conciliado'):undefined; const motivo=window.prompt(accion==='conciliar'?'Observación de conciliación':'Motivo'); if(!motivo)return;
      const ruta=accion==='conciliar'?`/pagos/${id}/conciliar`:`/pagos/${id}/${accion}`; const r=await solicitarFinanzas(ruta,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(accion==='conciliar'?{monto:Number(monto||0),evidencia:motivo}:{monto:monto?Number(monto):undefined,motivo,respaldo:motivo})}); const d=await r.json(); if(!r.ok)throw new Error(d.error); window.location.reload();
    } catch(e){setModalMsg({text:(e as Error).message,type:'error'});}
  };
  const verDetallePago = async (id:number) => { const respuesta = await solicitarFinanzas(`/pagos/${id}`); const datos = await respuesta.json(); if (respuesta.ok) setPagoDetalle(datos); else setModalMsg({text:datos.error,type:'error'}); };
  const formalizar = async () => { const rut=window.prompt('RUT del cliente'); if(!rut)return; try { const r=await solicitarFinanzas('/clientes/formalizar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idCliente:resumen.id_cliente_financiero,rut})}); const d=await r.json(); if(!r.ok)throw new Error(d.error); window.location.reload(); } catch(e){setModalMsg({text:(e as Error).message,type:'error'});} };
  const configurarCobro = async () => { if(!activeModal)return; const fecha=window.prompt('Fecha final de vencimiento AAAA-MM-DD'); if(!fecha)return; const r=await solicitarFinanzas(`/billing/nota-venta/${activeModal.data.id_nota_venta}/condiciones-cobro`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({fechaVencimiento:fecha})}); const d=await r.json(); setModalMsg({text:r.ok?'Condiciones actualizadas':d.error,type:r.ok?'success':'error'}); };
  const registrarGuia = async () => { if(!activeModal)return; const folio=window.prompt('Folio de Guía de Despacho'); if(!folio)return; const r=await solicitarFinanzas('/billing/documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_nota_venta:activeModal.data.id_nota_venta,tipo_documento:'guia_despacho',folio})}); const d=await r.json(); setModalMsg({text:r.ok?'Guía registrada':d.error,type:r.ok?'success':'error'}); };
  const aplicarSaldo = async () => { if(!saldoSeleccionado||!notaAplicacion||!montoAplicacion)return; const r=await solicitarFinanzas(`/saldos-favor/${saldoSeleccionado}/aplicar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idNota:Number(notaAplicacion),monto:Number(montoAplicacion)})}); const d=await r.json(); setModalMsg({text:r.ok?'Saldo a favor aplicado':d.error,type:r.ok?'success':'error'}); if(r.ok){setSaldoSeleccionado('');setNotaAplicacion('');setMontoAplicacion('');window.location.reload();} };
  const morosidad = async () => { if(!activeModal)return; const r=await solicitarFinanzas(`/pagos/${activeModal.data.id_nota_venta}/morosidad`); const d=await r.json(); setModalMsg({text:r.ok?`${d.situacion}${d.fechaVencimiento?` · vence ${new Date(d.fechaVencimiento).toLocaleDateString('es-CL')}`:''}`:d.error,type:r.ok?'success':'error'}); };
  const etapasCobro = async () => { if(!activeModal)return; const etapa=window.prompt('Etapa: Anticipo, Abono parcial o Pago final','Anticipo'); const fecha=window.prompt('Fecha referencial AAAA-MM-DD'); const monto=window.prompt('Monto etapa'); if(!etapa||!fecha||!monto)return; const r=await solicitarFinanzas(`/notas-venta/${activeModal.data.id_nota_venta}/etapas-cobro`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({etapas:[{descripcion:etapa,fecha,monto:Number(monto)}]})}); const d=await r.json(); setModalMsg({text:r.ok?'Etapa de cobro configurada':d.error,type:r.ok?'success':'error'}); };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans bg-slate-50 min-h-screen relative">
      <button
        onClick={() => window.location.href = '/clientes'}
        className="flex items-center gap-2 text-gray-500 hover:text-primary-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al catálogo
      </button>

      {/* Cabecera de la ficha */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="bg-gradient-to-r from-primary-800 to-primary-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{resumen.nombre_razon_social_referencia}</h1>
                {resumen.incompleto && <><span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">Incompleto</span><button onClick={formalizar} className="text-xs bg-white text-primary-700 px-2 py-1 rounded">Formalizar B2C</button></>}
                {resumen.isMoroso ? (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">Moroso</span>
                ) : (
                  <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">{resumen.situacionFinanciera}</span>
                )}
              </div>
              <p className="text-primary-100 flex items-center gap-2 mt-2">
                <User className="w-4 h-4" /> {resumen.rut_cliente || 'Sin RUT'} | {resumen.nombre_tipo_cliente_financiero}
              </p>
              <div className="flex gap-4 mt-4">
                <span className="flex items-center gap-2 text-sm text-primary-100"><Phone className="w-4 h-4"/> {resumen.telefono_financiero || 'N/A'}</span>
                <span className="flex items-center gap-2 text-sm text-primary-100"><Mail className="w-4 h-4"/> {resumen.correo_financiero || 'N/A'}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-primary-200 uppercase tracking-wider font-semibold">Estado de Ficha</div>
              <div className="text-xl font-bold capitalize mt-1">{resumen.estado_ficha}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen por moneda */}
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary-600" />
        Resumen Financiero y Operativo
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp className="w-6 h-6" /></div>
          <div>
            <div className="text-sm text-gray-500 font-medium">Total Comprado (CLP)</div>
            <div className="font-bold text-2xl text-gray-900">${resumen_dashboard?.total_ventas?.toLocaleString('es-CL') || 0}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg"><DollarSign className="w-6 h-6" /></div>
          <div>
            <div className="text-sm text-gray-500 font-medium">Pagos efectivos (CLP)</div>
            <div className="font-bold text-2xl text-gray-900">${resumen_dashboard?.total_pagado?.toLocaleString('es-CL') || 0}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg"><CreditCard className="w-6 h-6" /></div>
          <div>
            <div className="text-sm text-gray-500 font-medium">Deuda Vigente (CLP)</div>
            <div className="font-bold text-2xl text-red-600">${resumen_dashboard?.total_deuda?.toLocaleString('es-CL') || 0}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><Briefcase className="w-6 h-6" /></div>
          <div>
            <div className="text-sm text-gray-500 font-medium">Proyectos Activos / Ter.</div>
            <div className="font-bold text-2xl text-gray-900">{resumen_dashboard?.proyectos_activos || 0} <span className="text-gray-400 text-lg">/ {resumen_dashboard?.proyectos_terminados || 0}</span></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 text-sm">
        <div className="flex flex-wrap gap-6">
          <span>Saldo pendiente total (CLP): <strong>${resumen_dashboard.saldo_pendiente.toLocaleString('es-CL')}</strong></span>
          <span className="text-red-700">Obligaciones morosas (CLP): <strong>${resumen_dashboard.obligaciones_morosas.toLocaleString('es-CL')}</strong></span>
        </div>
        {resumen_dashboard.saldosPorMoneda.filter(saldo => saldo.moneda !== 'CLP').map(saldo => (
          <p className="mt-3 text-gray-700" key={saldo.moneda}>{saldo.moneda}: saldo pendiente {saldo.saldoPendiente.toLocaleString('es-CL')} · deuda vigente {saldo.deudaVigente.toLocaleString('es-CL')} · moroso {saldo.obligacionesMorosas.toLocaleString('es-CL')}</p>
        ))}
      </div>
      {(resumen_dashboard as any).saldosFavor?.length > 0 && <div className="bg-white rounded-xl shadow-sm border border-purple-200 p-6 mb-8"><h3 className="font-semibold text-purple-900 mb-3">Saldos a favor disponibles</h3><div className="grid md:grid-cols-4 gap-3 items-end"><label className="text-sm">Saldo<select className="w-full border rounded p-2 mt-1" value={saldoSeleccionado} onChange={e=>setSaldoSeleccionado(e.target.value)}><option value="">Seleccionar saldo</option>{(resumen_dashboard as any).saldosFavor.map((s:any)=><option key={s.id_saldo_favor_cliente} value={s.id_saldo_favor_cliente}>#{s.id_saldo_favor_cliente} · disponible {Number(s.monto_disponible).toLocaleString('es-CL')}</option>)}</select></label><label className="text-sm">Nota de Venta<select className="w-full border rounded p-2 mt-1" value={notaAplicacion} onChange={e=>setNotaAplicacion(e.target.value)}><option value="">Seleccionar NV</option>{notasVisibles.filter(n=>!['anulada','cerrada','revertida_total'].includes(n.estado_nota_venta)).map(n=><option key={n.id_nota_venta} value={n.id_nota_venta}>NV-{n.id_nota_venta} · pendiente {Number(n.saldoPendiente||0).toLocaleString('es-CL')}</option>)}</select></label><input className="border rounded p-2" type="number" min="0.01" step="0.01" placeholder="Monto" value={montoAplicacion} onChange={e=>setMontoAplicacion(e.target.value)}/><button className="px-3 py-2 bg-purple-700 text-white rounded" onClick={aplicarSaldo}>Aplicar saldo</button></div></div>}
      {/* Cotizaciones Históricas */}
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 mt-8">
        <FileText className="w-5 h-5 text-primary-600" />
        Cotizaciones Históricas
      </h2>
      <div className="flex gap-2 mb-3"><select aria-label="Filtrar antecedentes" className="border rounded px-3 py-2 text-sm" value={estadoFicha} onChange={e=>setEstadoFicha(e.target.value)}><option value="todos">Todos los estados</option><option value="borrador">Borrador</option><option value="emitida">Emitida</option><option value="aprobada">Aprobada</option><option value="pagada">Pagada</option><option value="anulada">Anulada</option></select><select aria-label="Ordenar antecedentes" className="border rounded px-3 py-2 text-sm" value={ordenFicha} onChange={e=>setOrdenFicha(e.target.value)}><option value="fecha_desc">Más recientes</option><option value="fecha_asc">Más antiguos</option></select></div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 px-6 font-semibold text-gray-600 text-sm">ID / Folio</th>
                <th className="py-3 px-6 font-semibold text-gray-600 text-sm">Emisión</th>
                <th className="py-3 px-6 font-semibold text-gray-600 text-sm">Vigencia</th>
                <th className="py-3 px-6 font-semibold text-gray-600 text-sm">Estado</th>
                <th className="py-3 px-6 font-semibold text-gray-600 text-sm text-right">Monto Estimado</th>
              </tr>
            </thead>
            <tbody>
              {cotizacionesVisibles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">No hay cotizaciones registradas.</td>
                </tr>
              ) : (
                cotizacionesVisibles.map((cot, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-6 text-sm">
                      <span
                        onClick={() => openModalCotizacion(cot)}
                        className="text-orange-600 hover:underline cursor-pointer font-medium"
                      >
                        COT-{cot.id_cotizacion}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-900">
                      {new Date(cot.fecha_emision).toLocaleDateString('es-CL', { timeZone: 'UTC' })}
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-500">
                      {cot.fecha_vigencia ? new Date(cot.fecha_vigencia).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : 'N/A'}
                    </td>
                    <td className="py-3 px-6 text-sm">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize
                        ${cot.estado_cotizacion === 'aprobada' ? 'bg-green-100 text-green-700' :
                          cot.estado_cotizacion === 'borrador' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                        {cot.estado_cotizacion}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-sm text-right font-medium text-gray-900">
                      {cot.moneda?.codigo_moneda} {Number(cot.monto_total_estimado).toLocaleString('es-CL')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notas de Venta */}
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary-600" />
        Notas de Venta y Pagos
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-12">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 px-6 font-semibold text-gray-600 text-sm">ID / Folio</th>
                <th className="py-3 px-6 font-semibold text-gray-600 text-sm">Fecha</th>
                <th className="py-3 px-6 font-semibold text-gray-600 text-sm">Estado</th>
                <th className="py-3 px-6 font-semibold text-gray-600 text-sm text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {notasVisibles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">No hay Notas de Venta registradas.</td>
                </tr>
              ) : (
                notasVisibles.map((nv, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-6 text-sm">
                      <span
                        onClick={() => openModalNotaVenta(nv.id_nota_venta)}
                        className="text-orange-600 hover:underline cursor-pointer font-medium"
                      >
                        NV-{nv.id_nota_venta}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-900">
                      {new Date(nv.fecha_emision).toLocaleDateString('es-CL', { timeZone: 'UTC' })}
                    </td>
                    <td className="py-3 px-6 text-sm">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${nv.estadoNotaVentaVisible === 'pagada' ? 'bg-green-100 text-green-700' : nv.estadoNotaVentaVisible === 'parcialmente_pagada' ? 'bg-yellow-100 text-yellow-700' : nv.estado_nota_venta === 'anulada' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {String(nv.estadoNotaVentaVisible || nv.estado_nota_venta).replaceAll('_',' ')}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-sm text-right font-medium text-gray-900">
                      {nv.moneda?.codigo_moneda} {Number(nv.monto_total).toLocaleString('es-CL')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-4">Proyectos relacionados</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr><th className="py-3 px-6">Proyecto</th><th className="py-3 px-6">Estado</th></tr></thead>
          <tbody>{resumen_dashboard.proyectos.map(proyecto => <tr key={proyecto.proyecto_proyecto_id} className="border-t border-gray-100"><td className="py-3 px-6">{proyecto.proyecto_nombre_referencia || proyecto.proyecto_codigo_proyecto}</td><td className="py-3 px-6">{proyecto.proyecto_estado_operacional || 'Sin estado registrado'}</td></tr>)}
          {!resumen_dashboard.proyectos.length && <tr><td colSpan={2} className="py-6 text-center text-gray-500">Sin proyectos asociados.</td></tr>}</tbody>
        </table>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Pagos del cliente</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr><th className="py-3 px-6">Pago</th><th className="py-3 px-6">Estado</th><th className="py-3 px-6">Monto original / efectivo</th></tr></thead>
          <tbody>{resumen_dashboard.pagos.map(pago => <tr key={pago.id_pago_cliente} className="border-t border-gray-100"><td className="py-3 px-6">#{pago.id_pago_cliente} · {new Date(pago.fecha_pago).toLocaleDateString('es-CL', { timeZone: 'UTC' })}</td><td className="py-3 px-6">{pago.anulacion_pago ? 'Anulado' : pago.reversion_pago.length ? 'Con reversión' : pago.estado_verificacion}</td><td className="py-3 px-6">{pago.moneda.codigo_moneda} {Number(pago.monto_pago).toLocaleString('es-CL')} / {pago.montoEfectivo.toLocaleString('es-CL')}</td><td className="py-3 px-6 flex gap-2"><button className="text-primary-700" onClick={()=>operarPago(pago.id_pago_cliente,'comprobante')}>PDF</button>{!pago.anulacion_pago&&<><button className="text-red-700" onClick={()=>operarPago(pago.id_pago_cliente,'anular')}>Anular</button><button className="text-orange-700" onClick={()=>operarPago(pago.id_pago_cliente,'revertir')}>Revertir</button><button className="text-green-700" onClick={()=>operarPago(pago.id_pago_cliente,'conciliar')}>Conciliar</button></>}</td></tr>)}
          {!resumen_dashboard.pagos.length && <tr><td colSpan={3} className="py-6 text-center text-gray-500">Sin pagos registrados.</td></tr>}</tbody>
        </table>
      </div>
      {/* Detalle compartido por cotizaciones y notas */}
      <ModalDetalleDocumento activeModal={activeModal} onClose={() => setActiveModal(null)} onViewPago={verDetallePago}>
        {/* Administración del Documento (Solo NV no anulada) */}
        {activeModal && activeModal.tipo === 'nota_venta' && activeModal.data.estado_nota_venta !== 'anulada' && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            {modalMsg.text && (
              <div className={`p-3 mb-4 text-sm rounded-lg ${modalMsg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {modalMsg.text}
              </div>
            )}
            <h4 className="font-semibold text-gray-900 mb-4">Administración del Documento</h4>
            <div className="flex justify-end">
              <div className="w-1/2 bg-red-50 p-4 rounded-lg border border-red-100 flex flex-col justify-center">
                {mostrarMotivo && (
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-red-800 mb-1">Motivo de anulación (sólo ventas sin pagos):</label>
                    <input
                      type="text"
                      placeholder="Describe el motivo"
                      value={motivoAnulacion}
                      onChange={e => setMotivoAnulacion(e.target.value)}
                      className="w-full p-2 border border-red-300 rounded outline-none text-sm"
                    />
                  </div>
                )}
                {!mostrarMotivo ? (
                  <button
                    onClick={() => setMostrarMotivo(true)}
                    className="w-full px-4 py-2 bg-white text-red-600 border border-red-200 rounded hover:bg-red-50 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" /> Anular Nota de Venta
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMostrarMotivo(false)}
                      className="flex-1 px-3 py-2 bg-white text-gray-600 border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAnular}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-semibold shadow-sm"
                    >
                      Confirmar Anulación
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4"><button onClick={configurarCobro} className="px-3 py-2 border rounded text-sm">Condiciones de cobro</button><button onClick={etapasCobro} className="px-3 py-2 border rounded text-sm">Etapas B2C</button><button onClick={registrarGuia} className="px-3 py-2 border rounded text-sm">Generar Guía</button><button onClick={aplicarSaldo} className="px-3 py-2 border rounded text-sm">Aplicar saldo a favor</button><button onClick={morosidad} className="px-3 py-2 border rounded text-sm">Consultar morosidad</button></div>
          </div>
        )}
      </ModalDetalleDocumento>
      {pagoDetalle && <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6"><div className="flex justify-between mb-4"><h3 className="text-xl font-bold">Detalle de pago #{pagoDetalle.id_pago_cliente}</h3><button className="text-gray-500" onClick={()=>setPagoDetalle(null)}>Cerrar</button></div><dl className="grid grid-cols-2 gap-3 text-sm"><dt className="text-gray-500">Cliente</dt><dd>{resumen.nombre_razon_social_referencia}</dd><dt className="text-gray-500">Nota de Venta</dt><dd>{pagoDetalle.asignacion_pago_cliente?.id_nota_venta || '—'}</dd><dt className="text-gray-500">Categoría</dt><dd>{pagoDetalle.categoria_pago?.nombre || '—'}</dd><dt className="text-gray-500">Medio</dt><dd>{pagoDetalle.medio_pago?.nombre_medio_pago || '—'}</dd><dt className="text-gray-500">Monto</dt><dd>{pagoDetalle.moneda?.codigo_moneda} {Number(pagoDetalle.monto_pago).toLocaleString('es-CL')}</dd><dt className="text-gray-500">Equivalente CLP / tipo cambio</dt><dd>{pagoDetalle.monto_convertido ? `${Number(pagoDetalle.monto_convertido).toLocaleString('es-CL')} / ${pagoDetalle.tipo_cambio_usado}` : '—'}</dd><dt className="text-gray-500">Estado</dt><dd>{pagoDetalle.estado_verificacion}</dd><dt className="text-gray-500">Conciliación</dt><dd>{pagoDetalle.conciliacion?.[0]?.estado_conciliacion || pagoDetalle.estado_conciliacion}</dd><dt className="text-gray-500">Anulación/Reversión</dt><dd>{pagoDetalle.anulacion_pago?'Anulado':pagoDetalle.reversion_pago?.length?'Con reversión':'Sin movimientos'}</dd><dt className="text-gray-500">Documento tributario</dt><dd>{pagoDetalle.asignacion_pago_cliente?.documento_tributario ? `${pagoDetalle.asignacion_pago_cliente.documento_tributario.tipo_documento?.nombre_tipo_documento || 'Documento'} · ${pagoDetalle.asignacion_pago_cliente.documento_tributario.folio_documento}` : '—'}</dd></dl></div></div>}
      {comprobante && <div className="fixed inset-0 z-[70] bg-slate-900/60 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-5"><div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">Comprobante de pago</h3><button className="text-gray-500" onClick={()=>setComprobante(null)}>Cerrar</button></div><iframe title="Vista previa del comprobante" src={comprobante.contenido} className="w-full h-[65vh] border rounded"/><div className="flex justify-end gap-3 mt-4"><button type="button" className="px-4 py-2 border rounded" onClick={()=>window.open(comprobante.contenido,'_blank','noopener,noreferrer')}>Abrir para imprimir</button><a className="px-4 py-2 bg-primary-600 text-white rounded" href={comprobante.contenido} download={comprobante.nombre}>Descargar PDF</a></div></div></div>}
    </div>
  );
};

export default VerFicha;


