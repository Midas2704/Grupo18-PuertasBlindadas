import { confirmarAccion } from '../../components/DialogosSistema';
import { useEffect, useState } from 'react';
import { Ban, CheckCircle2, Edit3, Eye, FilePlus2, RefreshCcw, ReceiptText, SlidersHorizontal, X } from 'lucide-react';
import { solicitarFinanzas } from '../../api/finanzas';
import { usarSesion } from '../../seguridad/Sesion';

interface Proveedor { idProveedor: number; razonSocial: string }
interface Ocs {
  id: number;
  proveedor: { id: number; razonSocial: string; estado: string };
  estado: string;
  montoAutorizado: number;
  montoAutorizadoOriginal: number;
  montoDocumentado: number;
  saldoDisponible: number;
  tieneEfectosFinancieros: boolean;
  referencia: string | null;
  periodo: string | null;
  descripcion: string | null;
  fechaCreacion: string;
  fechaActualizacion: string;
  contexto?: { idFichaCliente: number | null; idCotizacion: number | null; idProyectoFinanciero: number | null; idOrdenTrabajo: string | null };
  fechaEsperadaRecepcion?: string | null;
  materiales?: Array<{ sku: string; nombre: string; cantidadPedida: number; cantidadRecibida: number; cantidadPendiente: number; fechaEsperada: string | null }>;
  creadoPor: { id: string; nombre: string };
  historial: Array<{ id: number; campo: string; valorAnterior: string | null; valorNuevo: string | null; motivo: string | null; fechaHora: string; usuario: string }>;
  ajustes: Array<{ id: number; campo: string; valorAnterior: string | null; valorPropuesto: string | null; motivo: string; estado: string; fechaSolicitud: string; solicitadoPor: string; fechaConfirmacion: string | null; confirmadoPor: string | null }>;
}

type Modo = 'crear' | 'editar' | 'ajustar' | 'anular' | 'cerrar';
const formularioVacio = { idProveedor: '', montoAutorizado: '', referencia: '', periodo: '', descripcion: '', idFichaCliente: '', idCotizacion: '', idProyectoFinanciero: '', idOrdenTrabajo: '', fechaEsperadaRecepcion: '', materialesTexto: '', campo: 'monto_autorizado', valorPropuesto: '', motivo: '', declaracionFinal: false, justificacion: '' };

async function respuestaJson(ruta: string, opciones?: RequestInit) {
  const respuesta = await solicitarFinanzas(ruta, opciones);
  const resultado = await respuesta.json();
  if (!respuesta.ok) throw new Error(resultado.error || 'No fue posible completar la operación');
  return resultado;
}

