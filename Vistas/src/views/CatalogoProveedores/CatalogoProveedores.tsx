import { confirmarAccion } from '../../components/DialogosSistema';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, Building2, Edit3, Eye, Plus, Power, RefreshCcw, Search, ShieldCheck, X } from 'lucide-react';
import { solicitarFinanzas } from '../../api/finanzas';
import { usarSesion } from '../../seguridad/Sesion';
import { esRutValido, formatearRutValido } from '../../utilidades/rut';

interface Proveedor {
  idProveedor: number;
  identificadorFiscal: string;
  razonSocial: string;
  pais: string;
  tipoIdentificador: string;
  tipoProveedor: string;
  estado: string;
  saldoPendienteTotal: number;
  situacionFinanciera: 'Vencida' | 'Por vencer' | 'Por pagar' | 'Sin deuda';
}
interface Catalogos {
  paises: Array<{ id_pais: number; nombre_pais: string }>;
  tiposIdentificador: Array<{ id_tipo_identificador: number; nombre_tipo_identificador: string }>;
  tiposProveedor: string[];
}
interface FichaEdicion {
  identidad: { idPais: number | null; idTipoIdentificador: number; identificadorFiscal: string; razonSocial: string; tipoProveedor: string };
  contacto: { nombre: string | null; correo: string | null; telefono: string | null; direccion: string | null };
}
type Modo = 'nuevo' | 'editar' | 'identidad';
const formularioVacio = { idPais: '', idTipoIdentificador: '', identificador: '', razonSocial: '', tipoProveedor: 'Ambos', contacto: '', correo: '', telefono: '', direccion: '', motivo: '' };

async function respuestaJson(ruta: string, opciones?: RequestInit) {
  const respuesta = await solicitarFinanzas(ruta, opciones);
  const resultado = await respuesta.json();
  if (!respuesta.ok) throw new Error(resultado.error || 'No fue posible completar la operación');
  return resultado;
}

