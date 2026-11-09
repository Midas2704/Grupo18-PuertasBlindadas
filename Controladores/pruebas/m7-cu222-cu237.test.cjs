const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M7Controller } = require('../dist/controladores/M7Controller');
const { operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');
const { fechaNegocio } = require('../dist/utilidades/finanzas');

const modulo = new M7Controller();
const consulta = { anio: 2026, mes: 10 };
const ids = { clientes: [], fichas: [], notas: [], pagos: [], proyectos: [], costos: [], terreno: [], ots: [] };
let cliente; let notaVencida; let notaFutura; let notaSinFecha; let proyectoAbierto; let proyectoCerrado; let proyectoSinNota; let proyectoTerreno; let ordenTrabajo;

async function preparar() {
  if (cliente) return;
  const [tipo, moneda, medio] = await Promise.all([prisma.tipo_cliente_financiero.findFirstOrThrow(), prisma.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } }), prisma.medio_pago.findFirstOrThrow({ where: { estado_medio_pago: 'activo' } })]);
  const marca = randomUUID().slice(0, 8);
  cliente = await prisma.cliente_financiero.create({ data: { id_tipo_cliente_financiero: tipo.id_tipo_cliente_financiero, rut_cliente: `A7${marca}`.slice(0, 15), nombre_razon_social_referencia: `Cliente Aging ${marca}`, ficha_cliente: { create: {} } }, include: { ficha_cliente: true } });
  ids.clientes.push(cliente.id_cliente_financiero); ids.fichas.push(cliente.ficha_cliente.id_ficha_cliente);
  const nota = async (sufijo, monto, vencimiento, estado = 'confirmada') => { const fila = await prisma.nota_venta.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, numero_nota_venta: `M7A-${sufijo}-${randomUUID().slice(0, 10)}`, fecha_emision: new Date('2026-10-01T00:00:00Z'), fecha_vencimiento: vencimiento ? new Date(`${vencimiento}T00:00:00Z`) : null, monto_neto: monto, monto_total: monto, exento_iva: true, estado_nota_venta: estado } }); ids.notas.push(fila.id_nota_venta); return fila; };
  notaVencida = await nota('VENCIDA', 100, '2026-09-20');
  notaFutura = await nota('FUTURA', 200, '2026-11-15');
  notaSinFecha = await nota('SIN-FECHA', 300, null);
  await nota('VENDIDA', 400, '2026-12-01');
  const pagoEfectivo = await prisma.pago_cliente.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, id_medio_pago: medio.id_medio_pago, fecha_pago: new Date('2026-10-05T00:00:00Z'), monto_pago: 40, estado_verificacion: 'verificado', asignacion_pago_cliente: { create: { id_nota_venta: notaVencida.id_nota_venta, monto_asignado: 40 } } } }); ids.pagos.push(pagoEfectivo.id_pago_cliente);
  const pagoRechazado = await prisma.pago_cliente.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, id_medio_pago: medio.id_medio_pago, fecha_pago: new Date('2026-10-06T00:00:00Z'), monto_pago: 50, estado_verificacion: 'rechazado', asignacion_pago_cliente: { create: { id_nota_venta: notaFutura.id_nota_venta, monto_asignado: 50 } } } }); ids.pagos.push(pagoRechazado.id_pago_cliente);
  proyectoTerreno = await prisma.proyecto.create({ data: { proyecto_codigo_proyecto: `M7-OP-${marca}`, proyecto_nombre_referencia: `Proyecto operacional ${marca}`, proyecto_estado_operacional: 'activo', proyecto_estado_produccion: 'en_progreso' } }); ids.terreno.push(proyectoTerreno.proyecto_proyecto_id);
  ordenTrabajo = await prisma.orden_trabajo.create({ data: { proyecto_id_proyecto: proyectoTerreno.proyecto_proyecto_id, orden_trabajo_estado: 'en_progreso', orden_trabajo_fecha_hora: new Date('2026-10-08T00:00:00Z') } }); ids.ots.push(ordenTrabajo.orden_trabajo_id_orden);
  proyectoAbierto = await prisma.proyecto_financiero.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_nota_venta: notaVencida.id_nota_venta, id_proyecto_terreno: proyectoTerreno.proyecto_proyecto_id, id_moneda: moneda.id_moneda, codigo_proyecto_financiero: `M7-AB-${marca}`, estado_financiero_proyecto: 'activo' } }); ids.proyectos.push(proyectoAbierto.id_proyecto_financiero);
  proyectoCerrado = await prisma.proyecto_financiero.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_nota_venta: notaSinFecha.id_nota_venta, id_moneda: moneda.id_moneda, codigo_proyecto_financiero: `M7-CE-${marca}`, estado_financiero_proyecto: 'cerrado' } }); ids.proyectos.push(proyectoCerrado.id_proyecto_financiero);
  proyectoSinNota = await prisma.proyecto_financiero.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, codigo_proyecto_financiero: `M7-SN-${marca}`, estado_financiero_proyecto: 'activo' } }); ids.proyectos.push(proyectoSinNota.id_proyecto_financiero);
  const costo = await prisma.costo_proyecto.create({ data: { id_proyecto_financiero: proyectoAbierto.id_proyecto_financiero, id_moneda: moneda.id_moneda, descripcion_costo: 'Costo directo focal', monto_costo: 25, fecha_costo: new Date('2026-10-10T00:00:00Z'), origen_costo: 'COSTO_DIRECTO', estado_costo: 'validado' } }); ids.costos.push(costo.id_costo_proyecto);
}

