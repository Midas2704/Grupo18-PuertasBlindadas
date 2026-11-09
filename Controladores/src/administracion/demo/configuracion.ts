export interface ConfiguracionDemo { corte: string; meses: number; semilla: number; version: number }

export function configuracionDemo(env: Record<string, string | undefined>): ConfiguracionDemo {
  const corte = env.DEMO_FECHA_CORTE || '2026-10-21';
  const fecha = new Date(`${corte}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(corte) || !Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== corte) throw new Error('DEMO_FECHA_CORTE debe ser una fecha ISO válida YYYY-MM-DD');
  const meses = Number(env.DEMO_MESES || 36), semilla = Number(env.DEMO_SEMILLA || 2704);
  if (!Number.isInteger(meses) || meses < 36 || meses > 120) throw new Error('DEMO_MESES debe estar entre 36 y 120');
  if (!Number.isInteger(semilla) || semilla < 0 || semilla > 2147483647) throw new Error('DEMO_SEMILLA debe ser un entero entre 0 y 2147483647');
  return { corte, meses, semilla, version: 2 };
}

export function acotarEfectiva(fecha: Date, config: ConfiguracionDemo): Date {
  return new Date(Math.min(fecha.getTime(), new Date(`${config.corte}T00:00:00Z`).getTime()));
}

export function fechaMes(config: ConfiguracionDemo, indice: number, dia = 1): Date {
  const corte = new Date(`${config.corte}T00:00:00Z`);
  return acotarEfectiva(new Date(Date.UTC(corte.getUTCFullYear(), corte.getUTCMonth() - (config.meses - 1 - indice), dia)), config);
}

export function variar(semilla: number, minimo: number, maximo: number, ...claves: number[]): number {
  const valor = claves.reduce((total, clave, indice) => (Math.imul(total, 1664525) + Math.imul(clave, 1013904223 + indice * 97)) >>> 0, (2166136261 ^ semilla) >>> 0);
  return minimo + valor % (maximo - minimo + 1);
}

export function planDemo(config: ConfiguracionDemo) {
  const meses = Array.from({ length: config.meses }, (_, indice) => {
    const fecha = fechaMes(config, indice), mesCalendario = fecha.getUTCMonth();
    const cotizaciones = [8,8,10,11,12,12,10,11,14,15,16,17][mesCalendario] + (indice >= 24 ? 1 : indice >= 12 ? 2 : 0) + (indice === 20 ? 3 : 0) - (indice === 5 ? 2 : 0);
    const ordenesConvertidas = Array.from({ length: cotizaciones }, (_, orden) => orden + 1).filter(orden => (orden + indice * 3) % 10 < (mesCalendario >= 8 ? 7 : 6));
    return { mes: fecha.toISOString().slice(0, 7), cotizaciones, ventas: ordenesConvertidas.length, pagosCliente: ordenesConvertidas.filter(orden => orden % 7 !== 0).length, comprasM5: 4, gastosCaja: 3 };
  });
  const aniosCompletos = [...new Set(meses.map(mes => mes.mes.slice(0, 4)))].filter(anio => meses.filter(mes => mes.mes.startsWith(anio)).length === 12 && Number(anio) < Number(config.corte.slice(0, 4)));
  return { estado: 'PREVISUALIZACION_SIN_CONEXION_NI_ESCRITURAS', configuracion: config, desde: meses[0].mes, hasta: meses[meses.length - 1].mes,
    aniosCompletos, meses, esperados: { clientes: 60, usuariosFicticiosSinAcceso: 7, materiales: 30, items: 13, proveedores: 15,
      cotizaciones: 5 + meses.reduce((s, m) => s + m.cotizaciones, 0), notas: 5 + meses.reduce((s, m) => s + m.ventas, 0),
      pagosCliente: 4 + meses.reduce((s, m) => s + m.pagosCliente, 0),
      periodosRemuneracion: config.meses,
      remuneraciones: Array.from({ length: 18 }, (_, i) => Math.max(0, (i >= 16 ? 22 : config.meses) - i % 8)).reduce((s, n) => s + n, 0),
      documentosProveedor: 5 + config.meses * 4, categoriasEgreso: 7, esquemas: 7, honorariosPrestadores: 10, obras: 40 },
    limitaciones: ['Cantidades previstas; no son registros insertados.', 'Los consumidores históricos M7 requieren validación PostgreSQL.', 'Usuarios ficticios sin credenciales ni permisos efectivos; no demuestran autenticación.'] };
}

export function validarComparativasM7(cortes: Array<{ corte: string; ventas: { monto: unknown; cantidad: unknown } }>) {
  const montoNum = (m: unknown) => typeof m === 'object' && m !== null && 'totalClp' in m && typeof (m as { totalClp: unknown }).totalClp === 'number' ? (m as { totalClp: number }).totalClp : Number(m);
  if (cortes.length < 3 || cortes.some(c => !Number.isFinite(montoNum(c.ventas.monto)) || montoNum(c.ventas.monto) <= 0 || Number(c.ventas.cantidad) <= 0)) throw new Error('M7 no presenta ventas positivas y trazables en los cortes históricos');
  if (new Set(cortes.map(c => montoNum(c.ventas.monto))).size < 2) throw new Error('M7 devuelve ventas invariantes entre cortes');
}
