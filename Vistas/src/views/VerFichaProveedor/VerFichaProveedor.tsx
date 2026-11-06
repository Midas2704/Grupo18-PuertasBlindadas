import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Clock3, FileText, Landmark, Pencil, Phone, SlidersHorizontal, WalletCards } from 'lucide-react';
import { solicitarFinanzas } from '../../api/finanzas';
import { usarSesion } from '../../seguridad/Sesion';

interface FichaProveedor {
  identidad: { pais: string; tipoIdentificador: string; identificadorFiscal: string; razonSocial: string; tipoProveedor: string };
  contacto: { nombre: string | null; correo: string | null; telefono: string | null; direccion: string | null; correosAdicionales: string[]; telefonosAdicionales: string[] };
  estado: string;
  condicionPago: { dias: number; tipoComputo: 'DIAS_CORRIDOS' | 'DIAS_HABILES'; ultimaActualizacion: string | null } | null;
  resumenFinanciero: { saldoPendienteTotal: number; situacionFinanciera: string; saldosPorMoneda: Array<{ moneda: string; saldoPendiente: number }> };
  historial: Array<{ id: number; campo: string; valorAnterior: string | null; valorNuevo: string | null; motivo: string | null; fechaHora: string; usuario: string }>;
  antecedentes: {
    documentos: Array<{ id: number; numero: string; tipo: string; moneda: string; fechaEmision: string; fechaVencimiento: string | null; estadoPago: string; condicionTemporal: string | null; montoTotal: number; saldoPendiente: number }>;
    pagos: Array<{ id: number; fecha: string; monto: number; moneda: string; estado: string }>;
  };
}

async function respuestaJson(ruta: string, opciones?: RequestInit) {
  const respuesta = await solicitarFinanzas(ruta, opciones);
  const resultado = await respuesta.json();
  if (!respuesta.ok) throw new Error(resultado.error || 'No fue posible completar la operación');
  return resultado;
}

