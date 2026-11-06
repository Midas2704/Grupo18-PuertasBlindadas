import { ErrorAplicacion } from '../utilidades/ErrorAplicacion';
export function identificador(valor: unknown): number {
  // si llega hasta acá, todavía falta revisar que sea un id usable
  if (!/^\d+$/.test(String(valor))) throw new ErrorAplicacion(400, 'Identificador inválido');
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero <= 0) throw new ErrorAplicacion(400, 'Identificador inválido');
  return numero;
}
export function texto(valor: unknown, maximo = 150): string {
  if (valor === undefined || valor === null) return '';
  if (typeof valor !== 'string' || valor.length > maximo) throw new ErrorAplicacion(400, 'Texto inválido o demasiado largo');
  return valor.trim();
}
export function numeroNoNegativo(valor: unknown, nombre: string): number {
  if (valor === null || valor === undefined || valor === '' || !['string', 'number'].includes(typeof valor)) throw new ErrorAplicacion(400, `${nombre} es obligatorio`);
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) throw new ErrorAplicacion(400, `${nombre} debe ser un número válido no negativo`);
  return numero;
}
export type FiltrosClientes = { busqueda: string; estado: 'activos' | 'inactivos' | 'todos'; deuda: boolean; morosos: boolean; ordenar: 'nombre'|'rut'|'saldo'; direccion: 'asc'|'desc' };
export function validarFiltros(consulta: Record<string, unknown>): FiltrosClientes {
  const estado = texto(consulta.estado || 'activos');
  if (!['activos', 'inactivos', 'todos'].includes(estado)) throw new ErrorAplicacion(400, 'Estado permitido: activos, inactivos o todos');
  for (const clave of ['deuda', 'morosos']) {
    if (consulta[clave] !== undefined && !['true', 'false'].includes(String(consulta[clave]))) throw new ErrorAplicacion(400, `Filtro ${clave} inválido`);
  }
  const ordenar = texto(consulta.ordenar || 'nombre'); const direccion = texto(consulta.direccion || 'asc');
  if (!['nombre','rut','saldo'].includes(ordenar) || !['asc','desc'].includes(direccion)) throw new ErrorAplicacion(400, 'Ordenamiento inválido');
  return { busqueda: texto(consulta.busqueda ?? consulta.search), estado: estado as FiltrosClientes['estado'], deuda: consulta.deuda === 'true', morosos: consulta.morosos === 'true', ordenar: ordenar as FiltrosClientes['ordenar'], direccion: direccion as FiltrosClientes['direccion'] };
}
