import { ErrorAplicacion } from './ErrorAplicacion';

/** Representación canónica usada por Finanzas: 12.345.678-5. */
export function normalizarRut(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor.trim()) return null;
  const limpio = valor.trim().replace(/[.\s-]/g, '').toUpperCase();
  if (!/^\d{1,8}[0-9K]$/.test(limpio)) return null;
  const cuerpo = limpio.slice(0, -1).replace(/^0+(?=\d)/, '');
  const verificador = limpio.slice(-1);
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${verificador}`;
}

export function esRutValido(valor: unknown): boolean {
  const normalizado = normalizarRut(valor);
  if (!normalizado) return false;
  const [cuerpoConPuntos, verificador] = normalizado.split('-');
  const cuerpo = cuerpoConPuntos.replace(/\./g, '');
  let suma = 0;
  let multiplicador = 2;
  for (let indice = cuerpo.length - 1; indice >= 0; indice--) {
    suma += Number(cuerpo[indice]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resultado = 11 - (suma % 11);
  const esperado = resultado === 11 ? '0' : resultado === 10 ? 'K' : String(resultado);
  return verificador === esperado;
}

export function validarYNormalizarRut(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor.trim()) return null;
  const normalizado = normalizarRut(valor);
  if (!normalizado || !esRutValido(normalizado)) {
    throw new ErrorAplicacion(400, 'El RUT ingresado no es válido', 'RUT_INVALIDO');
  }
  return normalizado;
}

export function variantesRut(normalizado: string): string[] {
  return [normalizado, normalizado.replace(/\./g, '')];
}
