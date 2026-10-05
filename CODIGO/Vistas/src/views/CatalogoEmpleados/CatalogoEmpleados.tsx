import { useEffect, useState } from 'react';
import { ArrowUpDown, BriefcaseBusiness, Eye, Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { solicitarFinanzas } from '../../api/finanzas';
import { usarSesion } from '../../seguridad/Sesion';

type Empleado = {
  id: number;
  rut: string;
  nombreCompleto: string;
  estado: string;
  cargoActual: string | null;
};

async function respuestaJson(ruta: string, opciones?: RequestInit) {
  const respuesta = await solicitarFinanzas(ruta, opciones);
  const resultado = await respuesta.json();
  if (!respuesta.ok) throw new Error(resultado.error || 'No fue posible completar la operación');
  return resultado;
}

export default function CatalogoEmpleados() {
  const navegar = useNavigate();
  const { sesion } = usarSesion();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('todos');
  const [ordenar, setOrdenar] = useState('nombre');
  const [direccion, setDireccion] = useState('asc');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [version, setVersion] = useState(0);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [empleadoCreado, setEmpleadoCreado] = useState<number | null>(null);
  const [formulario, setFormulario] = useState({ rut: '', nombres: '', apellidoPaterno: '', apellidoMaterno: '' });

  useEffect(() => {
    const cancelacion = new AbortController();
    const espera = window.setTimeout(() => {
      const parametros = new URLSearchParams({ estado, ordenar, direccion });
      if (busqueda.trim()) parametros.set('busqueda', busqueda.trim());
      setCargando(true);
      setError('');
      respuestaJson(`/empleados?${parametros}`, { signal: cancelacion.signal })
        .then(setEmpleados)
        .catch((causa) => { if (!cancelacion.signal.aborted) setError(causa.message); })
        .finally(() => { if (!cancelacion.signal.aborted) setCargando(false); });
    }, 250);
    return () => { window.clearTimeout(espera); cancelacion.abort(); };
  }, [busqueda, estado, ordenar, direccion, version]);

  const guardarEmpleado = async () => {
    setGuardando(true);
    setError('');
    try {
      const empleado: Empleado = await respuestaJson('/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario),
      });
      setModalAbierto(false);
      setFormulario({ rut: '', nombres: '', apellidoPaterno: '', apellidoMaterno: '' });
      setEmpleadoCreado(empleado.id);
      setMensaje('Empleado registrado correctamente.');
      setVersion((valor) => valor + 1);
    } catch (causa) {
      setError((causa as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return <div className="min-h-full bg-slate-50 p-5 lg:p-8">
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm font-semibold text-primary-600">Remuneraciones</p><h1 className="text-2xl font-bold text-gray-900">Catálogo de empleados</h1></div>
        {sesion?.permisos.includes('CU156') && <button onClick={() => { setError(''); setMensaje(''); setModalAbierto(true); }} className="flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 font-semibold text-white hover:bg-primary-700"><Plus className="h-4 w-4" />Nuevo empleado</button>}
      </header>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {mensaje && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><span>{mensaje}</span>{empleadoCreado && <button onClick={() => navegar(`/empleados/${empleadoCreado}`)} className="font-semibold underline">Abrir ficha</button>}</div>}

      <section className="mb-5 grid gap-3 border-y border-gray-200 bg-white px-4 py-4 md:grid-cols-[minmax(260px,1fr)_180px_180px_130px]">
        <label className="relative">
          <span className="sr-only">Buscar empleado</span>
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Nombre o RUT" className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-3 outline-none focus:border-primary-500" />
        </label>
        <select aria-label="Filtrar por estado" value={estado} onChange={(evento) => setEstado(evento.target.value)} className="rounded-md border border-gray-300 px-3 py-2.5">
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
          <option value="desvinculado">Desvinculados</option>
          <option value="suspendido">Suspendidos</option>
        </select>
        <label className="relative">
          <span className="sr-only">Ordenar empleados</span>
          <ArrowUpDown className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <select value={ordenar} onChange={(evento) => setOrdenar(evento.target.value)} className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-3">
            <option value="nombre">Nombre</option><option value="rut">RUT</option><option value="estado">Estado</option><option value="cargo">Cargo</option>
          </select>
        </label>
        <select aria-label="Dirección del orden" value={direccion} onChange={(evento) => setDireccion(evento.target.value)} className="rounded-md border border-gray-300 px-3 py-2.5">
          <option value="asc">Ascendente</option><option value="desc">Descendente</option>
        </select>
      </section>

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b bg-gray-50 text-gray-600"><tr><th className="px-4 py-3">RUT</th><th className="px-4 py-3">Empleado</th><th className="px-4 py-3">Cargo actual</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acción</th></tr></thead>
          <tbody>{empleados.map((empleado) => <tr key={empleado.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50"><td className="px-4 py-3 font-medium text-gray-900">{empleado.rut}</td><td className="px-4 py-3">{empleado.nombreCompleto}</td><td className="px-4 py-3">{empleado.cargoActual || 'Sin configurar'}</td><td className="px-4 py-3 capitalize">{empleado.estado}</td><td className="px-4 py-3 text-right"><button title="Abrir ficha" onClick={() => navegar(`/empleados/${empleado.id}`)} className="rounded p-2 text-gray-600 hover:bg-gray-100"><Eye className="h-4 w-4" /></button></td></tr>)}</tbody>
        </table></div>
        {cargando && <div className="py-14 text-center text-gray-500">Cargando empleados...</div>}
        {!cargando && !empleados.length && <div className="py-14 text-center text-gray-500"><BriefcaseBusiness className="mx-auto mb-3 h-8 w-8" />No hay empleados para los criterios seleccionados.</div>}
      </div>
    </div>

    {modalAbierto && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-xl rounded-md bg-white shadow-xl">
      <div className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-lg font-bold">Nuevo empleado</h2><button title="Cerrar" onClick={() => setModalAbierto(false)} className="rounded p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        <label className="text-sm font-medium md:col-span-2">RUT<input value={formulario.rut} onChange={(evento) => setFormulario({ ...formulario, rut: evento.target.value })} placeholder="12.345.678-5" className="mt-1 w-full rounded-md border border-gray-300 p-2.5" /></label>
        <label className="text-sm font-medium md:col-span-2">Nombres<input value={formulario.nombres} onChange={(evento) => setFormulario({ ...formulario, nombres: evento.target.value })} className="mt-1 w-full rounded-md border border-gray-300 p-2.5" /></label>
        <label className="text-sm font-medium">Apellido paterno<input value={formulario.apellidoPaterno} onChange={(evento) => setFormulario({ ...formulario, apellidoPaterno: evento.target.value })} className="mt-1 w-full rounded-md border border-gray-300 p-2.5" /></label>
        <label className="text-sm font-medium">Apellido materno<input value={formulario.apellidoMaterno} onChange={(evento) => setFormulario({ ...formulario, apellidoMaterno: evento.target.value })} className="mt-1 w-full rounded-md border border-gray-300 p-2.5" /></label>
      </div>
      <div className="flex justify-end gap-3 border-t px-5 py-4"><button onClick={() => setModalAbierto(false)} className="rounded-md border px-4 py-2">Cancelar</button><button disabled={guardando} onClick={() => void guardarEmpleado()} className="rounded-md bg-primary-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{guardando ? 'Guardando...' : 'Registrar empleado'}</button></div>
    </div></div>}
  </div>;
}
