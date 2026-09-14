import OperacionesFinancieras from './OperacionesFinancieras';
import { solicitarFinanzas } from '../api/finanzas';
import React, { useState } from 'react';
import { X, DollarSign } from 'lucide-react';

interface ModalDetalleDocumentoProps {
  activeModal: { tipo: 'cotizacion' | 'nota_venta', data: any } | null;
  onClose: () => void;
  children?: React.ReactNode;
  onViewPago?: (id: number) => void;
}

const ModalDetalleDocumento: React.FC<ModalDetalleDocumentoProps> = ({ activeModal, onClose, children, onViewPago }) => {
  const [guiaEdit, setGuiaEdit] = useState<any>(null);
  const [guiaFolio, setGuiaFolio] = useState('');
  const [guiaAntecedentes, setGuiaAntecedentes] = useState('');
  const [documentoExterno, setDocumentoExterno] = useState({ tipo: 'Factura Electrónica', folio: '', fechaEmision: new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago'}).format(new Date()), fechaVencimiento: '', montoNeto: '', montoImpuesto: '', montoTotal: '', respaldo: '', observacion: '', idsNotas: '' });
  if (!activeModal) return null;
  const guias = activeModal.data.guia_despacho || [];

  const guardarGuia = async () => {
    if (!guiaEdit || !guiaFolio.trim()) return;
    const respuesta = await solicitarFinanzas(`/billing/guides/${guiaEdit.id_guia_despacho}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folio: guiaFolio.trim(), antecedentes: guiaAntecedentes ? { texto: guiaAntecedentes } : undefined }) });
    if (!respuesta.ok) { const error = await respuesta.json(); window.alert(error.error || 'No se pudo modificar la guía'); return; }
    window.location.reload();
  };

  const registrarDocumentoExterno = async () => {
    const ids = (documentoExterno.idsNotas || String(activeModal.data.id_nota_venta)).split(',').map(valor=>Number(valor.trim())).filter(Number.isSafeInteger);
    const respuesta = await solicitarFinanzas('/billing/documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo_documento:documentoExterno.tipo,folio:documentoExterno.folio,fecha_emision:documentoExterno.fechaEmision,fecha_vencimiento:documentoExterno.fechaVencimiento||undefined,monto_neto:Number(documentoExterno.montoNeto),monto_impuesto:Number(documentoExterno.montoImpuesto),monto_total:Number(documentoExterno.montoTotal),respaldo:documentoExterno.respaldo,observacion:documentoExterno.observacion,ids_notas_venta:ids})});
    const resultado=await respuesta.json(); if(!respuesta.ok){window.alert(resultado.error||'No se pudo registrar el documento');return;} window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {activeModal.tipo === 'cotizacion' ? `COT-${activeModal.data.id_cotizacion}` : `NV-${activeModal.data.id_nota_venta || activeModal.data.numero_nota_venta}`}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {activeModal.data.ficha_cliente?.cliente_financiero?.nombre_razon_social_referencia || '—'}
              <span className="mx-2 text-gray-300">|</span>
              RUT: {activeModal.data.ficha_cliente?.cliente_financiero?.rut_cliente || '—'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Info general */}
          <div className="grid grid-cols-3 gap-3 text-sm bg-gray-50 p-4 rounded-lg">
            <div><span className="text-gray-500 block text-xs">Fecha Emisión</span><span className="font-medium">{new Date(activeModal.data.fecha_emision).toLocaleDateString('es-CL', { timeZone: 'UTC' })}</span></div>
            <div><span className="text-gray-500 block text-xs">Estado</span>
              <span className={`font-semibold uppercase text-xs px-2 py-0.5 rounded ${
                (activeModal.data.estado_cotizacion === 'aprobada' || activeModal.data.estado_nota_venta === 'confirmada') ? 'bg-green-100 text-green-700' :
                (activeModal.data.estado_cotizacion === 'rechazada' || activeModal.data.estado_nota_venta === 'anulada') ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              }`}>{activeModal.tipo === 'cotizacion' ? activeModal.data.estado_cotizacion : String(activeModal.data.estadoNotaVentaVisible || activeModal.data.estado_nota_venta).replaceAll('_',' ')}</span>
            </div>
            {activeModal.tipo === 'nota_venta' && <div><span className="text-gray-500 block text-xs">Estado de pago</span><span className={`font-semibold uppercase text-xs px-2 py-0.5 rounded ${activeModal.data.estadoPago === 'pagada' ? 'bg-green-100 text-green-700' : activeModal.data.estadoPago === 'parcial' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{['anulada','revertida_total'].includes(activeModal.data.estado_nota_venta) ? 'Sin obligación' : activeModal.data.estadoPago || activeModal.data.estado_pago}</span></div>}
            <div><span className="text-gray-500 block text-xs">Tipo Producto</span><span className="font-medium">{activeModal.data.detalle_cotizacion?.[0]?.item_comercial?.nombre_item || '—'}</span></div>
            {activeModal.data.observacion && activeModal.data.observacion !== 'PENDIENTE_APROBACION' && (
              <div className="col-span-3"><span className="text-gray-500 block text-xs">Observación</span><span>{activeModal.data.observacion}</span></div>
            )}
          </div>

          {/* Medidas */}
          {activeModal.tipo === 'cotizacion' && activeModal.data.detalle_cotizacion?.[0] && (() => {
            const det = activeModal.data.detalle_cotizacion[0];
            // las cotizaciones nuevas ya traen las medidas en sus campos
            let alto = Number(det.medida_alto_referencial || 0);
            let ancho = Number(det.medida_ancho_referencial || 0);
            let espesor = Number(det.medida_espesor_referencial || 0);

            // Castaña: para las antiguas queda el rescate desde "Puerta (120x80x5)"
            if (alto === 0 && ancho === 0 && espesor === 0 && det.descripcion_item_cotizado) {
              const match = det.descripcion_item_cotizado.match(/(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)/);
              if (match) {
                alto = Number(match[1]);
                ancho = Number(match[2]);
                espesor = Number(match[3]);
              }
            }

            if (alto === 0 && ancho === 0 && espesor === 0) return null;

            return (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Medidas Referenciales</h4>
                <div className="grid grid-cols-3 gap-3 text-sm bg-blue-50 p-3 rounded-lg">
                  <div><span className="text-blue-500 block text-xs">Alto (mm)</span><span className="font-mono font-medium">{alto}</span></div>
                  <div><span className="text-blue-500 block text-xs">Ancho (mm)</span><span className="font-mono font-medium">{ancho}</span></div>
                  <div><span className="text-blue-500 block text-xs">Grosor (mm)</span><span className="font-mono font-medium">{espesor}</span></div>
                </div>
              </div>
            );
          })()}

          {/* Tabla materiales */}
          {activeModal.tipo === 'cotizacion' && activeModal.data.detalle_cotizacion?.[0]?.detalle_costo_material_cotizacion?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Materiales Incluidos</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-gray-600 font-medium">Material</th>
                      <th className="px-4 py-2 text-gray-600 font-medium text-right">Cantidad</th>
                      <th className="px-4 py-2 text-gray-600 font-medium text-right">P. Unitario</th>
                      <th className="px-4 py-2 text-gray-600 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeModal.data.detalle_cotizacion[0].detalle_costo_material_cotizacion.map((mat: any, i: number) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2">{mat.historial_precio_material?.material?.material_nombre_material || mat.historial_precio_material?.material_sku || '—'}</td>
                        <td className="px-4 py-2 text-right font-mono">{Number(mat.cantidad_material_estimada)}</td>
                        <td className="px-4 py-2 text-right font-mono">${Number(mat.precio_unitario_usado).toLocaleString('es-CL')}</td>
                        <td className="px-4 py-2 text-right font-mono font-medium">${Number(mat.subtotal_material_estimado).toLocaleString('es-CL')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* LUNA: un poco de aire para leer los totales */}
          {(() => {
            const isForeign = activeModal.data.moneda?.codigo_moneda !== 'CLP';
            const sym = isForeign ? `${activeModal.data.moneda?.codigo_moneda || ''} ` : '$';
            const isExento = activeModal.data.exento_iva;

            return (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700">Resumen Financiero</h4>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${isExento ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-800'}`}>
                    {isExento ? 'Exento de IVA' : 'Incluye IVA'}
                  </span>
                </div>
                {activeModal.tipo === 'cotizacion' ? (
                  <>
                    <div className="flex justify-between text-gray-600"><span>Subtotal Costos</span><span className="font-mono">{sym}{Number(activeModal.data.subtotal_costos_estimados || 0).toLocaleString('es-CL')}</span></div>
                    <div className="flex justify-between text-gray-600"><span>Precio Sugerido (Neto)</span><span className="font-mono">{sym}{Number(activeModal.data.precio_sugerido || 0).toLocaleString('es-CL')}</span></div>
                    {Number(activeModal.data.margen_esperado) > 0 && <div className="flex justify-between text-gray-600"><span>Margen</span><span className="font-mono">{Number(activeModal.data.margen_esperado)}%</span></div>}
                    <div className="flex justify-between font-bold text-gray-900 text-base border-t pt-2 mt-1"><span>Total Estimado</span><span className="font-mono">{sym}{Number(activeModal.data.monto_total_estimado || 0).toLocaleString('es-CL')}</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-gray-600"><span>Monto Neto</span><span className="font-mono">{sym}{Number(activeModal.data.monto_neto || 0).toLocaleString('es-CL')}</span></div>
                    {Number(activeModal.data.descuento_aplicado) > 0 && <div className="flex justify-between text-orange-600"><span>Descuento Aplicado</span><span className="font-mono">-{sym}{Number(activeModal.data.descuento_aplicado).toLocaleString('es-CL')}</span></div>}
                    <div className="flex justify-between text-gray-600"><span>IVA (19%)</span><span className="font-mono">{sym}{Number(activeModal.data.monto_impuesto || 0).toLocaleString('es-CL')}</span></div>
                    <div className="flex justify-between font-bold text-gray-900 text-base border-t pt-2 mt-1"><span>Total Final</span><span className="font-mono">{sym}{Number(activeModal.data.monto_total || 0).toLocaleString('es-CL')}</span></div>
                  </>
                )}
                {isForeign && (
                  <div className="border-t pt-3 mt-3">
                    <div className="text-lg font-bold text-slate-800">Monto Original: {Number(activeModal.data.monto_total || activeModal.data.monto_total_estimado || 0).toLocaleString('es-CL')} {activeModal.data.moneda?.codigo_moneda || 'USD'}</div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Pagos de la Nota de Venta (Solo NV) */}
          {activeModal.tipo === 'nota_venta' && (
            <div className="pt-4 border-t border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Historial de Pagos de la Transacción
              </h4>
              
              {(() => {
                const totalPagadoNV = Number(activeModal.data.pagosEfectivos || 0);
                const saldoNV = Number(activeModal.data.saldoPendiente || 0);
                const isForeign = activeModal.data.moneda?.codigo_moneda !== 'CLP';
                const sigla = activeModal.data.moneda?.codigo_moneda || 'USD';

                return (
                  <div className="flex gap-4 mb-4">
                    <div className="bg-green-50 text-green-800 px-4 py-2 rounded-lg text-sm border border-green-100 flex-1">
                      <span className="font-semibold">Total Pagado:</span> {isForeign ? '' : '$'}{totalPagadoNV.toLocaleString('es-CL', { maximumFractionDigits: 0 })} {isForeign ? sigla : ''}
                    </div>
                    <div className="bg-orange-50 text-orange-800 px-4 py-2 rounded-lg text-sm border border-orange-100 flex-1 flex items-center">
                      {isForeign ? (
                        <div className="flex flex-col">
                          <span><span className="font-semibold">Falta por Pagar (Original):</span> {saldoNV.toLocaleString('es-CL', { maximumFractionDigits: 0 })} {sigla}</span>
                        </div>
                      ) : (
                        <span><span className="font-semibold">Falta por Pagar:</span> ${saldoNV.toLocaleString('es-CL', { maximumFractionDigits: 0 })} CLP</span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {(!activeModal.data.asignacion_pago_cliente || activeModal.data.asignacion_pago_cliente.length === 0) ? (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 text-center">
                  Esta nota de venta aún no tiene pagos registrados.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="py-2 px-3 font-semibold text-gray-600">ID Pago</th>
                        <th className="py-2 px-3 font-semibold text-gray-600">Fecha</th>
                        <th className="py-2 px-3 font-semibold text-gray-600">Método</th>
                        <th className="py-2 px-3 font-semibold text-gray-600">Estado</th>
                        <th className="py-2 px-3 font-semibold text-gray-600 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeModal.data.asignacion_pago_cliente.map((asig: any, pIdx: number) => (
                        <tr key={pIdx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-800">
                            Pago #{asig.pago_cliente?.id_pago_cliente}
                            {onViewPago && <button className="ml-2 text-primary-700 text-xs underline" onClick={() => onViewPago(Number(asig.pago_cliente?.id_pago_cliente))}>Ver detalle</button>}
                          </td>
                          <td className="py-2 px-3 text-gray-600">
                            {new Date(asig.pago_cliente?.fecha_pago).toLocaleDateString('es-CL', { timeZone: 'UTC' })}
                          </td>
                          <td className="py-2 px-3 text-gray-600 capitalize">
                            {asig.pago_cliente?.medio_pago?.nombre_medio_pago || 'N/A'}
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-green-50 text-green-700 capitalize">
                              {asig.pago_cliente?.anulacion_pago ? 'Anulado' : asig.pago_cliente?.reversion_pago?.length ? 'Con reversión' : asig.pago_cliente?.estado_verificacion}
                           </span>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-green-600">
                            +${Number(asig.monto_asignado).toLocaleString('es-CL')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Documentos Asociados (Solo NV) */}
          {activeModal.tipo === 'nota_venta' && (
            <div className="pt-4 border-t border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Documentos Asociados (Folios)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Guía de Despacho</label>
                  <div className="flex gap-2">
                    <input type="text" id="input_guia" placeholder="Ej: 99402" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                    <button onClick={async () => {
                      const input = document.getElementById('input_guia') as HTMLInputElement;
                      if (!input.value) return;
                      try {
                        const res = await solicitarFinanzas('/billing/documents', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id_nota_venta: activeModal.data.id_nota_venta, tipo_documento: 'guia_despacho', folio: input.value })
                        });
                        const data = await res.json();
                        if (res.ok) { alert('Guía de Despacho vinculada correctamente'); input.value = ''; }
                        else { alert(data.error || 'Error al vincular Guía'); }
                      } catch (e) { alert('Error de conexión'); }
                    }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors">Vincular</button>
                  </div>
                  {guias.map((guia: any) => <div key={guia.id_guia_despacho} className="mt-3 p-2 bg-blue-50 rounded text-sm"><div className="flex justify-between"><span>Guía {guia.folio}</span><button className="text-blue-700 font-medium" onClick={() => { setGuiaEdit(guia); setGuiaFolio(guia.folio); setGuiaAntecedentes(guia.antecedentes?.texto || ''); }}>Editar/Modificar</button></div>{guiaEdit?.id_guia_despacho === guia.id_guia_despacho && <div className="mt-2 space-y-2"><input className="w-full border rounded p-2" value={guiaFolio} onChange={e=>setGuiaFolio(e.target.value)} placeholder="Folio vigente"/><textarea className="w-full border rounded p-2" value={guiaAntecedentes} onChange={e=>setGuiaAntecedentes(e.target.value)} placeholder="Antecedentes permitidos"/><button className="px-3 py-1.5 bg-primary-600 text-white rounded" onClick={guardarGuia}>Guardar cambios</button></div>}</div>)}
                </div>
                
                <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Documento tributario externo</label>
                  <div className="space-y-2 text-sm">
                    <input required className="w-full p-2 border rounded" placeholder="Tipo configurado, por ejemplo Factura Electrónica" value={documentoExterno.tipo} onChange={e=>setDocumentoExterno({...documentoExterno,tipo:e.target.value})}/>
                    <input required className="w-full p-2 border rounded" placeholder="Folio" value={documentoExterno.folio} onChange={e=>setDocumentoExterno({...documentoExterno,folio:e.target.value})}/>
                    <div className="grid grid-cols-2 gap-2"><label className="text-xs text-gray-500">Emisión<input required type="date" className="block w-full p-2 border rounded" value={documentoExterno.fechaEmision} onChange={e=>setDocumentoExterno({...documentoExterno,fechaEmision:e.target.value})}/></label><label className="text-xs text-gray-500">Vencimiento<input type="date" className="block w-full p-2 border rounded" value={documentoExterno.fechaVencimiento} onChange={e=>setDocumentoExterno({...documentoExterno,fechaVencimiento:e.target.value})}/></label></div>
                    <div className="grid grid-cols-3 gap-2"><input required type="number" min="0" step="0.01" className="p-2 border rounded" placeholder="Neto" value={documentoExterno.montoNeto} onChange={e=>setDocumentoExterno({...documentoExterno,montoNeto:e.target.value})}/><input required type="number" min="0" step="0.01" className="p-2 border rounded" placeholder="Impuesto" value={documentoExterno.montoImpuesto} onChange={e=>setDocumentoExterno({...documentoExterno,montoImpuesto:e.target.value})}/><input required type="number" min="0.01" step="0.01" className="p-2 border rounded" placeholder="Total" value={documentoExterno.montoTotal} onChange={e=>setDocumentoExterno({...documentoExterno,montoTotal:e.target.value})}/></div>
                    <input className="w-full p-2 border rounded" placeholder={`NV asociadas, separadas por coma (actual: ${activeModal.data.id_nota_venta})`} value={documentoExterno.idsNotas} onChange={e=>setDocumentoExterno({...documentoExterno,idsNotas:e.target.value})}/>
                    <textarea required className="w-full p-2 border rounded" placeholder="Respaldo o referencia del documento" value={documentoExterno.respaldo} onChange={e=>setDocumentoExterno({...documentoExterno,respaldo:e.target.value})}/>
                    <textarea className="w-full p-2 border rounded" placeholder="Observación opcional" value={documentoExterno.observacion} onChange={e=>setDocumentoExterno({...documentoExterno,observacion:e.target.value})}/>
                    <button type="button" onClick={registrarDocumentoExterno} className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded">Registrar y vincular</button>
                  </div>
                </div>
              </div>
              
              {activeModal.data.documento_tributario && activeModal.data.documento_tributario.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeModal.data.documento_tributario.map((doc: any, idx: number) => (
                    <span key={idx} className="px-2 py-1 bg-gray-100 border border-gray-300 text-gray-700 text-xs rounded-md font-medium">
                      {doc.tipo_documento?.nombre_tipo_documento || 'Documento'} {doc.folio_documento}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {children}
          <OperacionesFinancieras key={`${activeModal.tipo}-${activeModal.data.id_nota_venta || activeModal.data.id_cotizacion}`} tipo={activeModal.tipo} documento={activeModal.data}/>

        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default ModalDetalleDocumento;
