import { createHash } from 'node:crypto';
import { ErrorAplicacion } from '../utilidades/ErrorAplicacion';
import { CONFIGURACION_M9, JsonM9, ResultadoM9 } from './tipos';

const clavesProhibidas = /(password|passwd|contrasena|contraseña|passwordhash|hashpassword|token|secret|secreto|credential|credencial|authorization|cookie|apikey|api_key)/i;

export function validarSinSecretos(valor: unknown, ruta = 'entrada'): void {
  if (!valor || typeof valor !== 'object') return;
  if (Array.isArray(valor)) { valor.forEach((item, indice) => validarSinSecretos(item, `${ruta}[${indice}]`)); return; }
  for (const [clave, contenido] of Object.entries(valor as JsonM9)) {
    if (clavesProhibidas.test(clave.replace(/[-_\s]/g, ''))) throw new ErrorAplicacion(400, 'El evento contiene un campo prohibido', 'M9_DATO_PROHIBIDO');
    validarSinSecretos(contenido, `${ruta}.${clave}`);
  }
}

export function textoSeguro(valor: unknown, nombre: string, maximo = CONFIGURACION_M9.maximoTexto) {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > maximo) throw new ErrorAplicacion(400, `${nombre} inválido`, 'M9_EVENTO_INVALIDO');
  return valor.trim();
}

export function normalizarResultado(valor: string): ResultadoM9 {
  const clave = valor.trim().toUpperCase();
  const mapa: Record<string, ResultadoM9> = { EXITO: 'EXITOSO', EXITOSO: 'EXITOSO', SUCCESS: 'EXITOSO', RECHAZO: 'RECHAZADO', RECHAZADO: 'RECHAZADO', REJECTED: 'RECHAZADO', FALLO: 'FALLIDO', FALLIDO: 'FALLIDO', FAILED: 'FALLIDO', ERROR: 'FALLIDO' };
  const resultado = mapa[clave];
  if (!resultado) throw new ErrorAplicacion(400, 'Resultado no soportado', 'M9_RESULTADO_INVALIDO');
  return resultado;
}

const canonico = (valor: unknown): string => {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor);
  if (valor instanceof Date) return JSON.stringify(valor.toISOString());
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  return `{${Object.entries(valor as JsonM9).sort(([a], [b]) => a.localeCompare(b)).map(([clave, contenido]) => `${JSON.stringify(clave)}:${canonico(contenido)}`).join(',')}}`;
};
export const hashM9 = (valor: unknown) => createHash('sha256').update(canonico(valor)).digest('hex');

export function deltaMinimo(anterior?: JsonM9, nuevo?: JsonM9) {
  if (!anterior && !nuevo) return { anterior: null, nuevo: null };
  const claves = new Set([...Object.keys(anterior ?? {}), ...Object.keys(nuevo ?? {})]);
  const antes: JsonM9 = {}, despues: JsonM9 = {};
  for (const clave of claves) {
    const previo = anterior?.[clave] ?? null;
    const siguiente = nuevo?.[clave] ?? null;
    if (canonico(previo) === canonico(siguiente)) continue;
    antes[clave] = previo;
    despues[clave] = siguiente;
  }
  return Object.keys(antes).length ? { anterior: antes, nuevo: despues } : { anterior: null, nuevo: null };
}

function offsetDeclarado(valor: string) {
  if (valor.endsWith('Z')) return 0;
  const coincidencia = valor.match(/([+-])(\d{2}):(\d{2})$/);
  if (!coincidencia) throw new ErrorAplicacion(400, 'Timestamp sin zona horaria', 'M9_TIMESTAMP_INVALIDO');
  return (coincidencia[1] === '-' ? -1 : 1) * (Number(coincidencia[2]) * 60 + Number(coincidencia[3]));
}

export function fechaConZona(valor: string, zona: string) {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(valor)) throw new ErrorAplicacion(400, 'Timestamp sin zona horaria', 'M9_TIMESTAMP_INVALIDO');
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) throw new ErrorAplicacion(400, 'Timestamp inválido', 'M9_TIMESTAMP_INVALIDO');
  if (zona === 'UTC') {
    if (offsetDeclarado(valor) !== 0) throw new ErrorAplicacion(400, 'Timestamp y zona horaria no son coherentes', 'M9_TIMEZONE_INCOHERENTE');
    return fecha;
  }
  let partes: Intl.DateTimeFormatPart[];
  try { partes = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(fecha); }
  catch { throw new ErrorAplicacion(400, 'Zona horaria inválida', 'M9_TIMEZONE_INVALIDA'); }
  const obtener = (tipo: Intl.DateTimeFormatPartTypes) => Number(partes.find(parte => parte.type === tipo)?.value);
  const localComoUtc = Date.UTC(obtener('year'), obtener('month') - 1, obtener('day'), obtener('hour'), obtener('minute'), obtener('second'));
  const offsetZona = Math.round((localComoUtc - fecha.getTime()) / 60000);
  if (offsetZona !== offsetDeclarado(valor)) throw new ErrorAplicacion(400, 'Timestamp y zona horaria no son coherentes', 'M9_TIMEZONE_INCOHERENTE');
  return fecha;
}

export function enmascarar(valor: unknown, campos: string[], ruta = ''): unknown {
  if (Array.isArray(valor)) return valor.map(item => enmascarar(item, campos, ruta));
  if (!valor || typeof valor !== 'object') return valor;
  return Object.fromEntries(Object.entries(valor as JsonM9).map(([clave, contenido]) => {
    const rutaCampo = ruta ? `${ruta}.${clave}` : clave;
    return [clave, campos.includes(clave) || campos.includes(rutaCampo) ? '***' : enmascarar(contenido, campos, rutaCampo)];
  }));
}