export default function VerFichaProveedor() {
  const { id } = useParams();
  const { sesion } = usarSesion();
  const puede = (permiso: string) => !!sesion?.permisos.includes(permiso);
  const puedeFiltrar = puede('CU85');
  const [ficha, setFicha] = useState<FichaProveedor | null>(null);
  const [tipoAntecedente, setTipoAntecedente] = useState('todos');
  const [direccion, setDireccion] = useState('desc');
  const [editandoCondicion, setEditandoCondicion] = useState(false);
  const [dias, setDias] = useState('0');
  const [tipoComputo, setTipoComputo] = useState<'DIAS_CORRIDOS' | 'DIAS_HABILES'>('DIAS_CORRIDOS');
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const parametros = new URLSearchParams();
    if (puedeFiltrar) { parametros.set('tipoAntecedente', tipoAntecedente); parametros.set('direccion', direccion); }
    const sufijo = parametros.size ? `?${parametros}` : '';
    respuestaJson(`/proveedores/${id}/ficha${sufijo}`).then((resultado: FichaProveedor) => {
      setFicha(resultado);
      if (!editandoCondicion) {
        setDias(String(resultado.condicionPago?.dias ?? 0));
        setTipoComputo(resultado.condicionPago?.tipoComputo ?? 'DIAS_CORRIDOS');
      }
    }).catch(causa => setError(causa.message));
  }, [id, tipoAntecedente, direccion, version, puedeFiltrar, editandoCondicion]);

  const guardarCondicion = async () => {
    setGuardando(true); setError(''); setMensaje('');
    try {
      await respuestaJson(`/proveedores/${id}/condicion-pago`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dias: Number(dias), tipoComputo }) });
      setMensaje('Condición de pago actualizada.'); setEditandoCondicion(false); setVersion(valor => valor + 1);
    } catch (causa) { setError((causa as Error).message); }
    finally { setGuardando(false); }
  };

  if (error && !ficha) return <div className="p-8"><Link to="/proveedores" className="text-primary-700">Volver a proveedores</Link><p className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</p></div>;
  if (!ficha) return <p className="p-8 text-gray-500">Cargando ficha del proveedor...</p>;
  const dato = (valor: string | null | undefined) => valor || 'Sin información registrada';
  const condicionVisible = ficha.condicionPago ? `${ficha.condicionPago.dias} días ${ficha.condicionPago.tipoComputo === 'DIAS_HABILES' ? 'hábiles' : 'corridos'}` : 'Sin condición configurada';

  return <div className="min-h-full bg-slate-50 p-5 lg:p-8"><div className="mx-auto max-w-6xl">
    <Link to="/proveedores" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-700"><ArrowLeft className="h-4 w-4"/>Volver al catálogo</Link>
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-5"><div><p className="text-sm font-semibold text-primary-600">Ficha financiera del proveedor</p><h1 className="text-2xl font-bold text-gray-900">{ficha.identidad.razonSocial}</h1><p className="mt-1 text-gray-500">{ficha.identidad.tipoIdentificador}: {ficha.identidad.identificadorFiscal}</p></div><span className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${ficha.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}`}>{ficha.estado}</span></header>
    {(error || mensaje) && <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || mensaje}</div>}
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="rounded-md border bg-white p-5 lg:col-span-2"><h2 className="mb-4 flex items-center gap-2 font-bold"><Building2 className="h-5 w-5 text-primary-600"/>Identidad y contacto</h2><dl className="grid gap-x-6 gap-y-4 text-sm md:grid-cols-2"><div><dt className="text-gray-500">País</dt><dd className="font-medium">{ficha.identidad.pais}</dd></div><div><dt className="text-gray-500">Tipo de proveedor</dt><dd className="font-medium">{ficha.identidad.tipoProveedor}</dd></div><div><dt className="text-gray-500">Contacto</dt><dd className="font-medium">{dato(ficha.contacto.nombre)}</dd></div><div><dt className="text-gray-500">Correo</dt><dd className="font-medium">{dato(ficha.contacto.correo)}</dd></div><div><dt className="text-gray-500">Teléfono</dt><dd className="font-medium">{dato(ficha.contacto.telefono)}</dd></div><div><dt className="text-gray-500">Dirección</dt><dd className="font-medium">{dato(ficha.contacto.direccion)}</dd></div></dl></section>
      <section className="rounded-md border bg-white p-5"><h2 className="mb-4 flex items-center gap-2 font-bold"><Landmark className="h-5 w-5 text-primary-600"/>Resumen financiero</h2><p className="text-sm text-gray-500">Saldo pendiente total</p><p className="mt-1 text-3xl font-bold text-gray-900">$ {ficha.resumenFinanciero.saldoPendienteTotal.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</p><p className="mt-4 text-sm text-gray-500">Situación</p><p className="font-semibold">{ficha.resumenFinanciero.situacionFinanciera}</p><div className="mt-4 flex items-start justify-between gap-3"><div><p className="text-sm text-gray-500">Condición de pago</p><p className="font-semibold">{condicionVisible}</p>{ficha.condicionPago?.ultimaActualizacion && <p className="mt-1 text-xs text-gray-500">Actualizada {new Date(ficha.condicionPago.ultimaActualizacion).toLocaleString('es-CL')}</p>}</div>{puede('CU87') && <button title="Editar condición de pago" onClick={() => setEditandoCondicion(true)} className="rounded p-2 text-primary-700 hover:bg-primary-50"><Pencil className="h-4 w-4"/></button>}</div></section>
    </div>

    {editandoCondicion && puede('CU87') && <section className="mt-5 border-y bg-white px-5 py-4"><div className="flex flex-wrap items-end gap-4"><label className="text-sm font-medium">Cantidad de días<input type="number" min="0" step="1" value={dias} onChange={evento => setDias(evento.target.value)} className="mt-1 block w-40 rounded-md border px-3 py-2"/></label><label className="text-sm font-medium">Tipo de cómputo<select value={tipoComputo} onChange={evento => setTipoComputo(evento.target.value as typeof tipoComputo)} className="mt-1 block rounded-md border px-3 py-2"><option value="DIAS_CORRIDOS">Días corridos</option><option value="DIAS_HABILES">Días hábiles Chile</option></select></label><button disabled={guardando} onClick={() => void guardarCondicion()} className="rounded-md bg-primary-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{guardando ? 'Guardando...' : 'Guardar'}</button><button onClick={() => setEditandoCondicion(false)} className="rounded-md border px-4 py-2">Cancelar</button></div></section>}

    {puede('CU85') && <section className="mt-5 flex flex-wrap items-center gap-3 border-y bg-white px-5 py-4"><SlidersHorizontal className="h-5 w-5 text-primary-600"/><select aria-label="Tipo de antecedente" value={tipoAntecedente} onChange={evento => setTipoAntecedente(evento.target.value)} className="rounded-md border px-3 py-2"><option value="todos">Todos los antecedentes</option><option value="documentos">Documentos</option><option value="pagos">Pagos</option><option value="historial">Historial de cambios</option></select><select aria-label="Orden por fecha" value={direccion} onChange={evento => setDireccion(evento.target.value)} className="rounded-md border px-3 py-2"><option value="desc">Más recientes</option><option value="asc">Más antiguos</option></select></section>}

    {(tipoAntecedente === 'todos' || tipoAntecedente === 'documentos' || !puede('CU85')) && <section className="mt-5 rounded-md border bg-white"><div className="border-b px-5 py-4"><h2 className="flex items-center gap-2 font-bold"><FileText className="h-5 w-5 text-primary-600"/>Documentos financieros</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-gray-50 text-gray-600"><tr><th className="px-5 py-3">Documento</th><th className="px-5 py-3">Emisión</th><th className="px-5 py-3">Vencimiento</th><th className="px-5 py-3">Estado de pago</th><th className="px-5 py-3">Condición temporal</th><th className="px-5 py-3 text-right">Saldo</th></tr></thead><tbody>{ficha.antecedentes.documentos.map(documento => <tr key={documento.id} className="border-t"><td className="px-5 py-3"><div className="font-medium">{documento.numero}</div><div className="text-xs text-gray-500">{documento.tipo}</div></td><td className="px-5 py-3">{new Date(documento.fechaEmision).toLocaleDateString('es-CL', { timeZone: 'UTC' })}</td><td className="px-5 py-3">{documento.fechaVencimiento ? new Date(documento.fechaVencimiento).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : 'Sin vencimiento'}</td><td className="px-5 py-3">{documento.estadoPago}</td><td className="px-5 py-3">{documento.condicionTemporal || 'Cerrada'}</td><td className="px-5 py-3 text-right font-semibold">{documento.moneda} {documento.saldoPendiente.toLocaleString('es-CL')}</td></tr>)}</tbody></table>{!ficha.antecedentes.documentos.length && <p className="p-8 text-center text-gray-500">Sin documentos registrados.</p>}</div></section>}

    {(tipoAntecedente === 'todos' || tipoAntecedente === 'pagos') && puede('CU85') && <section className="mt-5 rounded-md border bg-white"><div className="border-b px-5 py-4"><h2 className="flex items-center gap-2 font-bold"><WalletCards className="h-5 w-5 text-primary-600"/>Pagos registrados</h2></div><div className="divide-y">{ficha.antecedentes.pagos.map(pago => <div key={pago.id} className="grid gap-2 px-5 py-4 text-sm md:grid-cols-3"><span>{new Date(pago.fecha).toLocaleDateString('es-CL', { timeZone: 'UTC' })}</span><span className="font-semibold">{pago.moneda} {pago.monto.toLocaleString('es-CL')}</span><span className="capitalize text-gray-600">{pago.estado}</span></div>)}{!ficha.antecedentes.pagos.length && <p className="p-8 text-center text-gray-500">Sin pagos registrados.</p>}</div></section>}

    {(tipoAntecedente === 'todos' || tipoAntecedente === 'historial' || !puede('CU85')) && <section className="mt-5 rounded-md border bg-white"><div className="border-b px-5 py-4"><h2 className="flex items-center gap-2 font-bold"><Clock3 className="h-5 w-5 text-primary-600"/>Historial del proveedor</h2></div><div className="divide-y">{ficha.historial.map(item => <div key={item.id} className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[160px_1fr_180px]"><div><p className="font-semibold capitalize">{item.campo.replaceAll('_', ' ')}</p><p className="text-gray-500">{new Date(item.fechaHora).toLocaleString('es-CL')}</p></div><div><p><span className="text-gray-500">Antes:</span> {dato(item.valorAnterior)}</p><p><span className="text-gray-500">Después:</span> {dato(item.valorNuevo)}</p>{item.motivo && <p className="mt-1 text-gray-600">Motivo: {item.motivo}</p>}</div><div className="text-gray-500">Registrado por {item.usuario}</div></div>)}{!ficha.historial.length && <p className="p-8 text-center text-gray-500">Sin cambios históricos registrados.</p>}</div></section>}
    <section className="mt-5 rounded-md border bg-white p-5"><h2 className="mb-3 flex items-center gap-2 font-bold"><Phone className="h-5 w-5 text-primary-600"/>Otros datos de contacto</h2><p className="text-sm text-gray-600">Correos: {ficha.contacto.correosAdicionales.join(', ') || 'Sin correos adicionales'}</p><p className="mt-2 text-sm text-gray-600">Teléfonos: {ficha.contacto.telefonosAdicionales.join(', ') || 'Sin teléfonos adicionales'}</p></section>
  </div></div>;
}
