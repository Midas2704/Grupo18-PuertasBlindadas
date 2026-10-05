const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M7Controller } = require('../dist/controladores/M7Controller');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { codigosTodosLosCU, matrizPermisosPorCU, operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

const modulo = new M7Controller();
const ids = { clientes: [], fichas: [], notas: [], proyectos: [], costos: [], movimientos: [] };
let proyectoUtil; let proyectoPerdida; let proyectoCero; let costoUtil; let notaSinProyecto; let movimientoGeneral;
const consulta = { anio: 2042, mes: 4 };

async function preparar() {
  if (proyectoUtil) return;
  const [tipo, moneda] = await Promise.all([prisma.tipo_cliente_financiero.findFirstOrThrow(), prisma.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } })]);
  const marca = randomUUID().slice(0, 8);
  const cliente = await prisma.cliente_financiero.create({ data: { id_tipo_cliente_financiero: tipo.id_tipo_cliente_financiero, rut_cliente: `D7${marca}`.slice(0, 15), nombre_razon_social_referencia: `Cliente Dashboard ${marca}`, ficha_cliente: { create: {} } }, include: { ficha_cliente: true } });
  ids.clientes.push(cliente.id_cliente_financiero); ids.fichas.push(cliente.ficha_cliente.id_ficha_cliente);
  const nota = async (neto, sufijo) => { const fila = await prisma.nota_venta.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, numero_nota_venta: `M7T2-${sufijo}-${randomUUID().slice(0, 12)}`, fecha_emision: new Date('2042-04-10T00:00:00Z'), monto_neto: neto, monto_total: neto, exento_iva: true, estado_nota_venta: 'confirmada' } }); ids.notas.push(fila.id_nota_venta); return fila; };
  const crearProyecto = async (neto, costo, sufijo) => { const venta = await nota(neto, sufijo); const proyecto = await prisma.proyecto_financiero.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_nota_venta: venta.id_nota_venta, id_moneda: moneda.id_moneda, codigo_proyecto_financiero: `M7-${sufijo}-${marca}` } }); ids.proyectos.push(proyecto.id_proyecto_financiero); const costoFila = await prisma.costo_proyecto.create({ data: { id_proyecto_financiero: proyecto.id_proyecto_financiero, id_moneda: moneda.id_moneda, descripcion_costo: `Costo ${sufijo}`, categoria_costo: 'MATERIAL', monto_costo: costo, fecha_costo: new Date('2042-04-15T00:00:00Z'), origen_costo: 'COSTO_DIRECTO', estado_costo: 'validado' } }); ids.costos.push(costoFila.id_costo_proyecto); return { proyecto, venta, costo: costoFila }; };
  const util = await crearProyecto(200, 120, 'UTIL'); proyectoUtil = util.proyecto; costoUtil = util.costo;
  proyectoPerdida = (await crearProyecto(100, 150, 'PERDIDA')).proyecto;
  proyectoCero = (await crearProyecto(0, 10, 'CERO')).proyecto;
  notaSinProyecto = await nota(999, 'SIN-PROYECTO');
  movimientoGeneral = await prisma.movimiento_financiero.create({ data: { id_moneda: moneda.id_moneda, fecha_movimiento: new Date('2042-04-18T00:00:00Z'), tipo_movimiento_financiero: 'gasto_general_m7', naturaleza_movimiento: 'egreso', monto_movimiento: 777 } }); ids.movimientos.push(movimientoGeneral.id_movimiento_financiero);
}

after(async () => {
  await prisma.movimiento_financiero.deleteMany({ where: { id_movimiento_financiero: { in: ids.movimientos } } });
  await prisma.costo_proyecto.deleteMany({ where: { id_costo_proyecto: { in: ids.costos } } });
  await prisma.proyecto_financiero.deleteMany({ where: { id_proyecto_financiero: { in: ids.proyectos } } });
  await prisma.nota_venta.deleteMany({ where: { id_nota_venta: { in: ids.notas } } });
  await prisma.ficha_cliente.deleteMany({ where: { id_ficha_cliente: { in: ids.fichas } } });
  await prisma.cliente_financiero.deleteMany({ where: { id_cliente_financiero: { in: ids.clientes } } });
  await prisma.$disconnect();
});

