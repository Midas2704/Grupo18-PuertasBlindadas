import { solicitarTexto } from '../../components/DialogosSistema';
import { useEffect, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, CalendarDays, CircleDollarSign, FileCheck2, FileText, Layers3, Plus, Save, Sparkles } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { solicitarFinanzas } from '../../api/finanzas';
import { usarSesion } from '../../seguridad/Sesion';

type Empleado = {
  id: number;
  rut: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  nombreCompleto: string;
  fechaNacimiento: string | null;
  estado: string;
  cargoActual: string | null;
};

type RelacionLaboral = {
  id: number;
  fechaInicio: string;
  fechaTermino: string | null;
  estado: string;
  idTipoVinculo: number | null;
  tipoVinculo: string | null;
  jornada: string | null;
};

type TipoVinculo = { id: number; nombre: string };
type Catalogo = { id: number; nombre: string };
type Asignacion = { id: number; esquema?: string; concepto?: string; vigenciaDesde: string; vigenciaHasta: string | null; activa: boolean };
type Deduccion = Asignacion & { idConcepto:number; valorAplicable:string|null; fundamento:string; autorizacionReferencia:string };
type PerfilRemuneracional = {
  idCargo: number | null;
  sueldoBaseActual: number | null;
  fechaAplicacionSueldoBase: string | null;
  idAfp: number | null;
  idInstitucionSalud: number | null;
  seguroCesantia: boolean;
  correoParticular: string | null;
  telefonoParticular: string | null;
  direccionParticular: string | null;
  tipoCorreo: string | null;
  consentimientoElectronico: boolean | null;
  canalDocumental: string | null;
};

async function respuestaJson(ruta: string, opciones?: RequestInit) {
  const respuesta = await solicitarFinanzas(ruta, opciones);
  const resultado = await respuesta.json();
  if (!respuesta.ok) throw new Error(resultado.error || 'No fue posible completar la operación');
  return resultado;
}

