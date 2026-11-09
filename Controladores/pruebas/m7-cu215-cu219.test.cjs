const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M7Controller, resolverPeriodoM7 } = require('../dist/controladores/M7Controller');
const { codigosTodosLosCU, matrizPermisosPorCU, moduloPermiso, operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

const modulo = new M7Controller();
const ids = { notas: [], pagos: [], clientes: [], fichas: [], proveedores: [], documentos: [], obligaciones: [], movimientos: [], categorias: [], asociaciones: [], clasificaciones: [] };
let cliente; let nota; let notaMorosa; let proveedor; let obligacion; let movimiento;

async function preparar() {
  if (cliente) return;
  const [tipoCliente, moneda, medio, tipoId, pais, tipoDoc, usuario] = await Promise.all([
    prisma.tipo_cliente_financiero.findFirstOrThrow({ where: { estado_tipo_cliente_financiero: 'activo' } }),
    prisma.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } }), prisma.medio_pago.findFirstOrThrow({ where: { estado_medio_pago: 'activo' } }),
    prisma.tipo_identificador.findFirstOrThrow({ where: { estado_tipo_identificador: 'activo' } }), prisma.pais.findFirstOrThrow({ where: { estado_pais: 'activo' } }),
    prisma.tipo_documento.findFirstOrThrow({ where: { aplica_compra: true } }), prisma.usuario.findFirstOrThrow(),
  ]);
  const marca = randomUUID().slice(0, 8);
  cliente = await prisma.cliente_financiero.create({ data: { id_tipo_cliente_financiero: tipoCliente.id_tipo_cliente_financiero, rut_cliente: `M7${marca}`.slice(0, 15), nombre_razon_social_referencia: `Cliente M7 ${marca}`, estado_financiero: 'activo', ficha_cliente: { create: {} } }, include: { ficha_cliente: true } });
  ids.clientes.push(cliente.id_cliente_financiero); ids.fichas.push(cliente.ficha_cliente.id_ficha_cliente);
  nota = await prisma.nota_venta.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, numero_nota_venta: `M7-${randomUUID()}`, fecha_emision: new Date('2040-05-10T00:00:00Z'), fecha_vencimiento: new Date('2040-07-10T00:00:00Z'), monto_neto: 100, monto_impuesto: 19, monto_total: 119, estado_nota_venta: 'confirmada' } }); ids.notas.push(nota.id_nota_venta);
  notaMorosa = await prisma.nota_venta.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, numero_nota_venta: `M7-M-${randomUUID()}`, fecha_emision: new Date('2040-05-11T00:00:00Z'), fecha_vencimiento: new Date('2020-01-01T00:00:00Z'), monto_neto: 50, monto_total: 50, exento_iva: true, estado_nota_venta: 'confirmada' } }); ids.notas.push(notaMorosa.id_nota_venta);
  for (const [indice, estado] of ['emitida', 'anulada', 'revertida_total'].entries()) { const creada = await prisma.nota_venta.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, numero_nota_venta: `M7-${indice}-${randomUUID().slice(0, 12)}`, fecha_emision: new Date('2040-05-12T00:00:00Z'), monto_neto: 999, monto_total: 999, exento_iva: true, estado_nota_venta: estado } }); ids.notas.push(creada.id_nota_venta); }
  const pago = await prisma.pago_cliente.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, id_medio_pago: medio.id_medio_pago, fecha_pago: new Date('2040-05-15T00:00:00Z'), monto_pago: 30, asignacion_pago_cliente: { create: { id_nota_venta: nota.id_nota_venta, monto_asignado: 30 } } } }); ids.pagos.push(pago.id_pago_cliente);
  proveedor = await prisma.proveedor.create({ data: { id_pais: pais.id_pais, id_tipo_identificador: tipoId.id_tipo_identificador, identificador_tributario: `M7-${randomUUID()}`, nombre_razon_social: `Proveedor M7 ${marca}`, tipo_proveedor_m5: 'Servicios' } }); ids.proveedores.push(proveedor.id_proveedor);
  const documento = await prisma.documento_proveedor_m5.create({ data: { id_proveedor: proveedor.id_proveedor, clase: 'definitivo', id_tipo_documento: tipoDoc.id_tipo_documento, folio: `M7-${randomUUID()}`, folio_normalizado: `M7-${randomUUID()}`, fecha_emision: new Date('2040-05-01T00:00:00Z'), id_moneda: moneda.id_moneda, monto_total: 80, estado: 'confirmado', creado_por: usuario.usuario_id_usuario } }); ids.documentos.push(documento.id_documento_m5);
  const nombreCategoria = `Servicios M7 ${marca}`; const categoria = await prisma.categoria_egreso_m5.create({ data: { nombre: nombreCategoria, nombre_normalizado: nombreCategoria.toUpperCase(), creado_por: usuario.usuario_id_usuario } }); ids.categorias.push(categoria.id_categoria_egreso_m5);
  const asociacion = await prisma.asociacion_documento_oc_m5.create({ data: { id_documento_m5: documento.id_documento_m5, tipo_orden: 'EXCEPCION', id_orden_externa: `M7-${marca}`, monto_asignado: 80 } }); ids.asociaciones.push(asociacion.id_asociacion_m5);
  const clasificacion = await prisma.clasificacion_asociacion_m5.create({ data: { id_asociacion_m5: asociacion.id_asociacion_m5, id_categoria_egreso_m5: categoria.id_categoria_egreso_m5, monto: 80, nombre_categoria_snapshot: nombreCategoria } }); ids.clasificaciones.push(clasificacion.id_clasificacion_m5);
  obligacion = await prisma.obligacion_proveedor_m5.create({ data: { id_documento_m5: documento.id_documento_m5, id_proveedor: proveedor.id_proveedor, monto_original: 80, id_moneda: moneda.id_moneda, saldo_inicial: 80, saldo_actual: 80, fecha_emision: documento.fecha_emision, fecha_vencimiento: new Date('2040-08-01T00:00:00Z'), estado_pago: 'Pendiente', condicion_temporal: 'Por pagar', generado_por: usuario.usuario_id_usuario } }); ids.obligaciones.push(obligacion.id_obligacion_m5);
  movimiento = await prisma.movimiento_financiero.create({ data: { id_moneda: moneda.id_moneda, fecha_movimiento: new Date('2040-05-20T00:00:00Z'), tipo_movimiento_financiero: 'prueba_m7', naturaleza_movimiento: 'ingreso', monto_movimiento: 25 } }); ids.movimientos.push(movimiento.id_movimiento_financiero);
}

