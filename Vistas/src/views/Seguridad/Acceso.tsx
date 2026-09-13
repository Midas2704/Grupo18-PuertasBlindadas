import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { operar, usarSesion } from '../../seguridad/Sesion';
export const entradaClase='w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500';
export const botonClase='px-5 py-2.5 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50';
export const tarjetaClase='bg-white border border-gray-200 rounded-xl p-6 shadow-sm';
export function Acceso({modo}:{modo:'login'|'recuperar'|'clave'}) {
  // M4 es cuidadoso por una razón; la pantalla también
 const {actualizar}=usarSesion();const navegar=useNavigate();const [mensaje,cambiarMensaje]=useState('');const [ocupado,cambiarOcupado]=useState(false);
 const [reemplazo,cambiarReemplazo]=useState<Record<string,FormDataEntryValue>|null>(null);
 const [token]=useState(()=>decodeURIComponent(window.location.hash.slice(1)));
 const [enlaceValido,validarEnlace]=useState(!token);
 useEffect(()=>{if(modo==='recuperar'&&token)void operar('/seguridad/recuperacion/validar',{token}).then(()=>validarEnlace(true)).catch(e=>cambiarMensaje(e.message));},[modo,token]);
 const titulo=modo==='login'?'Iniciar sesión':modo==='clave'?'Cambiar contraseña':token?'Establecer nueva contraseña':'Recuperar contraseña';
 return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8"><div className={`${tarjetaClase} w-full max-w-md`}>
 <div className="flex gap-3 items-center mb-7 text-gray-900"><span className="p-3 bg-primary-600 text-white rounded-xl"><ShieldCheck/></span><strong>Finanzas PBlindadas</strong></div>
 <h1 className="text-2xl font-bold mb-2">{titulo}</h1><p className="text-gray-500 text-sm mb-6">{modo==='clave'?'El cambio cerrará tu sesión y requerirá un nuevo ingreso.':'Usuarios, Seguridad y Permisos'}</p>
 <form className="space-y-4" onSubmit={async evento=>{evento.preventDefault();cambiarOcupado(true);cambiarMensaje('');const datos=Object.fromEntries(new FormData(evento.currentTarget));try{
 if(modo==='login'){await operar('/seguridad/login',datos);await actualizar();navegar('/');}
 else if(modo==='clave'){const resultado=await operar('/seguridad/clave',datos);cambiarMensaje(resultado.mensaje);await actualizar();navegar('/login');}
 else {const resultado=await operar(token?'/seguridad/recuperacion/confirmar':'/seguridad/recuperacion',token?{...datos,token}:datos);cambiarMensaje(resultado.mensaje);if(token)window.history.replaceState(null,'','/recuperar');}
 }catch(error){const fallo=error as Error&{codigo?:string};if(modo==='login'&&fallo.codigo==='SESION_ACTIVA_REQUIERE_CONFIRMACION')cambiarReemplazo(datos);cambiarMensaje(fallo.message);}finally{cambiarOcupado(false);}}}>
 {(modo==='login'||(modo==='recuperar'&&!token))&&<label className="block text-sm font-medium">Identificador de acceso<input className={`${entradaClase} mt-1`} name="acceso" autoComplete="username" required placeholder="RUT de tu empleado"/></label>}
 {(modo==='login'||modo==='clave')&&<label className="block text-sm font-medium">{modo==='clave'?'Contraseña actual':'Contraseña'}<input className={`${entradaClase} mt-1`} name={modo==='login'?'clave':'claveActual'} type="password" autoComplete="current-password" required maxLength={256}/></label>}
 {(modo==='clave'||(modo==='recuperar'&&token))&&<label className="block text-sm font-medium">Nueva contraseña<input className={`${entradaClase} mt-1`} name="claveNueva" type="password" autoComplete="new-password" required maxLength={256}/></label>}
 {mensaje&&<p role="status" className="p-3 bg-orange-50 text-orange-900 rounded-lg text-sm">{mensaje}</p>}
 {modo==='login'&&reemplazo&&<div className="p-3 border border-orange-200 rounded-lg text-sm"><p className="mb-3">La sesión anterior seguirá abierta hasta que confirmes el reemplazo.</p><div className="flex gap-2"><button type="button" className={botonClase} onClick={async()=>{cambiarOcupado(true);try{await operar('/seguridad/login',{...reemplazo,reemplazarSesion:true});await actualizar();navegar('/');}catch(error){cambiarMensaje((error as Error).message);}finally{cambiarOcupado(false);}}}>Cerrar anterior e ingresar</button><button type="button" className="px-4 py-2 border rounded-lg" onClick={()=>{cambiarReemplazo(null);cambiarMensaje('Se mantuvo la sesión anterior.');}}>Mantener anterior</button></div></div>}
 <button disabled={ocupado || !!reemplazo || (modo==='recuperar' && !!token && !enlaceValido)} className={`${botonClase} w-full`}>{ocupado?'Procesando…':titulo}</button></form>
 <div className="mt-5 text-sm text-primary-600">{modo==='login'?<Link to="/recuperar">Olvidé mi contraseña</Link>:<Link to="/login">Volver al inicio de sesión</Link>}</div>
 </div></div>;
}