export default function FichaEmpleado() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { sesion } = usarSesion();
  const puedeCU157 = Boolean(sesion?.permisos.includes('CU157'));
  const puedeCU158 = Boolean(sesion?.permisos.includes('CU158'));
  const puedeCU159 = Boolean(sesion?.permisos.includes('CU159'));
  const puedeCU160 = Boolean(sesion?.permisos.includes('CU160'));
  const puedeCU161 = Boolean(sesion?.permisos.includes('CU161'));
  const puedeCU214 = Boolean(sesion?.permisos.includes('CU214'));
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [relaciones, setRelaciones] = useState<RelacionLaboral[]>([]);
  const [tiposVinculo, setTiposVinculo] = useState<TipoVinculo[]>([]);
  const [cargos, setCargos] = useState<Catalogo[]>([]);
  const [afps, setAfps] = useState<Catalogo[]>([]);
  const [institucionesSalud, setInstitucionesSalud] = useState<Catalogo[]>([]);
  const [datosBase, setDatosBase] = useState({ nombres: '', apellidoPaterno: '', apellidoMaterno: '', fechaNacimiento: '', estado: 'activo' });
  const [nuevaRelacion, setNuevaRelacion] = useState({ fechaInicio: '', idTipoVinculo: '', jornada: '' });
  const [perfil, setPerfil] = useState({ idCargo: '', sueldoBaseActual: '', fechaAplicacionSueldoBase: '', idAfp: '', idInstitucionSalud: '', seguroCesantia: true, correoParticular: '', telefonoParticular: '', direccionParticular: '', tipoCorreo: '', consentimientoElectronico: false, canalDocumental: '' });
  const [esquemas, setEsquemas] = useState<Catalogo[]>([]);
  const [asignacionesEsquema, setAsignacionesEsquema] = useState<Asignacion[]>([]);
  const [haberes, setHaberes] = useState<Catalogo[]>([]);
  const [asignacionesHaber, setAsignacionesHaber] = useState<Asignacion[]>([]);
  const [nuevaAsignacionEsquema, setNuevaAsignacionEsquema] = useState({ idEsquema: '', vigenciaDesde: '', vigenciaHasta: '' });
  const [nuevaAsignacionHaber, setNuevaAsignacionHaber] = useState({ idConcepto: '', vigenciaDesde: '', vigenciaHasta: '', valorAplicable: '' });
  const [documental, setDocumental] = useState({ consentimientoElectronico: false, canalDocumental: '', canalesDisponibles: [] as string[] });
  const [deducciones,setDeducciones]=useState<Deduccion[]>([]),[catalogoDeducciones,setCatalogoDeducciones]=useState<Catalogo[]>([]);
  const [nuevaDeduccion,setNuevaDeduccion]=useState({idConcepto:'',vigenciaDesde:'',vigenciaHasta:'',valorAplicable:'',fundamento:'',autorizacionReferencia:''});
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const cancelacion = new AbortController();
    respuestaJson(`/empleados/${id}`, { signal: cancelacion.signal })
      .then((resultado: Empleado) => {
        setEmpleado(resultado);
        setDatosBase({ nombres: resultado.nombres, apellidoPaterno: resultado.apellidoPaterno, apellidoMaterno: resultado.apellidoMaterno || '', fechaNacimiento: resultado.fechaNacimiento?.slice(0, 10) || '', estado: resultado.estado });
      })
      .catch((causa) => { if (!cancelacion.signal.aborted) setError(causa.message); });
    return () => cancelacion.abort();
  }, [id, version]);

  useEffect(() => {
    if (!puedeCU157) return;
    const cancelacion = new AbortController();
    Promise.all([
      respuestaJson(`/empleados/${id}/relaciones-laborales`, { signal: cancelacion.signal }),
      respuestaJson('/empleados/catalogos/laborales', { signal: cancelacion.signal }),
    ]).then(([periodos, catalogos]) => {
      setRelaciones(periodos);
      setTiposVinculo(catalogos.tiposVinculo);
    }).catch((causa) => { if (!cancelacion.signal.aborted) setError(causa.message); });
    return () => cancelacion.abort();
  }, [id, puedeCU157, version]);

  useEffect(() => {
    if (!puedeCU158) return;
    const cancelacion = new AbortController();
    Promise.all([
      respuestaJson(`/empleados/${id}/perfil-remuneracional`, { signal: cancelacion.signal }),
      respuestaJson('/empleados/catalogos/remuneracionales', { signal: cancelacion.signal }),
    ]).then(([actual, catalogos]: [PerfilRemuneracional, { cargos: Catalogo[]; afps: Catalogo[]; institucionesSalud: Catalogo[] }]) => {
      setPerfil({
        idCargo: actual.idCargo === null ? '' : String(actual.idCargo),
        sueldoBaseActual: actual.sueldoBaseActual === null ? '' : String(actual.sueldoBaseActual),
        fechaAplicacionSueldoBase: actual.fechaAplicacionSueldoBase?.slice(0, 10) || '',
        idAfp: actual.idAfp === null ? '' : String(actual.idAfp),
        idInstitucionSalud: actual.idInstitucionSalud === null ? '' : String(actual.idInstitucionSalud),
        seguroCesantia: actual.seguroCesantia,
        correoParticular: actual.correoParticular || '',
        telefonoParticular: actual.telefonoParticular || '',
        direccionParticular: actual.direccionParticular || '',
        tipoCorreo: actual.tipoCorreo || '',
        consentimientoElectronico: actual.consentimientoElectronico === true,
        canalDocumental: actual.canalDocumental || '',
      });
      setCargos(catalogos.cargos); setAfps(catalogos.afps); setInstitucionesSalud(catalogos.institucionesSalud);
    }).catch((causa) => { if (!cancelacion.signal.aborted) setError(causa.message); });
    return () => cancelacion.abort();
  }, [id, puedeCU158, version]);

  useEffect(() => {
    const cancelacion = new AbortController();
    const tareas: Promise<void>[] = [];
    if (puedeCU159) tareas.push(Promise.all([respuestaJson(`/empleados/${id}/esquemas`, { signal: cancelacion.signal }), respuestaJson('/empleados/catalogos/esquemas', { signal: cancelacion.signal })]).then(([asignaciones, catalogo]) => { setAsignacionesEsquema(asignaciones); setEsquemas(catalogo); }));
    if (puedeCU160) tareas.push(Promise.all([respuestaJson(`/empleados/${id}/haberes`, { signal: cancelacion.signal }), respuestaJson('/empleados/catalogos/haberes', { signal: cancelacion.signal })]).then(([asignaciones, catalogo]) => { setAsignacionesHaber(asignaciones); setHaberes(catalogo); }));
    if (puedeCU161) tareas.push(respuestaJson(`/empleados/${id}/configuracion-documental`, { signal: cancelacion.signal }).then((actual) => setDocumental({ consentimientoElectronico: actual.consentimientoElectronico === true, canalDocumental: actual.canalDocumental || '', canalesDisponibles: actual.canalesDisponibles })));
    Promise.all(tareas).catch((causa) => { if (!cancelacion.signal.aborted) setError(causa.message); });
    return () => cancelacion.abort();
  }, [id, puedeCU159, puedeCU160, puedeCU161, version]);

  useEffect(()=>{if(!puedeCU214)return;const c=new AbortController();Promise.all([respuestaJson(`/empleados/${id}/deducciones`,{signal:c.signal}),respuestaJson('/empleados/catalogos/deducciones',{signal:c.signal})]).then(([a,catalogo])=>{setDeducciones(a);setCatalogoDeducciones(catalogo)}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[id,puedeCU214,version]);

  const guardarDatosBase = async () => {
    setGuardando(true); setError(''); setMensaje('');
    try {
      await respuestaJson(`/empleados/${id}/datos-base`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosBase) });
      setMensaje('Datos generales actualizados.'); setVersion((valor) => valor + 1);
    } catch (causa) { setError((causa as Error).message); }
    finally { setGuardando(false); }
  };

  const crearRelacion = async () => {
    setGuardando(true); setError(''); setMensaje('');
    try {
      await respuestaJson(`/empleados/${id}/relaciones-laborales`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevaRelacion) });
      setNuevaRelacion({ fechaInicio: '', idTipoVinculo: '', jornada: '' });
      setMensaje('Período laboral registrado.'); setVersion((valor) => valor + 1);
    } catch (causa) { setError((causa as Error).message); }
    finally { setGuardando(false); }
  };

  const terminarRelacion = async (relacion: RelacionLaboral) => {
    const fechaTermino = await solicitarTexto('Fecha de término (AAAA-MM-DD)');
    if (!fechaTermino) return;
    setError(''); setMensaje('');
    try {
      await respuestaJson(`/empleados/${id}/relaciones-laborales/${relacion.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fechaTermino }) });
      setMensaje('Relación laboral terminada y conservada en la ficha.'); setVersion((valor) => valor + 1);
    } catch (causa) { setError((causa as Error).message); }
  };

  const guardarPerfil = async () => {
    setGuardando(true); setError(''); setMensaje('');
    try {
      await respuestaJson(`/empleados/${id}/perfil-remuneracional`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(perfil) });
      setMensaje('Perfil remuneracional actualizado.'); setVersion((valor) => valor + 1);
    } catch (causa) { setError((causa as Error).message); }
    finally { setGuardando(false); }
  };

  const asignar = async (tipo: 'esquemas' | 'haberes') => {
    setGuardando(true); setError(''); setMensaje('');
    try {
      const formulario = tipo === 'esquemas' ? nuevaAsignacionEsquema : nuevaAsignacionHaber;
      await respuestaJson(`/empleados/${id}/${tipo}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formulario) });
      setMensaje(tipo === 'esquemas' ? 'Esquema asignado.' : 'HABER asignado.'); setVersion((valor) => valor + 1);
    } catch (causa) { setError((causa as Error).message); } finally { setGuardando(false); }
  };

  const guardarDocumental = async () => {
    setGuardando(true); setError(''); setMensaje('');
    try { await respuestaJson(`/empleados/${id}/configuracion-documental`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(documental) }); setMensaje('Configuración documental actualizada.'); setVersion((valor) => valor + 1); }
    catch (causa) { setError((causa as Error).message); } finally { setGuardando(false); }
  };
  const asignarDeduccion=async()=>{setGuardando(true);setError('');try{await respuestaJson(`/empleados/${id}/deducciones`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(nuevaDeduccion)});setNuevaDeduccion({idConcepto:'',vigenciaDesde:'',vigenciaHasta:'',valorAplicable:'',fundamento:'',autorizacionReferencia:''});setMensaje('Deducción recurrente asignada.');setVersion(v=>v+1)}catch(e){setError((e as Error).message)}finally{setGuardando(false)}};
  const finalizarDeduccion=async(a:Deduccion)=>{const vigenciaHasta=await solicitarTexto('Fecha de término (AAAA-MM-DD)');if(!vigenciaHasta)return;try{await respuestaJson(`/empleados/${id}/deducciones/${a.id}/finalizar`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({vigenciaHasta})});setVersion(v=>v+1)}catch(e){setError((e as Error).message)}};

  return <div className="min-h-full bg-slate-50 p-5 lg:p-8"><div className="mx-auto max-w-6xl">
    <button onClick={() => navegar('/empleados')} className="mb-5 flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900"><ArrowLeft className="h-4 w-4" />Volver al catálogo</button>
    {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {mensaje && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensaje}</div>}
    {!empleado && !error && <div className="py-16 text-center text-gray-500">Cargando ficha...</div>}
    {empleado && <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-primary-600">Ficha de empleado</p><h1 className="text-2xl font-bold text-gray-900">{empleado.nombreCompleto}</h1><p className="mt-1 text-sm text-gray-500">{empleado.rut}</p></div><div className="flex items-center gap-2">{sesion?.permisos.includes('CU191')&&<button title="Documentos de remuneración" onClick={()=>navegar(`/documentos-remuneracion?idEmpleado=${empleado.id}`)} className="rounded border bg-white p-2"><FileText className="h-4 w-4"/></button>}<span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold capitalize text-gray-700">{empleado.estado}</span></div></header>

      <section className="border-y border-gray-200 bg-white px-5 py-5">
        <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-primary-600" /><h2 className="font-bold text-gray-900">Datos generales</h2></div>{puedeCU157 && <button disabled={guardando} onClick={() => void guardarDatosBase()} className="flex items-center gap-2 rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />Guardar</button>}</div>
        {puedeCU157 ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-medium">Nombres<input value={datosBase.nombres} onChange={(evento) => setDatosBase({ ...datosBase, nombres: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5" /></label><label className="text-sm font-medium">Apellido paterno<input value={datosBase.apellidoPaterno} onChange={(evento) => setDatosBase({ ...datosBase, apellidoPaterno: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5" /></label><label className="text-sm font-medium">Apellido materno<input value={datosBase.apellidoMaterno} onChange={(evento) => setDatosBase({ ...datosBase, apellidoMaterno: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5" /></label><label className="text-sm font-medium">Fecha de nacimiento<input type="date" value={datosBase.fechaNacimiento} onChange={(evento) => setDatosBase({ ...datosBase, fechaNacimiento: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5" /></label></div> : <dl className="grid gap-4 text-sm md:grid-cols-3"><div><dt className="text-gray-500">Nombres</dt><dd className="mt-1 font-medium">{empleado.nombres}</dd></div><div><dt className="text-gray-500">Apellidos</dt><dd className="mt-1 font-medium">{[empleado.apellidoPaterno, empleado.apellidoMaterno].filter(Boolean).join(' ')}</dd></div><div><dt className="text-gray-500">Cargo actual</dt><dd className="mt-1 font-medium">{empleado.cargoActual || 'Sin configurar'}</dd></div></dl>}
      </section>

      {puedeCU157 && <section className="mt-6 border-y border-gray-200 bg-white px-5 py-5">
        <div className="mb-4 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary-600" /><h2 className="font-bold text-gray-900">Relación laboral</h2></div>
        <div className="mb-5 grid gap-3 border-b border-gray-200 pb-5 md:grid-cols-[180px_1fr_1fr_auto]"><label className="text-sm font-medium">Fecha de inicio<input type="date" value={nuevaRelacion.fechaInicio} onChange={(evento) => setNuevaRelacion({ ...nuevaRelacion, fechaInicio: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5" /></label><label className="text-sm font-medium">Tipo de vínculo<select value={nuevaRelacion.idTipoVinculo} onChange={(evento) => setNuevaRelacion({ ...nuevaRelacion, idTipoVinculo: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"><option value="">Sin especificar</option>{tiposVinculo.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}</select></label><label className="text-sm font-medium">Jornada<input value={nuevaRelacion.jornada} onChange={(evento) => setNuevaRelacion({ ...nuevaRelacion, jornada: evento.target.value })} placeholder="Opcional" className="mt-1 w-full rounded-md border p-2.5" /></label><button disabled={guardando} onClick={() => void crearRelacion()} className="mt-6 flex h-10 items-center justify-center gap-2 rounded-md bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />Registrar período</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b bg-gray-50 text-gray-600"><tr><th className="px-3 py-2.5">Inicio</th><th className="px-3 py-2.5">Término</th><th className="px-3 py-2.5">Vínculo</th><th className="px-3 py-2.5">Jornada</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5 text-right">Acción</th></tr></thead><tbody>{relaciones.map((relacion) => <tr key={relacion.id} className="border-b last:border-0"><td className="px-3 py-3">{relacion.fechaInicio.slice(0, 10)}</td><td className="px-3 py-3">{relacion.fechaTermino?.slice(0, 10) || 'Vigente'}</td><td className="px-3 py-3">{relacion.tipoVinculo || 'Sin especificar'}</td><td className="px-3 py-3">{relacion.jornada || 'Sin especificar'}</td><td className="px-3 py-3 capitalize">{relacion.estado}</td><td className="px-3 py-3 text-right">{relacion.estado === 'vigente' && <button onClick={() => void terminarRelacion(relacion)} className="text-sm font-semibold text-red-700 hover:underline">Terminar</button>}</td></tr>)}</tbody></table></div>
        {!relaciones.length && <p className="py-8 text-center text-sm text-gray-500">No hay períodos laborales registrados.</p>}
      </section>}

      {puedeCU158 && <section className="mt-6 border-y border-gray-200 bg-white px-5 py-5">
        <div className="mb-5 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-primary-600" /><h2 className="font-bold text-gray-900">Perfil remuneracional actual</h2></div><button disabled={guardando} onClick={() => void guardarPerfil()} className="flex items-center gap-2 rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />Guardar perfil</button></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">Cargo actual<select value={perfil.idCargo} onChange={(evento) => setPerfil({ ...perfil, idCargo: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"><option value="">Sin configurar</option>{cargos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          <label className="text-sm font-medium">Sueldo base actual<input type="number" min="0" step="1" value={perfil.sueldoBaseActual} onChange={(evento) => setPerfil({ ...perfil, sueldoBaseActual: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5" /></label>
          <label className="text-sm font-medium">Aplicación sueldo base<input type="date" value={perfil.fechaAplicacionSueldoBase} onChange={(evento) => setPerfil({ ...perfil, fechaAplicacionSueldoBase: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5" /></label>
          <label className="text-sm font-medium">AFP actual<select value={perfil.idAfp} onChange={(evento) => setPerfil({ ...perfil, idAfp: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"><option value="">Sin configurar</option>{afps.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          <label className="text-sm font-medium">Institución de salud<select value={perfil.idInstitucionSalud} onChange={(evento) => setPerfil({ ...perfil, idInstitucionSalud: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"><option value="">Sin configurar</option>{institucionesSalud.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          <label className="flex items-center gap-3 self-end rounded-md border px-3 py-2.5 text-sm font-medium"><input type="checkbox" checked={perfil.seguroCesantia} onChange={(evento) => setPerfil({ ...perfil, seguroCesantia: evento.target.checked })} className="h-4 w-4 accent-primary-600" />Seguro de cesantía vigente</label>
          <label className="text-sm font-medium">Correo particular<input type="email" value={perfil.correoParticular} onChange={(evento) => setPerfil({ ...perfil, correoParticular: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5" /></label>
          <label className="text-sm font-medium">Tipo de correo<input value={perfil.tipoCorreo} onChange={(evento) => setPerfil({ ...perfil, tipoCorreo: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5" /></label>
          <label className="text-sm font-medium">Teléfono particular<input value={perfil.telefonoParticular} onChange={(evento) => setPerfil({ ...perfil, telefonoParticular: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5" /></label>
          <label className="text-sm font-medium md:col-span-2">Dirección particular<input value={perfil.direccionParticular} onChange={(evento) => setPerfil({ ...perfil, direccionParticular: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5" /></label>
          <label className="text-sm font-medium">Canal documental actual<input value={perfil.canalDocumental} onChange={(evento) => setPerfil({ ...perfil, canalDocumental: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5" /></label>
          <label className="flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-medium md:col-span-2 lg:col-span-3"><input type="checkbox" checked={perfil.consentimientoElectronico} onChange={(evento) => setPerfil({ ...perfil, consentimientoElectronico: evento.target.checked })} className="h-4 w-4 accent-primary-600" />Consentimiento electrónico vigente (estado actual)</label>
        </div>
      </section>}

      {puedeCU159 && <section className="mt-6 border-y border-gray-200 bg-white px-5 py-5"><div className="mb-4 flex items-center gap-2"><Layers3 className="h-5 w-5 text-primary-600"/><h2 className="font-bold">Esquemas remuneracionales</h2></div>
        {!esquemas.length ? <p className="py-6 text-sm text-gray-500">No existen esquemas remuneracionales disponibles.</p> : <div className="mb-5 grid gap-3 md:grid-cols-4"><select value={nuevaAsignacionEsquema.idEsquema} onChange={e=>setNuevaAsignacionEsquema({...nuevaAsignacionEsquema,idEsquema:e.target.value})} className="rounded-md border p-2.5"><option value="">Seleccionar esquema</option>{esquemas.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select><input type="date" value={nuevaAsignacionEsquema.vigenciaDesde} onChange={e=>setNuevaAsignacionEsquema({...nuevaAsignacionEsquema,vigenciaDesde:e.target.value})} className="rounded-md border p-2.5"/><input type="date" value={nuevaAsignacionEsquema.vigenciaHasta} onChange={e=>setNuevaAsignacionEsquema({...nuevaAsignacionEsquema,vigenciaHasta:e.target.value})} className="rounded-md border p-2.5"/><button disabled={guardando} onClick={()=>void asignar('esquemas')} className="rounded-md bg-gray-900 px-4 text-sm font-semibold text-white">Asignar esquema</button></div>}
        <div className="space-y-2">{asignacionesEsquema.map(x=><div key={x.id} className="flex justify-between border-b py-2 text-sm"><span>{x.esquema}</span><span>{x.vigenciaDesde.slice(0,10)} → {x.vigenciaHasta?.slice(0,10)||'vigente'}</span></div>)}</div>
      </section>}

      {puedeCU160 && <section className="mt-6 border-y border-gray-200 bg-white px-5 py-5"><div className="mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary-600"/><h2 className="font-bold">Haberes individuales</h2></div>
        {!haberes.length ? <p className="py-6 text-sm text-gray-500">No existen conceptos HABER disponibles.</p> : <div className="mb-5 grid gap-3 md:grid-cols-5"><select value={nuevaAsignacionHaber.idConcepto} onChange={e=>setNuevaAsignacionHaber({...nuevaAsignacionHaber,idConcepto:e.target.value})} className="rounded-md border p-2.5"><option value="">Seleccionar HABER</option>{haberes.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select><input type="date" value={nuevaAsignacionHaber.vigenciaDesde} onChange={e=>setNuevaAsignacionHaber({...nuevaAsignacionHaber,vigenciaDesde:e.target.value})} className="rounded-md border p-2.5"/><input type="date" value={nuevaAsignacionHaber.vigenciaHasta} onChange={e=>setNuevaAsignacionHaber({...nuevaAsignacionHaber,vigenciaHasta:e.target.value})} className="rounded-md border p-2.5"/><input type="number" min="0" placeholder="Valor opcional" value={nuevaAsignacionHaber.valorAplicable} onChange={e=>setNuevaAsignacionHaber({...nuevaAsignacionHaber,valorAplicable:e.target.value})} className="rounded-md border p-2.5"/><button disabled={guardando} onClick={()=>void asignar('haberes')} className="rounded-md bg-gray-900 px-4 text-sm font-semibold text-white">Asignar HABER</button></div>}
        <div className="space-y-2">{asignacionesHaber.map(x=><div key={x.id} className="flex justify-between border-b py-2 text-sm"><span>{x.concepto}</span><span>{x.vigenciaDesde.slice(0,10)} → {x.vigenciaHasta?.slice(0,10)||'vigente'}</span></div>)}</div>
      </section>}

      {puedeCU161 && <section className="mt-6 border-y border-gray-200 bg-white px-5 py-5"><div className="mb-4 flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary-600"/><h2 className="font-bold">Consentimiento y canal documental</h2></div><div className="grid gap-4 md:grid-cols-3"><label className="flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-medium"><input type="checkbox" checked={documental.consentimientoElectronico} onChange={e=>setDocumental({...documental,consentimientoElectronico:e.target.checked,canalDocumental:e.target.checked?documental.canalDocumental:''})}/>Consentimiento electrónico vigente</label><select disabled={!documental.consentimientoElectronico} value={documental.canalDocumental} onChange={e=>setDocumental({...documental,canalDocumental:e.target.value})} className="rounded-md border p-2.5 disabled:bg-gray-100"><option value="">Sin canal configurado</option>{documental.canalesDisponibles.map(c=><option key={c} value={c}>{c.replaceAll('_',' ')}</option>)}</select><button disabled={guardando} onClick={()=>void guardarDocumental()} className="flex items-center justify-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white"><Save className="h-4 w-4"/>Guardar configuración</button></div></section>}
      {puedeCU214&&<section className="mt-6 border-y border-gray-200 bg-white px-5 py-5"><h2 className="mb-4 font-bold">Deducciones recurrentes</h2><div className="grid gap-2 md:grid-cols-3"><select value={nuevaDeduccion.idConcepto} onChange={e=>setNuevaDeduccion({...nuevaDeduccion,idConcepto:e.target.value})} className="rounded border p-2"><option value="">Concepto DEDUCCIÓN</option>{catalogoDeducciones.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select><input type="number" min="0" placeholder="Valor opcional" value={nuevaDeduccion.valorAplicable} onChange={e=>setNuevaDeduccion({...nuevaDeduccion,valorAplicable:e.target.value})} className="rounded border p-2"/><input type="date" value={nuevaDeduccion.vigenciaDesde} onChange={e=>setNuevaDeduccion({...nuevaDeduccion,vigenciaDesde:e.target.value})} className="rounded border p-2"/><input placeholder="Fundamento" value={nuevaDeduccion.fundamento} onChange={e=>setNuevaDeduccion({...nuevaDeduccion,fundamento:e.target.value})} className="rounded border p-2"/><input placeholder="Autorización / referencia" value={nuevaDeduccion.autorizacionReferencia} onChange={e=>setNuevaDeduccion({...nuevaDeduccion,autorizacionReferencia:e.target.value})} className="rounded border p-2"/><button disabled={guardando} onClick={()=>void asignarDeduccion()} className="rounded bg-black px-4 text-white">Asignar</button></div><div className="mt-4">{deducciones.map(d=><div key={d.id} className="flex justify-between border-t py-2 text-sm"><span>{d.concepto} · {d.valorAplicable||'Pendiente de valorización'} · {d.fundamento}</span>{d.activa&&<button onClick={()=>void finalizarDeduccion(d)} className="font-semibold text-red-700">Finalizar</button>}</div>)}</div></section>}
    </>}
  </div></div>;
}
