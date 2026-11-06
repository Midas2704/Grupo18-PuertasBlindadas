import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { solicitarFinanzas } from '../api/finanzas';
export interface Sesion {id:string;nombre:string;acceso:string;permisos:string[];configuracion:string;administrador:boolean;cambiarClave:boolean}
const Contexto = createContext<{sesion:Sesion|null;cargando:boolean;actualizar:()=>Promise<void>}>({sesion:null,cargando:true,actualizar:async()=>{}});
export function ProveedorSesion({children}:{children:ReactNode}) {
 const [sesion,establecer]=useState<Sesion|null>(null);const [cargando,cargar]=useState(true);
 const actualizar=async()=>{try{const respuesta=await solicitarFinanzas('/seguridad/sesion');establecer(respuesta.ok?await respuesta.json():null);}finally{cargar(false);}};
 useEffect(()=>{void actualizar();const salir=()=>establecer(null);window.addEventListener('sesion-finalizada',salir);return()=>window.removeEventListener('sesion-finalizada',salir);},[]);
 return <Contexto.Provider value={{sesion,cargando,actualizar}}>{children}</Contexto.Provider>;
}
export const usarSesion=()=>useContext(Contexto);
export function Protegido({children,permiso}:{children:ReactNode;permiso?:string|string[]}) {
 const {sesion,cargando}=usarSesion();
 if(cargando)return <p className="p-8">Cargando sesión…</p>;
 if(!sesion)return <Navigate to="/login" replace/>;
 if(sesion.cambiarClave && window.location.pathname!=='/cuenta/clave')return <Navigate to="/cuenta/clave" replace/>;
 const autorizado=!permiso || (Array.isArray(permiso) ? permiso.some((codigo)=>sesion.permisos.includes(codigo)) : sesion.permisos.includes(permiso));
 if(!autorizado)return <div className="p-8"><h1 className="text-2xl font-bold">Acceso no disponible</h1><p className="mt-3 text-gray-500">Tu cuenta no tiene permiso para esta operación.</p></div>;
 return <>{children}</>;
}
export async function operar(ruta:string,cuerpo?:unknown) {
 const respuesta=await solicitarFinanzas(ruta,cuerpo===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cuerpo)});
 const resultado=await respuesta.json();if(!respuesta.ok){const error=Object.assign(new Error(resultado.error || 'No fue posible completar la operación'),{codigo:resultado.codigo});throw error;}return resultado;
}