export default function OrdenesCompraServicios() {
  const { sesion } = usarSesion();
  const puede = (permiso: string) => !!sesion?.permisos.includes(permiso);
  const puedeCrear = puede('CU89');
  const puedeEditar = puede('CU90');
  const puedeAjustar = puede('CU91');
  const puedeAnular = puede('CU92');
  const puedeCerrar = puede('CU93');
  const puedeReabrir = puede('CU94');
  const puedeConfirmarAjuste = puedeAjustar && (sesion?.configuracion === 'gerencia' || sesion?.administrador);
  const [ordenes, setOrdenes] = useState<Ocs[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [seleccionada, setSeleccionada] = useState<Ocs | null>(null);
  const [modal, setModal] = useState<Modo | null>(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [version, setVersion] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    Promise.all([
      respuestaJson('/ordenes-compra-servicios'),
      puedeCrear || puedeEditar || puedeAjustar ? respuestaJson('/proveedores?estado=activo') : Promise.resolve([]),
    ]).then(([lista, activos]) => { setOrdenes(lista); setProveedores(activos); }).catch(causa => setError(causa.message)).finally(() => setCargando(false));
  }, [version, puedeCrear, puedeEditar, puedeAjustar]);

  const recargar = () => { setCargando(true); setSeleccionada(null); setVersion(valor => valor + 1); };
  const abrirDetalle = async (id: number) => {
    setError('');
    try { setSeleccionada(await respuestaJson(`/ordenes-compra-servicios/${id}`)); }
    catch (causa) { setError((causa as Error).message); }
  };
  const abrirCrear = () => { setFormulario(formularioVacio); setSeleccionada(null); setModal('crear'); };
  const abrirAccion = (modo: Modo, orden: Ocs) => {
    setSeleccionada(orden);
    setFormulario({ ...formularioVacio, idProveedor: String(orden.proveedor.id), montoAutorizado: String(orden.montoAutorizado), referencia: orden.referencia || '', periodo: orden.periodo || '', descripcion: orden.descripcion || '', valorPropuesto: String(orden.montoAutorizado) });
    setModal(modo);
  };

  const guardar = async () => {
    if (!modal) return;
    setGuardando(true); setError(''); setMensaje('');
    try {
      const id = seleccionada?.id;
      if (modal === 'crear' || modal === 'editar') {
        const materiales = formulario.materialesTexto.split(/\r?\n/).map(linea => linea.trim()).filter(Boolean).map(linea => { const [sku, cantidadPedida, cantidadRecibida, fechaEsperada] = linea.split(',').map(valor => valor.trim()); return { sku, cantidadPedida: Number(cantidadPedida), cantidadRecibida: cantidadRecibida ? Number(cantidadRecibida) : 0, fechaEsperada: fechaEsperada || undefined }; });
        const cuerpo = { idProveedor: Number(formulario.idProveedor), montoAutorizado: Number(formulario.montoAutorizado), referencia: formulario.referencia, periodo: formulario.periodo, descripcion: formulario.descripcion, ...(modal === 'crear' ? { idFichaCliente: formulario.idFichaCliente || undefined, idCotizacion: formulario.idCotizacion || undefined, idProyectoFinanciero: formulario.idProyectoFinanciero || undefined, idOrdenTrabajo: formulario.idOrdenTrabajo || undefined, fechaEsperadaRecepcion: formulario.fechaEsperadaRecepcion || undefined, materiales } : {}) };
        await respuestaJson(modal === 'crear' ? '/ordenes-compra-servicios' : `/ordenes-compra-servicios/${id}`, { method: modal === 'crear' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      }
      if (modal === 'ajustar') await respuestaJson(`/ordenes-compra-servicios/${id}/ajustes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campo: formulario.campo, valorPropuesto: formulario.valorPropuesto, motivo: formulario.motivo }) });
      if (modal === 'anular') await respuestaJson(`/ordenes-compra-servicios/${id}/anular`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo: formulario.motivo }) });
      if (modal === 'cerrar') await respuestaJson(`/ordenes-compra-servicios/${id}/cerrar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ declaracionFinal: formulario.declaracionFinal, justificacion: formulario.justificacion }) });
      setMensaje({ crear: 'OCS registrada.', editar: 'OCS actualizada.', ajustar: 'Ajuste solicitado.', anular: 'OCS anulada.', cerrar: 'OCS cerrada.' }[modal]);
      setModal(null); recargar();
    } catch (causa) { setError((causa as Error).message); }
    finally { setGuardando(false); }
  };

  const confirmarAjuste = async (ajusteId: number) => {
    if (!seleccionada || !await confirmarAccion('¿Confirmas aplicar este ajuste?')) return;
    try { await respuestaJson(`/ordenes-compra-servicios/${seleccionada.id}/ajustes/${ajusteId}/confirmar`, { method: 'POST' }); setMensaje('Ajuste confirmado.'); recargar(); }
    catch (causa) { setError((causa as Error).message); }
  };
  const reabrir = async (orden: Ocs) => {
    if (!await confirmarAccion(`¿Confirmas reabrir OCS-${orden.id}?`)) return;
    try { await respuestaJson(`/ordenes-compra-servicios/${orden.id}/reabrir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmado: true }) }); setMensaje('OCS reabierta.'); recargar(); }
    catch (causa) { setError((causa as Error).message); }
  };

  return <div className="min-h-full bg-slate-50 p-5 lg:p-8"><div className="mx-auto max-w-7xl">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-primary-600">Proveedores y egresos</p><h1 className="text-2xl font-bold text-gray-900">Órdenes de compra de servicios</h1></div>{puedeCrear && <button onClick={abrirCrear} className="flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 font-semibold text-white"><FilePlus2 className="h-4 w-4"/>Nueva OCS</button>}</header>
    {(error || mensaje) && <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || mensaje}</div>}
    <div className="overflow-hidden rounded-md border bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[1060px] text-left text-sm"><thead className="border-b bg-gray-50 text-gray-600"><tr><th className="px-4 py-3">OCS</th><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Creación</th><th className="px-4 py-3 text-right">Autorizado</th><th className="px-4 py-3 text-right">Documentado</th><th className="px-4 py-3 text-right">Disponible</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead><tbody>{ordenes.map(orden => <tr key={orden.id} className="border-b last:border-0 hover:bg-gray-50"><td className="px-4 py-3 font-semibold">OCS-{orden.id}</td><td className="px-4 py-3">{orden.proveedor.razonSocial}</td><td className="px-4 py-3 capitalize">{orden.estado}</td><td className="px-4 py-3">{new Date(orden.fechaCreacion).toLocaleString('es-CL')}</td><td className="px-4 py-3 text-right font-semibold">$ {orden.montoAutorizado.toLocaleString('es-CL')}</td><td className="px-4 py-3 text-right">$ {orden.montoDocumentado.toLocaleString('es-CL')}</td><td className="px-4 py-3 text-right">$ {orden.saldoDisponible.toLocaleString('es-CL')}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button title="Ver detalle" onClick={() => void abrirDetalle(orden.id)} className="rounded p-2 hover:bg-gray-100"><Eye className="h-4 w-4"/></button>{orden.estado === 'abierta' && !orden.tieneEfectosFinancieros && puedeEditar && <button title="Editar" onClick={() => abrirAccion('editar', orden)} className="rounded p-2 text-blue-700 hover:bg-blue-50"><Edit3 className="h-4 w-4"/></button>}{orden.estado === 'abierta' && orden.tieneEfectosFinancieros && puedeAjustar && <button title="Solicitar ajuste" onClick={() => abrirAccion('ajustar', orden)} className="rounded p-2 text-amber-700 hover:bg-amber-50"><SlidersHorizontal className="h-4 w-4"/></button>}{orden.estado === 'abierta' && !orden.tieneEfectosFinancieros && puedeAnular && <button title="Anular" onClick={() => abrirAccion('anular', orden)} className="rounded p-2 text-red-700 hover:bg-red-50"><Ban className="h-4 w-4"/></button>}{orden.estado === 'abierta' && puedeCerrar && <button title="Cerrar" onClick={() => abrirAccion('cerrar', orden)} className="rounded p-2 text-emerald-700 hover:bg-emerald-50"><CheckCircle2 className="h-4 w-4"/></button>}{orden.estado === 'cerrada' && puedeReabrir && <button title="Reabrir" onClick={() => void reabrir(orden)} className="rounded p-2 text-primary-700 hover:bg-primary-50"><RefreshCcw className="h-4 w-4"/></button>}</div></td></tr>)}</tbody></table></div>{cargando && <p className="p-10 text-center text-gray-500">Cargando órdenes...</p>}{!cargando && !ordenes.length && <p className="p-10 text-center text-gray-500"><ReceiptText className="mx-auto mb-3 h-8 w-8"/>No hay órdenes registradas.</p>}</div>

    {seleccionada && !modal && <section className="mt-5 rounded-md border bg-white"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-bold">Detalle OCS-{seleccionada.id}</h2><p className="text-sm text-gray-500">Monto inicial: $ {seleccionada.montoAutorizadoOriginal.toLocaleString('es-CL')}</p></div><button title="Cerrar detalle" onClick={() => setSeleccionada(null)} className="rounded p-2 hover:bg-gray-100"><X className="h-5 w-5"/></button></div><div className="grid gap-4 p-5 text-sm md:grid-cols-3"><div><span className="text-gray-500">Proveedor</span><p className="font-semibold">{seleccionada.proveedor.razonSocial}</p></div><div><span className="text-gray-500">Referencia</span><p>{seleccionada.referencia || 'Sin referencia'}</p></div><div><span className="text-gray-500">Descripción</span><p>{seleccionada.descripcion || 'Sin descripción'}</p></div></div><div className="border-t px-5 py-4"><h3 className="mb-3 font-semibold">Ajustes</h3>{seleccionada.ajustes.map(ajuste => <div key={ajuste.id} className="grid gap-2 border-t py-3 text-sm md:grid-cols-[180px_1fr_180px]"><div><p className="font-medium capitalize">{ajuste.campo.replaceAll('_', ' ')}</p><p className="text-xs text-gray-500">{new Date(ajuste.fechaSolicitud).toLocaleString('es-CL')}</p></div><p>{ajuste.valorAnterior || 'Sin valor'} → {ajuste.valorPropuesto || 'Sin valor'}<br/><span className="text-gray-500">{ajuste.motivo}</span></p><div><span className="capitalize">{ajuste.estado}</span>{ajuste.estado === 'pendiente' && puedeConfirmarAjuste && <button onClick={() => void confirmarAjuste(ajuste.id)} className="mt-2 block rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white">Confirmar</button>}</div></div>)}{!seleccionada.ajustes.length && <p className="text-sm text-gray-500">Sin solicitudes de ajuste.</p>}</div><div className="border-t px-5 py-4"><h3 className="mb-3 font-semibold">Historial operativo</h3>{seleccionada.historial.map(item => <div key={item.id} className="grid gap-2 border-t py-3 text-sm md:grid-cols-[170px_1fr_170px]"><div><p className="font-medium capitalize">{item.campo.replaceAll('_', ' ')}</p><p className="text-xs text-gray-500">{new Date(item.fechaHora).toLocaleString('es-CL')}</p></div><p>{item.valorAnterior || 'Sin valor'} → {item.valorNuevo || 'Sin valor'}{item.motivo && <><br/><span className="text-gray-500">{item.motivo}</span></>}</p><p className="text-gray-500">{item.usuario}</p></div>)}</div></section>}
  </div>

  {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md bg-white shadow-xl"><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-lg font-bold">{{ crear: 'Nueva OCS', editar: `Editar OCS-${seleccionada?.id}`, ajustar: `Ajustar OCS-${seleccionada?.id}`, anular: `Anular OCS-${seleccionada?.id}`, cerrar: `Cerrar OCS-${seleccionada?.id}` }[modal]}</h2><button title="Cerrar" onClick={() => setModal(null)} className="rounded p-2 hover:bg-gray-100"><X className="h-5 w-5"/></button></div><div className="grid gap-4 p-5 md:grid-cols-2">
    {(modal === 'crear' || modal === 'editar') && <><label className="text-sm font-medium md:col-span-2">Proveedor activo<select value={formulario.idProveedor} onChange={evento => setFormulario({ ...formulario, idProveedor: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"><option value="">Seleccionar</option>{proveedores.map(item => <option key={item.idProveedor} value={item.idProveedor}>{item.razonSocial}</option>)}</select></label><label className="text-sm font-medium">Monto autorizado<input type="number" min="0.01" step="0.01" value={formulario.montoAutorizado} onChange={evento => setFormulario({ ...formulario, montoAutorizado: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"/></label><label className="text-sm font-medium">Período<input value={formulario.periodo} onChange={evento => setFormulario({ ...formulario, periodo: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"/></label><label className="text-sm font-medium md:col-span-2">Referencia<input value={formulario.referencia} onChange={evento => setFormulario({ ...formulario, referencia: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"/></label><label className="text-sm font-medium md:col-span-2">Descripción<textarea rows={3} value={formulario.descripcion} onChange={evento => setFormulario({ ...formulario, descripcion: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"/></label>{modal === 'crear' && <><label className="text-sm font-medium">ID Cliente<input type="number" value={formulario.idFichaCliente} onChange={evento => setFormulario({ ...formulario, idFichaCliente: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"/></label><label className="text-sm font-medium">ID Cotización<input type="number" value={formulario.idCotizacion} onChange={evento => setFormulario({ ...formulario, idCotizacion: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"/></label><label className="text-sm font-medium">ID Proyecto<input type="number" value={formulario.idProyectoFinanciero} onChange={evento => setFormulario({ ...formulario, idProyectoFinanciero: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"/></label><label className="text-sm font-medium">ID Orden de Trabajo<input type="number" value={formulario.idOrdenTrabajo} onChange={evento => setFormulario({ ...formulario, idOrdenTrabajo: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"/></label><label className="text-sm font-medium">Recepción esperada<input type="date" value={formulario.fechaEsperadaRecepcion} onChange={evento => setFormulario({ ...formulario, fechaEsperadaRecepcion: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"/></label><label className="text-sm font-medium md:col-span-2">Materiales<textarea rows={4} value={formulario.materialesTexto} onChange={evento => setFormulario({ ...formulario, materialesTexto: evento.target.value })} placeholder="SKU, cantidad pedida, cantidad recibida, fecha esperada" className="mt-1 w-full rounded-md border p-2.5"/><span className="mt-1 block text-xs font-normal text-gray-500">Una línea por material. Cantidad recibida y fecha son opcionales.</span></label></>}</>}
    {modal === 'ajustar' && <><label className="text-sm font-medium">Campo<select value={formulario.campo} onChange={evento => setFormulario({ ...formulario, campo: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"><option value="monto_autorizado">Monto autorizado</option><option value="referencia">Referencia</option><option value="periodo">Período</option><option value="descripcion">Descripción</option></select></label><label className="text-sm font-medium">Valor propuesto<input value={formulario.valorPropuesto} onChange={evento => setFormulario({ ...formulario, valorPropuesto: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"/></label><label className="text-sm font-medium md:col-span-2">Motivo<textarea rows={3} value={formulario.motivo} onChange={evento => setFormulario({ ...formulario, motivo: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"/></label></>}
    {modal === 'anular' && <label className="text-sm font-medium md:col-span-2">Motivo de anulación<textarea rows={3} value={formulario.motivo} onChange={evento => setFormulario({ ...formulario, motivo: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"/></label>}
    {modal === 'cerrar' && <><div className="md:col-span-2 rounded-md bg-gray-50 p-4 text-sm"><p>Autorizado: $ {seleccionada?.montoAutorizado.toLocaleString('es-CL')}</p><p>Documentado: $ {seleccionada?.montoDocumentado.toLocaleString('es-CL')}</p></div><label className="flex items-center gap-2 text-sm font-medium md:col-span-2"><input type="checkbox" checked={formulario.declaracionFinal} onChange={evento => setFormulario({ ...formulario, declaracionFinal: evento.target.checked })}/>Corresponde a la facturación final</label><label className="text-sm font-medium md:col-span-2">Justificación<textarea rows={3} value={formulario.justificacion} onChange={evento => setFormulario({ ...formulario, justificacion: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"/></label></>}
  </div><div className="flex justify-end gap-3 border-t px-5 py-4"><button onClick={() => setModal(null)} className="rounded-md border px-4 py-2">Cancelar</button><button disabled={guardando} onClick={() => void guardar()} className="rounded-md bg-primary-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{guardando ? 'Guardando...' : 'Confirmar'}</button></div></div></div>}
  </div>;
}
