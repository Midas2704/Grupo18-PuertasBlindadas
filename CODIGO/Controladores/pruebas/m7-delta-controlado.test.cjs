const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../dist/db');
const { M7Controller } = require('../dist/controladores/M7Controller');
const { operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

const fuente = ruta => readFileSync(resolve(ruta), 'utf8');
const consulta = { anio: 2026, mes: 10 };

test('M7 delta controlado CU218-CU258', async t => {
  await t.test('01 permisos nuevos permanecen independientes', () => {
    const esperados = { consultarExposicionCreditoM7: 'CU240', consultarAlertasCreditoM7: 'CU241', consultarResumenIvaM7: 'CU243', consultarCostosFabricacionM7: 'CU244', consultarBloqueosEconomicosM7: 'CU249', consultarMargenInstalacionesM7: 'CU251', consultarInventarioValorizadoM7: 'CU254', consultarMaterialesProyectoOtM7: 'CU255', consultarRiesgoStockM7: 'CU256', consultarRotacionInventarioM7: 'CU257', consultarComprasRecepcionesM7: 'CU258' };
    for (const [operacion, cu] of Object.entries(esperados)) { assert.equal(operacionesPermiso[operacion], cu); assert.equal(permiteOperacion(operacion, [cu]), true); }
    assert.equal(permiteOperacion('consultarRiesgoStockM7', ['CU255']), false);
  });

  await t.test('02 CU218 y CU224 exponen sólo su segmento', async () => {
    const modulo = new M7Controller();
    modulo.consultarAnalisisVentasCompleto = async () => ({ periodo: {}, estado: 'VALIDO', conversion: { estado: 'VALIDO', valor: 50 }, montoNeto: { estado: 'VALIDO', valor: 10 } });
    modulo.consultarCuentasCobrarCompleto = async () => ({ periodo: {}, estado: 'VALIDO', concentracionDeuda: { estado: 'VALIDO', valor: [] }, obligacionesPagadas: { estado: 'VALIDO', valor: [] }, recaudacion: { estado: 'VALIDO', valor: [] } });
    assert.deepEqual(Object.keys(await modulo.consultarAnalisisVentas({}, ['CU218'])).sort(), ['conversion', 'estado', 'periodo']);
    assert.deepEqual(Object.keys(await modulo.consultarCuentasCobrar({}, ['CU224'])).sort(), ['concentracionDeuda', 'estado', 'obligacionesPagadas', 'periodo']);
  });

  await t.test('03 conversión usa NV activa, excluye anulada y no depende de pagos', async () => {
    const originalNotas = prisma.nota_venta.findMany; const originalCotizaciones = prisma.cotizacion.findMany;
    prisma.nota_venta.findMany = async () => [];
    prisma.cotizacion.findMany = async () => [{ id_cotizacion: 1, nota_venta: { estado_nota_venta: 'confirmada', asignacion_pago_cliente: [] } }, { id_cotizacion: 2, nota_venta: { estado_nota_venta: 'anulada', asignacion_pago_cliente: [{ monto: 999 }] } }, { id_cotizacion: 3, nota_venta: null }];
    try { const r = await new M7Controller().consultarAnalisisVentas(consulta, ['CU218']); assert.deepEqual(r.conversion.valor, { totalCotizaciones: 3, convertidas: 1, tasaPorcentual: 33.33 }); }
    finally { prisma.nota_venta.findMany = originalNotas; prisma.cotizacion.findMany = originalCotizaciones; }
  });

  await t.test('04 denominador cero queda NO_APLICA', async () => {
    const originalNotas = prisma.nota_venta.findMany; const originalCotizaciones = prisma.cotizacion.findMany;
    prisma.nota_venta.findMany = async () => []; prisma.cotizacion.findMany = async () => [];
    try { const r = await new M7Controller().consultarAnalisisVentas(consulta, ['CU218']); assert.equal(r.conversion.estado, 'NO_APLICA'); assert.equal(r.conversion.valor.tasaPorcentual, null); }
    finally { prisma.nota_venta.findMany = originalNotas; prisma.cotizacion.findMany = originalCotizaciones; }
  });

  await t.test('05 liquidez acumula movimientos y excluye Caja Chica', async () => {
    const original = prisma.movimiento_financiero.findMany;
    const movimiento = (id, tipo, naturaleza, monto, origen = 'pago') => ({ id_movimiento_financiero: id, fecha_movimiento: new Date('2026-10-01T00:00:00Z'), estado_movimiento: 'confirmado', tipo_movimiento_financiero: tipo, naturaleza_movimiento: naturaleza, monto_movimiento: new Prisma.Decimal(monto), moneda: { codigo_moneda: 'CLP' }, origen_movimiento_financiero: [{ entidad_origen: origen, id_registro_origen: id, descripcion_origen: origen }] });
    prisma.movimiento_financiero.findMany = async () => [movimiento(1, 'PAGO_CLIENTE', 'ingreso', 100), movimiento(2, 'PAGO_PROVEEDOR', 'egreso', 20), movimiento(3, 'AJUSTE_MANUAL_LIQUIDEZ', 'ingreso', 30, 'ajuste_manual_liquidez'), movimiento(4, 'AJUSTE_MANUAL_LIQUIDEZ', 'egreso', 5, 'ajuste_manual_liquidez'), movimiento(5, 'CAJA CHICA', 'egreso', 999, 'gasto_caja_chica')];
    const modulo = new M7Controller(); modulo.consultarCuentasCobrarCompleto = async () => ({ cartera: { valor: [] } }); modulo.consultarCuentasPagarCompleto = async () => ({ cartera: { valor: [] } });
    try { const r = await modulo.consultarLiquidez(consulta); assert.equal(r.liquidezActual.valor[0].liquidez, 105); assert.deepEqual(r.flujoHistorico.valor.totales[0], { moneda: 'CLP', ingresosRecibidos: 100, egresosRealizados: 20, ajustesEntrada: 30, ajustesSalida: 5, liquidez: 105, flujoNeto: 105 }); assert.equal(r.proyeccion.valor.horizonteDias, 30); }
    finally { prisma.movimiento_financiero.findMany = original; }
  });

  await t.test('06 ajuste manual exige Administrador y justificación', async () => {
    const modulo = new M7Controller();
    await assert.rejects(modulo.registrarAjusteLiquidez({ naturaleza: 'entrada', monto: 1, idMoneda: 1, justificacion: 'x' }, { id: 1n, administrador: false }), error => error.estado === 403);
    await assert.rejects(modulo.registrarAjusteLiquidez({ naturaleza: 'entrada', monto: 1, idMoneda: 1 }, { id: 1n, administrador: true }), error => error.estado === 400);
  });

  await t.test('07 consumidor M8 entrega fixture sin recalcular crédito', async () => {
    const dato = { limiteGlobal: 1000, exposicionGlobalUtilizada: 400, capacidadGlobalDisponible: 600, clientes: [{ idCliente: 7, cupoDisponible: 50 }] };
    const modulo = new M7Controller({ consultarExposicion: async () => dato, consultarAlertas: async () => ({ suspendidos: [{ idCliente: 7 }], alertas: [] }) });
    assert.deepEqual((await modulo.consultarExposicionCreditoM7(consulta)).exposicion.valor, dato);
    assert.equal((await modulo.consultarAlertasCreditoM7(consulta)).estado, 'VALIDO');
  });

  await t.test('08 caída o ausencia M8 no devuelve cero falso', async () => {
    assert.equal((await new M7Controller().consultarExposicionCreditoM7(consulta)).estado, 'FUENTE_NO_DISPONIBLE');
    const caido = new M7Controller({ consultarExposicion: async () => { throw new Error('caído'); }, consultarAlertas: async () => { throw new Error('caído'); } });
    const r = await caido.consultarExposicionCreditoM7(consulta); assert.equal(r.estado, 'FUENTE_NO_DISPONIBLE'); assert.equal(Object.hasOwn(r, 'limiteGlobal'), false);
  });

  await t.test('09 bloqueos provienen exclusivamente del owner', async () => {
    const bloqueo = { id: 'B-1', estado: 'ACTIVO', fechaDesde: '2026-10-01', idProyecto: 2, owner: 'Terreno', contextoEconomico: { pendienteCobro: 10 } };
    const modulo = new M7Controller(undefined, { consultarBloqueos: async () => [bloqueo] });
    assert.deepEqual((await modulo.consultarBloqueosEconomicosM7(consulta)).bloqueos.valor, [bloqueo]);
    assert.equal((await new M7Controller().consultarBloqueosEconomicosM7(consulta)).estado, 'FUENTE_NO_DISPONIBLE');
  });

  await t.test('10 múltiples umbrales generan cruces en fechas distintas y conservan el mínimo', async () => {
    const modulo = new M7Controller();
    modulo.consultarLiquidezCompleto = async () => ({ periodo: {}, proyeccion: { estado: 'VALIDO', valor: { eventos: [{ fecha: '2026-10-01', moneda: 'CLP', liquidezProyectada: 6000000 }, { fecha: '2026-10-02', moneda: 'CLP', liquidezProyectada: 4000000 }, { fecha: '2026-10-03', moneda: 'CLP', liquidezProyectada: 1000000 }, { fecha: '2026-10-04', moneda: 'CLP', liquidezProyectada: -100000 }] } } });
    const original = prisma.parametro_remuneracional.findMany;
    prisma.parametro_remuneracional.findMany = async () => [5000000, 2000000, 0].map((valor, indice) => ({ id_parametro_remuneracional: indice + 1, nombre: `Umbral ${valor}`, valor }));
    try { const r = await modulo.consultarRiesgoDeficit(consulta, ['CU232']); assert.deepEqual(r.alertas.valor.map(item => item.primeraFechaCruce), ['2026-10-02', '2026-10-03', '2026-10-04']); assert.equal(r.minimoProyectado.valor[0].liquidezProyectada, -100000); }
    finally { prisma.parametro_remuneracional.findMany = original; }
  });

  await t.test('11 IVA estimado resta compras de ventas por moneda', async () => {
    const originalVentas = prisma.documento_tributario.findMany; const originalCompras = prisma.documento_compra_proveedor.findMany;
    prisma.documento_tributario.findMany = async () => [{ monto_impuesto: new Prisma.Decimal(190), moneda: { codigo_moneda: 'CLP' } }];
    prisma.documento_compra_proveedor.findMany = async () => [{ monto_impuesto: new Prisma.Decimal(76), moneda: { codigo_moneda: 'CLP' } }];
    try { const r = await new M7Controller().consultarResumenIva(consulta); assert.deepEqual(r.ivaEstimado, [{ moneda: 'CLP', ivaVentas: 190, ivaCompras: 76, ivaEstimado: 114 }]); assert.match(r.naturaleza, /estimado/i); }
    finally { prisma.documento_tributario.findMany = originalVentas; prisma.documento_compra_proveedor.findMany = originalCompras; }
  });

  await t.test('12 margen de instalación entrega agregados y comparación temporal geográfica', async () => {
    const modulo = new M7Controller(); const original = prisma.proyecto_financiero.findMany;
    modulo.consultarCostosFabricacion = async () => ({ periodo: {}, proyectos: [{ idProyecto: 1, desglose: { instalaciones: [{ idServicio: '10', fechaReal: '2026-10-10', region: 'Metropolitana', ciudad: 'Santiago', comuna: 'Santiago', costo: 200 }] } }, { idProyecto: 2, desglose: { instalaciones: [{ idServicio: '20', fechaReal: '2026-09-10', region: 'Valparaíso', ciudad: 'Valparaíso', comuna: 'Valparaíso', costo: 150 }] } }] });
    prisma.proyecto_financiero.findMany = async () => [{ id_proyecto_financiero: 1, nota_venta: { monto_neto: new Prisma.Decimal(500) } }, { id_proyecto_financiero: 2, nota_venta: { monto_neto: new Prisma.Decimal(400) } }];
    try { const r = await modulo.consultarMargenInstalaciones(consulta); assert.equal(r.agregados.margenAgregado, 300); assert.equal(r.comparacion.valor.diferenciaMargenAgregado, 50); assert.equal(r.geografia[0].comuna, 'Santiago'); }
    finally { prisma.proyecto_financiero.findMany = original; }
  });

  await t.test('13 inventario valorizado calcula stock por costo unitario y conserva cobertura', async () => {
    const originalStock = prisma.inventario_bodega.findMany; const originalPrecio = prisma.historial_precio_material.findMany;
    prisma.inventario_bodega.findMany = async () => [{ material_sku: 'MAT-1', inventario_bodega_cantidad_fisica: new Prisma.Decimal(3), bodega: { bodega_nombre_bodega: 'Central', bodega_direccion: 'Uno' }, material: { material_nombre_material: 'Acero', material_categoria_general: { material_categoria_general_nombre: 'Metal' } } }];
    prisma.historial_precio_material.findMany = async () => [{ material_sku: 'MAT-1', precio_unitario_convertido: new Prisma.Decimal(25), precio_unitario: new Prisma.Decimal(20) }];
    try { const r = await new M7Controller().consultarInventarioValorizado(consulta); assert.equal(r.valorTotal.valor, 75); assert.equal(r.inventario[0].valor, 75); }
    finally { prisma.inventario_bodega.findMany = originalStock; prisma.historial_precio_material.findMany = originalPrecio; }
  });

  await t.test('14 riesgo de stock distingue material suficiente y faltante sin score', async () => {
    const originales = [prisma.inventario_bodega.findMany, prisma.detalle_material_orden_compra_m5.findMany, prisma.material_orden_trabajo.findMany, prisma.reserva_inventario.findMany];
    prisma.inventario_bodega.findMany = async () => [{ material_sku: 'OK', inventario_bodega_cantidad_fisica: new Prisma.Decimal(5), inventario_bodega_cantidad_reservada: new Prisma.Decimal(0) }, { material_sku: 'FALTA', inventario_bodega_cantidad_fisica: new Prisma.Decimal(1), inventario_bodega_cantidad_reservada: new Prisma.Decimal(0) }];
    prisma.detalle_material_orden_compra_m5.findMany = async () => [{ material_sku: 'OK', cantidad_pedida: new Prisma.Decimal(5), cantidad_recibida: new Prisma.Decimal(0), material: { material_nombre_material: 'Material OK' }, orden_compra: {} }];
    prisma.material_orden_trabajo.findMany = async () => [{ material_sku: 'OK', orden_trabajo_id_orden: 1n, material_orden_trabajo_consumo_estimado: new Prisma.Decimal(8), material_orden_trabajo_consumo_real: new Prisma.Decimal(0), material: { material_nombre_material: 'Material OK' }, orden_trabajo: { orden_trabajo_estado: 'en_progreso' } }, { material_sku: 'FALTA', orden_trabajo_id_orden: 2n, material_orden_trabajo_consumo_estimado: new Prisma.Decimal(4), material_orden_trabajo_consumo_real: new Prisma.Decimal(0), material: { material_nombre_material: 'Material Falta' }, orden_trabajo: { orden_trabajo_estado: 'en_progreso' } }];
    prisma.reserva_inventario.findMany = async () => [];
    try { const r = await new M7Controller().consultarRiesgoStock(consulta); assert.equal(r.materiales.find(item => item.sku === 'OK').riesgo, false); assert.equal(r.materiales.find(item => item.sku === 'FALTA').faltante, 3); assert.equal(Object.hasOwn(r.materiales[0], 'score'), false); }
    finally { [prisma.inventario_bodega.findMany, prisma.detalle_material_orden_compra_m5.findMany, prisma.material_orden_trabajo.findMany, prisma.reserva_inventario.findMany] = originales; }
  });

  await t.test('15 recepciones futuras calculan cantidad pendiente y fecha esperada', async () => {
    const original = prisma.detalle_material_orden_compra_m5.findMany;
    prisma.detalle_material_orden_compra_m5.findMany = async () => [{ id_detalle_material_oc_m5: 1n, id_ocs_m5: 7, material_sku: 'MAT-1', cantidad_pedida: new Prisma.Decimal(10), cantidad_recibida: new Prisma.Decimal(4), fecha_esperada: new Date('2026-10-20T00:00:00Z'), material: { material_nombre_material: 'Acero' }, orden_compra: { proveedor: { nombre_razon_social: 'Proveedor' }, fecha_esperada_recepcion: null, id_ficha_cliente_contexto: null, id_cotizacion_contexto: null, id_proyecto_financiero_contexto: 3, id_orden_trabajo_contexto: 9n } }];
    try { const r = await new M7Controller().consultarComprasRecepciones(consulta); assert.equal(r.ordenesPendientes[0].cantidadPendiente, 6); assert.equal(r.ordenesPendientes[0].fechaEsperada, '2026-10-20'); assert.equal(r.ordenesPendientes[0].idOrden, '9'); }
    finally { prisma.detalle_material_orden_compra_m5.findMany = original; }
  });

  await t.test('16 caída de Inventario y Compras conserva estado de fuente no disponible', async () => {
    const originales = [prisma.inventario_bodega.findMany, prisma.material_orden_trabajo.findMany, prisma.parametro_remuneracional.findFirst, prisma.detalle_material_orden_compra_m5.findMany];
    const caida = async () => { throw new Error('fuente caída'); };
    prisma.inventario_bodega.findMany = caida; prisma.material_orden_trabajo.findMany = caida; prisma.parametro_remuneracional.findFirst = caida; prisma.detalle_material_orden_compra_m5.findMany = caida;
    try {
      const modulo = new M7Controller();
      for (const respuesta of [await modulo.consultarInventarioValorizado(consulta), await modulo.consultarMaterialesProyectoOt(consulta), await modulo.consultarRiesgoStock(consulta), await modulo.consultarRotacionInventario(consulta), await modulo.consultarComprasRecepciones(consulta)]) assert.equal(respuesta.estado, 'FUENTE_NO_DISPONIBLE');
      const componente = fuente('../Vistas/src/views/DashboardM7/componentes.tsx'); assert.match(componente, /datos\.estado === 'FUENTE_NO_DISPONIBLE'/); assert.match(componente, /fuente de información no está disponible/i);
    } finally { [prisma.inventario_bodega.findMany, prisma.material_orden_trabajo.findMany, prisma.parametro_remuneracional.findFirst, prisma.detalle_material_orden_compra_m5.findMany] = originales; }
  });

  await t.test('17 migración 041 es aditiva y mantiene vínculos opcionales', () => {
    const sql = fuente('prisma/migrations/041_m7_delta_controlado/migration.sql');
    assert.match(sql, /id_ficha_cliente_contexto/); assert.match(sql, /id_cotizacion_contexto/); assert.match(sql, /id_proyecto_financiero_contexto/); assert.match(sql, /id_orden_trabajo_contexto/); assert.match(sql, /cantidad_pedida/); assert.match(sql, /cantidad_recibida/); assert.doesNotMatch(sql, /DROP\s+(?:TABLE|COLUMN)/i);
  });

  await t.test('18 parámetros se mantienen en el Mantenedor existente', () => {
    const esquema = fuente('prisma/schema.prisma'); assert.match(esquema, /parametro_remuneracional/); assert.doesNotMatch(esquema, /model\s+dashboard_/i);
    assert.equal(operacionesPermiso.configurarParametroLiquidezM7, 'CU232'); assert.equal(operacionesPermiso.configurarCostoInstalacionM7, 'CU244'); assert.equal(operacionesPermiso.configurarParametroStockInmovilM7, 'CU257');
  });

  await t.test('19 inventario y compras son consultas de sólo lectura en M7', () => {
    const controlador = fuente('src/controladores/M7Controller.ts'); const bloque = controlador.slice(controlador.indexOf('async consultarInventarioValorizado'), controlador.indexOf('async consultarResumenResultados'));
    assert.doesNotMatch(bloque, /\.(?:create|update|delete|upsert)\s*\(/); assert.match(bloque, /cantidad_pedida\.minus\(item\.cantidad_recibida\)/);
  });

  await t.test('20 Cotización muestra advertencia sin bloquear aprobación', () => {
    const backend = fuente('src/controladores/M2Controller.ts'); const vista = fuente('../Vistas/src/views/BandejaAprobacion/BandejaAprobacionGerencia.tsx');
    assert.match(backend, /advertenciaStock/); assert.match(backend, /bloqueaAprobacion:\s*false/); assert.match(vista, /Revisar stock/);
  });

  await t.test('21 Ficha Cliente omite cero días de atraso', () => {
    const backend = fuente('src/controladores/M1Controller.ts'); const vista = fuente('../Vistas/src/components/ModalDetalleDocumento.tsx');
    assert.match(backend, /fechaPagoFinal\s*<=\s*nota\.fecha_vencimiento/); assert.match(vista, /diasAtrasoPagoFinal\)>0/);
  });

  await t.test('22 estados de fuente están renderizados de forma aislada', () => {
    const componentes = fuente('../Vistas/src/views/DashboardM7/componentes.tsx'); const delta = fuente('../Vistas/src/views/DashboardM7/DeltaControladoM7.tsx');
    assert.match(componentes, /FUENTE_NO_DISPONIBLE/); assert.match(componentes, /cargando/); assert.match(delta, /consultar|usarConsultaM7/);
  });

  await t.test('23 rutas y frontend cubren CU240-CU258', () => {
    const rutas = fuente('src/rutas/finanzas.ts'); const app = fuente('../Vistas/src/App.tsx');
    for (const fragmento of ['credito/exposicion', 'credito/alertas', 'tributario/iva', 'costos/fabricacion', 'operacion/bloqueos', 'inventario/valorizado', 'inventario/materiales-proyecto', 'inventario/riesgo-stock', 'inventario/rotacion', 'compras/recepciones']) assert.match(rutas, new RegExp(fragmento));
    assert.match(app, /DeltaControladoM7/);
  });

  await t.test('24 M7 no implementa CU259 ni resultados persistidos', () => {
    const conjunto = [fuente('src/controladores/M7Controller.ts'), fuente('src/validaciones/permisos.ts'), fuente('prisma/schema.prisma')].join('\n');
    assert.doesNotMatch(fuente('src/controladores/M7Controller.ts'), /CU259/); assert.doesNotMatch(conjunto, /model\s+dashboard_/i);
  });
});
