const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');
const { codigosTodosLosCU, matrizPermisosPorCU, operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

test('M6 Terreno CU205 ajusta y libera la OT reutilizando el levantamiento vigente', async (t) => {
  const modulo = new M6Controller(); const sufijo = randomUUID().slice(0, 8);
  const ids = { usuarios: [], tareas: [], visitas: [], obras: [], especificaciones: [], clientes: [], ots: [] };
  const cliente = await prisma.cliente.create({ data: { cliente_cliente_rut: `L${sufijo}`.slice(0, 12), cliente_razon_social: `Cliente liberar ${sufijo}` } }); ids.clientes.push(cliente.cliente_cliente_rut);
  const puerta = await prisma.especificaciones_puerta.create({ data: { especificacion_puerta_modelo_puerta: `Puerta liberar ${sufijo}`, especificacion_puerta_zona: 'Acceso producción' } }); ids.especificaciones.push(puerta.especificacion_puerta_especificacion_puerta_id);
  const obra = await prisma.obra.create({ data: { obra_nombre_obra: `Obra liberar ${sufijo}`, rut_cliente: cliente.cliente_cliente_rut, id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }); ids.obras.push(obra.obra_obra_id);
  const visita = await prisma.servicio_terreno.create({ data: { servicio_terreno_tipo_servicio: 'Levantamiento', id_obra: obra.obra_obra_id } }); ids.visitas.push(visita.servicio_terreno_servicio_terreno_id);
  const tecnico = await prisma.usuario.create({ data: { usuario_username: `lib_${sufijo}` } }); ids.usuarios.push(tecnico.usuario_id_usuario);
  const tarea = await prisma.tarea.create({ data: { tarea_titulo: `Liberar OT ${sufijo}`, id_servicio_terreno: visita.servicio_terreno_servicio_terreno_id } }); ids.tareas.push(tarea.tarea_tarea_id);
  await prisma.tarea_usuario.create({ data: { tarea_usuario_tarea_id: tarea.tarea_tarea_id, tarea_usuario_usuario_id: tecnico.usuario_id_usuario } });
  const actor = { id: tecnico.usuario_id_usuario, administrador: false };
  try {
    await modulo.guardarLevantamientoTerreno(Number(tarea.tarea_tarea_id), { medidas: { marcoAncho: '90', marcoAlto: '210' } }, actor);
    await t.test('CU204 crea pendiente y conserva referencias operativas nulas', async () => {
      const resultado = await modulo.generarOrdenTrabajoLevantamiento(Number(tarea.tarea_tarea_id), actor); ids.ots.push(BigInt(resultado.ordenTrabajo.id));
      assert.equal(resultado.ordenTrabajo.estado, 'pendiente'); assert.equal(resultado.ordenTrabajo.proyecto, null); assert.equal(resultado.ordenTrabajo.area, null); assert.equal(resultado.ordenTrabajo.usuario, null);
    });
    await t.test('una OT activa previa se reconoce sin duplicarla', async () => {
      await prisma.orden_trabajo.update({ where: { orden_trabajo_id_orden: ids.ots[0] }, data: { orden_trabajo_estado: 'activa' } });
      const resultado = await modulo.generarOrdenTrabajoLevantamiento(Number(tarea.tarea_tarea_id), actor);
      assert.equal(resultado.ordenTrabajo.id, ids.ots[0].toString()); assert.equal(resultado.ordenTrabajo.estado, 'activa');
      assert.equal(await prisma.orden_trabajo.count({ where: { especificaciones_puerta_id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }), 1);
    });
    await t.test('una OT pendiente tampoco se duplica', async () => {
      await prisma.orden_trabajo.update({ where: { orden_trabajo_id_orden: ids.ots[0] }, data: { orden_trabajo_estado: 'pendiente' } });
      const resultado = await modulo.generarOrdenTrabajoLevantamiento(Number(tarea.tarea_tarea_id), actor);
      assert.equal(resultado.ordenTrabajo.id, ids.ots[0].toString()); assert.equal(await prisma.orden_trabajo.count({ where: { especificaciones_puerta_id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }), 1);
    });
    await t.test('ajustar OT reutiliza historial CU203 y preserva la medida anterior', async () => {
      const antes = await modulo.obtenerLevantamientoTerreno(Number(tarea.tarea_tarea_id), actor); const idAnterior = BigInt(antes.medidas.id);
      const resultado = await modulo.ajustarOrdenTrabajoTerreno(Number(tarea.tarea_tarea_id), { motivo: 'Ajuste previo a producción', medidas: { marcoAncho: '91.5' } }, actor);
      assert.equal(resultado.medidas.marcoAncho, '91.5'); assert.notEqual(resultado.medidas.id, idAnterior.toString()); assert.equal(resultado.historial.at(-1).versionNueva, 'v2');
      assert.equal((await prisma.medidas_puerta.findUniqueOrThrow({ where: { medidas_puerta_medidas_id: idAnterior } })).medidas_puerta_medidas_marco_ancho.toString(), '90');
    });
    await t.test('libera pendiente a en_progreso sin tocar materiales reservas ni referencias', async () => {
      const historialAntes = await prisma.historial_cambio_orden_trabajo.count({ where: { id_especificaciones_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }); const materialesAntes = await prisma.material_orden_trabajo.count({ where: { orden_trabajo_id_orden: ids.ots[0] } }); const reservasAntes = await prisma.reserva_inventario.count({ where: { orden_trabajo_id_orden: ids.ots[0] } });
      const resultado = await modulo.liberarOrdenTrabajoTerreno(Number(tarea.tarea_tarea_id), Number(ids.ots[0]), actor); assert.equal(resultado.ordenTrabajo.estado, 'en_progreso');
      const fisica = await prisma.orden_trabajo.findUniqueOrThrow({ where: { orden_trabajo_id_orden: ids.ots[0] } }); assert.equal(fisica.proyecto_id_proyecto, null); assert.equal(fisica.area_trabajo_id_area, null); assert.equal(fisica.usuario_id_usuario, null);
      assert.equal(await prisma.historial_cambio_orden_trabajo.count({ where: { id_especificaciones_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }), historialAntes); assert.equal(await prisma.material_orden_trabajo.count({ where: { orden_trabajo_id_orden: ids.ots[0] } }), materialesAntes); assert.equal(await prisma.reserva_inventario.count({ where: { orden_trabajo_id_orden: ids.ots[0] } }), reservasAntes);
    });
    await t.test('en_progreso no puede liberarse otra vez', async () => {
      await assert.rejects(modulo.liberarOrdenTrabajoTerreno(Number(tarea.tarea_tarea_id), Number(ids.ots[0]), actor), (error) => error.estado === 409);
    });
    await t.test('CU204 no duplica una OT ya liberada en_progreso', async () => {
      const resultado = await modulo.generarOrdenTrabajoLevantamiento(Number(tarea.tarea_tarea_id), actor);
      assert.equal(resultado.ordenTrabajo.id, ids.ots[0].toString()); assert.equal(resultado.ordenTrabajo.estado, 'en_progreso');
      assert.equal(await prisma.orden_trabajo.count({ where: { especificaciones_puerta_id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }), 1);
    });
    await t.test('activa puede liberarse por compatibilidad', async () => {
      await prisma.orden_trabajo.update({ where: { orden_trabajo_id_orden: ids.ots[0] }, data: { orden_trabajo_estado: 'activa' } });
      assert.equal((await modulo.liberarOrdenTrabajoTerreno(Number(tarea.tarea_tarea_id), Number(ids.ots[0]), actor)).ordenTrabajo.estado, 'en_progreso');
    });
    await t.test('completada y cancelada son terminales', async () => {
      for (const estado of ['completada', 'cancelada']) { await prisma.orden_trabajo.update({ where: { orden_trabajo_id_orden: ids.ots[0] }, data: { orden_trabajo_estado: estado } }); await assert.rejects(modulo.liberarOrdenTrabajoTerreno(Number(tarea.tarea_tarea_id), Number(ids.ots[0]), actor), (error) => error.estado === 409); const resultado = await modulo.generarOrdenTrabajoLevantamiento(Number(tarea.tarea_tarea_id), actor); assert.equal(resultado.ordenTrabajo.id, ids.ots[0].toString()); assert.equal(resultado.ordenTrabajo.estado, estado); assert.equal(await prisma.orden_trabajo.count({ where: { especificaciones_puerta_id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }), 1); }
    });
    await t.test('doble liberación concurrente produce un éxito y un conflicto', async () => {
      await prisma.orden_trabajo.update({ where: { orden_trabajo_id_orden: ids.ots[0] }, data: { orden_trabajo_estado: 'pendiente' } });
      const resultados = await Promise.allSettled([modulo.liberarOrdenTrabajoTerreno(Number(tarea.tarea_tarea_id), Number(ids.ots[0]), actor), modulo.liberarOrdenTrabajoTerreno(Number(tarea.tarea_tarea_id), Number(ids.ots[0]), actor)]);
      assert.equal(resultados.filter((resultado) => resultado.status === 'fulfilled').length, 1); assert.equal(resultados.filter((resultado) => resultado.status === 'rejected' && resultado.reason.estado === 409).length, 1);
      assert.equal((await prisma.orden_trabajo.findUniqueOrThrow({ where: { orden_trabajo_id_orden: ids.ots[0] } })).orden_trabajo_estado, 'en_progreso');
    });
    await t.test('CU205 es independiente y CU207 permanece ausente', async () => {
      assert.equal(codigosTodosLosCU.length, 274); assert.deepEqual(matrizPermisosPorCU.CU205, []); assert.equal(operacionesPermiso.ajustarOrdenTrabajoTerreno, 'CU205'); assert.equal(operacionesPermiso.liberarOrdenTrabajoTerreno, 'CU205');
      assert.equal(permiteOperacion('liberarOrdenTrabajoTerreno', ['CU204']), false); assert.equal(permiteOperacion('liberarOrdenTrabajoTerreno', ['CU205']), true); assert.equal(permiteOperacion('obtenerLevantamientoTerreno', ['CU205']), true); assert.equal(codigosTodosLosCU.includes('CU206'), true); assert.equal(codigosTodosLosCU.includes('CU215'),true);
      const autorizacion = { autorizar: async (operacion) => { if (!permiteOperacion(operacion, ['CU205'])) { const error = new Error('No autorizado'); error.estado = 403; throw error; } return { ...actor, permisos: ['CU205'], configuracion: 'particular' }; } };
      const m6 = { ajustarOrdenTrabajoTerreno: async (_id, cuerpo, recibido) => ({ motivo: cuerpo.motivo, actor: recibido.id.toString() }), liberarOrdenTrabajoTerreno: async (_id, ordenId, recibido) => ({ ordenId, actor: recibido.id.toString() }) };
      const fachada = new C_Finanzas(autorizacion, {}, {}, {}, {}, {}, m6); assert.equal((await fachada.ejecutar('ajustarOrdenTrabajoTerreno', { parametros: { id: tarea.tarea_tarea_id.toString() }, cuerpo: { motivo: 'x' }, contexto: {} })).actor, tecnico.usuario_id_usuario.toString()); assert.equal((await fachada.ejecutar('liberarOrdenTrabajoTerreno', { parametros: { id: tarea.tarea_tarea_id.toString(), ordenId: ids.ots[0].toString() }, contexto: {} })).ordenId, Number(ids.ots[0]));
      const rutas = readFileSync(resolve('src/rutas/finanzas.ts'), 'utf8'); assert.match(rutas, /ajustarOrdenTrabajoTerreno/); assert.match(rutas, /liberarOrdenTrabajoTerreno/); assert.match(rutas, /generarTareasProduccion/); assert.doesNotMatch(rutas, /CU207/);
    });
  } finally {
    await prisma.orden_trabajo.deleteMany({ where: { especificaciones_puerta_id_especificacion_puerta: { in: ids.especificaciones } } });
    await prisma.especificaciones_puerta.updateMany({ where: { especificacion_puerta_especificacion_puerta_id: { in: ids.especificaciones } }, data: { id_medidas: null } });
    await prisma.medidas_puerta.deleteMany({ where: { id_especificacion_puerta: { in: ids.especificaciones } } }); await prisma.historial_cambio_orden_trabajo.deleteMany({ where: { id_especificaciones_puerta: { in: ids.especificaciones } } });
    await prisma.tarea_usuario.deleteMany({ where: { tarea_usuario_tarea_id: { in: ids.tareas } } }); await prisma.tarea.deleteMany({ where: { tarea_tarea_id: { in: ids.tareas } } });
    await prisma.servicio_terreno.deleteMany({ where: { servicio_terreno_servicio_terreno_id: { in: ids.visitas } } }); await prisma.obra.deleteMany({ where: { obra_obra_id: { in: ids.obras } } });
    await prisma.especificaciones_puerta.deleteMany({ where: { especificacion_puerta_especificacion_puerta_id: { in: ids.especificaciones } } }); await prisma.cliente.deleteMany({ where: { cliente_cliente_rut: { in: ids.clientes } } }); await prisma.usuario.deleteMany({ where: { usuario_id_usuario: { in: ids.usuarios } } });
  }
});
