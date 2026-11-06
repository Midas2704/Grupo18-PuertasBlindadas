/** Toda solicitud funcional pasa por C_Finanzas. El secreto de sesión está en una cookie HttpOnly. */
export async function solicitarFinanzas(ruta: string, opciones?: RequestInit) {
 const headers=new Headers(opciones?.headers);if(!headers.has('x-request-id'))headers.set('x-request-id',crypto.randomUUID());if(!headers.has('x-request-occurred-at'))headers.set('x-request-occurred-at',new Date().toISOString());
 const respuesta = await fetch(`/api/finanzas${ruta}`, {...opciones, headers, credentials:'same-origin'});
 if(respuesta.status===401 && !ruta.startsWith('/seguridad/')) window.dispatchEvent(new Event('sesion-finalizada'));
 return respuesta;
}