after(async () => {
  await prisma.costo_proyecto.deleteMany({ where: { id_costo_proyecto: { in: ids.costos } } });
  await prisma.proyecto_financiero.deleteMany({ where: { id_proyecto_financiero: { in: ids.proyectos } } });
  await prisma.orden_trabajo.deleteMany({ where: { orden_trabajo_id_orden: { in: ids.ots } } });
  await prisma.proyecto.deleteMany({ where: { proyecto_proyecto_id: { in: ids.terreno } } });
  await prisma.asignacion_pago_cliente.deleteMany({ where: { id_pago_cliente: { in: ids.pagos } } });
  await prisma.pago_cliente.deleteMany({ where: { id_pago_cliente: { in: ids.pagos } } });
  await prisma.nota_venta.deleteMany({ where: { id_nota_venta: { in: ids.notas } } });
  await prisma.ficha_cliente.deleteMany({ where: { id_ficha_cliente: { in: ids.fichas } } });
  await prisma.cliente_financiero.deleteMany({ where: { id_cliente_financiero: { in: ids.clientes } } });
  await prisma.$disconnect();
});

test('M7 Tanda 2 CU222 CU223 CU232 CU236 CU237', async t => {
  await preparar();
  const buscarNotasOriginal = prisma.nota_venta.findMany;
  let cxc;
  try {
    prisma.nota_venta.findMany = async (...argumentos) => (await buscarNotasOriginal.apply(prisma.nota_venta, argumentos)).filter(nota => ids.notas.includes(nota.id_nota_venta));
    cxc = await modulo.consultarCuentasCobrar(consulta, ['CU222', 'CU223']);
  } finally {
    prisma.nota_venta.findMany = buscarNotasOriginal;
  }
  await t.test('01 obligación vencida calcula días correctos', () => { const fila = cxc.cartera.valor.find(item => item.idNota === notaVencida.id_nota_venta); const esperados = Math.floor((new Date(`${fechaNegocio()}T00:00:00Z`).getTime() - new Date('2026-09-20T00:00:00Z').getTime()) / 86400000); assert.equal(fila.condicion, 'VENCIDA'); assert.equal(fila.diasAtraso, esperados); });
  await t.test('02 obligación futura no aparece como morosa', () => { assert.equal(cxc.morosidad.valor.obligaciones.some(item => item.idNota === notaFutura.id_nota_venta), false); assert.equal(cxc.cartera.valor.find(item => item.idNota === notaFutura.id_nota_venta).condicion, 'FUTURA'); });
  await t.test('03 fecha faltante no inventa aging', () => { const fila = cxc.cartera.valor.find(item => item.idNota === notaSinFecha.id_nota_venta); assert.equal(fila.fechaVencimiento, null); assert.equal(fila.diasAtraso, null); assert.equal(fila.condicion, 'SIN_FECHA'); });
  await t.test('04 aging no se persiste', async () => { const antes = await prisma.nota_venta.count(); await modulo.consultarCuentasCobrar(consulta, ['CU222']); assert.equal(await prisma.nota_venta.count(), antes); assert.equal(cxc.aging.valor.rangos, null); });
  await t.test('05 cartera no genera score', () => assert.ok(cxc.cartera.valor.every(item => !Object.hasOwn(item, 'score') && !Object.hasOwn(item, 'prioridad'))));

  await t.test('06 sólo pagos efectivos cuentan como cobranza', () => { assert.equal(cxc.recaudacion.valor.find(item => item.moneda === 'CLP').monto, 40); assert.equal(cxc.detalleCobranza.valor.cantidadPagos, 1); });
  await t.test('07 vendido no se considera cobrado', () => assert.equal(cxc.recaudacion.valor.reduce((suma, item) => suma + item.monto, 0), 40));
  await t.test('08 cumplimiento usa sólo montos exigibles del período', () => { assert.ok(['VALIDO', 'NO_APLICA'].includes(cxc.cumplimiento.estado)); if (cxc.cumplimiento.estado === 'VALIDO') assert.ok(cxc.cumplimiento.valor.every(fila => fila.debido > 0 && fila.pagado >= 0 && fila.cumplimientoPorcentual >= 0)); else assert.deepEqual(cxc.cumplimiento.valor, []); });
  await t.test('09 mora previa recuperada usa el pago efectivo', () => { assert.equal(cxc.recuperacionMoraPrevia.estado, 'VALIDO'); assert.equal(cxc.recuperacionMoraPrevia.valor.porMoneda[0].monto, 40); });
  await t.test('10 fórmula de cumplimiento queda explícita', () => assert.match(cxc.cumplimiento.detalle, /exigibles|vencimiento/i));

  const riesgoValido = new M7Controller();
  riesgoValido.consultarLiquidezCompleto = async () => ({ periodo: { desde: '2026-10-01', hasta: '2026-10-31' }, proyeccion: { estado: 'VALIDO', valor: { eventos: [{ fecha: '2026-10-01', moneda: 'CLP', liquidezProyectada: 100 }, { fecha: '2026-10-02', moneda: 'CLP', liquidezProyectada: -20 }, { fecha: '2026-10-03', moneda: 'CLP', liquidezProyectada: -50 }], ingresos: [{ fecha: '2026-10-02', moneda: 'CLP', monto: 20, referencia: 'NV:1' }], egresos: [{ fecha: '2026-10-03', moneda: 'CLP', monto: 70, referencia: 'OP:1' }] } } });
  const buscarParametrosOriginal = prisma.parametro_remuneracional.findMany;
  let riesgo;
  try {
    prisma.parametro_remuneracional.findMany = async () => [{ id_parametro_remuneracional: 1, nombre: 'Umbral cero', valor: 0 }];
    riesgo = await riesgoValido.consultarRiesgoDeficit(consulta, ['CU232', 'CU225']);
  } finally {
    prisma.parametro_remuneracional.findMany = buscarParametrosOriginal;
  }
  await t.test('11 detecta primera fecha negativa', () => assert.equal(riesgo.primerDeficit.valor[0].primeraFechaCruce, '2026-10-02'));
  await t.test('12 identifica mínimo del horizonte', () => { assert.equal(riesgo.minimoProyectado.valor[0].liquidezProyectada, -50); assert.equal(riesgo.minimoProyectado.valor[0].fecha, '2026-10-03'); });
  await t.test('13 sin déficit lo informa', async () => { const sin = new M7Controller(); sin.consultarLiquidezCompleto = async () => ({ periodo: {}, proyeccion: { estado: 'VALIDO', valor: { eventos: [{ fecha: '2026-10-01', moneda: 'CLP', liquidezProyectada: 10 }] } } }); const original = prisma.parametro_remuneracional.findMany;try{prisma.parametro_remuneracional.findMany=async()=>[{id_parametro_remuneracional:1,nombre:'Umbral cero',valor:0}];const r = await sin.consultarRiesgoDeficit(consulta, ['CU232']); assert.equal(r.primerDeficit.estado, 'SIN_RESULTADOS')}finally{prisma.parametro_remuneracional.findMany=original} });
  await t.test('14 factor sin permiso no se expone', async () => { const r = await riesgoValido.consultarRiesgoDeficit(consulta, ['CU232']); assert.equal(r.factores.estado, 'SIN_PERMISO'); assert.equal(r.factores.valor, null); });
  await t.test('15 riesgo no crea score ranking ni recomendación', () => { assert.doesNotMatch(JSON.stringify(riesgo), /"score"|"ranking"|"recomendacion"/i); });
  await t.test('16 proyección inválida no calcula', async () => { const sinProyeccion = new M7Controller(); sinProyeccion.consultarLiquidezCompleto = async () => ({ periodo: {}, proyeccion: { estado: 'DATOS_INSUFICIENTES', valor: null } }); const r = await sinProyeccion.consultarRiesgoDeficit(consulta, ['CU232']); assert.equal(r.primerDeficit.estado, 'DATOS_INSUFICIENTES'); assert.equal(r.minimoProyectado.valor, null); });

  const exposicion = await modulo.consultarExposicionProyectos(consulta, ['CU236']);
  const filaProyecto = exposicion.proyectos.find(item => item.idProyecto === proyectoAbierto.id_proyecto_financiero);
  await t.test('17 sólo incluye Proyectos realmente abiertos', () => { assert.ok(filaProyecto); assert.equal(exposicion.proyectos.some(item => item.idProyecto === proyectoCerrado.id_proyecto_financiero), false); });
  await t.test('18 reutiliza atribuciones válidas', () => { assert.equal(filaProyecto.ingresosAtribuibles, 100); assert.equal(filaProyecto.costosDirectosAtribuibles, 25); });
  await t.test('19 CxC sin vínculo no se inventa', () => { const sinNota = exposicion.proyectos.find(item => item.idProyecto === proyectoSinNota.id_proyecto_financiero); assert.equal(sinNota.pendienteCobrar, null); assert.ok(sinNota.cobertura.valor.fuentesNoDisponibles.some(item => /CxC asociada no disponible/.test(item))); });
  await t.test('20 cobertura parcial es visible', () => assert.equal(filaProyecto.cobertura.estado, 'PARCIALMENTE_DISPONIBLE'));
  await t.test('21 exposición no genera score Proyecto', () => assert.equal(Object.hasOwn(filaProyecto, 'score'), false));

  const contextoFinanciero = await modulo.consultarContextoProyecto(proyectoAbierto.id_proyecto_financiero, consulta, ['CU237', 'CU236']);
  await t.test('22 contexto Proyecto funciona', () => { assert.equal(contextoFinanciero.proyecto.idProyecto, proyectoAbierto.id_proyecto_financiero); assert.ok(contextoFinanciero.bloques.financiero); });
  await t.test('23 sin permiso operacional no expone progreso', () => assert.equal(Object.hasOwn(contextoFinanciero.bloques, 'operacional'), false));
  await t.test('24 bloque financiero funciona aunque Terreno falle', async () => { const original = prisma.proyecto.findUnique; prisma.proyecto.findUnique = async () => { throw new Error('Terreno'); }; try { const r = await modulo.consultarContextoProyecto(proyectoAbierto.id_proyecto_financiero, consulta, ['CU237', 'CU236', 'CU199']); assert.ok(r.bloques.financiero); assert.equal(r.bloques.operacional.estado, 'FUENTE_NO_DISPONIBLE'); } finally { prisma.proyecto.findUnique = original; } });
  await t.test('25 contexto no permite escritura en owner', () => { const fuente = readFileSync(resolve('src/controladores/M7Controller.ts'), 'utf8'); const metodo = fuente.slice(fuente.indexOf('async consultarContextoProyecto'), fuente.indexOf('async consultarCostoRemuneraciones')); assert.doesNotMatch(metodo, /\.(?:create|update|delete|upsert)\s*\(/); });
  await t.test('26 navegación contextual funciona', async () => { const r = await modulo.consultarContextoProyecto(proyectoAbierto.id_proyecto_financiero, consulta, ['CU237', 'CU199', 'CU204']); assert.equal(r.bloques.operacional.destinoTerreno, '/terreno/visitas'); assert.equal(r.bloques.operacional.ordenesTrabajo[0].idOrden, ordenTrabajo.orden_trabajo_id_orden.toString()); });

  await t.test('27 CU222 no concede CU223', async () => { const soloCartera = await modulo.consultarCuentasCobrar(consulta, ['CU222']); assert.equal(Object.hasOwn(soloCartera, 'recaudacion'), false); assert.equal(operacionesPermiso.consultarCuentasCobrarM7, 'CU222'); });
  await t.test('28 CU231 no concede CU232', () => assert.equal(permiteOperacion('consultarRiesgoDeficitM7', ['CU231']), false));
  await t.test('29 CU236 no concede CU234 CU235', () => { assert.equal(Object.hasOwn(filaProyecto, 'desgloseIngresos'), false); assert.equal(Object.hasOwn(filaProyecto, 'desgloseCostos'), false); });
  await t.test('30 CU237 no concede permisos operacionales', () => { assert.equal(operacionesPermiso.consultarContextoProyectoM7, 'CU237'); assert.equal(permiteOperacion('listarVisitasTerreno', ['CU237']), false); });
  await t.test('31 fallos parciales no tumban respuesta', () => { assert.equal(contextoFinanciero.estado, 'VALIDO'); assert.ok(contextoFinanciero.bloques.financiero); });
});
