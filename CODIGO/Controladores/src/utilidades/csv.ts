export type ColumnaCsv<T> = { encabezado: string; valor: (fila: T) => unknown };

const textoCelda = (valor: unknown) => {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number' || typeof valor === 'bigint') return String(valor);
  const texto = String(valor);
  // MIDAS: neutralizamos fórmulas sólo en texto; los montos negativos reales siguen siendo números.
  return /^[\s\u00A0]*[=+\-@]/.test(texto) ? `'${texto}` : texto;
};

const escapar = (valor: unknown, separador: string) => {
  const texto = textoCelda(valor).replace(/\r\n|\r|\n/g, ' ').replace(/"/g, '""');
  return texto.includes(separador) || texto.includes('"') ? `"${texto}"` : texto;
};

// MIDAS: el BOM mantiene tildes y eñes al abrir el archivo directamente en una planilla.
export const crearCsvAdministrativo = <T>(filas: T[], columnas: ColumnaCsv<T>[], separador = ',') => {
  const lineas = [
    columnas.map(columna => escapar(columna.encabezado, separador)).join(separador),
    ...filas.map(fila => columnas.map(columna => escapar(columna.valor(fila), separador)).join(separador)),
  ];
  return `\uFEFF${lineas.join('\r\n')}`;
};

export const archivoCsvAdministrativo = <T>(nombre: string, filas: T[], columnas: ColumnaCsv<T>[]) => {
  const csv = crearCsvAdministrativo(filas, columnas);
  return { nombre, tipo: 'text/csv;charset=utf-8', mime: 'text/csv;charset=utf-8', contenido: `data:text/csv;base64,${Buffer.from(csv, 'utf8').toString('base64')}` };
};

export const fechaCsv = (valor: unknown, conHora = false) => {
  if (!valor) return '';
  const fecha = valor instanceof Date ? valor : new Date(String(valor));
  if (Number.isNaN(fecha.getTime())) return '';
  const opciones: Intl.DateTimeFormatOptions = conHora
    ? { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
    : { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Intl.DateTimeFormat('es-CL', opciones).format(fecha).replace(',', '');
};

export const humanizarCsv = (valor: unknown) => {
  const texto = String(valor ?? '').trim();
  if (!texto) return '';
  const conocidos: Record<string, string> = {
    EXCEPCION: 'Excepción', CONFIGURACION_PENDIENTE: 'Configuración pendiente',
    CONDICIONADO_F047_NO_IMPLEMENTADO: 'Condicionado: capacidad próxima no implementada',
  };
  return conocidos[texto.toUpperCase()] || texto.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toLocaleLowerCase('es-CL').replace(/^\p{L}/u, letra => letra.toLocaleUpperCase('es-CL'));
};