after(async () => {
  await prisma.movimiento_financiero.deleteMany({ where: { id_movimiento_financiero: { in: ids.movimientos } } });
  await prisma.obligacion_proveedor_m5.deleteMany({ where: { id_obligacion_m5: { in: ids.obligaciones } } }); await prisma.clasificacion_asociacion_m5.deleteMany({ where: { id_clasificacion_m5: { in: ids.clasificaciones } } }); await prisma.asociacion_documento_oc_m5.deleteMany({ where: { id_asociacion_m5: { in: ids.asociaciones } } }); await prisma.categoria_egreso_m5.deleteMany({ where: { id_categoria_egreso_m5: { in: ids.categorias } } }); await prisma.documento_proveedor_m5.deleteMany({ where: { id_documento_m5: { in: ids.documentos } } }); await prisma.proveedor.deleteMany({ where: { id_proveedor: { in: ids.proveedores } } });
  await prisma.asignacion_pago_cliente.deleteMany({ where: { id_pago_cliente: { in: ids.pagos } } }); await prisma.pago_cliente.deleteMany({ where: { id_pago_cliente: { in: ids.pagos } } }); await prisma.nota_venta.deleteMany({ where: { id_nota_venta: { in: ids.notas } } }); await prisma.ficha_cliente.deleteMany({ where: { id_ficha_cliente: { in: ids.fichas } } }); await prisma.cliente_financiero.deleteMany({ where: { id_cliente_financiero: { in: ids.clientes } } }); await prisma.$disconnect();
});

