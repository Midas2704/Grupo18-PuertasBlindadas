const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M8Controller } = require('../dist/controladores/M8Controller');
const { codigosTodosLosCU, matrizPermisosPorCU, moduloPermiso, operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

const modulo = new M8Controller();
const autorizado = { id: 1n, permisos: ['CU259'] };
const denegado = { id: 2n, permisos: [] };
const ids = { solicitudes: [], notas: [], cotizaciones: [], fichas: [], clientes: [] };
let fichas; let cotizacion; let nota;

async function preparar() {
  if (fichas) return;
  const [tipoCliente, moneda] = await Promise.all([
    prisma.tipo_cliente_financiero.findFirstOrThrow(),
    prisma.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } }),
  ]);
  const marca = randomUUID().slice(0, 8);
  const creadas = [];
  for (const [indice, estado] of ['activo', 'inactivo'].entries()) {
    const cliente = await prisma.cliente_financiero.create({ data: { id_tipo_cliente_financiero: tipoCliente.id_tipo_cliente_financiero, rut_cliente: `M8${indice}${marca}`.slice(0, 15), nombre_razon_social_referencia: `Cliente M8 ${indice} ${marca}`, estado_financiero: estado, ficha_cliente: { create: { estado_ficha: estado === 'activo' ? 'activa' : 'inactiva' } } }, include: { ficha_cliente: true } });
    ids.clientes.push(cliente.id_cliente_financiero); ids.fichas.push(cliente.ficha_cliente.id_ficha_cliente); creadas.push(cliente.ficha_cliente);
  }
  fichas = creadas;
  cotizacion = await prisma.cotizacion.create({ data: { id_ficha_cliente: fichas[0].id_ficha_cliente, id_moneda: moneda.id_moneda, fecha_emision: new Date('2042-01-10T00:00:00Z'), estado_cotizacion: 'emitida', monto_total_estimado: 125000 } }); ids.cotizaciones.push(cotizacion.id_cotizacion);
  nota = await prisma.nota_venta.create({ data: { id_ficha_cliente: fichas[0].id_ficha_cliente, id_cotizacion: cotizacion.id_cotizacion, id_moneda: moneda.id_moneda, numero_nota_venta: `M8-${randomUUID()}`, fecha_emision: new Date('2042-01-11T00:00:00Z'), monto_total: 125000 } }); ids.notas.push(nota.id_nota_venta);
  for (const [indice, estado] of ['BORRADOR', 'PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA'].entries()) {
    const solicitud = await prisma.solicitud_crediticia_m8.create({ data: { id_ficha_cliente: fichas[0].id_ficha_cliente, tipo_solicitud: indice % 2 ? 'EXCEPCION' : 'INICIAL', estado_solicitud: estado, id_cotizacion: indice === 0 ? cotizacion.id_cotizacion : null, id_nota_venta: indice === 0 ? nota.id_nota_venta : null, antecedentes_resumen: `Antecedente sintético ${indice}`, fecha_creacion: new Date(`2042-01-${String(10 + indice).padStart(2, '0')}T12:00:00Z`) } }); ids.solicitudes.push(solicitud.id_solicitud_crediticia);
  }
  const parcial = await prisma.solicitud_crediticia_m8.create({ data: { id_ficha_cliente: fichas[1].id_ficha_cliente, tipo_solicitud: 'INICIAL', estado_solicitud: 'PENDIENTE', referencia_contexto: 'SIN-DOCUMENTO-M2', fecha_creacion: new Date('2042-02-01T12:00:00Z') } }); ids.solicitudes.push(parcial.id_solicitud_crediticia);
}

after(async () => {
  await prisma.solicitud_crediticia_m8.deleteMany({ where: { id_solicitud_crediticia: { in: ids.solicitudes } } });
  await prisma.nota_venta.deleteMany({ where: { id_nota_venta: { in: ids.notas } } });
  await prisma.cotizacion.deleteMany({ where: { id_cotizacion: { in: ids.cotizaciones } } });
  await prisma.ficha_cliente.deleteMany({ where: { id_ficha_cliente: { in: ids.fichas } } });
  await prisma.cliente_financiero.deleteMany({ where: { id_cliente_financiero: { in: ids.clientes } } });
  await prisma.$disconnect();
});

