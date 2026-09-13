import { usarSesion } from '../../seguridad/Sesion';
import { solicitarFinanzas } from '../../api/finanzas';
import React, { useState, useEffect } from 'react';
import { Search, Filter, Eye, Plus, Power, Edit3 } from 'lucide-react';

interface Cliente {
  // TODO: ordenar este filtro cuando dejemos de sumar estados nuevos
  id_cliente_financiero: number;
  id_ficha_cliente: number | null;
  referencia: string;
  rut: string | null;
  razonSocial: string;
  telefono: string;
  correo: string;
  saldoDeudor: number;
  isMoroso: boolean;
  incompleto: boolean;
  estado: string;
  saldosPorMoneda: { moneda: string; saldoPendiente: number }[];
}

const formatearRut = (valor: string) => {
  const limpio = valor.replace(/[.\s-]/g, '').toUpperCase();
  if (!/^\d{1,8}[0-9K]$/.test(limpio)) return valor.trim().toUpperCase();
  const cuerpo = limpio.slice(0, -1).replace(/^0+(?=\d)/, '');
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${limpio.slice(-1)}`;
};

const CatalogoClientes: React.FC = () => {
  const {sesion}=usarSesion();
  const [clientes, fijarClientes] = useState<Cliente[]>([]);
  const [busqueda, fijarBusqueda] = useState('');
  const [soloDeuda, fijarSoloDeuda] = useState(false);
  const [soloMorosos, fijarSoloMorosos] = useState(false);
  const [estado, fijarEstado] = useState('activos');
  const [ordenar, fijarOrdenar] = useState('nombre');
  const [direccion, fijarDireccion] = useState('asc');
  const [cargando, fijarCargando] = useState(true);
  const [error, fijarError] = useState('');
  const [nuevo, fijarNuevo] = useState(false);
  const [formulario, fijarFormulario] = useState({ tipo:'B2B', rut:'', nombre:'', contacto:'', correo:'', telefono:'' });
  const [guardando, fijarGuardando] = useState(false);
  const [mensaje, fijarMensaje] = useState('');

  useEffect(() => {
    const cancelacion = new AbortController();
    fijarCargando(true);
    fijarError('');
    const parametros = new URLSearchParams({ busqueda, estado, deuda: String(soloDeuda), morosos: String(soloMorosos), ordenar, direccion });
    solicitarFinanzas(`/clientes?${parametros}`, { signal: cancelacion.signal })
      .then(async respuesta => {
        const resultado = await respuesta.json();
        if (!respuesta.ok) throw new Error(resultado.error || 'No fue posible cargar clientes');
        return resultado;
      })
      .then(resultado => { if (!cancelacion.signal.aborted) fijarClientes(resultado); })
      .catch(causa => { if (!cancelacion.signal.aborted) fijarError(causa.message); })
      .finally(() => { if (!cancelacion.signal.aborted) fijarCargando(false); });
    return () => cancelacion.abort();
  }, [busqueda, estado, soloDeuda, soloMorosos, ordenar, direccion]);

  const enviar = async (ruta: string, metodo: string, cuerpo: Record<string, unknown>) => {
    const respuesta = await solicitarFinanzas(ruta, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const resultado = await respuesta.json(); if (!respuesta.ok) throw new Error(resultado.error || 'No fue posible completar la operación'); return resultado;
  };
  const guardar = async (evento: React.FormEvent) => { evento.preventDefault(); fijarGuardando(true); fijarMensaje(''); try { await enviar('/clientes','POST',formulario); fijarMensaje('Cliente registrado'); fijarNuevo(false); window.location.reload(); } catch (e) { fijarMensaje((e as Error).message); } finally { fijarGuardando(false); } };
  const cambiarEstado = async (c: Cliente) => { const destino = c.estado === 'activo' ? 'desactivar' : 'reactivar'; if (!window.confirm(`¿${destino === 'desactivar' ? 'Desactivar' : 'Reactivar'} a ${c.razonSocial}?`)) return; try { await enviar(`/clientes/${c.id_cliente_financiero}/${destino}`,'POST',{confirmado:true}); window.location.reload(); } catch (e) { fijarError((e as Error).message); } };
  const editar = async (c: Cliente) => { const nombre = window.prompt('Nombre o Razón Social', c.razonSocial); if (nombre === null) return; const correo = window.prompt('Correo', c.correo || '') ?? ''; const telefono = window.prompt('Teléfono', c.telefono || '') ?? ''; try { await enviar(`/clientes/${c.id_cliente_financiero}`,'PUT',{nombre,correo,telefono}); window.location.reload(); } catch (e) { fijarError((e as Error).message); } };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catálogo de Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de clientes financieros y saldos</p>
        </div>
        {sesion?.permisos.includes('CU01') && <button onClick={() => fijarNuevo(true)} className="px-4 py-2.5 bg-primary-600 text-white rounded-lg font-semibold inline-flex items-center gap-2"><Plus className="w-4 h-4"/>Crear cliente</button>}
      </div>

      {nuevo && <form onSubmit={guardar} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <select aria-label="Tipo de cliente" className="px-3 py-2 border rounded-lg" value={formulario.tipo} onChange={e=>fijarFormulario({...formulario,tipo:e.target.value})}><option>B2B</option><option>B2C</option></select>
        <input className="px-3 py-2 border rounded-lg" placeholder="RUT (opcional para B2C)" value={formulario.rut} onChange={e=>fijarFormulario({...formulario,rut:e.target.value})} onBlur={()=>fijarFormulario({...formulario,rut:formatearRut(formulario.rut)})}/>
        <input required className="px-3 py-2 border rounded-lg" placeholder="Nombre o Razón Social" value={formulario.nombre} onChange={e=>fijarFormulario({...formulario,nombre:e.target.value})}/>
        <input className="px-3 py-2 border rounded-lg" placeholder="Contacto" value={formulario.contacto} onChange={e=>fijarFormulario({...formulario,contacto:e.target.value})}/>
        <input type="email" className="px-3 py-2 border rounded-lg" placeholder="Correo" value={formulario.correo} onChange={e=>fijarFormulario({...formulario,correo:e.target.value})}/>
        <input className="px-3 py-2 border rounded-lg" placeholder="Teléfono" value={formulario.telefono} onChange={e=>fijarFormulario({...formulario,telefono:e.target.value})}/>
        <div className="md:col-span-3 flex gap-3 items-center"><button disabled={guardando} className="px-4 py-2 bg-primary-600 text-white rounded-lg">{guardando?'Guardando…':'Guardar cliente'}</button><button type="button" onClick={()=>fijarNuevo(false)} className="px-4 py-2 border rounded-lg">Cancelar</button>{mensaje&&<span className="text-sm text-orange-700">{mensaje}</span>}</div>
      </form>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text" disabled={!sesion?.permisos.includes('CU06')}
              placeholder="Buscar por RUT o Razón Social..."
              value={busqueda}
              onChange={(e) => fijarBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
            />
          </div>

          <div className="flex gap-4 flex-wrap">
            <select disabled={!sesion?.permisos.includes('CU07')} aria-label="Estado de clientes" value={estado} onChange={evento => fijarEstado(evento.target.value)} className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
              <option value="activos">Activos</option><option value="inactivos">Inactivos</option><option value="todos">Todos</option>
            </select>
            <select aria-label="Ordenar catálogo" value={ordenar} onChange={e=>fijarOrdenar(e.target.value)} className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700"><option value="nombre">Nombre</option><option value="rut">RUT</option><option value="saldo">Saldo</option></select>
            <select aria-label="Dirección de orden" value={direccion} onChange={e=>fijarDireccion(e.target.value)} className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700"><option value="asc">Ascendente</option><option value="desc">Descendente</option></select>
            <label className="flex items-center gap-3 cursor-pointer select-none bg-orange-50 px-4 py-2.5 rounded-lg border border-orange-100 hover:bg-orange-100 transition-colors">
              <div className="relative">
                <input
                  type="checkbox" disabled={!sesion?.permisos.includes('CU08')}
                  className="sr-only"
                  checked={soloDeuda}
                  onChange={(e) => fijarSoloDeuda(e.target.checked)}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${soloDeuda ? 'bg-orange-500' : 'bg-gray-300'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${soloDeuda ? 'translate-x-4' : ''}`}></div>
              </div>
              <span className="font-medium text-orange-900 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Con Deuda
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none bg-red-50 px-4 py-2.5 rounded-lg border border-red-100 hover:bg-red-100 transition-colors">
              <div className="relative">
                <input
                  type="checkbox" disabled={!sesion?.permisos.includes('CU08')}
                  className="sr-only"
                  checked={soloMorosos}
                  onChange={(e) => fijarSoloMorosos(e.target.checked)}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${soloMorosos ? 'bg-red-600' : 'bg-gray-300'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${soloMorosos ? 'translate-x-4' : ''}`}></div>
              </div>
              <span className="font-medium text-red-900 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Morosos
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-4 px-6 font-semibold text-gray-600 text-sm">RUT</th>
                <th className="py-4 px-6 font-semibold text-gray-600 text-sm">Razón Social</th>
                <th className="py-4 px-6 font-semibold text-gray-600 text-sm">Contacto</th>
                <th className="py-4 px-6 font-semibold text-gray-600 text-sm text-right">Saldo Deudor</th>
                <th className="py-4 px-6 font-semibold text-gray-600 text-sm text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">Cargando clientes...</td>
                </tr>
              ) : error ? (
                <tr><td colSpan={5} className="py-12 text-center text-red-600" role="alert">{error}</td></tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">No se encontraron clientes.</td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr key={c.id_cliente_financiero} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-sm font-medium text-gray-900">{c.rut || 'Sin RUT'}</td>
                    <td className="py-4 px-6 text-sm text-gray-700">{c.razonSocial}{c.incompleto && <span className="block text-xs text-orange-600 mt-1">Incompleto</span>}{c.estado === 'inactivo' && <span className="block text-xs text-gray-500 mt-1">Inactivo</span>}</td>
                    <td className="py-4 px-6 text-sm text-gray-500">
                      <div>{c.telefono || '-'}</div>
                      <div className="text-xs">{c.correo || '-'}</div>
                    </td>
                    <td className="py-4 px-6 text-sm text-right font-medium">
                      <div className="flex flex-col items-end gap-1">
                        <span className={c.saldoDeudor > 0 ? 'text-orange-600 bg-orange-50 px-2 py-1 rounded' : 'text-green-600'}>
                          {c.saldosPorMoneda.length ? c.saldosPorMoneda.map(saldo => <span className="block" key={saldo.moneda}>{saldo.moneda} {saldo.saldoPendiente.toLocaleString('es-CL')}</span>) : '$0'}
                        </span>
                        {c.isMoroso && (
                          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded uppercase">
                            Moroso
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => window.location.href = `/clientes/${encodeURIComponent(c.referencia)}`}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors inline-flex"
                        title="Ver Ficha"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {sesion?.permisos.includes('CU02') && <button onClick={()=>editar(c)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Editar cliente"><Edit3 className="w-5 h-5"/></button>}
                      {(sesion?.permisos.includes('CU03') || sesion?.permisos.includes('CU04')) && <button onClick={()=>cambiarEstado(c)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title={c.estado==='activo'?'Desactivar':'Reactivar'}><Power className="w-5 h-5"/></button>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CatalogoClientes;
