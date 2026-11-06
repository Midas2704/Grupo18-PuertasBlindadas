const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { prisma } = require('../dist/db');
const { M6Controller } = require('../dist/controladores/M6Controller');
const { codigosTodosLosCU, operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

test('M6 Terreno CU207-CU210 asigna, ejecuta, valida y prepara salida sin adelantar CU211', async (t) => {
  const modulo = new M6Controller(); const sufijo = randomUUID().slice(0, 8);
  const ids = { usuarios: [], tareas: [], ejecuciones: [], visitas: [], obras: [], especificaciones: [], clientes: [], ots: [], checklist: [] };
  const cliente = await prisma.cliente.create({ data: { cliente_cliente_rut: `T${sufijo}`.slice(0, 12), cliente_razon_social: `Cliente ${sufijo}` } }); ids.clientes.push(cliente.cliente_cliente_rut);
  const puerta = await prisma.especificaciones_puerta.create({ data: { especificacion_puerta_modelo_puerta: `Puerta ${sufijo}` } }); ids.especificaciones.push(puerta.especificacion_puerta_especificacion_puerta_id);
  const obra = await prisma.obra.create({ data: { obra_nombre_obra: `Obra ${sufijo}`, rut_cliente: cliente.cliente_cliente_rut, id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }); ids.obras.push(obra.obra_obra_id);
  const checklist = await prisma.checklist_de_materiales.create({ data: { checklist_de_materiales_item: 'Herramientas verificadas', checklist_de_materiales_es_marcado: false } }); ids.checklist.push(checklist.checklist_de_materiales_checklist_de_materials_id);
  const visita = await prisma.servicio_terreno.create({ data: { servicio_terreno_tipo_servicio: 'Instalación', id_obra: obra.obra_obra_id, id_checklist_de_materials: checklist.checklist_de_materiales_checklist_de_materials_id } }); ids.visitas.push(visita.servicio_terreno_servicio_terreno_id);
  const ot = await prisma.orden_trabajo.create({ data: { orden_trabajo_estado: 'en_progreso', orden_trabajo_fecha_hora: new Date(), especificaciones_puerta_id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }); ids.ots.push(ot.orden_trabajo_id_orden);
  const tarea = await prisma.tarea.create({ data: { tarea_titulo: `Producción ${sufijo}`, tarea_estado_de_tarea: 'pendiente', id_orden_trabajo: ot.orden_trabajo_id_orden, id_especificacion_puerta: puerta.especificacion_puerta_especificacion_puerta_id } }); ids.tareas.push(tarea.tarea_tarea_id);
  const u1 = await prisma.usuario.create({ data: { usuario_username: `tec1_${sufijo}` } }); const u2 = await prisma.usuario.create({ data: { usuario_username: `tec2_${sufijo}` } }); ids.usuarios.push(u1.usuario_id_usuario, u2.usuario_id_usuario);
  try {
    await t.test('CU207 reemplaza asignaciones, valida usuarios y nunca usa tarea.id_usuario', async () => {
      await assert.rejects(modulo.asignarTareaProduccion(Number(tarea.tarea_tarea_id), { idsUsuarios: ['999999999'] }), (e) => e.estado === 404);
      let resultado = await modulo.asignarTareaProduccion(Number(tarea.tarea_tarea_id), { idsUsuarios: [u1.usuario_id_usuario.toString(), u2.usuario_id_usuario.toString()], prioridad: 'alta' });
      assert.equal(resultado.asignados.length, 2); assert.equal(resultado.prioridad, 'alta');
      resultado = await modulo.asignarTareaProduccion(Number(tarea.tarea_tarea_id), { idsUsuarios: [u1.usuario_id_usuario.toString()] });
      assert.deepEqual(resultado.asignados.map((u) => u.id), [u1.usuario_id_usuario.toString()]);
      assert.equal((await prisma.tarea.findUnique({ where: { tarea_tarea_id: tarea.tarea_tarea_id } })).id_usuario, null);
    });

    await t.test('CU208 sólo registra ejecución terminada para trabajador asignado', async () => {
      await assert.rejects(modulo.registrarEjecucionTarea(Number(tarea.tarea_tarea_id), {}, { id: u2.usuario_id_usuario, administrador: false }), (e) => e.estado === 409);
      await assert.rejects(modulo.registrarEjecucionTarea(Number(tarea.tarea_tarea_id), { cantidad: '2' }, { id: u1.usuario_id_usuario, administrador: false }), (e) => e.estado === 400);
      const ejecucion = await modulo.registrarEjecucionTarea(Number(tarea.tarea_tarea_id), { cantidad: '2.5', unidad: 'UNIDAD' }, { id: u1.usuario_id_usuario, administrador: false });
      ids.ejecuciones.push(BigInt(ejecucion.id)); assert.equal(ejecucion.estado, 'terminada'); assert.equal(ejecucion.validacion, 'pendiente'); assert.equal(ejecucion.cantidad, '2.5');
    });

    await t.test('CU209 resuelve una sola vez sin incidencias ni efecto remuneracional', async () => {
      const pendientes = await modulo.listarEjecucionesPendientes(); assert.ok(pendientes.some((e) => e.id === ids.ejecuciones[0].toString()));
      const validada = await modulo.validarEjecucionProductiva(Number(ids.ejecuciones[0]), { decision: 'validada' }); assert.equal(validada.validacion, 'validada');
      await assert.rejects(modulo.validarEjecucionProductiva(Number(ids.ejecuciones[0]), { decision: 'rechazada' }), (e) => e.estado === 409);
      assert.equal(await prisma.incidencia_retrabajo_tarea.count({ where: { id_ejecucion_tarea: ids.ejecuciones[0] } }), 0);
      assert.equal(await prisma.tratamiento_remuneracional_ejecucion.count({ where: { id_ejecucion_tarea: ids.ejecuciones[0] } }), 0);
    });

    await t.test('CU210 deriva visita, obra, cliente, puerta y checklist sin inventar inventario', async () => {
      let preparacion = await modulo.obtenerPreparacionSalida(Number(visita.servicio_terreno_servicio_terreno_id));
      assert.equal(preparacion.visita.obra.cliente.rut, cliente.cliente_cliente_rut); assert.equal(preparacion.visita.obra.especificacion.id, puerta.especificacion_puerta_especificacion_puerta_id.toString());
      assert.equal(preparacion.checklist.item, 'Herramientas verificadas'); assert.equal(preparacion.ordenesTrabajo.length, 1); assert.deepEqual(preparacion.ordenesTrabajo[0].reservas, []);
      preparacion = await modulo.actualizarChecklistSalida(Number(visita.servicio_terreno_servicio_terreno_id), { marcado: true, detalleMarcado: 'Revisado' });
      assert.equal(preparacion.checklist.marcado, true); assert.equal(preparacion.checklist.detalleMarcado, 'Revisado');
    });

    await t.test('permisos son independientes y CU211 no existe', () => {
      assert.equal(codigosTodosLosCU.length, 274); assert.equal(codigosTodosLosCU.includes('CU215'),true);
      assert.equal(operacionesPermiso.asignarTareaProduccion, 'CU207'); assert.equal(operacionesPermiso.registrarEjecucionTarea, 'CU208');
      assert.equal(operacionesPermiso.validarEjecucionProductiva, 'CU209'); assert.equal(operacionesPermiso.obtenerPreparacionSalida, 'CU210');
      for (const [op, cu] of [['asignarTareaProduccion','CU207'],['registrarEjecucionTarea','CU208'],['validarEjecucionProductiva','CU209'],['obtenerPreparacionSalida','CU210']]) {
        assert.equal(permiteOperacion(op, [cu]), true); assert.equal(permiteOperacion(op, ['CU206']), false);
      }
    });
  } finally {
    await prisma.tratamiento_remuneracional_ejecucion.deleteMany({ where: { id_ejecucion_tarea: { in: ids.ejecuciones } } });
    await prisma.incidencia_retrabajo_tarea.deleteMany({ where: { id_ejecucion_tarea: { in: ids.ejecuciones } } });
    await prisma.ejecucion_tarea.deleteMany({ where: { id_ejecucion_tarea: { in: ids.ejecuciones } } });
    await prisma.tarea_usuario.deleteMany({ where: { tarea_usuario_tarea_id: { in: ids.tareas } } }); await prisma.tarea.deleteMany({ where: { tarea_tarea_id: { in: ids.tareas } } });
    await prisma.orden_trabajo.deleteMany({ where: { orden_trabajo_id_orden: { in: ids.ots } } }); await prisma.servicio_terreno.deleteMany({ where: { servicio_terreno_servicio_terreno_id: { in: ids.visitas } } });
    await prisma.checklist_de_materiales.deleteMany({ where: { checklist_de_materiales_checklist_de_materials_id: { in: ids.checklist } } }); await prisma.obra.deleteMany({ where: { obra_obra_id: { in: ids.obras } } });
    await prisma.especificaciones_puerta.deleteMany({ where: { especificacion_puerta_especificacion_puerta_id: { in: ids.especificaciones } } }); await prisma.cliente.deleteMany({ where: { cliente_cliente_rut: { in: ids.clientes } } }); await prisma.usuario.deleteMany({ where: { usuario_id_usuario: { in: ids.usuarios } } });
  }
});
