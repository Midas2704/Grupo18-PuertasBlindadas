const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M7Controller } = require('../dist/controladores/M7Controller');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

const modulo = new M7Controller();
const codigo = 'M7_MARGEN_CRITICO';

after(async () => {
  await prisma.parametro_remuneracional.deleteMany({ where: { codigo } });
  await prisma.$disconnect();
});

test('M7 CU246 configura el umbral de margen crítico', async t => {
  await prisma.parametro_remuneracional.deleteMany({ where: { codigo } });
  const cantidadM6Inicial = await prisma.parametro_remuneracional.count({ where: { tipo: { in: ['LEGAL', 'PREVISIONAL', 'TRIBUTARIO', 'PRORRATEO'] } } });
  const migracion = readFileSync(resolve('prisma/migrations/040_m7_parametros_dashboard/migration.sql'), 'utf8');
  const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
  const fuente = readFileSync(resolve('src/controladores/M7Controller.ts'), 'utf8');

  await t.test('01 migración 040 permite DASHBOARD', () => assert.match(migracion, /'DASHBOARD'/));
  await t.test('02 tipos anteriores siguen admitidos', () => assert.match(migracion, /'LEGAL'.*'PREVISIONAL'.*'TRIBUTARIO'.*'PRORRATEO'/s));
  await t.test('03 tipo inválido sigue excluido', () => assert.doesNotMatch(migracion, /'OTRO_TIPO'/));
  await t.test('04 sin configuración CU233 queda pendiente', async () => { const margen = await modulo.consultarMargenProyectos({ anio: 2042, mes: 4 }); assert.equal(margen.umbralMargen.estado, 'CONFIGURACION_PENDIENTE'); });
  await t.test('05 valor negativo es rechazado', async () => assert.rejects(modulo.configurarUmbralMargen({ valor: -1, vigenciaDesde: '2042-01-01' }), e => e.estado === 400));
  await t.test('06 valor mayor a cien es rechazado', async () => assert.rejects(modulo.configurarUmbralMargen({ valor: 100.01, vigenciaDesde: '2042-01-01' }), e => e.estado === 400));
  await t.test('07 texto inválido y null son rechazados', async () => { await assert.rejects(modulo.configurarUmbralMargen({ valor: 'abc', vigenciaDesde: '2042-01-01' }), e => e.estado === 400); await assert.rejects(modulo.configurarUmbralMargen({ valor: null, vigenciaDesde: '2042-01-01' }), e => e.estado === 400); });
  await t.test('08 crear umbral 15 por ciento funciona sin convertirlo a fracción', async () => { await modulo.configurarUmbralMargen({ valor: 15, vigenciaDesde: '2042-01-01', fuente: 'Prueba CU246' }); const fila = await prisma.parametro_remuneracional.findFirstOrThrow({ where: { codigo } }); assert.equal(Number(fila.valor), 15); assert.equal(fila.tipo, 'DASHBOARD'); assert.equal(fila.unidad, 'PORCENTAJE'); });
  await t.test('09 CU233 consume el valor vigente', async () => { const margen = await modulo.consultarMargenProyectos({ anio: 2042, mes: 4 }); assert.equal(margen.umbralMargen.estado, 'VALIDO'); assert.equal(margen.umbralMargen.valor.valor, 15); });
  await t.test('10 cambio conserva la fila anterior y cierra su vigencia', async () => { await modulo.configurarUmbralMargen({ valor: 20, vigenciaDesde: '2042-06-01' }); const filas = await prisma.parametro_remuneracional.findMany({ where: { codigo }, orderBy: { vigencia_desde: 'asc' } }); assert.equal(filas.length, 2); assert.equal(filas[0].vigencia_hasta.toISOString().slice(0, 10), '2042-05-31'); assert.equal(filas[1].vigencia_hasta, null); });
  await t.test('11 cambio el mismo día devuelve conflicto y no sobrescribe', async () => { await assert.rejects(modulo.configurarUmbralMargen({ valor: 25, vigenciaDesde: '2042-06-01' }), e => e.estado === 409); assert.equal(Number((await prisma.parametro_remuneracional.findUniqueOrThrow({ where: { codigo_vigencia_desde: { codigo, vigencia_desde: new Date('2042-06-01T00:00:00Z') } } })).valor), 20); });
  await t.test('12 vigencias creadas no se superponen', async () => { const filas = await prisma.parametro_remuneracional.findMany({ where: { codigo }, orderBy: { vigencia_desde: 'asc' } }); assert.equal(filas[0].vigencia_hasta < filas[1].vigencia_desde, true); });
  await t.test('13 ambigüedad efectiva no se resuelve arbitrariamente', async () => { const ambigua = await prisma.parametro_remuneracional.create({ data: { codigo, tipo: 'DASHBOARD', nombre: 'Umbral de margen crítico', valor: 17, unidad: 'PORCENTAJE', vigencia_desde: new Date('2042-05-01T00:00:00Z'), vigencia_hasta: new Date('2042-05-20T00:00:00Z'), estado: 'activo' } }); try { await assert.rejects(modulo.resolverUmbralMargen(new Date('2042-05-15T00:00:00Z')), e => e.estado === 409); } finally { await prisma.parametro_remuneracional.delete({ where: { id_parametro_remuneracional: ambigua.id_parametro_remuneracional } }); } });
  await t.test('14 cambio concurrente deja un ganador y un conflicto', async () => { const resultados = await Promise.allSettled([modulo.configurarUmbralMargen({ valor: 21, vigenciaDesde: '2042-07-01' }), modulo.configurarUmbralMargen({ valor: 22, vigenciaDesde: '2042-07-01' })]); assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1); assert.equal(resultados.filter(r => r.status === 'rejected' && r.reason.estado === 409).length, 1); assert.equal(await prisma.parametro_remuneracional.count({ where: { codigo, vigencia_desde: new Date('2042-07-01T00:00:00Z') } }), 1); });
  await t.test('15 CU246 no puede modificar códigos M6 y tiene permiso independiente', async () => { assert.equal(operacionesPermiso.configurarUmbralMargenM7, 'CU246'); assert.equal(permiteOperacion('configurarUmbralMargenM7', ['CU167']), false); assert.equal(permiteOperacion('configurarUmbralMargenM7', ['CU246']), true); assert.match(fuente, /const codigoUmbralMargen = 'M7_MARGEN_CRITICO'/); });
  await t.test('16 CU233 no necesita CU246 para consultar', () => { assert.equal(permiteOperacion('consultarMargenProyectosM7', ['CU233']), true); assert.equal(permiteOperacion('consultarMargenProyectosM7', ['CU246']), false); });
  await t.test('17 no crea modelo tabla ni persistencia de cálculo M7', async () => { assert.doesNotMatch(schema, /model (?:parametro_m7|configuracion_dashboard|umbral_dashboard|regla_dashboard)/); assert.doesNotMatch(migracion, /CREATE TABLE/i); const antes = await prisma.parametro_remuneracional.count({ where: { codigo } }); await modulo.consultarMargenProyectos({ anio: 2042, mes: 4 }); assert.equal(await prisma.parametro_remuneracional.count({ where: { codigo } }), antes); });
  await t.test('18 parámetros M6 permanecen intactos', async () => { await new M6Controller().listarParametrosRemuneracionales(); assert.equal(await prisma.parametro_remuneracional.count({ where: { tipo: { in: ['LEGAL', 'PREVISIONAL', 'TRIBUTARIO', 'PRORRATEO'] } } }), cantidadM6Inicial); });
});
