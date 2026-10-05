const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M7Controller } = require('../dist/controladores/M7Controller');

const modulo = new M7Controller();
const ids = { clientes: [], fichas: [], notas: [], pagos: [], proveedores: [], documentos: [], obligaciones: [], movimientos: [], origenes: [] };
let cliente; let notaFutura; let proveedor; let obligacionFutura; let obligacionVencida;

async function preparar() {
  if (cliente) return;
  const [tipoCliente, moneda, medio, tipoId, pais, tipoDoc, usuario] = await Promise.all([
    prisma.tipo_cliente_financiero.findFirstOrThrow({ where: { estado_tipo_cliente_financiero: 'activo' } }),
    prisma.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } }),
    prisma.medio_pago.findFirstOrThrow({ where: { estado_medio_pago: 'activo' } }),
    prisma.tipo_identificador.findFirstOrThrow({ where: { estado_tipo_identificador: 'activo' } }),
    prisma.pais.findFirstOrThrow({ where: { estado_pais: 'activo' } }),
    prisma.tipo_documento.findFirstOrThrow({ where: { aplica_compra: true } }),
    prisma.usuario.findFirstOrThrow(),
  ]);
  const marca = randomUUID().slice(0, 8);
  cliente = await prisma.cliente_financiero.create({ data: { id_tipo_cliente_financiero: tipoCliente.id_tipo_cliente_financiero, rut_cliente: `CI${marca}`.slice(0, 15), nombre_razon_social_referencia: `Cliente cierre ${marca}`, estado_financiero: 'activo', ficha_cliente: { create: {} } }, include: { ficha_cliente: true } });
  ids.clientes.push(cliente.id_cliente_financiero); ids.fichas.push(cliente.ficha_cliente.id_ficha_cliente);
  notaFutura = await prisma.nota_venta.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, numero_nota_venta: `CF-${randomUUID()}`, fecha_emision: new Date('2045-01-02'), fecha_vencimiento: new Date('2045-03-10'), monto_total: 300, monto_neto: 300, exento_iva: true, estado_nota_venta: 'confirmada', estado_pago: 'pendiente' } }); ids.notas.push(notaFutura.id_nota_venta);
  const liquidada = await prisma.nota_venta.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, numero_nota_venta: `CL-${randomUUID()}`, fecha_emision: new Date('2045-01-03'), fecha_vencimiento: new Date('2045-03-01'), monto_total: 100, monto_neto: 100, exento_iva: true, estado_nota_venta: 'confirmada', estado_pago: 'pagada' } }); ids.notas.push(liquidada.id_nota_venta);
  const pago = await prisma.pago_cliente.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, id_medio_pago: medio.id_medio_pago, fecha_pago: new Date('2045-01-05'), monto_pago: 100, asignacion_pago_cliente: { create: { id_nota_venta: liquidada.id_nota_venta, monto_asignado: 100 } } } }); ids.pagos.push(pago.id_pago_cliente);
  proveedor = await prisma.proveedor.create({ data: { id_pais: pais.id_pais, id_tipo_identificador: tipoId.id_tipo_identificador, identificador_tributario: `PC-${randomUUID()}`, nombre_razon_social: `Proveedor cierre ${marca}` } }); ids.proveedores.push(proveedor.id_proveedor);
  const crearObligacion = async (fecha, saldo, estado) => {
    const documento = await prisma.documento_proveedor_m5.create({ data: { id_proveedor: proveedor.id_proveedor, clase: 'definitivo', id_tipo_documento: tipoDoc.id_tipo_documento, folio: randomUUID(), folio_normalizado: randomUUID(), fecha_emision: new Date('2045-01-01'), id_moneda: moneda.id_moneda, monto_total: saldo || 90, estado: 'confirmado', creado_por: usuario.usuario_id_usuario } }); ids.documentos.push(documento.id_documento_m5);
    const obligacion = await prisma.obligacion_proveedor_m5.create({ data: { id_documento_m5: documento.id_documento_m5, id_proveedor: proveedor.id_proveedor, monto_original: saldo || 90, id_moneda: moneda.id_moneda, saldo_inicial: saldo || 90, saldo_actual: saldo, fecha_emision: new Date('2045-01-01'), fecha_vencimiento: fecha, estado_pago: estado, generado_por: usuario.usuario_id_usuario } }); ids.obligaciones.push(obligacion.id_obligacion_m5); return obligacion;
  };
  obligacionFutura = await crearObligacion(new Date('2045-04-01'), 200, 'Pendiente');
  obligacionVencida = await crearObligacion(new Date('2020-01-01'), 80, 'Pendiente');
  await crearObligacion(new Date('2045-05-01'), 0, 'Pagada');
  const crearMovimiento = async (fecha, naturaleza, monto, categoria, conOrigen = false) => {
    const movimiento = await prisma.movimiento_financiero.create({ data: { id_moneda: moneda.id_moneda, fecha_movimiento: fecha, tipo_movimiento_financiero: categoria, naturaleza_movimiento: naturaleza, monto_movimiento: monto } }); ids.movimientos.push(movimiento.id_movimiento_financiero);
    if (conOrigen) { const origen = await prisma.origen_movimiento_financiero.create({ data: { id_movimiento_financiero: movimiento.id_movimiento_financiero, entidad_origen: 'pago_cliente', id_registro_origen: pago.id_pago_cliente, descripcion_origen: 'Pago de prueba' } }); ids.origenes.push(origen.id_origen_movimiento_financiero); }
  };
  await crearMovimiento(new Date('2044-12-10'), 'ingreso', 50, 'categoria_cierre');
  await crearMovimiento(new Date('2045-01-06'), 'ingreso', 120, 'categoria_cierre', true);
  await crearMovimiento(new Date('2045-01-07'), 'egreso', 20, 'categoria_cierre');
}

