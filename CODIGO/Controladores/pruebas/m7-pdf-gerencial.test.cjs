const test = require('node:test');
const assert = require('node:assert/strict');
const { crearInformeDashboardM7, ordenarPagosRecientes, agruparEventosProyeccion, resumirCarteraConsolidable, resumirProyeccionClp } = require('../dist/m7/informeDashboardPdf');
const { equivalenteClpCxc } = require('../dist/controladores/M7Controller');

const decodificar = archivo => Buffer.from(archivo.contenido.split(',')[1], 'base64').toString('latin1');
const meses = Array.from({ length: 12 }, (_, indice) => ({
  periodo: `${indice < 2 ? 2025 : 2026}-${String(((indice + 10) % 12) + 1).padStart(2, '0')}`,
  ventasNetas: 8_000_000 + indice * 750_000, cantidadVentas: 8 + indice, cotizaciones: 14 + indice,
  convertidas: 8 + indice, conversionPorcentual: 55 + indice, ingresosRecibidos: 6_000_000 + indice * 500_000,
  egresosRealizados: 2_000_000 + indice * 120_000, flujoNeto: 4_000_000 + indice * 380_000,
  costoRemuneraciones: 12_000_000 + indice * 90_000, costosDirectos: 3_000_000 + indice * 200_000,
  resultadoGerencial: 5_000_000 + indice * 550_000, instalaciones: 2 + indice % 3, ordenesTrabajo: 3 + indice % 4, incidencias: indice % 2,
}));
const indicador = valor => ({ estado: 'VALIDO', valor, detalle: 'Fuente propietaria' });
const panel = { bloques: {
  cuentasCobrar: { saldo: indicador([{ moneda: 'CLP', monto: 12_000_000 }]) },
  cuentasPagar: { saldo: indicador([{ moneda: 'CLP', monto: 4_500_000 }]) },
  margenProyectos: { proyectos: [{ nombre: '2130 | Instalación especial', ingresosAtribuibles: 10_000_000, costosDirectosAtribuibles: 14_250_263, margenDirecto: -4_250_263, porcentajeMargen: -42.5, desgloseCostos: [{ origen: 'MATERIAL', moneda: 'CLP', monto: 5_000_000 }, { origen: 'M6_REMUNERACION_PRODUCTIVA', moneda: 'CLP', monto: 1_000_000 }] }] },
  exposicionCredito: { exposicion: indicador({ limiteGlobal: 18_000_000, exposicionUtilizada: 9_000_000, capacidadDisponible: 9_000_000, totalSolicitudes: 5, totalCompromisos: 4, clientesSobreLimite: [], clientesSuspendidos: [], concentracion: { clientes: [{ cliente: 'Constructora Horizonte', exposicion: 9_000_000, concentracion: 100 }] } }) },
  atrasosInstalaciones: { atrasos: indicador([]) },
  inventarioValorizado: { valorTotal: indicador(22_000_000) }, riesgoStock: { riesgos: [] }, rotacionInventario: { stockInmovil: indicador([]) },
  comprasRecepciones: { ordenesPendientes: [{ material: 'Cerradura multipunto', proveedor: 'Seguridad Austral', cantidadPedida: 10, cantidadRecibida: 4, cantidadPendiente: 6, fechaEsperada: '2026-10-06' }] }, centroAtencion: { excepciones: [{ familia: 'CUENTAS POR COBRAR', ocurrio: 'INSTALACIONES ATRASADAS' }] }, bloqueosEconomicos: {},
} };
const historico = { meses, principalesClientes: [{ cliente: 'Constructora Horizonte', monto: 55_000_000, participacionPorcentual: 35 }], moneda: 'CLP' };
const base = { periodo: { etiquetaDesde: '2026-10-01', etiquetaHasta: '2026-10-31' }, filtros: 'Año 2026, mes octubre', generadoEn: new Date('2026-10-03T15:00:00Z') };

