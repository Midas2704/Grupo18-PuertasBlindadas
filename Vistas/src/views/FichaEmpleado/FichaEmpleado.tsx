import { solicitarTexto } from '../../components/DialogosSistema';
import { useEffect, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, CalendarDays, ChevronDown, CircleDollarSign, FileCheck2, FileText, History, Layers3, Plus, Save, Sparkles } from 'lucide-react';
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
type Catalogo = { id: number; nombre: string; tipo?: string | null };
type Asignacion = { id: number; esquema?: string; concepto?: string; vigenciaDesde: string; vigenciaHasta: string | null; activa: boolean };
type Deduccion = Asignacion & { idConcepto:number; valorAplicable:string|null; fundamento:string; autorizacionReferencia:string };
type PerfilRemuneracional = {
  idCargo: number | null;
  sueldoBaseActual: number | null;
  fechaAplicacionSueldoBase: string | null;
  idAfp: number | null;
  idInstitucionSalud: number | null;
  tipoInstitucionSalud: string | null;
  seguroCesantia: boolean;
  fundamentoExclusionCesantia: string | null;
  cotizacionSalud: { valor: number; unidad: string; vigenciaDesde: string; vigenciaHasta: string | null } | null;
  correoParticular: string | null;
  telefonoParticular: string | null;
  direccionParticular: string | null;
  tipoCorreo: string | null;
  consentimientoElectronico: boolean | null;
  canalDocumental: string | null;
};

type EventoPagoHistorial = { tipo: string; accion: string; fecha: string; monto: number; usuario: string | null; motivo: string | null };
type PagoHistorial = { id: number; estado: string; montoOriginal: number; montoRevertido: number; montoEfectivo: number; medioPago: string; eventos: EventoPagoHistorial[]; auditoria?: { puedeVer?: boolean; eventos?: unknown[] } };
type PeriodoHistorial = {
  clave: string; anio: number; mes: number;
  resumen: { liquido: number; pagadoEfectivo: number; pendiente: number; ajustes: number };
  remuneraciones: Array<{ id: number; version: number; vigente: boolean; estado: string; cerradoEn: string | null; totales: { haberes: number | null; deduccionesTrabajador: number | null; aportesEmpleador: number | null; liquido: number | null; costoEmpresa: number | null }; componentes: Array<{ id: number; descripcion: string; tipo: string; monto: number | null; concepto: { nombre: string } | null }>; snapshotPrevisional: Record<string, unknown> | null }>;
  pagos: PagoHistorial[];
  ajustes: Array<{ id: number; direccion: string; monto: number; motivo: string; tratamiento: string; regularizacion: { estado: string } | null }>;
  anticipos: Array<{ id: number; modalidad: string; montoFinal: number | null; estadoValorizacion: string }>;
  documentos: Array<{ id: number; accion: string; resultado: string; fecha: string; usuario: string }>;
};
type HistorialRemuneracional = { periodos: PeriodoHistorial[] };