after(async () => {
  await prisma.origen_movimiento_financiero.deleteMany({ where: { id_origen_movimiento_financiero: { in: ids.origenes } } });
  await prisma.movimiento_financiero.deleteMany({ where: { id_movimiento_financiero: { in: ids.movimientos } } });
  await prisma.obligacion_proveedor_m5.deleteMany({ where: { id_obligacion_m5: { in: ids.obligaciones } } });
  await prisma.documento_proveedor_m5.deleteMany({ where: { id_documento_m5: { in: ids.documentos } } });
  await prisma.proveedor.deleteMany({ where: { id_proveedor: { in: ids.proveedores } } });
  await prisma.asignacion_pago_cliente.deleteMany({ where: { id_pago_cliente: { in: ids.pagos } } }); await prisma.pago_cliente.deleteMany({ where: { id_pago_cliente: { in: ids.pagos } } });
  await prisma.nota_venta.deleteMany({ where: { id_nota_venta: { in: ids.notas } } }); await prisma.ficha_cliente.deleteMany({ where: { id_ficha_cliente: { in: ids.fichas } } }); await prisma.cliente_financiero.deleteMany({ where: { id_cliente_financiero: { in: ids.clientes } } }); await prisma.$disconnect();
});

test('M7 cierre de hallazgos CU225 CU226 CU227 CU230 CU231 CU232 y navegación', async t => {
  await preparar(); const consulta = { anio: 2045, mes: 1 };
  const cxc = await modulo.consultarCuentasCobrar({ ...consulta, ordenar: 'vencimiento' }, ['CU225', 'CU09']);
  await t.test('01 CU225 lista futuros ordenados por vencimiento', () => assert.equal(cxc.compromisosFuturos.valor[0].idNota, notaFutura.id_nota_venta));
  await t.test('02 CU225 excluye obligación liquidada', () => assert.equal(cxc.compromisosFuturos.valor.some(f => f.estadoOwner === 'pagada'), false));
  await t.test('03 CU225 conserva estado owner', () => assert.equal(cxc.compromisosFuturos.valor[0].estadoOwner, 'pendiente'));
  await t.test('04 CU225 no presenta compromiso como cobro', () => assert.equal(cxc.compromisosFuturos.valor[0].naturaleza, 'COMPROMISO_FUTURO'));
  await t.test('05 CU225 navega a Cliente con CU09', () => assert.match(cxc.compromisosFuturos.valor[0].acciones[0].destino, /^\/clientes\//));
  await t.test('06 CU225 oculta navegación sin permiso owner', async () => { const r = await modulo.consultarCuentasCobrar(consulta, ['CU225']); assert.equal(Object.hasOwn(r.compromisosFuturos.valor[0], 'acciones'), false); assert.equal(Object.hasOwn(r.compromisosFuturos.valor[0], 'destinoCliente'), false); });

  const cxp = await modulo.consultarCuentasPagar({ ...consulta, ordenar: 'vencimiento' }, ['CU226', 'CU227', 'CU84', 'CU106']);
  await t.test('07 CU226 expone cartera vigente', () => assert.ok(cxp.cartera.valor.some(f => f.id === obligacionVencida.id_obligacion_m5)));
  await t.test('08 CU226 calcula atraso real', () => assert.ok(cxp.cartera.valor.find(f => f.id === obligacionVencida.id_obligacion_m5).diasAtraso > 0));
  await t.test('09 CU226 futura no es morosa', () => assert.equal(cxp.cartera.valor.find(f => f.id === obligacionFutura.id_obligacion_m5).diasAtraso, 0));
  await t.test('10 CU226 filtra por proveedor', async () => { const r = await modulo.consultarCuentasPagar({ ...consulta, idProveedor: proveedor.id_proveedor }, ['CU226']); assert.ok(r.cartera.valor.every(f => f.idProveedor === proveedor.id_proveedor)); });
  await t.test('11 CU226 ordena por monto', async () => { const r = await modulo.consultarCuentasPagar({ ...consulta, ordenar: 'monto', direccion: 'desc' }, ['CU226']); assert.ok(r.cartera.valor[0].saldo >= r.cartera.valor.at(-1).saldo); });
  await t.test('12 CU226 navega al owner permitido', () => assert.ok(cxp.cartera.valor.find(f => f.id === obligacionFutura.id_obligacion_m5).acciones.some(a => a.destino === `/proveedores/${proveedor.id_proveedor}`)));
  await t.test('13 CU227 ordena futuros', () => assert.equal(cxp.compromisosFuturos.valor[0].id, obligacionFutura.id_obligacion_m5));
  await t.test('14 CU227 excluye liquidada', () => assert.equal(cxp.compromisosFuturos.valor.some(f => /pagada/i.test(f.estadoPago)), false));
  await t.test('15 CU227 identifica compromiso, no pago', () => assert.equal(cxp.compromisosFuturos.valor[0].naturaleza, 'COMPROMISO_FUTURO'));
  await t.test('16 CxP oculta navegación sin permiso owner', async () => { const r = await modulo.consultarCuentasPagar(consulta, ['CU227']); assert.equal(Object.hasOwn(r.compromisosFuturos.valor[0], 'acciones'), false); });

  const flujo = await modulo.consultarLiquidez({ ...consulta, granularidad: 'dia' }, ['CU230', 'CU42']);
  await t.test('17 CU230 agrupa por día', () => assert.equal(flujo.flujoHistorico.valor.granularidad, 'dia'));
  await t.test('18 CU230 separa entradas y salidas', () => { const total = flujo.flujoHistorico.valor.totales.find(f => f.moneda === 'CLP'); assert.equal(total.ingresosRecibidos, 120); assert.equal(total.egresosRealizados, 20); });
  await t.test('19 CU230 calcula flujo neto', () => assert.equal(flujo.flujoHistorico.valor.totales.find(f => f.moneda === 'CLP').flujoNeto, 100));
  await t.test('20 CU230 compara período anterior', () => assert.equal(flujo.flujoHistorico.valor.comparacion.find(f => f.moneda === 'CLP').diferenciaAbsoluta, 50));
  await t.test('21 CU230 soporta semana', async () => { const r = await modulo.consultarLiquidez({ ...consulta, granularidad: 'semana' }, ['CU230']); assert.equal(r.flujoHistorico.valor.granularidad, 'semana'); });
  await t.test('22 CU230 base cero deja porcentaje N/A', async () => { const r = await modulo.consultarLiquidez({ ...consulta, origen: 'pago_cliente' }, ['CU230']); const comparacion = r.flujoHistorico.valor.comparacion[0]; assert.equal(comparacion.anterior, 0); assert.equal(comparacion.variacionPorcentual, null); assert.equal(comparacion.estadoVariacion, 'NO_APLICA'); });
  await t.test('23 CU230 filtra categoría real', async () => { const r = await modulo.consultarLiquidez({ ...consulta, categoria: 'categoria_cierre' }, ['CU230']); assert.equal(r.flujoHistorico.valor.movimientos.length, 2); });
  await t.test('24 CU230 filtra origen real', async () => { const r = await modulo.consultarLiquidez({ ...consulta, origen: 'pago_cliente' }, ['CU230']); assert.equal(r.flujoHistorico.valor.movimientos.length, 1); });
  await t.test('25 CU230 crea drill-down sólo con permiso owner', () => assert.equal(flujo.flujoHistorico.valor.movimientos.find(f => f.origenes.length).acciones[0].destino, '/pagos'));
  await t.test('26 CU230 oculta id y ruta sin permiso owner', async () => { const r = await modulo.consultarLiquidez({ ...consulta, origen: 'pago_cliente' }, ['CU230']); const m = r.flujoHistorico.valor.movimientos[0]; assert.equal(Object.hasOwn(m, 'acciones'), false); assert.equal(Object.hasOwn(m.origenes[0], 'id'), false); });

  const liquidez = await modulo.consultarLiquidez(consulta, ['CU231']);
  await t.test('27 CU231 parte de liquidez acumulada real', () => assert.ok(liquidez.proyeccion.valor.saldosFinales.length > 0));
  await t.test('28 CU231 separa compromisos y liquidez proyectada', () => assert.ok(liquidez.proyeccion.valor.eventos.length > 0));
  await t.test('29 CU231 no presenta compromisos futuros como realizados', () => assert.equal(liquidez.proyeccion.valor.eventos.some(f => Object.hasOwn(f, 'saldo')), false));
  const buscarParametrosOriginal = prisma.parametro_remuneracional.findMany;
  let riesgo;
  try {
    prisma.parametro_remuneracional.findMany = async () => [];
    riesgo = await modulo.consultarRiesgoDeficit(consulta, ['CU232']);
  } finally {
    prisma.parametro_remuneracional.findMany = buscarParametrosOriginal;
  }
  await t.test('30 CU232 productivo queda condicionado', () => { assert.equal(riesgo.estado, 'CONFIGURACION_PENDIENTE'); assert.equal(riesgo.primerDeficit.valor, null); });

  const componente = readFileSync(resolve('../Vistas/src/views/DashboardM7/componentes.tsx'), 'utf8');
  await t.test('31 frontend usa Link con destino autorizado', () => { assert.match(componente, /<Link[^>]+to=\{item\.destino\}/); assert.match(componente, /origenM7/); });
  await t.test('32 destino inexistente no genera enlace falso', () => assert.match(componente, /every\(esAccionNavegacion\)/));
  await t.test('33 test CU246 quedó renombrado', () => { assert.equal(existsSync(resolve('pruebas/m7-cu246.test.cjs')), true); assert.equal(existsSync(resolve('pruebas/m7-cu224.test.cjs')), false); });
  await t.test('34 no queda referencia activa al nombre CU224', () => assert.doesNotMatch(readFileSync(resolve('pruebas/m7-cu246.test.cjs'), 'utf8'), /M7 CU224/));
});