test('M7 capacidades financieras existentes con numeración definitiva', async t => {
  await preparar(); const consulta = { anio: 2040, mes: 5 };
  await t.test('01 período mensual tiene límites estables', () => { const p = resolverPeriodoM7(consulta); assert.equal(p.etiquetaDesde, '2040-05-01'); assert.equal(p.etiquetaHasta, '2040-05-31'); });
  await t.test('02 período inválido se rechaza', () => assert.throws(() => resolverPeriodoM7({ anio: 2040, mes: 13 }), e => e.estado === 400));
  await t.test('03 dataset vacío no se informa como cero', async () => { const r = await modulo.consultarAnalisisVentas({ anio: 2199, mes: 1 }); assert.equal(r.montoNeto.estado, 'SIN_RESULTADOS'); assert.equal(r.montoNeto.valor, null); });
  const ventas = await modulo.consultarAnalisisVentas(consulta);
  await t.test('04 ventas usa monto neto', () => assert.equal(ventas.montoNeto.valor.porMoneda.find(x => x.moneda === 'CLP').monto, 150));
  await t.test('05 venta emitida no es definitiva', () => assert.equal(ventas.cantidad.valor, 2));
  await t.test('06 ventas anuladas y revertidas se excluyen', () => assert.ok(ventas.montoNeto.valor.porMoneda.every(x => x.monto < 1000)));
  await t.test('07 comparación con base anterior cero no divide por cero', () => assert.equal(ventas.comparacion.estado, 'NO_APLICA'));
  await t.test('08 desglose por cliente usa fuente M2', () => assert.ok(ventas.clientes.some(x => x.nombre === cliente.nombre_razon_social_referencia)));
  await t.test('09 tipo de cliente está disponible', () => assert.ok(ventas.tiposCliente.length > 0));
  await t.test('10 producto no se inventa sin detalle estructurado', () => assert.equal(ventas.productos.estado, 'DATOS_INSUFICIENTES'));
  const cxc = await modulo.consultarCuentasCobrar(consulta);
  await t.test('11 CxC mantiene saldo propietario M3', () => assert.ok(cxc.saldo.valor.find(x => x.moneda === 'CLP').monto >= 139));
  await t.test('12 CxC detecta morosidad', () => assert.ok(cxc.morosidad.valor.cantidad >= 1));
  await t.test('13 recaudación usa pago efectivo', () => assert.ok(cxc.recaudacion.valor.find(x => x.moneda === 'CLP').monto >= 30));
  await t.test('14 compromiso CxC exige monto y fecha', () => assert.ok(cxc.compromisosFuturos.valor.some(x => x.idNota === nota.id_nota_venta && x.monto === 89)));
  const cxp = await modulo.consultarCuentasPagar(consulta);
  await t.test('15 CxP usa obligación M5 vigente', () => assert.ok(cxp.saldo.valor.find(x => x.moneda === 'CLP').monto >= 80));
  await t.test('16 CxP conserva estado propietario', () => assert.ok(cxp.estados.valor.some(x => x.estado === 'Por pagar')));
  await t.test('17 CxP agrupa proveedor real', () => assert.ok(cxp.proveedores.some(x => x.proveedor === proveedor.nombre_razon_social)));
  await t.test('18 CxP expone categoría M5 sin inventarla', () => assert.ok(cxp.categorias.valor.some(x => x.categoria.startsWith('Servicios M7'))));
  await t.test('19 compromiso CxP conserva fecha y monto', () => assert.ok(cxp.compromisosFuturos.valor.some(x => x.id === obligacion.id_obligacion_m5)));
  const liquidez = await modulo.consultarLiquidez(consulta);
  await t.test('20 liquidez actual se deriva de movimientos', () => { assert.equal(liquidez.liquidezActual.estado, 'VALIDO'); assert.ok(liquidez.liquidezActual.valor.some(x => x.moneda === 'CLP')); });
  await t.test('21 flujo histórico usa movimientos reales', () => assert.ok(liquidez.flujoHistorico.valor.totales.some(x => x.moneda === 'CLP' && x.ingresosRecibidos >= 25)));
  await t.test('22 proyección parte de liquidez actual y mantiene compromisos fechados', () => { assert.equal(liquidez.proyeccion.estado, 'VALIDO'); assert.ok(liquidez.proyeccion.valor.eventos.length >= 2); assert.ok(liquidez.proyeccion.valor.saldosFinales.length > 0); });
  await t.test('23 permisos definitivos son independientes', () => { for (const cu of ['CU215','CU219','CU220','CU222','CU223','CU225','CU226','CU227','CU230','CU231']) { assert.deepEqual(matrizPermisosPorCU[cu], []); assert.equal(moduloPermiso(cu), 'M7'); } assert.equal(permiteOperacion('consultarLiquidezM7', ['CU219']), false); assert.equal(permiteOperacion('consultarLiquidezM7', ['CU230']), true); });
  await t.test('24 catálogo M7 termina en CU258 y M8 comienza en CU259', () => { assert.equal(codigosTodosLosCU.length, 274); assert.equal(codigosTodosLosCU[257], 'CU258'); assert.equal(codigosTodosLosCU.at(-1), 'CU274'); assert.equal(moduloPermiso('CU259'), 'M8'); });
  await t.test('25 panel parcial oculta bloque completo', async () => { const r = await modulo.consultarPanelGeneral(consulta, ['CU219']); assert.deepEqual(Object.keys(r.bloques), ['ventas']); assert.ok(r.bloquesOcultos.includes('cuentasCobrar')); });
  await t.test('26 una fuente caída no rompe bloques sanos', async () => { class Falla extends M7Controller { async consultarAnalisisVentas(){ throw new Error('fuente'); } async consultarCuentasCobrar(){ return { estado: 'VALIDO' }; } } const r = await new Falla().consultarPanelGeneral(consulta, ['CU219', 'CU222']); assert.equal(r.bloques.ventas.estado, 'FUENTE_NO_DISPONIBLE'); assert.equal(r.bloques.cuentasCobrar.estado, 'VALIDO'); });
  await t.test('27 backend M7 escribe sólo parámetros, ajustes y auditoría autorizada sin exponer personas', () => { const fuente = readFileSync(resolve('src/controladores/M7Controller.ts'), 'utf8'); const escrituras = fuente.match(/\b(?:prisma|tx)\.([a-z_]+)\.(?:create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/g) || []; const permitidas = ['parametro_remuneracional', 'movimiento_financiero', 'origen_movimiento_financiero', 'evento_auditoria']; assert.equal(escrituras.length > 0, true); assert.equal(escrituras.every(linea => permitidas.some(tabla => linea.includes(tabla))), true); assert.doesNotMatch(fuente, /empleado\s*:\s*true|liquidacion_remuneracion\s*:\s*true/i); });
  await t.test('28 existen las migraciones M7 autorizadas y CU233 tiene operación propia', () => { assert.deepEqual(readdirSync(resolve('prisma/migrations')).filter(nombre => /m7/i.test(nombre)), ['040_m7_parametros_dashboard', '041_m7_delta_controlado']); assert.equal(operacionesPermiso.consultarMargenProyectosM7, 'CU233'); });
  await t.test('29 rutas y vistas mantienen permisos definitivos', () => { const rutas = readFileSync(resolve('src/rutas/finanzas.ts'), 'utf8'); const app = readFileSync(resolve('../Vistas/src/App.tsx'), 'utf8'); for (const cu of ['CU215','CU219','CU220','CU222','CU223','CU225','CU226','CU227','CU230','CU231']) assert.match(app, new RegExp(cu)); assert.match(rutas, /dashboard-m7\/liquidez/); });
});