test('M7 genera informe financiero gerencial visual y contextual', async t => {
  const panelPdf = crearInformeDashboardM7({ ...base, origen: 'panel', tituloContextual: 'Panel General', datos: panel, panel, historico });
  const pdf = decodificar(panelPdf);
  await t.test('panel contiene título, diez páginas y cuatro KPI principales', () => {
    assert.match(pdf, /Informe Financiero Gerencial/); assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, 10);
    for (const texto of ['Resultado gerencial', 'Cuentas por cobrar', 'Cuentas por pagar', 'Flujo neto del período']) assert.match(pdf, new RegExp(texto));
  });
  await t.test('incluye histórico, gráficos, tablas y alcance', () => {
    for (const texto of ['Ventas, costos y resultado - últimos 12 meses', 'Conversión de cotizaciones', 'Flujo de caja - últimos 12 meses', 'Principales clientes por ventas', 'Proyectos principales por ingresos', 'Costo laboral - últimos 12 meses', 'Crédito', 'Inventario y compras', 'Alcance del informe']) assert.match(pdf, new RegExp(texto));
    assert.match(pdf, /Cuentas por cobrar y pagar corresponden al saldo vigente/); assert.match(pdf, /Datos no disponibles no se reemplazan por cero/);
    assert.match(pdf, /Eje izquierdo: CLP/); assert.match(pdf, /Eje derecho: unidades/); assert.match(pdf, /Eje derecho: %/); assert.match(pdf, /06-10-2026/);
    assert.match(pdf, /03-10-2026/); assert.match(pdf, /Instalación especial/); assert.doesNotMatch(pdf, /2130 \|/); assert.match(pdf, /-\$4\.250\.263/);
    assert.match(pdf, /Cuentas por cobrar/); assert.match(pdf, /Instalaciones atrasadas/); assert.doesNotMatch(pdf, /CUENTAS POR COBRAR|INSTALACIONES ATRASADAS/);
  });
  await t.test('no expone volcado técnico ni fabrica serie histórica de cartera', () => {
    assert.doesNotMatch(pdf, /estado: VALIDO|bloques \/|detalle disponible en pantalla|resultadoGerencial:|cuentasCobrar:|NO_HISTORIZABLE|CU\d{3}/);
    assert.doesNotMatch(pdf, /BT \/F2 \d+(?:\.\d+)? Tf[^\n]*\(Estado de Resultados\) Tj/);
  });
  await t.test('paginación completa y consistente', () => {
    for (let pagina = 1; pagina <= 10; pagina++) assert.match(pdf, new RegExp(`Página ${pagina} de 10`));
    assert.equal((pdf.match(/Documento generado por el Sistema Financiero Puertas Blindadas/g) || []).length, 10);
  });
  await t.test('informe contextual de ventas usa doce meses y escalas independientes', () => {
    const datosVentas = { montoNeto: indicador({ porMoneda: [{ moneda: 'CLP', monto: 10_000_000 }] }), cantidad: indicador(12), ticketMedio: indicador({ porMoneda: [{ moneda: 'CLP', monto: 833_333 }] }), conversion: indicador({ tasaPorcentual: 60 }), clientes: [{ nombre: 'Constructora Horizonte', moneda: 'CLP', montoNeto: 4_000_000 }], evolucion: [{ nombre: '2026-10-01', moneda: 'CLP', montoNeto: 10_000_000 }] };
    const contextual = decodificar(crearInformeDashboardM7({ ...base, origen: 'ventas', tituloContextual: 'Análisis de Ventas', datos: datosVentas, historico }));
    assert.equal((contextual.match(/\/Type \/Page\b/g) || []).length, 4); assert.match(contextual, /Análisis de Ventas/); assert.match(contextual, /Ventas acumuladas 12 meses/); assert.match(contextual, /Principales clientes por ventas/);
    for (const mes of meses) assert.match(contextual, new RegExp(mes.periodo.slice(5) === '11' ? 'nov 25' : mes.periodo.slice(5) === '12' ? 'dic 25' : `${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct'][Number(mes.periodo.slice(5)) - 1]} 26`));
    assert.match(contextual, /Eje izquierdo: CLP/); assert.match(contextual, /Eje derecho: unidades/); assert.match(contextual, /Eje izquierdo: cantidad/); assert.match(contextual, /Eje derecho: %/);
    assert.match(contextual, /100%/); assert.match(contextual, /Constructora Horizonte/);
    assert.doesNotMatch(contextual, /Evolución del período|Detalle del mes de corte|estado: VALIDO|bloques \/|montoNeto:/);
  });
  await t.test('CxC presenta cartera, concentración y cobranza sin rangos inventados', () => {
    const indicadorLocal = valor => ({ estado: 'VALIDO', valor });
    const cartera = [
      { cliente: 'Constructora Horizonte', moneda: 'CLP', saldo: 2_500_000, equivalenteClp: 2_500_000, fechaVencimiento: '2026-09-15', diasAtraso: 18, condicion: 'VENCIDA' },
      { cliente: 'Comercial Los Robles', moneda: 'USD', saldo: 4_000, equivalenteClp: 3_600_000, fechaVencimiento: '2026-09-20', diasAtraso: 13, condicion: 'VENCIDA' },
      { cliente: 'Arquitectura Norte', moneda: 'EUR', saldo: 8_000, equivalenteClp: null, fechaVencimiento: '2026-09-25', diasAtraso: 8, condicion: 'VENCIDA' },
    ];
    const datos = { saldo: indicadorLocal([{ moneda: 'CLP', monto: 2_500_000 }, { moneda: 'USD', monto: 4_000 }, { moneda: 'EUR', monto: 8_000 }]), morosidad: indicadorLocal({ cantidad: 3, porMoneda: [], obligaciones: cartera }), cartera: indicadorLocal(cartera), recaudacion: indicadorLocal([{ moneda: 'CLP', monto: 900_000 }]), detalleCobranza: indicadorLocal({ cantidadPagos: 2, pagos: [{ cliente: 'Constructora Horizonte', fecha: '2026-10-03', moneda: 'CLP', monto: 900_000 }, { cliente: 'Comercial Los Robles', fecha: '2026-10-20', moneda: 'USD', monto: 700 }] }), cumplimiento: indicadorLocal([{ moneda: 'CLP', cumplimientoPorcentual: 72 }]), recuperacionMoraPrevia: indicadorLocal({ porMoneda: [{ moneda: 'CLP', monto: 300_000 }], pagos: [{ monto: 300_000 }] }), concentracionDeuda: indicadorLocal([]), compromisosFuturos: indicadorLocal([{ cliente: 'Arquitectura Norte', moneda: 'CLP', saldo: 450_000, fechaVencimiento: '2026-11-10' }]) };
    const pdfCxc = decodificar(crearInformeDashboardM7({ ...base, origen: 'cuentas-cobrar', tituloContextual: 'Cuentas por Cobrar y Cobranza', datos }));
    assert.equal((pdfCxc.match(/\/Type \/Page\b/g) || []).length, 3); assert.match(pdfCxc, /Antigüedad y concentración/); assert.match(pdfCxc, /Cobranza y compromisos/); assert.match(pdfCxc, /18/); assert.doesNotMatch(pdfCxc, /0-30|31-60|61-90/);
    const resumen = resumirCarteraConsolidable(cartera);
    assert.equal(resumen.totalClp, 6_100_000); assert.ok(resumen.concentracion.every(item => item.saldo <= resumen.totalClp));
    assert.equal(equivalenteClpCxc(15_371_767.88, 'EUR', 1_041.73), 16_013_231_753.63); assert.equal(equivalenteClpCxc(750, 'USD', null), null);
    assert.match(pdfCxc, /Saldo consolidable CLP/); assert.match(pdfCxc, /\$6\.100\.000/);
    assert.match(pdfCxc, /Saldos no consolidables/); assert.match(pdfCxc, /Sin conversión histórica válida/); assert.doesNotMatch(pdfCxc, /EUR 8\.000/);
    assert.match(pdfCxc, /Concentración de deuda consolidable/); assert.match(pdfCxc, /\$3\.600\.000/); assert.doesNotMatch(pdfCxc, /EUR 8\.000 ·/);
    assert.deepEqual(ordenarPagosRecientes([{ fecha: '2026-10-03' }, { fecha: '2026-10-20' }]).map(item => item.fecha), ['2026-10-20', '2026-10-03']);
  });
  await t.test('CxP presenta vencimientos, proveedores y compromisos reales', () => {
    const indicadorLocal = valor => ({ estado: 'VALIDO', valor });
    const cartera = [{ proveedor: 'Aceros Cordillera', moneda: 'CLP', saldo: 1_250_000, fechaVencimiento: '2026-09-20', diasAtraso: 13, condicion: 'VENCIDA' }];
    const datos = { saldo: indicadorLocal([{ moneda: 'CLP', monto: 1_250_000 }]), cartera: indicadorLocal(cartera), estados: indicadorLocal([{ estado: 'POR PAGAR', cantidad: 1 }, { estado: 'Sin clasificación', cantidad: 1 }]), proveedores: { 0: { proveedor: 'Aceros Cordillera', moneda: 'CLP', saldo: 1_250_000 } }, compromisosFuturos: indicadorLocal([{ proveedor: 'Metales del Pacífico', moneda: 'CLP', saldo: 380_000, fechaVencimiento: '2026-11-12' }]) };
    const pdfCxp = decodificar(crearInformeDashboardM7({ ...base, origen: 'cuentas-pagar', tituloContextual: 'Cuentas por Pagar', datos }));
    assert.equal((pdfCxp.match(/\/Type \/Page\b/g) || []).length, 3); assert.match(pdfCxp, /Vencimientos y antigüedad/); assert.match(pdfCxp, /Saldos por proveedor/); assert.match(pdfCxp, /Por pagar/); assert.match(pdfCxp, /20-09-2026/); assert.match(pdfCxp, /Estado no clasificado por la fuente de origen/);
  });
  await t.test('Liquidez presenta flujo y proyección sin fabricar saldo bancario', () => {
    const indicadorLocal = valor => ({ estado: 'VALIDO', valor });
    const datos = { liquidezActual: indicadorLocal([{ moneda: 'CLP', liquidez: 4_000_000 }]), flujoHistorico: indicadorLocal({ serie: [{ fecha: '2026-10-01', moneda: 'CLP', entradas: 2_000_000, salidas: 700_000, flujoNeto: 1_300_000 }], totales: [{ moneda: 'CLP', ingresosRecibidos: 2_000_000, egresosRealizados: 700_000, flujoNeto: 1_300_000 }], movimientos: [{ fecha: '2026-10-03', categoria: 'PAGO_CLIENTE', naturaleza: 'INGRESO', moneda: 'CLP', monto: 2_000_000 }] }), proyeccion: indicadorLocal({ horizonteDias: 30, ingresos: [{ moneda: 'CLP', monto: 600_000 }], egresos: [{ moneda: 'CLP', monto: 300_000 }], eventos: [{ fecha: '2026-10-03', moneda: 'CLP', direccion: 'SALDO_INICIAL', cambio: 0, liquidezProyectada: 4_000_000 }, { fecha: '2026-10-10', moneda: 'CLP', direccion: 'ENTRADA', cambio: 600_000, liquidezProyectada: 4_600_000 }, { fecha: '2026-10-10', moneda: 'CLP', direccion: 'SALIDA', cambio: -300_000, liquidezProyectada: 4_300_000 }], saldosFinales: [{ moneda: 'CLP', liquidez: 4_300_000 }] }) };
    const pdfLiquidez = decodificar(crearInformeDashboardM7({ ...base, origen: 'liquidez', tituloContextual: 'Liquidez y Flujo', datos, historico }));
    assert.equal((pdfLiquidez.match(/\/Type \/Page\b/g) || []).length, 3); assert.match(pdfLiquidez, /Flujo de caja - últimos 12 meses/); assert.match(pdfLiquidez, /Proyección de posición/); assert.match(pdfLiquidez, /Pago cliente/); assert.match(pdfLiquidez, /no representa ni reemplaza un saldo bancario/);
    for (const mes of meses) assert.match(pdfLiquidez, new RegExp(mes.periodo.slice(5) === '11' ? 'nov 25' : mes.periodo.slice(5) === '12' ? 'dic 25' : `${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct'][Number(mes.periodo.slice(5)) - 1]} 26`));
    assert.match(pdfLiquidez, /Posición acumulada/); assert.doesNotMatch(pdfLiquidez, /Liquidez disponible/);
    assert.match(pdfLiquidez, /Posición proyectada por fecha/); assert.match(pdfLiquidez, /\$4\.300\.000/); assert.match(pdfLiquidez, /Los eventos se agrupan visualmente por fecha/);
    assert.match(pdfLiquidez, /Base de proyección: posición acumulada calculada/); assert.match(pdfLiquidez, /no representa ni reemplaza un saldo bancario/);
    const agrupados = agruparEventosProyeccion(datos.proyeccion.valor.eventos);
    assert.equal(agrupados.length, 2); assert.deepEqual(agrupados[1], { fecha: '2026-10-10', cambio: 300_000, liquidezProyectada: 4_300_000 });
    assert.deepEqual(resumirProyeccionClp(datos.proyeccion.valor.eventos, datos.proyeccion.valor.ingresos, datos.proyeccion.valor.egresos, datos.proyeccion.valor.saldosFinales[0]), { base: 4_000_000, cobros: 600_000, pagos: 300_000, final: 4_300_000, calculado: 4_300_000, consistente: true });
  });
});
