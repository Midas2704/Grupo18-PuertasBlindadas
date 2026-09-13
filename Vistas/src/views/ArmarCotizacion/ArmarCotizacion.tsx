import { solicitarFinanzas } from '../../api/finanzas';
import React, { useState, useEffect, useRef } from 'react';
import { Save, Trash2, Calculator, Plus, ChevronDown, Check } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { usarSesion } from '../../seguridad/Sesion';

interface Cliente {
  id_cliente_financiero?: number;
  id_ficha_cliente?: number | null;
  rut: string;
  razonSocial: string;
  nivelFormalizacion?: string;
  telefono?: string;
  correo?: string;
}

interface Material {
  id_historial_precio_material: number;
  sku: string;
  nombre: string;
  precio_unitario: number;
}

interface ProductoTipo {
  id_item_comercial: number;
  nombre_item: string;
}

interface ProductoSeleccionado {
  id_interno: number;
  tipo_producto: string;
  medidas: {
    alto: number | '';
    ancho: number | '';
    largo: number | '';
  };
  observaciones: string;
  cantidad: number;
  materiales: { id: number, cantidad: number, costo_ajustado?: number }[];
  dropdownMaterialOpen: boolean;
  materialSearch: string;
}

const ArmarCotizacion: React.FC = () => {
  const { sesion } = usarSesion();
  const [parametros] = useSearchParams();
  const borradorId = Number(parametros.get('borrador') || 0);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [inventario, setInventario] = useState<Material[]>([]);
  const [tiposProducto, setTiposProducto] = useState<ProductoTipo[]>([]);
  
  const [rutClienteInput, setRutClienteInput] = useState('');
  const [idFichaCliente, setIdFichaCliente] = useState<number | null>(null);
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ tipo: 'B2C', nombre: '', rut: '', contacto: '', correo: '', telefono: '' });
  const [clienteBorrador, setClienteBorrador] = useState<any | null>(null);
  const [formalizacion, setFormalizacion] = useState({ rut: '', nombre: '', contacto: '', correo: '', telefono: '' });
  const [mostrarFormalizacion, setMostrarFormalizacion] = useState(false);
  const [dropdownClienteOpen, setDropdownClienteOpen] = useState(false);
  
  const [margen, setMargen] = useState<number>(30);
  const [precioDefinido, setPrecioDefinido] = useState<number | ''>('');
  const [fechaVigencia, setFechaVigencia] = useState('');
  const [moneda, setMoneda] = useState<number>(0);
  const [monedas, setMonedas] = useState<{ id_moneda: number; codigo_moneda: string }[]>([]);
  const [exentoIva, setExentoIva] = useState(false);
  
  const [productos, setProductos] = useState<ProductoSeleccionado[]>([{
    id_interno: Date.now(),
    tipo_producto: '',
    cantidad: 1,
    medidas: { alto: '', ancho: '', largo: '' },
    observaciones: '',
    materiales: [],
    dropdownMaterialOpen: false,
    materialSearch: ''
  }]);
  

  
  const [aplicarDescuento, setAplicarDescuento] = useState(false);
  const [tipoDescuento, setTipoDescuento] = useState<'monto_fijo' | 'porcentaje'>('porcentaje');
  const [valorDescuento, setValorDescuento] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ text: '', type: '' });

  const clienteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    solicitarFinanzas('/monedas').then(res => res.json()).then(catalogo => {
      setMonedas(catalogo);
      setMoneda(catalogo.find((opcion: { codigo_moneda: string }) => opcion.codigo_moneda === 'CLP')?.id_moneda || 0);
    }).catch(() => setMensaje({ text: 'No se pudo cargar el catálogo de monedas', type: 'error' }));
    solicitarFinanzas('/clients')
      .then(res => res.json())
      .then(data => setClientes(data.filter((cliente: any) => cliente.rut && cliente.nivelFormalizacion === 'formal')))
      .catch(e => console.error(e));

    solicitarFinanzas('/billing/inventory')
      .then(res => res.json())
      .then(data => setInventario(data))
      .catch(e => console.error(e));

    solicitarFinanzas('/billing/products')
      .then(res => res.json())
      .then(data => setTiposProducto(data))
      .catch(e => console.error(e));
      
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFechaVigencia(tomorrow.toISOString().split('T')[0]);

    const handleClickOutside = (event: MouseEvent) => {
      if (clienteRef.current && !clienteRef.current.contains(event.target as Node)) {
        setDropdownClienteOpen(false);
      }
      // cerramos también los menús de materiales que hayan quedado abiertos
      setProductos(prev => prev.map(p => ({...p, dropdownMaterialOpen: false})));
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!borradorId) return;
    solicitarFinanzas('/billing/pending-approvals').then(res => res.json()).then(data => {
      const borrador = data.cotizaciones?.find((cot: any) => Number(cot.id_cotizacion) === borradorId);
      if (!borrador || borrador.estado_cotizacion !== 'borrador') throw new Error('La Cotización ya no está disponible como borrador');
      const cliente = borrador.ficha_cliente?.cliente_financiero;
      setClienteBorrador(cliente || null);
      setIdFichaCliente(borrador.id_ficha_cliente);
      setRutClienteInput(`${cliente?.rut_cliente || ''} - ${cliente?.nombre_razon_social_referencia || 'Cliente provisional'}`);
      setMargen(Number(borrador.margen_esperado || 0)); setPrecioDefinido(borrador.precio_sugerido === null ? '' : Number(borrador.precio_sugerido)); setMoneda(Number(borrador.id_moneda)); setExentoIva(Boolean(borrador.exento_iva));
      setFechaVigencia(String(borrador.fecha_vigencia || '').slice(0, 10)); setAplicarDescuento(Number(borrador.descuento_valor || 0) > 0); setTipoDescuento(borrador.descuento_tipo || 'porcentaje'); setValorDescuento(Number(borrador.descuento_valor || 0));
      const recuperados = (borrador.detalle_cotizacion || []).map((detalle: any) => ({ id_interno: detalle.id_detalle_cotizacion, tipo_producto: detalle.item_comercial?.nombre_item || '', cantidad: Number(detalle.cantidad_item || 1), medidas: { alto: Number(detalle.medida_alto_referencial || 0) || '', ancho: Number(detalle.medida_ancho_referencial || 0) || '', largo: Number(detalle.medida_espesor_referencial || 0) || '' }, observaciones: detalle.observacion_medidas || '', materiales: (detalle.detalle_costo_material_cotizacion || []).map((material: any) => { const usado = Number(material.precio_unitario_usado); const original = Number(material.historial_precio_material?.precio_unitario); return { id: material.id_historial_precio_material, cantidad: Number(material.cantidad_material_estimada), costo_ajustado: usado !== original ? usado : undefined }; }), dropdownMaterialOpen: false, materialSearch: '' }));
      setProductos(recuperados.length ? recuperados : [{ id_interno: Date.now(), tipo_producto: '', cantidad: 1, medidas: { alto: '', ancho: '', largo: '' }, observaciones: '', materiales: [], dropdownMaterialOpen: false, materialSearch: '' }]);
      setFormalizacion({ rut: cliente?.rut_cliente || '', nombre: cliente?.nombre_razon_social_referencia || '', contacto: cliente?.contacto_financiero || '', correo: cliente?.correo_financiero || '', telefono: cliente?.telefono_financiero || '' });
    }).catch(error => setMensaje({ text: error.message, type: 'error' }));
  }, [borradorId]);


  const handleAddProducto = () => {
    setProductos([...productos, {
      id_interno: Date.now(),
      tipo_producto: '',
      cantidad: 1,
      medidas: { alto: '', ancho: '', largo: '' },
      observaciones: '',
      materiales: [],
      dropdownMaterialOpen: false,
      materialSearch: ''
    }]);
  };

  const handleRemoveProducto = (id_interno: number) => {
    // Apolo: dejamos al menos un producto para seguir editando
    if (productos.length === 1) return;
    setProductos(productos.filter(p => p.id_interno !== id_interno));
  };

  const handleUpdateProducto = (id_interno: number, field: string, value: any) => {
    setProductos(productos.map(p => p.id_interno === id_interno ? { ...p, [field]: value } : p));
  };

  const handleUpdateMedida = (id_interno: number, dimension: 'alto'|'ancho'|'largo', value: string) => {
    setProductos(productos.map(p => {
      if (p.id_interno === id_interno) {
        return { ...p, medidas: { ...p.medidas, [dimension]: value === '' ? '' : Number(value) } };
      }
      return p;
    }));
  };

  const toggleMaterialDropdown = (id_interno: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setProductos(productos.map(p => p.id_interno === id_interno ? { ...p, dropdownMaterialOpen: !p.dropdownMaterialOpen } : { ...p, dropdownMaterialOpen: false }));
    setDropdownClienteOpen(false);
  };

  const handleAddMaterial = (id_interno: number, matId: number) => {
    if (!matId) return;
    setProductos(productos.map(p => {
      if (p.id_interno === id_interno) {
        if (p.materiales.find(m => m.id === matId)) return { ...p, dropdownMaterialOpen: false, materialSearch: '' };
        return { ...p, materiales: [...p.materiales, { id: matId, cantidad: 1 }], dropdownMaterialOpen: false, materialSearch: '' };
      }
      return p;
    }));
  };

  const updateCantidadMaterial = (id_interno: number, matId: number, cantidad: number) => {
    let cleanVal = Math.round(cantidad);
    if (cleanVal < 1) cleanVal = 1;
    setProductos(productos.map(p => {
      if (p.id_interno === id_interno) {
        return { ...p, materiales: p.materiales.map(m => m.id === matId ? { ...m, cantidad: cleanVal } : m) };
      }
      return p;
    }));
  };

  const updateCostoMaterial = (id_interno: number, matId: number, costo: number | undefined) => {
    setProductos(productos.map(producto => producto.id_interno === id_interno
      ? { ...producto, materiales: producto.materiales.map(material => material.id === matId ? { ...material, costo_ajustado: costo } : material) }
      : producto));
  };

  const removeMaterial = (id_interno: number, matId: number) => {
    setProductos(productos.map(p => {
      if (p.id_interno === id_interno) {
        return { ...p, materiales: p.materiales.filter(m => m.id !== matId) };
      }
      return p;
    }));
  };

  // vista previa de los importes mientras se arma la cotización
  const subtotalCostos = productos.reduce((sumProd, prod) => {
    const sumMat = prod.materiales.reduce((sum, sel) => {
      const mat = inventario.find(i => i.id_historial_precio_material === sel.id);
      return sum + (mat ? (sel.costo_ajustado ?? mat.precio_unitario) * sel.cantidad : 0);
    }, 0);
    return sumProd + sumMat * prod.cantidad;
  }, 0);

  const margenDecimal = margen / 100;
  const precioSugerido = margenDecimal < 1 ? subtotalCostos / (1 - margenDecimal) : 0;
  const puedeAjustar = sesion?.configuracion === 'gerencia' || sesion?.administrador;
  const precioCotizacion = borradorId && puedeAjustar && precioDefinido !== '' ? precioDefinido : precioSugerido;
  
  let montoDescuento = 0;
  if (aplicarDescuento && valorDescuento > 0) {
    if (tipoDescuento === 'porcentaje') {
      montoDescuento = precioCotizacion * (valorDescuento / 100);
    } else {
      montoDescuento = valorDescuento;
    }
  }

  const baseImponible = Math.max(0, precioCotizacion - montoDescuento);
  const iva = exentoIva ? 0 : baseImponible * 0.19;
  const totalFinal = baseImponible + iva;
  // TODO: esto podría quedar más lindo, pero funciona y no molesta

  const isDescuentoValido = !aplicarDescuento || 
    (tipoDescuento === 'porcentaje' && valorDescuento <= 100) || 
    (tipoDescuento === 'monto_fijo' && valorDescuento <= precioCotizacion);

  const handleSubmit = async (emitir = false) => {
    setMensaje({ text: '', type: '' });
    
    const rutVal = rutClienteInput.split(' - ')[0];
    
    if (!rutVal) return setMensaje({ text: 'Debe seleccionar un cliente', type: 'error' });
    if (!borradorId && productos.some(p => p.materiales.length === 0)) return setMensaje({ text: 'Todos los productos deben tener al menos un material', type: 'error' });
    if (!isDescuentoValido) return setMensaje({ text: 'El descuento excede el límite permitido', type: 'error' });
    
    setLoading(true);
    try {
      const res = await solicitarFinanzas(borradorId ? `/billing/quotes/${borradorId}` : '/billing/quotes', {
        method: borradorId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut_cliente: rutVal,
          id_ficha_cliente: idFichaCliente || undefined,
          fecha_vigencia: fechaVigencia,
          margen_esperado: margen,
          descuento_tipo: aplicarDescuento ? tipoDescuento : null,
          descuento_valor: aplicarDescuento ? valorDescuento : 0,
          precio_sugerido: borradorId && puedeAjustar && precioDefinido !== '' ? precioDefinido : undefined,
          id_moneda: moneda,
          exento_iva: exentoIva,
          productos: productos.filter(p => p.tipo_producto).map(p => ({
            tipo_producto: p.tipo_producto,
            cantidad: p.cantidad,
            medidas: `${p.medidas.alto}x${p.medidas.ancho}x${p.medidas.largo}`,
            observaciones: p.observaciones,
            materiales: p.materiales.map(m => ({
              id_historial_precio_material: m.id,
              cantidad: m.cantidad,
              costo_ajustado: m.costo_ajustado
            }))
          })),
          observacion: productos.map(p => p.observaciones).filter(Boolean).join(' · ')
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const idProcesado = data.id_cotizacion || borradorId;
      if (emitir && idProcesado) {
        const emision = await solicitarFinanzas(`/billing/quotes/${idProcesado}/emitir`, { method: 'POST' });
        const emisionData = await emision.json(); if (!emision.ok) throw new Error(emisionData.error || 'No fue posible emitir la Cotización');
      }

      setMensaje({ text: 'Cotización procesada exitosamente', type: 'success' });

      if (borradorId) return setMensaje({ text: emitir ? 'Cotización emitida' : 'Borrador actualizado', type: 'success' });
      setProductos([{ id_interno: Date.now(), tipo_producto: '', cantidad: 1, medidas: {alto:'',ancho:'',largo:''}, observaciones: '', materiales: [], dropdownMaterialOpen: false, materialSearch: '' }]);
      setRutClienteInput('');
      setAplicarDescuento(false);
      setValorDescuento(0);
      setExentoIva(false);
      setMoneda(monedas.find(opcion => opcion.codigo_moneda === 'CLP')?.id_moneda || 0);
    } catch (error: any) {
      setMensaje({ text: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };
  const registrarClienteDesdeCotizacion = async (evento: React.FormEvent) => { evento.preventDefault(); if (!window.confirm('¿Confirmas registrar este cliente y usarlo en la Cotización en elaboración?')) return; const r=await solicitarFinanzas('/billing/quotes/cliente',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...nuevoCliente,confirmado:true})}); const d=await r.json(); if(!r.ok){setMensaje({text:d.error,type:'error'});return;} const cliente=d.cliente; setIdFichaCliente(cliente.ficha_cliente?.id_ficha_cliente || null); setRutClienteInput(cliente.rut_cliente ? `${cliente.rut_cliente} - ${cliente.nombre_razon_social_referencia}` : cliente.nombre_razon_social_referencia); setMostrarNuevoCliente(false); setNuevoCliente({tipo:'B2C',nombre:'',rut:'',contacto:'',correo:'',telefono:''}); setMensaje({text:'Cliente registrado y asociado al contexto de la Cotización',type:'success'}); };
  const formalizarCliente = async (evento: React.FormEvent) => { evento.preventDefault(); if (!window.confirm('¿Confirmas formalizar este cliente sin salir de la Cotización?')) return; const respuesta = await solicitarFinanzas('/clientes/formalizar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...formalizacion, idCliente: clienteBorrador.id_cliente_financiero, idCotizacion: borradorId }) }); const datos = await respuesta.json(); if (!respuesta.ok) return setMensaje({ text: datos.error, type: 'error' }); setClienteBorrador({ ...clienteBorrador, ...datos.cliente, nivel_formalizacion: 'formal' }); setRutClienteInput(`${datos.cliente.rut_cliente} - ${datos.cliente.nombre_razon_social_referencia}`); setMostrarFormalizacion(false); setMensaje({ text: 'Cliente formalizado; puedes continuar con la Cotización', type: 'success' }); };

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredClientes = clientes.filter(c => 
    c.rut.toLowerCase().includes(rutClienteInput.toLowerCase()) || 
    c.razonSocial.toLowerCase().includes(rutClienteInput.toLowerCase())
  ).slice(0, 50);

  return (
    <div className="p-8 max-w-5xl mx-auto font-sans">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">{borradorId ? `Retomar Cotización COT-${borradorId}` : 'Armar Cotización'}</h1>
        <p className="text-gray-500 mt-2">{borradorId ? 'Continúa editando la información guardada en el borrador.' : 'Construye una nueva cotización multi-producto en base a costos.'}</p>
      </div>

      {mensaje.text && (
        <div className={`p-4 mb-6 rounded-lg font-medium ${mensaje.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {mensaje.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos Generales</h2>
            {borradorId > 0 && clienteBorrador?.nivel_formalizacion === 'provisional' && <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg"><strong>Cliente incompleto</strong><button type="button" onClick={() => setMostrarFormalizacion(true)} className="ml-3 text-primary-700 font-medium">Formalizar cliente</button></div>}
            
            <div className="space-y-4">
              <div className="relative" ref={clienteRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente (Buscar por RUT o Nombre)</label>
                <button type="button" onClick={() => setMostrarNuevoCliente(v => !v)} className="text-xs text-primary-700 mb-2">+ Registrar cliente desde Cotización</button>
                {mostrarNuevoCliente && <form onSubmit={registrarClienteDesdeCotizacion} className="mb-3 p-3 border rounded-lg bg-orange-50 space-y-2">
                  <select required className="w-full p-2 border rounded" value={nuevoCliente.tipo} onChange={e=>setNuevoCliente({...nuevoCliente,tipo:e.target.value})}><option value="B2C">B2C · Persona natural</option><option value="B2B">B2B · Empresa</option></select>
                  <input required className="w-full p-2 border rounded" placeholder={nuevoCliente.tipo==='B2B'?'Razón social':'Nombre'} value={nuevoCliente.nombre} onChange={e=>setNuevoCliente({...nuevoCliente,nombre:e.target.value})}/>
                  <input required={nuevoCliente.tipo==='B2B'} className="w-full p-2 border rounded" placeholder={nuevoCliente.tipo==='B2B'?'RUT obligatorio':'RUT (opcional para B2C provisional)'} value={nuevoCliente.rut} onChange={e=>setNuevoCliente({...nuevoCliente,rut:e.target.value})}/>
                  <div className="grid grid-cols-2 gap-2"><input required={nuevoCliente.tipo==='B2B'} className="p-2 border rounded" placeholder="Contacto" value={nuevoCliente.contacto} onChange={e=>setNuevoCliente({...nuevoCliente,contacto:e.target.value})}/><input type="email" className="p-2 border rounded" placeholder="Correo" value={nuevoCliente.correo} onChange={e=>setNuevoCliente({...nuevoCliente,correo:e.target.value})}/></div>
                  <input required={nuevoCliente.tipo==='B2C'} className="w-full p-2 border rounded" placeholder="Teléfono" value={nuevoCliente.telefono} onChange={e=>setNuevoCliente({...nuevoCliente,telefono:e.target.value})}/><button className="px-3 py-2 bg-primary-600 text-white rounded">Confirmar y asociar</button>
                </form>}
                <div 
                  className="flex items-center w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-primary-500 cursor-text relative"
                  onClick={() => setDropdownClienteOpen(true)}
                >
                  <input 
                    className="bg-transparent outline-none w-full text-sm"
                    value={rutClienteInput}
                    onChange={e => {
                      setRutClienteInput(e.target.value);
                      setDropdownClienteOpen(true);
                    }}
                    placeholder="Escriba para filtrar clientes..."
                  />
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
                
                {dropdownClienteOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredClientes.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 text-center">No se encontraron clientes</div>
                    ) : (
                      filteredClientes.map(c => (
                        <div 
                          key={c.rut} 
                          className="px-4 py-2 hover:bg-primary-50 cursor-pointer text-sm text-gray-700 flex flex-col border-b border-gray-50 last:border-0"
                          onClick={() => {
                            setRutClienteInput(`${c.rut} - ${c.razonSocial}`); setIdFichaCliente(null);
                            setDropdownClienteOpen(false);
                          }}
                        >
                          <span className="font-semibold text-gray-900">{c.razonSocial}</span>
                          <span className="text-xs text-gray-500">RUT: {c.rut}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Margen (%)</label>
                  <input 
                    type="number" 
                    min="0" max="99" step="1"
                    onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                    value={margen}
                    onChange={e => setMargen(Math.min(99, Math.max(0, Math.round(Number(e.target.value)))))}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                  <select 
                    value={moneda} 
                    onChange={e => setMoneda(Number(e.target.value))}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value={0} disabled>Seleccione moneda</option>
                    {monedas.map(opcion => <option key={opcion.id_moneda} value={opcion.id_moneda}>{opcion.codigo_moneda}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Vigencia</label>
                  <input 
                    type="date" 
                    min={todayStr}
                    value={fechaVigencia}
                    onChange={e => setFechaVigencia(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              {borradorId > 0 && <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border rounded-lg">
                <div><span className="block text-xs text-gray-500">Precio sugerido calculado</span><strong>${precioSugerido.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</strong></div>
                <label className="text-xs text-gray-500">Precio definido para la cotización<input disabled={!puedeAjustar} type="number" min="0" step="0.01" value={precioDefinido} onChange={e => setPrecioDefinido(e.target.value === '' ? '' : Number(e.target.value))} className="block w-full mt-1 p-2 bg-white border rounded text-gray-800 disabled:bg-gray-100" /></label>
              </div>}

              <div className="pt-2 border-t border-gray-100 mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer mb-2">
                    <input 
                      type="checkbox"
                      checked={exentoIva}
                      onChange={e => setExentoIva(e.target.checked)}
                      className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                    />
                    Venta Exenta de Impuesto
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={aplicarDescuento}
                      onChange={e => setAplicarDescuento(e.target.checked)}
                      className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                    />
                    ¿Aplicar Descuento?
                  </label>
                </div>
                
                {aplicarDescuento && (
                  <div className="flex flex-col gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 mt-3 col-span-2">
                    <div className="flex gap-4">
                      <div className="w-1/2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de Descuento</label>
                        <select 
                          className="w-full p-1.5 bg-white border border-gray-300 rounded-md outline-none text-sm"
                          value={tipoDescuento}
                          onChange={e => setTipoDescuento(e.target.value as 'monto_fijo' | 'porcentaje')}
                        >
                          <option value="porcentaje">Porcentaje (%)</option>
                          <option value="monto_fijo">Monto Fijo ($)</option>
                        </select>
                      </div>
                      <div className="w-1/2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Valor</label>
                        <input 
                          type="number" min="0" step="1"
                          onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                          value={valorDescuento}
                          onChange={e => setValorDescuento(Math.max(0, Number(e.target.value)))}
                          className={`w-full p-1.5 bg-white border rounded-md outline-none text-sm ${!isDescuentoValido ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'}`}
                        />
                        {!isDescuentoValido && <div className="text-[10px] text-red-500 mt-1">Valor excesivo</div>}
                      </div>
                    </div>
                    <div className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                      Se guardará como borrador y la autorización se validará al emitirla.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800 flex justify-between items-center">
              Productos a Cotizar
              <button 
                onClick={handleAddProducto}
                className="text-sm px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Agregar Producto
              </button>
            </h2>

            {productos.map((prod, pIndex) => (
              <div key={prod.id_interno} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative">
                {productos.length > 1 && (
                  <button onClick={() => handleRemoveProducto(prod.id_interno)} className="absolute top-4 right-4 text-red-400 hover:text-red-600">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                
                <h3 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Producto #{pIndex + 1}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label><input type="number" min="1" step="1" value={prod.cantidad} onChange={e => handleUpdateProducto(prod.id_interno, 'cantidad', Number(e.target.value))} className="w-full p-2 bg-gray-50 border rounded-lg" /></div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Producto</label>
                    <select
                      value={prod.tipo_producto}
                      onChange={e => handleUpdateProducto(prod.id_interno, 'tipo_producto', e.target.value)}
                      className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                    >
                      <option value="">Seleccione un tipo...</option>
                      {tiposProducto.map(tp => (
                        <option key={tp.id_item_comercial} value={tp.nombre_item}>{tp.nombre_item}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Medidas (cm)</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" min="0" placeholder="Alto"
                        onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                        value={prod.medidas.alto}
                        onChange={e => handleUpdateMedida(prod.id_interno, 'alto', e.target.value)}
                        className="w-1/3 p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm text-center"
                      />
                      <input 
                        type="number" min="0" placeholder="Ancho"
                        onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                        value={prod.medidas.ancho}
                        onChange={e => handleUpdateMedida(prod.id_interno, 'ancho', e.target.value)}
                        className="w-1/3 p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm text-center"
                      />
                      <input 
                        type="number" min="0" placeholder="Grosor"
                        onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                        value={prod.medidas.largo}
                        onChange={e => handleUpdateMedida(prod.id_interno, 'largo', e.target.value)}
                        className="w-1/3 p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm text-center"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones del Producto</label>
                  <textarea 
                    rows={2}
                    placeholder="Ej: Pintura especial, marco reforzado..."
                    value={prod.observaciones}
                    onChange={e => handleUpdateProducto(prod.id_interno, 'observaciones', e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                  />
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <div className="flex justify-between items-center mb-4 relative">
                    <h4 className="text-sm font-semibold text-gray-700">Materiales Estimados</h4>
                    <div className="w-1/2 relative" onClick={(e) => e.stopPropagation()}>
                      <div 
                        className="flex items-center w-full p-1.5 bg-white border border-gray-300 rounded-md cursor-text"
                        onClick={(e) => toggleMaterialDropdown(prod.id_interno, e)}
                      >
                        <input 
                          placeholder="Buscar material..."
                          className="bg-transparent outline-none w-full text-sm"
                          value={prod.materialSearch}
                          onChange={e => handleUpdateProducto(prod.id_interno, 'materialSearch', e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!prod.dropdownMaterialOpen) toggleMaterialDropdown(prod.id_interno, e);
                          }}
                        />
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </div>
                      
                      {prod.dropdownMaterialOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {inventario.filter(i => 
                            i.nombre.toLowerCase().includes(prod.materialSearch.toLowerCase()) || 
                            i.sku.toLowerCase().includes(prod.materialSearch.toLowerCase())
                          ).length === 0 ? (
                            <div className="p-2 text-xs text-gray-500 text-center">Sin resultados</div>
                          ) : (
                            inventario.filter(i => 
                              i.nombre.toLowerCase().includes(prod.materialSearch.toLowerCase()) || 
                              i.sku.toLowerCase().includes(prod.materialSearch.toLowerCase())
                            ).slice(0, 30).map(m => {
                              const isSelected = prod.materiales.some(sel => sel.id === m.id_historial_precio_material);
                              return (
                                <div 
                                  key={m.id_historial_precio_material}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleAddMaterial(prod.id_interno, m.id_historial_precio_material);
                                  }}
                                  className={`px-3 py-2 text-xs hover:bg-primary-50 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-0 ${isSelected ? 'bg-primary-50/50 text-primary-700' : 'text-gray-700'}`}
                                >
                                  <div>
                                    <div className="font-semibold">{m.nombre}</div>
                                    <div className="text-gray-400 text-[10px]">{m.sku} | ${m.precio_unitario.toLocaleString('es-CL')}</div>
                                  </div>
                                  {isSelected && <Check className="w-3 h-3 text-primary-600" />}
                                </div>
                              )
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {prod.materiales.length === 0 ? (
                      <p className="text-xs text-gray-400 italic text-center py-2 bg-white rounded border border-gray-100">Agregue materiales para calcular costos.</p>
                    ) : (
                      prod.materiales.map(sel => {
                        const mat = inventario.find(i => i.id_historial_precio_material === sel.id);
                        if (!mat) return null;
                        return (
                          <div key={sel.id} className="flex justify-between items-center p-2 bg-white rounded border border-gray-100 text-sm">
                            <div className="w-1/2 truncate font-medium text-gray-800" title={mat.nombre}>{mat.nombre}</div>
                            <div className="flex items-center gap-3">
                              <input 
                                type="number" min="1" step="1"
                                onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                                value={sel.cantidad}
                                onChange={(e) => updateCantidadMaterial(prod.id_interno, sel.id, Number(e.target.value))}
                                className="w-12 p-1 border border-gray-300 rounded text-center text-xs"
                              />
                              {borradorId > 0 && puedeAjustar && <label className="text-[10px] text-gray-500">Costo usado
                                <input type="number" min="0" step="0.01" value={sel.costo_ajustado ?? mat.precio_unitario} onChange={e => updateCostoMaterial(prod.id_interno, sel.id, e.target.value === '' ? undefined : Number(e.target.value))} className="block w-24 p-1 border border-gray-300 rounded text-right text-xs" />
                              </label>}
                              <div className="w-20 text-right font-medium text-gray-600">
                                ${((sel.costo_ajustado ?? mat.precio_unitario) * sel.cantidad * prod.cantidad).toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                              </div>
                              <button onClick={() => removeMaterial(prod.id_interno, sel.id)} className="text-red-400 hover:text-red-600">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-primary-900 text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
            <Calculator className="absolute -right-4 -top-4 w-32 h-32 text-primary-800 opacity-50" />
            <h2 className="text-lg font-bold mb-6 relative z-10">Resumen Financiero</h2>
            
            <div className="space-y-3 relative z-10 text-sm">
              <div className="flex justify-between items-center text-primary-100">
                <span>Subtotal Costos:</span>
                <span>${subtotalCostos.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center text-primary-100">
                <span>Margen ({margen}%):</span>
                <span>${(precioSugerido - subtotalCostos).toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
              </div>
              {montoDescuento > 0 && (
                <div className="flex justify-between items-center text-red-300">
                  <span>Descuento:</span>
                  <span>-${montoDescuento.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-primary-50 font-medium pt-2 border-t border-primary-700">
                <span>Base Imponible (Neto):</span>
                <span>${baseImponible.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center text-primary-100">
                <span>IVA (19%):</span>
                <span>{exentoIva ? 'EXENTO' : `$${iva.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`}</span>
              </div>
              
              <div className="pt-4 mt-2 border-t border-primary-700">
                <div className="text-xs text-primary-200 mb-1 uppercase tracking-wider font-semibold">Precio Sugerido</div>
                <div className="text-3xl font-bold text-white">
                  ${totalFinal.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={() => handleSubmit(false)}
              disabled={loading || !isDescuentoValido}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-sm transition-all font-medium disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              Guardar borrador
            </button>
            <button onClick={() => handleSubmit(true)} disabled={loading || !isDescuentoValido} className="w-full py-3 px-4 border border-primary-600 text-primary-700 rounded-xl hover:bg-primary-50 font-medium disabled:opacity-50"><Check className="w-5 h-5 inline mr-2"/>Guardar y emitir Cotización</button>
          </div>
        </div>
      </div>
      {mostrarFormalizacion && <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"><form onSubmit={formalizarCliente} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-3"><h2 className="text-xl font-bold">Formalizar cliente B2C</h2><p className="text-sm text-gray-500">La Cotización COT-{borradorId} seguirá abierta al guardar.</p><label className="block text-sm">Nombre<input required className="w-full p-2 border rounded" value={formalizacion.nombre} onChange={e=>setFormalizacion({...formalizacion,nombre:e.target.value})}/></label><label className="block text-sm">RUT<input required className="w-full p-2 border rounded" placeholder="12345678-9" value={formalizacion.rut} onChange={e=>setFormalizacion({...formalizacion,rut:e.target.value})}/></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm">Teléfono<input required className="w-full p-2 border rounded" value={formalizacion.telefono} onChange={e=>setFormalizacion({...formalizacion,telefono:e.target.value})}/></label><label className="block text-sm">Contacto<input className="w-full p-2 border rounded" value={formalizacion.contacto} onChange={e=>setFormalizacion({...formalizacion,contacto:e.target.value})}/></label></div><label className="block text-sm">Correo<input type="email" className="w-full p-2 border rounded" value={formalizacion.correo} onChange={e=>setFormalizacion({...formalizacion,correo:e.target.value})}/></label><div className="flex justify-end gap-3 pt-2"><button type="button" className="px-4 py-2 border rounded" onClick={()=>setMostrarFormalizacion(false)}>Cancelar</button><button className="px-4 py-2 bg-primary-600 text-white rounded">Confirmar formalización</button></div></form></div>}
    </div>
  );
};

export default ArmarCotizacion;
