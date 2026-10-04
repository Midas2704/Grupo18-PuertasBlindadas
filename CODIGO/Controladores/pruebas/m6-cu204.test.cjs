const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');
const { codigosTodosLosCU, matrizPermisosPorCU, operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

test('M6 Terreno CU204 genera una OT idempotente desde el levantamiento vigente', async (t) => {
  const modulo = new M6Controller(); const sufijo = randomUUID().slice(0, 8);
  const ids = { usuarios: [], tareas: [], visitas: [], obras: [], especificaciones: [], clientes: [], proyectos: [], ots: [] };
  const cliente = await prisma.cliente.create({ data: { cliente_cliente_rut: `O${sufijo}`.slice(0, 12), cliente_razon_social: `Cliente OT ${sufijo}` } }); ids.clientes.push(cliente.cliente_cliente_rut);
  const proyecto = await prisma.proyecto.create({ data: { proyecto_codigo_proyecto: `OT-${sufijo}`, proyecto_nombre_referencia: `Proyecto no inferible ${sufijo}`, rut_cliente: cliente.cliente_cliente_rut } }); ids.proyectos.push(proyecto.proyecto_proyecto_id);
  const puerta = await prisma.especificaciones_puerta.create({ data: { especificacion_puerta_modelo_puerta: `Puerta OT ${sufijo}`, especificacion_puerta_zona: 'Acceso principal' } }); ids.especificaciones.push(puerta.especificacion_puerta_especificacion_puerta_id);
  const obra = await prisma.obra.create({ data: { obra_nombre_obra: `Obra OT ${sufijo}`, rut_cliente: cliente.cliente_cliente_rut, id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }); ids.obras.push(obra.obra_obra_id);
  const visita = await prisma.servicio_terreno.create({ data: { servicio_terreno_tipo_servicio: 'Levantamiento', id_obra: obra.obra_obra_id } }); ids.visitas.push(visita.servicio_terreno_servicio_terreno_id);
  const tecnico = await prisma.usuario.create({ data: { usuario_username: `ot_${sufijo}` } }); const ajeno = await prisma.usuario.create({ data: { usuario_username: `ot_ajeno_${sufijo}` } }); ids.usuarios.push(tecnico.usuario_id_usuario, ajeno.usuario_id_usuario);
  const tarea = await prisma.tarea.create({ data: { tarea_titulo: `Generar OT ${sufijo}`, id_servicio_terreno: visita.servicio_terreno_servicio_terreno_id, id_usuario: ajeno.usuario_id_usuario } }); ids.tareas.push(tarea.tarea_tarea_id);
  await prisma.tarea_usuario.create({ data: { tarea_usuario_tarea_id: tarea.tarea_tarea_id, tarea_usuario_usuario_id: tecnico.usuario_id_usuario } });
  const actor = { id: tecnico.usuario_id_usuario, administrador: false }; const actorAjeno = { id: ajeno.usuario_id_usuario, administrador: false };
  try {
    await t.test('bloquea tarea sin levantamiento registrado y usuario no asignado', async () => {
      await assert.rejects(modulo.generarOrdenTrabajoLevantamiento(Number(tarea.tarea_tarea_id), actor), (error) => error.estado === 409);
      await assert.rejects(modulo.generarOrdenTrabajoLevantamiento(Number(tarea.tarea_tarea_id), actorAjeno), (error) => error.estado === 403);
      await assert.rejects(modulo.generarOrdenTrabajoLevantamiento(999999999, actor), (error) => error.estado === 404);
    });
    await modulo.guardarLevantamientoTerreno(Number(tarea.tarea_tarea_id), { medidas: { marcoAncho: '95', marcoAlto: '212' } }, actor);
    await t.test('genera OT pendiente vinculada a la especificación sin proyecto área ni usuario', async () => {
      const resultado = await modulo.generarOrdenTrabajoLevantamiento(Number(tarea.tarea_tarea_id), actor); const ot = resultado.ordenTrabajo; ids.ots.push(BigInt(ot.id));
      assert.equal(ot.estado, 'pendiente'); assert.equal(ot.idEspecificacion, puerta.especificacion_puerta_especificacion_puerta_id.toString()); assert.ok(ot.fecha);
      assert.equal(ot.proyecto, null); assert.equal(ot.area, null); assert.equal(ot.usuario, null); assert.equal(resultado.obra.cliente.rut, cliente.cliente_cliente_rut);
      const fisica = await prisma.orden_trabajo.findUniqueOrThrow({ where: { orden_trabajo_id_orden: BigInt(ot.id) } });
      assert.equal(fisica.especificaciones_puerta_id_especificacion_puerta, puerta.especificacion_puerta_especificacion_puerta_id); assert.equal(fisica.proyecto_id_proyecto, null); assert.notEqual(proyecto.proyecto_proyecto_id, fisica.proyecto_id_proyecto);
    });
    await t.test('segunda llamada y consulta devuelven la misma OT sin duplicar', async () => {
      const primera = await modulo.obtenerLevantamientoTerreno(Number(tarea.tarea_tarea_id), actor); const segunda = await modulo.generarOrdenTrabajoLevantamiento(Number(tarea.tarea_tarea_id), actor);
      assert.equal(segunda.ordenTrabajo.id, primera.ordenTrabajo.id); assert.equal(await prisma.orden_trabajo.count({ where: { especificaciones_puerta_id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id, orden_trabajo_estado: 'pendiente' } }), 1);
    });
    await t.test('dos creaciones concurrentes dejan y devuelven una sola OT pendiente', async () => {
      await prisma.orden_trabajo.deleteMany({ where: { especificaciones_puerta_id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }); ids.ots.length = 0;
      const carrera = await Promise.all([modulo.generarOrdenTrabajoLevantamiento(Number(tarea.tarea_tarea_id), actor), modulo.generarOrdenTrabajoLevantamiento(Number(tarea.tarea_tarea_id), actor)]);
      assert.equal(carrera[0].ordenTrabajo.id, carrera[1].ordenTrabajo.id); ids.ots.push(BigInt(carrera[0].ordenTrabajo.id));
      assert.equal(await prisma.orden_trabajo.count({ where: { especificaciones_puerta_id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id, orden_trabajo_estado: 'pendiente' } }), 1);
    });
    await t.test('CU203 sigue corrigiendo el mismo levantamiento sin perder la OT', async () => {
      const corregido = await modulo.corregirLevantamientoTerreno(Number(tarea.tarea_tarea_id), { motivo: 'Ajuste posterior a generación OT', medidas: { marcoAncho: '96' } }, actor);
      assert.equal(corregido.medidas.marcoAncho, '96'); assert.equal(corregido.ordenTrabajo.id, ids.ots[0].toString()); assert.equal(corregido.ordenTrabajo.idEspecificacion, puerta.especificacion_puerta_especificacion_puerta_id.toString());
    });
    await t.test('permiso CU204 sigue independiente al incorporar CU205', async () => {
      assert.equal(codigosTodosLosCU.length, 274); assert.deepEqual(matrizPermisosPorCU.CU204, []); assert.equal(operacionesPermiso.generarOrdenTrabajoLevantamiento, 'CU204');
      assert.equal(permiteOperacion('generarOrdenTrabajoLevantamiento', ['CU203']), false); assert.equal(permiteOperacion('generarOrdenTrabajoLevantamiento', ['CU205']), false); assert.equal(permiteOperacion('obtenerLevantamientoTerreno', ['CU204']), true); assert.equal(codigosTodosLosCU.includes('CU205'), true);
      const autorizacion = { autorizar: async (operacion) => { if (!permiteOperacion(operacion, ['CU204'])) { const error = new Error('No autorizado'); error.estado = 403; throw error; } return { ...actor, permisos: ['CU204'], configuracion: 'particular' }; } };
      const m6 = { generarOrdenTrabajoLevantamiento: async (_id, recibido) => recibido.id.toString() };
      const fachada = new C_Finanzas(autorizacion, {}, {}, {}, {}, {}, m6); assert.equal(await fachada.ejecutar('generarOrdenTrabajoLevantamiento', { parametros: { id: tarea.tarea_tarea_id.toString() }, contexto: {} }), tecnico.usuario_id_usuario.toString());
      const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8'); assert.equal((schema.match(/model\s+orden_trabajo\s*\{/g) || []).length, 1); assert.doesNotMatch(schema, /@@schema\("terreno"\)[\s\S]{0,80}model\s+orden_trabajo/);
    });
  } finally {
    await prisma.orden_trabajo.deleteMany({ where: { especificaciones_puerta_id_especificacion_puerta: { in: ids.especificaciones } } });
    await prisma.especificaciones_puerta.updateMany({ where: { especificacion_puerta_especificacion_puerta_id: { in: ids.especificaciones } }, data: { id_medidas: null } });
    await prisma.medidas_puerta.deleteMany({ where: { id_especificacion_puerta: { in: ids.especificaciones } } }); await prisma.historial_cambio_orden_trabajo.deleteMany({ where: { id_especificaciones_puerta: { in: ids.especificaciones } } });
    await prisma.tarea_usuario.deleteMany({ where: { tarea_usuario_tarea_id: { in: ids.tareas } } }); await prisma.tarea.deleteMany({ where: { tarea_tarea_id: { in: ids.tareas } } });
    await prisma.servicio_terreno.deleteMany({ where: { servicio_terreno_servicio_terreno_id: { in: ids.visitas } } }); await prisma.obra.deleteMany({ where: { obra_obra_id: { in: ids.obras } } });
    await prisma.proyecto.deleteMany({ where: { proyecto_proyecto_id: { in: ids.proyectos } } }); await prisma.especificaciones_puerta.deleteMany({ where: { especificacion_puerta_especificacion_puerta_id: { in: ids.especificaciones } } });
    await prisma.cliente.deleteMany({ where: { cliente_cliente_rut: { in: ids.clientes } } }); await prisma.usuario.deleteMany({ where: { usuario_id_usuario: { in: ids.usuarios } } });
  }
});