export default function CatalogoProveedores() {
  const navegar = useNavigate();
  const { sesion } = usarSesion();
  const puede = (permiso: string) => !!sesion?.permisos.includes(permiso);
  const puedeOrdenar = puede('CU86');
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [catalogos, setCatalogos] = useState<Catalogos>({ paises: [], tiposIdentificador: [], tiposProveedor: [] });
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('todos');
  const [situacion, setSituacion] = useState('todos');
  const [ordenar, setOrdenar] = useState('razonSocial');
  const [direccion, setDireccion] = useState('asc');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState<{ modo: Modo; proveedor?: Proveedor } | null>(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const paisSeleccionado = catalogos.paises.find(pais => String(pais.id_pais) === formulario.idPais);
  const tipoSeleccionado = catalogos.tiposIdentificador.find(tipo => String(tipo.id_tipo_identificador) === formulario.idTipoIdentificador);
  const esRutChileno = /chile/i.test(paisSeleccionado?.nombre_pais || '') && /\brut\b/i.test(tipoSeleccionado?.nombre_tipo_identificador || '');
  const rutInvalido = esRutChileno && !esRutValido(formulario.identificador);

  useEffect(() => {
    void respuestaJson('/proveedores/catalogos').then(setCatalogos).catch(causa => setError(causa.message));
  }, []);
  useEffect(() => {
    const cancelacion = new AbortController();
    const espera = window.setTimeout(() => {
      setCargando(true); setError('');
      const parametros = new URLSearchParams({ estado, situacion });
      if (busqueda.trim()) parametros.set('busqueda', busqueda.trim());
      if (puedeOrdenar) { parametros.set('ordenar', ordenar); parametros.set('direccion', direccion); }
      respuestaJson(`/proveedores?${parametros}`, { signal: cancelacion.signal })
        .then(setProveedores).catch(causa => { if (!cancelacion.signal.aborted) setError(causa.message); })
        .finally(() => { if (!cancelacion.signal.aborted) setCargando(false); });
    }, 250);
    return () => { window.clearTimeout(espera); cancelacion.abort(); };
  }, [busqueda, estado, situacion, ordenar, direccion, version, puedeOrdenar]);

  const abrir = async (modo: Modo, proveedor?: Proveedor) => {
    setError(''); setMensaje('');
    if (!proveedor) { setFormulario(formularioVacio); setModal({ modo }); return; }
    try {
      const ficha: FichaEdicion = await respuestaJson(`/proveedores/${proveedor.idProveedor}/ficha`);
      setFormulario({ idPais: ficha.identidad.idPais === null ? '' : String(ficha.identidad.idPais), idTipoIdentificador: String(ficha.identidad.idTipoIdentificador), identificador: ficha.identidad.identificadorFiscal, razonSocial: ficha.identidad.razonSocial, tipoProveedor: ficha.identidad.tipoProveedor, contacto: ficha.contacto.nombre || '', correo: ficha.contacto.correo || '', telefono: ficha.contacto.telefono || '', direccion: ficha.contacto.direccion || '', motivo: '' });
      setModal({ modo, proveedor });
    } catch (causa) { setError((causa as Error).message); }
  };

  const guardar = async () => {
    if (!modal) return;
    if (rutInvalido) { setError('RUT no válido'); return; }
    setGuardando(true); setError('');
    try {
      const base = { razonSocial: formulario.razonSocial, tipoProveedor: formulario.tipoProveedor, contacto: formulario.contacto, correo: formulario.correo, telefono: formulario.telefono, direccion: formulario.direccion, motivo: formulario.motivo };
      if (modal.modo === 'nuevo') await respuestaJson('/proveedores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...base, idPais: formulario.idPais, idTipoIdentificador: formulario.idTipoIdentificador, identificador: formulario.identificador }) });
      if (modal.modo === 'editar') await respuestaJson(`/proveedores/${modal.proveedor!.idProveedor}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(base) });
      if (modal.modo === 'identidad') await respuestaJson(`/proveedores/${modal.proveedor!.idProveedor}/corregir-identidad`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idPais: formulario.idPais, idTipoIdentificador: formulario.idTipoIdentificador, identificador: formulario.identificador, motivo: formulario.motivo }) });
      setMensaje(modal.modo === 'nuevo' ? 'Proveedor registrado.' : modal.modo === 'editar' ? 'Información actualizada.' : 'Identidad fiscal corregida.');
      setModal(null); setVersion(valor => valor + 1);
    } catch (causa) { setError((causa as Error).message); }
    finally { setGuardando(false); }
  };

  const cambiarEstado = async (proveedor: Proveedor) => {
    const accion = proveedor.estado === 'activo' ? 'desactivar' : 'reactivar';
    if (!await confirmarAccion(`¿Confirmas ${accion} a ${proveedor.razonSocial}?`)) return;
    try {
      await respuestaJson(`/proveedores/${proveedor.idProveedor}/${accion}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmado: true }) });
      setMensaje(accion === 'desactivar' ? 'Proveedor desactivado.' : 'Proveedor reactivado.'); setVersion(valor => valor + 1);
    } catch (causa) { setError((causa as Error).message); }
  };

  const etiqueta = (valor: Proveedor['situacionFinanciera']) => ({ Vencida: 'bg-red-100 text-red-700', 'Por vencer': 'bg-amber-100 text-amber-800', 'Por pagar': 'bg-blue-100 text-blue-700', 'Sin deuda': 'bg-emerald-100 text-emerald-700' }[valor]);
  const tituloModal = modal?.modo === 'nuevo' ? 'Nuevo proveedor' : modal?.modo === 'editar' ? 'Editar proveedor' : 'Corregir identidad fiscal';

  return <div className="min-h-full bg-slate-50 p-5 lg:p-8">
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm font-semibold text-primary-600">Proveedores y egresos</p><h1 className="text-2xl font-bold text-gray-900">Catálogo de proveedores</h1></div>
        {puede('CU75') && <button onClick={() => void abrir('nuevo')} className="flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 font-semibold text-white hover:bg-primary-700"><Plus className="h-4 w-4"/>Nuevo proveedor</button>}
      </header>
      {(error || mensaje) && <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || mensaje}</div>}
      <section className={`mb-5 grid gap-3 border-y border-gray-200 bg-white px-4 py-4 ${puedeOrdenar ? 'md:grid-cols-[minmax(260px,1fr)_160px_180px_180px_130px]' : 'md:grid-cols-[1fr_180px_190px]'}`}>
        <label className="relative"><span className="sr-only">Buscar proveedor</span><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400"/><input value={busqueda} onChange={evento => setBusqueda(evento.target.value)} placeholder="Razón social o identificación fiscal" className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-3 outline-none focus:border-primary-500"/></label>
        <select aria-label="Filtrar por estado" value={estado} onChange={evento => setEstado(evento.target.value)} className="rounded-md border border-gray-300 px-3 py-2.5"><option value="todos">Todos los estados</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select>
        <select aria-label="Filtrar por situación" value={situacion} onChange={evento => setSituacion(evento.target.value)} className="rounded-md border border-gray-300 px-3 py-2.5"><option value="todos">Toda situación</option><option value="vencida">Vencida</option><option value="por vencer">Por vencer</option><option value="por pagar">Por pagar</option><option value="sin deuda">Sin deuda</option></select>
        {puedeOrdenar && <><label className="relative"><span className="sr-only">Ordenar proveedores</span><ArrowUpDown className="absolute left-3 top-3 h-4 w-4 text-gray-400"/><select aria-label="Ordenar proveedores" value={ordenar} onChange={evento => setOrdenar(evento.target.value)} className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-3"><option value="razonSocial">Razón social</option><option value="identificador">Identificador</option><option value="saldoPendiente">Saldo pendiente</option></select></label><select aria-label="Dirección del orden" value={direccion} onChange={evento => setDireccion(evento.target.value)} className="rounded-md border border-gray-300 px-3 py-2.5"><option value="asc">Ascendente</option><option value="desc">Descendente</option></select></>}
      </section>
      <div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b bg-gray-50 text-gray-600"><tr><th className="px-4 py-3">Identificación</th><th className="px-4 py-3">Razón social</th><th className="px-4 py-3">País</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Saldo pendiente</th><th className="px-4 py-3">Situación</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
          <tbody>{proveedores.map(proveedor => <tr key={proveedor.idProveedor} className="border-b border-gray-100 last:border-0 hover:bg-gray-50"><td className="px-4 py-3"><div className="font-medium text-gray-900">{proveedor.identificadorFiscal}</div><div className="text-xs text-gray-500">{proveedor.tipoIdentificador}</div></td><td className="px-4 py-3 font-medium">{proveedor.razonSocial}</td><td className="px-4 py-3">{proveedor.pais}</td><td className="px-4 py-3">{proveedor.tipoProveedor}</td><td className="px-4 py-3 capitalize">{proveedor.estado}</td><td className="px-4 py-3 text-right font-semibold">$ {proveedor.saldoPendienteTotal.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${etiqueta(proveedor.situacionFinanciera)}`}>{proveedor.situacionFinanciera}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-1">
            {puede('CU84') && <button title="Abrir ficha" onClick={() => navegar(`/proveedores/${proveedor.idProveedor}`)} className="rounded p-2 text-gray-600 hover:bg-gray-100"><Eye className="h-4 w-4"/></button>}
            {puede('CU76') && <button title="Editar información" onClick={() => void abrir('editar', proveedor)} className="rounded p-2 text-blue-700 hover:bg-blue-50"><Edit3 className="h-4 w-4"/></button>}
            {puede('CU77') && <button title="Corregir identidad fiscal" onClick={() => void abrir('identidad', proveedor)} className="rounded p-2 text-amber-700 hover:bg-amber-50"><ShieldCheck className="h-4 w-4"/></button>}
            {proveedor.estado === 'activo' && puede('CU78') && <button title="Desactivar" onClick={() => void cambiarEstado(proveedor)} className="rounded p-2 text-red-700 hover:bg-red-50"><Power className="h-4 w-4"/></button>}
            {proveedor.estado === 'inactivo' && puede('CU79') && <button title="Reactivar" onClick={() => void cambiarEstado(proveedor)} className="rounded p-2 text-emerald-700 hover:bg-emerald-50"><RefreshCcw className="h-4 w-4"/></button>}
          </div></td></tr>)}</tbody></table></div>
        {!cargando && !proveedores.length && <div className="py-14 text-center text-gray-500"><Building2 className="mx-auto mb-3 h-8 w-8"/>No hay proveedores para los criterios seleccionados.</div>}
        {cargando && <div className="py-14 text-center text-gray-500">Cargando proveedores...</div>}
      </div>
    </div>

    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md bg-white shadow-xl">
      <div className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-lg font-bold">{tituloModal}</h2><button title="Cerrar" onClick={() => setModal(null)} className="rounded p-2 hover:bg-gray-100"><X className="h-5 w-5"/></button></div>
      <div className="grid gap-4 p-5 md:grid-cols-2" onBlurCapture={() => { if (esRutChileno && esRutValido(formulario.identificador)) setFormulario({...formulario, identificador: formatearRutValido(formulario.identificador)}); }}>
        {rutInvalido && <p className="text-sm text-red-600 md:col-span-2">RUT no válido</p>}
        {(modal.modo === 'nuevo' || modal.modo === 'identidad') && <><label className="text-sm font-medium">País<select value={formulario.idPais} onChange={evento => setFormulario({...formulario, idPais: evento.target.value})} className="mt-1 w-full rounded-md border p-2.5"><option value="">Seleccionar</option>{catalogos.paises.map(pais => <option key={pais.id_pais} value={pais.id_pais}>{pais.nombre_pais}</option>)}</select></label><label className="text-sm font-medium">Tipo de identificación<select value={formulario.idTipoIdentificador} onChange={evento => setFormulario({...formulario, idTipoIdentificador: evento.target.value})} className="mt-1 w-full rounded-md border p-2.5"><option value="">Seleccionar</option>{catalogos.tiposIdentificador.map(tipo => <option key={tipo.id_tipo_identificador} value={tipo.id_tipo_identificador}>{tipo.nombre_tipo_identificador}</option>)}</select></label><label className="text-sm font-medium md:col-span-2">Identificador fiscal<input value={formulario.identificador} onChange={evento => setFormulario({...formulario, identificador: evento.target.value})} className="mt-1 w-full rounded-md border p-2.5"/></label></>}
        {(modal.modo === 'nuevo' || modal.modo === 'editar') && <><label className="text-sm font-medium md:col-span-2">Razón social<input value={formulario.razonSocial} onChange={evento => setFormulario({...formulario, razonSocial: evento.target.value})} className="mt-1 w-full rounded-md border p-2.5"/></label><label className="text-sm font-medium md:col-span-2">Tipo de proveedor<select value={formulario.tipoProveedor} onChange={evento => setFormulario({...formulario, tipoProveedor: evento.target.value})} className="mt-1 w-full rounded-md border p-2.5">{catalogos.tiposProveedor.map(tipo => <option key={tipo}>{tipo}</option>)}</select></label><label className="text-sm font-medium">Contacto<input value={formulario.contacto} onChange={evento => setFormulario({...formulario, contacto: evento.target.value})} className="mt-1 w-full rounded-md border p-2.5"/></label><label className="text-sm font-medium">Correo<input type="email" value={formulario.correo} onChange={evento => setFormulario({...formulario, correo: evento.target.value})} className="mt-1 w-full rounded-md border p-2.5"/></label><label className="text-sm font-medium">Teléfono<input value={formulario.telefono} onChange={evento => setFormulario({...formulario, telefono: evento.target.value})} className="mt-1 w-full rounded-md border p-2.5"/></label><label className="text-sm font-medium">Dirección<input value={formulario.direccion} onChange={evento => setFormulario({...formulario, direccion: evento.target.value})} className="mt-1 w-full rounded-md border p-2.5"/></label></>}
        {(modal.modo === 'identidad' || modal.modo === 'editar') && <label className="text-sm font-medium md:col-span-2">Motivo {modal.modo === 'identidad' ? '(obligatorio)' : '(obligatorio si cambia la razón social)'}<textarea value={formulario.motivo} onChange={evento => setFormulario({...formulario, motivo: evento.target.value})} rows={3} className="mt-1 w-full rounded-md border p-2.5"/></label>}
      </div>
      <div className="flex justify-end gap-3 border-t px-5 py-4"><button onClick={() => setModal(null)} className="rounded-md border px-4 py-2">Cancelar</button><button disabled={guardando} onClick={() => void guardar()} className="rounded-md bg-primary-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{guardando ? 'Guardando...' : 'Guardar'}</button></div>
    </div></div>}
  </div>;
}
