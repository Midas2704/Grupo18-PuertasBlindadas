import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { ErrorAplicacion } from './ErrorAplicacion';
// Parámetros técnicos provisionales; no son reglas funcionales cerradas ni un mantenedor M4.
// acá mejor ser aburridos: la seguridad no necesita adornos
const parametro = (nombre: string, defecto: number) => {
 const valor = Number(process.env[nombre] ?? defecto);
 if (!Number.isInteger(valor) || valor <= 0) throw new Error(`Parámetro de seguridad inválido: ${nombre}`);
 return valor;
};
export const politica = {
 longitud: parametro('M4_LONGITUD_MINIMA', 12), historial: parametro('M4_HISTORIAL', 5),
 vigenciaDias: parametro('M4_VIGENCIA_DIAS', 90), temporalMinutos: parametro('M4_TEMPORAL_MINUTOS', 60),
 sesionMinutos: parametro('M4_SESION_MINUTOS', 60), inactividadMinutos: parametro('M4_INACTIVIDAD_MINUTOS', 10), recuperacionMinutos: parametro('M4_RECUPERACION_MINUTOS', 20),
 intentos: parametro('M4_INTENTOS', 3), bloqueoMinutos: parametro('M4_BLOQUEO_MINUTOS', 10), bloqueos: parametro('M4_BLOQUEOS', 3),
};
export const secreto = () => randomBytes(32).toString('base64url');
export const huella = (valor: string) => createHash('sha256').update(valor).digest('hex');
export const futuro = (minutos: number) => new Date(Date.now() + minutos * 60000);
const derivar = (clave: string, sal: string): Promise<Buffer> => new Promise((resolver, rechazar) => {
 scrypt(clave, sal, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, resultado) => error ? rechazar(error) : resolver(resultado));
});
export async function hashClave(clave: string) {
 const sal = randomBytes(16).toString('hex');
 return `scrypt$131072$8$1$${sal}$${(await derivar(clave, sal)).toString('hex')}`;
}
export async function comprobarClave(clave: unknown, hash: string) {
 if (typeof clave !== 'string' || clave.length > 256) return false;
 const partes = hash.split('$');
 if (partes.length !== 6 || partes.slice(0,4).join('$') !== 'scrypt$131072$8$1') return false;
 const esperado = Buffer.from(partes[5]!, 'hex'); const obtenido = await derivar(clave, partes[4]!);
 return esperado.length === obtenido.length && timingSafeEqual(esperado, obtenido);
}
export function validarClave(clave: unknown): asserts clave is string {
 if (typeof clave !== 'string' || clave.length < politica.longitud || clave.length > 256 || !clave.trim()) throw new ErrorAplicacion(400, `La contraseña debe tener entre ${politica.longitud} y 256 caracteres`);
}