test('M7 capacidades existentes remapeadas CU233-CU246', async t => {
  await preparar();
  const resolverUmbralReal = modulo.resolverUmbralMargen;
  modulo.resolverUmbralMargen = async () => null;
  const margen = await modulo.consultarMargenProyectos(consulta);
  modulo.resolverUmbralMargen = resolverUmbralReal;
  const util = margen.proyectos.find(p => p.idProyecto === proyectoUtil.id_proyecto_financiero);
  const perdida = margen.proyectos.find(p => p.idProyecto === proyectoPerdida.id_proyecto_financiero);
  const cero = margen.proyectos.find(p => p.idProyecto === proyectoCero.id_proyecto_financiero);
  await t.test('01 margen resta ingresos y costos atribuibles', () => assert.equal(util.margenDirecto, 80));
  await t.test('02 ingreso sin Proyecto inequívoco no se atribuye', () => assert.equal(margen.proyectos.some(p => p.desgloseIngresos.some(i => i.referencia === `NV:${notaSinProyecto.id_nota_venta}`)), false));
  await t.test('03 costo sin Proyecto inequívoco no se atribuye', () => assert.equal(margen.proyectos.some(p => p.desgloseCostos.some(c => c.referencia === `MOV:${movimientoGeneral.id_movimiento_financiero}`)), false));
  await t.test('04 no prorratea gasto general', () => assert.equal(util.costosDirectosAtribuibles, 120));
  await t.test('05 pérdida se clasifica por margen monetario negativo', () => assert.equal(perdida.clasificacion, 'PERDIDA'));
  await t.test('06 ingreso no positivo deja porcentaje no aplicable', () => assert.equal(cero.porcentajeMargen, null));
  await t.test('07 sin umbral no usa default', () => { assert.equal(margen.umbralMargen.estado, 'CONFIGURACION_PENDIENTE'); assert.equal(util.clasificacion, 'PENDIENTE_CONFIGURACION'); });
  await t.test('08 umbral válido usa orientación menor o igual', async () => { const original = modulo.resolverUmbralMargen; modulo.resolverUmbralMargen = async () => ({ id: 1, valor: 50, vigenciaDesde: '2042-01-01', vigenciaHasta: null }); try { const r = await modulo.consultarMargenProyectos(consulta); assert.equal(r.proyectos.find(p => p.idProyecto === proyectoUtil.id_proyecto_financiero).clasificacion, 'MARGEN_CRITICO'); } finally { modulo.resolverUmbralMargen = original; } });
  await t.test('09 cobertura parcial queda visible', () => { assert.equal(util.cobertura.estado, 'DATOS_INSUFICIENTES'); assert.equal(util.cobertura.valor.fuentesNoIncluidas.length > 0, true); });
  await t.test('10 consultar margen no persiste resultados', async () => { const antes = await prisma.proyecto_financiero.count(); await modulo.consultarMargenProyectos(consulta); assert.equal(await prisma.proyecto_financiero.count(), antes); });

  const resultados = await modulo.consultarResumenResultados(consulta);
  const situacion = await modulo.consultarSituacionFinanciera(consulta);
  await t.test('11 resumen sólo incluye partidas reconstruibles', () => assert.equal(resultados.ingresos.estado, 'VALIDO'));
  await t.test('12 faltante no se convierte a cero', () => assert.equal(resultados.gastosRegistrados.valor, null));
  await t.test('13 cobertura parcial es explícita', () => assert.equal(resultados.cobertura.valor.completa, false));
  await t.test('14 títulos no presentan estados contables formales', () => { assert.equal(resultados.titulo, 'Resumen gerencial de resultados'); assert.equal(situacion.titulo, 'Situación financiera resumida'); });
  await t.test('15 patrimonio no se inventa', () => { assert.equal(situacion.patrimonio.estado, 'NO_APLICA'); assert.equal(situacion.patrimonio.valor, null); });
  await t.test('16 corrección de fuente se refleja al consultar nuevamente', async () => { await prisma.costo_proyecto.update({ where: { id_costo_proyecto: costoUtil.id_costo_proyecto }, data: { monto_costo: 130 } }); const actualizado = await modulo.consultarMargenProyectos(consulta); assert.equal(actualizado.proyectos.find(p => p.idProyecto === proyectoUtil.id_proyecto_financiero).margenDirecto, 70); await prisma.costo_proyecto.update({ where: { id_costo_proyecto: costoUtil.id_costo_proyecto }, data: { monto_costo: 120 } }); });
  await t.test('17 período y fecha de corte se conservan', () => { assert.deepEqual(resultados.periodo, { desde: '2042-04-01', hasta: '2042-04-30' }); assert.equal(situacion.fechaCorte, '2042-04-30'); });

  const decodificar = archivo => Buffer.from(archivo.contenido.split(',')[1], 'base64').toString('latin1');
  const pdfPanel = await modulo.descargarPdfContextual({ origen: 'panel', consulta }, ['CU215', 'CU233', 'CU245']);
  const pdfMargen = await modulo.descargarPdfContextual({ origen: 'margen', consulta }, ['CU233', 'CU245']);
  await t.test('18 genera informe gerencial de Panel', () => assert.match(decodificar(pdfPanel), /Informe Financiero Gerencial/));
  await t.test('19 genera PDF de análisis especializado', () => assert.match(decodificar(pdfMargen), /Margen Directo/));
  await t.test('20 PDF conserva período y filtros', () => assert.match(decodificar(pdfMargen), /2042-04-01 a 2042-04-30/));
  await t.test('21 PDF presenta cobertura sin estados técnicos crudos', () => { assert.match(decodificar(pdfMargen), /atribución inequívoca/); assert.doesNotMatch(decodificar(pdfMargen), /DATOS_INSUFICIENTES/); });
  await t.test('22 PDF contiene fecha completa y hora', () => assert.match(decodificar(pdfMargen), /Generado: \d{2}-\d{2}-\d{4},/));
  await t.test('23 vista sin CU245 no descarga', async () => assert.rejects(modulo.descargarPdfContextual({ origen: 'margen', consulta }, ['CU233']), e => e.estado === 403));
  await t.test('24 CU245 sin permiso de origen no descarga', async () => assert.rejects(modulo.descargarPdfContextual({ origen: 'margen', consulta }, ['CU245']), e => e.estado === 403));
  await t.test('25 Panel PDF no filtra bloques no autorizados', async () => assert.doesNotMatch(decodificar(await modulo.descargarPdfContextual({ origen: 'panel', consulta }, ['CU215', 'CU216', 'CU245'])), new RegExp(proyectoUtil.codigo_proyecto_financiero)));
  await t.test('26 PDF no se persiste en BD', async () => { const antes = await prisma.parametro_remuneracional.count(); await modulo.descargarPdfContextual({ origen: 'margen', consulta }, ['CU233', 'CU245']); assert.equal(await prisma.parametro_remuneracional.count(), antes); });
  await t.test('27 archivo generado no cambia con consultas posteriores', async () => { const contenido = pdfMargen.contenido; await prisma.costo_proyecto.update({ where: { id_costo_proyecto: costoUtil.id_costo_proyecto }, data: { monto_costo: 121 } }); assert.equal(pdfMargen.contenido, contenido); await prisma.costo_proyecto.update({ where: { id_costo_proyecto: costoUtil.id_costo_proyecto }, data: { monto_costo: 120 } }); });

  const migracionParametros = readFileSync(resolve('prisma/migrations/040_m7_parametros_dashboard/migration.sql'), 'utf8');
  const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
  const fuenteM7 = readFileSync(resolve('src/controladores/M7Controller.ts'), 'utf8');
  await t.test('28 CU246 no tiene valor default', () => assert.equal(margen.umbralMargen.valor, null));
  await t.test('29 migración 040 admite DASHBOARD y conserva tipos previos', () => { assert.match(migracionParametros, /'LEGAL'.*'PREVISIONAL'.*'TRIBUTARIO'.*'PRORRATEO'.*'DASHBOARD'/s); assert.match(migracionParametros, /DROP CONSTRAINT "chk_parametro_remuneracional_tipo"/); });
  await t.test('30 CU246 protege consulta y configuración', () => { assert.equal(operacionesPermiso.consultarUmbralMargenM7, 'CU246'); assert.equal(operacionesPermiso.configurarUmbralMargenM7, 'CU246'); });
  await t.test('31 existen las migraciones M7 autorizadas', () => assert.deepEqual(readdirSync(resolve('prisma/migrations')).filter(nombre => /m7/i.test(nombre)), ['040_m7_parametros_dashboard', '041_m7_delta_controlado']));
  await t.test('32 solapamiento no se elude con persistencia paralela', () => assert.doesNotMatch(schema, /model (?:parametro_m7|configuracion_dashboard|umbral_dashboard|regla_dashboard)/));
  await t.test('33 CU246 escribe sólo el mantenedor existente de forma serializable', () => { assert.match(fuenteM7, /parametro_remuneracional\.create/); assert.match(fuenteM7, /TransactionIsolationLevel\.Serializable/); });
  await t.test('34 CU233 queda listo para consumir un umbral vigente', () => assert.match(fuenteM7, /M7_MARGEN_CRITICO/));
  await t.test('35 CU246 no crea tabla M7', () => { assert.doesNotMatch(migracionParametros, /CREATE TABLE/i); assert.doesNotMatch(schema, /model (?:parametro_m7|configuracion_dashboard|umbral_dashboard|regla_dashboard)/); });
  await t.test('36 M6 conserva su mantenedor y permisos', async () => { await new M6Controller().listarParametrosRemuneracionales(); assert.equal(operacionesPermiso.listarParametrosRemuneracionales, 'CU167'); for (let n = 220; n <= 224; n++) assert.deepEqual(matrizPermisosPorCU[`CU${n}`], []); assert.equal(codigosTodosLosCU.length, 274); assert.equal(permiteOperacion('descargarPdfDashboardM7', ['CU245']), true); });
});
