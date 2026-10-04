import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type TipoDialogo = 'texto' | 'confirmacion' | 'aviso';
type SolicitudDialogo = { tipo: TipoDialogo; mensaje: string; valorInicial?: string; resolver: (valor: string | boolean | null) => void };
let abrirDialogo: ((solicitud: SolicitudDialogo) => void) | null = null;
const pendientes: SolicitudDialogo[] = [];

const solicitar = (tipo: TipoDialogo, mensaje: string, valorInicial?: string) => new Promise<string | boolean | null>(resolver => {
  const solicitud = { tipo, mensaje, valorInicial, resolver };
  if (abrirDialogo) abrirDialogo(solicitud); else pendientes.push(solicitud);
});

export const solicitarTexto = (mensaje: string, valorInicial = '') => solicitar('texto', mensaje, valorInicial) as Promise<string | null>;
export const confirmarAccion = (mensaje: string) => solicitar('confirmacion', mensaje) as Promise<boolean>;
export const notificarUsuario = (mensaje: string) => solicitar('aviso', mensaje).then(() => undefined);

export function DialogosSistema() {
  const [solicitud, setSolicitud] = useState<SolicitudDialogo | null>(null);
  const [valor, setValor] = useState('');
  useEffect(() => {
    abrirDialogo = nueva => { setSolicitud(nueva); setValor(nueva.valorInicial || ''); };
    if (pendientes.length) abrirDialogo(pendientes.shift()!);
    return () => { abrirDialogo = null; };
  }, []);
  const cerrar = (respuesta: string | boolean | null) => {
    solicitud?.resolver(respuesta); setSolicitud(null); setValor('');
    const siguiente = pendientes.shift(); if (siguiente) queueMicrotask(() => abrirDialogo?.(siguiente));
  };
  if (!solicitud) return null;
  const confirmar = () => cerrar(solicitud.tipo === 'texto' ? valor : true);
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="dialogo-sistema-titulo" className="w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex gap-3"><span className="rounded-lg bg-orange-50 p-2 text-primary-700">{solicitud.tipo === 'aviso' ? <CheckCircle2 className="h-5 w-5"/> : <AlertTriangle className="h-5 w-5"/>}</span><div><h2 id="dialogo-sistema-titulo" className="font-bold text-gray-950">{solicitud.tipo === 'texto' ? 'Completar información' : solicitud.tipo === 'confirmacion' ? 'Confirmar acción' : 'Información'}</h2><p className="mt-1 text-sm leading-5 text-gray-600">{solicitud.mensaje}</p></div></div>
        <button type="button" className="rounded p-1 text-gray-500 hover:bg-gray-100" onClick={() => cerrar(solicitud.tipo === 'confirmacion' ? false : null)} aria-label="Cerrar"><X className="h-5 w-5"/></button>
      </header>
      {solicitud.tipo === 'texto' && <div className="px-5 py-4"><input autoFocus value={valor} onChange={evento => setValor(evento.target.value)} onKeyDown={evento => { if (evento.key === 'Enter') confirmar(); }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-orange-100"/></div>}
      <footer className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">{solicitud.tipo !== 'aviso' && <button type="button" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50" onClick={() => cerrar(solicitud.tipo === 'confirmacion' ? false : null)}>Cancelar</button>}<button type="button" className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700" onClick={confirmar}>{solicitud.tipo === 'aviso' ? 'Entendido' : 'Continuar'}</button></footer>
    </section>
  </div>;
}