const formatoClp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const nombresMes = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

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
  const puedeCU191 = Boolean(sesion?.permisos.includes('CU191'));
  const puedeAuditoriaM9 = Boolean(sesion?.permisos.includes('CU355'));
  const puedeCU214 = Boolean(sesion?.permisos.includes('CU214'));
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [relaciones, setRelaciones] = useState<RelacionLaboral[]>([]);
  const [tiposVinculo, setTiposVinculo] = useState<TipoVinculo[]>([]);
  const [cargos, setCargos] = useState<Catalogo[]>([]);
  const [afps, setAfps] = useState<Catalogo[]>([]);
  const [institucionesSalud, setInstitucionesSalud] = useState<Catalogo[]>([]);
  const [datosBase, setDatosBase] = useState({ nombres: '', apellidoPaterno: '', apellidoMaterno: '', fechaNacimiento: '', estado: 'activo' });
  const [nuevaRelacion, setNuevaRelacion] = useState({ fechaInicio: '', idTipoVinculo: '', jornada: '' });
  const [perfil, setPerfil] = useState({ idCargo: '', sueldoBaseActual: '', fechaAplicacionSueldoBase: '', idAfp: '', sistemaSalud: '', idInstitucionSalud: '', seguroCesantia: true, fundamentoExclusionCesantia: '', cotizacionSaludValor: '', cotizacionSaludUnidad: 'PORCENTAJE', cotizacionSaludVigenciaDesde: '', correoParticular: '', telefonoParticular: '', direccionParticular: '', tipoCorreo: '', consentimientoElectronico: false, canalDocumental: '' });
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
  const [historial, setHistorial] = useState<HistorialRemuneracional | null>(null);
  const [filtroHistorial, setFiltroHistorial] = useState({ anio: '', tipoEvento: 'TODOS' });
  const [periodosAbiertos, setPeriodosAbiertos] = useState<Record<string, boolean>>({});

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
        sistemaSalud: actual.tipoInstitucionSalud || '',
        idInstitucionSalud: actual.idInstitucionSalud === null ? '' : String(actual.idInstitucionSalud),
        seguroCesantia: actual.seguroCesantia,
        fundamentoExclusionCesantia: actual.fundamentoExclusionCesantia || '',
        cotizacionSaludValor: actual.cotizacionSalud === null ? '' : String(actual.cotizacionSalud.unidad === 'PORCENTAJE' ? actual.cotizacionSalud.valor * 100 : actual.cotizacionSalud.valor),
        cotizacionSaludUnidad: actual.cotizacionSalud?.unidad || 'PORCENTAJE',
        cotizacionSaludVigenciaDesde: actual.cotizacionSalud?.vigenciaDesde.slice(0, 10) || '',
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

  useEffect(() => {
    if (!puedeCU191) return;
    const cancelacion = new AbortController();
    const consulta = new URLSearchParams();
    if (filtroHistorial.anio) consulta.set('anio', filtroHistorial.anio);
    consulta.set('tipoEvento', filtroHistorial.tipoEvento);
    respuestaJson(`/empleados/${id}/historial-remuneracional?${consulta.toString()}`, { signal: cancelacion.signal })
      .then((resultado: HistorialRemuneracional) => setHistorial(resultado))
      .catch((causa) => { if (!cancelacion.signal.aborted) setError(causa.message); });
    return () => cancelacion.abort();
  }, [id, puedeCU191, filtroHistorial, version]);

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
      const cuerpo: Record<string, unknown> = { ...perfil };
      delete cuerpo.sistemaSalud;
      if (perfil.sistemaSalud === 'ISAPRE') {
        cuerpo.cotizacionSaludValor = perfil.cotizacionSaludUnidad === 'PORCENTAJE' && perfil.cotizacionSaludValor !== ''
          ? Number(perfil.cotizacionSaludValor) / 100
          : perfil.cotizacionSaludValor;
      } else {
        delete cuerpo.cotizacionSaludValor;
        delete cuerpo.cotizacionSaludUnidad;
        delete cuerpo.cotizacionSaludVigenciaDesde;
      }
      await respuestaJson(`/empleados/${id}/perfil-remuneracional`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
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

      {puedeCU191 && <section className="mb-6 border-y border-gray-200 bg-white px-4 py-5 sm:px-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-2"><History className="h-5 w-5 text-primary-600" /><div><h2 className="font-bold text-gray-900">Historial remuneracional</h2><p className="text-sm text-gray-500">Liquidaciones, pagos, reversas y ajustes conservados por período.</p></div></div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-gray-600">Año<input inputMode="numeric" value={filtroHistorial.anio} onChange={evento => setFiltroHistorial({ ...filtroHistorial, anio: evento.target.value })} placeholder="Todos" className="mt-1 w-full rounded-md border px-3 py-2 text-sm font-normal" /></label>
            <label className="text-xs font-semibold text-gray-600">Evento<select value={filtroHistorial.tipoEvento} onChange={evento => setFiltroHistorial({ ...filtroHistorial, tipoEvento: evento.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm font-normal"><option value="TODOS">Todos</option><option value="REMUNERACION">Liquidaciones</option><option value="PAGO">Pagos</option><option value="REVERSION">Reversas</option><option value="AJUSTE">Ajustes</option><option value="DOCUMENTO">Documentos</option></select></label>
          </div>
        </div>
        {!historial && <p className="py-8 text-center text-sm text-gray-500">Cargando historial...</p>}
        {historial && !historial.periodos.length && <p className="py-8 text-center text-sm text-gray-500">No hay movimientos para los filtros seleccionados.</p>}
        <div className="space-y-3">{historial?.periodos.map(periodo => {
          const abierto = periodosAbiertos[periodo.clave] === true;
          return <article key={periodo.clave} className="rounded-md border border-gray-200">
            <button type="button" onClick={() => setPeriodosAbiertos(actual => ({ ...actual, [periodo.clave]: !abierto }))} className="flex w-full flex-col gap-3 px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-bold capitalize text-gray-900">{nombresMes[periodo.mes - 1]} {periodo.anio}</p><p className="text-xs text-gray-500">{periodo.remuneraciones.length} liquidación(es) · {periodo.pagos.length} pago(s)</p></div>
              <div className="grid w-full grid-cols-2 gap-3 text-sm sm:w-auto sm:grid-cols-4"><div><span className="block text-xs text-gray-500">Líquido</span><strong>{formatoClp.format(periodo.resumen.liquido)}</strong></div><div><span className="block text-xs text-gray-500">Pagado efectivo</span><strong>{formatoClp.format(periodo.resumen.pagadoEfectivo)}</strong></div><div><span className="block text-xs text-gray-500">Pendiente</span><strong>{formatoClp.format(periodo.resumen.pendiente)}</strong></div><ChevronDown className={`ml-auto h-5 w-5 self-center text-gray-500 transition-transform ${abierto ? 'rotate-180' : ''}`} /></div>
            </button>
            {abierto && <div className="border-t border-gray-200 px-4 py-4">
              <div className="space-y-4">{periodo.remuneraciones.map(remuneracion => <div key={remuneracion.id} className="border-b border-gray-100 pb-4 last:border-0">
                <div className="mb-3 flex flex-wrap items-center gap-2"><strong>Liquidación v{remuneracion.version}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${remuneracion.vigente ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{remuneracion.vigente ? remuneracion.estado : 'reemplazada'}</span>{remuneracion.cerradoEn && <span className="text-xs text-gray-500">Cerrada el {new Date(remuneracion.cerradoEn).toLocaleDateString('es-CL')}</span>}</div>
                <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5"><div><dt className="text-gray-500">Haberes</dt><dd className="font-semibold">{formatoClp.format(remuneracion.totales.haberes || 0)}</dd></div><div><dt className="text-gray-500">Deducciones</dt><dd className="font-semibold">{formatoClp.format(remuneracion.totales.deduccionesTrabajador || 0)}</dd></div><div><dt className="text-gray-500">Líquido</dt><dd className="font-semibold">{formatoClp.format(remuneracion.totales.liquido || 0)}</dd></div><div><dt className="text-gray-500">Aportes empleador</dt><dd className="font-semibold">{formatoClp.format(remuneracion.totales.aportesEmpleador || 0)}</dd></div><div><dt className="text-gray-500">Costo empresa</dt><dd className="font-semibold">{formatoClp.format(remuneracion.totales.costoEmpresa || 0)}</dd></div></dl>
                {!!remuneracion.componentes.length && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-primary-700">Ver desglose y snapshot legal</summary><div className="mt-2 grid gap-2 md:grid-cols-2">{remuneracion.componentes.map(componente => <div key={componente.id} className="flex justify-between gap-3 border-b py-1"><span>{componente.concepto?.nombre || componente.descripcion}</span><span className="font-medium">{formatoClp.format(componente.monto || 0)}</span></div>)}</div>{remuneracion.snapshotPrevisional && <p className="mt-3 rounded bg-gray-50 p-2 text-xs text-gray-600">La liquidación conserva la configuración previsional aplicada al momento del cálculo.</p>}</details>}
              </div>)}</div>
              {!!periodo.pagos.length && <div className="mt-4"><h3 className="mb-2 text-sm font-bold">Pagos y reversas</h3><div className="space-y-3">{periodo.pagos.map(pago => <div key={pago.id} className="rounded-md bg-gray-50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">Pago #{pago.id} · {pago.estado}</span><span>{formatoClp.format(pago.montoEfectivo)} efectivo de {formatoClp.format(pago.montoOriginal)}</span></div><div className="mt-2 space-y-1">{pago.eventos.map((evento, indice) => <div key={`${evento.fecha}-${indice}`} className="flex flex-col justify-between gap-1 text-xs text-gray-600 sm:flex-row"><span>{evento.accion} · {new Date(evento.fecha).toLocaleString('es-CL')}{evento.usuario ? ` · ${evento.usuario}` : ''}</span><span>{formatoClp.format(evento.monto)}</span></div>)}</div>{puedeAuditoriaM9 && pago.auditoria?.puedeVer && <button onClick={() => navegar(`/auditoria?modulo=M6&operacion=PAGO_PREPARADO_MODIFICADO&entidadReferencia=${pago.id}`)} className="mt-2 text-xs font-semibold text-primary-700">Ver trazabilidad técnica en Auditoría M9 ({pago.auditoria.eventos?.length || 0})</button>}</div>)}</div></div>}
              {!!periodo.ajustes.length && <div className="mt-4"><h3 className="mb-2 text-sm font-bold">Ajustes y regularizaciones</h3>{periodo.ajustes.map(ajuste => <p key={ajuste.id} className="border-b py-2 text-sm"><strong>{ajuste.direccion === 'NEGATIVO' ? '-' : '+'}{formatoClp.format(ajuste.monto)}</strong> · {ajuste.motivo} · {ajuste.tratamiento}{ajuste.regularizacion ? ` · Regularización ${ajuste.regularizacion.estado}` : ''}</p>)}</div>}
              {!!periodo.anticipos.length && <div className="mt-4"><h3 className="mb-2 text-sm font-bold">Anticipos</h3>{periodo.anticipos.map(anticipo => <p key={anticipo.id} className="border-b py-2 text-sm">{anticipo.modalidad} · {formatoClp.format(anticipo.montoFinal || 0)} · {anticipo.estadoValorizacion}</p>)}</div>}
              {!!periodo.documentos.length && <div className="mt-4"><h3 className="mb-2 text-sm font-bold">Documentos</h3>{periodo.documentos.map(documento => <p key={documento.id} className="border-b py-2 text-sm capitalize">{documento.accion} · {documento.resultado} · {new Date(documento.fecha).toLocaleString('es-CL')}</p>)}</div>}
            </div>}
          </article>;
        })}</div>
      </section>}

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
          <label className="text-sm font-medium">Sistema de salud<select value={perfil.sistemaSalud} onChange={(evento) => { const sistemaSalud = evento.target.value; const institucion = sistemaSalud && sistemaSalud !== 'ISAPRE' ? institucionesSalud.find((item) => item.tipo === sistemaSalud) : null; setPerfil({ ...perfil, sistemaSalud, idInstitucionSalud: institucion ? String(institucion.id) : '', cotizacionSaludValor: sistemaSalud === 'ISAPRE' ? perfil.cotizacionSaludValor : '', cotizacionSaludVigenciaDesde: sistemaSalud === 'ISAPRE' ? perfil.cotizacionSaludVigenciaDesde : '' }); }} className="mt-1 w-full rounded-md border p-2.5"><option value="">Sin configurar</option><option value="FONASA">Fonasa</option><option value="ISAPRE">Isapre</option><option value="DIPRECA">DIPRECA</option><option value="OTRO">Otro</option></select></label>
          {perfil.sistemaSalud === 'ISAPRE' && <label className="text-sm font-medium">Institución<select value={perfil.idInstitucionSalud} onChange={(evento) => setPerfil({ ...perfil, idInstitucionSalud: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"><option value="">Seleccionar Isapre</option>{institucionesSalud.filter((item) => item.tipo === 'ISAPRE').map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>}
          <label className="flex items-center gap-3 self-end rounded-md border px-3 py-2.5 text-sm font-medium"><input type="checkbox" checked={perfil.seguroCesantia} onChange={(evento) => setPerfil({ ...perfil, seguroCesantia: evento.target.checked })} className="h-4 w-4 accent-primary-600" />Seguro de cesantía vigente</label>
          {!perfil.seguroCesantia && <label className="text-sm font-medium md:col-span-2 lg:col-span-3">Fundamento de exclusión del Seguro de Cesantía<input required value={perfil.fundamentoExclusionCesantia} onChange={(evento) => setPerfil({ ...perfil, fundamentoExclusionCesantia: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5" /></label>}
          {perfil.sistemaSalud === 'ISAPRE' && <><label className="text-sm font-medium">Cotización pactada de salud<div className="relative mt-1"><input type="number" min="0" step={perfil.cotizacionSaludUnidad === 'PORCENTAJE' ? '0.1' : '0.000001'} value={perfil.cotizacionSaludValor} onChange={(evento) => setPerfil({ ...perfil, cotizacionSaludValor: evento.target.value })} className="w-full rounded-md border p-2.5 pr-9" />{perfil.cotizacionSaludUnidad === 'PORCENTAJE' && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">%</span>}</div></label>
          <label className="text-sm font-medium">Unidad del plan<select value={perfil.cotizacionSaludUnidad} onChange={(evento) => setPerfil({ ...perfil, cotizacionSaludUnidad: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5"><option value="PORCENTAJE">Porcentaje</option><option value="UF">UF</option><option value="CLP">CLP</option></select></label>
          <label className="text-sm font-medium">Vigencia del plan<input type="date" value={perfil.cotizacionSaludVigenciaDesde} onChange={(evento) => setPerfil({ ...perfil, cotizacionSaludVigenciaDesde: evento.target.value })} className="mt-1 w-full rounded-md border p-2.5" /></label></>}
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
