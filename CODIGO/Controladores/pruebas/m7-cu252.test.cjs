const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M7Controller } = require('../dist/controladores/M7Controller');
const { operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

const indicador = (estado, valor, detalle = 'prueba') => ({ estado, valor, detalle, actualizadoEn: new Date() });
const clavesRecursivas = valor => {
  if (!valor || typeof valor !== 'object') return [];
  if (Array.isArray(valor)) return valor.flatMap(clavesRecursivas);
  return Object.entries(valor).flatMap(([clave, contenido]) => [clave, ...clavesRecursivas(contenido)]);
};

test('M7 CU252 atrasos de instalaciones con cobertura parcial', async t => {
  const modulo = new M7Controller();
  const marca = randomUUID().slice(0, 8);
  const ids = { proyectos: [], obras: [], servicios: [], ordenes: [], tareas: [] };
  const consulta = { anio: 2197, mes: 10, fechaReferencia: '2197-10-10' };
  const proyecto = await prisma.proyecto.create({ data: { proyecto_codigo_proyecto: `CU252-${marca}`, proyecto_nombre_referencia: 'Proyecto CU252' } });
  ids.proyectos.push(proyecto.proyecto_proyecto_id);
  const obra = await prisma.obra.create({ data: { obra_nombre_obra: `Obra CU252 ${marca}` } });
  ids.obras.push(obra.obra_obra_id);
  const instalacion = await prisma.servicio_terreno.create({ data: { servicio_terreno_tipo_servicio: 'Instalación', servicio_terreno_estado: 'pendiente', id_obra: obra.obra_obra_id } });
  const levantamiento = await prisma.servicio_terreno.create({ data: { servicio_terreno_tipo_servicio: 'Levantamiento', servicio_terreno_estado: 'pendiente', id_obra: obra.obra_obra_id } });
  ids.servicios.push(instalacion.servicio_terreno_servicio_terreno_id, levantamiento.servicio_terreno_servicio_terreno_id);
  const orden = await prisma.orden_trabajo.create({ data: { orden_trabajo_estado: 'en_progreso', proyecto_id_proyecto: proyecto.proyecto_proyecto_id } });
  ids.ordenes.push(orden.orden_trabajo_id_orden);
  const crearTarea = async (titulo, limite, estado = 'pendiente', idServicio = instalacion.servicio_terreno_servicio_terreno_id) => {
    const tarea = await prisma.tarea.create({ data: { tarea_titulo: `${titulo} ${marca}`, tarea_estado_de_tarea: estado, tarea_horario_limite: limite, tarea_fecha_de_creacion: new Date('2190-01-01'), tarea_fecha_de_ultima_actualizacion: new Date('2196-12-31'), id_servicio_terreno: idServicio, id_orden_trabajo: orden.orden_trabajo_id_orden } });
    ids.tareas.push(tarea.tarea_tarea_id); return tarea;
  };
  const atrasada = await crearTarea('Atrasada', new Date('2197-10-07T12:00:00Z'));
  const futura = await crearTarea('Futura', new Date('2197-10-15T12:00:00Z'));
  const sinFecha = await crearTarea('Sin fecha', null);
  const finalizada = await crearTarea('Finalizada', new Date('2197-10-01T12:00:00Z'), 'completada');
  const anulada = await crearTarea('Anulada', new Date('2197-10-01T12:00:00Z'), 'anulada');
  const noInstalacion = await crearTarea('No instalación', new Date('2197-10-01T12:00:00Z'), 'pendiente', levantamiento.servicio_terreno_servicio_terreno_id);
  const sinRelacion = await crearTarea('Sin relación', new Date('2197-10-01T12:00:00Z'), 'pendiente', null);

  try {
    const buscarTareasOriginal = prisma.tarea.findMany;
    let resultado;
    try {
      prisma.tarea.findMany = async (...argumentos) => (await buscarTareasOriginal.apply(prisma.tarea, argumentos)).filter(tarea => ids.tareas.includes(tarea.tarea_tarea_id));
      resultado = await modulo.consultarAtrasosInstalaciones(consulta);
    } finally {
      prisma.tarea.findMany = buscarTareasOriginal;
    }
    const idsAtrasados = resultado.atrasos.valor.map(fila => fila.idTarea);
    const idsEnPlazo = resultado.enPlazo.valor.map(fila => fila.idTarea);
    const idsSinFecha = resultado.sinInformacionTemporal.valor.map(fila => fila.idTarea);
    await t.test('01 límite vencido y estado activo produce atraso', () => assert.ok(idsAtrasados.includes(atrasada.tarea_tarea_id.toString())));
    await t.test('02 días de atraso usan calendario', () => assert.equal(resultado.atrasos.valor.find(fila => fila.idTarea === atrasada.tarea_tarea_id.toString()).diasAtraso, 3));
    await t.test('03 límite futuro queda en plazo', () => assert.ok(idsEnPlazo.includes(futura.tarea_tarea_id.toString())));
    await t.test('04 límite ausente no es cero ni en plazo', () => { assert.ok(idsSinFecha.includes(sinFecha.tarea_tarea_id.toString())); assert.equal(resultado.sinInformacionTemporal.valor.find(fila => fila.idTarea === sinFecha.tarea_tarea_id.toString()).diasAtraso, null); assert.equal(idsEnPlazo.includes(sinFecha.tarea_tarea_id.toString()), false); });
    await t.test('05 relación no inequívoca queda excluida', () => { assert.equal(idsAtrasados.includes(noInstalacion.tarea_tarea_id.toString()), false); assert.equal(idsAtrasados.includes(sinRelacion.tarea_tarea_id.toString()), false); assert.ok(resultado.relacionInstalacionNoConfirmada.valor.cantidad >= 2); });
    await t.test('06 tarea finalizada no aparece como atraso activo', () => assert.equal(idsAtrasados.includes(finalizada.tarea_tarea_id.toString()), false));
    await t.test('07 tarea anulada no aparece como atraso activo', () => assert.equal(idsAtrasados.includes(anulada.tarea_tarea_id.toString()), false));
    const fuente = readFileSync(resolve('src/controladores/M7Controller.ts'), 'utf8');
    const bloque = fuente.slice(fuente.indexOf('async consultarAtrasosInstalaciones'), fuente.indexOf('async consultarIncidenciasRetrabajos'));
    await t.test('08 no usa fecha creación como inicio', () => assert.doesNotMatch(bloque, /tarea_fecha_de_creacion/));
    await t.test('09 no usa actualización como término', () => assert.doesNotMatch(bloque, /tarea_fecha_de_ultima_actualizacion/));
    await t.test('10 duración queda no calculable', () => { assert.equal(resultado.duracion.estado, 'DATOS_INSUFICIENTES'); assert.equal(resultado.duracion.valor, null); });
    await t.test('11 tiempo de ciclo queda no calculable', () => { assert.equal(resultado.tiempoCiclo.estado, 'DATOS_INSUFICIENTES'); assert.equal(resultado.tiempoCiclo.valor, null); });
    await t.test('12 fecha ejecución no se usa como inicio', () => assert.doesNotMatch(bloque, /fecha_ejecucion/));
    await t.test('13 CU250 no concede CU252', () => { assert.equal(operacionesPermiso.consultarAtrasosInstalacionesM7, 'CU252'); assert.equal(permiteOperacion('consultarAtrasosInstalacionesM7', ['CU250']), false); });
    await t.test('14 CU253 no concede CU252', () => assert.equal(permiteOperacion('consultarAtrasosInstalacionesM7', ['CU253']), false));
    await t.test('15 CU252 no escribe en Terreno', () => assert.doesNotMatch(bloque, /\.(?:create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/));
    await t.test('16 Centro de Atención integra atraso válido', async () => { const centro = await modulo.consultarCentroAtencion(consulta, ['CU216', 'CU252']); assert.ok(centro.excepciones.some(fila => fila.familia === 'INSTALACIONES_ATRASADAS')); });
    await t.test('17 Centro de Atención no alerta por ausencia de fecha', async () => {
      class SinAtraso extends M7Controller { async consultarAtrasosInstalaciones() { return { estado: 'PARCIALMENTE_DISPONIBLE', atrasos: indicador('SIN_RESULTADOS', []), cobertura: indicador('PARCIALMENTE_DISPONIBLE', { sinFechaSuficiente: 1 }) }; } }
      const centro = await new SinAtraso().consultarCentroAtencion(consulta, ['CU216', 'CU252']); assert.equal(centro.excepciones.some(fila => fila.familia === 'INSTALACIONES_ATRASADAS'), false);
    });
    await t.test('18 fallo CU252 no tumba CU250 ni CU253', async () => {
      class FallaCu252 extends M7Controller { async consultarAtrasosInstalaciones() { throw new Error('fuente CU252'); } }
      const panel = await new FallaCu252().consultarPanelGeneral(consulta, ['CU250', 'CU252', 'CU253']);
      assert.equal(panel.bloques.atrasosInstalaciones.estado, 'FUENTE_NO_DISPONIBLE'); assert.notEqual(panel.bloques.instalaciones.estado, 'FUENTE_NO_DISPONIBLE'); assert.notEqual(panel.bloques.incidenciasRetrabajos.estado, 'FUENTE_NO_DISPONIBLE');
    });
    await t.test('19 no crea score ni prioridad', () => { const claves = clavesRecursivas(resultado); assert.equal(claves.includes('score'), false); assert.equal(claves.includes('prioridad'), false); });
    await t.test('20 conserva sólo las migraciones M7 autorizadas', () => assert.deepEqual(readdirSync(resolve('prisma/migrations')).filter(nombre => /m7/i.test(nombre)), ['040_m7_parametros_dashboard', '041_m7_delta_controlado']));
  } finally {
    await prisma.tarea.deleteMany({ where: { tarea_tarea_id: { in: ids.tareas } } });
    await prisma.orden_trabajo.deleteMany({ where: { orden_trabajo_id_orden: { in: ids.ordenes } } });
    await prisma.servicio_terreno.deleteMany({ where: { servicio_terreno_servicio_terreno_id: { in: ids.servicios } } });
    await prisma.obra.deleteMany({ where: { obra_obra_id: { in: ids.obras } } });
    await prisma.proyecto.deleteMany({ where: { proyecto_proyecto_id: { in: ids.proyectos } } });
  }
});
