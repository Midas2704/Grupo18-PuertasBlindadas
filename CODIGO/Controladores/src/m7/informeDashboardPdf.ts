import { archivoPdfGerencial, BloqueDocumentoPdf, DocumentoGerencialPdf, TarjetaDocumentoPdf } from '../utilidades/pdf';

type Registro = Record<string, any>;
type EntradaInformeM7 = {
  origen: string;
  tituloContextual: string;
  periodo: { etiquetaDesde: string; etiquetaHasta: string };
  filtros: string;
  generadoEn: Date;
  datos: unknown;
  panel?: unknown;
  historico?: unknown;
};

const registro = (valor: unknown): Registro => valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Registro : {};
const lista = (valor: unknown): Registro[] => Array.isArray(valor) ? valor.filter(item => item && typeof item === 'object') as Registro[] : [];
const ultimo = (filas: Registro[], desplazamiento = 0) => filas[filas.length - 1 - desplazamiento] || {};
const numero = (valor: unknown): number | null => typeof valor === 'number' && Number.isFinite(valor) ? valor : typeof valor === 'string' && valor.trim() && Number.isFinite(Number(valor)) ? Number(valor) : null;
const indicador = (valor: unknown) => registro(registro(valor).valor ?? valor);
const valorIndicador = (valor: unknown) => registro(valor).valor;
const moneda = (valor: number | null, codigo = 'CLP') => {
  if (valor === null) return 'No disponible';
  const signo = valor < 0 ? '-' : '', monto = Math.abs(valor);
  return codigo === 'CLP'
    ? `${signo}$${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(monto)}`
    : `${signo}${codigo} ${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(monto)}`;
};
const montoOriginal = (valor: number | null) => valor === null ? 'No disponible' : new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(valor);
const porcentaje = (valor: number | null) => valor === null ? 'No disponible' : `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(valor)}%`;
const entero = (valor: number | null) => valor === null ? 'No disponible' : new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(valor);
const fechaHora = (fecha: Date) => {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santiago' }).formatToParts(fecha).map(parte => [parte.type, parte.value]));
  const hora = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' }).format(fecha);
  return `${partes.day}-${partes.month}-${partes.year}, ${hora}`;
};
const mesHumano = (clave: string) => {
  const coincidencia = clave.match(/^(\d{4})-(\d{2})$/); if (!coincidencia) return clave;
  const fecha = new Date(Date.UTC(Number(coincidencia[1]), Number(coincidencia[2]) - 1, 1));
  return new Intl.DateTimeFormat('es-CL', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(fecha).replace('.', '');
};
const fechaHumana = (valor: unknown) => {
  const coincidencia = String(valor ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return coincidencia ? `${coincidencia[3]}-${coincidencia[2]}-${coincidencia[1]}` : '—';
};
const textoHumano = (valor: unknown) => String(valor ?? '').replace(/^DEMO[-_ ]UI\s*[|—-]?\s*/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || '—';
const fraseHumana = (valor: unknown) => {
  const texto = textoHumano(valor);
  if (!/[A-ZÁÉÍÓÚÑ]/.test(texto) || texto !== texto.toLocaleUpperCase('es-CL')) return texto;
  const minusculas = texto.toLocaleLowerCase('es-CL');
  return `${minusculas.charAt(0).toLocaleUpperCase('es-CL')}${minusculas.slice(1)}`;
};
const nombreSinIdTecnico = (valor: unknown) => textoHumano(valor).replace(/^\d+\s*(?:\||—|-)\s*/, '').trim() || '—';
const listaFlexible = (valor: unknown) => Array.isArray(valor)
  ? lista(valor)
  : Object.entries(registro(valor)).filter(([clave, fila]) => /^\d+$/.test(clave) && fila && typeof fila === 'object').sort(([a], [b]) => Number(a) - Number(b)).map(([, fila]) => fila as Registro);
const bloque = (panel: Registro, clave: string) => registro(registro(panel.bloques)[clave]);
const montoMoneda = (valor: unknown, codigo = 'CLP') => {
  const directo = numero(valor); if (directo !== null) return directo;
  const r = registro(valor), porMoneda = lista(r.porMoneda ?? valor);
  return numero(porMoneda.find(item => String(item.moneda).toUpperCase() === codigo)?.monto ?? r.totalClp ?? r.monto);
};
const montoIndicador = (valor: unknown, codigo = 'CLP') => montoMoneda(valorIndicador(valor), codigo);
const comparacion = (actual: number | null, anterior: number | null) => actual === null || anterior === null || anterior === 0 ? undefined : `${actual >= anterior ? '+' : ''}${porcentaje((actual - anterior) / Math.abs(anterior) * 100)} vs mes anterior`;
const notaNoDisponible = (texto: string): BloqueDocumentoPdf => ({ tipo: 'notas', lineas: [texto] });
const tabla = (titulo: string, columnas: any[], filas: Registro[], nota?: string): BloqueDocumentoPdf => ({ tipo: 'tabla', titulo, columnas, filas, nota });
const grafico = (titulo: string, categorias: string[], series: any[], formato: 'moneda' | 'numero' | 'porcentaje' = 'numero', alto = 170, nota?: string, opciones: Partial<Extract<BloqueDocumentoPdf, { tipo: 'grafico' }>> = {}): BloqueDocumentoPdf => ({ tipo: 'grafico', titulo, categorias, series, formato, alto, nota, ...opciones });

export const ordenarPagosRecientes = (pagos: Registro[]) => [...pagos].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

// MIDAS: agrupamos sólo para dibujar; la proyección conserva cada evento individual.
export const agruparEventosProyeccion = (eventos: Registro[]) => [...eventos.reduce<Map<string, { fecha: string; cambio: number; liquidezProyectada: number | null }>>((mapa, item) => {
  const fecha = String(item.fecha || ''); const actual = mapa.get(fecha) || { fecha, cambio: 0, liquidezProyectada: numero(item.liquidezProyectada) };
  actual.cambio += Number(item.cambio || 0); actual.liquidezProyectada = numero(item.liquidezProyectada); mapa.set(fecha, actual); return mapa;
}, new Map()).values()].sort((a, b) => a.fecha.localeCompare(b.fecha));

export const resumirCarteraConsolidable = (cartera: Registro[]) => {
  // MIDAS: sin equivalente CLP válido, la deuda se informa aparte y no entra al ranking consolidado.
  const consolidables = cartera.filter(item => numero(item.equivalenteClp) !== null);
  const noConsolidables = cartera.filter(item => String(item.moneda || 'CLP') !== 'CLP' && numero(item.equivalenteClp) === null);
  const deudaClpPorCliente = [...consolidables.reduce<Map<string, number>>((mapa, item) => {
    const cliente = textoHumano(item.cliente); mapa.set(cliente, (mapa.get(cliente) || 0) + Number(item.equivalenteClp)); return mapa;
  }, new Map()).entries()].map(([cliente, saldo]) => ({ cliente, saldo }));
  const totalClp = deudaClpPorCliente.reduce((suma, item) => suma + item.saldo, 0);
  const concentracion = deudaClpPorCliente.sort((a, b) => b.saldo - a.saldo).map(item => ({ ...item, porcentaje: totalClp > 0 ? item.saldo / totalClp * 100 : null }));
  return { consolidables, noConsolidables, totalClp, concentracion };
};

export const resumirProyeccionClp = (eventos: Registro[], ingresos: Registro[], egresos: Registro[], saldoFinal: Registro) => {
  const base = numero(eventos.find(item => item.direccion === 'SALDO_INICIAL')?.liquidezProyectada);
  const cobros = ingresos.reduce((suma, item) => suma + Number(item.monto || 0), 0);
  const pagos = egresos.reduce((suma, item) => suma + Number(item.monto || 0), 0);
  const final = numero(saldoFinal.liquidez);
  const calculado = base === null ? null : base + cobros - pagos;
  return { base, cobros, pagos, final, calculado, consistente: calculado !== null && final !== null && Math.abs(calculado - final) < 0.01 };
};

const tarjetasCorte = (panel: Registro, meses: Registro[]): TarjetaDocumentoPdf[] => {
  const actual = ultimo(meses), anterior = ultimo(meses, 1);
  const cxc = montoIndicador(bloque(panel, 'cuentasCobrar').saldo);
  const cxp = montoIndicador(bloque(panel, 'cuentasPagar').saldo);
  return [
    { etiqueta: 'Resultado gerencial', valor: moneda(numero(actual.resultadoGerencial)), detalle: comparacion(numero(actual.resultadoGerencial), numero(anterior.resultadoGerencial)), tono: numero(actual.resultadoGerencial) !== null && Number(actual.resultadoGerencial) < 0 ? 'fallido' : 'exitoso' },
    { etiqueta: 'Cuentas por cobrar', valor: moneda(cxc), detalle: 'Saldo vigente al corte' },
    { etiqueta: 'Cuentas por pagar', valor: moneda(cxp), detalle: 'Saldo vigente al corte' },
    { etiqueta: 'Flujo neto del período', valor: moneda(numero(actual.flujoNeto)), detalle: comparacion(numero(actual.flujoNeto), numero(anterior.flujoNeto)), tono: numero(actual.flujoNeto) !== null && Number(actual.flujoNeto) < 0 ? 'fallido' : 'exitoso' },
  ];
};

const paginaResumen = (panel: Registro, meses: Registro[]): DocumentoGerencialPdf['paginas'][number] => ({
  titulo: 'Resumen ejecutivo', subtitulo: 'Indicadores principales del período de corte', bloques: [
    { tipo: 'tarjetas', tarjetas: tarjetasCorte(panel, meses) },
    { tipo: 'notas', titulo: 'Lectura del resultado', lineas: ['Ventas netas menos costos directos atribuibles. No constituye un Estado de Resultados contable formal.', 'Cuentas por cobrar y pagar corresponden a saldos vigentes al momento de la consulta.'] },
    { tipo: 'tabla', titulo: 'Síntesis del período', columnas: [{ clave: 'indicador', etiqueta: 'Indicador', ancho: 250 }, { clave: 'actual', etiqueta: 'Mes de corte', ancho: 130 }, { clave: 'anterior', etiqueta: 'Mes anterior', ancho: 131 }], filas: [
      { indicador: 'Ventas netas', actual: moneda(numero(ultimo(meses).ventasNetas)), anterior: moneda(numero(ultimo(meses, 1).ventasNetas)) },
      { indicador: 'Costos directos', actual: moneda(numero(ultimo(meses).costosDirectos)), anterior: moneda(numero(ultimo(meses, 1).costosDirectos)) },
      { indicador: 'Cantidad de ventas', actual: entero(numero(ultimo(meses).cantidadVentas)), anterior: entero(numero(ultimo(meses, 1).cantidadVentas)) },
      { indicador: 'Conversión de cotizaciones', actual: porcentaje(numero(ultimo(meses).conversionPorcentual)), anterior: porcentaje(numero(ultimo(meses, 1).conversionPorcentual)) },
    ] },
  ],
});

const paginasPanel = (panelEntrada: unknown, historicoEntrada: unknown): DocumentoGerencialPdf['paginas'] => {
  const panel = registro(panelEntrada), historico = registro(historicoEntrada), meses = lista(historico.meses), categorias = meses.map(item => mesHumano(String(item.periodo)));
  const ventas = meses.map(item => numero(item.ventasNetas)), costos = meses.map(item => numero(item.costosDirectos)), resultados = meses.map(item => numero(item.resultadoGerencial));
  const flujo = meses.map(item => numero(item.flujoNeto)), ingresos = meses.map(item => numero(item.ingresosRecibidos)), egresos = meses.map(item => numero(item.egresosRealizados));
  const remuneraciones = meses.map(item => numero(item.costoRemuneraciones));
  const mejores = meses.filter(item => numero(item.ventasNetas) !== null).sort((a, b) => Number(b.ventasNetas) - Number(a.ventasNetas));
  const totalVentas = ventas.reduce<number>((suma, valor) => suma + (valor || 0), 0), mesesVentas = ventas.filter((valor): valor is number => valor !== null);
  const clientes = lista(historico.principalesClientes).slice(0, 10);
  const proyectos = lista(bloque(panel, 'margenProyectos').proyectos).filter(item => numero(item.ingresosAtribuibles) !== null).sort((a, b) => Number(b.ingresosAtribuibles) - Number(a.ingresosAtribuibles)).slice(0, 8);
  const costosComponentes = new Map<string, number>();
  for (const costo of lista(bloque(panel, 'margenProyectos').proyectos).flatMap(proyecto => lista(proyecto.desgloseCostos))) {
    const origen = String(costo.origen || '').toUpperCase(); const etiqueta = origen.includes('REMUNERACION') ? 'Remuneraciones productivas atribuibles' : origen.includes('INSTAL') ? 'Instalación configurada' : origen.includes('MATERIAL') ? 'Materiales' : null;
    if (etiqueta && String(costo.moneda || 'CLP') === 'CLP') costosComponentes.set(etiqueta, (costosComponentes.get(etiqueta) || 0) + Number(costo.monto || 0));
  }
  const credito = registro(valorIndicador(bloque(panel, 'exposicionCredito').exposicion));
  const concentracion = lista(registro(credito.concentracion).clientes).filter(item => numero(item.exposicion)! > 0).sort((a, b) => Number(b.exposicion) - Number(a.exposicion)).slice(0, 6);
  const inventario = bloque(panel, 'inventarioValorizado'), riesgos = lista(bloque(panel, 'riesgoStock').riesgos), inmovil = lista(valorIndicador(bloque(panel, 'rotacionInventario').stockInmovil));
  const compras = lista(bloque(panel, 'comprasRecepciones').ordenesPendientes).slice(0, 8);
  const centro = bloque(panel, 'centroAtencion'), excepciones = lista(centro.excepciones), bloqueos = bloque(panel, 'bloqueosEconomicos');
  const paginas: DocumentoGerencialPdf['paginas'] = [paginaResumen(panel, meses)];
  paginas.push({ titulo: 'Evolución 12 meses', subtitulo: 'Ventas, costos y resultado gerencial', bloques: [grafico('Ventas, costos y resultado - últimos 12 meses', categorias, [{ etiqueta: 'Ventas netas', valores: ventas, color: 'naranja' }, { etiqueta: 'Costos directos', valores: costos, color: 'gris' }, { etiqueta: 'Resultado gerencial', valores: resultados, color: 'negro', estilo: 'linea' }], 'moneda', 300, 'Los períodos sin fuente válida se muestran sin barra ni punto.'), { tipo: 'notas', lineas: ['Resultado gerencial: ventas netas menos costos directos atribuibles.', 'Los datos no disponibles no se reemplazan por cero.'] }] });
  paginas.push({ titulo: 'Ventas y conversión', subtitulo: 'Actividad comercial de los últimos 12 meses', bloques: [grafico('Ventas mensuales', categorias, [{ etiqueta: 'Ventas netas', valores: ventas, color: 'naranja' }, { etiqueta: 'Cantidad de ventas', valores: meses.map(item => numero(item.cantidadVentas)), color: 'gris', estilo: 'linea', eje: 'derecho' }], 'moneda', 205, undefined, { ejeIzquierdo: 'CLP', ejeDerecho: { etiqueta: 'unidades', formato: 'numero', minimo: 0 } }), grafico('Conversión de cotizaciones', categorias, [{ etiqueta: 'Cotizaciones', valores: meses.map(item => numero(item.cotizaciones)), color: 'gris' }, { etiqueta: 'Convertidas', valores: meses.map(item => numero(item.convertidas)), color: 'naranja' }, { etiqueta: 'Tasa de conversión', valores: meses.map(item => numero(item.conversionPorcentual)), color: 'negro', estilo: 'linea', eje: 'derecho' }], 'numero', 185, undefined, { ejeIzquierdo: 'cantidad', ejeDerecho: { etiqueta: '%', formato: 'porcentaje', minimo: 0, maximo: 100 } }), { tipo: 'tarjetas', tarjetas: [{ etiqueta: 'Ventas 12 meses', valor: moneda(totalVentas) }, { etiqueta: 'Promedio mensual', valor: moneda(mesesVentas.length ? totalVentas / mesesVentas.length : null) }, { etiqueta: 'Mejor mes', valor: mejores[0] ? mesHumano(mejores[0].periodo) : 'No disponible', detalle: mejores[0] ? moneda(numero(mejores[0].ventasNetas)) : undefined }, { etiqueta: 'Conversión al corte', valor: porcentaje(numero(ultimo(meses).conversionPorcentual)) }] }] });
  paginas.push({ titulo: 'Flujo y cartera', subtitulo: 'Movimientos realizados y saldos vigentes', bloques: [grafico('Flujo de caja - últimos 12 meses', categorias, [{ etiqueta: 'Ingresos recibidos', valores: ingresos, color: 'naranja' }, { etiqueta: 'Egresos realizados', valores: egresos, color: 'gris' }, { etiqueta: 'Flujo neto', valores: flujo, color: 'negro', estilo: 'linea' }], 'moneda', 265), { tipo: 'tarjetas', tarjetas: tarjetasCorte(panel, meses).slice(1, 3) }, { tipo: 'notas', titulo: 'Alcance de cartera', lineas: ['Cuentas por cobrar y pagar corresponden al saldo vigente disponible al momento de la consulta.', 'No se presenta una evolución histórica de CxC o CxP porque sus módulos propietarios no conservan snapshots mensuales completos.'] }] });
  paginas.push({ titulo: 'Clientes y proyectos', subtitulo: 'Concentración comercial y margen directo atribuible', bloques: [{ tipo: 'barras', titulo: 'Principales clientes por ventas', filas: clientes.map(item => ({ etiqueta: textoHumano(item.cliente), valor: Number(item.monto || 0), detalle: `${moneda(numero(item.monto))} · ${porcentaje(numero(item.participacionPorcentual))}` })), formato: 'moneda', maximoFilas: 8 }, tabla('Proyectos principales por ingresos', [{ clave: 'proyecto', etiqueta: 'Proyecto', ancho: 185 }, { clave: 'ingresos', etiqueta: 'Ingresos', ancho: 100, alinear: 'derecha' }, { clave: 'costos', etiqueta: 'Costos directos', ancho: 105, alinear: 'derecha' }, { clave: 'margen', etiqueta: 'Margen', ancho: 70, alinear: 'derecha' }, { clave: 'porcentaje', etiqueta: 'Margen %', ancho: 51, alinear: 'derecha' }], proyectos.map(item => ({ proyecto: nombreSinIdTecnico(item.nombre || item.codigo), ingresos: moneda(numero(item.ingresosAtribuibles)), costos: moneda(numero(item.costosDirectosAtribuibles)), margen: moneda(numero(item.margenDirecto)), porcentaje: porcentaje(numero(item.porcentajeMargen)) })), 'Se muestran hasta ocho proyectos con ingresos atribuibles en el período.') ] });
  paginas.push({ titulo: 'Costos y remuneraciones', subtitulo: 'Componentes directamente atribuibles y costo laboral agregado', bloques: [costosComponentes.size ? { tipo: 'barras', titulo: 'Composición de costos directos', filas: [...costosComponentes].map(([etiqueta, valor]) => ({ etiqueta, valor })), formato: 'moneda' } : notaNoDisponible('La composición por materiales, remuneraciones productivas e instalación no está completamente identificada para este período; no se reclasifican costos sin evidencia.'), grafico('Costo laboral - últimos 12 meses', categorias, [{ etiqueta: 'Costo laboral', valores: remuneraciones, color: 'naranja' }], 'moneda', 235), { tipo: 'tarjetas', tarjetas: [{ etiqueta: 'Costo mes de corte', valor: moneda(numero(ultimo(meses).costoRemuneraciones)) }, { etiqueta: 'Promedio 12 meses', valor: moneda(remuneraciones.filter((v): v is number => v !== null).reduce((a, b) => a + b, 0) / Math.max(1, remuneraciones.filter(v => v !== null).length)) }, { etiqueta: 'Mayor costo mensual', valor: moneda(Math.max(...remuneraciones.filter((v): v is number => v !== null))) }, { etiqueta: 'Menor costo válido', valor: moneda(Math.min(...remuneraciones.filter((v): v is number => v !== null))) }] }] });
  paginas.push({ titulo: 'Crédito', subtitulo: 'Información proporcionada por el módulo M8 al corte disponible', bloques: [Object.keys(credito).length ? { tipo: 'tarjetas', tarjetas: [{ etiqueta: 'Límite global', valor: moneda(numero(credito.limiteGlobal)) }, { etiqueta: 'Exposición utilizada', valor: moneda(numero(credito.exposicionUtilizada)), tono: numero(credito.capacidadDisponible)! < 0 ? 'fallido' : 'neutro' }, { etiqueta: 'Capacidad disponible', valor: moneda(numero(credito.capacidadDisponible)) }, { etiqueta: 'Utilización', valor: porcentaje(numero(credito.limiteGlobal) ? Number(credito.exposicionUtilizada || 0) / Number(credito.limiteGlobal) * 100 : null) }] } : { tipo: 'notas', lineas: ['Información de crédito no disponible para este período.'] }, { tipo: 'tarjetas', tarjetas: [{ etiqueta: 'Solicitudes', valor: entero(numero(credito.totalSolicitudes)) }, { etiqueta: 'Compromisos', valor: entero(numero(credito.totalCompromisos)) }, { etiqueta: 'Clientes sobre cupo', valor: entero(lista(credito.clientesSobreLimite).length), tono: lista(credito.clientesSobreLimite).length ? 'rechazado' : 'neutro' }, { etiqueta: 'Clientes suspendidos', valor: entero(lista(credito.clientesSuspendidos).length), tono: lista(credito.clientesSuspendidos).length ? 'fallido' : 'neutro' }] }, { tipo: 'barras', titulo: 'Concentración por cliente', filas: concentracion.map(item => ({ etiqueta: textoHumano(item.cliente), valor: Number(item.exposicion), detalle: `${moneda(numero(item.exposicion))} · ${porcentaje(numero(item.concentracion))}` })), formato: 'moneda', maximoFilas: 6 }, { tipo: 'notas', lineas: ['Información de crédito correspondiente al corte disponible.', 'Los cupos, exposición, restricciones y alertas son calculados por M8; M7 no los recalcula.'] }] });
  paginas.push({ titulo: 'Operación', subtitulo: 'Actividad operacional observada durante los últimos 12 meses', bloques: [grafico('Instalaciones, órdenes de trabajo e incidencias', categorias, [{ etiqueta: 'Instalaciones', valores: meses.map(item => numero(item.instalaciones)), color: 'naranja' }, { etiqueta: 'Órdenes de trabajo', valores: meses.map(item => numero(item.ordenesTrabajo)), color: 'gris' }, { etiqueta: 'Incidencias', valores: meses.map(item => numero(item.incidencias)), color: 'negro', estilo: 'linea' }], 'numero', 280), { tipo: 'tarjetas', tarjetas: [{ etiqueta: 'Instalaciones al corte', valor: entero(numero(ultimo(meses).instalaciones)) }, { etiqueta: 'OT al corte', valor: entero(numero(ultimo(meses).ordenesTrabajo)) }, { etiqueta: 'Incidencias al corte', valor: entero(numero(ultimo(meses).incidencias)), tono: numero(ultimo(meses).incidencias) ? 'rechazado' : 'neutro' }, { etiqueta: 'Tareas atrasadas', valor: entero(lista(valorIndicador(bloque(panel, 'atrasosInstalaciones').atrasos)).length), tono: lista(valorIndicador(bloque(panel, 'atrasosInstalaciones').atrasos)).length ? 'rechazado' : 'neutro' }] }, { tipo: 'notas', lineas: ['Estos indicadores describen actividad y excepciones; no constituyen un score operacional.'] }] });
  paginas.push({ titulo: 'Inventario y compras', subtitulo: 'Valorización al corte, riesgos y recepciones pendientes', bloques: [{ tipo: 'tarjetas', tarjetas: [{ etiqueta: 'Inventario valorizado', valor: moneda(montoIndicador(inventario.valorTotal)) }, { etiqueta: 'Materiales con riesgo', valor: entero(riesgos.length), tono: riesgos.length ? 'rechazado' : 'neutro' }, { etiqueta: 'Stock inmóvil', valor: entero(inmovil.length) }, { etiqueta: 'Compras pendientes', valor: entero(lista(bloque(panel, 'comprasRecepciones').ordenesPendientes).length) }] }, tabla('Compras y recepciones pendientes', [{ clave: 'material', etiqueta: 'Material', ancho: 145 }, { clave: 'proveedor', etiqueta: 'Proveedor', ancho: 140 }, { clave: 'pedida', etiqueta: 'Pedida', ancho: 55, alinear: 'derecha' }, { clave: 'recibida', etiqueta: 'Recibida', ancho: 55, alinear: 'derecha' }, { clave: 'pendiente', etiqueta: 'Pendiente', ancho: 60, alinear: 'derecha' }, { clave: 'fecha', etiqueta: 'Fecha esperada', ancho: 56 }], compras.map(item => ({ material: textoHumano(item.material || item.sku), proveedor: textoHumano(item.proveedor), pedida: entero(numero(item.cantidadPedida)), recibida: entero(numero(item.cantidadRecibida)), pendiente: entero(numero(item.cantidadPendiente)), fecha: fechaHumana(item.fechaEsperada) })), 'Se muestran los principales registros. Consulte el Dashboard para el detalle completo.'), riesgos.length ? { tipo: 'barras', titulo: 'Principales riesgos de stock', filas: riesgos.slice(0, 5).map(item => ({ etiqueta: textoHumano(item.material), valor: Number(item.faltante || 0), detalle: `Faltante ${entero(numero(item.faltante))}` })), formato: 'numero' } : notaNoDisponible('No se identifican riesgos de stock con la información disponible al corte.') ] });
  paginas.push({ titulo: 'Alertas y cobertura', subtitulo: 'Excepciones objetivas y alcance del informe', bloques: [excepciones.length ? tabla('Alertas relevantes', [{ clave: 'familia', etiqueta: 'Familia', ancho: 145 }, { clave: 'descripcion', etiqueta: 'Situación observada', ancho: 366 }], excepciones.slice(0, 10).map(item => ({ familia: fraseHumana(item.familia), descripcion: fraseHumana(item.ocurrio) }))) : notaNoDisponible('No se registran alertas del Centro de Atención para las fuentes disponibles.'), { tipo: 'notas', titulo: 'Alcance del informe', lineas: ['Resultado gerencial no equivale a un estado contable formal.', 'Cuentas por cobrar y pagar corresponden a saldos vigentes al momento de consulta.', 'Crédito se obtiene exclusivamente del módulo M8.', 'Inventario corresponde al corte disponible y no se presenta como serie histórica.', 'Datos no disponibles no se reemplazan por cero.', Object.keys(bloqueos).length ? 'Los bloqueos económicos se presentan sólo cuando su módulo propietario entrega una fuente válida.' : 'La fuente de bloqueos económicos no está disponible para este corte.'] }] });
  return paginas;
};

const paginasContextuales = (origen: string, titulo: string, datosEntrada: unknown, historicoEntrada?: unknown): DocumentoGerencialPdf['paginas'] => {
  const datos = registro(datosEntrada), historico = registro(historicoEntrada), paginas: DocumentoGerencialPdf['paginas'] = [];
  const encabezado = (tarjetas: TarjetaDocumentoPdf[], notas: string[] = []): DocumentoGerencialPdf['paginas'][number] => ({ titulo, subtitulo: 'Síntesis ejecutiva del período consultado', bloques: [{ tipo: 'tarjetas', tarjetas }, ...(notas.length ? [{ tipo: 'notas' as const, titulo: 'Alcance', lineas: notas }] : [])] });
  if (origen === 'ventas') {
    const meses = lista(historico.meses).slice(-12), categorias = meses.map(item => mesHumano(String(item.periodo)));
    const actual = ultimo(meses), anterior = ultimo(meses, 1), ventas = meses.map(item => numero(item.ventasNetas));
    const ventasValidas = meses.filter(item => numero(item.ventasNetas) !== null && Number(item.ventasNetas) > 0);
    const ordenVentas = [...ventasValidas].sort((a, b) => Number(b.ventasNetas) - Number(a.ventasNetas));
    const menorMesConActividad = ordenVentas[ordenVentas.length - 1];
    const conversiones = meses.map(item => numero(item.conversionPorcentual)).filter((valor): valor is number => valor !== null);
    const totalVentas = ventas.reduce<number>((suma, valor) => suma + (valor || 0), 0);
    const promedioVentas = ventas.filter((valor): valor is number => valor !== null);
    const clientes = lista(historico.principalesClientes).sort((a, b) => Number(b.monto) - Number(a.monto)).slice(0, 10);
    paginas.push({ titulo: 'Análisis de Ventas', subtitulo: 'Puertas Blindadas - Evolución comercial', bloques: [
      { tipo: 'tarjetas', tarjetas: [
        { etiqueta: 'Ventas netas mes de corte', valor: moneda(numero(actual.ventasNetas) ?? montoIndicador(datos.montoNeto)), detalle: comparacion(numero(actual.ventasNetas), numero(anterior.ventasNetas)) },
        { etiqueta: 'Cantidad de ventas', valor: entero(numero(actual.cantidadVentas) ?? numero(valorIndicador(datos.cantidad))), detalle: comparacion(numero(actual.cantidadVentas), numero(anterior.cantidadVentas)) },
        { etiqueta: 'Ticket medio', valor: moneda(montoIndicador(datos.ticketMedio)) },
        { etiqueta: 'Conversión', valor: porcentaje(numero(actual.conversionPorcentual) ?? numero(indicador(datos.conversion).tasaPorcentual)), detalle: comparacion(numero(actual.conversionPorcentual), numero(anterior.conversionPorcentual)) },
      ] },
      { tipo: 'tarjetas', tarjetas: [
        { etiqueta: 'Ventas acumuladas 12 meses', valor: moneda(totalVentas) },
        { etiqueta: 'Promedio mensual 12 meses', valor: moneda(promedioVentas.length ? totalVentas / promedioVentas.length : null) },
      ] },
      { tipo: 'notas', lineas: ['Las comparaciones se presentan cuando existe información válida para el período anterior.', 'El informe utiliza la misma ventana histórica mensual del Dashboard M7.'] },
    ] });
    paginas.push({ titulo: 'Evolución 12 meses', subtitulo: 'Ventas netas y cantidad de ventas', bloques: [
      grafico('Ventas mensuales - últimos 12 meses', categorias, [
        { etiqueta: 'Ventas netas', valores: ventas, color: 'naranja' },
        { etiqueta: 'Cantidad de ventas', valores: meses.map(item => numero(item.cantidadVentas)), color: 'negro', estilo: 'linea', eje: 'derecho' },
      ], 'moneda', 330, 'Ventas netas en barras y cantidad de ventas en línea, cada una con su propia escala.', { ejeIzquierdo: 'CLP', ejeDerecho: { etiqueta: 'unidades', formato: 'numero', minimo: 0 } }),
      { tipo: 'tarjetas', tarjetas: [
        { etiqueta: 'Mejor mes', valor: ordenVentas[0] ? mesHumano(String(ordenVentas[0].periodo)) : 'No disponible', detalle: ordenVentas[0] ? moneda(numero(ordenVentas[0].ventasNetas)) : undefined },
        { etiqueta: 'Menor mes con actividad', valor: menorMesConActividad ? mesHumano(String(menorMesConActividad.periodo)) : 'No disponible', detalle: menorMesConActividad ? moneda(numero(menorMesConActividad.ventasNetas)) : undefined },
        { etiqueta: 'Promedio mensual', valor: moneda(promedioVentas.length ? totalVentas / promedioVentas.length : null) },
        { etiqueta: 'Total 12 meses', valor: moneda(totalVentas) },
      ] },
    ] });
    paginas.push({ titulo: 'Conversión de cotizaciones', subtitulo: 'Comportamiento comercial de los últimos 12 meses', bloques: [
      grafico('Conversión de cotizaciones - últimos 12 meses', categorias, [
        { etiqueta: 'Cotizaciones', valores: meses.map(item => numero(item.cotizaciones)), color: 'gris' },
        { etiqueta: 'Convertidas', valores: meses.map(item => numero(item.convertidas)), color: 'naranja' },
        { etiqueta: 'Tasa de conversión', valores: meses.map(item => numero(item.conversionPorcentual)), color: 'negro', estilo: 'linea', eje: 'derecho' },
      ], 'numero', 330, 'La tasa describe la proporción observada; no implica por sí sola una evaluación de desempeño.', { ejeIzquierdo: 'cantidad', ejeDerecho: { etiqueta: '%', formato: 'porcentaje', minimo: 0, maximo: 100 } }),
      { tipo: 'tarjetas', tarjetas: [
        { etiqueta: 'Conversión al corte', valor: porcentaje(numero(actual.conversionPorcentual)) },
        { etiqueta: 'Promedio 12 meses', valor: porcentaje(conversiones.length ? conversiones.reduce((a, b) => a + b, 0) / conversiones.length : null) },
        { etiqueta: 'Mayor tasa válida', valor: porcentaje(conversiones.length ? Math.max(...conversiones) : null) },
        { etiqueta: 'Menor tasa válida', valor: porcentaje(conversiones.length ? Math.min(...conversiones) : null) },
      ] },
    ] });
    paginas.push({ titulo: 'Principales clientes', subtitulo: 'Ventas acumuladas durante los últimos 12 meses', bloques: [
      { tipo: 'barras', titulo: 'Principales clientes por ventas', filas: clientes.map(item => ({ etiqueta: textoHumano(item.cliente), valor: Number(item.monto || 0), detalle: `${moneda(numero(item.monto))} · ${porcentaje(numero(item.participacionPorcentual))}` })), formato: 'moneda', maximoFilas: 10 },
      { tipo: 'notas', lineas: ['La participación se calcula sobre las ventas netas con monto consolidable disponibles en la ventana de 12 meses.', 'El detalle diario permanece disponible en la pantalla y no se replica en este informe gerencial.'] },
    ] });
  } else if (origen === 'cuentas-cobrar' || origen === 'cuentas-pagar') {
    const cartera = lista(valorIndicador(datos.cartera)), saldo = montoIndicador(datos.saldo);
    const vencidas = cartera.filter(item => String(item.condicion).toUpperCase() === 'VENCIDA');
    const futuros = lista(valorIndicador(datos.compromisosFuturos));
    if (origen === 'cuentas-cobrar') {
      const morosidad = indicador(datos.morosidad);
      const saldosOriginales = lista(valorIndicador(datos.saldo));
      const { consolidables, noConsolidables, totalClp, concentracion } = resumirCarteraConsolidable(cartera);
      const cobranza = indicador(datos.detalleCobranza), pagos = ordenarPagosRecientes(lista(cobranza.pagos)), cumplimiento = lista(valorIndicador(datos.cumplimiento));
      const recuperacion = indicador(datos.recuperacionMoraPrevia), pagosRecuperados = lista(recuperacion.pagos);
      paginas.push({ titulo: 'Cuentas por Cobrar', subtitulo: 'Cartera y cobranza efectiva al corte', bloques: [
        { tipo: 'tarjetas', tarjetas: [
          { etiqueta: 'Saldo consolidable CLP', valor: moneda(totalClp) },
          { etiqueta: 'Obligaciones vencidas', valor: entero(numero(morosidad.cantidad) ?? vencidas.length), tono: vencidas.length ? 'rechazado' : 'neutro' },
          { etiqueta: 'Recaudación del período', valor: moneda(montoIndicador(datos.recaudacion)) },
          { etiqueta: 'Mora previa recuperada', valor: moneda(montoMoneda(recuperacion.porMoneda)) },
        ] },
        { tipo: 'notas', titulo: 'Saldos originales por moneda', lineas: [...saldosOriginales.map(item => `${String(item.moneda || 'N/D')}: ${montoOriginal(numero(item.monto))}`), 'El saldo consolidable CLP suma sólo obligaciones en CLP o con conversión histórica válida. Los importes originales por moneda no se suman entre sí.'] },
      ] });
      paginas.push({ titulo: 'Antigüedad y concentración', subtitulo: 'Obligaciones abiertas ordenadas por saldo', bloques: [
        tabla('Principales cuentas por cobrar', [{ clave: 'cliente', etiqueta: 'Cliente', ancho: 145 }, { clave: 'vencimiento', etiqueta: 'Vencimiento', ancho: 72 }, { clave: 'dias', etiqueta: 'Días', ancho: 36, alinear: 'derecha' }, { clave: 'saldo', etiqueta: 'Saldo original', ancho: 120, alinear: 'derecha' }, { clave: 'equivalente', etiqueta: 'Equiv. CLP', ancho: 138, alinear: 'derecha' }], [...consolidables].sort((a, b) => Number(b.equivalenteClp) - Number(a.equivalenteClp)).slice(0, 12).map(item => ({ cliente: textoHumano(item.cliente), vencimiento: fechaHumana(item.fechaVencimiento), dias: item.diasAtraso === null ? '—' : entero(numero(item.diasAtraso)), saldo: moneda(numero(item.saldo), String(item.moneda || 'CLP')), equivalente: moneda(numero(item.equivalenteClp)) })), 'El ranking usa exclusivamente equivalentes CLP confirmados. Se muestran hasta doce obligaciones principales.'),
        { tipo: 'barras', titulo: 'Concentración de deuda consolidable por cliente', filas: concentracion.slice(0, 8).map(item => ({ etiqueta: item.cliente, valor: item.saldo, detalle: `${moneda(item.saldo)} · ${porcentaje(item.porcentaje)}` })), formato: 'moneda', maximoFilas: 8 },
        ...(noConsolidables.length ? [tabla('Saldos no consolidables', [{ clave: 'cliente', etiqueta: 'Cliente', ancho: 210 }, { clave: 'moneda', etiqueta: 'Moneda', ancho: 60 }, { clave: 'saldo', etiqueta: 'Saldo original', ancho: 110, alinear: 'derecha' }, { clave: 'motivo', etiqueta: 'Motivo', ancho: 131 }], noConsolidables.slice(0, 6).map(item => ({ cliente: textoHumano(item.cliente), moneda: String(item.moneda), saldo: montoOriginal(numero(item.saldo)), motivo: 'Sin conversión histórica válida' })), 'Estos saldos no participan en el ranking ni en la concentración CLP.')] : []),
      ] });
      paginas.push({ titulo: 'Cobranza y compromisos', subtitulo: 'Pagos efectivos y vencimientos futuros', bloques: [
        { tipo: 'tarjetas', tarjetas: [
          { etiqueta: 'Pagos del período', valor: entero(numero(cobranza.cantidadPagos) ?? pagos.length) },
          { etiqueta: 'Cumplimiento CLP', valor: porcentaje(numero(cumplimiento.find(item => item.moneda === 'CLP')?.cumplimientoPorcentual)) },
          { etiqueta: 'Pagos de mora recuperada', valor: entero(pagosRecuperados.length) },
          { etiqueta: 'Compromisos futuros', valor: entero(futuros.length) },
        ] },
        tabla('Pagos recientes', [{ clave: 'cliente', etiqueta: 'Cliente', ancho: 215 }, { clave: 'fecha', etiqueta: 'Fecha', ancho: 85 }, { clave: 'monto', etiqueta: 'Monto', ancho: 211, alinear: 'derecha' }], pagos.slice(0, 8).map(item => ({ cliente: textoHumano(item.cliente), fecha: fechaHumana(item.fecha), monto: moneda(numero(item.monto), String(item.moneda || 'CLP')) }))),
        tabla('Próximos compromisos', [{ clave: 'cliente', etiqueta: 'Cliente', ancho: 215 }, { clave: 'fecha', etiqueta: 'Vencimiento', ancho: 85 }, { clave: 'monto', etiqueta: 'Saldo', ancho: 211, alinear: 'derecha' }], futuros.slice(0, 6).map(item => ({ cliente: textoHumano(item.cliente), fecha: fechaHumana(item.fechaVencimiento), monto: moneda(numero(item.saldo), String(item.moneda || 'CLP')) }))),
      ] });
    } else {
      const proveedores = listaFlexible(datos.proveedores).sort((a, b) => Number(b.saldo) - Number(a.saldo));
      const estados = lista(valorIndicador(datos.estados));
      paginas.push({ titulo: 'Cuentas por Pagar', subtitulo: 'Obligaciones con proveedores al corte', bloques: [
        { tipo: 'tarjetas', tarjetas: [
          { etiqueta: 'Saldo por pagar', valor: moneda(saldo) },
          { etiqueta: 'Obligaciones abiertas', valor: entero(cartera.length) },
          { etiqueta: 'Obligaciones vencidas', valor: entero(vencidas.length), tono: vencidas.length ? 'rechazado' : 'neutro' },
          { etiqueta: 'Compromisos futuros', valor: entero(futuros.length) },
        ] },
        { tipo: 'notas', titulo: 'Alcance', lineas: ['El saldo corresponde a obligaciones vigentes del módulo de Proveedores.', 'La antigüedad se informa en días exactos; las categorías no disponibles no se reemplazan por una clasificación inventada.'] },
      ] });
      paginas.push({ titulo: 'Vencimientos y antigüedad', subtitulo: 'Principales obligaciones abiertas', bloques: [
        tabla('Obligaciones con proveedores', [{ clave: 'proveedor', etiqueta: 'Proveedor', ancho: 180 }, { clave: 'vencimiento', etiqueta: 'Vencimiento', ancho: 78 }, { clave: 'dias', etiqueta: 'Días', ancho: 42, alinear: 'derecha' }, { clave: 'estado', etiqueta: 'Estado', ancho: 72 }, { clave: 'saldo', etiqueta: 'Saldo', ancho: 139, alinear: 'derecha' }], [...cartera].sort((a, b) => Number(b.saldo) - Number(a.saldo)).slice(0, 12).map(item => ({ proveedor: textoHumano(item.proveedor), vencimiento: fechaHumana(item.fechaVencimiento), dias: item.diasAtraso === null ? '—' : entero(numero(item.diasAtraso)), estado: fraseHumana(item.condicion), saldo: moneda(numero(item.saldo), String(item.moneda || 'CLP')) })), 'Se muestran hasta doce obligaciones principales; consulte el Dashboard para el detalle completo.'),
        { tipo: 'barras', titulo: 'Saldos por proveedor', filas: proveedores.filter(item => String(item.moneda || 'CLP') === 'CLP').slice(0, 8).map(item => ({ etiqueta: textoHumano(item.proveedor), valor: Number(item.saldo || 0), detalle: moneda(numero(item.saldo)) })), formato: 'moneda', maximoFilas: 8 },
      ] });
      paginas.push({ titulo: 'Estados y compromisos', subtitulo: 'Composición y próximos vencimientos', bloques: [
        { tipo: 'barras', titulo: 'Obligaciones por estado', filas: estados.map(item => ({ etiqueta: fraseHumana(item.estado), valor: Number(item.cantidad || 0), detalle: entero(numero(item.cantidad)) })), formato: 'numero' },
        ...(estados.some(item => textoHumano(item.estado).toLocaleLowerCase('es-CL') === 'sin clasificación') ? [{ tipo: 'notas' as const, lineas: ['Estado no clasificado por la fuente de origen.'] }] : []),
        tabla('Compromisos futuros con proveedores', [{ clave: 'proveedor', etiqueta: 'Proveedor', ancho: 220 }, { clave: 'fecha', etiqueta: 'Vencimiento', ancho: 90 }, { clave: 'monto', etiqueta: 'Saldo', ancho: 201, alinear: 'derecha' }], futuros.slice(0, 10).map(item => ({ proveedor: textoHumano(item.proveedor), fecha: fechaHumana(item.fechaVencimiento), monto: moneda(numero(item.saldo), String(item.moneda || 'CLP')) })), 'Se muestran compromisos con fecha y saldo disponibles.'),
      ] });
    }
  } else if (origen === 'liquidez') {
    const meses = lista(historico.meses).slice(-12), categorias = meses.map(item => mesHumano(String(item.periodo)));
    const valor = indicador(datos.flujoHistorico), serie = lista(valor.serie), totales = lista(valor.totales), totalClp = totales.find(item => item.moneda === 'CLP') || {};
    const liquidezActual = lista(valorIndicador(datos.liquidezActual)).find(item => item.moneda === 'CLP') || {};
    const movimientos = lista(valor.movimientos).sort((a, b) => Math.abs(Number(b.monto)) - Math.abs(Number(a.monto)));
    const proyeccion = indicador(datos.proyeccion), eventos = lista(proyeccion.eventos).filter(item => item.moneda === 'CLP');
    const ingresos = lista(proyeccion.ingresos).filter(item => String(item.moneda || 'CLP') === 'CLP');
    const egresos = lista(proyeccion.egresos).filter(item => String(item.moneda || 'CLP') === 'CLP');
    const saldoFinal = lista(proyeccion.saldosFinales).find(item => item.moneda === 'CLP');
    const eventosAgrupados = agruparEventosProyeccion(eventos);
    const resumenProyeccion = resumirProyeccionClp(eventos, ingresos, egresos, saldoFinal || {});
    // MIDAS: esta posición nace de movimientos registrados; no se presenta como saldo bancario.
    const posicionAcumulada = numero(liquidezActual.liquidez) ?? resumenProyeccion.base;
    paginas.push({ titulo: 'Liquidez y Flujo', subtitulo: 'Movimientos realizados y posición acumulada calculada', bloques: [
      { tipo: 'tarjetas', tarjetas: [
        { etiqueta: 'Posición acumulada', valor: moneda(posicionAcumulada) },
        { etiqueta: 'Ingresos del período', valor: moneda(numero(totalClp.ingresosRecibidos)) },
        { etiqueta: 'Egresos del período', valor: moneda(numero(totalClp.egresosRealizados)) },
        { etiqueta: 'Flujo neto', valor: moneda(numero(totalClp.flujoNeto)), tono: numero(totalClp.flujoNeto) !== null && Number(totalClp.flujoNeto) < 0 ? 'fallido' : 'exitoso' },
      ] },
      { tipo: 'notas', titulo: 'Alcance', lineas: ['La posición acumulada corresponde a entradas efectivas y ajustes positivos menos salidas efectivas y ajustes negativos registrados.', 'Caja Chica permanece excluida conforme al contrato vigente.', 'Esta posición calculada no representa ni reemplaza un saldo bancario.'] },
    ] });
    paginas.push({ titulo: 'Flujo de caja - últimos 12 meses', subtitulo: 'Ingresos, egresos y flujo neto realizados', bloques: [
      grafico('Flujo de caja - últimos 12 meses', categorias, [{ etiqueta: 'Ingresos', valores: meses.map(item => numero(item.ingresosRecibidos)), color: 'naranja' }, { etiqueta: 'Egresos', valores: meses.map(item => numero(item.egresosRealizados)), color: 'gris' }, { etiqueta: 'Flujo neto', valores: meses.map(item => numero(item.flujoNeto)), color: 'negro', estilo: 'linea' }], 'moneda', 300),
      tabla('Movimientos principales', [{ clave: 'fecha', etiqueta: 'Fecha', ancho: 80 }, { clave: 'categoria', etiqueta: 'Categoría', ancho: 190 }, { clave: 'naturaleza', etiqueta: 'Naturaleza', ancho: 80 }, { clave: 'monto', etiqueta: 'Monto', ancho: 161, alinear: 'derecha' }], movimientos.slice(0, 10).map(item => ({ fecha: fechaHumana(item.fecha), categoria: fraseHumana(item.categoria), naturaleza: fraseHumana(item.naturaleza), monto: moneda(numero(item.monto), String(item.moneda || 'CLP')) })), 'Se muestran los movimientos de mayor monto absoluto del período.'),
    ] });
    paginas.push({ titulo: 'Proyección de posición', subtitulo: 'Compromisos reales dentro del horizonte disponible', bloques: [
      { tipo: 'tarjetas', tarjetas: [
        { etiqueta: 'Horizonte', valor: `${entero(numero(proyeccion.horizonteDias))} días` },
        { etiqueta: 'Cobros esperados', valor: moneda(resumenProyeccion.cobros) },
        { etiqueta: 'Pagos esperados', valor: moneda(resumenProyeccion.pagos) },
        { etiqueta: 'Posición proyectada final', valor: moneda(resumenProyeccion.final), tono: resumenProyeccion.final !== null && resumenProyeccion.final < 0 ? 'fallido' : 'neutro' },
      ] },
      { tipo: 'notas', lineas: [`Base de proyección: posición acumulada calculada a partir de movimientos registrados (${moneda(resumenProyeccion.base)}).`, `${moneda(resumenProyeccion.base)} + ${moneda(resumenProyeccion.cobros)} - ${moneda(resumenProyeccion.pagos)} = ${moneda(resumenProyeccion.final)}.`] },
      grafico('Posición proyectada por fecha', eventosAgrupados.map(item => fechaHumana(item.fecha)), [{ etiqueta: 'Posición proyectada', valores: eventosAgrupados.map(item => item.liquidezProyectada), color: 'naranja', estilo: 'linea' }], 'moneda', 200, 'Los eventos se agrupan visualmente por fecha; el cálculo financiero conserva cada compromiso individual.'),
      tabla('Próximos eventos', [{ clave: 'fecha', etiqueta: 'Fecha', ancho: 85 }, { clave: 'direccion', etiqueta: 'Dirección', ancho: 85 }, { clave: 'monto', etiqueta: 'Monto', ancho: 150, alinear: 'derecha' }, { clave: 'saldo', etiqueta: 'Posición proyectada', ancho: 191, alinear: 'derecha' }], eventos.filter(item => item.direccion !== 'SALDO_INICIAL').slice(0, 8).map(item => ({ fecha: fechaHumana(item.fecha), direccion: fraseHumana(item.direccion), monto: moneda(numero(item.cambio)), saldo: moneda(numero(item.liquidezProyectada)) }))),
    ] });
  } else if (origen === 'margen') {
    const proyectos = lista(datos.proyectos).sort((a, b) => Number(b.ingresosAtribuibles || 0) - Number(a.ingresosAtribuibles || 0)).slice(0, 10);
    paginas.push(encabezado([{ etiqueta: 'Proyectos analizados', valor: entero(proyectos.length) }, { etiqueta: 'Con margen disponible', valor: entero(proyectos.filter(item => numero(item.margenDirecto) !== null).length) }], ['Sólo se consideran ingresos y costos con atribución inequívoca al proyecto.']));
    paginas.push({ titulo: 'Margen directo por proyecto', bloques: [tabla('Proyectos principales', [{ clave: 'proyecto', etiqueta: 'Proyecto', ancho: 190 }, { clave: 'ingresos', etiqueta: 'Ingresos', ancho: 100, alinear: 'derecha' }, { clave: 'costos', etiqueta: 'Costos', ancho: 100, alinear: 'derecha' }, { clave: 'margen', etiqueta: 'Margen', ancho: 70, alinear: 'derecha' }, { clave: 'porcentaje', etiqueta: '%', ancho: 51, alinear: 'derecha' }], proyectos.map(item => ({ proyecto: textoHumano(item.nombre || item.codigo), ingresos: moneda(numero(item.ingresosAtribuibles)), costos: moneda(numero(item.costosDirectosAtribuibles)), margen: moneda(numero(item.margenDirecto)), porcentaje: porcentaje(numero(item.porcentajeMargen)) }))) ] });
  } else if (origen === 'resultados') {
    const resultado = lista(valorIndicador(datos.resultadoGerencial))[0] || {};
    paginas.push(encabezado([{ etiqueta: 'Ingresos', valor: moneda(numero(resultado.ingresos)) }, { etiqueta: 'Costos atribuibles', valor: moneda(numero(resultado.costosDirectos)) }, { etiqueta: 'Resultado gerencial', valor: moneda(numero(resultado.resultadoGerencial)), tono: numero(resultado.resultadoGerencial)! < 0 ? 'fallido' : 'exitoso' }], ['Ventas netas menos costos directos atribuibles. No constituye un Estado de Resultados contable formal.', 'Las partidas no reconstruibles no se reemplazan por cero.']));
  } else {
    const cxc = montoIndicador(datos.cuentasPorCobrar), cxp = montoIndicador(datos.cuentasPorPagar);
    paginas.push(encabezado([{ etiqueta: 'Cuentas por cobrar', valor: moneda(cxc) }, { etiqueta: 'Cuentas por pagar', valor: moneda(cxp) }, { etiqueta: 'Disponibilidades', valor: 'No disponible' }], ['Síntesis gerencial de saldos reconstruibles; no corresponde a un balance contable formal.', 'Las disponibilidades sólo se muestran cuando existe una fuente inequívoca.']));
  }
  return paginas;
};

export function crearInformeDashboardM7(entrada: EntradaInformeM7) {
  const paginas = entrada.origen === 'panel' ? paginasPanel(entrada.panel, entrada.historico) : paginasContextuales(entrada.origen, entrada.tituloContextual, entrada.datos, entrada.historico);
  const documento: DocumentoGerencialPdf = {
    titulo: 'Informe Financiero Gerencial', subtitulo: 'Puertas Blindadas - Dashboard Financiero', generado: fechaHora(entrada.generadoEn),
    periodo: `${entrada.periodo.etiquetaDesde} a ${entrada.periodo.etiquetaHasta}`, filtros: entrada.filtros, moneda: 'CLP', paginas,
    pie: 'Documento generado por el Sistema Financiero Puertas Blindadas',
  };
  return archivoPdfGerencial(`dashboard-${entrada.origen}-${entrada.periodo.etiquetaDesde}-${entrada.periodo.etiquetaHasta}.pdf`, documento);
}
