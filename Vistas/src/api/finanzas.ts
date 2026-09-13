/** Toda solicitud funcional pasa por C_Finanzas. El secreto de sesión está en una cookie HttpOnly. */
export async function solicitarFinanzas(ruta: string, opciones?: RequestInit) {
 const respuesta = await fetch(`/api/finanzas${ruta}`, {...opciones, credentials:'same-origin'});
 if(respuesta.status===401 && !ruta.startsWith('/seguridad/')) window.dispatchEvent(new Event('sesion-finalizada'));
 return respuesta;
}
