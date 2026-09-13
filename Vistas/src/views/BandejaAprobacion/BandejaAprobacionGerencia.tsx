import { solicitarFinanzas } from '../../api/finanzas';
import React, { useState, useEffect } from 'react';
import { Check, X, AlertTriangle, Edit2 } from 'lucide-react';
import ModalDetalleDocumento from '../../components/ModalDetalleDocumento';

const BandejaAprobacionGerencia: React.FC = () => {
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [notasVenta, setNotasVenta] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState({ text: '', type: '' });

  const [historyCots, setHistoryCots] = useState<any[]>([]);
  const [historyNvs, setHistoryNvs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'cotizaciones' | 'notas' | 'historial'>('cotizaciones');
  const [activeModal, setActiveModal] = useState<{ tipo: 'cotizacion' | 'nota_venta', data: any } | null>(null);

  const fetchPendientes = () => {
    setLoading(true);
    solicitarFinanzas('/billing/pending-approvals')
      .then(res => res.json())
      .then(data => {
        setCotizaciones(data.cotizaciones || []);
        setNotasVenta(data.notas_venta || []);
      })
      .catch(() => setMensaje({ text: 'Error al cargar aprobaciones', type: 'error' }))
      .finally(() => setLoading(false));
  };

  const fetchHistory = () => {
    solicitarFinanzas('/billing/history')
      .then(res => res.json())
      .then(data => {
        setHistoryCots(data.cotizaciones || []);
        setHistoryNvs(data.notas_venta || []);
      })
      .catch(e => console.error(e));
  };

  useEffect(() => {
    fetchPendientes();
    fetchHistory();
  }, []);

  const [approvingQuoteId, setApprovingQuoteId] = useState<number | null>(null);
  const [editingQuote, setEditingQuote] = useState<any | null>(null);
  const [plazoPago, setPlazoPago] = useState<number>(30);

  const handleEditSave = async (id: number, data: any) => {
    try {
      const res = await solicitarFinanzas(`/billing/quotes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) { const resultado = await res.json(); throw new Error(resultado.error || 'Error al actualizar cotización'); }
      setMensaje({ text: 'Cotización actualizada', type: 'success' });
      setEditingQuote(null);
      fetchPendientes();
    } catch (e: any) {
      setMensaje({ text: e.message, type: 'error' });
    }
  };

  const handleApprove = async (tipo: 'quotes' | 'nota-venta', id: number) => {
    if (tipo === 'quotes' && approvingQuoteId !== id) {
      setApprovingQuoteId(id);
      return;
    }

    try {
      const endpoint = tipo === 'quotes' ? `/billing/quotes/${id}/accept-b2b` : `/billing/${tipo}/${id}/approve`;
      const folioOrdenCompra = tipo === 'quotes' ? window.prompt('Folio de la Orden de Compra B2B:') : '';
      if (tipo === 'quotes' && !folioOrdenCompra) { setApprovingQuoteId(null); return; }
      const res = await solicitarFinanzas(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: tipo === 'quotes' ? JSON.stringify({ plazo_pago: plazoPago, folioOrdenCompra, respaldoOrdenCompra: `Registro de Orden de Compra ${folioOrdenCompra}` }) : undefined
      });
      if (!res.ok) { const resultado = await res.json(); throw new Error(resultado.error || 'Error al aprobar'); }
      const data = await res.json();
      setMensaje({ text: `Documento aprobado exitosamente`, type: 'success' });
      setApprovingQuoteId(null);
      fetchPendientes();
      fetchHistory();
      
      if (data.documento) {
        setActiveModal({ tipo: 'nota_venta', data: data.documento });
      }
    } catch (e: any) {
      setMensaje({ text: e.message, type: 'error' });
      setApprovingQuoteId(null);
    }
  };

  const handleReject = async (tipo: 'quotes' | 'nota-venta', item: any) => {
    let folioNotaCredito = '';
    const id = tipo === 'quotes' ? item.id_cotizacion : item.id_nota_venta;

    if (tipo === 'nota-venta') {
      // si hay factura o pagos, pedimos el folio de la nota de crédito
      const hasFactura = item.documento_tributario?.some((doc: any) => 
        doc.tipo_documento?.nombre_tipo_documento === 'Factura Electrónica' || doc.id_tipo_documento === 1 /* ID de factura en el catálogo heredado */
      ) || item.estado_nota_venta === 'FACTURADA';

      const hasPayments = item.estado_pago !== 'pendiente' || (item.asignacion_pago_cliente && item.asignacion_pago_cliente.length > 0);

      if (hasFactura || hasPayments) {
        const folio = window.prompt('Venta facturada o con pagos registrados. Ingrese folio de Nota de Crédito SII:');
        if (!folio || folio.trim() === '') {
          alert('Acción denegada por cumplimiento tributario');
          return;
        }
        folioNotaCredito = folio.trim();
      } else {
        if (!window.confirm('¿Está seguro de rechazar/anular este documento?')) return;
      }
    } else {
      if (!window.confirm('¿Está seguro de rechazar este documento?')) return;
    }

    try {
      const endpoint = tipo === 'quotes' ? `/quotes/${id}/reject` : `/nota-venta/${id}/anular`;
      const res = await solicitarFinanzas(`/billing${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folio_nota_credito: folioNotaCredito })
      });
      if (!res.ok) {
        const errData = await res.json().catch(()=>({}));
        throw new Error(errData.error || 'Error al rechazar/anular');
      }
      setMensaje({ text: `Documento rechazado/anulado exitosamente`, type: 'success' });
      // Hope: la fila sale de pendientes y conserva su nuevo estado en el historial
      if (tipo === 'nota-venta') {
        setNotasVenta(prev => prev.filter(nv => nv.id_nota_venta !== id));
        setHistoryNvs(prev => prev.map(nv => nv.id_nota_venta === id ? { ...nv, estado_nota_venta: 'anulada' } : nv));
      } else {
        setCotizaciones(prev => prev.filter(c => c.id_cotizacion !== id));
        setHistoryCots(prev => prev.map(c => c.id_cotizacion === id ? { ...c, estado_cotizacion: 'rechazada' } : c));
      }
      fetchPendientes();
      fetchHistory();
    } catch (e: any) {
      setMensaje({ text: e.message, type: 'error' });
    }
  };
  const reactivar = async (id:number) => { const fecha=window.prompt('Nueva fecha de vigencia AAAA-MM-DD'); if(!fecha)return; const r=await solicitarFinanzas(`/billing/quotes/${id}/reactivar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fechaVigencia:fecha})}); const d=await r.json(); setMensaje({text:r.ok?'Cotización reactivada':d.error,type:r.ok?'success':'error'}); if(r.ok){fetchPendientes();fetchHistory();} };

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const filterAndSortData = (data: any[], type: 'cotizacion' | 'nota_venta') => {
    let result = data;
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => {
        const id = type === 'cotizacion' ? `COT-${item.id_cotizacion}` : `NV-${item.id_nota_venta}`.toLowerCase();
        const rut = String(item.ficha_cliente?.cliente_financiero?.rut_cliente || '').toLowerCase();
        const name = String(item.ficha_cliente?.cliente_financiero?.nombre_razon_social_referencia || '').toLowerCase();
        return id.includes(lowerSearch) || rut.includes(lowerSearch) || name.includes(lowerSearch);
      });
    }

    return result.sort((a, b) => {
      const dateA = new Date(a.fecha_emision).getTime();
      const dateB = new Date(b.fecha_emision).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  };

  const filteredCotizaciones = filterAndSortData(cotizaciones, 'cotizacion');
  const filteredNotas = filterAndSortData(notasVenta, 'nota_venta');
  const filteredHistoryCots = filterAndSortData(historyCots, 'cotizacion');
  const filteredHistoryNvs = filterAndSortData(historyNvs, 'nota_venta');

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans relative">
      <div className="mb-8 border-b pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
            Gestión de Aprobaciones
          </h1>
          <p className="text-gray-500 mt-2">Consulta, edición, emisión y aceptación de Cotizaciones y Notas de Venta.</p>
        </div>
        <div className="w-96 flex gap-2">
          <input
            type="text"
            placeholder="Buscar por ID, RUT o Cliente..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button 
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium text-sm flex items-center gap-1 transition-colors"
            title="Ordenar por fecha"
          >
            {sortOrder === 'desc' ? '↓ Más recientes' : '↑ Más antiguos'}
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('cotizaciones')}
          className={`pb-2 px-4 font-semibold text-sm transition-colors ${activeTab === 'cotizaciones' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 hover:text-gray-800'}`}
        >
          Cotizaciones Pendientes ({filteredCotizaciones.length})
        </button>
        <button 
          onClick={() => setActiveTab('notas')}
          className={`pb-2 px-4 font-semibold text-sm transition-colors ${activeTab === 'notas' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 hover:text-gray-800'}`}
        >
          Notas de Venta Pendientes ({filteredNotas.length})
        </button>
        <button 
          onClick={() => setActiveTab('historial')}
          className={`pb-2 px-4 font-semibold text-sm transition-colors ${activeTab === 'historial' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 hover:text-gray-800'}`}
        >
          Historial
        </button>
      </div>

      {mensaje.text && (
        <div className={`p-4 mb-6 rounded-lg font-medium ${mensaje.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {mensaje.text}
        </div>
      )}

      {loading ? (
        <div className="text-center p-8 text-gray-500">Cargando datos...</div>
      ) : (
        <div className="space-y-8">
          {/* Tab: Cotizaciones Pendientes */}
          {activeTab === 'cotizaciones' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-3 px-6 font-semibold text-gray-600 text-sm">ID</th>
                    <th className="py-3 px-6 font-semibold text-gray-600 text-sm">RUT / Cliente</th>
                    <th className="py-3 px-6 font-semibold text-gray-600 text-sm">Emisión</th>
                    <th className="py-3 px-6 font-semibold text-gray-600 text-sm">Monto Total</th>
                    <th className="py-3 px-6 font-semibold text-gray-600 text-sm text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCotizaciones.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-gray-500">No hay cotizaciones pendientes.</td></tr>
                  ) : filteredCotizaciones.map(cot => (
                    <tr key={cot.id_cotizacion} className="border-b border-gray-100 hover:bg-gray-50">
                      <td 
                        className="py-3 px-6 font-medium text-orange-600 hover:underline cursor-pointer"
                        onClick={() => setActiveModal({ tipo: 'cotizacion', data: cot })}
                      >
                        COT-{cot.id_cotizacion}
                      </td>
                      <td className="py-3 px-6 text-sm">
                        <div className="font-semibold text-gray-800">{cot.ficha_cliente?.cliente_financiero?.rut_cliente}</div>
                        <div className="text-gray-500">{cot.ficha_cliente?.cliente_financiero?.nombre_razon_social_referencia || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-6 text-sm">{new Date(cot.fecha_emision).toLocaleDateString('es-CL', { timeZone: 'UTC' })}</td>
                      <td className="py-3 px-6 font-medium text-orange-600">${Number(cot.monto_total_estimado).toLocaleString('es-CL')}</td>
                      <td className="py-3 px-6 text-right flex justify-end gap-2">
                        <button
                          onClick={() => window.location.href = `/cotizacion/nueva?borrador=${cot.id_cotizacion}`}
                          className="p-1.5 rounded-full hover:bg-blue-50 text-blue-500 border border-transparent hover:border-blue-200 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        {approvingQuoteId === cot.id_cotizacion ? (
                          <div className="flex items-center gap-2 bg-green-50 p-1 rounded border border-green-200">
                            <select 
                              value={plazoPago} 
                              onChange={(e) => setPlazoPago(Number(e.target.value))}
                              className="text-xs p-1 border rounded"
                            >
                              <option value={30}>30 días</option>
                              <option value={60}>60 días</option>
                              <option value={90}>90 días</option>
                            </select>
                            <button onClick={() => handleApprove('quotes', cot.id_cotizacion)} className="p-1 bg-green-600 text-white rounded text-xs font-bold px-2">Confirmar</button>
                            <button onClick={() => setApprovingQuoteId(null)} className="p-1 bg-gray-200 text-gray-700 rounded text-xs px-2">Cancelar</button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => handleApprove('quotes', cot.id_cotizacion)} className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded" title="Aprobar">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleReject('quotes', cot)} className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded" title="Rechazar">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab: Notas de Venta Pendientes */}
          {activeTab === 'notas' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-3 px-6 font-semibold text-gray-600 text-sm">ID</th>
                    <th className="py-3 px-6 font-semibold text-gray-600 text-sm">RUT / Cliente</th>
                    <th className="py-3 px-6 font-semibold text-gray-600 text-sm">Emisión</th>
                    <th className="py-3 px-6 font-semibold text-gray-600 text-sm">Monto Total</th>
                    <th className="py-3 px-6 font-semibold text-gray-600 text-sm text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNotas.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-gray-500">No hay Notas de Venta pendientes.</td></tr>
                  ) : filteredNotas.map(nv => (
                    <tr key={nv.id_nota_venta} className="border-b border-gray-100 hover:bg-gray-50">
                      <td 
                        className="py-3 px-6 font-medium text-orange-600 hover:underline cursor-pointer"
                        onClick={() => setActiveModal({ tipo: 'nota_venta', data: nv })}
                      >
                        NV-{nv.id_nota_venta}
                      </td>
                      <td className="py-3 px-6 text-sm">
                        <div className="font-semibold text-gray-800">{nv.ficha_cliente?.cliente_financiero?.rut_cliente}</div>
                        <div className="text-gray-500">{nv.ficha_cliente?.cliente_financiero?.nombre_razon_social_referencia || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-6 text-sm">{new Date(nv.fecha_emision).toLocaleDateString('es-CL', { timeZone: 'UTC' })}</td>
                      <td className="py-3 px-6 font-medium text-orange-600">${Number(nv.monto_total).toLocaleString('es-CL')}</td>
                      <td className="py-3 px-6 text-right flex justify-end gap-2">
                        <button onClick={() => handleApprove('nota-venta', nv.id_nota_venta)} className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded" title="Aprobar">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleReject('nota-venta', nv)} className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded" title="Rechazar">
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab: Historial */}
          {activeTab === 'historial' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-700">Cotizaciones Procesadas ({filteredHistoryCots.length})</h3>
              </div>
              <table className="w-full text-left border-collapse border-b border-gray-200 mb-8">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="py-2 px-6 font-semibold text-gray-600 text-xs">ID</th>
                    <th className="py-2 px-6 font-semibold text-gray-600 text-xs">Cliente</th>
                    <th className="py-2 px-6 font-semibold text-gray-600 text-xs">Estado</th>
                    <th className="py-2 px-6 font-semibold text-gray-600 text-xs">Monto Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistoryCots.length === 0 ? (
                    <tr><td colSpan={4} className="py-4 text-center text-gray-500 text-sm">No hay cotizaciones históricas.</td></tr>
                  ) : filteredHistoryCots.map(cot => (
                    <tr key={`hc-${cot.id_cotizacion}`} className="border-b border-gray-100 hover:bg-gray-50 text-sm">
                      <td className="py-2 px-6 font-medium text-orange-600 hover:underline cursor-pointer" onClick={() => setActiveModal({ tipo: 'cotizacion', data: cot })}>COT-{cot.id_cotizacion}</td>
                      <td className="py-2 px-6">{cot.ficha_cliente?.cliente_financiero?.nombre_razon_social_referencia || cot.ficha_cliente?.cliente_financiero?.rut_cliente}</td>
                      <td className="py-2 px-6">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${cot.estado_cotizacion === 'aprobada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {cot.estado_cotizacion.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-6">${Number(cot.monto_total_estimado).toLocaleString('es-CL')} {cot.estado_cotizacion==='vencida'&&<button onClick={()=>reactivar(cot.id_cotizacion)} className="ml-3 text-primary-700 underline">Reactivar</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-700">Notas de Venta Procesadas ({filteredHistoryNvs.length})</h3>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="py-2 px-6 font-semibold text-gray-600 text-xs">ID</th>
                    <th className="py-2 px-6 font-semibold text-gray-600 text-xs">Cliente</th>
                    <th className="py-2 px-6 font-semibold text-gray-600 text-xs">Estado</th>
                    <th className="py-2 px-6 font-semibold text-gray-600 text-xs">Monto Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistoryNvs.length === 0 ? (
                    <tr><td colSpan={4} className="py-4 text-center text-gray-500 text-sm">No hay notas históricas.</td></tr>
                  ) : filteredHistoryNvs.map(nv => (
                    <tr key={`hnv-${nv.id_nota_venta}`} className="border-b border-gray-100 hover:bg-gray-50 text-sm">
                      <td className="py-2 px-6 font-medium text-orange-600 hover:underline cursor-pointer" onClick={() => setActiveModal({ tipo: 'nota_venta', data: nv })}>NV-{nv.id_nota_venta}</td>
                      <td className="py-2 px-6">{nv.ficha_cliente?.cliente_financiero?.nombre_razon_social_referencia || nv.ficha_cliente?.cliente_financiero?.rut_cliente}</td>
                      <td className="py-2 px-6">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${nv.estado_nota_venta === 'anulada' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {nv.estado_nota_venta.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-6">${Number(nv.monto_total).toLocaleString('es-CL')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Desglose (Universal) */}
      <ModalDetalleDocumento activeModal={activeModal} onClose={() => setActiveModal(null)} />

      {/* Modal Editar Cotizacion */}
      {editingQuote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Editar Cotización COT-{editingQuote.id_cotizacion}</h2>
              <button onClick={() => setEditingQuote(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const det0 = editingQuote.detalle_cotizacion?.[0];
              const materiales = det0?.detalle_costo_material_cotizacion?.map((mat: any, idx: number) => ({
                id_detalle_costo_material_cotizacion: mat.id_detalle_costo_material_cotizacion,
                cantidad: fd.get(`mat_cantidad_${idx}`),
                costo_ajustado: fd.get(`mat_costo_${idx}`)
              })) || [];
              handleEditSave(editingQuote.id_cotizacion, {
                margen_esperado: fd.get('margen'),
                precio_sugerido: fd.get('precio_sugerido'),
                observacion: fd.get('observacion'),
                materiales
              });
            }}>
              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

                {/* Los datos del cliente se mantienen al ajustar la cotización */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cliente (solo lectura)</label>
                  <div className="p-3 bg-gray-100 rounded-lg text-sm text-gray-700 font-medium">
                    {editingQuote.ficha_cliente?.cliente_financiero?.nombre_razon_social_referencia || '—'}
                    <span className="text-gray-400 ml-2 text-xs">RUT: {editingQuote.ficha_cliente?.cliente_financiero?.rut_cliente || '—'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo de Producto (solo lectura)</label>
                  <div className="p-3 bg-gray-100 rounded-lg text-sm text-gray-700">
                    {editingQuote.detalle_cotizacion?.[0]?.item_comercial?.nombre_item || `ID ${editingQuote.detalle_cotizacion?.[0]?.id_item_comercial || '—'}`}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Medidas Referenciales (solo lectura)</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(() => {
                      const det = editingQuote.detalle_cotizacion?.[0];
                      let alto = Number(det?.medida_alto_referencial || 0);
                      let ancho = Number(det?.medida_ancho_referencial || 0);
                      let espesor = Number(det?.medida_espesor_referencial || 0);

                      if (alto === 0 && ancho === 0 && espesor === 0 && det?.descripcion_item_cotizado) {
                        const match = det.descripcion_item_cotizado.match(/(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)/);
                        if (match) {
                          alto = Number(match[1]);
                          ancho = Number(match[2]);
                          espesor = Number(match[3]);
                        }
                      }

                      return [
                        ['Alto', alto],
                        ['Ancho', ancho],
                        ['Grosor', espesor]
                      ].map(([label, val]) => (
                        <div key={label as string} className="p-3 bg-gray-100 rounded-lg text-center">
                          <span className="text-xs text-gray-400 block">{label} (mm)</span>
                          <span className="font-mono font-semibold text-gray-700">{val as number}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-200 pt-4">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">⬇ Campos Editables</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Margen Esperado (%)</label>
                  <input type="number" name="margen" step="1" min="0" max="99"
                    onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                    defaultValue={Number(editingQuote.margen_esperado || 0)}
                    className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-200" required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Precio sugerido calculado</label><div className="p-2 bg-gray-100 rounded-lg font-mono">${Number(editingQuote.precio_sugerido || 0).toLocaleString('es-CL')}</div></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Precio definido para la cotización</label><input type="number" name="precio_sugerido" min="0.01" step="0.01" defaultValue={Number(editingQuote.precio_sugerido || 0)} className="w-full p-2 border border-blue-300 rounded-lg" required /></div>
                </div>

                {/* Materiales: solo Cantidad editable */}
                {editingQuote.detalle_cotizacion?.[0]?.detalle_costo_material_cotizacion?.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Materiales — solo Cantidad es editable</label>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-3 py-2 text-gray-600">Material</th>
                            <th className="px-3 py-2 text-gray-600 text-right">Costo calculado / usado</th>
                            <th className="px-3 py-2 text-gray-600 text-center w-32">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editingQuote.detalle_cotizacion[0].detalle_costo_material_cotizacion.map((mat: any, idx: number) => (
                            <tr key={idx} className="border-b last:border-0">
                              <td className="px-3 py-2 font-medium">
                                {mat.historial_precio_material?.material?.material_nombre_material || mat.historial_precio_material?.material_sku || `Material ${idx + 1}`}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-400 font-mono text-xs">
                                <span className="block">${Number(mat.historial_precio_material?.precio_unitario || mat.precio_unitario_usado).toLocaleString('es-CL')}</span>
                                <input type="number" name={`mat_costo_${idx}`} min="0" step="0.01" defaultValue={Number(mat.precio_unitario_usado)} className="mt-1 w-28 p-1 border border-blue-300 rounded text-right" />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input type="number" step="1" min="0" name={`mat_cantidad_${idx}`}
                                  onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                                  defaultValue={Number(mat.cantidad_material_estimada)}
                                  className="w-24 p-1 border border-blue-300 rounded text-center focus:ring-1 focus:ring-blue-200" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones Generales</label>
                  <textarea name="observacion" rows={2}
                    defaultValue={editingQuote.observacion || ''}
                    className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-200"></textarea>
                </div>
              </div>
              <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
                <button type="button" onClick={() => setEditingQuote(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium">Cancelar</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BandejaAprobacionGerencia;
