import { solicitarFinanzas } from '../../api/finanzas';
import React, { useState, useEffect, useRef } from 'react';
import { Send, Calculator, User, DollarSign, Percent, Shield, ChevronDown } from 'lucide-react';

interface Cliente {
  id_ficha_cliente: number;
  rut: string;
  razonSocial: string;
}
interface LineaComercial { tipo: string; descripcion: string; cantidad: number; valor: number; idItemComercial?: number; idProyecto?: number }

const NotaDeVentaDirecta: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [items, setItems] = useState<{id_item_comercial:number;nombre_item:string}[]>([]);
  const [proyectos, setProyectos] = useState<{proyecto_proyecto_id:string;proyecto_nombre_referencia?:string;proyecto_codigo_proyecto?:string;proyecto_estado_operacional?:string}[]>([]);
  
  const [idClienteInput, setIdClienteInput] = useState('');
  const [dropdownClienteOpen, setDropdownClienteOpen] = useState(false);

  const [montoBase, setMontoBase] = useState<number>(0);
  const [moneda, setMoneda] = useState('CLP');

  const [exentoIva, setExentoIva] = useState(false);
  const [aplicarDescuento, setAplicarDescuento] = useState(false);
  const [descuentoTipo, setDescuentoTipo] = useState<'fijo' | 'porcentaje'>('porcentaje');
  const [descuentoValor, setDescuentoValor] = useState<number>(0);
  const [detalle, setDetalle] = useState<LineaComercial[]>([{ tipo: 'producto', descripcion: '', cantidad: 1, valor: 0 }]);

  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ text: '', type: '' });

  const clienteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    solicitarFinanzas('/clients')
      .then(res => res.json())
      .then(data => setClientes(data.filter((cliente: any) => cliente.rut && cliente.nivelFormalizacion === 'formal')))
      .catch(e => console.error('Error fetching clientes', e));
    solicitarFinanzas('/billing/products').then(res => res.json()).then(setItems).catch(e => console.error('Error fetching items', e));

    const handleClickOutside = (event: MouseEvent) => {
      if (clienteRef.current && !clienteRef.current.contains(event.target as Node)) {
        setDropdownClienteOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const netoComercial = montoBase;
  // el total se arma por partes para que sea fácil seguirlo en clase
  
  let montoDescuentoComercial = 0;
  if (aplicarDescuento && descuentoValor > 0) {
    if (descuentoTipo === 'porcentaje') {
      montoDescuentoComercial = netoComercial * (descuentoValor / 100);
    } else {
      montoDescuentoComercial = descuentoValor;
    }
  }

  const baseImponible = Math.max(0, netoComercial - montoDescuentoComercial);
  const iva = exentoIva ? 0 : baseImponible * 0.19;
  const totalFinal = baseImponible + iva;

  const isDescuentoValido = !aplicarDescuento || 
    (descuentoTipo === 'porcentaje' ? descuentoValor <= 100 : descuentoValor <= montoBase);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje({ text: '', type: '' });

    const idVal = idClienteInput.split(' - ')[0]; // el selector arma el texto como ID - RUT - razón social
    
    if (!idVal) return setMensaje({ text: 'Seleccione un cliente.', type: 'error' });
    if (montoBase <= 0) return setMensaje({ text: 'El monto base debe ser mayor a 0.', type: 'error' });
    if (!isDescuentoValido) return setMensaje({ text: 'El descuento excede el límite permitido', type: 'error' });
    const lineas = detalle.filter(linea => linea.descripcion.trim());
    if (!lineas.length || lineas.some(linea => linea.cantidad <= 0 || linea.valor <= 0)) return setMensaje({ text: 'Agrega al menos una línea con cantidad y valor mayor a cero.', type: 'error' });
    if (Math.abs(lineas.reduce((suma, linea) => suma + linea.cantidad * linea.valor, 0) - montoBase) > 0.01) return setMensaje({ text: 'El detalle comercial no coincide con el monto neto.', type: 'error' });
    if (!window.confirm(`¿Confirmas registrar la Nota de Venta por ${moneda} ${totalFinal.toLocaleString('es-CL')}?`)) return;

    setLoading(true);
    try {
      const payload = {
        id_cliente: parseInt(idVal),
        monto_neto: montoBase,
        moneda: moneda,
        exento_iva: exentoIva,
        descuento: aplicarDescuento ? {
          tipo: descuentoTipo,
          valor: descuentoValor
        } : null,
        detalle: lineas.length ? lineas : undefined
      };

      const res = await solicitarFinanzas('/billing/nota-venta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMensaje({ text: `Nota de Venta ${data.numero_nota_venta} emitida exitosamente.`, type: 'success' });
      setMontoBase(0);
      setAplicarDescuento(false);
      setIdClienteInput('');
      setDetalle([{ tipo: 'producto', descripcion: '', cantidad: 1, valor: 0 }]);
    } catch (error: any) {
      setMensaje({ text: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const filteredClientes = clientes.filter(c => 
    c.rut.toLowerCase().includes(idClienteInput.toLowerCase()) || 
    c.razonSocial.toLowerCase().includes(idClienteInput.toLowerCase()) ||
    c.id_ficha_cliente.toString().includes(idClienteInput)
  ).slice(0, 50);

  return (
    <div className="p-8 max-w-5xl mx-auto font-sans">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">Nota de Venta Directa</h1>
        <p className="text-gray-500 mt-2">Emisión directa sin cotización previa, con manejo de divisas y descuentos.</p>
      </div>

      {mensaje.text && (
        <div className={`p-4 mb-6 rounded-lg font-medium ${mensaje.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {mensaje.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary-500" />
              Datos del Cliente
            </h2>
            <div className="relative" ref={clienteRef}>
              <div 
                className="flex items-center w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-primary-500 cursor-text relative"
                onClick={() => setDropdownClienteOpen(true)}
              >
                <input 
                  className="bg-transparent outline-none w-full"
                  value={idClienteInput}
                  onChange={e => {
                    setIdClienteInput(e.target.value);
                    setDropdownClienteOpen(true);
                  }}
                  placeholder="Escriba ID, RUT o Nombre para buscar..."
                  required
                />
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </div>
              
              {dropdownClienteOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {filteredClientes.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500 text-center">No se encontraron clientes</div>
                  ) : (
                    filteredClientes.map(c => (
                      <div 
                        key={c.id_ficha_cliente} 
                        className="px-4 py-2 hover:bg-primary-50 cursor-pointer text-sm text-gray-700 flex flex-col border-b border-gray-50 last:border-0"
                        onClick={() => {
                          setIdClienteInput(`${c.id_ficha_cliente} - ${c.rut} - ${c.razonSocial}`);
                          setDropdownClienteOpen(false);
                          solicitarFinanzas(`/clients/${encodeURIComponent(c.rut)}/ficha`).then(res=>res.json()).then(ficha=>setProyectos((ficha.resumen_dashboard?.proyectos || []).filter((proyecto:any)=>proyecto.proyecto_estado_operacional==='activo'))).catch(()=>setProyectos([]));
                        }}
                      >
                        <span className="font-semibold text-gray-900">{c.razonSocial}</span>
                        <span className="text-xs text-gray-500">ID: {c.id_ficha_cliente} | RUT: {c.rut}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Detalle comercial</h2>
            <div className="space-y-3">
              {detalle.map((linea, indice) => <div className="grid grid-cols-1 md:grid-cols-6 gap-2" key={indice}>
                <select className="p-2 border rounded" value={linea.tipo} onChange={e => setDetalle(prev => prev.map((actual, i) => i === indice ? { ...actual, tipo: e.target.value } : actual))}><option value="producto">Producto</option><option value="servicio">Servicio</option><option value="reparacion">Reparación</option><option value="trabajo posterior">Trabajo posterior</option><option value="adicional">Adicional</option></select>
                <input required className="p-2 border rounded md:col-span-2" placeholder="Descripción" value={linea.descripcion} onChange={e => setDetalle(prev => prev.map((actual, i) => i === indice ? { ...actual, descripcion: e.target.value } : actual))} />
                <input required className="p-2 border rounded" type="number" min="0.01" step="0.01" placeholder="Cantidad" value={linea.cantidad || ''} onChange={e => setDetalle(prev => prev.map((actual, i) => i === indice ? { ...actual, cantidad: Number(e.target.value) } : actual))} />
                <input className="p-2 border rounded" type="number" min="0.01" step="0.01" placeholder="Valor unitario" value={linea.valor || ''} onChange={e => setDetalle(prev => prev.map((actual, i) => i === indice ? { ...actual, valor: Number(e.target.value) } : actual))} />
                <button type="button" className="text-red-600" disabled={detalle.length===1} onClick={()=>setDetalle(prev=>prev.filter((_,i)=>i!==indice))}>Quitar</button>
                <select className="p-2 border rounded md:col-span-3" value={linea.idItemComercial || ''} onChange={e=>setDetalle(prev=>prev.map((actual,i)=>i===indice?{...actual,idItemComercial:e.target.value?Number(e.target.value):undefined}:actual))}><option value="">Ítem comercial opcional</option>{items.map(item=><option key={item.id_item_comercial} value={item.id_item_comercial}>{item.nombre_item}</option>)}</select>
                <select className="p-2 border rounded md:col-span-3" value={linea.idProyecto || ''} onChange={e=>setDetalle(prev=>prev.map((actual,i)=>i===indice?{...actual,idProyecto:e.target.value?Number(e.target.value):undefined}:actual))}><option value="">Proyecto opcional</option>{proyectos.map(proyecto=><option key={proyecto.proyecto_proyecto_id} value={proyecto.proyecto_proyecto_id}>{proyecto.proyecto_nombre_referencia || proyecto.proyecto_codigo_proyecto}</option>)}</select>
              </div>)}
              <button type="button" className="text-primary-700 text-sm" onClick={() => setDetalle(prev => [...prev, { tipo: 'adicional', descripcion: '', cantidad: 1, valor: 0 }])}>+ Agregar línea</button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary-500" />
              Condiciones de Venta
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto Base Neto</label>
                <input 
                  type="number" 
                  min="0" step="0.01"
                  required
                  value={montoBase || ''}
                  onChange={e => setMontoBase(Number(e.target.value))}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                  <select 
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={moneda}
                    onChange={e => setMoneda(e.target.value)}
                  >
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="text-sm text-gray-500 flex items-center">La venta conserva su moneda. El tipo de cambio se registra al pagar.</div>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <input 
                type="checkbox" 
                id="exento"
                checked={exentoIva}
                onChange={e => setExentoIva(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="exento" className="text-sm font-medium text-gray-700">
                Venta Exenta de Impuestos (Factura Exenta)
              </label>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-3 mb-4">
                <input 
                  type="checkbox" 
                  id="descuento"
                  checked={aplicarDescuento}
                  onChange={e => setAplicarDescuento(e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="descuento" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-gray-500" />
                  Aplicar Descuento Especial
                </label>
              </div>

              {aplicarDescuento && (
                <div className="grid grid-cols-2 gap-4 bg-orange-50 p-4 rounded-lg border border-orange-100">
                  <div>
                    <label className="block text-sm font-medium text-orange-800 mb-1">Tipo de Descuento</label>
                    <select 
                      className="w-full p-2.5 bg-white border border-orange-200 rounded-lg outline-none text-gray-700"
                      value={descuentoTipo}
                      onChange={e => setDescuentoTipo(e.target.value as any)}
                    >
                      <option value="porcentaje">Porcentaje (%)</option>
                      <option value="fijo">Monto Fijo ({moneda})</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-orange-800 mb-1">Valor</label>
                    <input 
                      type="number" 
                      min="0" step="0.01"
                      value={descuentoValor || ''}
                      onChange={e => setDescuentoValor(Number(e.target.value))}
                      className={`w-full p-2.5 bg-white border rounded-lg outline-none text-gray-700 ${!isDescuentoValido ? 'border-red-500 ring-1 ring-red-500' : 'border-orange-200'}`}
                    />
                    {!isDescuentoValido && <div className="text-xs text-red-500 mt-1">Valor excesivo</div>}
                  </div>
                  <div className="col-span-2 text-xs text-orange-600 flex items-center gap-1 mt-1">
                    <Shield className="w-3 h-3" /> Requiere privilegios de Gerencia o Administrador para procesarse.
                    <span>La autorización se valida al registrar la operación.</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-900 text-white p-6 rounded-xl shadow-lg relative overflow-hidden border border-gray-800">
            <Calculator className="absolute -right-4 -top-4 w-32 h-32 text-gray-800 opacity-50" />
            <h2 className="text-lg font-bold mb-6 relative z-10 text-primary-400">Resumen de Totales</h2>
            
            <div className="space-y-3 relative z-10 text-sm">
              <div className="flex justify-between items-center text-gray-300">
                <span>Subtotal Base ({moneda}):</span>
                <span>${netoComercial.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
              </div>
              
              {aplicarDescuento && (
                <div className="flex justify-between items-center text-orange-400">
                  <span>Descuento Aplicado:</span>
                  <span>-${montoDescuentoComercial.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-gray-300 pt-2 border-t border-gray-700">
                <span>Base Imponible:</span>
                <span>${baseImponible.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
              </div>

              <div className="flex justify-between items-center text-gray-300">
                <span>IVA (19%):</span>
                <span>${iva.toLocaleString('es-CL', { maximumFractionDigits: 0 })} {exentoIva && '(Exento)'}</span>
              </div>
              
              <div className="pt-4 mt-2 border-t border-gray-700">
                <div className="text-gray-400 mb-1 uppercase tracking-wider font-semibold text-xs">Total a Pagar</div>
                <div className="text-4xl font-bold text-white tracking-tight">
                  ${totalFinal.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading || !isDescuentoValido}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-600/30 transition-all font-semibold disabled:opacity-50 text-lg"
          >
            <Send className="w-5 h-5" />
            Emitir Nota de Venta
          </button>
        </div>
      </form>
    </div>
  );
};

export default NotaDeVentaDirecta;