test('M8 CU259 consulta solicitudes crediticias', async t => {
  await preparar();
  const ambito = { desde: '2042-01-01', hasta: '2042-12-31' };
  const todas = await modulo.listarSolicitudes(ambito, autorizado);
  await t.test('01 usuario autorizado consulta bandeja', () => assert.equal(todas.total, 6));
  await t.test('02 usuario no autorizado recibe rechazo', () => assert.rejects(modulo.listarSolicitudes({}, denegado), error => error.estado === 403));
  await t.test('03 conjunto vacío es válido', async () => assert.equal((await modulo.listarSolicitudes({ desde: '2099-01-01' }, autorizado)).total, 0));
  await t.test('04 distingue INICIAL y EXCEPCION', () => assert.deepEqual(new Set(todas.solicitudes.map(item => item.tipo)), new Set(['INICIAL', 'EXCEPCION'])));
  for (const [indice, estado] of ['BORRADOR', 'PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA'].entries()) await t.test(`${String(indice + 5).padStart(2, '0')} lee ${estado}`, () => assert.ok(todas.solicitudes.some(item => item.estado === estado)));
  await t.test('10 filtro por estado', async () => assert.ok((await modulo.listarSolicitudes({ ...ambito, estado: 'APROBADA' }, autorizado)).solicitudes.every(item => item.estado === 'APROBADA')));
  await t.test('11 filtro por tipo', async () => assert.ok((await modulo.listarSolicitudes({ ...ambito, tipo: 'EXCEPCION' }, autorizado)).solicitudes.every(item => item.tipo === 'EXCEPCION')));
  await t.test('12 filtro por Cliente', async () => { const r = await modulo.listarSolicitudes({ cliente: String(fichas[1].id_ficha_cliente) }, autorizado); assert.equal(r.total, 1); assert.equal(r.solicitudes[0].cliente.idFicha, fichas[1].id_ficha_cliente); });
  await t.test('13 abre detalle autorizado', async () => assert.equal((await modulo.obtenerSolicitud(ids.solicitudes[0], autorizado)).id, ids.solicitudes[0]));
  await t.test('14 detalle fuera de alcance no se entrega', () => assert.rejects(modulo.obtenerSolicitud(ids.solicitudes[0], denegado), error => error.estado === 403));
  await t.test('15 contexto M1 válido', () => { const fila = todas.solicitudes.find(item => item.cliente.idFicha === fichas[0].id_ficha_cliente); assert.equal(fila.cliente.estadoContexto, 'DISPONIBLE'); assert.match(fila.cliente.nombre, /Cliente M8/); });
  await t.test('16 contexto M1 parcialmente no disponible', async () => { const r = await modulo.listarSolicitudes({ cliente: String(fichas[1].id_ficha_cliente) }, autorizado); assert.equal(r.solicitudes[0].cliente.estadoContexto, 'PARCIALMENTE_DISPONIBLE'); });
  await t.test('17 contexto M2 presente', async () => { const r = await modulo.obtenerSolicitud(ids.solicitudes[0], autorizado); assert.equal(r.contextoComercial.estado, 'DISPONIBLE'); assert.equal(r.contextoComercial.cotizacion.id, cotizacion.id_cotizacion); assert.equal(r.contextoComercial.notaVenta.id, nota.id_nota_venta); });
  await t.test('18 contexto M2 ausente no rompe solicitud', async () => { const r = await modulo.obtenerSolicitud(ids.solicitudes[1], autorizado); assert.equal(r.contextoComercial.estado, 'SIN_REFERENCIA'); });
  await t.test('19 consultar no cambia estado', async () => { const antes = await prisma.solicitud_crediticia_m8.findUniqueOrThrow({ where: { id_solicitud_crediticia: ids.solicitudes[2] } }); await modulo.obtenerSolicitud(ids.solicitudes[2], autorizado); const despues = await prisma.solicitud_crediticia_m8.findUniqueOrThrow({ where: { id_solicitud_crediticia: ids.solicitudes[2] } }); assert.equal(despues.estado_solicitud, antes.estado_solicitud); assert.equal(despues.fecha_actualizacion.getTime(), antes.fecha_actualizacion.getTime()); });
  await t.test('20 CU259 conserva permiso independiente tras ampliar M8', () => { assert.equal(operacionesPermiso.listarSolicitudesCreditoM8, 'CU259'); assert.equal(operacionesPermiso.obtenerSolicitudCreditoM8, 'CU259'); assert.equal(permiteOperacion('resolverSolicitudInicialM8', ['CU259']), false); assert.equal(permiteOperacion('cancelarSolicitudCreditoM8', ['CU259']), false); assert.deepEqual(matrizPermisosPorCU.CU259, ['gerencia', 'secretaria']); assert.equal(moduloPermiso('CU259'), 'M8'); assert.equal(codigosTodosLosCU.at(-1), 'CU274'); const migracion = readFileSync(resolve('prisma/migrations/042_m8_solicitudes_crediticias/migration.sql'), 'utf8'); assert.match(migracion, /'CU259'[\s\S]+codigo_m4" IN \('gerencia', 'secretaria'\)/); });
});
